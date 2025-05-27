use axum::response::IntoResponse;

use crate::models::user::ErrorRequest;

pub async fn test() -> impl IntoResponse {
    "Posts test route".into_response()
}

pub async fn create_post() -> Result<impl IntoResponse, ErrorRequest> {
    Ok("Posts create route working!".into_response())
}
