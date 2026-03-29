use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub conversation_id: i32,
    pub from_user: i32,
    pub to_user: i32,
    pub content: String,
    pub from_username: String,
    pub from_username_image: String,
}
