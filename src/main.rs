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

use axum::Extension;
use axum::{routing::get, Router};
use tower_http::trace::TraceLayer;
use crate::handlers::{chats_handler, index_handler, login_handler, register_handler};
use crate::middlewares::auth::auth;
use crate::services::ws::handle_ws_connection;
use crate::state::app_state::AppState;
use crate::{
    models::chat::ChatState, routes::main_router::main_router,
};
use sqlx::{Executor, PgPool};
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::services::ServeDir;

#[shuttle_runtime::main]
async fn main(#[shuttle_shared_db::Postgres] pool: PgPool,) -> shuttle_axum::ShuttleAxum {
    //let pool = init_db_pool().await;
    // tracing_subscriber::fmt()
    //     .with_max_level(tracing::Level::INFO) // o DEBUG, TRACE
    //     .with_target(false)
    //     .without_time()
    //     .init();

    // tracing::info!("Inicializando la aplicación...");

    pool.execute(include_str!("../migrations/init.sql"))
         .await
        .expect("Failed to execute init.sql");

    let mut chat_state_init = ChatState::default();
    chat_state_init.create_room(String::from("Global"));

    let chat_state = Arc::new(RwLock::new(chat_state_init));
    let app_state = Arc::new(AppState::new(pool.clone()));
    let app_state_cloned = app_state.clone();

    let ws_router = Router::new()
        .route(
            "/ws",
            get(move |payload, ws| handle_ws_connection(ws, app_state_cloned, payload)),
        )
        .route_layer(axum::middleware::from_fn(auth));

    let router = Router::new()
        .nest("/api", main_router(chat_state, pool))
        .merge(ws_router)
        .route("/", get(index_handler))
        .route("/login", get(login_handler))
        .route("/register", get(register_handler))
        .route("/chats", get(chats_handler))
        .nest_service("/static", ServeDir::new("public"))
        .layer(TraceLayer::new_for_http())
        .layer(Extension(app_state));
        
    
    Ok(router.into())
}
