use crate::models::user::Payload;
use crate::{db::db::get_user_chat_data, models::chat::ChatState};
use axum::extract::ws::{Message, WebSocket};

use futures::{SinkExt, StreamExt};
use serde_json::json;
use sqlx::PgPool;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};

pub async fn handle_socket_for_active_rooms(
    socket: axum::extract::ws::WebSocket,
    state: Arc<RwLock<ChatState>>,
    _user: Payload,
) {
    let (mut sender, mut receiver) = socket.split();
    let mut interval = tokio::time::interval(std::time::Duration::from_millis(500));

    loop {
        tokio::select! {
                    _ = interval.tick() => {
                        let state = state.read().await;
                        let active_rooms = state.active_rooms();

                        let mut enriched_rooms = Vec::new();

        for room_name in &active_rooms {
            let users_in_room = state.rooms.get(room_name)
                .map(|room| room.user_count.load(Ordering::SeqCst))
                .unwrap_or(0);

            enriched_rooms.push(json!({
                "name": room_name,
                "users": users_in_room,
            }));
        }

        // Suma total de usuarios activos en todas las salas
        let total_active_users: usize = state.rooms.values()
            .map(|room| room.user_count.load(Ordering::SeqCst))
            .sum();

        let data = json!({
            "rooms_active": enriched_rooms,
            "rooms_length": active_rooms.len(),
            "users_active": total_active_users,
        });

                        if let Ok(msg) = serde_json::to_string(&data) {
                            if sender.send(Message::Text(msg.into())).await.is_err() {
                                eprintln!("Error enviando estadísticas de salas activas");
                            }
                        }
                    },

                    msg = receiver.next() => {
                        match msg {
                            Some(Ok(Message::Text(text))) => {
                                println!("Mensaje recibido: {}", text);
                            },
                            Some(Ok(Message::Binary(data))) => {
                                println!("Mensaje binario recibido: {:?}", data);
                            },
                            Some(Ok(Message::Pong(_))) => {
                                println!("Pong recibido");
                            },
                            Some(Ok(Message::Ping(_))) => {
                                println!("Ping recibido");
                            },
                            Some(Ok(Message::Close(reason))) => {
                                if let Some(reason) = reason {
                                    println!("Conexión cerrada: {:?}", reason);
                                } else {
                                    println!("Conexión cerrada sin razón");
                                }
                                break;
                            },
                            Some(Err(e)) => {
                                eprintln!("Error en recepción del mensaje: {}", e);
                                break;
                            },
                            None => {
                                eprintln!("Conexión cerrada por el cliente");
                                break;
                            }
                        }
                    }
                }
    }
}

pub async fn handle_socket_for_room_stats(
    socket: WebSocket,
    room_id: String,
    state: Arc<RwLock<ChatState>>,
    _user: Payload,
) {
    let (mut sender, mut receiver) = socket.split();

    let mut interval = tokio::time::interval(std::time::Duration::from_millis(500));

    loop {
        tokio::select! {
            _ = interval.tick() => {
                // Enviar estadísticas periódicas, por ejemplo:
                let state = state.read().await;
                if let Some(user_count) = state.get_room_user_count(&room_id) {
                    let msg = Message::Text(format!("{}", user_count).into());
                    // Verificar si la conexión está abierta
                    if sender.send(msg).await.is_err() {
                        eprintln!("No se pudo enviar el mensaje, WebSocket cerrado o error en la conexión");
                        break;
                    }
                }
            },
            msg = receiver.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        println!("Mensaje recibido: {}", text);
                    },
                    Some(Ok(Message::Binary(data))) => {
                        println!("Mensaje binario recibido: {:?}", data);
                    },
                    Some(Ok(Message::Pong(_))) => {
                        println!("Pong recibido");
                    },
                    Some(Ok(Message::Ping(_))) => {
                        println!("Ping recibido");
                    }
                    Some(Ok(Message::Close(reason))) => {
                        if let Some(reason) = reason {
                            println!("Conexión cerrada: {:?}", reason);
                        } else {
                            println!("Conexión cerrada sin razón");
                        }
                        break; // Salir si la conexión se cierra
                    },
                    Some(Err(e)) => {
                        eprintln!("Error en la recepción del mensaje: {}", e);
                        break; // Salir si hay error en la recepción
                    },
                    None => {
                        eprintln!("Conexión cerrada por el cliente");
                        break; // La conexión se ha cerrado
                    }
                }
            }
        }
    }

    // Aquí puedes agregar lógica adicional de limpieza si es necesario
    eprintln!("Fin de la conexión WebSocket");
}

