//use std::fs;
use askama::Template;
use axum::{response::{Html, IntoResponse, Redirect, Response}, Extension};
use axum_extra::extract::CookieJar;
use hyper::StatusCode;
use sqlx::PgPool;
use tokio::fs;

use crate::{db::db::{get_user_friends, Friend}, utils::user_utils::decode_token};

#[allow(dead_code)]
#[derive(Template)]
#[template(path = "friends.html")]
struct FriendsTemplate {
    pub friends: Vec<Friend>,
}

// fn go_to(html_file: &str, jar: CookieJar) -> Response {
//     if jar.get("auth").is_some() {
//         match fs::read_to_string(html_file) {
//             Ok(contents) => Html(include_str!(contents)).into_response(),
//             Err(_) => (axum::http::StatusCode::INTERNAL_SERVER_ERROR, "Error").into_response(),
//         }
//     } else {
//         Redirect::to("/login").into_response()
//     }
// }

pub async fn not_found() -> impl axum::response::IntoResponse {
    (axum::http::StatusCode::NOT_FOUND, "Archivo no encontrado")
}

pub async fn spa_fallback(jar: CookieJar) -> impl IntoResponse {
    if jar.get("auth").is_some() {
        match fs::read_to_string("public/index.html").await {
            Ok(contents) => Html(contents).into_response(),
            Err(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Error al cargar la SPA".to_string(),
            )
                .into_response(),
        }
    } else {
        Redirect::to("/login").into_response()
    }
}

pub async fn index_handler(jar: CookieJar) -> impl IntoResponse {
    if jar.get("auth").is_some() {
        match fs::read_to_string("static/index.html").await {
            Ok(contents) => Html(contents).into_response(),
            Err(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Error al cargar la página".to_string(),
            )
                .into_response(),
        }
    } else {
        // Redirige al login si no tiene la cookie
        Redirect::to("/login").into_response()
    }
}

pub async fn chats_handler(jar: CookieJar) -> Response {
    if jar.get("auth").is_some() {
        Html(include_str!("../../public/chats.html")).into_response()
    } else {
        Redirect::to("/login").into_response()
    }
}

pub async fn friends_handler(jar: CookieJar, Extension(pool): Extension<PgPool>) -> impl IntoResponse {
    let auth_cookie = match jar.get("auth") {
        Some(cookie) => cookie.value().to_string(),
        None => return Redirect::to("/login").into_response(),
    };

    // Llamas a tu función para decodificar el token
    let payload = match decode_token(auth_cookie).await {
        Ok(p) => p,
        Err(_) => return Redirect::to("/login").into_response(),
    };

    // Asumiendo que get_user_friends devuelve Result<Vec<Friend>, Error>
    let friends = match get_user_friends(payload.id, &pool).await {
        Ok(f) => f,
        Err(_) => {
            // Maneja error (puedes devolver un 500 o un mensaje)
            return (StatusCode::INTERNAL_SERVER_ERROR, "Error al obtener amigos").into_response();
        }
    };

    let template = FriendsTemplate { friends };

    match template.render() {
        Ok(html) => Html(html).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Error al renderizar").into_response(),
    }
}



pub async fn login_handler(jar: CookieJar) -> Response {
    if jar.get("auth").is_some() {
        Redirect::to("/").into_response()
    } else {
        match tokio::fs::read_to_string("public/login.html").await {
            Ok(contents) => Html(contents).into_response(),
            Err(_) => (axum::http::StatusCode::INTERNAL_SERVER_ERROR, "Error loading page").into_response(),
        }
    }
}


pub async fn register_handler(jar: CookieJar) -> Response {
    if jar.get("auth").is_some() {
        Redirect::to("/").into_response()
    } else {
        match tokio::fs::read_to_string("public/register.html").await {
            Ok(contents) => Html(contents).into_response(),
            Err(_) => (axum::http::StatusCode::INTERNAL_SERVER_ERROR, "Error loading page").into_response(),
        }
    }
}
