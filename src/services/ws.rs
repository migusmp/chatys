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

    notify_friends_user_connected(&app_state, user_id).await;

    ws.on_upgrade(move |socket| handle_socket_connection(socket, app_state, user_id, rx))
}

async fn handle_socket_connection(
    mut socket: WebSocket,
    app_state: Arc<AppState>,
    user_id: i32,
    mut user_connection_rx: mpsc::Receiver<String>,
) {
    println!("✅ Usuario {} conectado al WebSocket", user_id);
    //let mut is_connected = true;

    if let Ok(friends) = app_state.get_user_friends(user_id).await {
        let connected = app_state.connected_users.lock().await;

        let active_friends: Vec<i32> = friends
            .into_iter()
            .filter(|friend_id| connected.contains_key(friend_id))
            .collect();

        let msg = serde_json::json!({
            "type_msg": "active_friends",
            "friends": active_friends
        })
        .to_string();

        if let Err(err) = socket.send(Message::Text(msg.into())).await {
            eprintln!("❌ Error enviando lista de amigos activos a {}: {:?}", user_id, err);
        }
    }

    loop {
        tokio::select! {
            Some(Ok(message)) = socket.recv() => {
                if let Message::Close(_) = message {
                    println!("🔌 Usuario {} desconectado", user_id);
                    break;
                }
            }
            Some(notification) = user_connection_rx.recv() => {
                if let Err(err) = socket.send(Message::Text(notification.into())).await {
                    eprintln!("❌ Error enviando mensaje a usuario {}: {:?}", user_id, err);
                    break;
                }
            }
            else => {
                println!("⚠️ Conexión con usuario {} cerrada inesperadamente", user_id);
                break;
            }
        }
    }

    app_state.on_user_disconnected(user_id).await;

    println!("🗑️ Conexión con usuario {} eliminada", user_id);
}

async fn notify_friends_user_connected(app_state: &AppState, user_id: i32) {
    if let Ok(friends) = app_state.get_user_friends(user_id).await {
        for friend_id in friends {
            notify_user_with_active_friends(app_state, friend_id).await;
        }
    }
}

pub async fn notify_user_with_active_friends(app_state: &AppState, user_id: i32) {
    let friends = match app_state.get_user_friends(user_id).await {
        Ok(f) => f,
        Err(_) => return,
    };

    let connected = app_state.connected_users.lock().await;
    let tx = match connected.get(&user_id) {
        Some(t) => t.clone(),
        None => return,
    };

    let active_friends: Vec<i32> = friends
        .into_iter()
        .filter(|id| connected.contains_key(id))
        .collect();

    let msg = serde_json::json!({
        "type_msg": "active_friends",
        "friends": active_friends
    })
    .to_string();

    let _ = tx.send(msg).await;
}