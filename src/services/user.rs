use crate::db::db::insert_user;
use crate::models::user::RegisterUser;
use crate::models::user::{ErrorRequest, LoginUser};
use crate::utils::responses::ApiResponse;
use crate::utils::user_utils::{
    create_payload, create_token_cookie, verify_user_exists, verify_user_login,
};
use axum::Json;
use axum::{http::StatusCode, response::IntoResponse};
use serde_json::json;
use sqlx::PgPool;
use tokio::try_join;

pub async fn register(
    user: RegisterUser,
    pool: &PgPool,
) -> Result<impl IntoResponse, ErrorRequest> {
    // Realizamos las dos operaciones en paralelo: verificar si el usuario existe y hacer el hash de la contraseña
    let verify_future = verify_user_exists(&user, &pool);

    let hash_pwd = tokio::task::spawn_blocking({
        let password = user.password.clone(); // Clonamos la contraseña
        move || bcrypt::hash(&password, 4)
    }); // Esperamos los resultados de ambas operaciones de forma concurrente
    let (verify_result, hashed_pwd_result) =
        try_join!(verify_future, hash_pwd).map_err(|_| ErrorRequest::InternalError)?;

    // Si el usuario ya existe, devolvemos un error
    if verify_result {
        return Err(ErrorRequest::UserAlreadyExists);
    }

    let hashed_pwd = hashed_pwd_result.map_err(|_| ErrorRequest::InternalError)?;

    // insertamos el usuario
    insert_user(&user.username, &user.name, &user.email, &pool, &hashed_pwd)
        .await
        .map_err(|err| {
            eprintln!("Error al insertar: {}", err);
            ErrorRequest::InternalError
        })?;

    // Devolvemos la success response.
    Ok(ApiResponse::success("User created successfully"))
}

pub async fn login(user: LoginUser, pool: &PgPool) -> Result<impl IntoResponse, StatusCode> {
    // Verificamos que el usuario y la contraseña son correctos.
    match verify_user_login(&user, &pool).await {
        Ok(Some(user_data)) => {
            // Creamos el payload.
            let token = create_payload(user_data)
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

            let token_cookie = create_token_cookie("auth", std::borrow::Cow::Owned(token)).await;

            Ok(ApiResponse::SuccessWithCookie(
                StatusCode::OK,
                Json(json!({
                    "status": "success",
                    "message": "Login successful",
                })),
                token_cookie,
            ))
        }
        Ok(None) => {
            // Si la contraseña es incorrecta
            Ok(ApiResponse::error(
                StatusCode::BAD_REQUEST,
                "Invalid password or user doesn't exist",
            ))
        }
        Err(_e) => {
            return Ok(ApiResponse::error(
                StatusCode::BAD_REQUEST,
                "this user doesn't exist",
            ));
        }
    }
}
