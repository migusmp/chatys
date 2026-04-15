use serde::{Deserialize, Serialize};

use crate::models::chat::ReactionCount;

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
    #[serde(rename = "NEW_ROOM_MESSAGE")]
    NewRoomMessage {
        room_name: String,
        conversation_id: i32,
        message_id: i32,
        sender_id: i32,
    },
    #[serde(rename = "TYPING_START")]
    TypingStart {
        conversation_id: i32,
        user_id: i32,
        username: String,
    },
    #[serde(rename = "TYPING_STOP")]
    TypingStop {
        conversation_id: i32,
        user_id: i32,
    },
    /// Sent to all active participants of a conversation when a reaction changes.
    #[serde(rename = "REACTION_UPDATE")]
    ReactionUpdate {
        message_id: i64,
        conversation_id: i32,
        reactions: Vec<ReactionCount>,
    },
}
