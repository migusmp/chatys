use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::AppError;
use crate::models::server::{Channel, ChannelResponse};

impl From<Channel> for ChannelResponse {
    fn from(c: Channel) -> Self {
        ChannelResponse {
            id: c.id,
            server_id: c.server_id,
            conversation_id: c.conversation_id,
            name: c.name,
            is_default: c.is_default,
        }
    }
}

/// Returns all channels for a server, default channel first, then by creation date.
pub async fn list_channels(
    server_id: Uuid,
    pool: &PgPool,
) -> Result<Vec<ChannelResponse>, AppError> {
    let channels = sqlx::query_as::<_, Channel>(
        r#"
        SELECT id, server_id, conversation_id, name, is_default, created_at
        FROM channels
        WHERE server_id = $1
        ORDER BY is_default DESC, created_at ASC
        "#,
    )
    .bind(server_id)
    .fetch_all(pool)
    .await?;

    Ok(channels.into_iter().map(ChannelResponse::from).collect())
}

/// Fetches a single channel by its ID, scoped to the given server.
pub async fn get_channel(
    channel_id: Uuid,
    server_id: Uuid,
    pool: &PgPool,
) -> Result<Option<Channel>, AppError> {
    let channel = sqlx::query_as::<_, Channel>(
        r#"
        SELECT id, server_id, conversation_id, name, is_default, created_at
        FROM channels
        WHERE id = $1 AND server_id = $2
        "#,
    )
    .bind(channel_id)
    .bind(server_id)
    .fetch_optional(pool)
    .await?;

    Ok(channel)
}

/// Creates a new channel inside a server.
///
/// Opens a transaction, inserts a linked `conversations` row of type `room`,
/// then inserts the channel record pointing at that conversation.
pub async fn create_channel(
    server_id: Uuid,
    name: &str,
    pool: &PgPool,
) -> Result<ChannelResponse, AppError> {
    let mut tx = pool.begin().await?;

    let conversation_id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO conversations (type, is_group, server_id, created_at, updated_at)
        VALUES ('room', true, $1, NOW(), NOW())
        RETURNING id
        "#,
    )
    .bind(server_id)
    .fetch_one(&mut *tx)
    .await?;

    let channel = sqlx::query_as::<_, Channel>(
        r#"
        INSERT INTO channels (server_id, conversation_id, name, is_default)
        VALUES ($1, $2, $3, false)
        RETURNING id, server_id, conversation_id, name, is_default, created_at
        "#,
    )
    .bind(server_id)
    .bind(conversation_id)
    .bind(name)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(ChannelResponse::from(channel))
}

/// Renames an existing non-default channel.
///
/// Only channels with `is_default = false` can be renamed — the caller is
/// expected to verify this constraint before calling, but the query enforces
/// it at the DB level as well (0 rows affected → `InternalError`).
pub async fn rename_channel(
    channel_id: Uuid,
    server_id: Uuid,
    name: &str,
    pool: &PgPool,
) -> Result<ChannelResponse, AppError> {
    let channel = sqlx::query_as::<_, Channel>(
        r#"
        UPDATE channels
        SET name = $3
        WHERE id = $1 AND server_id = $2 AND is_default = false
        RETURNING id, server_id, conversation_id, name, is_default, created_at
        "#,
    )
    .bind(channel_id)
    .bind(server_id)
    .bind(name)
    .fetch_optional(pool)
    .await?;

    match channel {
        Some(c) => Ok(ChannelResponse::from(c)),
        None => Err(AppError::InternalError),
    }
}

/// Deletes a non-default channel.
///
/// The `is_default = false` guard prevents accidental deletion of the primary
/// channel. Returns `InternalError` when the channel doesn't exist or is the
/// default one.
pub async fn delete_channel(
    channel_id: Uuid,
    server_id: Uuid,
    pool: &PgPool,
) -> Result<(), AppError> {
    let result = sqlx::query(
        r#"
        DELETE FROM channels
        WHERE id = $1 AND server_id = $2 AND is_default = false
        "#,
    )
    .bind(channel_id)
    .bind(server_id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::InternalError);
    }

    Ok(())
}

/// Soft-deletes a message in a channel.
///
/// Admins/owners can delete any message. Regular members can only delete their own.
/// Returns `true` if a row was updated, `false` if not found or not authorized.
pub async fn delete_channel_message(
    channel_id: Uuid,
    server_id: Uuid,
    message_id: i32,
    caller_id: i32,
    is_admin: bool,
    pool: &PgPool,
) -> Result<bool, AppError> {
    // Verify channel belongs to server
    let channel = sqlx::query_as::<_, Channel>(
        "SELECT id, server_id, conversation_id, name, is_default, created_at FROM channels WHERE id = $1 AND server_id = $2",
    )
    .bind(channel_id)
    .bind(server_id)
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::UserNotFound)?;

    let result = if is_admin {
        sqlx::query(
            "UPDATE messages SET is_deleted = true, content = '' WHERE id = $1 AND conversation_id = $2 AND is_deleted = false",
        )
        .bind(message_id)
        .bind(channel.conversation_id)
        .execute(pool)
        .await?
    } else {
        sqlx::query(
            "UPDATE messages SET is_deleted = true, content = '' WHERE id = $1 AND conversation_id = $2 AND sender_id = $3 AND is_deleted = false",
        )
        .bind(message_id)
        .bind(channel.conversation_id)
        .bind(caller_id)
        .execute(pool)
        .await?
    };

    Ok(result.rows_affected() > 0)
}

/// Returns the total number of channels in a server.
pub async fn count_channels(server_id: Uuid, pool: &PgPool) -> Result<i64, AppError> {
    let count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM channels WHERE server_id = $1")
            .bind(server_id)
            .fetch_one(pool)
            .await?;

    Ok(count)
}
