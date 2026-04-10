use dashmap::DashMap;
use sqlx::PgPool;
use time::PrimitiveDateTime;
use tokio::sync::{broadcast, mpsc};

use crate::{
    db::undelivered_messages::get_undelivered_messages,
    models::user::UserFriendRequest,
    services::ws::notify_user_with_active_friends,
    state::{
        chat_message::{ChatMessage, DmEvent},
        types::{
            AppConfig, DirectMessageChannels, FriendNotification, FriendNotificationRow,
            UserChannels,
        },
    },
};

pub struct AppState {
    pub db_pool: PgPool,
    pub direct_message_channels: DirectMessageChannels, // AÑADIDO RECIENTEMENTE
    pub global_broadcast: broadcast::Sender<String>,
    pub connected_users: UserChannels,
    pub friend_notifications: UserChannels,
    pub online_user_connections: DashMap<i32, usize>,
    pub config: AppConfig,
}

impl AppState {
    pub fn new(db_pool: PgPool) -> Self {
        let (global_broadcast, _) = broadcast::channel::<String>(1000);
        Self {
            db_pool,
            global_broadcast,
            connected_users: DashMap::new(),
            friend_notifications: DashMap::new(),
            online_user_connections: DashMap::new(),
            config: AppConfig::default(),
            direct_message_channels: DashMap::new(),
        }
    }

    pub fn mark_user_connected(&self, user_id: i32) -> usize {
        let mut count = self
            .online_user_connections
            .entry(user_id)
            .and_modify(|existing| *existing += 1)
            .or_insert(1);

        *count
    }

    pub fn mark_user_disconnected(&self, user_id: i32) -> usize {
        if let Some(mut count) = self.online_user_connections.get_mut(&user_id) {
            if *count > 1 {
                *count -= 1;
                return *count;
            }
        }

        self.online_user_connections.remove(&user_id);
        0
    }

    pub fn is_user_online(&self, user_id: i32) -> bool {
        self.online_user_connections
            .get(&user_id)
            .map(|count| *count > 0)
            .unwrap_or(false)
    }

    // Imprime las claves activas, ahora son pares (conversation_id, user_id)
    pub fn print_active_direct_message_channels(&self) {
        let keys: Vec<(i32, i32)> = self
            .direct_message_channels
            .iter()
            .map(|entry| *entry.key())
            .collect();
        println!(
            "Active direct message channels (conversation_id, user_id): {:?}",
            keys
        );
    }

    // Verifica si un usuario tiene algún canal activo en alguna conversación
    pub fn is_user_connected(&self, user_id: i32) -> bool {
        self.direct_message_channels
            .iter()
            .any(|entry| entry.key().1 == user_id)
    }

    // Registra un canal para un usuario en una conversación específica
    pub fn register_user_channel(
        &self,
        conversation_id: i32,
        user_id: i32,
    ) -> mpsc::Receiver<DmEvent> {
        let (tx, rx) = mpsc::channel(100);
        self.direct_message_channels
            .insert((conversation_id, user_id), tx);
        // Debug: imprimir los canales activos después de insertar
        self.print_active_direct_message_channels();
        rx
    }

    // Desregistra un canal dado conversation_id y user_id
    pub fn unregister_user_channel(&self, conversation_id: i32, user_id: i32) {
        self.direct_message_channels
            .remove(&(conversation_id, user_id));
    }

    // Envía mensaje a todos los usuarios conectados en la conversación
    pub async fn send_direct_message(&self, event: DmEvent) {
        // Extraer conversation_id, from_user y to_user según el tipo de evento
        let (event_conversation_id, from_user, to_user) = match &event {
            DmEvent::ChatMessage(msg) => (msg.conversation_id, msg.from_user, msg.to_user),
            DmEvent::MessageEdited { conversation_id, .. } => (*conversation_id, -1, -1),
            DmEvent::MessageDeleted { conversation_id, .. } => (*conversation_id, -1, -1),
            // MessageRead se difunde a todos los participantes de la conversación
            DmEvent::MessageRead { conversation_id, .. } => (*conversation_id, -1, -1),
        };

        // Filtra canales que coincidan con la conversación y usuario destinatario
        let mut delivered = false;
        let mut dead_channels: Vec<(i32, i32)> = Vec::new();

        for entry in self.direct_message_channels.iter() {
            let (conv_id, user_id) = *entry.key();
            let sender = entry.value();

            // Para chat_message: enviar solo al destinatario y emisor
            // Para edit/delete/read: enviar a todos en la conversación
            let should_send = conv_id == event_conversation_id
                && match &event {
                    DmEvent::ChatMessage(_) => user_id == to_user || user_id == from_user,
                    _ => true,
                };

            if should_send {
                if sender.send(event.clone()).await.is_err() {
                    println!(
                        "❌ Error enviando evento a user {} en conv {} (canal roto)",
                        user_id, conv_id
                    );
                    dead_channels.push((conv_id, user_id));
                } else {
                    delivered = true;
                }
            }
        }

        for key in dead_channels {
            self.direct_message_channels.remove(&key);
        }

        if !delivered {
            println!(
                "📭 No se entregó evento en conv {}",
                event_conversation_id,
            );
        }
    }

