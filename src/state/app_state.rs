use dashmap::DashMap;
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, mpsc, Mutex};

use crate::{
    db::undelivered_messages::get_undelivered_messages, services::ws::notify_user_with_active_friends, state::{
        chat_message::ChatMessage,
        types::{
            AppConfig, DirectMessageChannels, FriendNotification, FriendNotificationRow,
            UndeliveredMessages,
        },
    }
};

pub struct AppState {
    pub db_pool: PgPool,
    pub direct_message_channels: DirectMessageChannels, // AÑADIDO RECIENTEMENTE
    pub global_broadcast: broadcast::Sender<String>,
    pub connected_users: Arc<Mutex<HashMap<i32, mpsc::Sender<String>>>>,
    pub friend_notifications: Arc<Mutex<HashMap<i32, mpsc::Sender<String>>>>,
    pub undelivered_messages: UndeliveredMessages,
    pub config: AppConfig,
}

impl AppState {
    pub fn new(db_pool: PgPool) -> Self {
        let (global_broadcast, _) = broadcast::channel::<String>(1000);
        Self {
            db_pool,
            global_broadcast,
            connected_users: Arc::new(Mutex::new(HashMap::new())),
            friend_notifications: Arc::new(Mutex::new(HashMap::new())),
            undelivered_messages: Arc::new(Mutex::new(HashMap::new())),
            config: AppConfig::default(),
            direct_message_channels: DashMap::new(),
        }
    }

    pub fn is_user_connected(&self, user_id: i32) -> bool {
        self.direct_message_channels.contains_key(&user_id)
    }

    // <------------------------- FUNCIONES PARA DIRECT_MESSAGE_CHANNELS ---------------------------->

    pub fn register_user_channel(&self, user_id: i32) -> mpsc::Receiver<ChatMessage> {
        let (tx, rx) = mpsc::channel(100);
        self.direct_message_channels.insert(user_id, tx);
        rx
    }

    pub fn unregister_user_channel(&self, user_id: i32) {
        self.direct_message_channels.remove(&user_id);
    }

    pub async fn send_direct_message(&self, message: ChatMessage) {
        // Enviar al receptor (to_user)
        if let Some(sender) = self.direct_message_channels.get(&message.to_user) {
            if sender.send(message.clone()).await.is_err() {
                println!("❌ Error enviando mensaje a {} (canal roto)", message.to_user);
                self.store_undelivered_message(message.to_user, message.content.clone()).await;
            }
        } else {
            println!("📭 Usuario {} no está conectado. Mensaje no entregado", message.to_user);
            self.store_undelivered_message(message.to_user, message.content.clone()).await;
        }

        // Enviar al emisor (from_user)
        if let Some(sender) = self.direct_message_channels.get(&message.from_user) {
            if sender.send(message.clone()).await.is_err() {
                println!("❌ Error enviando mensaje a {}", message.from_user);
                // Este mensaje no es "no entregado" realmente, pero puedes almacenarlo si lo deseas
            }
        }
    }

    // <--------------------------------------------------------------------------------------------->

    // Agrega una conexión del usuario aconnected_users
    pub async fn add_user_connection(&self, user_id: i32, sender: mpsc::Sender<String>) {
        let mut connections = self.connected_users.lock().await;
        connections.insert(user_id, sender);
    }

    pub async fn remove_user_connection(&self, user_id: i32) {
        let mut connections = self.connected_users.lock().await;
        connections.remove(&user_id);
    }

    // Añade un usuario a friend_notifications para enviarle notificaciones (y devuelve el receiver)
    pub async fn add_user_to_friend_notifications(&self, user_id: i32) -> mpsc::Receiver<String> {
        let (sender, receiver) = mpsc::channel::<String>(100);
        let mut notifications = self.friend_notifications.lock().await;
        notifications.insert(user_id, sender);
        // Entregamos notificaciones pendientes cuando se conecta
        self.deliver_undelivered_messages(user_id).await;
        receiver
    }

    // Guarda una notificación no entregada
    async fn store_undelivered_message(&self, user_id: i32, message: String) {
        let mut undelivered = self.undelivered_messages.lock().await;
        undelivered.entry(user_id).or_default().push(message);
    }

