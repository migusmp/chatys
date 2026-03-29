use crate::errors::AppError;
use crate::utils::user_utils::decode_token;
use axum::{
    body::Body,
    http::{HeaderValue, Request},
    middleware::Next,
    response::IntoResponse,
};

pub async fn auth(mut req: Request<Body>, next: Next) -> impl IntoResponse {
    // Obtenemos todos los headers de la petición.
    let headers = req.headers().clone();
    // Si esta el header 'cookie' ejecutamos el siguiente codigo
    if let Some(cookie_header) = headers.get("cookie") {
        match get_auth_cookie(cookie_header).await {
            Ok(auth_token) => {
                match decode_token(auth_token.to_string()).await {
                    Ok(payload) => {
                        // let mut req = req.map(|_body| Body::empty());
                        // Insertamos el payload como extension en los headers.
                        req.extensions_mut().insert(payload);
                        return next.run(req).await;
                    }
                    Err(e) => return e.into_response(),
                };
            }
            Err(e) => return e.into_response(),
        };
    }
    AppError::Unauthorized.into_response()
}

async fn get_auth_cookie(cookie_header: &HeaderValue) -> Result<String, AppError> {
    if let Ok(cookie_str) = cookie_header.to_str() {
        for cookie in cookie_str.split(';') {
            let cookie = cookie.trim();
            if let Some(auth_token) = cookie.strip_prefix("auth=") {
                return Ok(auth_token.to_string());
            }
        }
        return Err(AppError::AuthCookieNotFound);
    }
    Err(AppError::NoneCookieFound)
}
