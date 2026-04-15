use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::AppError as ErrorRequest;
use crate::models::server::{Channel, ChannelResponse, Server, ServerSummary};

// ─── create_server ────────────────────────────────────────────────────────────

/// Creates a new server with an initial "general" default channel, all in a single
/// transaction.
///
/// Steps:
/// 1. INSERT into `servers`
/// 2. INSERT a `conversations` row (type = 'room', is_group = true)
/// 3. UPDATE the conversation's `server_id`
/// 4. INSERT into `channels` (name = "general", is_default = true)
/// 5. INSERT the creator as a member with role = 'owner'
///
/// Returns the created (Server, ChannelResponse) tuple on success.
pub async fn create_server(
    name: &str,
    description: Option<&str>,
    is_public: bool,
    created_by: i32,
    pool: &PgPool,
) -> Result<(Server, ChannelResponse), ErrorRequest> {
    let mut tx = pool.begin().await.map_err(|_| ErrorRequest::InternalError)?;

    // 1. Create the server row
    let server = sqlx::query_as::<_, Server>(
        r#"
        INSERT INTO servers (name, description, is_public, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#,
    )
    .bind(name)
    .bind(description)
    .bind(is_public)
    .bind(created_by)
    .fetch_one(&mut *tx)
    .await
    .map_err(|_| ErrorRequest::InternalError)?;

    // 2. Create a conversation for the default channel
    let conversation_id = sqlx::query_scalar::<_, i32>(
        "INSERT INTO conversations (is_group, type, created_at, updated_at) VALUES (true, 'room', NOW(), NOW()) RETURNING id",
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(|_| ErrorRequest::InternalError)?;

    // 3. Link the conversation back to its server
    sqlx::query("UPDATE conversations SET server_id = $1 WHERE id = $2")
        .bind(server.id)
        .bind(conversation_id)
        .execute(&mut *tx)
        .await
        .map_err(|_| ErrorRequest::InternalError)?;

    // 4. Create the default "general" channel
    let channel_id = Uuid::new_v4();
    let channel_row = sqlx::query_as::<_, Channel>(
        r#"
        INSERT INTO channels (id, server_id, conversation_id, name, is_default)
        VALUES ($1, $2, $3, $4, true)
        RETURNING *
        "#,
    )
    .bind(channel_id)
    .bind(server.id)
    .bind(conversation_id)
    .bind("general")
    .fetch_one(&mut *tx)
    .await
    .map_err(|_| ErrorRequest::InternalError)?;

    let channel = ChannelResponse {
        id: channel_row.id,
        server_id: channel_row.server_id,
        conversation_id: channel_row.conversation_id,
        name: channel_row.name,
        is_default: channel_row.is_default,
    };

    // 5. Add the creator as owner
    sqlx::query(
        r#"
        INSERT INTO server_members (server_id, user_id, role)
        VALUES ($1, $2, 'owner')
        "#,
    )
    .bind(server.id)
    .bind(created_by)
    .execute(&mut *tx)
    .await
    .map_err(|_| ErrorRequest::InternalError)?;

    tx.commit().await.map_err(|_| ErrorRequest::InternalError)?;

    Ok((server, channel))
}

// ─── list_servers_for_user ────────────────────────────────────────────────────

/// Returns all public servers plus any servers the user is already a member of.
///
/// Each row includes the total member count and the user's role (as a plain String,
/// None when they are not a member). Uses runtime binding to avoid offline cache
/// issues with the custom ENUM type returned by the LEFT JOIN.
pub async fn list_servers_for_user(
    user_id: i32,
    pool: &PgPool,
) -> Result<Vec<ServerSummary>, ErrorRequest> {
    let rows = sqlx::query(
        r#"
        SELECT
            s.id,
            s.name,
            s.description,
            s.image,
            s.is_public,
            COUNT(DISTINCT sm2.user_id)::bigint AS member_count,
            sm.role::text AS member_role
        FROM servers s
        LEFT JOIN server_members sm ON sm.server_id = s.id AND sm.user_id = $1
        LEFT JOIN server_members sm2 ON sm2.server_id = s.id
        WHERE s.is_public = true OR sm.user_id = $1
        GROUP BY s.id, s.name, s.description, s.image, s.is_public, sm.role
        ORDER BY s.created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .map_err(|_| ErrorRequest::InternalError)?;

    let summaries = rows
        .into_iter()
        .map(|r| {
            use sqlx::Row;
            ServerSummary {
                id: r.get("id"),
                name: r.get("name"),
                description: r.get("description"),
                image: r.get("image"),
                is_public: r.get("is_public"),
                member_count: r.get("member_count"),
                member_role: r.get("member_role"),
            }
        })
        .collect();

    Ok(summaries)
}

// ─── get_server_by_id ─────────────────────────────────────────────────────────

/// Fetches a single server by its UUID. Returns `None` when not found.
pub async fn get_server_by_id(
    server_id: Uuid,
    pool: &PgPool,
) -> Result<Option<Server>, ErrorRequest> {
    let server = sqlx::query_as::<_, Server>("SELECT * FROM servers WHERE id = $1")
        .bind(server_id)
        .fetch_optional(pool)
        .await
        .map_err(|_| ErrorRequest::InternalError)?;

    Ok(server)
}

// ─── update_server ────────────────────────────────────────────────────────────

/// Partial update — only the fields that are `Some` are written; the rest keep
/// their current DB values thanks to COALESCE.
pub async fn update_server(
    server_id: Uuid,
    name: Option<&str>,
    description: Option<&str>,
    is_public: Option<bool>,
    pool: &PgPool,
) -> Result<Server, ErrorRequest> {
    let server = sqlx::query_as::<_, Server>(
        r#"
        UPDATE servers
        SET
            name        = COALESCE($2, name),
            description = COALESCE($3, description),
            is_public   = COALESCE($4, is_public)
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(server_id)
    .bind(name)
    .bind(description)
    .bind(is_public)
    .fetch_one(pool)
    .await
    .map_err(|_| ErrorRequest::InternalError)?;

    Ok(server)
}

// ─── update_server_image ─────────────────────────────────────────────────────

/// Updates only the `image` column of a server.
pub async fn update_server_image(
    server_id: Uuid,
    image: &str,
    pool: &PgPool,
) -> Result<(), ErrorRequest> {
    sqlx::query("UPDATE servers SET image = $2 WHERE id = $1")
        .bind(server_id)
        .bind(image)
        .execute(pool)
        .await
        .map_err(|_| ErrorRequest::InternalError)?;

    Ok(())
}

// ─── delete_server ────────────────────────────────────────────────────────────

/// Hard-deletes a server row. Cascades must be defined at the DB level for
/// related channels, members, etc.
pub async fn delete_server(server_id: Uuid, pool: &PgPool) -> Result<(), ErrorRequest> {
    sqlx::query("DELETE FROM servers WHERE id = $1")
        .bind(server_id)
        .execute(pool)
        .await
        .map_err(|_| ErrorRequest::InternalError)?;

    Ok(())
}

// ─── set_invite_code ─────────────────────────────────────────────────────────

/// Stores (or replaces) the invite code for a server. The caller is responsible
/// for generating the code (e.g. via `utils::invite::generate_invite_code`).
/// Returns the stored code on success.
pub async fn set_invite_code(
    server_id: Uuid,
    code: &str,
    pool: &PgPool,
) -> Result<String, ErrorRequest> {
    let stored = sqlx::query_scalar::<_, String>(
        "UPDATE servers SET invite_code = $2 WHERE id = $1 RETURNING invite_code",
    )
    .bind(server_id)
    .bind(code)
    .fetch_one(pool)
    .await
    .map_err(|_| ErrorRequest::InternalError)?;

    Ok(stored)
}

// ─── get_server_by_invite_code ────────────────────────────────────────────────

/// Looks up a server by its invite code. Returns `None` when the code doesn't
/// match any server.
pub async fn get_server_by_invite_code(
    code: &str,
    pool: &PgPool,
) -> Result<Option<Server>, ErrorRequest> {
    let server =
        sqlx::query_as::<_, Server>("SELECT * FROM servers WHERE invite_code = $1")
            .bind(code)
            .fetch_optional(pool)
            .await
            .map_err(|_| ErrorRequest::InternalError)?;

    Ok(server)
}
