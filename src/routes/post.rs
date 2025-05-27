use crate::controller::post_controller::{create_post, test};
use crate::middlewares::auth::auth;
use axum::middleware::from_fn;
use axum::routing::{get, post};
use axum::Router;
use sqlx::PgPool;

pub fn post_router(_pool: PgPool) -> Router {
    Router::new()
        .route("/test", get(test))
        .route("/create", post(create_post))
        .layer(from_fn(auth))
}
