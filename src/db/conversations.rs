use serde::Serialize;
use sqlx::PgPool;

use sqlx::types::time::OffsetDateTime;

use crate::db::offset_date_time_serde;

#[derive(Debug, Serialize, Clone, sqlx::FromRow)]
pub struct ConversationSummary {
    pub conversation_id: i32,
    pub is_group: Option<bool>,

    #[serde(with = "offset_date_time_serde")]
    pub updated_at: Option<OffsetDateTime>,

    pub last_message_content: Option<String>,
    pub last_message_sender_id: Option<i32>,

    #[serde(with = "offset_date_time_serde")]
    pub last_message_created_at: Option<OffsetDateTime>,
}

pub async fn get_user_conversations(
    user_id: i32,
    pool: &PgPool,
) -> Result<Vec<ConversationSummary>, sqlx::Error> {
    let conversations = sqlx::query_as!(
        ConversationSummary,
        r#"
        SELECT c.id as conversation_id, c.is_group, c.updated_at,
               m.content as last_message_content,
               m.sender_id as last_message_sender_id,
               m.created_at as last_message_created_at
        FROM conversations c
        JOIN conversation_participants cp ON cp.conversation_id = c.id
        LEFT JOIN LATERAL (
            SELECT content, sender_id, created_at
            FROM messages
            WHERE conversation_id = c.id
            ORDER BY created_at DESC
            LIMIT 1
        ) m ON true
        WHERE cp.user_id = $1
        ORDER BY c.updated_at DESC
        "#,
        user_id
    )
    .fetch_all(pool)
    .await?;

    Ok(conversations)
}