    // Entrega todas las notificaciones pendientes de un usuario (si está conectado)
    pub async fn deliver_undelivered_messages(&self, user_id: i32) {
        // 1. Entregar notificaciones de amistad (igual que antes)
        let notifications = sqlx::query_as::<_, FriendNotificationRow>(
            r#"
            SELECT id, type_msg, status, user_id, sender_id, sender_name, message
            FROM friend_requests
            WHERE user_id = $1 AND seen = false AND status = 'pending'
            ORDER BY created_at ASC
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.db_pool)
        .await
        .unwrap_or_default();
    
        let notifications_map = self.friend_notifications.lock().await;
        if let Some(sender) = notifications_map.get(&user_id) {
            for notif in notifications {
                if let Ok(json_msg) = serde_json::to_string(&notif) {
                    let _ = sender.try_send(json_msg);
                }
            }
        }
        drop(notifications_map);
    
        // 2. Entregar mensajes pendientes usando get_undelivered_messages
        let undelivered_messages = match get_undelivered_messages(user_id, &self.db_pool).await {
            Ok(msgs) => msgs,
            Err(e) => {
                eprintln!("Error al obtener mensajes no entregados para {}: {}", user_id, e);
                return;
            }
        };
    
        // Obtener canal para enviar mensajes de chat
        let connected = self.connected_users.lock().await;
        let tx = match connected.get(&user_id) {
            Some(tx) => tx.clone(),
            None => {
                println!("No se encontró canal para usuario {}", user_id);
                return;
            }
        };
        drop(connected);
    
        for msg in undelivered_messages {
            let json_msg = serde_json::json!({
                "type_msg": "chat_message",
                "undelivered_id": msg.undelivered_id,
                "message_id": msg.message_id,
                "conversation_id": msg.conversation_id,
                "sender_id": msg.sender_id,
                "sender_username": msg.sender_username,
                "content": msg.content,
                "created_at": msg.created_at.map(|dt| dt.format(&time::format_description::well_known::Rfc3339).unwrap_or_default()),
            })
            .to_string();
    
            if let Err(e) = tx.send(json_msg).await {
                eprintln!("Error enviando mensaje no entregado a usuario {}: {}", user_id, e);
            }
            // } else {
            //     // Borra mensaje no entregado solo si fue enviado con éxito
            //     if let Err(e) = delete_undelivered_message(msg.undelivered_id, &self.db_pool).await {
            //         eprintln!("Error eliminando mensaje no entregado id {}: {}", msg.undelivered_id, e);
            //     }
            // }
        }
    }
    pub async fn mark_notification_seen(
        &self,
        request_id: i32,
        db_pool: &sqlx::PgPool,
    ) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE friend_requests SET seen = true WHERE id = $1")
            .bind(request_id)
            .execute(db_pool)
            .await?;
        Ok(())
    }

    // Envía una notificación de amistad (o la guarda si el usuario está desconectado)
    pub async fn send_friend_notification(
        &self,
        friend_id: i32,
        user_username: String,
        user_id: i32,
    ) -> Result<(), String> {
        let message_text = format!("{} send to you a friend request!", user_username);
        let mut notification = FriendNotification {
            id: None,
            type_msg: "FR".to_string(),
            user_id,
            user_username: user_username.clone(),
            sender_id: user_id,
            status: "pending".to_string(),
            message: message_text,
        };

        println!(
            "Usuario que ha enviado la solicitud: id: {}, nombre: {}",
            user_id, user_username
        );

        let inserted_id = match self
            .insert_friend_notification_to_db(
                friend_id,
                user_id,
                user_username.as_str(),
                &notification.type_msg,
                &notification.status,
                &notification.message,
            )
            .await
        {
            Ok(id) => id, // id insertado
            Err(e) => return Err(format!("Failed to insert notification to DB: {}", e)),
        };

        notification.id = Some(inserted_id);

        let json_message = serde_json::to_string(&notification)
            .map_err(|_| "Failed to serialize the notification".to_string())?;

        // Guardar en la base de datos
        // TODO

        let mut notifications = self.friend_notifications.lock().await;
        if let Some(sender) = notifications.get(&friend_id) {
            match sender.try_send(json_message.clone()) {
                Ok(_) => Ok(()),
                Err(_e) => {
                    // Canal cerrado, remover sender para no intentar enviar más
                    notifications.remove(&friend_id);
                    drop(notifications); // liberar lock antes de await
                    self.store_undelivered_message(friend_id, json_message)
                        .await;
                    return Err(format!("Unable to send notification to {}", friend_id));
                }
            }
        } else {
            drop(notifications);
            self.store_undelivered_message(friend_id, json_message)
                .await;
            Err(format!("User {} not connected", friend_id))
        }
    }

    // Similar para aceptar la notificación de amistad
    pub async fn accept_friend_notification(
        &self,
        friend_id: i32,    // ID del que envió la solicitud
        user_name: String, // nombre del que acepta
        user_id: i32,      // ID del que acepta
    ) -> Result<(), String> {
        // 1. Marcar la solicitud como aceptada
        if let Err(e) = self
            .mark_friend_request_as_accepted(friend_id, user_id)
            .await
        {
            return Err(format!("DB update failed: {}", e));
        }

        // 2. Crear y serializar la notificación
        let message_text = format!("{} accepted your friend request!", user_name);
        let notification = FriendNotification {
            id: None,
            type_msg: "AFR".to_string(),
            user_id,
            user_username: user_name,
            sender_id: user_id,
            status: "success".to_string(),
            message: message_text,
        };

        let json_message = serde_json::to_string(&notification)
            .map_err(|_| "Failed to serialize the notification".to_string())?;

        // 3. Intentar enviar la notificación
        let notifications = self.friend_notifications.lock().await;
        if let Some(sender) = notifications.get(&friend_id) {
            match sender.try_send(json_message.clone()) {
                Ok(_) => Ok(()),
                Err(_) => {
                    drop(notifications);
                    self.store_undelivered_message(friend_id, json_message)
                        .await;
                    Err(format!("Unable to send notification to {}", friend_id))
                }
            }
        } else {
            drop(notifications);
            self.store_undelivered_message(friend_id, json_message)
                .await;
            Err(format!("User {} not connected", friend_id))
        }
    }

    pub async fn mark_friend_request_as_accepted(
        &self,
        sender_id: i32,
        user_id: i32,
    ) -> Result<(), sqlx::Error> {
        sqlx::query!(
            "UPDATE friend_requests SET status = 'accepted' WHERE user_id = $1 AND sender_id = $2",
            user_id,
            sender_id
        )
        .execute(&self.db_pool)
        .await?;

        Ok(())
    }

    pub async fn get_user_friends(&self, user_id: i32) -> Result<Vec<i32>, sqlx::Error> {
        let friends = sqlx::query!("SELECT friend_id FROM friends WHERE user_id = $1", user_id)
            .fetch_all(&self.db_pool)
            .await?;

        Ok(friends.into_iter().map(|f| f.friend_id).collect())
    }

    // Agrega un usuario al broadcast global
    pub async fn add_user_to_global_broadcast(&self) -> broadcast::Receiver<String> {
        self.global_broadcast.subscribe()
    }

    // Envia un mensaje global a todos
    pub async fn send_global_broadcast(&self, message: String) {
        let _ = self.global_broadcast.send(message);
    }

    pub async fn on_user_disconnected(&self, user_id: i32) {
        {
            let mut connected = self.connected_users.lock().await;
            if connected.remove(&user_id).is_some() {
                println!(
                    "Conexión de usuario {} eliminada de connected_users",
                    user_id
                );
            } else {
                println!("Usuario {} no estaba en connected_users", user_id);
            }
        }

        {
            let mut friend_notes = self.friend_notifications.lock().await;
            if friend_notes.remove(&user_id).is_some() {
                println!("Usuario {} eliminado de friend_notifications", user_id);
            } else {
                println!("Usuario {} no estaba en friend_notifications", user_id);
            }
        }

        // Aquí podrías limpiar otros recursos relacionados con el usuario si existen.
        if let Ok(friends) = self.get_user_friends(user_id).await {
            for friend_id in friends {
                notify_user_with_active_friends(self, friend_id).await;
            }
        }

        println!("Usuario {} desconectado y estado limpiado", user_id);
    }

    pub async fn insert_friend_notification_to_db(
        &self,
        user_id: i32,
        sender_id: i32,
        sender_name: &str,
        type_msg: &str,
        status: &str,
        message: &str,
    ) -> Result<i32, sqlx::Error> {
        let record = sqlx::query!(
            r#"
            INSERT INTO friend_requests (user_id, sender_id, sender_name, type_msg, status, message)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
            "#,
            user_id,
            sender_id,
            sender_name,
            type_msg,
            status,
            message
        )
        .fetch_one(&self.db_pool)
        .await?;
        Ok(record.id)
    }
}
