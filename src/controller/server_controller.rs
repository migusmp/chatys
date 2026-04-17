use axum::{
    extract::{Multipart, Path},
    response::IntoResponse,
    Extension, Json,
};
use hyper::StatusCode;
use sqlx::PgPool;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

use crate::db::channels::{
    count_channels, create_channel, delete_channel, delete_channel_message, get_channel,
    list_channels, rename_channel,
};
use crate::db::server_members::{
    add_member, create_join_request, decide_join_request, get_existing_request, get_join_request_by_id,
    get_member, list_members, list_pending_requests, remove_member, update_member_role,
};
use crate::db::servers::{
    create_server, delete_server, get_server_by_id, get_server_by_invite_code,
    list_friends_servers, list_servers_for_user, set_invite_code, update_server, update_server_image,
};
use crate::errors::AppError;
use crate::models::server::{
    ChannelResponse, CreateChannelRequest, DecideJoinRequestBody, JoinServerRequest,
    RenameChannelRequest, ServerDetailResponse, ServerMember, ServerRole, SubmitJoinRequestBody,
    UpdateMemberRoleRequest, UpdateServerRequest,
};
use crate::models::user::Payload;
use crate::utils::invite::generate_invite_code;
use crate::utils::responses::ApiResponse;

const MAX_CONTENT_LENGTH: u64 = 5 * 1024 * 1024; // 5 MB
const MAX_SERVER_NAME_LENGTH: usize = 100;
const MAX_DESCRIPTION_LENGTH: usize = 500;
const MAX_CHANNELS_PER_SERVER: i64 = 50;
const MAX_CHANNEL_NAME_LENGTH: usize = 32;

// ─── Private helpers ──────────────────────────────────────────────────────────

/// Check caller's role in a server. Returns the member row or Err if not a member.
async fn require_role(
    server_id: Uuid,
    user_id: i32,
    min_role: &str, // "member" | "admin" | "owner"
    pool: &PgPool,
) -> Result<ServerMember, AppError> {
    let member = get_member(server_id, user_id, pool)
        .await?
        .ok_or(AppError::Unauthorized)?;

    let passes = match min_role {
        "owner" => matches!(member.role, ServerRole::Owner),
        "admin" => matches!(member.role, ServerRole::Owner | ServerRole::Admin),
        _ => true, // "member" — any membership qualifies
    };

    if !passes {
        return Err(AppError::Unauthorized);
    }

    Ok(member)
}

/// Validate a channel name: 1-32 chars, only [a-z0-9-], no consecutive hyphens.
fn validate_channel_name(name: &str) -> bool {
    if name.is_empty() || name.len() > MAX_CHANNEL_NAME_LENGTH {
        return false;
    }
    // Only lowercase alphanumeric and hyphens
    if !name.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') {
        return false;
    }
    // No consecutive hyphens
    if name.contains("--") {
        return false;
    }
    true
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/// `GET /api/servers`
///
/// Returns all public servers plus any private servers the authenticated user
/// is already a member of. Each entry includes the caller's membership role.
pub async fn list_servers_handler(
    Extension(payload): Extension<Payload>,
    Extension(pool): Extension<PgPool>,
) -> Result<impl IntoResponse, AppError> {
    let servers = list_servers_for_user(payload.id, &pool).await?;
    Ok(ApiResponse::success_with_data("Servers fetched", Some(servers)))
}

/// `GET /api/servers/friends`
///
/// Returns public servers where at least one friend of the caller is a member
/// and the caller is NOT already a member. Each entry includes `friends_in_server`
/// (list of friend usernames present).
pub async fn list_friends_servers_handler(
    Extension(payload): Extension<Payload>,
    Extension(pool): Extension<PgPool>,
) -> Result<impl IntoResponse, AppError> {
    let servers = list_friends_servers(payload.id, &pool).await?;
    Ok(ApiResponse::success_with_data("Friends servers fetched", Some(servers)))
}

