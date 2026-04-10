use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub conversation_id: i32,
    pub from_user: i32,
    pub to_user: i32,
    pub content: String,
    pub from_username: String,
    pub from_username_image: String,
    pub message_id: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type_msg")]
pub enum DmEvent {
    #[serde(rename = "chat_message")]
    ChatMessage(ChatMessage),
    #[serde(rename = "MESSAGE_EDITED")]
    MessageEdited {
        message_id: i32,
        conversation_id: i32,
        content: String,
        edited_at: String,
    },
    #[serde(rename = "MESSAGE_DELETED")]
    MessageDeleted {
        message_id: i32,
        conversation_id: i32,
    },
    #[serde(rename = "MESSAGE_READ")]
    MessageRead {
        message_ids: Vec<i32>,
        conversation_id: i32,
        reader_id: i32,
    },
}
