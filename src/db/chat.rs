use sqlx::PgPool;

/// Persists a room record to the DB.
/// Uses ON CONFLICT DO NOTHING so the "Global" seed room can be inserted safely
/// without failing if the table already has a row for it.
pub async fn create_room_record(
    name: &str,
    description: Option<&str>,
    image: Option<&str>,
    created_by: i32,
    pool: &PgPool,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO rooms (name, description, image, created_by)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (name) DO NOTHING
        "#,
    )
    .bind(name)
    .bind(description)
    .bind(image)
    .bind(created_by)
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
