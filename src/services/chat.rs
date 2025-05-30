use crate::models::chat::ChatState;
use crate::models::user::Payload;
use axum::{body::Bytes, extract::ws::{Message, WebSocket}};

use futures::{SinkExt, StreamExt};
use serde_json::json;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};

pub async fn handle_socket_for_active_rooms(
    socket: WebSocket,
    state: Arc<RwLock<ChatState>>,
    _user: Payload,
) {
    let (mut sender, mut receiver) = socket.split();
    let mut interval = tokio::time::interval(std::time::Duration::from_millis(500));

    loop {
        tokio::select! {
                    _ = interval.tick() => {
                        let state = state.read().await;
                        let (rooms_active, users_active, rooms_active_length) = state.active_rooms();
        let mut enriched_rooms = Vec::new();

        for room in &rooms_active {
            let user_count = state.get_room_user_count(room);
            enriched_rooms.push(json!({
                "name": room,
                "users": user_count,
            }));
        }

        let data = json!({
            "rooms_active": enriched_rooms,
            "rooms_length": rooms_active_length,
            "users_active": users_active,
        });
                        // Parse JSON to String.
                        if let Ok(msg) = serde_json::to_string(&data) {
                            if sender.send(Message::Text(msg.into())).await.is_err() {
                                eprintln!("Error to send rooms active stats");
                            }
                        }
                    }
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
    user: Payload,
) {
    let (sender_ws, mut receiver_ws) = socket.split();

    // Canal unidireccional para enviar mensajes al cliente
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

    // Spawn para escribir en WebSocket desde el canal
    let send_task = tokio::spawn(async move {
        let mut sender_ws = sender_ws;
        while let Some(msg) = rx.recv().await {
            if let Err(e) = sender_ws.send(msg).await {
                eprintln!("Error enviando mensaje al cliente: {}", e);
                break;
            }
        }
    });

    let user_channel = {
        let mut state = state.write().await;
        state.join_room(&room_id, user.username.clone())
    };

    let join_msg = Message::Text(json!({
        "user": "system",
        "message": format!("{} joined the chat.", user.username)
    }).to_string().into());

    {
        let state = state.read().await;
        if let Some(room) = state.rooms.get(&room_id) {
            for (user_id, sender) in &room.users {
                if let Err(e) = sender.send(join_msg.clone()) {
                    eprintln!("Error enviando mensaje de bienvenida a {}: {}", user_id, e);
                }
            }
        }
    }

    // Suscripción a canal de la sala
    let mut user_channel_rx = user_channel.subscribe();
    let tx_clone = tx.clone();
    tokio::spawn(async move {
        while let Ok(msg) = user_channel_rx.recv().await {
            if tx_clone.send(msg).is_err() {
                break;
            }
        }
    });

    // Keep-alive: enviar Ping cada 30s
    let tx_ping = tx.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(30));
        loop {
            interval.tick().await;
            if tx_ping.send(Message::Ping(Bytes::from(vec![]))).is_err() {
                break;
            }
        }
    });

    // Recibir mensajes del cliente
    while let Some(Ok(msg)) = receiver_ws.next().await {
        match msg {
            Message::Text(text) => {
                let json_msg = Message::Text(json!({
                    "userId": user.id,
                    "user": user.username,
                    "message": text.to_string(),
                    "image": user.image,
                }).to_string().into());

                let state = state.read().await;
                if let Some(room) = state.rooms.get(&room_id) {
                    for (user_id, sender) in &room.users {
                        if let Err(e) = sender.send(json_msg.clone()) {
                            eprintln!("Error enviando mensaje a {}: {}", user_id, e);
                        }
                    }
                }
            }
            Message::Binary(_) => {
                // Similar al anterior, puedes manejarlo igual
            }
            Message::Ping(_) | Message::Pong(_) => {
                // Ignorar, ya que son automáticos
            }
            Message::Close(_) => break,
        }
    }

    // Cleanup
{
    let mut state = state.write().await;
    if let Some(room) = state.rooms.get_mut(&room_id) {
        room.users.remove(&user.username);

        let leave_msg = Message::Text(json!({
            "user": "system",
            "message": format!("{} left the chat.", user.username)
        }).to_string().into());

        for (user_id, sender) in &room.users {
            if let Err(e) = sender.send(leave_msg.clone()) {
                eprintln!("Error enviando mensaje de salida a {}: {}", user_id, e);
            }
        }

        if room.users.is_empty() && room_id != "Global" {
            state.rooms.remove(&room_id);
        }
    }
}

    let _ = send_task.await;
}
