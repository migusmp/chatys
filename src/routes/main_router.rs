use crate::models::chat::ChatState;
use crate::state::app_state::AppState;

use super::{chat::chat_router, friend::friend_router, post::post_router, user::user_router};
use axum::Router;
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::RwLock;

pub fn main_router(
    chat_state: Arc<RwLock<ChatState>>,
    pool: PgPool,
    app_state: Arc<AppState>,
) -> Router {
    let chat_router = chat_router(chat_state.clone(), pool.clone(), app_state);

    Router::new()
        .nest("/user", user_router(pool.clone()))
        .nest("/post", post_router(pool.clone()))
        .nest("/chat", chat_router)
        .nest("/friend", friend_router(pool.clone()))
}
