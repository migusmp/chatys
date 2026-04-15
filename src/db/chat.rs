use serde::Serialize;
use sqlx::PgPool;
use time::OffsetDateTime;

use crate::db::offset_date_time_serde;
use crate::models::chat::ReactionCount;

/// Persists a room record to the DB.
/// Uses ON CONFLICT DO NOTHING so the "Global" seed room can be inserted safely
/// without failing if the table already has a row for it.
pub async fn create_room_record(
    name: &str,
    description: Option<&str>,
    image: Option<&str>,
    created_by: i32,
    persist_messages: bool,
    pool: &PgPool,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO rooms (name, description, image, created_by, persist_messages)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (name) DO NOTHING
        "#,
    )
    .bind(name)
    .bind(description)
    .bind(image)
    .bind(created_by)
    .bind(persist_messages)
    .execute(pool)
    .await?;

    Ok(())
}

/// Ensures that a room has a linked conversation record for message persistence.
///
/// - If the room already has a `conversation_id`, returns it.
/// - Otherwise, creates a new `conversations` row (type = 'room', is_group = true),
///   links it to the room, and returns the new ID.
///
/// Safe to call multiple times — idempotent via the RETURNING guard.
///
/// IMPORTANT: Only call this when `persist_messages == true`. The controller
/// is responsible for guarding against calling this for ephemeral rooms.
pub async fn ensure_room_conversation(
    room_name: &str,
    pool: &PgPool,
) -> Result<i32, sqlx::Error> {
    // Fast path: room already has a conversation_id
    let existing: Option<i32> = sqlx::query_scalar(
        "SELECT conversation_id FROM rooms WHERE name = $1",
    )
    .bind(room_name)
    .fetch_optional(pool)
    .await?
    // Flatten Option<Option<i32>> → Option<i32>
    .flatten();

    if let Some(conversation_id) = existing {
        return Ok(conversation_id);
    }

    // Slow path: create conversation + link it to the room in one transaction
    let mut tx = pool.begin().await?;

    let conversation_id = sqlx::query_scalar::<_, i32>(
        "INSERT INTO conversations (is_group, type, created_at, updated_at) VALUES (true, 'room', NOW(), NOW()) RETURNING id",
    )
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query("UPDATE rooms SET conversation_id = $1 WHERE name = $2")
        .bind(conversation_id)
        .bind(room_name)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(conversation_id)
}

/// A single room message with its sender's username joined in.
#[derive(Serialize)]
pub struct RoomMessageResponse {
    pub id: i32,
    pub sender_id: i32,
    pub username: String,
    pub content: String,
    #[serde(with = "offset_date_time_serde")]
    pub created_at: Option<OffsetDateTime>,
    pub read_by: serde_json::Value,
    #[serde(with = "offset_date_time_serde")]
    pub edited_at: Option<OffsetDateTime>,
    pub is_deleted: Option<bool>,
    pub reactions: Vec<ReactionCount>,
}

/// Fetches up to `limit` messages for a room conversation, ordered by ID DESC (newest first).
/// An optional `before_id` cursor restricts results to messages older than that ID,
/// enabling backwards pagination ("load more").
///
/// The caller is expected to reverse the returned Vec to get chronological order.
///
/// Uses `query_unchecked!` because the `read_by` column is JSONB, which SQLx's
/// compile-time checker cannot resolve without a live database.
pub async fn get_room_messages(
    pool: &PgPool,
    conversation_id: i32,
    limit: i64,
    before_id: Option<i32>,
) -> Result<Vec<RoomMessageResponse>, sqlx::Error> {
    let rows = sqlx::query_unchecked!(
        r#"
        SELECT
            m.id,
            m.sender_id,
            u.username,
            m.content,
            m.created_at,
            m.read_by,
            m.edited_at,
            m.is_deleted
        FROM messages m
        JOIN users u ON u.id = m.sender_id
        WHERE m.conversation_id = $1
          AND ($2::int IS NULL OR m.id < $2)
        ORDER BY m.id DESC
        LIMIT $3
        "#,
        conversation_id,
        before_id,
        limit,
    )
    .fetch_all(pool)
    .await?;

    // Collect message IDs to batch-fetch reactions
    let message_ids: Vec<i64> = rows.iter().map(|r| r.id as i64).collect();

    let reactions_map = if message_ids.is_empty() {
        std::collections::HashMap::new()
    } else {
        get_reactions_for_messages(pool, &message_ids, None).await?
    };

    let messages = rows
        .into_iter()
        .map(|r| {
            let msg_id = r.id as i64;
            RoomMessageResponse {
                id: r.id,
                sender_id: r.sender_id,
                username: r.username,
                content: r.content,
                created_at: r.created_at,
                read_by: r.read_by.unwrap_or_else(|| serde_json::json!([])),
                edited_at: r.edited_at,
                is_deleted: r.is_deleted,
                reactions: reactions_map.get(&msg_id).cloned().unwrap_or_default(),
            }
        })
        .collect();

    Ok(messages)
}

