use serde::{Deserialize, Serialize};

use crate::models::chat::ReactionCount;

/// Minimal preview of a replied-to message, sent inline with the chat_message event
/// so the receiver can render the quote block without a separate fetch.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplyPreview {
    pub id: i32,
    pub content: String,
    pub sender_username: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub conversation_id: i32,
    pub from_user: i32,
    pub to_user: i32,
    pub content: String,
    pub from_username: String,
    pub from_username_image: String,
    pub message_id: i32,
    /// Present when the message is a reply to another message.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reply_to_id: Option<i32>,
    /// Inline preview of the replied-to message for immediate rendering.
    /// Populated by the WS handler after saving the message.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reply_to: Option<ReplyPreview>,
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
