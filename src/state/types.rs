use std::{collections::HashMap, sync::Arc};

use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use dashmap::DashMap;
use time::{OffsetDateTime};
use tokio::sync::Mutex;

use crate::state::chat_message::ChatMessage;

use crate::db::offset_date_time_serde;

// TYPES FOR APPSTATE
pub type DirectMessageChannels = DashMap<(i32, i32), tokio::sync::mpsc::Sender<ChatMessage>>;
pub type UndeliveredMessages = Arc<Mutex<HashMap<i32, Vec<String>>>>;

#[derive(Deserialize)]
pub struct IncomingMessage {
    pub content: String,
}

#[derive(Serialize, Deserialize)]
pub struct FriendNotification {
    pub id: Option<i32>,
    pub type_msg: String,
    pub status: String,
    pub user_id: i32,
    pub sender_id: i32,
    pub sender_name: String,
    pub message: String,
    pub image: String,

    #[serde(with = "offset_date_time_serde")]
    pub created_at: Option<OffsetDateTime>,
}

#[derive(Serialize, Deserialize, FromRow, Debug)]
pub struct FriendNotificationRow {
    pub id: i32,
    pub type_msg: String,
    pub status: String,
    pub user_id: i32,
    pub sender_id: i32,
    pub sender_name: Option<String>,
    pub message: String,
    pub image: String,
    pub created_at: chrono::NaiveDateTime
}

pub struct AppConfig {
    pub app_name: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            app_name: "Migus App".to_string(),
        }
    }
}