/// Records that a user has joined a room's conversation.
/// Uses ON CONFLICT DO NOTHING so repeated joins (e.g. reconnects) are idempotent.
pub async fn upsert_room_participant(
    pool: &PgPool,
    conversation_id: i32,
    user_id: i32,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO conversation_participants (conversation_id, user_id, joined_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(conversation_id)
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// Unread room message count for a single room.
#[derive(Serialize)]
pub struct RoomUnreadCount {
    pub room_name: String,
    pub count: i64,
}

/// Returns the count of unread messages per room for the given user.
///
/// A message is considered unread when:
/// - The user is a participant of the room's conversation
/// - The message sender is not the user themselves
/// - The user's ID is NOT present in the `read_by` JSONB array
///
/// Uses `query_unchecked!` because `read_by` is JSONB and cannot be resolved
/// at compile time without a live database connection.
pub async fn get_room_unread_counts(
    pool: &PgPool,
    user_id: i32,
) -> Result<Vec<RoomUnreadCount>, sqlx::Error> {
    let rows = sqlx::query_unchecked!(
        r#"
        SELECT
            r.name AS room_name,
            COUNT(m.id) AS count
        FROM rooms r
        JOIN conversations c ON c.id = r.conversation_id
        JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = $1
        JOIN messages m ON m.conversation_id = c.id
            AND m.sender_id != $1
            AND NOT (m.read_by @> to_jsonb($1::int))
        GROUP BY r.name
        HAVING COUNT(m.id) > 0
        "#,
        user_id,
    )
    .fetch_all(pool)
    .await?;

    let counts = rows
        .into_iter()
        .map(|r| RoomUnreadCount {
            room_name: r.room_name,
            count: r.count.unwrap_or(0),
        })
        .collect();

    Ok(counts)
}

// ─── Reactions ───────────────────────────────────────────────────────────────

/// Row returned by the reactions query (one row per user–emoji pair).
struct RawReactionRow {
    message_id: i64,
    user_id: i32,
    username: String,
    emoji: String,
}

/// Toggles a reaction: inserts if absent, deletes if present.
///
/// Returns `true` when the reaction was added, `false` when it was removed.
pub async fn toggle_reaction(
    pool: &PgPool,
    message_id: i64,
    user_id: i32,
    emoji: &str,
) -> Result<bool, sqlx::Error> {
    // Try to delete first. If a row was deleted, the reaction existed → return false (removed).
    let deleted = sqlx::query(
        "DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3",
    )
    .bind(message_id)
    .bind(user_id)
    .bind(emoji)
    .execute(pool)
    .await?
    .rows_affected();

    if deleted > 0 {
        return Ok(false);
    }

    // Row didn't exist — insert it.
    sqlx::query(
        "INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)",
    )
    .bind(message_id)
    .bind(user_id)
    .bind(emoji)
    .execute(pool)
    .await?;

    Ok(true)
}

/// Fetches all reactions for the given set of message IDs and groups them by emoji.
///
/// `current_user_id` is used to populate `reacted_by_me` on each `ReactionCount`.
/// Pass `None` to get aggregated reactions without the per-user flag.
///
/// Uses `query_unchecked!` because the JOIN to users makes compile-time checking
/// require a live DB connection.
pub async fn get_reactions_for_messages(
    pool: &PgPool,
    message_ids: &[i64],
    current_user_id: Option<i32>,
) -> Result<std::collections::HashMap<i64, Vec<ReactionCount>>, sqlx::Error> {
    if message_ids.is_empty() {
        return Ok(std::collections::HashMap::new());
    }

    let rows = sqlx::query_unchecked!(
        r#"
        SELECT
            mr.message_id,
            mr.user_id,
            u.username,
            mr.emoji
        FROM message_reactions mr
        JOIN users u ON u.id = mr.user_id
        WHERE mr.message_id = ANY($1)
        ORDER BY mr.message_id, mr.emoji, mr.created_at
        "#,
        message_ids,
    )
    .fetch_all(pool)
    .await?;

    let raw: Vec<RawReactionRow> = rows
        .into_iter()
        .map(|r| RawReactionRow {
            message_id: r.message_id,
            user_id: r.user_id,
            username: r.username,
            emoji: r.emoji,
        })
        .collect();

    // Group: message_id → emoji → list of (user_id, username)
    let mut grouped: std::collections::HashMap<
        i64,
        std::collections::HashMap<String, Vec<(i32, String)>>,
    > = std::collections::HashMap::new();

    for row in raw {
        grouped
            .entry(row.message_id)
            .or_default()
            .entry(row.emoji)
            .or_default()
            .push((row.user_id, row.username));
    }

    let result = grouped
        .into_iter()
        .map(|(msg_id, emoji_map)| {
            let counts: Vec<ReactionCount> = emoji_map
                .into_iter()
                .map(|(emoji, users)| {
                    let reacted_by_me = current_user_id
                        .map(|uid| users.iter().any(|(id, _)| *id == uid))
                        .unwrap_or(false);
                    ReactionCount {
                        count: users.len() as i64,
                        reacted_by_me,
                        users: users.into_iter().map(|(_, name)| name).collect(),
                        emoji,
                    }
                })
                .collect();
            (msg_id, counts)
        })
        .collect();

    Ok(result)
}
