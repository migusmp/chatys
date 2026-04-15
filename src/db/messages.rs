use serde::Serialize;
use sqlx::PgPool;
use time::OffsetDateTime;

use crate::{
    db::{chat::get_reactions_for_messages, offset_date_time_serde},
    models::{chat::ReactionCount, user::UserSummary},
};

#[derive(sqlx::FromRow)]
struct ConversationId {
    pub conversation_id: i32,
}

/// Minimal preview of a replied-to message embedded inside the replying message.
/// Populated at query time via a JOIN — never stored redundantly in the DB.
#[derive(Debug, Clone, Serialize)]
pub struct MessagePreview {
    pub id: i32,
    pub content: String,
    pub sender_username: String,
}

#[derive(Serialize)]
pub struct FullConversationResponse {
    pub conversation: ConversationDetails,
    pub messages: Vec<Message>,
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
    #[serde(with = "offset_date_time_serde")]
    pub edited_at: Option<OffsetDateTime>,
    pub is_deleted: Option<bool>,
    /// ID of the message this one is replying to, if any.
    pub reply_to_id: Option<i32>,
    /// Full preview of the replied-to message. Not a DB column — populated
    /// by a secondary query after the main fetch (skipped when reply_to_id is NULL).
    #[sqlx(skip)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reply_to: Option<MessagePreview>,
    #[sqlx(skip)]
    #[serde(default)]
    pub reactions: Vec<ReactionCount>,
}

