use crate::db::conversations::get_user_conversations;
use crate::db::db::{
    delete_user, get_user_friends, get_user_friends_by_username, get_user_profile_data, get_user_profile_data_by_username, update_name_from_user, update_user_description, update_user_email, update_user_image, update_user_name, update_user_pwd, UpdateUserDescription, UpdateUserEmail, UpdateUserName, UpdateUserPassword
};
use crate::models::user::{ErrorRequest, LoginUser, Payload, RegisterUser, UpdateData};
use crate::services::user::{login, register};
use crate::utils::responses::ApiResponse;
use axum::extract::{Multipart, Path};
use axum::http::{HeaderMap, HeaderValue};
use axum::{http::StatusCode, response::IntoResponse, Form};
use axum::{Extension, Json};
use sqlx::PgPool;
use tokio::fs;
use uuid::Uuid;

const MAX_CONTENT_LENGTH: u64 = 10 * 1024 * 1024; // 10 MB

// Ruta de registro de usuarios.
pub async fn user_register(
    Form(data): Form<RegisterUser>,
    pool: PgPool,
) -> Result<impl IntoResponse, ErrorRequest> {
    // Accedemos a los datos del usuario
    let username = &data.username;
    let name = &data.name;
    let email = &data.email;
    let password = &data.password;

    if username.trim().is_empty() {
        return Err(ErrorRequest::UsernameEmpty);
    }

    if name.trim().is_empty() {
        return Err(ErrorRequest::NameEmpty);
    }

    if username.len() < 3 {
        return Err(ErrorRequest::UsernameInvalid);
    }

    if !email.contains("@") {
        return Err(ErrorRequest::InvalidEmail);
    }

    if password.len() < 4 {
        return Err(ErrorRequest::ShortPassword);
    }

    // Llamamos al servicio de registro
    let new_user = RegisterUser::new(
        username.to_string(),
        name.to_string(),
        email.to_string(),
        password.to_string(),
    );

    Ok(register(new_user, &pool).await)
}

// Ruta de inicio de sesión de usuarios.
pub async fn user_login(
    Form(data): Form<LoginUser>,
    pool: PgPool,
) -> Result<impl IntoResponse, ErrorRequest> {
    // Accedemos a los datos del usuario
    let username = &data.username;
    let password = &data.password;

    // Llamamos al servicio de registro
    let user = LoginUser::new(username.to_string(), password.to_string());

    Ok(login(user, &pool).await)
}

// Hacer ruta de logout
pub async fn user_logout() -> impl IntoResponse {
    let mut headers = HeaderMap::new();
    headers.insert(
        "Set-Cookie",
        HeaderValue::from_static("auth=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax"),
    );

    (StatusCode::OK, headers)
}

// Ruta de informacion de usuario (Probar decodear el payload)
pub async fn user_info(
    Extension(_payload): Extension<Payload>,
) -> Result<impl IntoResponse, StatusCode> {
    Ok(ApiResponse::success("Usuario verificado correctamente"))
}

pub async fn user_update(
    Extension(payload): Extension<Payload>,
    Form(update_info): Form<UpdateData>,
    pool: PgPool,
) -> Result<impl IntoResponse, ErrorRequest> {
    if let Some(username) = update_info.username {
        match update_user_name(username, payload.id, &pool).await {
            UpdateUserName::UserNameUpdated => {}
            UpdateUserName::UserExists => {
                return Err(ErrorRequest::UserAlreadyExists);
            }
            UpdateUserName::ConsultError => {
                println!("Error en la consulta");
                return Err(ErrorRequest::InternalError);
            }
        }
    }

    if let Some(pwd) = update_info.password {
        match update_user_pwd(pwd, payload.id, &pool).await {
            UpdateUserPassword::PasswordUpdated => {}
            UpdateUserPassword::ErrorPasswordUpdate => {
                return Err(ErrorRequest::ErrorPasswordUpdate)
            }
        }
    }

    if let Some(email) = update_info.email {
        match update_user_email(email, payload.id, &pool).await {
            UpdateUserEmail::EmailUpdated => {}
            UpdateUserEmail::ErrorEmailUpdate => return Err(ErrorRequest::ErrorEmailUpdate),
            UpdateUserEmail::EmailAlreadyExist => return Err(ErrorRequest::EmailExists),
            UpdateUserEmail::InvalidEmail => return Err(ErrorRequest::InvalidEmail),
        }
    }

    if let Some(name) = update_info.name {
        match update_name_from_user(name, payload.id, &pool).await {
            UpdateUserName::UserNameUpdated => {}
            UpdateUserName::UserExists => {
                return Err(ErrorRequest::UserAlreadyExists);
            }
            UpdateUserName::ConsultError => {
                println!("Error en la consulta");
                return Err(ErrorRequest::InternalError);
            }
        }
    }

    if let Some(description) = update_info.description {
        match update_user_description(description, payload.id, &pool).await {
            UpdateUserDescription::DescriptionUpdated => {}
            UpdateUserDescription::ErrorDescriptionUpdate => {
                return Err(ErrorRequest::InternalError)
            }
        }
    }

    Ok(ApiResponse::success("Data updated"))
}

