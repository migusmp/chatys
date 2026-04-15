use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    errors::AppError,
    models::server::{JoinRequestResponse, JoinRequestStatus, MemberResponse, ServerJoinRequest, ServerMember, ServerRole},
};

// ─── Helper row structs ────────────────────────────────────────────────────────

/// Intermediate row for list_members — maps the JOIN result before converting
/// `role_str` to `ServerRole`.
#[derive(sqlx::FromRow)]
struct MemberRow {
    pub user_id: i32,
    pub username: String,
    pub image: Option<String>,
    pub role_str: String,
    pub joined_at: chrono::NaiveDateTime,
}

/// Intermediate row for list_pending_requests — maps the JOIN result.
#[derive(sqlx::FromRow)]
struct JoinRequestRow {
    pub id: Uuid,
    pub user_id: i32,
    pub username: String,
    pub image: Option<String>,
    pub message: Option<String>,
    pub created_at: chrono::NaiveDateTime,
}

fn parse_role(role_str: &str) -> ServerRole {
    match role_str {
        "owner" => ServerRole::Owner,
        "admin" => ServerRole::Admin,
        _ => ServerRole::Member,
    }
}

// ─── Membership functions ──────────────────────────────────────────────────────

pub async fn get_member(
    server_id: Uuid,
    user_id: i32,
    pool: &PgPool,
) -> Result<Option<ServerMember>, AppError> {
    let row = sqlx::query_as::<_, ServerMember>(
        "SELECT server_id, user_id, role, joined_at FROM server_members WHERE server_id=$1 AND user_id=$2",
    )
    .bind(server_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| AppError::InternalError)?;

    Ok(row)
}

pub async fn add_member(
    server_id: Uuid,
    user_id: i32,
    role: &str,
    pool: &PgPool,
) -> Result<ServerMember, AppError> {
    let row = sqlx::query_as::<_, ServerMember>(
        r#"
        INSERT INTO server_members (server_id, user_id, role)
        VALUES ($1, $2, $3::server_role)
        ON CONFLICT DO NOTHING
        RETURNING server_id, user_id, role, joined_at
        "#,
    )
    .bind(server_id)
    .bind(user_id)
    .bind(role)
    .fetch_optional(pool)
    .await
    .map_err(|_| AppError::InternalError)?;

    match row {
        Some(member) => Ok(member),
        None => {
            // Already existed — fetch the current row.
            get_member(server_id, user_id, pool)
                .await?
                .ok_or(AppError::InternalError)
        }
    }
}

pub async fn remove_member(
    server_id: Uuid,
    user_id: i32,
    pool: &PgPool,
) -> Result<(), AppError> {
    sqlx::query(
        "DELETE FROM server_members WHERE server_id=$1 AND user_id=$2",
    )
    .bind(server_id)
    .bind(user_id)
    .execute(pool)
    .await
    .map_err(|_| AppError::InternalError)?;

    Ok(())
}

pub async fn update_member_role(
    server_id: Uuid,
    user_id: i32,
    role: &str,
    pool: &PgPool,
) -> Result<ServerMember, AppError> {
    let row = sqlx::query_as::<_, ServerMember>(
        r#"
        UPDATE server_members
        SET role = $3::server_role
        WHERE server_id = $1 AND user_id = $2
        RETURNING server_id, user_id, role, joined_at
        "#,
    )
    .bind(server_id)
    .bind(user_id)
    .bind(role)
    .fetch_optional(pool)
    .await
    .map_err(|_| AppError::InternalError)?
    .ok_or(AppError::InternalError)?;

    Ok(row)
}

