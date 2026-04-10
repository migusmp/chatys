use crate::db::chat::{create_room_record, ensure_room_conversation};
use crate::db::conversations::create_conversation;
use crate::db::db::find_user_by_username;
use crate::db::messages::{
    find_conversation_id, get_conversation_details, get_messages, FullConversationResponse,
};
use crate::models::chat::ChatState;
use crate::models::user::{ErrorRequest, Payload};
use crate::services::chat::{
    handle_socket, handle_socket_for_active_rooms, handle_socket_for_room_stats,
};
use crate::services::ws::notify_user_with_active_friends;
use crate::state::app_state::AppState;
use crate::utils::responses::ApiResponse;
use axum::extract::{Multipart, Query};
use axum::http::HeaderMap;
use axum::Json;
use axum::{
    extract::{Path, WebSocketUpgrade},
    response::IntoResponse,
    Extension,
};
use hyper::StatusCode;
use serde::Deserialize;
use sqlx::PgPool;
use std::sync::Arc;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use tokio::sync::RwLock;
use uuid::Uuid;

const MAX_CONTENT_LENGTH: u64 = 5 * 1024 * 1024; // 5 MB
const MAX_ROOM_NAME_LENGTH: usize = 100;
const MAX_DESCRIPTION_LENGTH: usize = 500;