pub async fn get_friends(
    Extension(payload): Extension<Payload>,
    pool: PgPool,
) -> Result<impl IntoResponse, ErrorRequest> {
    let friends = match get_user_friends(payload.id, &pool).await {
        Ok(f) => f,
        Err(_e) => return Err(ErrorRequest::InternalError),
    };
    Ok(ApiResponse::success_with_data("friends:", Some(friends)))
}

// TODO
pub async fn get_friends_from_user(
    Path(username): Path<String>,
    Extension(_payload): Extension<Payload>,
    pool: PgPool,
) -> Result<impl IntoResponse, ErrorRequest> {
    let friends = match get_user_friends_by_username(username, &pool).await {
        Ok(f) => f
            .into_iter()
            .map(|mut friend| {
                friend.image = format!("/media/user/{}", friend.image);
                friend
            })
            .collect::<Vec<_>>(),
        Err(_e) => return Err(ErrorRequest::InternalError),
    };

    Ok(ApiResponse::success_with_data("friends:", Some(friends)))
}

pub async fn get_profile_data(
    Extension(payload): Extension<Payload>,
    pool: PgPool,
) -> Result<impl IntoResponse, ErrorRequest> {
    let user_info = match get_user_profile_data(payload.id, &pool).await {
        Ok(mut info) => {
            info.image = format!("/media/user/{}", info.image);
            info
        }
        Err(_e) => return Err(ErrorRequest::InternalError),
    };
    Ok(ApiResponse::success_with_data("profile", Some(user_info)))
}

pub async fn get_profile_data_from_user(
    Path(username): Path<String>,
    Extension(_payload): Extension<Payload>,
    pool: PgPool,
) -> Result<impl IntoResponse, ErrorRequest> {
    let user_info = match get_user_profile_data_by_username(username, &pool).await {
        Ok(mut info) => {
            info.image = format!("/media/user/{}", info.image);
            info
        }
        Err(_e) => return Err(ErrorRequest::InternalError),
    };
    Ok(ApiResponse::success_with_data("profile", Some(user_info)))
}

pub async fn upload_image(
    Extension(payload): Extension<Payload>,
    headers: HeaderMap,
    multipart: Multipart,
    pool: PgPool,
) -> Result<impl IntoResponse, ErrorRequest> {
    if let Some(content_length) = headers.get("content-length") {
        let content_length = content_length
            .to_str()
            .unwrap_or("0")
            .parse::<u64>()
            .unwrap_or(0);
        if content_length > MAX_CONTENT_LENGTH {
            return Err(ErrorRequest::UsernameEmpty);
        }
    }

    let mut file_name = String::new();

    let mut fields = multipart; // Procesamos el contenido del multipart.

    while let Some(field) = fields.next_field().await.map_err(|e| {
        eprintln!("Error: {:?}", e);
        ErrorRequest::InternalError
    })? {
        let _name = field.name().unwrap_or("file");
        let content_type = field.content_type().unwrap_or("application/octet-stream");

        // Check this file is an image.
        if !content_type.starts_with("image/") {
            return Err(ErrorRequest::InvalidImageFormat);
        }

        let file_extension = match content_type.split('/').last() {
            Some(ext) => ext,
            None => return Err(ErrorRequest::InvalidImageFormat),
        };

        file_name = format!("{}.{}", Uuid::new_v4(), file_extension);

        // Guardar el archivo.
        let data = field.bytes().await.map_err(|e| {
            eprintln!("Error to save uploaded file: {:?}", e);
            ErrorRequest::InternalError
        })?;

        let path = format!("./uploads/user/{}", file_name);
        fs::write(&path, &data).await.map_err(|e| {
            eprintln!("Error al guardar el archivo: {:?}", e);
            ErrorRequest::InternalError
        })?;
    }
    update_user_image(payload.id, file_name, &pool)
        .await
        .map_err(|e| {
            eprintln!("Error actualizando la imagen del usuario: {:?}", e);
            ErrorRequest::InternalError
        })?;
    Ok(ApiResponse::success("Image updated"))
}

pub async fn delete_user_route(
    Extension(payload): Extension<Payload>,
    pool: PgPool,
) -> Result<impl IntoResponse, ErrorRequest> {
    match delete_user(payload.id, pool).await {
        Ok(_) => {
            let mut headers = HeaderMap::new();
            headers.insert(
                "Set-Cookie",
                HeaderValue::from_static(
                    "auth=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax",
                ),
            );

            Ok((
                StatusCode::OK,
                headers,
                ApiResponse::success("User deleted successfully"),
            ))
        }
        Err(_) => Err(ErrorRequest::InternalError),
    }
}

pub async fn user_conversations(
    Extension(payload): Extension<Payload>,
    pool: PgPool,
) -> Result<impl IntoResponse, ErrorRequest> {
    match get_user_conversations(payload.id, &pool).await {
        Ok(conversations) => Ok(Json(conversations)),
        Err(e) => {
            eprintln!(
                "Error al obtener las conversaciones del usuario {}: {}",
                payload.id, e
            );
            Err(ErrorRequest::InternalError)
        }
    }
    // Ok(ApiResponse::success("Routes added successfully"))
}
