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
use tokio::{select, sync::mpsc};

use crate::{
    db::{
        db::get_user_chat_data,
        messages::{
            delete_message, get_message_preview, get_or_create_direct_conversation,
            get_other_participant_in_conversation, mark_conversation_read, save_message,
            update_message,
        },
        undelivered_messages::{
            clear_undelivered_messages, delete_undelivered_message, set_undelivered_message,
        },
    },
    models::user::Payload,
    state::{
        app_state::AppState,
        chat_message::{ChatMessage, DmEvent, ReplyPreview},
        types::IncomingMessage,
    },
};

// MÉTODO PARA REGISTRAR CHATS INDIVIDUALES
pub async fn handle_socket_connection_for_direct_chat(
    ws: WebSocketUpgrade,
    app_state: Arc<AppState>,
    payload: Payload,
    pool: PgPool,
    Path(chat_id): Path<String>,
) -> impl IntoResponse {
    let chat_id = chat_id.parse::<i32>().unwrap_or(0);

    ws.on_upgrade(move |socket| handle_socket(socket, app_state, payload.id, chat_id, pool))
}

async fn handle_socket(
    socket: WebSocket,
    app_state: Arc<AppState>,
    from_user_id: i32,
    conversation_id: i32,
    pool: PgPool,
) {
    println!(
        "📡 Nueva conexión WebSocket: usuario {} en conversación {}",
        from_user_id, conversation_id
    );

    let user_from_data = match get_user_chat_data(from_user_id, &pool).await {
        Ok(data) => data,
        Err(e) => {
            eprintln!("Error obteniendo datos del usuario: {}", e);
            return;
        }
    };

    let active_connections = app_state.mark_user_connected(from_user_id);
    if active_connections == 1 {
        notify_friends_user_connected(&app_state, from_user_id).await;
    }

    // Ponemos user_from_data en un Arc para compartirlo eficientemente
    let user_from_data = Arc::new(user_from_data);

    let mut rx: tokio::sync::mpsc::Receiver<DmEvent> =
        app_state.register_user_channel(conversation_id, from_user_id);
    println!(
        "✅ Usuario {} registrado en canal de conversación {}",
        from_user_id, conversation_id
    );

    if let Err(e) = clear_undelivered_messages(from_user_id, conversation_id, &pool).await {
        eprintln!(
            "❌ Error al eliminar mensajes no entregados para usuario {} en conversación {}: {}",
            from_user_id, conversation_id, e
        );
    }

    // Al conectarse, marcar como leídos todos los mensajes del otro participante
    // y notificar al otro si está conectado para que actualice sus checkmarks.
    match mark_conversation_read(&pool, conversation_id, from_user_id).await {
        Ok(read_ids) if !read_ids.is_empty() => {
            let event = DmEvent::MessageRead {
                message_ids: read_ids,
                conversation_id,
                reader_id: from_user_id,
            };
            app_state.send_direct_message(event).await;
        }
        Ok(_) => {}
        Err(e) => {
            eprintln!(
                "❌ Error al marcar mensajes como leídos para usuario {} en conversación {}: {}",
                from_user_id, conversation_id, e
            );
        }
    }

    let (mut sender, mut receiver) = socket.split();

    let mut write_task = {
        let from_user_id = from_user_id; // copia del id simple
        tokio::spawn(async move {
            while let Some(message) = rx.recv().await {
                let json = match serde_json::to_string(&message) {
                    Ok(json) => json,
                    Err(err) => {
                        eprintln!(
                            "⚠️ Error serializando mensaje para usuario {}: {}",
                            from_user_id, err
                        );
                        continue;
                    }
                };
                println!("➡️ Enviando mensaje a usuario {}: {}", from_user_id, json);
                if let Err(e) = sender.send(Message::Text(json.into())).await {
                    println!(
                        "⚠️ Error enviando mensaje a usuario {}: {}",
                        from_user_id, e
                    );
                    break;
                }
            }
            println!(
                "🛑 Tarea de escritura finalizada para usuario {}",
                from_user_id
            );
        })
    };

    let app_state_clone = Arc::clone(&app_state);
    let user_from_data_clone = Arc::clone(&user_from_data);

    let mut read_task = tokio::spawn(async move {
        while let Some(msg_result) = receiver.next().await {
            match msg_result {
                Ok(Message::Text(text)) => {
                    println!("📥 Mensaje recibido de usuario {}: {}", from_user_id, text);

                    // Try to parse as a ClientWsMessage (with "action" field)
                    let parsed: serde_json::Value = match serde_json::from_str(&text) {
                        Ok(v) => v,
                        Err(e) => {
                            eprintln!("Error parseando mensaje JSON: {}", e);
                            continue;
                        }
                    };

                    let action = parsed.get("action").and_then(|v| v.as_str()).unwrap_or("send");

                    match action {
                        "mark_read" => {
                            match mark_conversation_read(&pool, conversation_id, from_user_id).await {
                                Ok(read_ids) if !read_ids.is_empty() => {
                                    let event = DmEvent::MessageRead {
                                        message_ids: read_ids,
                                        conversation_id,
                                        reader_id: from_user_id,
                                    };
                                    app_state_clone.send_direct_message(event).await;
                                }
                                Ok(_) => {}
                                Err(e) => {
                                    eprintln!("mark_read: error en DB: {}", e);
                                }
                            }
                        }
                        "edit" => {
                            let message_id = match parsed.get("message_id").and_then(|v| v.as_i64()) {
                                Some(id) => id as i32,
                                None => {
                                    eprintln!("edit: falta message_id");
                                    continue;
                                }
                            };
                            let new_content = match parsed.get("content").and_then(|v| v.as_str()) {
                                Some(c) => c.to_string(),
                                None => {
                                    eprintln!("edit: falta content");
                                    continue;
                                }
                            };

                            match update_message(&pool, message_id, from_user_id, &new_content).await {
                                Ok(Some(edited_at)) => {
                                    let event = DmEvent::MessageEdited {
                                        message_id,
                                        conversation_id,
                                        content: new_content,
                                        edited_at,
                                    };
                                    app_state_clone.send_direct_message(event).await;
                                }
                                Ok(None) => {
                                    eprintln!("edit: mensaje {} no encontrado o no autorizado", message_id);
                                }
                                Err(e) => {
                                    eprintln!("edit: error en DB: {}", e);
                                }
                            }
                        }
                        "delete" => {
                            let message_id = match parsed.get("message_id").and_then(|v| v.as_i64()) {
                                Some(id) => id as i32,
                                None => {
                                    eprintln!("delete: falta message_id");
                                    continue;
                                }
                            };

                            match delete_message(&pool, message_id, from_user_id).await {
                                Ok(true) => {
                                    let event = DmEvent::MessageDeleted {
                                        message_id,
                                        conversation_id,
                                    };
                                    app_state_clone.send_direct_message(event).await;
                                }
                                Ok(false) => {
                                    eprintln!("delete: mensaje {} no encontrado o no autorizado", message_id);
                                }
                                Err(e) => {
                                    eprintln!("delete: error en DB: {}", e);
                                }
                            }
                        }
                        "typing" => {
                            // Fire-and-forget: broadcast to the other participant, no DB persistence.
                            let event = DmEvent::TypingStart {
                                conversation_id,
                                user_id: from_user_id,
                                username: user_from_data_clone.username.to_string(),
                            };
                            app_state_clone.send_direct_message(event).await;
                        }
                        _ => {
                            // Default: treat as "send" — use IncomingMessage
                            match serde_json::from_str::<IncomingMessage>(&text) {
                                Ok(incoming) => {
                                    let to_user_id = match get_other_participant_in_conversation(
                                        conversation_id,
                                        from_user_id,
                                        &pool,
                                    )
                                    .await
                                    {
                                        Ok(id) => id,
                                        Err(e) => {
                                            eprintln!("Error obteniendo participante destino: {}", e);
                                            return;
                                        }
                                    };

                                    let conv_id = match get_or_create_direct_conversation(
                                        from_user_id,
                                        to_user_id,
                                        &pool,
                                    )
                                    .await
                                    {
                                        Ok(id) => id,
                                        Err(e) => {
                                            eprintln!("Error obteniendo o creando conversación: {}", e);
                                            continue;
                                        }
                                    };

                                    let saved_message_id =
                                        match save_message(conv_id, from_user_id, &incoming.content, incoming.reply_to_id, &pool)
                                            .await
                                        {
                                            Ok(id) => id,
                                            Err(e) => {
                                                eprintln!("Error guardando mensaje: {}", e);
                                                continue;
                                            }
                                        };

                                    // If this is a reply, fetch a preview of the original message
                                    // so the receiver can render the quote block immediately.
                                    let reply_to_preview = if let Some(rid) = incoming.reply_to_id {
                                        match get_message_preview(&pool, rid).await {
                                            Ok(Some(preview)) => Some(ReplyPreview {
                                                id: preview.id,
                                                content: preview.content,
                                                sender_username: preview.sender_username,
                                            }),
                                            Ok(None) => None,
                                            Err(e) => {
                                                eprintln!("Error obteniendo preview del mensaje {}: {}", rid, e);
                                                None
                                            }
                                        }
                                    } else {
                                        None
                                    };

                                    let msg = ChatMessage {
                                        conversation_id: conv_id,
                                        from_user: from_user_id,
                                        to_user: to_user_id,
                                        content: incoming.content.clone(),
                                        from_username: user_from_data_clone.username.to_string(),
                                        from_username_image: user_from_data_clone.image.to_string(),
                                        message_id: saved_message_id,
                                        reply_to_id: incoming.reply_to_id,
                                        reply_to: reply_to_preview,
                                    };

                                    app_state_clone.send_direct_message(DmEvent::ChatMessage(msg)).await;

                                    app_state_clone
                                        .notify_user_new_message(
                                            to_user_id,
                                            conv_id,
                                            from_user_id,
                                            incoming.content,
                                            &user_from_data_clone.username,
                                            &user_from_data_clone.image,
                                        )
                                        .await;

                                    if let Err(e) = set_undelivered_message(
                                        conversation_id,
                                        saved_message_id,
                                        to_user_id,
                                        &pool,
                                    )
                                    .await
                                    {
                                        eprintln!("Error guardando mensaje no entregado: {}", e);
                                    }
                                }
                                Err(e) => {
                                    eprintln!("Error deserializando mensaje JSON: {}", e);
                                }
                            }
                        }
                    }
                }
                Ok(Message::Close(_)) => {
                    println!("🛑 Usuario {} cerró la conexión", from_user_id);
                    break;
                }
                Err(e) => {
                    eprintln!(
                        "Error recibiendo mensaje de usuario {}: {}",
                        from_user_id, e
                    );
                    break;
                }
                _ => {}
            }
        }
        println!(
            "🛑 Tarea de lectura finalizada para usuario {}",
            from_user_id
        );
        // ELIMINAMOS LOS MENSAJES NO ENTREGADOS AL CERRAR LA CONEXIÓN
        let _ = clear_undelivered_messages(from_user_id, conversation_id, &pool)
            .await
            .ok();
    });

    select! {
        _ = &mut write_task => {
            read_task.abort();
        },
        _ = &mut read_task => {
            write_task.abort();
        },
    }

    println!(
        "❎ Cerrando conexión y eliminando canal de usuario {} en conversación {}",
        from_user_id, conversation_id
    );
    app_state.unregister_user_channel(conversation_id, from_user_id);
    app_state.on_user_disconnected(from_user_id).await;
}

