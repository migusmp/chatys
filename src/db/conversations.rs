use serde::Serialize;
use sqlx::PgPool;

use sqlx::types::time::OffsetDateTime;
use sqlx::types::Json;

use crate::db::offset_date_time_serde;
use crate::models::user::{RawConversationSummary, UserSummary};

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
    pub participants: Vec<UserSummary>,
}

pub async fn get_user_conversations(
    user_id: i32,
    pool: &PgPool,
) -> Result<Vec<ConversationSummary>, sqlx::Error> {
    let raw_conversations = sqlx::query_as!(
        RawConversationSummary,
        r#"
    SELECT
        c.id as conversation_id,
        c.is_group,
        c.updated_at,
        m.content as last_message_content,
        m.sender_id as last_message_sender_id,
        m.created_at as last_message_created_at,
        (
            SELECT json_agg(json_build_object(
                'id', u.id,
                'username', u.username,
                'image', u.image
            ))
            FROM conversation_participants cp2
            JOIN users u ON u.id = cp2.user_id
            WHERE cp2.conversation_id = c.id
              AND cp2.user_id != $1  -- ← esto excluye al usuario actual
        ) as "participants!: Json<Vec<UserSummary>>"
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

    // Mapear de RawConversationSummary a ConversationSummary
    let conversations = raw_conversations
        .into_iter()
        .map(|r| ConversationSummary {
            conversation_id: r.conversation_id,
            is_group: r.is_group,
            updated_at: r.updated_at, // ya es Option<OffsetDateTime>
            last_message_content: r.last_message_content,
            last_message_sender_id: r.last_message_sender_id,
            last_message_created_at: r.last_message_created_at,
            participants: r.participants.0, // extraemos Vec<UserSummary> del wrapper JsonSqlx
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
