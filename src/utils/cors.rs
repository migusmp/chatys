use axum::http::{
    header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE, COOKIE},
    HeaderValue, Method,
};
use tower_http::cors::CorsLayer;

pub fn create_cors_layer() -> CorsLayer {
    let origins_env = std::env::var("CORS_ORIGINS").unwrap_or_default();

    let origins: Vec<HeaderValue> = if origins_env.is_empty() {
        vec![
            "http://127.0.0.1:5500".parse().unwrap(),
            "http://localhost:5173".parse().unwrap(),
            "http://127.0.0.1:3000".parse().unwrap(),
        ]
    } else {
        origins_env
            .split(',')
            .filter_map(|s| s.trim().parse().ok())
            .collect()
    };

    CorsLayer::new()
        .allow_origin(origins)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::PATCH])
        .allow_credentials(true)
        .allow_headers([AUTHORIZATION, ACCEPT, CONTENT_TYPE, COOKIE])
}
