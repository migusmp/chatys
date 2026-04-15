use crate::db::chat::{
    create_room_record, ensure_room_conversation, get_reactions_for_messages, get_room_messages,
    get_room_unread_counts, toggle_reaction, RoomMessageResponse,
};
use crate::db::conversations::create_conversation;
use crate::db::db::find_user_by_username;
use crate::db::messages::{
    find_conversation_id, get_conversation_details, get_messages, search_messages,
    FullConversationResponse,
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
use axum::extract::ws::Message;
use hyper::StatusCode;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use tokio::sync::RwLock;
use uuid::Uuid;

const MAX_CONTENT_LENGTH: u64 = 5 * 1024 * 1024; // 5 MB
const MAX_ROOM_NAME_LENGTH: usize = 100;
const MAX_DESCRIPTION_LENGTH: usize = 500;

/// Maximum messages per page. Enforced server-side to prevent abuse.
const MAX_HISTORY_LIMIT: i64 = 100;
const DEFAULT_HISTORY_LIMIT: i64 = 50;

/// Maximum emoji length in codepoints (a single emoji can be up to ~8 bytes but
/// we allow up to 10 chars to accommodate ZWJ sequences and skin-tone modifiers).
const MAX_EMOJI_LENGTH: usize = 10;

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
        true, // persist_messages defaults to true for user-created rooms
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
            state_guard.create_room(name.clone(), description.clone(), image_filename.clone(), true);

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
            true,
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
    Extension(app_state): Extension<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, room_id, state, payload, pool, app_state))
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

/// Query parameters for room message history pagination.
#[derive(Deserialize)]
pub struct RoomHistoryParams {
    /// Number of messages to fetch (default: 50, max: 100).
    limit: Option<i64>,
    /// Cursor: fetch only messages with ID strictly less than this value.
    before_id: Option<i32>,
}

/// `GET /api/chat/room/:room_name/messages`
///
/// Returns message history for a room in chronological order (oldest first).
/// If the room has no conversation_id yet (no messages ever persisted), returns an empty list.
///
/// Query params:
/// - `limit`     — how many messages to return (default 50, max 100)
/// - `before_id` — cursor for backwards pagination; returns messages older than this ID
pub async fn get_room_message_history(
    Path(room_name): Path<String>,
    Query(params): Query<RoomHistoryParams>,
    Extension(_payload): Extension<Payload>,
    Extension(state): Extension<Arc<RwLock<ChatState>>>,
    Extension(pool): Extension<PgPool>,
) -> Result<impl IntoResponse, ErrorRequest> {
    // Clamp limit to [1, MAX_HISTORY_LIMIT]
    let limit = params
        .limit
        .unwrap_or(DEFAULT_HISTORY_LIMIT)
        .clamp(1, MAX_HISTORY_LIMIT);

    // Resolve conversation_id from in-memory state first (fast path),
    // then fall back to DB query for rooms that exist but haven't been loaded yet.
    let conversation_id: Option<i32> = {
        let state_guard = state.read().await;
        state_guard.get_room_conversation_id(&room_name)
    };

    let conversation_id = match conversation_id {
        Some(id) => id,
        None => {
            // Room not in memory or has no conversation linked — check DB
            let db_conv_id: Option<i32> = sqlx::query_scalar(
                "SELECT conversation_id FROM rooms WHERE name = $1",
            )
            .bind(&room_name)
            .fetch_optional(&pool)
            .await
            .map_err(|e| {
                eprintln!("Error consultando conversation_id para sala {}: {}", room_name, e);
                ErrorRequest::InternalError
            })?
            .flatten();

            match db_conv_id {
                Some(id) => id,
                // Room exists but has never persisted messages — return empty list
                None => return Ok(Json(Vec::<RoomMessageResponse>::new())),
            }
        }
    };

    let mut messages = get_room_messages(&pool, conversation_id, limit, params.before_id)
        .await
        .map_err(|e| {
            eprintln!("Error obteniendo historial de sala {}: {}", room_name, e);
            ErrorRequest::InternalError
        })?;

    // Query returns DESC; reverse to chronological order before sending to client
    messages.reverse();

    Ok(Json(messages))
}