    pub async fn notify_user_new_message(
        &self,
        recipient_id: i32,
        conversation_id: i32,
        from_user_id: i32,
        content_preview: String,
        from_user_username: &String,
        from_user_image: &String,
    ) {
        // Notifica al usuario destinatario del nuevo mensaje
        // Verifica si el usuario está conectado
        let sender = self
            .connected_users
            .get(&recipient_id)
            .map(|entry| entry.clone());
        if let Some(sender) = sender {
            let notification = serde_json::json!({
            "type_msg": "NEW_DM_MESSAGE",
            "conversation_id": conversation_id,
            "from_user": from_user_id,
            "to_user": recipient_id,
            "from_user_username": from_user_username, // Aquí podrías obtener el nombre de usuario real si
            "from_user_image": from_user_image, // y la imagen del usuario
            "content": content_preview,
            "created_at": time::OffsetDateTime::now_utc().format(&time::format_description::well_known::Rfc3339).unwrap_or_default(),
        }).to_string();

            if sender.send(notification).await.is_err() {
                eprintln!("Error enviando notificación a usuario {}", recipient_id);
            }
        }
    }

    // <--------------------------------------------------------------------------------------------->

    // Agrega una conexión del usuario aconnected_users
    pub async fn add_user_connection(&self, user_id: i32, sender: mpsc::Sender<String>) {
        self.connected_users.insert(user_id, sender);
    }

    pub async fn remove_user_connection(&self, user_id: i32) {
        self.connected_users.remove(&user_id);
    }

    // Añade un usuario a friend_notifications para enviarle notificaciones (y devuelve el receiver)
    pub async fn add_user_to_friend_notifications(&self, user_id: i32) -> mpsc::Receiver<String> {
        let (sender, receiver) = mpsc::channel::<String>(100);
        self.friend_notifications.insert(user_id, sender);
        // Entregamos notificaciones pendientes cuando se conecta
        self.deliver_undelivered_messages(user_id).await;
        receiver
    }