pub async fn handle_socket(
    socket: WebSocket,
    room_id: String,
    state: Arc<RwLock<ChatState>>,
    user: Payload, // Aquí asumo que Payload tiene campos .id y .username
    pool: PgPool,
) {
    let (mut sender_ws, mut receiver_ws) = socket.split();

    // Canal unidireccional para enviar mensajes al cliente
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

    // Obtener datos del usuario para chat (como username, imagen, etc)
    let chat_user = match get_user_chat_data(user.id, &pool).await {
        Ok(data) => data,
        Err(e) => {
            eprintln!("Error obteniendo datos del usuario para el chat: {}", e);
            return;
        }
    };

    // Spawn para enviar mensajes al WebSocket del cliente
    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if let Err(e) = sender_ws.send(msg).await {
                eprintln!("Error enviando mensaje al cliente: {}", e);
                break;
            }
        }
    });

    // El usuario se une a la sala y se incrementa el contador
    let mut user_channel_rx = {
        let mut state_guard = state.write().await;
        state_guard.join_room(&room_id)
    };

    // Enviar mensaje de "usuario unido" a la sala
    {
        let state_guard = state.read().await;
        if let Some(room) = state_guard.rooms.get(&room_id) {
            let join_msg = Message::Text(
                json!({
                    "user": "system",
                    "message": format!("{} joined the chat.", user.username)
                })
                .to_string()
                .into(),
            );
            let _ = room.broadcaster.send(join_msg);
        }
    }

    // Suscribirse para recibir mensajes broadcast de la sala y enviarlos al cliente
    let tx_clone = tx.clone();
    tokio::spawn(async move {
        while let Ok(msg) = user_channel_rx.recv().await {
            if tx_clone.send(msg).is_err() {
                break;
            }
        }
    });

    // Keep-alive: enviar ping cada 30 segundos para mantener la conexión viva
    let tx_ping = tx.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(30));
        loop {
            interval.tick().await;
            if tx_ping.send(Message::Ping(Vec::new().into())).is_err() {
                break;
            }
        }
    });

    // Recibir mensajes del cliente
    while let Some(Ok(msg)) = receiver_ws.next().await {
        match msg {
            Message::Text(text) => {
                let json_msg = Message::Text(
                    json!({
                        "userId": user.id,
                        "user": chat_user.username,
                        "message": text.to_string(),
                        "image": chat_user.image,
                    })
                    .to_string()
                    .into(),
                );

                // Broadcast a todos los usuarios de la sala
                let state_guard = state.read().await;
                if let Some(room) = state_guard.rooms.get(&room_id) {
                    let _ = room.broadcaster.send(json_msg);
                }
            }
            Message::Binary(_) => {
                // Puedes implementar el manejo si quieres
            }
            Message::Ping(_) | Message::Pong(_) => {
                // Ignorar, se maneja automáticamente
            }
            Message::Close(_) => {
                // Mandar close al canal de envío
                let _ = tx.send(Message::Close(None));
                break;
            }
        }
    }

    // Usuario se desconecta: decrementamos contador y limpiamos estado
    {
        let mut state_guard = state.write().await;
        state_guard.leave_room(&room_id);

        if let Some(room) = state_guard.rooms.get(&room_id) {
            let leave_msg = Message::Text(
                json!({
                    "user": "system",
                    "message": format!("{} left the chat.", user.username)
                })
                .to_string()
                .into(),
            );
            let _ = room.broadcaster.send(leave_msg);

            // Si no quedan usuarios, eliminar sala (opcional)
            if room.user_count.load(Ordering::SeqCst) == 0 && room_id != "Global" {
                state_guard.rooms.remove(&room_id);
            }
        }
    }

    drop(tx);

    if let Err(e) = send_task.await {
        eprintln!("Error en task de envío: {}", e);
    }
}
