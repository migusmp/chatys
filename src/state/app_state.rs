use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, mpsc, Mutex};

#[derive(Serialize, Deserialize)]
pub struct FriendNotification {
    pub id: Option<i32>,
    pub type_msg: String,
    pub status: String,
    pub user_id: i32,
    pub user_username: String,
    pub message: String,
}
#[derive(Serialize, Deserialize, sqlx::FromRow, Debug)]
pub struct FriendNotificationRow {
    pub id: i32,
    pub type_msg: String,
    pub status: String,
    pub user_id: i32,
    pub sender_name: Option<String>,
    pub message: String,
}

pub struct AppConfig {
    pub app_name: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            app_name: String::from("Migus App"),
        }
    }
}

pub struct AppState {
    pub db_pool: PgPool,
    pub global_broadcast: broadcast::Sender<String>,
    pub connected_users: Arc<Mutex<HashMap<i32, mpsc::Sender<String>>>>,
    pub friend_notifications: Arc<Mutex<HashMap<i32, mpsc::Sender<String>>>>,
    pub undelivered_messages: Arc<Mutex<HashMap<i32, Vec<String>>>>,
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
        }
    }

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
        // 1. Consulta notificaciones no vistas
        let notifications = sqlx::query_as::<_, FriendNotificationRow>(
            r#"
            SELECT id, type_msg, status, user_id, sender_name, message
            FROM friend_requests
            WHERE user_id = $1 AND seen = false AND status = 'pending'
            ORDER BY created_at ASC
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.db_pool)
        .await
        .unwrap_or_default();

        // 2. Obtener el sender para el usuario
        let notifications_map = self.friend_notifications.lock().await;
        if let Some(sender) = notifications_map.get(&user_id) {
            for notif in notifications {
                // 3. Convertir a FriendNotification y luego a JSON
                let notification = FriendNotificationRow {
                    id: notif.id,
                    type_msg: notif.type_msg,
                    status: notif.status,
                    user_id: notif.user_id,
                    sender_name: notif.sender_name,
                    message: notif.message,
                };

                if let Ok(json_msg) = serde_json::to_string(&notification) {
                    let _ = sender.try_send(json_msg);
                }
            }
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
            status: "pending".to_string(),
            message: message_text,
        };

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
        

        let notifications = self.friend_notifications.lock().await;
        if let Some(sender) = notifications.get(&friend_id) {
            match sender.try_send(json_message.clone()) {
                Ok(_) => Ok(()),
                Err(_e) => {
                    drop(notifications); // liberar lock antes de await
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
