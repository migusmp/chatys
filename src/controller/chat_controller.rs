use crate::db::messages::{find_conversation_id, get_messages};
use crate::models::chat::ChatState;
use crate::models::user::{ErrorRequest, Payload};
use crate::services::chat::{
    handle_socket, handle_socket_for_active_rooms, handle_socket_for_room_stats,
};
use axum::extract::Query;
use axum::Json;
use axum::{
    extract::{Path, WebSocketUpgrade},
    response::IntoResponse,
    Extension,
};
use serde::Deserialize;
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::RwLock;

pub async fn create_chat(
    Path(room_id): Path<String>,
    Extension(state): Extension<Arc<RwLock<ChatState>>>,
) -> impl IntoResponse {
    let mut state = state.write().await;
    state.create_room(room_id);
    "Room created".into_response()
}

pub async fn get_room_stats(
    ws: WebSocketUpgrade,
    Path(room_id): Path<String>,
    Extension(state): Extension<Arc<RwLock<ChatState>>>,
    Extension(payload): Extension<Payload>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket_for_room_stats(socket, room_id, state, payload))
}

pub async fn join_chat(
    ws: WebSocketUpgrade,
    Path(room_id): Path<String>,
    Extension(state): Extension<Arc<RwLock<ChatState>>>,
    Extension(payload): Extension<Payload>,
    Extension(pool): Extension<PgPool>
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, room_id, state, payload, pool))
}

pub async fn get_active_rooms(
    ws: WebSocketUpgrade,
    Extension(state): Extension<Arc<RwLock<ChatState>>>,
    Extension(payload): Extension<Payload>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket_for_active_rooms(socket, state, payload))
}

#[derive(Deserialize)]
pub struct Pagination {
    limit: Option<u32>,
    offset: Option<u32>,
}
pub async fn get_conversation_messages(
    Path((from_user, to_user)): Path<(i32, i32)>,
    Query(pagination): Query<Pagination>,
    Extension(pool): Extension<PgPool>,

) -> Result<impl IntoResponse, ErrorRequest> {

    let limit = pagination.limit.unwrap_or(20);
    let offset = pagination.offset.unwrap_or(0);

    match find_conversation_id(from_user, to_user, &pool).await {
        Ok(conversation_id) => {
            match get_messages(conversation_id, limit, offset, &pool).await {
                Ok(messages) => Ok(Json(messages)),
                Err(e) => {
                    eprintln!("ERROR al obtener mensajes: {}", e);
                    Err(ErrorRequest::InternalError)
                }
            }
        }
        Err(e) => {
            eprintln!("ERROR al obtener la conversación: {}", e);
            Err(ErrorRequest::InternalError)
        }
    }
}
