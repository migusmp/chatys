use crate::controller::user_controller::{*};
use crate::middlewares::auth::auth;
use axum::routing::{delete, get, post, put};
use axum::{Router};
use sqlx::PgPool;
use tower_http::services::ServeDir;

pub fn user_router(pool: PgPool) -> Router {
    let static_images_service = ServeDir::new("uploads/user");
    let pool_login = pool.clone();
    let pool_get_friends = pool.clone();
    let pool_profile = pool.clone();

    Router::new()
        .route(
            "/register",
            post({
                let pool = pool.clone();
                move |data| user_register(data, pool)
            }),
        )
        .route("/login", post(move |data| user_login(data, pool_login)))
        .route(
            "/logout",
            post(user_logout).route_layer(axum::middleware::from_fn(auth)),
        )
        .route(
            "/info",
            get(user_info).route_layer(axum::middleware::from_fn(auth)),
        )
        .route(
            "/get-friends",
            get(move |payload| get_friends(payload, pool_get_friends))
                .route_layer(axum::middleware::from_fn(auth)),
        )
        .route(
            "/profile",
            get(move |payload| get_profile_data(payload, pool_profile))
                .route_layer(axum::middleware::from_fn(auth)),
        )
        .route(
            "/update",
            put({
                let pool = pool.clone();
                move |payload, path| user_update(payload, path, pool)
            })
            .route_layer(axum::middleware::from_fn(auth)),
        )
        .route(
            "/upload",
            post({
                let pool = pool.clone(); // 👈 clona el pool aquí
                move |payload, headers, multipart| {
                    upload_image(payload, headers, multipart, pool.clone())
                }
            })
            .route_layer(axum::middleware::from_fn(auth)),
        )
        .route(
            "/delete",
            delete({
                let pool = pool.clone();
                move |payload| {
                    delete_user_route(payload, pool)
                }
            })
            .route_layer(axum::middleware::from_fn(auth)),
        )
        .route(
            "/conversations",
            get({
                let pool = pool.clone();
                move |payload| {
                    user_conversations(payload, pool)
                }
            })
            .route_layer(axum::middleware::from_fn(auth)),
        )
        .nest_service("/images", static_images_service)
}
