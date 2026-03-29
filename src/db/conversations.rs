use serde::Serialize;
use serde_json::Value;
use sqlx::PgPool;

use sqlx::types::time::OffsetDateTime;

use crate::db::offset_date_time_serde;
use crate::models::user::UserSummary;

#[derive(Debug, sqlx::FromRow)]
pub struct ConversationSummarySimpleRaw {
    pub conversation_id: i32,
    pub is_group: Option<bool>,
    pub updated_at: Option<OffsetDateTime>,
    pub participants: Option<Value>, // <-- Aquí JSON crudo
    pub last_message: Option<String>,
    pub last_message_user_id: Option<i32>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ConversationSummarySimple {
    pub conversation_id: i32,
    pub is_group: Option<bool>,
    #[serde(with = "offset_date_time_serde")]
    pub updated_at: Option<OffsetDateTime>,
    pub participants: Vec<UserSummary>,
    pub last_message: Option<String>,
    pub last_message_user_id: Option<i32>,
}

pub async fn get_user_conversations_simple(
    user_id: i32,
    pool: &PgPool,
) -> Result<Vec<ConversationSummarySimple>, sqlx::Error> {
    let raw_conversations = sqlx::query_as::<_, ConversationSummarySimpleRaw>(
        r#"
        SELECT
            c.id as conversation_id,
            c.is_group,
            c.updated_at,
            p.participants,
            m.content as last_message,
            m.sender_id as last_message_user_id
        FROM conversations c
        JOIN conversation_participants cp ON cp.conversation_id = c.id
        LEFT JOIN LATERAL (
                SELECT json_agg(json_build_object(
                    'id', u.id,
                    'username', u.username,
                    'image', u.image
                )) as participants
                FROM conversation_participants cp2
                JOIN users u ON u.id = cp2.user_id
                WHERE cp2.conversation_id = c.id
                  AND cp2.user_id != $1
        ) p ON true
        LEFT JOIN LATERAL (
            SELECT content, sender_id
            FROM messages
            WHERE conversation_id = c.id
            ORDER BY created_at DESC
            LIMIT 1
        ) m ON true
        WHERE cp.user_id = $1
        ORDER BY c.updated_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

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
                last_message: r.last_message,
                last_message_user_id: r.last_message_user_id,
            }
        })
        .collect();

    Ok(conversations)
}

pub async fn get_last_message_content(
    conversation_id: i32,
    pool: &PgPool,
) -> Result<Option<String>, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"
        SELECT content
        FROM messages
        WHERE conversation_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        "#,
        conversation_id
    )
    .fetch_optional(pool)
    .await?;

    Ok(result)
}

pub async fn create_conversation(
    user1_id: i32,
    user2_id: i32,
    pool: &PgPool,
) -> Result<i32, sqlx::Error> {
    let mut tx = pool.begin().await?;

    if let Some(existing_id) = sqlx::query_scalar::<_, i32>(
        r#"
        SELECT c.id
        FROM conversations c
        JOIN conversation_participants p1 ON c.id = p1.conversation_id
        JOIN conversation_participants p2 ON c.id = p2.conversation_id
        WHERE p1.user_id = $1 AND p2.user_id = $2
        "#,
    )
    .bind(user1_id)
    .bind(user2_id)
    .fetch_optional(&mut *tx)
    .await?
    {
        tx.commit().await?;
        return Ok(existing_id);
    }

    let conversation_id =
        sqlx::query_scalar::<_, i32>("INSERT INTO conversations DEFAULT VALUES RETURNING id")
            .fetch_one(&mut *tx)
            .await?;

    sqlx::query(
        "INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)",
    )
    .bind(conversation_id)
    .bind(user1_id)
    .bind(user2_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(conversation_id)
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
