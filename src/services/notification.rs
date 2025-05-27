use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
// use tokio::sync::mpsc::Sender;
use tokio::sync::{broadcast, mpsc, Mutex};

use crate::db::db::init_db_pool;

pub struct NotificationService {
    pub pool: PgPool,
    pub connected_users:
        Arc<Mutex<std::collections::HashMap<i32, tokio::sync::mpsc::Sender<String>>>>,
    pub global_broadcast: broadcast::Sender<String>,
    pub pending_notifications: Arc<Mutex<HashMap<i32, Vec<String>>>>,
}

impl NotificationService {
    pub async fn new() -> Self {
        let pool = init_db_pool().await;
        let (tx, _rx) = broadcast::channel(100);
        Self {
            pool,
            connected_users: Arc::new(Mutex::new(HashMap::new())),
            global_broadcast: tx,
            pending_notifications: Arc::new(Mutex::new(HashMap::new())),
        }
    }
    

    pub async fn on_user_disconnected(&self, user_id: i32) {
        // Cuando el usuario se desconecta, lo elimina de la lista de usuarios conectados
        let mut users = self.connected_users.lock().await;
        users.remove(&user_id);
    }

    pub async fn save_pending_notification(&self, user_id: i32, notification: String) {
        let mut pending_notifications = self.pending_notifications.lock().await;
        pending_notifications
            .entry(user_id)
            .or_insert_with(Vec::new)
            .push(notification);
    }

    pub async fn send_pending_notifications(&self, user_id: i32, tx: &mpsc::Sender<String>) {
        let mut pending_notifications = self.pending_notifications.lock().await;
        if let Some(notifications) = pending_notifications.remove(&user_id) {
            for notification in notifications {
                if let Err(err) = tx.send(notification).await {
                    eprintln!(
                        "❌ Error enviando notificación pendiente a usuario {}: {:?}",
                        user_id, err
                    );
                }
            }
        }
    }
}

pub async fn mark_notification_as_delivered(pool: &PgPool, notification_id: i32) {
    let query = "UPDATE notifications SET delivered = TRUE WHERE id = $1";
    sqlx::query(query)
        .bind(notification_id)
        .execute(pool)
        .await
        .expect("Error al marcar notificación como entregada");
}
