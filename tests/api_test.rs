// use crate::{models::user::User, utils::user_utils::create_payload};
// use rand::{distributions::Alphanumeric, Rng};
// use serde::Deserialize;

// mod common;

// #[derive(Deserialize, Debug, PartialEq)]
// struct ErrorResponse {
//     status: String,
//     message: String,
// }

// #[derive(Deserialize, Debug, PartialEq)]
// struct SuccessResponse {
//     status: String,
//     message: String,
// }

// fn generate_random_string(len: usize) -> String {
//     rand::thread_rng()
//         .sample_iter(&Alphanumeric)
//         .take(len)
//         .map(char::from)
//         .collect()
// }

// async fn obtain_user_payload() -> String {
//     let user_data = User {
//         id: 11,
//         username: String::from("megu"),
//         name: String::from("miguel"),
//         email: String::from("megu@example.com"),
//         password: String::from("1234"),
//         image: String::from("default.png"),
//         created_at: Some(String::from("1233, 445")),
//     };
//     let payload = create_payload(user_data).await.unwrap();
//     payload
// }

// #[cfg(test)]
// mod tests {
//     use super::*;
//     use axum_server::db::db::init_db_pool;
//     use reqwest::Client;
//     use sqlx::query;

//     #[tokio::test]
//     async fn test_invalid_update_email() {
//         let rand_str = generate_random_string(8);
//         let new_email_1 = format!("testupdateemail{}example.com", rand_str); // test update email
//                                                                              // without @.
//         let new_email_2 = format!("testupdateemail{}@example", rand_str);
//         let form_data_1 = [("email", new_email_1)];
//         let form_data_2 = [("email", new_email_2)];
//         let payload = obtain_user_payload().await;

//         let client = Client::new();
//         let response_1 = client
//             .put("http://127.0.0.1:3000/application/user/update")
//             .form(&form_data_1)
//             .header("Cookie", format!("auth={}", payload))
//             .send()
//             .await
//             .unwrap();

//         let response_2 = client
//             .put("http://127.0.0.1:3000/application/user/update")
//             .form(&form_data_2)
//             .header("Cookie", format!("auth={}", payload))
//             .send()
//             .await
//             .unwrap();

//         assert_eq!(response_1.status(), 400);
//         assert_eq!(response_2.status(), 400)
//     }

//     #[tokio::test]
//     async fn test_update_email() {
//         let rand_str = generate_random_string(8);
//         let new_email = format!("testupdateemail{}@example.com", rand_str);

//         let form_data = [("email", new_email)];
//         let payload = obtain_user_payload().await;

//         let client = Client::new();
//         let response = client
//             .put("http://127.0.0.1:3000/application/user/update")
//             .form(&form_data)
//             .header("Cookie", format!("auth={}", payload))
//             .send()
//             .await
//             .unwrap();
//         assert_eq!(response.status(), 200)
//     }

//     #[tokio::test]
//     async fn test_update_username() {
//         let rand_str = generate_random_string(8);
//         let username = format!("testupdate{}", rand_str);

//         let payload = obtain_user_payload().await;
//         let form_data = [("username", username)];

//         let client = Client::new();
//         let response = client
//             .put("http://127.0.0.1:3000/application/user/update")
//             .form(&form_data)
//             .header("Cookie", format!("auth={}", payload))
//             .send()
//             .await
//             .unwrap();
//         assert_eq!(response.status(), 200)
//     }

//     #[tokio::test]
//     async fn test_logout_endpoint() {
//         let payload = obtain_user_payload().await;
//         let client = Client::new();
//         let response = client
//             .post("http://127.0.0.1:3000/application/user/logout")
//             .header("Cookie", format!("auth={}", payload))
//             .send()
//             .await
//             .unwrap();

//         // Verifica el estado de la respuesta
//         assert_eq!(response.status(), 200);
//     }

//     #[tokio::test]
//     async fn test_protected_endpoint_with_jwt_cookie() {
//         let payload = obtain_user_payload().await;
//         let client = Client::new();
//         let response = client
//             .get("http://127.0.0.1:3000/application/user/info")
//             .header("Cookie", format!("auth={}", payload))
//             .send()
//             .await
//             .unwrap();

//         // Verifica el estado de la respuesta
//         assert_eq!(response.status(), 200);
//     }

//     #[tokio::test]
//     async fn test_login_success_response() {
//         let client = Client::new();
//         let form_data = [("username", "migus"), ("password", "1234")];

//         let response = client
//             .post("http://127.0.0.1:3000/application/user/login")
//             .form(&form_data)
//             .send()
//             .await
//             .expect("Error to send request to server");

//         assert_eq!(response.status(), 200);

//         let json_body: SuccessResponse = response
//             .json()
//             .await
//             .expect("Error to parse response from server");

//         assert_eq!(
//             json_body,
//             SuccessResponse {
//                 status: "success".to_string(),
//                 message: "Login successful".to_string(),
//             }
//         );
//     }

//     #[tokio::test]
//     async fn test_login_error_invalid_credentials() {
//         let client = Client::new();
//         let form_data = [("username", "migus"), ("password", "123")];

//         let response = client
//             .post("http://127.0.0.1:3000/application/user/login")
//             .form(&form_data)
//             .send()
//             .await
//             .expect("Error to send request to server");

//         assert_eq!(response.status(), 400);

//         let json_data: ErrorResponse = response.json().await.expect("Error to parse response data");

//         assert_eq!(
//             json_data,
//             ErrorResponse {
//                 status: "error".to_string(),
//                 message: "Invalid password or user doesn't exist".to_string()
//             }
//         );
//     }

//     #[tokio::test]
//     async fn test_register_user_already_exists() {
//         let client = Client::new();
//         let form_data = [
//             ("username", "migus"),
//             ("name", "miguel"),
//             ("password", "1234"),
//             ("email", "test@example.com"),
//         ];
//         let response = client
//             .post("http://127.0.0.1:3000/application/user/register")
//             .form(&form_data)
//             .send()
//             .await
//             .expect("Error to send request to server");

//         assert_eq!(response.status(), 409);

//         let json_body: ErrorResponse = response.json().await.unwrap();

//         assert_eq!(
//             json_body,
//             ErrorResponse {
//                 status: "error".to_string(),
//                 message: "User already exists".to_string(),
//             }
//         );
//     }

//     #[tokio::test]
//     async fn test_register_user() {
//         let rand_str = generate_random_string(8);
//         let username = format!("test{}", rand_str);
//         let name = format!("test{}", rand_str);
//         let email = format!("{}@example.com", username);
//         let password = "1234";

//         let client = Client::new();
//         let form_data = [
//             ("username", &username),
//             ("name", &name),
//             ("password", &password.to_string()),
//             ("email", &email),
//         ];

//         let response = client
//             .post("http://127.0.0.1:3000/application/user/register")
//             .form(&form_data)
//             .send()
//             .await
//             .expect("Error to send request to server");

//         assert_eq!(response.status(), 200);

//         let json_body: SuccessResponse = response.json().await.expect("Error to parse response");

//         assert_eq!(
//             json_body,
//             SuccessResponse {
//                 status: "success".to_string(),
//                 message: "User created successfully".to_string()
//             }
//         );
//     }

//     #[tokio::test]
//     async fn test_init_db_pool() {
//         let pool = init_db_pool().await;

//         let result = query("SELECT 1").execute(pool.as_ref()).await;
//         assert!(result.is_ok(), "Database connection or query failed");
//     }
// }
