use sqlx::PgPool;

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
        JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = $1
        JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = $2
        GROUP BY c.id
        HAVING COUNT(*) = 2
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