/// `GET /api/chat/room/unread-counts`
///
/// Returns the unread message count per room for the authenticated user.
/// A message is unread if: sender is not the current user AND the user's ID
/// is not present in the `read_by` JSONB array.
pub async fn get_room_unread_counts_handler(
    Extension(payload): Extension<Payload>,
    Extension(pool): Extension<PgPool>,
) -> Result<impl IntoResponse, ErrorRequest> {
    match get_room_unread_counts(&pool, payload.id).await {
        Ok(counts) => Ok(Json(counts)),
        Err(e) => {
            eprintln!("Error obteniendo conteos de no leídos para usuario {}: {}", payload.id, e);
            Err(ErrorRequest::InternalError)
        }
    }
}

// ─── Reactions ───────────────────────────────────────────────────────────────

/// Request body for the toggle-reaction endpoint.
#[derive(Deserialize)]
pub struct ToggleReactionBody {
    pub emoji: String,
}

/// Response shape for a successful reaction toggle.
#[derive(Serialize)]
pub struct ToggleReactionResponse {
    pub message_id: i64,
    pub added: bool,
    pub reactions: Vec<crate::models::chat::ReactionCount>,
}

/// `POST /api/chat/messages/:message_id/reactions`
///
/// Toggles the authenticated user's reaction (emoji) on a message.
/// - If the reaction doesn't exist, it's added and `added: true` is returned.
/// - If it already exists, it's removed and `added: false` is returned.
///
/// After toggling, the updated reaction state is broadcast to all active participants:
/// - DM conversations: via AppState's direct_message_channels (mpsc).
/// - Group rooms: via ChatState's room broadcaster (broadcast::Sender<Message>).
///
/// Both paths are fire-and-forget — a failed broadcast never invalidates the HTTP response.
pub async fn toggle_reaction_handler(
    Path(message_id): Path<i64>,
    Extension(payload): Extension<Payload>,
    Extension(pool): Extension<PgPool>,
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(chat_state): Extension<Arc<RwLock<ChatState>>>,
    Json(body): Json<ToggleReactionBody>,
) -> Result<impl IntoResponse, ErrorRequest> {
    // Validate emoji
    let emoji = body.emoji.trim().to_string();
    if emoji.is_empty() || emoji.len() > MAX_EMOJI_LENGTH {
        return Err(ErrorRequest::BadParameter);
    }

    // Verify the message exists and fetch its conversation_id + group flag in one query.
    let row: Option<(i32, bool)> = sqlx::query_as(
        "SELECT m.conversation_id, c.is_group \
         FROM messages m \
         JOIN conversations c ON c.id = m.conversation_id \
         WHERE m.id = $1",
    )
    .bind(message_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        eprintln!("toggle_reaction: error fetching message {}: {}", message_id, e);
        ErrorRequest::InternalError
    })?;

    let (conversation_id, is_group) = match row {
        Some(r) => r,
        None => return Err(ErrorRequest::MessageNotFound),
    };

    // Toggle the reaction in the DB
    let added = toggle_reaction(&pool, message_id, payload.id, &emoji)
        .await
        .map_err(|e| {
            eprintln!("toggle_reaction: DB error for message {}: {}", message_id, e);
            ErrorRequest::InternalError
        })?;

    // Fetch updated reactions for the HTTP response (with `reacted_by_me` for this user)
    let reactions_map =
        get_reactions_for_messages(&pool, &[message_id], Some(payload.id))
            .await
            .map_err(|e| {
                eprintln!("toggle_reaction: error re-fetching reactions: {}", e);
                ErrorRequest::InternalError
            })?;

    let reactions = reactions_map
        .get(&message_id)
        .cloned()
        .unwrap_or_default();

    if is_group {
        // Group room: broadcast via the room's broadcast::Sender<Message>.
        // reacted_by_me is omitted (false) in the broadcast payload — the HTTP response
        // already carries the correct value for the user who triggered the toggle.
        // Other clients can rely on the reactions list to re-derive their own flag locally.
        let broadcaster = {
            let state_guard = chat_state.read().await;
            state_guard.get_broadcaster_by_conversation_id(conversation_id)
        };

        if let Some(broadcaster) = broadcaster {
            // Fetch reactions without a user_id so reacted_by_me is uniformly false for broadcast
            let broadcast_reactions_map =
                match get_reactions_for_messages(&pool, &[message_id], None).await {
                    Ok(m) => m,
                    Err(e) => {
                        eprintln!(
                            "toggle_reaction: error fetching broadcast reactions for message {}: {}",
                            message_id, e
                        );
                        // Non-fatal: skip room broadcast rather than fail the HTTP response
                        return Ok(Json(ToggleReactionResponse { message_id, added, reactions }));
                    }
                };

            let broadcast_reactions = broadcast_reactions_map
                .get(&message_id)
                .cloned()
                .unwrap_or_default();

            let payload_json = serde_json::json!({
                "type_msg": "REACTION_UPDATE",
                "message_id": message_id,
                "conversation_id": conversation_id,
                "reactions": broadcast_reactions,
            });

            if let Ok(text) = serde_json::to_string(&payload_json) {
                // Error is expected when there are no active subscribers — safe to ignore.
                let _ = broadcaster.send(Message::Text(text.into()));
            }
        } else {
            eprintln!(
                "toggle_reaction: no active room broadcaster for conversation {} (room may be empty)",
                conversation_id
            );
        }
    } else {
        // DM conversation: notify via AppState's mpsc channels (fire-and-forget).
        let pool_clone = pool.clone();
        let app_state_clone = app_state.clone();
        tokio::spawn(async move {
            app_state_clone
                .notify_reaction_update(&pool_clone, message_id, conversation_id)
                .await;
        });
    }

    Ok(Json(ToggleReactionResponse {
        message_id,
        added,
        reactions,
    }))
}

