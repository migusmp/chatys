use crate::db::messages::insert_room_message;
use crate::db::server_members::get_member;
use crate::models::user::Payload;
use crate::state::app_state::AppState;
use axum::{
    extract::{ws::WebSocket, Path, WebSocketUpgrade},
    http::StatusCode,
    response::IntoResponse,
    Extension,
};
use futures::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::json;
use sqlx::{PgPool, Row};
use std::sync::Arc;
use tokio::sync::mpsc;
use uuid::Uuid;

/// Actions the client sends over the channel WebSocket.
#[derive(Deserialize)]
#[serde(tag = "action", rename_all = "snake_case")]
enum ChannelClientAction {
    /// Send a new message to the channel.
    Message { content: String },
}

/// HTTP upgrade handler for `/ws/server/{server_id}/channel/{channel_id}`.
///
/// Verifies the caller is a member of the server before upgrading.
pub async fn handle_channel_socket_upgrade(
    ws: WebSocketUpgrade,
    Path((server_id, channel_id)): Path<(Uuid, Uuid)>,
    Extension(payload): Extension<Payload>,
    Extension(pool): Extension<PgPool>,
    Extension(app_state): Extension<Arc<AppState>>,
) -> impl IntoResponse {
    // 1. Verify the caller is a member of the server.
    match get_member(server_id, payload.id, &pool).await {
        Ok(Some(_)) => {} // member confirmed — continue
        Ok(None) => {
            return (StatusCode::FORBIDDEN, "not a member").into_response();
        }
        Err(e) => {
            eprintln!("Error verificando membresía en servidor {}: {:?}", server_id, e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "internal error").into_response();
        }
    }

    // 2. Verify the channel belongs to this server and fetch its conversation_id.
    let row = sqlx::query(
        "SELECT conversation_id FROM channels WHERE id = $1 AND server_id = $2",
    )
    .bind(channel_id)
    .bind(server_id)
    .fetch_optional(&pool)
    .await;

    let conversation_id = match row {
        Ok(Some(r)) => r.get::<i32, _>("conversation_id"),
        Ok(None) => {
            return (StatusCode::NOT_FOUND, "channel not found").into_response();
        }
        Err(e) => {
            eprintln!("Error buscando canal {}: {}", channel_id, e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "internal error").into_response();
        }
    };

    // 3. Upgrade to WebSocket.
    ws.on_upgrade(move |socket| {
        handle_channel_socket(
            socket,
            server_id,
            channel_id,
            conversation_id,
            payload,
            pool,
            app_state,
        )
    })
}

/// WebSocket handler for a single channel connection.
///
/// Mirrors the broadcast-based pattern used by `services/chat.rs handle_socket`.
async fn handle_channel_socket(
    socket: WebSocket,
    server_id: Uuid,
    channel_id: Uuid,
    conversation_id: i32,
    payload: Payload,
    pool: PgPool,
    app_state: Arc<AppState>,
) {
    let (mut sender_ws, mut receiver_ws) = socket.split();

    // Unidirectional channel: broadcast → mpsc → WS sender task
    let (tx, mut rx) = mpsc::unbounded_channel::<axum::extract::ws::Message>();

    // Get (or lazily create) the broadcast sender for this channel.
    let broadcast_sender = app_state
        .server_state
        .get_or_create_sender(channel_id);
    let mut broadcast_rx = broadcast_sender.subscribe();

    // Spawn task: forward broadcast messages to this client via mpsc.
    let tx_clone = tx.clone();
    let send_task = tokio::spawn(async move {
        loop {
            match broadcast_rx.recv().await {
                Ok(msg) => {
                    if tx_clone.send(msg).is_err() {
                        break;
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                    eprintln!(
                        "Canal de servidor {}: {} mensajes salteados (lag)",
                        channel_id, n
                    );
                    // Skip lagged messages and keep going.
                    continue;
                }
                Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                    break;
                }
            }
        }
    });

    // Spawn task: drain mpsc → WS.
    let ws_send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if let Err(e) = sender_ws.send(msg).await {
                eprintln!("Error enviando mensaje al cliente WS (canal {}): {}", channel_id, e);
                break;
            }
        }
    });

    // Keep-alive: ping every 30 s.
    let tx_ping = tx.clone();
    let ping_task = tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(30));
        loop {
            interval.tick().await;
            if tx_ping
                .send(axum::extract::ws::Message::Ping(Vec::new().into()))
                .is_err()
            {
                break;
            }
        }
    });

    // Main receive loop: process inbound messages from this client.
    while let Some(Ok(msg)) = receiver_ws.next().await {
        match msg {
            axum::extract::ws::Message::Text(text) => {
                let action: ChannelClientAction = match serde_json::from_str(&text) {
                    Ok(a) => a,
                    Err(e) => {
                        eprintln!(
                            "Acción inválida de {} en canal {}: {} — {}",
                            payload.username, channel_id, text, e
                        );
                        continue;
                    }
                };

                match action {
                    ChannelClientAction::Message { content } => {
                        let trimmed = content.trim().to_string();
                        if trimmed.is_empty() {
                            continue;
                        }
                        if trimmed.len() > 4000 {
                            eprintln!(
                                "Mensaje demasiado largo de {} en canal {} ({} chars)",
                                payload.username,
                                channel_id,
                                trimmed.len()
                            );
                            continue;
                        }

                        // Persist to DB.
                        let message_id =
                            match insert_room_message(&pool, conversation_id, payload.id, &trimmed)
                                .await
                            {
                                Ok(id) => id,
                                Err(e) => {
                                    eprintln!(
                                        "Error persistiendo mensaje en canal {}: {}",
                                        channel_id, e
                                    );
                                    continue;
                                }
                            };

                        // Build and broadcast the outbound payload.
                        let broadcast_payload = json!({
                            "type_msg": "chat_message",
                            "id": message_id,
                            "channel_id": channel_id,
                            "server_id": server_id,
                            "conversation_id": conversation_id,
                            "sender_id": payload.id,
                            "username": payload.username,
                            "image": payload.image,
                            "content": trimmed,
                            "created_at": chrono::Utc::now().to_rfc3339(),
                        });

                        let json_msg = axum::extract::ws::Message::Text(
                            broadcast_payload.to_string().into(),
                        );

                        let _ = broadcast_sender.send(json_msg);
                    }
                }
            }
            axum::extract::ws::Message::Binary(_) => {
                // Binary frames not supported on channel sockets.
            }
            axum::extract::ws::Message::Ping(_) | axum::extract::ws::Message::Pong(_) => {
                // Handled automatically by axum.
            }
            axum::extract::ws::Message::Close(_) => {
                let _ = tx.send(axum::extract::ws::Message::Close(None));
                break;
            }
        }
    }

    // Cleanup on disconnect.
    send_task.abort();
    ping_task.abort();

    drop(tx);

    if let Err(e) = ws_send_task.await {
        eprintln!("Error en ws_send_task (canal {}): {}", channel_id, e);
    }
}
