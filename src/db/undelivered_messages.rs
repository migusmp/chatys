use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use time::OffsetDateTime;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct UndeliveredMessage {
    pub undelivered_id: i32,
    pub message_id: i32,
    pub conversation_id: i32,
    pub sender_id: i32,
    pub sender_username: String,
    pub content: String,
    pub created_at: Option<OffsetDateTime>,
    pub image: Option<String>,
}

pub async fn get_undelivered_messages(
    recipient_id: i32,
    pool: &PgPool,
) -> Result<Vec<UndeliveredMessage>, sqlx::Error> {
    let records = sqlx::query_as!(
        UndeliveredMessage,
        r#"
    SELECT 
        undelivered_messages.id AS undelivered_id,
        messages.id AS message_id,
        messages.conversation_id,
        messages.sender_id,
        users.username AS sender_username,
        messages.content,
        messages.created_at,
        users.image
    FROM undelivered_messages
    JOIN messages ON messages.id = undelivered_messages.message_id
    JOIN users ON users.id = messages.sender_id
    WHERE undelivered_messages.recipient_id = $1
    ORDER BY messages.created_at ASC
    "#,
        recipient_id
    )
    .fetch_all(pool)
    .await?;

    Ok(records)
}

pub async fn set_undelivered_message(
    conversation_id: i32,
    message_id: i32,
    user_id_to_send_notification: i32,
    pool: &PgPool,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
            INSERT INTO undelivered_messages (message_id, recipient_id, conversation_id) VALUES ($1, $2, $3)
        "#,
        message_id,
        user_id_to_send_notification,
        conversation_id
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn clear_undelivered_messages(
    recipient_id: i32,
    conversation_id: i32,
    pool: &PgPool,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "DELETE FROM undelivered_messages WHERE recipient_id = $1 AND conversation_id = $2",
        recipient_id,
        conversation_id
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete_undelivered_message(
    undelivered_message_id: i32,
    pool: &PgPool,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
            DELETE FROM undelivered_messages 
            WHERE id = $1
        "#,
        undelivered_message_id
    )
    .execute(pool)
    .await?;

    Ok(())
}
