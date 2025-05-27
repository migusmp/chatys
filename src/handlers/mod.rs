//use std::fs;

use axum::response::{Html, IntoResponse, Redirect, Response};
use axum_extra::extract::CookieJar;

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

pub async fn index_handler(jar: CookieJar) -> Response {
    if jar.get("auth").is_some() {
        Html(include_str!("../../public/index.html")).into_response()
    } else {
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