/// `POST /api/servers`  (multipart: name, description?, is_public, image?)
///
/// Creates a new server with a default "general" channel and adds the creator
/// as owner. Accepts an optional image upload (JPEG, PNG, GIF, WebP ≤ 5 MB).
pub async fn create_server_handler(
    Extension(payload): Extension<Payload>,
    Extension(pool): Extension<PgPool>,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, AppError> {
    let mut server_name: Option<String> = None;
    let mut description: Option<String> = None;
    let mut is_public: bool = true;
    let mut image_filename: Option<String> = None;

    while let Some(mut field) = multipart.next_field().await.map_err(|e| {
        eprintln!("create_server: multipart error: {:?}", e);
        AppError::InternalError
    })? {
        let field_name = field.name().unwrap_or("").to_string();

        match field_name.as_str() {
            "name" => {
                let value = field.text().await.map_err(|_| AppError::InternalError)?;
                let trimmed = value.trim().to_string();
                if trimmed.is_empty() || trimmed.len() > MAX_SERVER_NAME_LENGTH {
                    return Err(AppError::BadParameter);
                }
                server_name = Some(trimmed);
            }

            "description" => {
                let value = field.text().await.map_err(|_| AppError::InternalError)?;
                let trimmed = value.trim().to_string();
                if !trimmed.is_empty() {
                    if trimmed.len() > MAX_DESCRIPTION_LENGTH {
                        return Err(AppError::BadParameter);
                    }
                    description = Some(trimmed);
                }
            }

            "is_public" => {
                let value = field.text().await.map_err(|_| AppError::InternalError)?;
                is_public = value.trim() != "false" && value.trim() != "0";
            }

            "image" => {
                let content_type = field
                    .content_type()
                    .unwrap_or("application/octet-stream")
                    .to_string();

                if !content_type.starts_with("image/") {
                    return Err(AppError::InvalidImageFormat);
                }

                let file_extension = content_type
                    .split('/')
                    .last()
                    .ok_or(AppError::InvalidImageFormat)?
                    .to_string();

                let filename = format!("{}.{}", Uuid::new_v4(), file_extension);
                let path = format!("./uploads/servers/{}", filename);

                let first_chunk = field.chunk().await.map_err(|e| {
                    eprintln!("create_server: chunk error: {:?}", e);
                    AppError::InternalError
                })?;

                let Some(first_chunk) = first_chunk else {
                    return Err(AppError::InvalidImageFormat);
                };

                if let Some(kind) = infer::get(&first_chunk) {
                    if !kind.mime_type().starts_with("image/") {
                        return Err(AppError::InvalidImageFormat);
                    }
                } else {
                    return Err(AppError::InvalidImageFormat);
                }

                fs::create_dir_all("./uploads/servers").await.map_err(|e| {
                    eprintln!("create_server: mkdir error: {:?}", e);
                    AppError::InternalError
                })?;

                let mut file = fs::File::create(&path).await.map_err(|e| {
                    eprintln!("create_server: create file error: {:?}", e);
                    AppError::InternalError
                })?;

                let mut total_size: u64 = first_chunk.len() as u64;
                file.write_all(&first_chunk).await.map_err(|_| AppError::InternalError)?;

                while let Some(chunk) = field.chunk().await.map_err(|_| AppError::InternalError)? {
                    total_size += chunk.len() as u64;
                    if total_size > MAX_CONTENT_LENGTH {
                        let _ = fs::remove_file(&path).await;
                        return Err(AppError::FileTooLarge);
                    }
                    file.write_all(&chunk).await.map_err(|_| AppError::InternalError)?;
                }

                image_filename = Some(filename);
            }

            _ => {
                while field.chunk().await.map_err(|_| AppError::InternalError)?.is_some() {}
            }
        }
    }

    let name = server_name.ok_or(AppError::BadParameter)?;

    let (server, default_channel) =
        create_server(&name, description.as_deref(), is_public, payload.id, &pool)
            .await
            .map_err(|e| {
                if let Some(ref filename) = image_filename {
                    let path = format!("./uploads/servers/{}", filename);
                    tokio::spawn(async move { let _ = fs::remove_file(path).await; });
                }
                e
            })?;

    // Persist image path if one was uploaded
    if let Some(ref filename) = image_filename {
        if let Err(e) = update_server_image(server.id, filename, &pool).await {
            eprintln!("create_server: failed to store image path: {:?}", e);
            // Non-fatal — server was created, image is just missing from DB
        }
    }

    let image_url = image_filename.as_deref().map(|f| format!("/media/servers/{}", f));

    let response = serde_json::json!({
        "id": server.id,
        "name": server.name,
        "description": server.description,
        "image": image_url,
        "is_public": server.is_public,
        "created_by": server.created_by,
        "created_at": server.created_at,
        "default_channel": default_channel,
    });

    Ok((StatusCode::CREATED, ApiResponse::success_with_data("Server created", Some(response))))
}

/// `GET /api/servers/:server_id`
///
/// Returns full server details. The `invite_code` field is only populated for
/// owner/admin callers; plain members and non-members see `null`.
/// Channels list is always included.
pub async fn get_server_handler(
    Extension(payload): Extension<Payload>,
    Extension(pool): Extension<PgPool>,
    Path(server_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let server = get_server_by_id(server_id, &pool)
        .await?
        .ok_or(AppError::UserNotFound)?;

    let channels = list_channels(server_id, &pool).await?;
    let member = get_member(server_id, payload.id, &pool).await?;

    let is_admin_or_owner = member.as_ref().map_or(false, |m| {
        matches!(m.role, ServerRole::Owner | ServerRole::Admin)
    });

    let invite_code = if is_admin_or_owner { server.invite_code.clone() } else { None };
    let member_role = member.map(|m| m.role);

    let detail = ServerDetailResponse {
        id: server.id,
        name: server.name,
        description: server.description,
        image: server.image,
        is_public: server.is_public,
        invite_code,
        created_by: server.created_by,
        created_at: server.created_at,
        channels,
        member_role,
    };

    Ok(ApiResponse::success_with_data("Server fetched", Some(detail)))
}

/// `PATCH /api/servers/:server_id`
///
/// Updates name, description, and/or is_public. Caller must be owner.
pub async fn update_server_handler(
    Extension(payload): Extension<Payload>,
    Extension(pool): Extension<PgPool>,
    Path(server_id): Path<Uuid>,
    Json(body): Json<UpdateServerRequest>,
) -> Result<impl IntoResponse, AppError> {
    require_role(server_id, payload.id, "owner", &pool).await?;

    // Validate name if provided
    if let Some(ref name) = body.name {
        let trimmed = name.trim();
        if trimmed.is_empty() || trimmed.len() > MAX_SERVER_NAME_LENGTH {
            return Err(AppError::BadParameter);
        }
    }

    // Validate description if provided
    if let Some(ref desc) = body.description {
        if desc.trim().len() > MAX_DESCRIPTION_LENGTH {
            return Err(AppError::BadParameter);
        }
    }

    let updated = update_server(
        server_id,
        body.name.as_deref(),
        body.description.as_deref(),
        body.is_public,
        &pool,
    )
    .await?;

    Ok(ApiResponse::success_with_data("Server updated", Some(updated)))
}

/// `DELETE /api/servers/:server_id`
///
/// Permanently deletes the server and all its data. Caller must be owner.
pub async fn delete_server_handler(
    Extension(payload): Extension<Payload>,
    Extension(pool): Extension<PgPool>,
    Path(server_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    require_role(server_id, payload.id, "owner", &pool).await?;

    delete_server(server_id, &pool).await?;

    Ok(ApiResponse::success("Server deleted"))
}

/// `POST /api/servers/:server_id/join`
///
/// Joining logic:
/// - Public server → added immediately as "member".
/// - Private server + invite_code → verified against DB → added immediately.
/// - Private server, no code → join request created (202) or 409 if one already exists.
pub async fn join_server_handler(
    Extension(payload): Extension<Payload>,
    Extension(pool): Extension<PgPool>,
    Path(server_id): Path<Uuid>,
    Json(body): Json<JoinServerRequest>,
) -> Result<impl IntoResponse, AppError> {
    let server = get_server_by_id(server_id, &pool)
        .await?
        .ok_or(AppError::UserNotFound)?;

    // 409 if already a member
    if get_member(server_id, payload.id, &pool).await?.is_some() {
        return Ok((
            StatusCode::CONFLICT,
            ApiResponse::error(StatusCode::CONFLICT, "already_member"),
        ));
    }

    if server.is_public {
        let member = add_member(server_id, payload.id, "member", &pool).await?;
        let channels = list_channels(server_id, &pool).await?;

        let detail = ServerDetailResponse {
            id: server.id,
            name: server.name,
            description: server.description,
            image: server.image,
            is_public: server.is_public,
            invite_code: None,
            created_by: server.created_by,
            created_at: server.created_at,
            channels,
            member_role: Some(member.role),
        };

        return Ok((StatusCode::OK, ApiResponse::success_with_data("Joined server", Some(detail))));
    }

    // Private server
    if let Some(code) = body.invite_code.as_deref() {
        let matched = get_server_by_invite_code(code, &pool).await?;
        match matched {
            Some(ref s) if s.id == server_id => {
                let member = add_member(server_id, payload.id, "member", &pool).await?;
                let channels = list_channels(server_id, &pool).await?;

                let detail = ServerDetailResponse {
                    id: server.id,
                    name: server.name,
                    description: server.description,
                    image: server.image,
                    is_public: server.is_public,
                    invite_code: None,
                    created_by: server.created_by,
                    created_at: server.created_at,
                    channels,
                    member_role: Some(member.role),
                };

                return Ok((StatusCode::OK, ApiResponse::success_with_data("Joined server", Some(detail))));
            }
            _ => return Err(AppError::Unauthorized),
        }
    }

    // No invite code — create/check join request
    if get_existing_request(server_id, payload.id, &pool).await?.is_some() {
        return Ok((
            StatusCode::CONFLICT,
            ApiResponse::error(StatusCode::CONFLICT, "request_already_exists"),
        ));
    }

    create_join_request(server_id, payload.id, None, &pool).await?;

    Ok((
        StatusCode::ACCEPTED,
        ApiResponse::success_with_data(
            "request_submitted",
            Some(serde_json::json!({ "status": "success", "message": "request_submitted" })),
        ),
    ))
}

/// `POST /api/servers/:server_id/leave`
///
/// Removes the caller from the server. Owners must transfer ownership first.
pub async fn leave_server_handler(
    Extension(payload): Extension<Payload>,
    Extension(pool): Extension<PgPool>,
    Path(server_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let member = get_member(server_id, payload.id, &pool)
        .await?
        .ok_or(AppError::Unauthorized)?;

    if matches!(member.role, ServerRole::Owner) {
        return Ok((
            StatusCode::BAD_REQUEST,
            ApiResponse::error(StatusCode::BAD_REQUEST, "must transfer ownership before leaving"),
        ));
    }

    remove_member(server_id, payload.id, &pool).await?;

    Ok((StatusCode::OK, ApiResponse::success("Left server")))
}

/// `POST /api/servers/:server_id/invite/regenerate`
///
/// Generates and stores a new invite code. Caller must be admin or owner.
/// Returns 400 for public servers (invite codes are only meaningful for private ones).
pub async fn regenerate_invite_handler(
    Extension(payload): Extension<Payload>,
    Extension(pool): Extension<PgPool>,
    Path(server_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    require_role(server_id, payload.id, "admin", &pool).await?;

    let server = get_server_by_id(server_id, &pool)
        .await?
        .ok_or(AppError::UserNotFound)?;

    if server.is_public {
        return Ok((
            StatusCode::BAD_REQUEST,
            ApiResponse::error(StatusCode::BAD_REQUEST, "invite codes are not used for public servers"),
        ));
    }

    let code = generate_invite_code();
    let stored_code = set_invite_code(server_id, &code, &pool).await?;

    Ok((
        StatusCode::OK,
        ApiResponse::success_with_data("Invite code regenerated", Some(serde_json::json!({ "invite_code": stored_code }))),
    ))
}

/// `GET /api/servers/:server_id/members`
///
/// Returns all members of the server. Caller must be a member.
pub async fn list_members_handler(
    Extension(payload): Extension<Payload>,
    Extension(pool): Extension<PgPool>,
    Path(server_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    require_role(server_id, payload.id, "member", &pool).await?;

    let members = list_members(server_id, &pool).await?;

    Ok(ApiResponse::success_with_data("Members fetched", Some(members)))
}

/// `PATCH /api/servers/:server_id/members/:user_id`
///
/// Updates the role of a member. Rules:
/// - Caller must be admin or owner.
/// - Cannot modify the owner's role.
/// - Admins cannot modify other admins.
pub async fn update_member_role_handler(
    Extension(payload): Extension<Payload>,
    Extension(pool): Extension<PgPool>,
    Path((server_id, target_user_id)): Path<(Uuid, i32)>,
    Json(body): Json<UpdateMemberRoleRequest>,
) -> Result<impl IntoResponse, AppError> {
    let caller = require_role(server_id, payload.id, "admin", &pool).await?;

    let target = get_member(server_id, target_user_id, &pool)
        .await?
        .ok_or(AppError::UserNotFound)?;

    // Cannot modify the owner
    if matches!(target.role, ServerRole::Owner) {
        return Ok((
            StatusCode::FORBIDDEN,
            ApiResponse::error(StatusCode::FORBIDDEN, "cannot modify owner's role"),
        ));
    }

    // Admins cannot modify other admins
    if matches!(caller.role, ServerRole::Admin) && matches!(target.role, ServerRole::Admin) {
        return Ok((
            StatusCode::FORBIDDEN,
            ApiResponse::error(StatusCode::FORBIDDEN, "admins cannot modify other admins"),
        ));
    }

    let valid_roles = ["member", "admin"];
    if !valid_roles.contains(&body.role.as_str()) {
        return Err(AppError::BadParameter);
    }

    let updated = update_member_role(server_id, target_user_id, &body.role, &pool).await?;

    Ok((StatusCode::OK, ApiResponse::success_with_data("Role updated", Some(updated))))
}

/// `DELETE /api/servers/:server_id/members/:user_id`
///
/// Kicks a member from the server. Rules:
/// - Caller must be admin or owner.
/// - Cannot kick the owner.
/// - Admins cannot kick other admins.
pub async fn kick_member_handler(
    Extension(payload): Extension<Payload>,
    Extension(pool): Extension<PgPool>,
    Path((server_id, target_user_id)): Path<(Uuid, i32)>,
) -> Result<impl IntoResponse, AppError> {
    let caller = require_role(server_id, payload.id, "admin", &pool).await?;

    let target = get_member(server_id, target_user_id, &pool)
        .await?
        .ok_or(AppError::UserNotFound)?;

    // Cannot kick the owner
    if matches!(target.role, ServerRole::Owner) {
        return Ok((
            StatusCode::FORBIDDEN,
            ApiResponse::error(StatusCode::FORBIDDEN, "cannot kick the owner"),
        ));
    }

    // Admins cannot kick other admins
    if matches!(caller.role, ServerRole::Admin) && matches!(target.role, ServerRole::Admin) {
        return Ok((
            StatusCode::FORBIDDEN,
            ApiResponse::error(StatusCode::FORBIDDEN, "admins cannot kick other admins"),
        ));
    }

    remove_member(server_id, target_user_id, &pool).await?;

    Ok((StatusCode::OK, ApiResponse::success("Member kicked")))
}

/// `GET /api/servers/:server_id/requests`
///
/// Lists pending join requests. Caller must be admin or owner.
pub async fn list_requests_handler(
    Extension(payload): Extension<Payload>,
    Extension(pool): Extension<PgPool>,
    Path(server_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    require_role(server_id, payload.id, "admin", &pool).await?;

    let requests = list_pending_requests(server_id, &pool).await?;

    Ok(ApiResponse::success_with_data("Requests fetched", Some(requests)))
}

/// `POST /api/servers/:server_id/requests`
///
/// Submits a join request with an optional message. The server must be private.
/// Returns 409 if the caller is already a member or has a pending request.
pub async fn submit_join_request_handler(
    Extension(payload): Extension<Payload>,
    Extension(pool): Extension<PgPool>,
    Path(server_id): Path<Uuid>,
    Json(body): Json<SubmitJoinRequestBody>,
) -> Result<impl IntoResponse, AppError> {
    let server = get_server_by_id(server_id, &pool)
        .await?
        .ok_or(AppError::UserNotFound)?;

    if server.is_public {
        return Ok((
            StatusCode::BAD_REQUEST,
            ApiResponse::error(StatusCode::BAD_REQUEST, "server is public, use join endpoint"),
        ));
    }

    if get_member(server_id, payload.id, &pool).await?.is_some() {
        return Ok((
            StatusCode::CONFLICT,
            ApiResponse::error(StatusCode::CONFLICT, "already_member"),
        ));
    }

    if get_existing_request(server_id, payload.id, &pool).await?.is_some() {
        return Ok((
            StatusCode::CONFLICT,
            ApiResponse::error(StatusCode::CONFLICT, "request_already_exists"),
        ));
    }

    let request = create_join_request(
        server_id,
        payload.id,
        body.message.as_deref(),
        &pool,
    )
    .await?;

    Ok((
        StatusCode::CREATED,
        ApiResponse::success_with_data("Join request submitted", Some(request)),
    ))
}

/// `PATCH /api/servers/:server_id/requests/:request_id`
///
/// Approves or rejects a join request. If approved, the user is added as a member.
/// Caller must be admin or owner.
pub async fn decide_join_request_handler(
    Extension(payload): Extension<Payload>,
    Extension(pool): Extension<PgPool>,
    Path((server_id, request_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<DecideJoinRequestBody>,
) -> Result<impl IntoResponse, AppError> {
    require_role(server_id, payload.id, "admin", &pool).await?;

    let valid_statuses = ["approved", "rejected"];
    if !valid_statuses.contains(&body.status.as_str()) {
        return Err(AppError::BadParameter);
    }

    // Verify request belongs to this server
    let request = get_join_request_by_id(request_id, &pool)
        .await?
        .ok_or(AppError::UserNotFound)?;

    if request.server_id != server_id {
        return Err(AppError::Unauthorized);
    }

    let decided = decide_join_request(request_id, &body.status, payload.id, &pool).await?;

    // If approved, add the user as a member
    if body.status == "approved" {
        add_member(server_id, decided.user_id, "member", &pool).await?;
    }

    Ok(ApiResponse::success_with_data("Request decided", Some(decided)))
}

/// `GET /api/servers/:server_id/channels`
///
/// Lists all channels for the server. Caller must be a member.
pub async fn list_channels_handler(
    Extension(payload): Extension<Payload>,
    Extension(pool): Extension<PgPool>,
    Path(server_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    require_role(server_id, payload.id, "member", &pool).await?;

    let channels = list_channels(server_id, &pool).await?;

    Ok(ApiResponse::success_with_data("Channels fetched", Some(channels)))
}

/// `POST /api/servers/:server_id/channels`
///
/// Creates a new text channel. Caller must be admin or owner.
/// Name rules: 1-32 chars, only [a-z0-9-], no consecutive hyphens.
/// Max 50 channels per server.
pub async fn create_channel_handler(
    Extension(payload): Extension<Payload>,
    Extension(pool): Extension<PgPool>,
    Path(server_id): Path<Uuid>,
    Json(body): Json<CreateChannelRequest>,
) -> Result<impl IntoResponse, AppError> {
    require_role(server_id, payload.id, "admin", &pool).await?;

    let name = body.name.trim().to_string();
    if !validate_channel_name(&name) {
        return Err(AppError::BadParameter);
    }

    let channel_count = count_channels(server_id, &pool).await?;
    if channel_count >= MAX_CHANNELS_PER_SERVER {
        return Ok((
            StatusCode::BAD_REQUEST,
            ApiResponse::error(StatusCode::BAD_REQUEST, "maximum channel limit reached (50)"),
        ));
    }

    let channel = create_channel(server_id, &name, &pool).await?;

    Ok((StatusCode::CREATED, ApiResponse::success_with_data("Channel created", Some(channel))))
}

/// `PATCH /api/servers/:server_id/channels/:channel_id`
///
/// Renames an existing channel. Caller must be admin or owner.
/// The default channel cannot be renamed via this endpoint (DB enforces it).
pub async fn rename_channel_handler(
    Extension(payload): Extension<Payload>,
    Extension(pool): Extension<PgPool>,
    Path((server_id, channel_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<RenameChannelRequest>,
) -> Result<impl IntoResponse, AppError> {
    require_role(server_id, payload.id, "admin", &pool).await?;

    let name = body.name.trim().to_string();
    if !validate_channel_name(&name) {
        return Err(AppError::BadParameter);
    }

    // Verify the channel exists and belongs to this server before attempting rename
    let channel = get_channel(channel_id, server_id, &pool)
        .await?
        .ok_or(AppError::UserNotFound)?;

    if channel.is_default {
        return Ok((
            StatusCode::BAD_REQUEST,
            ApiResponse::error(StatusCode::BAD_REQUEST, "cannot rename the default channel"),
        ));
    }

    let updated = rename_channel(channel_id, server_id, &name, &pool).await?;

    Ok((StatusCode::OK, ApiResponse::success_with_data("Channel renamed", Some(updated))))
}

/// `PATCH /api/servers/:server_id/image`
///
/// Replaces the server's profile image. Caller must be admin or owner.
/// Accepts multipart with a single `image` field (JPEG, PNG, GIF, WebP ≤ 5 MB).
pub async fn update_server_image_handler(
    Extension(payload): Extension<Payload>,
    Extension(pool): Extension<PgPool>,
    Path(server_id): Path<Uuid>,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, AppError> {
    require_role(server_id, payload.id, "admin", &pool).await?;

    let mut image_filename: Option<String> = None;

    while let Some(mut field) = multipart.next_field().await.map_err(|_| AppError::InternalError)? {
        let field_name = field.name().unwrap_or("").to_string();
        if field_name != "image" {
            while field.chunk().await.map_err(|_| AppError::InternalError)?.is_some() {}
            continue;
        }

        let content_type = field
            .content_type()
            .unwrap_or("application/octet-stream")
            .to_string();

        if !content_type.starts_with("image/") {
            return Err(AppError::InvalidImageFormat);
        }

        let file_extension = content_type
            .split('/')
            .last()
            .ok_or(AppError::InvalidImageFormat)?
            .to_string();

        let filename = format!("{}.{}", Uuid::new_v4(), file_extension);
        let path = format!("./uploads/servers/{}", filename);

        let first_chunk = field.chunk().await.map_err(|_| AppError::InternalError)?;
        let Some(first_chunk) = first_chunk else {
            return Err(AppError::InvalidImageFormat);
        };

        if let Some(kind) = infer::get(&first_chunk) {
            if !kind.mime_type().starts_with("image/") {
                return Err(AppError::InvalidImageFormat);
            }
        } else {
            return Err(AppError::InvalidImageFormat);
        }

        fs::create_dir_all("./uploads/servers").await.map_err(|_| AppError::InternalError)?;

        let mut file = fs::File::create(&path).await.map_err(|_| AppError::InternalError)?;
        let mut total_size: u64 = first_chunk.len() as u64;
        file.write_all(&first_chunk).await.map_err(|_| AppError::InternalError)?;

        while let Some(chunk) = field.chunk().await.map_err(|_| AppError::InternalError)? {
            total_size += chunk.len() as u64;
            if total_size > MAX_CONTENT_LENGTH {
                let _ = fs::remove_file(&path).await;
                return Err(AppError::FileTooLarge);
            }
            file.write_all(&chunk).await.map_err(|_| AppError::InternalError)?;
        }

        image_filename = Some(filename);
        break;
    }

    let filename = image_filename.ok_or(AppError::BadParameter)?;
    update_server_image(server_id, &filename, &pool).await?;

    let image_url = format!("/media/servers/{}", filename);

    Ok(ApiResponse::success_with_data(
        "Server image updated",
        Some(serde_json::json!({ "image": image_url })),
    ))
}

/// `DELETE /api/servers/:server_id/channels/:channel_id/messages/:message_id`
///
/// Soft-deletes a channel message. Admins/owners can delete any message;
/// regular members can only delete their own.
pub async fn delete_channel_message_handler(
    Extension(payload): Extension<Payload>,
    Extension(pool): Extension<PgPool>,
    Path((server_id, channel_id, message_id)): Path<(Uuid, Uuid, i32)>,
) -> Result<impl IntoResponse, AppError> {
    let member = get_member(server_id, payload.id, &pool)
        .await?
        .ok_or(AppError::Unauthorized)?;

    let is_admin = matches!(member.role, ServerRole::Owner | ServerRole::Admin);

    let deleted = delete_channel_message(channel_id, server_id, message_id, payload.id, is_admin, &pool).await?;

    if !deleted {
        return Err(AppError::Unauthorized);
    }

    Ok(ApiResponse::success("Message deleted"))
}

/// `DELETE /api/servers/:server_id/channels/:channel_id`
///
/// Deletes a channel. Caller must be admin or owner.
/// The default channel cannot be deleted.
pub async fn delete_channel_handler(
    Extension(payload): Extension<Payload>,
    Extension(pool): Extension<PgPool>,
    Path((server_id, channel_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, AppError> {
    require_role(server_id, payload.id, "admin", &pool).await?;

    let channel = get_channel(channel_id, server_id, &pool)
        .await?
        .ok_or(AppError::UserNotFound)?;

    if channel.is_default {
        return Ok((
            StatusCode::BAD_REQUEST,
            ApiResponse::error(StatusCode::BAD_REQUEST, "cannot delete default channel"),
        ));
    }

    delete_channel(channel_id, server_id, &pool).await?;

    Ok((StatusCode::OK, ApiResponse::success("Channel deleted")))
}
