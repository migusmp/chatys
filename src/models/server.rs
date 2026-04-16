use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ─── Enums ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "server_role", rename_all = "lowercase")]
pub enum ServerRole {
    Owner,
    Admin,
    Member,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "join_request_status", rename_all = "lowercase")]
pub enum JoinRequestStatus {
    Pending,
    Approved,
    Rejected,
}

// ─── DB Row Structs ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Server {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub image: Option<String>,
    pub is_public: bool,
    pub invite_code: Option<String>,
    pub created_by: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Channel {
    pub id: Uuid,
    pub server_id: Uuid,
    pub conversation_id: i32,
    pub name: String,
    pub is_default: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ServerMember {
    pub server_id: Uuid,
    pub user_id: i32,
    pub role: ServerRole,
    pub joined_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ServerJoinRequest {
    pub id: Uuid,
    pub server_id: Uuid,
    pub user_id: i32,
    pub status: JoinRequestStatus,
    pub message: Option<String>,
    pub reviewed_by: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ─── Response/View Types ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerSummary {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub image: Option<String>,
    pub is_public: bool,
    pub member_count: i64,
    pub member_role: Option<String>, // None if not a member
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerDetailResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub image: Option<String>,
    pub is_public: bool,
    pub invite_code: Option<String>, // only for owner/admin callers
    pub created_by: i32,
    pub created_at: DateTime<Utc>,
    pub channels: Vec<ChannelResponse>,
    pub member_role: Option<ServerRole>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelResponse {
    pub id: Uuid,
    pub server_id: Uuid,
    pub conversation_id: i32,
    pub name: String,
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberResponse {
    pub user_id: i32,
    pub username: String,
    pub image: Option<String>,
    pub role: ServerRole,
    pub joined_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JoinRequestResponse {
    pub id: Uuid,
    pub user_id: i32,
    pub username: String,
    pub image: Option<String>,
    pub message: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Returned by `GET /api/servers/friends` — servers where at least one friend
/// is a member and the caller is NOT already a member themselves.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FriendServerSummary {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub image: Option<String>,
    pub is_public: bool,
    pub member_count: i64,
    pub friends_in_server: Vec<String>, // usernames of friends present
}

// ─── Request Bodies ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct UpdateServerRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub is_public: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct JoinServerRequest {
    pub invite_code: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMemberRoleRequest {
    pub role: String, // "owner" | "admin" | "member"
}

#[derive(Debug, Deserialize)]
pub struct SubmitJoinRequestBody {
    pub message: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DecideJoinRequestBody {
    pub status: String, // "approved" | "rejected"
}

#[derive(Debug, Deserialize)]
pub struct CreateChannelRequest {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct RenameChannelRequest {
    pub name: String,
}
