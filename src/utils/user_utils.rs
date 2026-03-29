use std::borrow::Cow;

use axum::{http::StatusCode, response::Response};
use bcrypt::BcryptError;
use chrono::{Duration, Utc};
use cookie::{
    time::{self},
    Cookie,
};
use jsonwebtoken::{DecodingKey, TokenData, Validation};
use sqlx::PgPool;

use crate::models::user::{LoginUser, Payload, RegisterUser, User};
use crate::utils::jwt::get_jwt_secret;

// Verificamos que el usuario exista
pub async fn verify_user_exists(user: &RegisterUser, pool: &PgPool) -> Result<bool, sqlx::Error> {
    // Consulta SQL para verificar si el usuario existe por correo o nombre de usuario
    let result: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*) 
        FROM users 
        WHERE email = $1 OR username = $2
        "#,
    )
    .bind(&user.email)
    .bind(&user.username)
    .fetch_one(&*pool) // Ejecuta la consulta de forma asíncrona
    .await?;

    Ok(result.0 > 0) // Si COUNT(*) > 0, el usuario existe
}

pub async fn username_exists(username: &str, pool: &PgPool) -> Result<bool, sqlx::Error> {
    let result: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users WHERE username = $1")
        .bind(username)
        .fetch_one(pool)
        .await?;
    Ok(result.0 > 0)
}

pub async fn email_exists(email: &str, pool: &PgPool) -> Result<bool, sqlx::Error> {
    let result: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users WHERE email = $1")
        .bind(email)
        .fetch_one(pool)
        .await?;
    Ok(result.0 > 0)
}

// Función para verificar que el usuario y la contraseña son correctos
pub async fn verify_user_login(
    user_login: &LoginUser,
    pool: &PgPool,
) -> Result<Option<User>, Box<dyn std::error::Error + Send + Sync>> {
    // Realizamos la consulta para obtener los datos del usuario por `username`.
    let row = sqlx::query!(
        r#"
        SELECT id, username, email, password, image, name, created_at
        FROM users
        WHERE username = $1
        "#,
        user_login.username
    )
    .fetch_optional(pool)
    .await?;

    // Si no se encuentra el usuario, devolvemos `None`.
    let row = match row {
        Some(row) => row,
        None => return Ok(None),
    };

    if hashed_pwd(&user_login.password, &row.password)? {
        let created_at = row.created_at.map(|dt| dt.to_string());

        Ok(Some(User {
            id: row.id,
            username: row.username,
            name: row.name,
            email: row.email,
            image: row.image.unwrap(),
            password: row.password,
            created_at,
        }))
    } else {
        Ok(None)
    }
}

pub fn hashed_pwd(pwd: &String, hashed_pwd: &str) -> Result<bool, BcryptError> {
    bcrypt::verify(pwd, hashed_pwd)
}

pub async fn create_payload(user_data: User) -> Result<String, jsonwebtoken::errors::Error> {
    let iat = Utc::now().timestamp();
    let exp = (Utc::now() + Duration::days(7)).timestamp();
    let user_payload = Payload::new(
        user_data.id,
        user_data.username,
        user_data.name,
        user_data.email,
        user_data.image,
        user_data.created_at,
        exp,
        iat,
    );
    user_payload.token()
}

pub async fn create_token_cookie<'a>(name_cookie: &'a str, token: Cow<'a, str>) -> Cookie<'a> {
    Cookie::build((name_cookie, token))
        .http_only(true) // Evita que sea accesible desde JavaScript.
        .same_site(cookie::SameSite::Lax)
        .secure(true)
        .path("/")
        .max_age(time::Duration::days(7))
        .build()
}

pub fn append_cookie_to_response(res: &mut Response, cookie: Cookie) {
    let cookie_header = cookie.to_string();
    let parsed_cookie = cookie_header
        .parse::<axum::http::HeaderValue>()
        .map_err(|err| eprintln!("Error parseando cookie para header: {err}"));

    if let Ok(parsed_cookie) = parsed_cookie {
        res.headers_mut()
            .append(axum::http::header::SET_COOKIE, parsed_cookie);
    }
}

pub async fn decode_token(auth_token: String) -> Result<Payload, StatusCode> {
    let token_data: TokenData<Payload> = jsonwebtoken::decode(
        &auth_token,
        &DecodingKey::from_secret(get_jwt_secret().as_ref()),
        &Validation::default(),
    )
    .map_err(|e| {
        use jsonwebtoken::errors::ErrorKind;
        match e.kind() {
            ErrorKind::ExpiredSignature => StatusCode::UNAUTHORIZED,
            ErrorKind::InvalidToken | ErrorKind::InvalidSignature => StatusCode::UNAUTHORIZED,
            _ => {
                eprintln!("Error al decodificar el token: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            }
        }
    })?;

    Ok(token_data.claims)
}