pub async fn list_members(
    server_id: Uuid,
    pool: &PgPool,
) -> Result<Vec<MemberResponse>, AppError> {
    let rows = sqlx::query_as::<_, MemberRow>(
        r#"
        SELECT
            sm.user_id,
            u.username,
            u.image,
            sm.role::text AS role_str,
            sm.joined_at
        FROM server_members sm
        JOIN users u ON u.id = sm.user_id
        WHERE sm.server_id = $1
        ORDER BY
            CASE sm.role
                WHEN 'owner'  THEN 0
                WHEN 'admin'  THEN 1
                ELSE 2
            END,
            u.username
        "#,
    )
    .bind(server_id)
    .fetch_all(pool)
    .await
    .map_err(|_| AppError::InternalError)?;

    let members = rows
        .into_iter()
        .map(|r| MemberResponse {
            user_id: r.user_id,
            username: r.username,
            image: r.image,
            role: parse_role(&r.role_str),
            joined_at: r.joined_at,
        })
        .collect();

    Ok(members)
}

pub async fn count_members(
    server_id: Uuid,
    pool: &PgPool,
) -> Result<i64, AppError> {
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM server_members WHERE server_id=$1",
    )
    .bind(server_id)
    .fetch_one(pool)
    .await
    .map_err(|_| AppError::InternalError)?;

    Ok(count)
}

// ─── Join request functions ────────────────────────────────────────────────────

pub async fn create_join_request(
    server_id: Uuid,
    user_id: i32,
    message: Option<&str>,
    pool: &PgPool,
) -> Result<ServerJoinRequest, AppError> {
    let row = sqlx::query_as::<_, ServerJoinRequest>(
        r#"
        INSERT INTO server_join_requests (server_id, user_id, message)
        VALUES ($1, $2, $3)
        RETURNING *
        "#,
    )
    .bind(server_id)
    .bind(user_id)
    .bind(message)
    .fetch_one(pool)
    .await
    .map_err(|_| AppError::InternalError)?;

    Ok(row)
}

pub async fn get_join_request_by_id(
    request_id: Uuid,
    pool: &PgPool,
) -> Result<Option<ServerJoinRequest>, AppError> {
    let row = sqlx::query_as::<_, ServerJoinRequest>(
        "SELECT * FROM server_join_requests WHERE id=$1",
    )
    .bind(request_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| AppError::InternalError)?;

    Ok(row)
}

pub async fn list_pending_requests(
    server_id: Uuid,
    pool: &PgPool,
) -> Result<Vec<JoinRequestResponse>, AppError> {
    let rows = sqlx::query_as::<_, JoinRequestRow>(
        r#"
        SELECT
            sjr.id,
            sjr.user_id,
            u.username,
            u.image,
            sjr.message,
            sjr.created_at
        FROM server_join_requests sjr
        JOIN users u ON u.id = sjr.user_id
        WHERE sjr.server_id = $1 AND sjr.status = 'pending'
        ORDER BY sjr.created_at ASC
        "#,
    )
    .bind(server_id)
    .fetch_all(pool)
    .await
    .map_err(|_| AppError::InternalError)?;

    let requests = rows
        .into_iter()
        .map(|r| JoinRequestResponse {
            id: r.id,
            user_id: r.user_id,
            username: r.username,
            image: r.image,
            message: r.message,
            created_at: r.created_at,
        })
        .collect();

    Ok(requests)
}

pub async fn decide_join_request(
    request_id: Uuid,
    status: &str,
    reviewed_by: i32,
    pool: &PgPool,
) -> Result<ServerJoinRequest, AppError> {
    let row = sqlx::query_as::<_, ServerJoinRequest>(
        r#"
        UPDATE server_join_requests
        SET status = $2::join_request_status, reviewed_by = $3, updated_at = NOW()
        WHERE id = $1 AND status = 'pending'
        RETURNING *
        "#,
    )
    .bind(request_id)
    .bind(status)
    .bind(reviewed_by)
    .fetch_optional(pool)
    .await
    .map_err(|_| AppError::InternalError)?
    .ok_or(AppError::InternalError)?; // already decided or not found

    Ok(row)
}

pub async fn get_existing_request(
    server_id: Uuid,
    user_id: i32,
    pool: &PgPool,
) -> Result<Option<ServerJoinRequest>, AppError> {
    let row = sqlx::query_as::<_, ServerJoinRequest>(
        "SELECT * FROM server_join_requests WHERE server_id=$1 AND user_id=$2",
    )
    .bind(server_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| AppError::InternalError)?;

    Ok(row)
}
