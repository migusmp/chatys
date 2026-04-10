use axum::routing::get;
use axum::{middleware::from_fn, routing::post, Extension, Router};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::controller::chat_controller::*;
use crate::middlewares::auth::auth;
use crate::models::chat::ChatState;

pub fn chat_router(state: Arc<RwLock<ChatState>>, pool: PgPool) -> Router {
    Router::new()
        .route("/create", post(create_chat))
        .route("/create-dm/{user2_id}", post(create_new_conversation))
        .route("/join/{room_id}", get(join_chat))
        .route("/stats/{room_id}", get(get_room_stats))
        .route("/active-rooms", get(get_active_rooms))
        .route(
            "/conversations/{from_user}/{to_user}",
            get(get_conversation_messages),
        )
        .route(
            "/messages/{conversation_id}",
            get(get_conversation_messages_by_id),
        )
        .route(
            "/conversation/{username}",
            get(get_conversation_messages_by_username),
        )
        .layer(from_fn(auth))
        .layer(Extension(pool))
        .layer(Extension(state))
}
