# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Backend (Rust + Shuttle)
cargo shuttle run                              # Run locally (needs Docker for Shuttle's auto-provisioned Postgres)
cargo shuttle run --secrets Secrets.dev.toml   # Run with custom secrets
cargo shuttle deploy --secrets Secrets.toml    # Deploy to Shuttle.rs
cargo build                                    # Build (SQLx macros require DATABASE_URL or .sqlx/ cache)
cargo test                                     # Run tests (tests/ directory, mostly integration)

# Frontend (React + Vite)
cd frontend && npm run dev                     # Dev server with HMR
cd frontend && npm run build:copy              # Build and copy dist/ → ../static/
cd frontend && npm run lint                    # ESLint

# Database
docker compose up -d                           # Standalone Postgres on port 16787
docker compose down -v                         # Reset DB (re-runs init.sql on next up)
```

## Architecture

Full-stack real-time chat app: Rust/Axum backend + React 19 frontend, deployed on Shuttle.rs.

### Backend (`src/`)

Layered architecture: **Routes → Controllers → Services → DB**

- **Routes** (`routes/`): Define endpoint paths and attach auth middleware per-route (not globally). Main router nests `/api/user`, `/api/chat`, `/api/friend`, `/api/post`. WebSocket routes at `/ws` and `/ws/{chat_id}`.
- **Controllers** (`controller/`): Request handling, validation, response building. Image uploads use `infer` for type detection, UUID for filenames, 5MB max.
- **Services** (`services/`): Business logic. `ws.rs` handles WebSocket message routing, `notification.rs` manages online/offline notification queuing, `chat.rs` manages group rooms.
- **DB** (`db/`): Raw SQLx queries with compile-time checking (`.sqlx/` offline cache). No ORM.
- **Models** (`models/`): `Payload` is the JWT claims struct used everywhere for auth context. `ErrorRequest` enum covers all domain errors with `IntoResponse` impl.
- **State** (`state/`): Two separate state systems:
  - `ChatState`: Group chat rooms with `broadcast::Sender<Message>` per room
  - `AppState`: DM channels (`DashMap<(conversation_id, user_id), mpsc::Sender>`), connected users map, friend notification channels, undelivered message queue
- **Middlewares** (`middlewares/auth.rs`): Extracts JWT from `auth` cookie, inserts `Payload` into request extensions.
- **Utils** (`utils/`): JWT generation/verification, CORS config, cookie creation (httpOnly, Secure, SameSite=Lax), response helpers.

### Frontend (`frontend/src/`)

- **Context**: `UserContext` holds user profile + notifications + active friends + DM updates. `WebSocketContext` maintains global WS connection to `/ws` for notifications.
- **Hooks**: `useUser()` for auth operations, `useFetch()` for API calls, `useDmSocket(friendId)` for per-conversation WS connections, `useIsMobile()` for responsive layout.
- **Routing**: React Router 7 with `ProtectedRoute` wrapper. Nested routes for `/dm/:username`, `/profile/:username`, `/settings/*`.
- **i18n**: i18next with `en` and `es` locale files, browser language detection.
- **Build**: Vite + SWC. `build:copy` script compiles and copies output to `static/` for Shuttle to serve.

### Key Patterns

- **Auth flow**: Login → bcrypt verify → JWT in httpOnly cookie → middleware extracts `Payload` into Extensions
- **Message delivery**: Connected users get messages via mpsc channels; offline users get queued in `undelivered_messages` table, delivered on reconnect
- **WebSocket protocol**: JSON messages with `type_msg` field discriminator (`chat_message`, `NEW_DM_MESSAGE`, `FR`, `AFR`)
- **API responses**: `ApiResponse` enum with `Success`, `SuccessWithData`, `SuccessWithCookie`, `Error` variants, all returning `(StatusCode, Json<Value>)`
- **Migrations**: `init.sql` is `include_str!`'d and executed on startup in `main()` — not managed by sqlx-cli

### Database

PostgreSQL via SQLx. Tables: `users`, `friends`, `friend_requests`, `conversations`, `conversation_participants`, `messages`, `undelivered_messages`. Schema in `docker/sql/init.sql` and `migrations/init.sql`.

### Deployment

Shuttle.rs manages Postgres provisioning in prod. `Shuttle.toml` declares build assets (`public/`, `uploads/`, `templates/`). Secrets via `Secrets.toml` (not committed).