// ─── Message Image Upload ─────────────────────────────────────────────────────

// ─── Allowed MIME types for message image uploads ────────────────────────────
// SVG is explicitly excluded: it can embed JavaScript and cause XSS.
const ALLOWED_IMAGE_MIME_TYPES: &[(&str, &str)] = &[
    ("image/jpeg", "jpg"),
    ("image/png",  "png"),
    ("image/gif",  "gif"),
    ("image/webp", "webp"),
];

fn allowed_image_ext(mime: &str) -> Option<&'static str> {
    ALLOWED_IMAGE_MIME_TYPES
        .iter()
        .find(|(m, _)| *m == mime)
        .map(|(_, ext)| *ext)
}

/// `POST /api/chat/messages/upload`
///
/// Accepts a multipart form with a single `image` field.
/// Saves the file under `uploads/messages/` and returns its public URL.
/// Allowed formats: JPEG, PNG, GIF, WebP (SVG and other formats are rejected).
/// Max file size: 5 MB. Both the declared MIME type and the actual magic bytes
/// must match an allowed type — the two checks together prevent polyglot files
/// and content-type spoofing.
pub async fn upload_message_image_handler(
    Extension(_payload): Extension<Payload>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, ErrorRequest> {
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

    while let Some(mut field) = multipart.next_field().await.map_err(|e| {
        eprintln!("upload_message_image: multipart error: {:?}", e);
        ErrorRequest::InternalError
    })? {
        if field.name().unwrap_or("") != "image" {
            while field.chunk().await.map_err(|_| ErrorRequest::InternalError)?.is_some() {}
            continue;
        }

        // Check declared MIME type against whitelist (fast pre-filter).
        let declared_mime = field
            .content_type()
            .unwrap_or("application/octet-stream")
            .to_string();

        if allowed_image_ext(&declared_mime).is_none() {
            return Err(ErrorRequest::InvalidImageFormat);
        }

        let first_chunk = field.chunk().await.map_err(|e| {
            eprintln!("upload_message_image: chunk error: {:?}", e);
            ErrorRequest::InternalError
        })?;

        let Some(first_chunk) = first_chunk else {
            return Err(ErrorRequest::InvalidImageFormat);
        };

        // Verify actual content via magic bytes — blocks polyglot/spoofed files.
        let actual_mime = match infer::get(&first_chunk) {
            Some(kind) => kind.mime_type().to_string(),
            None => return Err(ErrorRequest::InvalidImageFormat),
        };

        let ext = match allowed_image_ext(&actual_mime) {
            Some(e) => e,
            None => return Err(ErrorRequest::InvalidImageFormat),
        };

        let filename = format!("{}.{}", Uuid::new_v4(), ext);
        let path = format!("./uploads/messages/{}", filename);

        fs::create_dir_all("./uploads/messages").await.map_err(|e| {
            eprintln!("upload_message_image: mkdir error: {:?}", e);
            ErrorRequest::InternalError
        })?;

        let mut file = fs::File::create(&path).await.map_err(|e| {
            eprintln!("upload_message_image: create file error: {:?}", e);
            ErrorRequest::InternalError
        })?;

        let mut total_size = first_chunk.len() as u64;
        file.write_all(&first_chunk).await.map_err(|_| ErrorRequest::InternalError)?;

        while let Some(chunk) = field.chunk().await.map_err(|_| ErrorRequest::InternalError)? {
            total_size += chunk.len() as u64;
            if total_size > MAX_CONTENT_LENGTH {
                let _ = fs::remove_file(&path).await;
                return Err(ErrorRequest::FileTooLarge);
            }
            file.write_all(&chunk).await.map_err(|_| ErrorRequest::InternalError)?;
        }

        return Ok(ApiResponse::success_with_data(
            "Image uploaded",
            Some(serde_json::json!({ "url": format!("/media/messages/{}", filename) })),
        ));
    }

    Err(ErrorRequest::BadParameter)
}

// ─── Message Search ───────────────────────────────────────────────────────────

/// Maximum number of search results returned per query.
const MAX_SEARCH_RESULTS: i64 = 30;

/// Query parameters for the message search endpoint.
#[derive(Deserialize)]
pub struct SearchParams {
    /// The search term. Must be between 1 and 200 characters after trimming.
    pub q: String,
}

/// `GET /api/chat/conversation/:username/search?q=:query`
///
/// Returns up to 30 non-deleted messages from the DM conversation between the
/// authenticated user and `:username` whose `content` matches the query
/// (case-insensitive substring match). Results are ordered newest-first.
///
/// Errors:
/// - `BadParameter`  — query is empty or exceeds 200 chars after trimming.
/// - `UserNotFound`  — the target username does not exist.
/// - `InternalError` — DB failure (conversation not found counts as this).
pub async fn search_messages_handler(
    Path(username): Path<String>,
    Query(params): Query<SearchParams>,
    Extension(payload): Extension<Payload>,
    Extension(pool): Extension<PgPool>,
) -> Result<impl IntoResponse, ErrorRequest> {
    const MAX_QUERY_LEN: usize = 200;

    let q = params.q.trim().to_string();
    if q.is_empty() || q.len() > MAX_QUERY_LEN {
        return Err(ErrorRequest::BadParameter);
    }

    let to_user_id = match find_user_by_username(username, &pool).await {
        Ok(id) => id,
        Err(_) => return Err(ErrorRequest::UserNotFound),
    };

    let conversation_id = match find_conversation_id(payload.id, to_user_id, &pool).await {
        Ok(id) => id,
        Err(e) => {
            eprintln!("search_messages: error finding conversation: {}", e);
            return Err(ErrorRequest::InternalError);
        }
    };

    let messages = match search_messages(&pool, conversation_id, &q, MAX_SEARCH_RESULTS).await {
        Ok(msgs) => msgs,
        Err(e) => {
            eprintln!("search_messages: DB error for conversation {}: {}", conversation_id, e);
            return Err(ErrorRequest::InternalError);
        }
    };

    Ok(ApiResponse::success_with_data(
        "Messages found",
        Some(messages),
    ))
}
