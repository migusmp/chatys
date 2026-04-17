use axum::{
    middleware::from_fn,
    routing::{delete, get, patch, post},
    Extension, Router,
};
use sqlx::PgPool;

use crate::controller::server_controller::*;
use crate::middlewares::auth::auth;

pub fn server_router(pool: PgPool) -> Router {
    Router::new()
        // Server CRUD
        .route("/", get(list_servers_handler).post(create_server_handler))
        // Friends' servers — must be before /{server_id} so Axum matches the literal first
        .route("/friends", get(list_friends_servers_handler))
        .route(
            "/{server_id}",
            get(get_server_handler)
                .patch(update_server_handler)
                .delete(delete_server_handler),
        )
        // Join / Leave
        .route("/{server_id}/join", post(join_server_handler))
        .route("/{server_id}/leave", post(leave_server_handler))
        // Invite
        .route(
            "/{server_id}/invite/regenerate",
            post(regenerate_invite_handler),
        )
        // Members
        .route("/{server_id}/members", get(list_members_handler))
        .route(
            "/{server_id}/members/{user_id}",
            patch(update_member_role_handler).delete(kick_member_handler),
        )
        // Join requests
        .route(
            "/{server_id}/requests",
            get(list_requests_handler).post(submit_join_request_handler),
        )
        .route(
            "/{server_id}/requests/{request_id}",
            patch(decide_join_request_handler),
        )
        // Server image
        .route("/{server_id}/image", patch(update_server_image_handler))
        // Channels
        .route(
            "/{server_id}/channels",
            get(list_channels_handler).post(create_channel_handler),
        )
        .route(
            "/{server_id}/channels/{channel_id}",
            patch(rename_channel_handler).delete(delete_channel_handler),
        )
        .route(
            "/{server_id}/channels/{channel_id}/messages/{message_id}",
            delete(delete_channel_message_handler),
        )
        // Auth + state
        .layer(from_fn(auth))
        .layer(Extension(pool))
}