// HANDLE WS CONNECTION FOR GENERAL USE IN THE APP
pub async fn handle_ws_connection(
    ws: WebSocketUpgrade,
    app_state: Arc<AppState>,
    Extension(payload): Extension<Payload>,
) -> impl IntoResponse {
    let user_id = payload.id;

    let (tx, rx) = mpsc::channel::<String>(100);

    let active_connections = app_state.mark_user_connected(user_id);

    // app_state
    //     .connected_users
    //     .lock()
    //     .await
    //     .insert(user_id, tx.clone());

    app_state.connected_users.insert(user_id, tx.clone());
    app_state.friend_notifications.insert(user_id, tx.clone());
    app_state.deliver_undelivered_messages(user_id).await;

    if active_connections == 1 {
        notify_friends_user_connected(&app_state, user_id).await;
    }

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

    if let Ok(friends) = app_state.get_user_friends_and_users_from_dms(user_id).await {
        let active_friends: Vec<i32> = friends
            .into_iter()
            .filter(|friend_id| app_state.is_user_online(*friend_id))
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
                // Recibimos mensajes del cliente para eliminar notificaciones u otras operaciones
                if let Message::Text(text) = message {
                    println!("OBTENIENDO MENSAJE DEL CLIENTE");
                    handle_incoming_message(text.to_string(), app_state.clone(), user_id).await;
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

async fn handle_incoming_message(msg: String, app_state: Arc<AppState>, _user_id: i32) {
    let parsed: serde_json::Value = match serde_json::from_str(&msg) {
        Ok(v) => v,
        Err(_) => return,
    };

    if let Some(type_msg) = parsed.get("type_msg").and_then(|v| v.as_str()) {
        match type_msg {
            "message_seen" => {
                if let Some(undelivered_id) = parsed.get("undelivered_id").and_then(|v| v.as_i64())
                {
                    let _ =
                        delete_undelivered_message(undelivered_id as i32, &app_state.db_pool).await;
                    println!(
                        "Mensaje no entregado {} confirmado y eliminado",
                        undelivered_id
                    );
                }
            }
            _ => {
                // Otros tipos de mensajes
            }
        }
    }
}

async fn notify_friends_user_connected(app_state: &AppState, user_id: i32) {
    if let Ok(friends) = app_state.get_user_friends_and_users_from_dms(user_id).await {
        for friend_id in friends {
            notify_user_with_active_friends(app_state, friend_id).await;
        }
    }
}

pub async fn notify_user_with_active_friends(app_state: &AppState, user_id: i32) {
    let friends = match app_state.get_user_friends_and_users_from_dms(user_id).await {
        Ok(f) => f,
        Err(_) => return,
    };

    let connected = &app_state.connected_users;
    let tx = match connected.get(&user_id) {
        Some(t) => t.clone(),
        None => return,
    };

    let active_friends: Vec<i32> = friends
        .into_iter()
        .filter(|id| app_state.is_user_online(*id))
        .collect();

    let msg = serde_json::json!({
        "type_msg": "active_friends",
        "friends": active_friends
    })
    .to_string();

    let _ = tx.send(msg).await;
}
