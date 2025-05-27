use std::sync::Arc;

use axum::{
    extract::{
        ws::{Message, WebSocket},
        WebSocketUpgrade,
    },
    response::IntoResponse,
    Extension,
};
use tokio::sync::mpsc;

use crate::{models::user::Payload, state::app_state::AppState};

pub async fn handle_ws_connection(
    ws: WebSocketUpgrade,
    app_state: Arc<AppState>,
    Extension(payload): Extension<Payload>,
) -> impl IntoResponse {
    let user_id = payload.id;

    let (tx, rx) = mpsc::channel::<String>(100);

    // app_state
    //     .connected_users
    //     .lock()
    //     .await
    //     .insert(user_id, tx.clone());

    {
        let mut connected = app_state.connected_users.lock().await;
        connected.insert(user_id, tx.clone());
    }

    {
        let mut friend_notifications = app_state.friend_notifications.lock().await;
        friend_notifications.insert(user_id, tx.clone());
    }
    app_state.deliver_undelivered_messages(user_id).await;

    ws.on_upgrade(move |socket| handle_socket_connection(socket, app_state, user_id, rx))
}

async fn handle_socket_connection(
    mut socket: WebSocket,
    notification_service: Arc<AppState>,
    user_id: i32,
    mut user_connection_rx: mpsc::Receiver<String>,
) {
    println!("✅ Usuario {} conectado al WebSocket", user_id);
    let mut is_connected = true;

    while is_connected {
        tokio::select! {
            Some(Ok(message)) = socket.recv() => {
                if let Message::Close(_) = message {
                    println!("🔌 Usuario {} desconectado", user_id);
                    is_connected = false;
                }
            }
            Some(notification) = user_connection_rx.recv() => {
                if let Err(err) = socket.send(Message::Text(notification.into())).await {
                    eprintln!("❌ Error enviando mensaje a usuario {}: {:?}", user_id, err);
                    is_connected = false;
                }
            }
            else => {
                println!("⚠️ Conexión con usuario {} cerrada inesperadamente", user_id);
                is_connected = false;
            }
        }
    }

    notification_service.on_user_disconnected(user_id).await;

    println!("🗑️ Conexión con usuario {} eliminada", user_id);
}
