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

use crate::db::chat::ensure_room_conversation;
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
use tokio_util::sync::CancellationToken;
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
    let cleanup_shutdown = CancellationToken::new();
    let cleanup_shutdown_task = cleanup_shutdown.clone();

    // HILO ENCARGADO DE BORRAR LAS IMÁGENES QUE NO PERTENEZCAN A NINGÚN USUARIO
    tokio::spawn(async move {
        let interval = tokio::time::Duration::from_secs(300);
        loop {
            if let Err(e) = cleanup_unused_images(pool_cleanup.clone()).await {
                eprintln!("Error en cleanup de imágenes: {:?}", e);
            }

            tokio::select! {
                _ = cleanup_shutdown_task.cancelled() => {
                    break;
                }
                _ = sleep(interval) => {}
            }
        }
    });

    let cleanup_shutdown_signal = cleanup_shutdown.clone();
    tokio::spawn(async move {
        if tokio::signal::ctrl_c().await.is_ok() {
            cleanup_shutdown_signal.cancel();
        }
    });

    // Seed the Global room record in the DB (idempotent — ON CONFLICT DO NOTHING).
    // We insert without a created_by owner since Global is a system room.
    sqlx::query(
        r#"
        INSERT INTO rooms (name, description)
        VALUES ('Global', 'Sala principal')
        ON CONFLICT (name) DO NOTHING
        "#,
    )
    .execute(&pool)
    .await
    .expect("Failed to seed Global room");

    // Ensure the Global room has a linked conversation for message persistence.
    let global_conversation_id = ensure_room_conversation("Global", &pool)
        .await
        .expect("Failed to ensure conversation for Global room");

    let mut chat_state_init = ChatState::default();
    // Seed the Global room in memory with its DB conversation_id
    chat_state_init.create_room_with_conversation(
        String::from("Global"),
        Some(String::from("Sala principal")),
        None,
        global_conversation_id,
    );

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
        .nest_service("/media/rooms", ServeDir::new("uploads/rooms"))
        .fallback(spa_fallback)
        .layer(TraceLayer::new_for_http())
        .layer(Extension(pool_for_router))
        .layer(Extension(app_state));

    Ok(router.into())
}