    // Entrega todas las notificaciones pendientes de un usuario (si está conectado)
    pub async fn deliver_undelivered_messages(&self, user_id: i32) {
        // 1. Entregar notificaciones de amistad (igual que antes)
        let notifications = sqlx::query_as::<_, FriendNotificationRow>(
            r#"
            SELECT fr.id, fr.type_msg, fr.status, fr.user_id, fr.sender_id, fr.sender_name, fr.message, u.image, fr.created_at
            FROM friend_requests fr
            JOIN users u ON u.id = fr.sender_id
            WHERE fr.user_id = $1 AND fr.seen = false AND fr.status = 'pending'
            ORDER BY fr.created_at ASC
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.db_pool)
        .await
        .unwrap_or_default();

        let sender = self
            .friend_notifications
            .get(&user_id)
            .map(|entry| entry.clone());
        if let Some(sender) = sender {
            for notif in notifications {
                if let Ok(json_msg) = serde_json::to_string(&notif) {
                    let _ = sender.try_send(json_msg);
                }
            }
        }

        // 2. Entregar mensajes pendientes usando get_undelivered_messages
        let undelivered_messages = match get_undelivered_messages(user_id, &self.db_pool).await {
            Ok(msgs) => msgs,
            Err(e) => {
                eprintln!(
                    "Error al obtener mensajes no entregados para {}: {}",
                    user_id, e
                );
                return;
            }
        };

        // Obtener canal para enviar mensajes de chat
        let tx = match self
            .connected_users
            .get(&user_id)
            .map(|entry| entry.clone())
        {
            Some(tx) => tx,
            None => {
                println!("No se encontró canal para usuario {}", user_id);
                return;
            }
        };

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
                "image": msg.image,
            })
            .to_string();

            if let Err(e) = tx.send(json_msg).await {
                eprintln!(
                    "Error enviando mensaje no entregado a usuario {}: {}",
                    user_id, e
                );
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
        user_id: i32,
    ) -> Result<(), String> {
        // Obtener el usuario actualizado desde la BD
        let user = sqlx::query_as!(
            UserFriendRequest,
            r#"
        SELECT id, username, image
        FROM users
        WHERE id = $1
        "#,
            user_id
        )
        .fetch_one(&self.db_pool)
        .await
        .map_err(|e| format!("Failed to fetch user: {}", e))?;

        let message_text = format!("{} sent you a friend request!", user.username);

        let mut notification = FriendNotification {
            id: None,
            type_msg: "FR".to_string(),
            user_id: friend_id,
            sender_name: user.username.clone(),
            sender_id: user.id,
            status: "pending".to_string(),
            message: message_text,
            image: user.image.unwrap_or_default(),
            created_at: None,
        };

        println!(
            "Usuario que ha enviado la solicitud: id: {}, nombre: {}",
            user_id, user.username
        );

        let (inserted_id, created_at) = match self
            .insert_friend_notification_to_db(
                friend_id,
                user_id,
                &user.username,
                &notification.type_msg,
                &notification.status,
                &notification.message,
            )
            .await
        {
            Ok(id) => id,
            Err(e) => return Err(format!("Failed to insert notification to DB: {}", e)),
        };

        notification.id = Some(inserted_id);
        notification.created_at = Some(created_at.assume_utc());

        let json_message = serde_json::to_string(&notification)
            .map_err(|_| "Failed to serialize the notification".to_string())?;

        let sender = self
            .friend_notifications
            .get(&friend_id)
            .map(|entry| entry.clone());
        if let Some(sender) = sender {
            match sender.try_send(json_message.clone()) {
                Ok(_) => Ok(()),
                Err(_) => {
                    self.friend_notifications.remove(&friend_id);
                    Err(format!("Unable to send notification to {}", friend_id))
                }
            }
        } else {
            Err(format!("User {} not connected", friend_id))
        }
    }

    // Similar para aceptar la notificación de amistad
    pub async fn accept_friend_notification(
        &self,
        friend_id: i32,     // ID del que envió la solicitud
        user_name: String,  // nombre del que acepta
        user_id: i32,       // ID del que acepta
        user_image: String, // Image del que acepta la solicitud
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
            sender_name: user_name,
            sender_id: user_id,
            status: "success".to_string(),
            message: message_text,
            image: user_image,
            created_at: None,
        };

        let json_message = serde_json::to_string(&notification)
            .map_err(|_| "Failed to serialize the notification".to_string())?;

        // 3. Intentar enviar la notificación
        let sender = self
            .friend_notifications
            .get(&friend_id)
            .map(|entry| entry.clone());
        if let Some(sender) = sender {
            match sender.try_send(json_message.clone()) {
                Ok(_) => Ok(()),
                Err(_) => Err(format!("Unable to send notification to {}", friend_id)),
            }
        } else {
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

    pub async fn get_user_friends_and_users_from_dms(
        &self,
        user_id: i32,
    ) -> Result<Vec<i32>, sqlx::Error> {
        // 1️⃣ Obtener amigos
        let mut friends = self.get_user_friends(user_id).await?;

        // 2️⃣ Obtener usuarios con los que ha tenido DMs directos
        let dm_users = sqlx::query!(
            r#"
        SELECT DISTINCT cp2.user_id
        FROM conversation_participants cp1
        JOIN conversation_participants cp2
          ON cp1.conversation_id = cp2.conversation_id
        JOIN conversations c
          ON c.id = cp1.conversation_id
        WHERE cp1.user_id = $1
          AND cp2.user_id != $1
          AND c.is_group = false
        "#,
            user_id
        )
        .fetch_all(&self.db_pool)
        .await?;

        for record in dm_users {
            let dm_user_id = record.user_id;
            if !friends.contains(&dm_user_id) {
                friends.push(dm_user_id);
            }
        }

        Ok(friends)
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
        let remaining_connections = self.mark_user_disconnected(user_id);
        if remaining_connections > 0 {
            println!(
                "Usuario {} sigue online con {} conexión(es) activa(s)",
                user_id, remaining_connections
            );
            return;
        }

        if self.connected_users.remove(&user_id).is_some() {
            println!(
                "Conexión de usuario {} eliminada de connected_users",
                user_id
            );
        } else {
            println!("Usuario {} no estaba en connected_users", user_id);
        }

        if self.friend_notifications.remove(&user_id).is_some() {
            println!("Usuario {} eliminado de friend_notifications", user_id);
        } else {
            println!("Usuario {} no estaba en friend_notifications", user_id);
        }

        // Aquí podrías limpiar otros recursos relacionados con el usuario si existen.
        if let Ok(friends) = self.get_user_friends_and_users_from_dms(user_id).await {
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
    ) -> Result<(i32, PrimitiveDateTime), sqlx::Error> {
        let record = sqlx::query!(
            r#"
        INSERT INTO friend_requests (user_id, sender_id, sender_name, type_msg, status, message)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, created_at
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

        let created_at = record
            .created_at
            .ok_or_else(|| sqlx::Error::ColumnNotFound("created_at".into()))?;

        Ok((record.id, created_at))
    }
}
