use crate::{
    models::user::{ErrorRequest, Payload},
    state::app_state::AppState,
    utils::responses::ApiResponse,
};
use axum::{extract::Path, response::IntoResponse, Extension};
use sqlx::PgPool;
use std::sync::Arc;

pub async fn send_friend_request(
    pool: PgPool,
    Extension(payload): Extension<Payload>,
    Path(friend_id): Path<String>,
    Extension(app_state): Extension<Arc<AppState>>,
) -> Result<impl IntoResponse, ErrorRequest> {
    // Intentar parsear el ID del amigo
    let friend_id = friend_id
        .parse::<i32>()
        .map_err(|_| ErrorRequest::InvalidFriendRequest)?;

    // Asegurarse de que el ID del amigo no sea el mismo que el del usuario
    if payload.id == friend_id {
        return Err(ErrorRequest::InvalidFriendRequest);
    }

    // Verificar si ya son amigos
    let already_friends = sqlx::query_scalar!(
        "SELECT 1 FROM friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)",
        payload.id,
        friend_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        println!("Error en X: {:?}", e);
        ErrorRequest::InternalError
    })?;

    if already_friends.is_some() {
        return Err(ErrorRequest::AlreadyFriends);
    }
    // Verificar si ya existe una solicitud pendiente de este remitente (sender_id) al receptor (user_id)
    let existing_request = sqlx::query_scalar!(
        "SELECT 1 FROM friend_requests WHERE sender_id = $1 AND user_id = $2 AND status = 'pending'",
        payload.id,
        friend_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        println!("Error en X: {:?}", e);
        ErrorRequest::InternalError
    })?;

    if existing_request.is_some() {
        return Err(ErrorRequest::DuplicateFriendRequest);
    }

    // Enviar notificación de solicitud de amistad
    let _ = app_state
        .send_friend_notification(friend_id, payload.username, payload.id)
        .await;

    Ok(ApiResponse::success("User friend requested successfully"))
}

pub async fn accept_friend_request(
    pool: PgPool,
    Extension(payload): Extension<Payload>,
    Path(user_requested_friend_id): Path<String>,
    Extension(app_state): Extension<Arc<AppState>>,
) -> Result<impl IntoResponse, ErrorRequest> {
    let friend_requested_id = user_requested_friend_id
        .parse::<i32>()
        .map_err(|_| ErrorRequest::InternalError)?;

    if payload.id == friend_requested_id {
        return Err(ErrorRequest::InvalidFriendRequest);
    }

    // Verificar si la solicitud de amistad existe y está pendiente
    let existing_request = sqlx::query_scalar!(
        "SELECT 1 FROM friend_requests WHERE user_id = $1 AND sender_id = $2 AND status = 'pending'",
        payload.id,
        friend_requested_id,
    )
    .fetch_optional(&pool)
    .await
    .map_err(|_| ErrorRequest::InternalError)?;

    if existing_request.is_none() {
        return Err(ErrorRequest::NoFriendRequestFound);
    }

    // Actualizar la solicitud de amistad a 'accepted'
    app_state
        .mark_friend_request_as_accepted(friend_requested_id, payload.id)
        .await
        .map_err(|_| ErrorRequest::InternalError)?;

    // Insertar la relación de amistad en la tabla `friends`
    sqlx::query!(
        "INSERT INTO friends (user_id, friend_id) VALUES ($1, $2), ($2, $1)",
        friend_requested_id,
        payload.id
    )
    .execute(&pool)
    .await
    .map_err(|_| ErrorRequest::InternalError)?;

    // Enviar notificación de aceptación de solicitud de amistad
    if let Err(e) = app_state
        .accept_friend_notification(friend_requested_id, payload.name.clone(), payload.id)
        .await
    {
        eprintln!(
            "Error al enviar notificación de aceptación de amistad: {:?}",
            e
        );
    }
    // Responder exitosamente
    Ok(ApiResponse::success("Friend added successfully"))
}
