use crate::db::db::insert_user;
use crate::models::user::RegisterUser;
use crate::models::user::{ErrorRequest, LoginUser};
use crate::utils::responses::ApiResponse;
use crate::utils::user_utils::{
    create_payload, create_token_cookie, email_exists, username_exists, verify_user_login
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
    let check_username = username_exists(&user.username, pool);
    let check_email = email_exists(&user.email, pool);

    // future para hashear contraseña
    let hash_pwd = tokio::task::spawn_blocking({
        let password = user.password.clone();
        move || bcrypt::hash(&password, 4)
    });

    // ejecutar verificación en paralelo
    let (username_exists, email_exists) = try_join!(check_username, check_email)
        .map_err(|_| ErrorRequest::InternalError)?;

    if username_exists {
        return Err(ErrorRequest::UserAlreadyExists);
    }
    if email_exists {
        return Err(ErrorRequest::EmailExists);
    }

    let hashed_pwd = hash_pwd
        .await
        .map_err(|_| ErrorRequest::InternalError)? // si paniquea la task
        .map_err(|_| ErrorRequest::InternalError)?; // si bcrypt falla


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