pub async fn create_chat(
    Extension(payload): Extension<Payload>,
    Extension(state): Extension<Arc<RwLock<ChatState>>>,
    Extension(pool): Extension<PgPool>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, ErrorRequest> {
    // Validate content-length header when present
    if let Some(content_length) = headers.get("content-length") {
        let length = content_length
            .to_str()
            .unwrap_or("0")
            .parse::<u64>()
            .unwrap_or(0);

        if length > MAX_CONTENT_LENGTH {
            return Err(ErrorRequest::FileTooLarge);
        }
    }

    let mut room_name: Option<String> = None;
    let mut description: Option<String> = None;
    let mut image_filename: Option<String> = None;

    while let Some(mut field) = multipart.next_field().await.map_err(|e| {
        eprintln!("Error leyendo campo multipart: {:?}", e);
        ErrorRequest::InternalError
    })? {
        let field_name = field.name().unwrap_or("").to_string();

        match field_name.as_str() {
            "name" => {
                let value = field.text().await.map_err(|e| {
                    eprintln!("Error leyendo campo name: {:?}", e);
                    ErrorRequest::InternalError
                })?;
                let trimmed = value.trim().to_string();

                if trimmed.is_empty() {
                    return Err(ErrorRequest::BadParameter);
                }

                if trimmed.len() > MAX_ROOM_NAME_LENGTH {
                    return Err(ErrorRequest::BadParameter);
                }

                // Reserve the "Global" name for the system room
                if trimmed.to_lowercase() == "global" {
                    return Err(ErrorRequest::BadParameter);
                }

                room_name = Some(trimmed);
            }

            "description" => {
                let value = field.text().await.map_err(|e| {
                    eprintln!("Error leyendo campo description: {:?}", e);
                    ErrorRequest::InternalError
                })?;
                let trimmed = value.trim().to_string();

                if !trimmed.is_empty() {
                    if trimmed.len() > MAX_DESCRIPTION_LENGTH {
                        return Err(ErrorRequest::BadParameter);
                    }
                    description = Some(trimmed);
                }
            }

            "image" => {
                // Validate declared MIME type
                let content_type = field
                    .content_type()
                    .unwrap_or("application/octet-stream")
                    .to_string();

                if !content_type.starts_with("image/") {
                    return Err(ErrorRequest::InvalidImageFormat);
                }

                let file_extension = content_type
                    .split('/')
                    .last()
                    .ok_or(ErrorRequest::InvalidImageFormat)?
                    .to_string();

                let filename = format!("{}.{}", Uuid::new_v4(), file_extension);
                let path = format!("./uploads/rooms/{}", filename);

                // Read first chunk to validate magic bytes with infer
                let first_chunk = field.chunk().await.map_err(|e| {
                    eprintln!("Error leyendo primer chunk de imagen: {:?}", e);
                    ErrorRequest::InternalError
                })?;

                let Some(first_chunk) = first_chunk else {
                    return Err(ErrorRequest::InvalidImageFormat);
                };

                if let Some(kind) = infer::get(&first_chunk) {
                    if !kind.mime_type().starts_with("image/") {
                        return Err(ErrorRequest::InvalidImageFormat);
                    }
                } else {
                    return Err(ErrorRequest::InvalidImageFormat);
                }

                // Ensure the uploads/rooms directory exists
                fs::create_dir_all("./uploads/rooms").await.map_err(|e| {
                    eprintln!("Error creando directorio uploads/rooms: {:?}", e);
                    ErrorRequest::InternalError
                })?;

                let mut file = fs::File::create(&path).await.map_err(|e| {
                    eprintln!("Error creando archivo de imagen: {:?}", e);
                    ErrorRequest::InternalError
                })?;

                let mut total_size: u64 = first_chunk.len() as u64;

                file.write_all(&first_chunk).await.map_err(|e| {
                    eprintln!("Error escribiendo primer chunk: {:?}", e);
                    ErrorRequest::InternalError
                })?;

                // Stream the rest of the file with size guard
                while let Some(chunk) = field.chunk().await.map_err(|e| {
                    eprintln!("Error leyendo chunk de imagen: {:?}", e);
                    ErrorRequest::InternalError
                })? {
                    total_size += chunk.len() as u64;

                    if total_size > MAX_CONTENT_LENGTH {
                        let _ = fs::remove_file(&path).await;
                        return Err(ErrorRequest::FileTooLarge);
                    }

                    file.write_all(&chunk).await.map_err(|e| {
                        eprintln!("Error escribiendo chunk: {:?}", e);
                        ErrorRequest::InternalError
                    })?;
                }

                image_filename = Some(filename);
            }

            _ => {
                // Drain unknown fields to avoid blocking the multipart stream
                while field.chunk().await.map_err(|_| ErrorRequest::InternalError)?.is_some() {}
            }
        }
    }

    let name = room_name.ok_or(ErrorRequest::BadParameter)?;

    // Persist to DB before touching in-memory state
    if let Err(e) = create_room_record(
        &name,
        description.as_deref(),
        image_filename.as_deref(),
        payload.id,
        &pool,
    )
    .await
    {
        eprintln!("Error guardando sala en DB: {:?}", e);
        // Clean up uploaded file if DB write fails
        if let Some(ref filename) = image_filename {
            let _ = fs::remove_file(format!("./uploads/rooms/{}", filename)).await;
        }
        return Err(ErrorRequest::InternalError);
    }

    // Create and link a conversation for the new room so messages can be persisted
    let conversation_id = match ensure_room_conversation(&name, &pool).await {
        Ok(id) => id,
        Err(e) => {
            eprintln!("Error creando conversación para sala {}: {:?}", name, e);
            // Room was created but conversation failed — fall back to no persistence
            // rather than rolling back the room creation
            let mut state_guard = state.write().await;
            state_guard.create_room(name.clone(), description.clone(), image_filename.clone());

            let image_url = image_filename
                .as_deref()
                .map(|f| format!("/media/rooms/{}", f));

            return Ok(ApiResponse::success_with_data(
                "Room created",
                Some(serde_json::json!({
                    "name": name,
                    "image": image_url,
                })),
            ));
        }
    };

    // Register room in the in-memory ChatState with its conversation_id
    {
        let mut state_guard = state.write().await;
        state_guard.create_room_with_conversation(
            name.clone(),
            description.clone(),
            image_filename.clone(),
            conversation_id,
        );
    }

    let image_url = image_filename
        .as_deref()
        .map(|f| format!("/media/rooms/{}", f));

    Ok(ApiResponse::success_with_data(
        "Room created",
        Some(serde_json::json!({
            "name": name,
            "image": image_url,
        })),
    ))
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
    Extension(pool): Extension<PgPool>,
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
    let limit = pagination.limit.unwrap_or(50);
    let offset = pagination.offset.unwrap_or(0);

    match find_conversation_id(from_user, to_user, &pool).await {
        Ok(conversation_id) => match get_messages(conversation_id, limit, offset, &pool).await {
            Ok(messages) => Ok(Json(messages)),
            Err(e) => {
                eprintln!("ERROR al obtener mensajes: {}", e);
                Err(ErrorRequest::InternalError)
            }
        },
        Err(e) => {
            eprintln!("ERROR al obtener la conversación: {}", e);
            Err(ErrorRequest::InternalError)
        }
    }
}

pub async fn get_conversation_messages_by_id(
    Path(conversation_id): Path<i32>,
    Query(pagination): Query<Pagination>,
    Extension(pool): Extension<PgPool>,
) -> Result<impl IntoResponse, ErrorRequest> {
    let limit = pagination.limit.unwrap_or(50);
    let offset = pagination.offset.unwrap_or(0);

    match get_messages(conversation_id, limit, offset, &pool).await {
        Ok(messages) => Ok(Json(messages)),
        Err(e) => {
            eprintln!("ERROR al obtener mensajes: {}", e);
            Err(ErrorRequest::InternalError)
        }
    }
}

pub async fn get_conversation_messages_by_username(
    Path(username): Path<String>,
    Extension(payload): Extension<Payload>,
    Query(pagination): Query<Pagination>,
    Extension(pool): Extension<PgPool>,
) -> Result<impl IntoResponse, ErrorRequest> {
    println!("LIMITES: {:?} {:?} ", pagination.limit, pagination.offset);
    let limit = pagination.limit.unwrap_or(50);
    let offset = pagination.offset.unwrap_or(0);

    let to_user_id = match find_user_by_username(username, &pool).await {
        Ok(id) => id,
        Err(e) => {
            eprintln!("ERROR al obtener el usuario: {}", e);
            return Err(ErrorRequest::InternalError);
        }
    };

    let conversation_id = match find_conversation_id(payload.id, to_user_id, &pool).await {
        Ok(id) => id,
        Err(e) => {
            eprintln!("ERROR al obtener la conversación: {}", e);
            return Err(ErrorRequest::InternalError);
        }
    };

    let messages = match get_messages(conversation_id, limit, offset, &pool).await {
        Ok(msgs) => msgs,
        Err(e) => {
            eprintln!("ERROR al obtener mensajes: {}", e);
            return Err(ErrorRequest::InternalError);
        }
    };

    let conversation_details = match get_conversation_details(conversation_id, &pool).await {
        Ok(details) => details,
        Err(e) => {
            eprintln!("ERROR al obtener los detalles de la conversación: {}", e);
            return Err(ErrorRequest::InternalError);
        }
    };

    let response = FullConversationResponse {
        conversation: conversation_details,
        messages,
    };
    Ok(Json(response))
}

pub async fn create_new_conversation(
    Path(user2_id): Path<i32>,
    Extension(payload): Extension<Payload>, // aquí Payload debe tener user_id (user1)
    Extension(pool): Extension<PgPool>,
    Extension(app_state): Extension<Arc<AppState>>,
) -> Result<impl IntoResponse, ErrorRequest> {
    // 1. Extraer el user1_id del payload (usuario autenticado)
    let user1_id = payload.id;

    // 2. Crear la conversación
    match create_conversation(user1_id, user2_id, &pool).await {
        Ok(conversation_id) => {
            notify_user_with_active_friends(app_state.as_ref(), user1_id).await;
            notify_user_with_active_friends(app_state.as_ref(), user2_id).await;

            Ok((StatusCode::CREATED, conversation_id.to_string()))
        }
        Err(e) => {
            eprintln!("Error creando conversación: {:?}", e);
            Err(ErrorRequest::CreateConversationError)
        }
    }
}