#[derive(Serialize)]
pub struct ConversationDetails {
    pub id: i32,
    #[serde(with = "offset_date_time_serde")]
    pub created_at: Option<OffsetDateTime>,
    #[serde(with = "offset_date_time_serde")]
    pub updated_at: Option<OffsetDateTime>,
    pub is_group: Option<bool>,
    pub participants: Vec<UserSummary>,
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
    .await?
    {
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

pub async fn get_other_participant_in_conversation(
    conversation_id: i32,
    user_id: i32,
    pool: &PgPool,
) -> Result<i32, sqlx::Error> {
    let row = sqlx::query!(
        r#"
        SELECT user_id
        FROM conversation_participants
        WHERE conversation_id = $1 AND user_id != $2
        LIMIT 1
        "#,
        conversation_id,
        user_id
    )
    .fetch_one(pool)
    .await?;

    Ok(row.user_id)
}

/// Persists a DM message and bumps the conversation's updated_at.
/// Returns the new message ID.
pub async fn save_message(
    conversation_id: i32,
    sender_id: i32,
    content: &str,
    reply_to_id: Option<i32>,
    pool: &PgPool,
) -> Result<i32, sqlx::Error> {
    let mut tx = pool.begin().await?;

    let result = sqlx::query_scalar::<_, i32>(
        r#"
        INSERT INTO messages (conversation_id, sender_id, content, reply_to_id, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING id
        "#,
    )
    .bind(conversation_id)
    .bind(sender_id)
    .bind(content)
    .bind(reply_to_id)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query("UPDATE conversations SET updated_at = NOW() WHERE id = $1")
        .bind(conversation_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(result)
}

/// Persists a room message and bumps the conversation's updated_at.
/// Returns the new message ID so it can be included in the broadcast payload.
pub async fn insert_room_message(
    pool: &PgPool,
    conversation_id: i32,
    sender_id: i32,
    content: &str,
) -> Result<i32, sqlx::Error> {
    let mut tx = pool.begin().await?;

    let message_id = sqlx::query_scalar::<_, i32>(
        r#"
        INSERT INTO messages (conversation_id, sender_id, content, created_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING id
        "#,
    )
    .bind(conversation_id)
    .bind(sender_id)
    .bind(content)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query("UPDATE conversations SET updated_at = NOW() WHERE id = $1")
        .bind(conversation_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(message_id)
}

/// Marks a single message as read by a user.
///
/// Uses JSONB containment to skip the update when the user has already read it,
/// preventing duplicate entries. Returns the updated read_by array, or None if
/// the message does not exist or was already marked as read.
pub async fn mark_message_read(
    pool: &PgPool,
    message_id: i32,
    reader_id: i32,
) -> Result<Option<serde_json::Value>, sqlx::Error> {
    let result = sqlx::query_unchecked!(
        r#"
        UPDATE messages
        SET read_by = read_by || to_jsonb($2::int)
        WHERE id = $1
          AND NOT read_by @> to_jsonb($2::int)
        RETURNING read_by
        "#,
        message_id,
        reader_id
    )
    .fetch_optional(pool)
    .await?;

    Ok(result.map(|r| r.read_by).flatten())
}

pub async fn update_updated_at_from_conversation(
    conversation_id: i32,
    pool: &PgPool,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "UPDATE conversations SET updated_at = NOW() WHERE id = $1",
        conversation_id
    )
    .execute(pool)
    .await?;
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

/// Fetches the minimal preview of a single message by ID (id, content, sender username).
/// Returns None if the message does not exist.
pub async fn get_message_preview(
    pool: &PgPool,
    message_id: i32,
) -> Result<Option<MessagePreview>, sqlx::Error> {
    let row = sqlx::query!(
        r#"
        SELECT m.id, m.content, u.username AS sender_username
        FROM messages m
        JOIN users u ON u.id = m.sender_id
        WHERE m.id = $1
        "#,
        message_id
    )
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|r| MessagePreview {
        id: r.id,
        content: r.content,
        sender_username: r.sender_username,
    }))
}

/// Fetches MessagePreviews for a batch of IDs in a single query.
/// Returns a map from message_id → MessagePreview.
async fn fetch_message_previews_batch(
    pool: &PgPool,
    ids: &[i32],
) -> Result<std::collections::HashMap<i32, MessagePreview>, sqlx::Error> {
    if ids.is_empty() {
        return Ok(std::collections::HashMap::new());
    }

    let rows = sqlx::query!(
        r#"
        SELECT m.id, m.content, u.username AS sender_username
        FROM messages m
        JOIN users u ON u.id = m.sender_id
        WHERE m.id = ANY($1)
        "#,
        ids
    )
    .fetch_all(pool)
    .await?;

    let map = rows
        .into_iter()
        .map(|r| {
            (
                r.id,
                MessagePreview {
                    id: r.id,
                    content: r.content,
                    sender_username: r.sender_username,
                },
            )
        })
        .collect();

    Ok(map)
}

// Función para obtener mensajes paginados de una conversación
pub async fn get_messages(
    conversation_id: i32,
    limit: u32,
    offset: u32,
    pool: &PgPool,
) -> Result<Vec<Message>, sqlx::Error> {
    let mut messages = sqlx::query_as::<_, Message>(
        r#"
        SELECT id, conversation_id, sender_id, content, created_at, read_by, edited_at, is_deleted, reply_to_id
        FROM messages
        WHERE conversation_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(conversation_id)
    .bind(limit as i64)
    .bind(offset as i64)
    .fetch_all(pool)
    .await?;

    // Batch-fetch all reply previews for messages that have a reply_to_id.
    let reply_ids: Vec<i32> = messages
        .iter()
        .filter_map(|m| m.reply_to_id)
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();

    if !reply_ids.is_empty() {
        let previews = fetch_message_previews_batch(pool, &reply_ids).await?;
        for msg in &mut messages {
            if let Some(rid) = msg.reply_to_id {
                msg.reply_to = previews.get(&rid).cloned();
            }
        }
    }

    let message_ids: Vec<i64> = messages.iter().map(|m| m.id as i64).collect();
    if !message_ids.is_empty() {
        let reactions_map = get_reactions_for_messages(pool, &message_ids, None).await?;
        for msg in &mut messages {
            if let Some(reactions) = reactions_map.get(&(msg.id as i64)) {
                msg.reactions = reactions.clone();
            }
        }
    }

    Ok(messages)
}

/// Full-text search over non-deleted messages in a conversation.
///
/// Uses `ILIKE` for case-insensitive substring match. Results are ordered
/// newest-first and capped at `limit` rows (max 30 enforced by the caller).
/// Reactions are NOT hydrated — search results are display-only previews.
pub async fn search_messages(
    pool: &PgPool,
    conversation_id: i32,
    query: &str,
    limit: i64,
) -> Result<Vec<Message>, sqlx::Error> {
    // Wrap the query with wildcards for the ILIKE pattern.
    // The binding handles SQL injection — no manual escaping needed.
    let pattern = format!("%{}%", query);

    let messages = sqlx::query_as::<_, Message>(
        r#"
        SELECT id, conversation_id, sender_id, content, created_at, read_by, edited_at, is_deleted, reply_to_id
        FROM messages
        WHERE conversation_id = $1
          AND (is_deleted IS NULL OR is_deleted = false)
          AND content ILIKE $2
        ORDER BY created_at DESC
        LIMIT $3
        "#,
    )
    .bind(conversation_id)
    .bind(&pattern)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(messages)
}

pub async fn update_message(
    pool: &PgPool,
    message_id: i32,
    user_id: i32,
    new_content: &str,
) -> Result<Option<String>, sqlx::Error> {
    let result: Option<_> = sqlx::query_unchecked!(
        "UPDATE messages SET content = $1, edited_at = NOW() WHERE id = $2 AND sender_id = $3 RETURNING edited_at",
        new_content,
        message_id,
        user_id
    )
    .fetch_optional(pool)
    .await?;

    Ok(result.map(|r| {
        r.edited_at
            .map(|t: OffsetDateTime| {
                t.format(&time::format_description::well_known::Rfc3339)
                    .unwrap_or_default()
            })
            .unwrap_or_default()
    }))
}

pub async fn delete_message(
    pool: &PgPool,
    message_id: i32,
    user_id: i32,
) -> Result<bool, sqlx::Error> {
    let result: Option<_> = sqlx::query_unchecked!(
        "UPDATE messages SET is_deleted = true, content = '' WHERE id = $1 AND sender_id = $2 RETURNING id",
        message_id,
        user_id
    )
    .fetch_optional(pool)
    .await?;
    Ok(result.is_some())
}

pub async fn get_message_conversation(
    pool: &PgPool,
    message_id: i32,
) -> Result<Option<i32>, sqlx::Error> {
    let result: Option<_> = sqlx::query_unchecked!(
        "SELECT conversation_id FROM messages WHERE id = $1",
        message_id
    )
    .fetch_optional(pool)
    .await?;
    Ok(result.map(|r| r.conversation_id))
}

pub async fn get_conversation_details(
    conversation_id: i32,
    pool: &PgPool,
) -> Result<ConversationDetails, sqlx::Error> {
    let rows = sqlx::query!(
        r#"
        SELECT
            c.id AS conversation_id,
            c.created_at,
            c.updated_at,
            c.is_group,
            u.id AS user_id,
            u.username,
            u.image
        FROM conversations c
        JOIN conversation_participants cp ON c.id = cp.conversation_id
        JOIN users u ON cp.user_id = u.id
        WHERE c.id = $1
        "#,
        conversation_id
    )
    .fetch_all(pool)
    .await?;

    if rows.is_empty() {
        return Err(sqlx::Error::RowNotFound);
    }

    let first_id = rows[0].conversation_id;
    let created_at = rows[0].created_at;
    let updated_at = rows[0].updated_at;
    let is_group = rows[0].is_group;

    let participants = rows
        .into_iter()
        .map(|r| UserSummary {
            id: r.user_id,
            username: r.username,
            image: r.image,
        })
        .collect();

    Ok(ConversationDetails {
        id: first_id,
        created_at,
        updated_at,
        is_group,
        participants,
    })
}

// Marca como leídos todos los mensajes de una conversación que no hayan sido
// leídos aún por el lector, y devuelve los IDs de los mensajes actualizados.
pub async fn mark_conversation_read(
    pool: &PgPool,
    conversation_id: i32,
    reader_id: i32,
) -> Result<Vec<i32>, sqlx::Error> {
    let rows = sqlx::query_unchecked!(
        r#"
        UPDATE messages
        SET read_by = read_by || to_jsonb($2::int)
        WHERE conversation_id = $1
          AND sender_id != $2
          AND NOT read_by @> to_jsonb($2::int)
        RETURNING id
        "#,
        conversation_id,
        reader_id
    )
    .fetch_all(pool)
    .await?;

    Ok(rows.iter().map(|r| r.id).collect())
}
