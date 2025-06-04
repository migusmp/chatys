use std::sync::Arc;

use axum::{
    extract::{
        ws::{Message, WebSocket},
        Path, WebSocketUpgrade,
    },
    response::IntoResponse,
    Extension,
};
use futures::{SinkExt, StreamExt};
use sqlx::PgPool;
use tokio::sync::mpsc;

use crate::{
    db::db::get_user_chat_data, models::user::Payload, state::{app_state::AppState, chat_message::ChatMessage, types::IncomingMessage}
};

// MÉTODO PARA REGISTRAR CHATS INDIVIDUALES
pub async fn handle_socket_connection_for_direct_chat(
    ws: WebSocketUpgrade,
    app_state: Arc<AppState>,
    payload: Payload,
    pool: PgPool,
    Path(chat_id): Path<String>,
) -> impl IntoResponse {
    let to_user_id = chat_id.parse::<i32>().unwrap_or(0);

    ws.on_upgrade(move |socket| handle_socket(socket, app_state, payload.id, to_user_id, pool))
}

async fn handle_socket(
    socket: WebSocket,
    app_state: Arc<AppState>,
    from_user_id: i32,
    to_user_id: i32,
    pool: PgPool,
) {
    println!(
        "📡 Nueva conexión WebSocket: {} -> {}",
        from_user_id, to_user_id
    );

    let user_from_data = match get_user_chat_data(from_user_id, &pool).await {
        Ok(data) => data,
        Err(e) => {
            eprintln!("Error obteniendo datos del usuario al conectar: {}", e);
            return;
        }
    };

    let mut rx = app_state.register_user_channel(from_user_id);
    println!(
        "✅ Usuario {} registrado en direct_message_channels",
        from_user_id
    );

    let (mut sender, mut receiver) = socket.split();

    // Tarea de escritura: mensajes que el usuario debe recibir
    let write_task = tokio::spawn(async move {
        println!(
            "✉️ Tarea de envío de mensajes iniciada para {}",
            from_user_id
        );
        while let Some(message) = rx.recv().await {
            let json = serde_json::to_string(&message).unwrap();
            println!("➡️ Enviando mensaje a {}: {}", from_user_id, json);
            if let Err(e) = sender.send(Message::Text(json.into())).await {
                println!("⚠️ Error al enviar mensaje a {}: {}", from_user_id, e);
                break;
            }
        }
        println!("🛑 Tarea de escritura finalizada para {}", from_user_id);
    });

    // Tarea de lectura: mensajes que el usuario envía
    let app_state_clone = app_state.clone();
    let read_task = tokio::spawn(async move {
        println!("🕵️ Tarea de lectura iniciada para {}", from_user_id);
        while let Some(Ok(Message::Text(text))) = receiver.next().await {
            println!("📥 Mensaje recibido de {}: {}", from_user_id, text);
            match serde_json::from_str::<IncomingMessage>(&text) {
                Ok(incoming) => {
                    let msg = ChatMessage {
                        from_user: from_user_id,
                        to_user: to_user_id,
                        content: incoming.content,
                        from_username: user_from_data.username.to_string(),
                        from_username_image: user_from_data.image.to_string()
                        // cualquier otro campo si tienes
                    };
                    println!(
                        "🔒 Construido ChatMessage -> from_user: {}, to_user: {}, content: {}",
                        msg.from_user, msg.to_user, msg.content
                    );
                    app_state_clone.send_direct_message(msg).await;
                }
                Err(e) => {
                    println!("❌ Error al deserializar mensaje JSON: {}", e);
                }
            }
        }
        println!("🛑 Tarea de lectura finalizada para {}", from_user_id);
    });

    let _ = tokio::join!(write_task, read_task);
    println!(
        "❎ Cerrando conexión y eliminando canal de usuario {}",
        from_user_id
    );
    app_state.unregister_user_channel(from_user_id);
}

// HANDLE WS CONNECTION FOR GENERAL USE IN THE APP
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
            eprintln!(
                "❌ Error enviando lista de amigos activos a {}: {:?}",
                user_id, err
            );
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
