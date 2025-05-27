use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, mpsc, Mutex};

#[derive(Serialize, Deserialize)]
pub struct FriendNotification {
    pub type_msg: String,
    pub status: String,
    pub user_id: i32,
    pub user_name: String,
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
    pub global_broadcast: broadcast::Sender<String>,
    pub connected_users: Arc<Mutex<HashMap<i32, mpsc::Sender<String>>>>,
    pub friend_notifications: Arc<Mutex<HashMap<i32, mpsc::Sender<String>>>>,
    pub undelivered_messages: Arc<Mutex<HashMap<i32, Vec<String>>>>,
    pub config: AppConfig,
}

impl AppState {
    pub fn new() -> Self {
        let (global_broadcast, _) = broadcast::channel::<String>(1000);
        Self {
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
        let mut undelivered = self.undelivered_messages.lock().await;
        if let Some(messages) = undelivered.remove(&user_id) {
            let notifications = self.friend_notifications.lock().await;
            if let Some(sender) = notifications.get(&user_id) {
                for message in messages {
                    let _ = sender.try_send(message);
                }
            }
        }
    }

    // Envía una notificación de amistad (o la guarda si el usuario está desconectado)
    pub async fn send_friend_notification(
        &self,
        friend_id: i32,
        user_name: String,
        user_id: i32,
    ) -> Result<(), String> {
        let message_text = format!("{} send to you a friend request!", user_name);
        let notification = FriendNotification {
            type_msg: "FR".to_string(),
            user_id,
            user_name,
            status: "pending".to_string(),
            message: message_text,
        };

        let json_message = serde_json::to_string(&notification)
            .map_err(|_| "Failed to serialize the notification".to_string())?;

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
        friend_id: i32,
        user_name: String,
        user_id: i32,
    ) -> Result<(), String> {
        let message_text = format!("{} accept your friend request!", user_name);
        let notification = FriendNotification {
            type_msg: "AFR".to_string(),
            user_id,
            user_name,
            status: "success".to_string(),
            message: message_text,
        };

        let json_message = serde_json::to_string(&notification)
            .map_err(|_| "Failed to serialize the notification".to_string())?;

        let notifications = self.friend_notifications.lock().await;
        if let Some(sender) = notifications.get(&friend_id) {
            match sender.try_send(json_message.clone()) {
                Ok(_) => Ok(()),
                Err(_e) => {
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
}
