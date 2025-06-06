use serde::Serialize;
use sqlx::PgPool;
use time::OffsetDateTime;

use crate::db::offset_date_time_serde;

#[derive(sqlx::FromRow)]
struct ConversationId {
    pub conversation_id: i32,
}


#[derive(sqlx::FromRow, Serialize)]
pub struct Message {
    pub id: i32,
    pub conversation_id: i32,
    pub sender_id: i32,
    pub content: String,
    #[serde(with = "offset_date_time_serde")]
    pub created_at: Option<OffsetDateTime>,
    pub read_by: serde_json::Value,
}

pub async fn get_or_create_direct_conversation(
    from_user_id: i32,
    to_user_id: i32,
    pool: &PgPool,
) -> Result<i32, sqlx::Error> {
    // Buscar si ya existe
    if let Some(row) = sqlx::query!(
        r#"
        SELECT c.id as conversation_id
        FROM conversations c
        WHERE c.is_group = false
        AND (
            SELECT array_agg(user_id ORDER BY user_id)
            FROM conversation_participants cp
            WHERE cp.conversation_id = c.id
        ) = ARRAY[LEAST($1::int, $2::int), GREATEST($1::int, $2::int)]::int[]
        LIMIT 1
        "#,
        from_user_id,
        to_user_id
    )
    .fetch_optional(pool)
    .await? {
        return Ok(row.conversation_id);
    }


    // Crear nueva conversación si no existe
    let conversation = sqlx::query!(
        "INSERT INTO conversations (is_group, created_at, updated_at) VALUES (false, NOW(), NOW()) RETURNING id"
    )
    .fetch_one(pool)
    .await?;

    let conversation_id = conversation.id;

    // Agregar participantes
    sqlx::query!(
        "INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)",
        conversation_id,
        from_user_id,
        to_user_id
    )
    .execute(pool)
    .await?;

    Ok(conversation_id)
}

pub async fn save_message(
    conversation_id: i32,
    sender_id: i32,
    content: &str,
    pool: &PgPool,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        INSERT INTO messages (conversation_id, sender_id, content, created_at)
        VALUES ($1, $2, $3, NOW())
        "#,
        conversation_id,
        sender_id,
        content
    )
    .execute(pool)
    .await?;

    // También puedes actualizar el updated_at de la conversación
    sqlx::query!(
        "UPDATE conversations SET updated_at = NOW() WHERE id = $1",
        conversation_id
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn update_updated_at_from_conversation(conversation_id: i32, pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "UPDATE conversations SET updated_at = NOW() WHERE id = $1",
        conversation_id
    ).execute(pool).await?;
    Ok(())
}

pub async fn find_conversation_id(
    sender_id: i32,
    receiver_id: i32,
    pool: &PgPool,
) -> Result<i32, sqlx::Error> {
    let conversation = sqlx::query_as!(
        ConversationId,
        r#"
        SELECT cp.conversation_id
        FROM conversation_participants cp
        JOIN conversations c ON c.id = cp.conversation_id
        WHERE (cp.user_id = $1 OR cp.user_id = $2) AND c.is_group = false
        GROUP BY cp.conversation_id
        HAVING COUNT(DISTINCT cp.user_id) = 2
        LIMIT 1
        "#,
        sender_id,
        receiver_id
    )
    .fetch_one(pool)
    .await?;

    Ok(conversation.conversation_id)
}

// Función para obtener mensajes paginados de una conversación
pub async fn get_messages(
    conversation_id: i32,
    limit: u32,
    offset: u32,
    pool: &PgPool,
) -> Result<Vec<Message>, sqlx::Error> {
    let messages = sqlx::query_as::<_, Message>(
        r#"
        SELECT id, conversation_id, sender_id, content, created_at, read_by
        FROM messages
        WHERE conversation_id = $1
        ORDER BY created_at ASC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(conversation_id)
    .bind(limit as i64)
    .bind(offset as i64)
    .fetch_all(pool)
    .await?;

    Ok(messages)
}