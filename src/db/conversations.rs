use serde::Serialize;
use serde_json::Value;
use sqlx::PgPool;

use sqlx::types::time::OffsetDateTime;

use crate::db::offset_date_time_serde;
use crate::models::user::{UserSummary};

#[derive(Debug, sqlx::FromRow)]
pub struct ConversationSummarySimpleRaw {
    pub conversation_id: i32,
    pub is_group: Option<bool>,
    pub updated_at: Option<OffsetDateTime>,
    pub participants: Option<Value>, // <-- Aquí JSON crudo
}

#[derive(Debug, Serialize, Clone)]
pub struct ConversationSummarySimple {
    pub conversation_id: i32,
    pub is_group: Option<bool>,
    #[serde(with = "offset_date_time_serde")]
    pub updated_at: Option<OffsetDateTime>,
    pub participants: Vec<UserSummary>,
}

pub async fn get_user_conversations_simple(
    user_id: i32,
    pool: &PgPool,
) -> Result<Vec<ConversationSummarySimple>, sqlx::Error> {
    let raw_conversations = sqlx::query_as!(
        ConversationSummarySimpleRaw,
        r#"
        SELECT
            c.id as conversation_id,
            c.is_group,
            c.updated_at,
            (
                SELECT json_agg(json_build_object(
                    'id', u.id,
                    'username', u.username,
                    'image', u.image
                ))
                FROM conversation_participants cp2
                JOIN users u ON u.id = cp2.user_id
                WHERE cp2.conversation_id = c.id
                  AND cp2.user_id != $1
            ) as participants
        FROM conversations c
        JOIN conversation_participants cp ON cp.conversation_id = c.id
        WHERE cp.user_id = $1
        ORDER BY c.updated_at DESC
        "#,
        user_id
    )
    .fetch_all(pool)
    .await?;

    // Si es None, devolver un vec vacío para no romper en frontend
    let conversations = raw_conversations
        .into_iter()
        .map(|r| {
            let participants: Vec<UserSummary> = r
                .participants
                .map(|json_value| serde_json::from_value(json_value).unwrap_or_default())
                .unwrap_or_default();

            ConversationSummarySimple {
                conversation_id: r.conversation_id,
                is_group: r.is_group,
                updated_at: r.updated_at,
                participants,
            }
        })
        .collect();

    Ok(conversations)
}

// pub async fn get_user_conversations(
//     user_id: i32,
//     pool: &PgPool,
// ) -> Result<Vec<ConversationSummary>, sqlx::Error> {
//     let conversations = sqlx::query_as!(
//         ConversationSummary,
//         r#"
//         SELECT c.id as conversation_id, c.is_group, c.updated_at,
//                m.content as last_message_content,
//                m.sender_id as last_message_sender_id,
//                m.created_at as last_message_created_at
//         FROM conversations c
//         JOIN conversation_participants cp ON cp.conversation_id = c.id
//         LEFT JOIN LATERAL (
//             SELECT content, sender_id, created_at
//             FROM messages
//             WHERE conversation_id = c.id
//             ORDER BY created_at DESC
//             LIMIT 1
//         ) m ON true
//         WHERE cp.user_id = $1
//         ORDER BY c.updated_at DESC
//         "#,
//         user_id
//     )
//     .fetch_all(pool)
//     .await?;

//     Ok(conversations)
// }
