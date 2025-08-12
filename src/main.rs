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

use axum::extract::{Path, WebSocketUpgrade};
use axum::Extension;
use axum::{routing::get, Router};
use tokio::time::sleep;
use tower_http::trace::TraceLayer;
use crate::middlewares::auth::auth;
use crate::models::user::Payload;
use crate::services::ws::{handle_ws_connection, handle_socket_connection_for_direct_chat};
use crate::state::app_state::AppState;
use crate::utils::cleanup_unused_images;
use crate::{
    models::chat::ChatState, routes::main_router::main_router,
};
use sqlx::{Executor, PgPool};
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::services::ServeDir;

use handlers::{index_handler, spa_fallback};

#[shuttle_runtime::main]
async fn main(#[shuttle_shared_db::Postgres] pool: PgPool,) -> shuttle_axum::ShuttleAxum {
    dotenv::dotenv().ok();

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

    tokio::spawn(print_connected_user_ids_periodically(app_state.clone()));
    tokio::spawn(print_active_dm_channels_periodically(app_state.clone()));


    let ws_router = Router::new()
        .route(
            "/ws",
            get(move |payload, ws| handle_ws_connection(ws, app_state_cloned, payload)),
        )
        .route(
            "/ws/{chat_id}",
            get(move |ws: WebSocketUpgrade, Extension(app_state): Extension<Arc<AppState>>, Extension(payload): Extension<Payload>, Path(chat_id): Path<String>| {
                handle_socket_connection_for_direct_chat(ws, app_state.clone(), payload, pool.clone(), Path(chat_id))
            }),
        )
        .layer(axum::middleware::from_fn(auth));

    let router = Router::new()
        .nest("/api", main_router(chat_state, pool_for_chats))
        .merge(ws_router)
        // .route_service("/", ServeDir::new("public/index.html"))
        .route("/", get(index_handler))
        // .route("/login", get(login_handler))
        // .route("/register", get(register_handler))
        // .route("/chats", get(chats_handler))
        // .route("/friends", get(friends_handler))
        .nest_service("/static", ServeDir::new("public"))
        .nest_service("/assets", ServeDir::new("static/assets"))
        .nest_service("/media/user", ServeDir::new("uploads/user"))
        .fallback(spa_fallback)
        .layer(TraceLayer::new_for_http())
        .layer(Extension(pool_for_router))
        .layer(Extension(app_state));
        
    
    Ok(router.into())
}


async fn print_connected_user_ids_periodically(app_state: Arc<AppState>) {
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(2));

    loop {
        interval.tick().await;

        let connected_users = app_state.connected_users.lock().await;

        let ids: Vec<i32> = connected_users.keys().copied().collect();

        println!("Users connected ({}): {:?}", connected_users.len(), ids);
    }
}

async fn print_active_dm_channels_periodically(app_state: Arc<AppState>) {
    loop {
        app_state.print_active_direct_message_channels();
        sleep(tokio::time::Duration::from_secs(2)).await;
    }
}

