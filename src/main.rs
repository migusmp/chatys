pub mod controller;
pub mod db;
pub mod errors;
pub mod handlers;
pub mod middlewares;
pub mod models;
pub mod routes;
pub mod services;
pub mod state;
pub mod utils;

use crate::middlewares::auth::auth;
use crate::models::user::Payload;
use crate::services::ws::{handle_socket_connection_for_direct_chat, handle_ws_connection};
use crate::state::app_state::AppState;
use crate::utils::cleanup_unused_images;
use crate::{models::chat::ChatState, routes::main_router::main_router};
use axum::extract::{Path, WebSocketUpgrade};
use axum::Extension;
use axum::{routing::get, Router};
use sqlx::{Executor, PgPool};
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::sleep;
use tower_http::services::ServeDir;
use tower_http::trace::TraceLayer;

use handlers::{index_handler, spa_fallback};
use utils::jwt::init_jwt_secret;

#[shuttle_runtime::main]
async fn main(#[shuttle_shared_db::Postgres] pool: PgPool) -> shuttle_axum::ShuttleAxum {
    dotenv::dotenv().ok();

    let jwt_secret = std::env::var("SECRET_KEY_JWT")
        .unwrap_or_else(|_| "sdadakj_19234ÑpoM14I83_.,@?¿98".to_string());
    init_jwt_secret(jwt_secret);

    pool.execute(include_str!("../migrations/init.sql"))
        .await
        .expect("Failed to execute init.sql");

    let pool_cleanup = pool.clone();

    // HILO ENCARGADO DE BORRAR LAS IMÁGENES QUE NO PERTENEZCAN A NINGÚN USUARIO
    tokio::spawn(async move {
        let interval = tokio::time::Duration::from_secs(300);
        loop {
            if let Err(e) = cleanup_unused_images(pool_cleanup.clone()).await {
                eprintln!("Error en cleanup de imágenes: {:?}", e);
            }
            sleep(interval).await;
        }
    });

    let mut chat_state_init = ChatState::default();
    chat_state_init.create_room(String::from("Global"));

    let chat_state = Arc::new(RwLock::new(chat_state_init));
    let app_state = Arc::new(AppState::new(pool.clone()));
    let app_state_cloned = app_state.clone();
    let pool_for_chats = pool.clone();
    let pool_for_router = pool.clone();

    // MONITOREO DE USUARIOS CONECTADOS Y CANALES DE CHAT ENTRE USUARIOS ACTIVOS
    // tokio::spawn(print_connected_user_ids_periodically(app_state.clone()));
    // tokio::spawn(print_active_dm_channels_periodically(app_state.clone()));

    let ws_router = Router::new()
        .route(
            "/ws",
            get(move |payload, ws| handle_ws_connection(ws, app_state_cloned, payload)),
        )
        .route(
            "/ws/{chat_id}",
            get(
                move |ws: WebSocketUpgrade,
                      Extension(app_state): Extension<Arc<AppState>>,
                      Extension(payload): Extension<Payload>,
                      Path(chat_id): Path<String>| {
                    handle_socket_connection_for_direct_chat(
                        ws,
                        app_state.clone(),
                        payload,
                        pool.clone(),
                        Path(chat_id),
                    )
                },
            ),
        )
        .layer(axum::middleware::from_fn(auth));

    let router = Router::new()
        .nest("/api", main_router(chat_state, pool_for_chats))
        .merge(ws_router)
        .route("/", get(index_handler))
        .nest_service("/static", ServeDir::new("public"))
        .nest_service("/assets", ServeDir::new("static/assets"))
        .nest_service("/media/user", ServeDir::new("uploads/user"))
        .fallback(spa_fallback)
        .layer(TraceLayer::new_for_http())
        .layer(Extension(pool_for_router))
        .layer(Extension(app_state));

    Ok(router.into())
}
