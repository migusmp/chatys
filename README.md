# Rusty API — Real-Time Chat (Rust + Axum + React) + Shuttle

App full-stack de **chats en tiempo real**:
- **Backend** en **Rust (Axum + WebSockets)**, preparado para **Shuttle**
- **Frontend** en **React**
- **Rooms**, **broadcast**, **auth**, **persistencia** (DB) y opcional **Redis**

> Objetivo: tener un backend tipo “API + WS” para salas de chat, y un frontend que se conecta por HTTP/WS.

---

## ✨ Features

- WebSockets para mensajería en tiempo real
- Salas (rooms): crear / listar / unirse
- Broadcast por sala (fan-out a todos los clientes conectados)
- Auth (JWT/cookie) + endpoints REST (register/login/logout/me)
- Persistencia: historial de mensajes, rooms, usuarios (según tu DB)
- Redis opcional: cache/presence/pubsub/rate-limit (si lo usas)

---

## 🧱 Stack

**Backend**
- Rust + Tokio
- Axum (HTTP + WebSockets)
- DB (ej. Postgres)
- Redis (opcional)

**Frontend**
- React (Vite recomendado)
- fetch/axios para REST + WebSocket nativo para tiempo real

**Deploy**
- Shuttle (CLI)

---

## 📁 Estructura (sugerida)

Monorepo:

```text
.
├─ backend/
│  ├─ src/
│  ├─ Cargo.toml
│  ├─ Shuttle.toml
│  ├─ Secrets.dev.toml
│  └─ Secrets.toml
└─ frontend/
   ├─ src/
   ├─ package.json
   └─ .env
Si lo tienes en repos separados, aplica cada sección en su repo.

✅ Requisitos
Rust (stable) + Cargo

Node.js 18+

Shuttle CLI (instalado y logueado) 

🔐 Configuración de secrets / env
Backend (Shuttle secrets)
Crea backend/Secrets.dev.toml para local y backend/Secrets.toml para producción.

Ejemplo:

# auth
JWT_SECRET = "change-me"

# database
DATABASE_URL = "postgres://user:pass@localhost:5432/rusty_chat"

# redis (opcional)
REDIS_URL = "redis://localhost:6379"

# cors
CORS_ORIGIN = "http://localhost:5173"

# cookies
COOKIE_SECURE = "false"

# logs
RUST_LOG = "info"
Puedes usar un fichero de secrets alternativo con --secrets <archivo> en shuttle run / shuttle deploy. 

Frontend (frontend/.env)
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
En producción:

VITE_API_URL=https://<tu-app>.shuttle.app

VITE_WS_URL=wss://<tu-app>.shuttle.app/ws

🚀 Ejecutar en local
1) Backend
Desde backend/:

shuttle run --secrets Secrets.dev.toml
El local run de Shuttle simula recursos y ejecuta tu app de forma parecida a producción. 

Si no usas --secrets, Shuttle usará el fichero por defecto si existe.

Nota: Axum 0.7 con Shuttle
shuttle-axum soporta Axum 0.7 mediante feature flags en tu Cargo.toml. 

2) Frontend
Desde frontend/:

npm install
npm run dev
Abre la URL que te muestre Vite (normalmente http://localhost:5173).

🌐 API (orientativo)
Ajusta rutas a tu router real.

Auth
POST /api/auth/register

POST /api/auth/login

POST /api/auth/logout

GET /api/auth/me

Rooms
GET /api/rooms

POST /api/rooms

POST /api/rooms/:room_id/join

GET /api/rooms/:room_id/messages (historial)

WebSocket
GET /ws?room_id=<room_id>

Alternativa: GET /ws/:room_id

🔌 Protocolo WebSocket (ejemplo)
Client → Server
{
  "type": "message",
  "roomId": "room_123",
  "content": "hola",
  "clientTs": 1730000000
}
Server → Clients (broadcast)
{
  "type": "message",
  "roomId": "room_123",
  "message": {
    "id": "msg_001",
    "userId": "u_01",
    "content": "hola",
    "ts": 1730000001
  }
}
Eventos opcionales:

{ "type": "joined", "roomId": "room_123", "userId": "u_01" }
{ "type": "typing", "roomId": "room_123", "userId": "u_01" }
☁️ Deploy en Shuttle
Desde backend/:

shuttle login
shuttle deploy --secrets Secrets.toml
Puedes gestionar secrets con ficheros TOML y pasarlos a deploy con --secrets. 

🧠 Arquitectura (alto nivel)
REST: auth/rooms/historial

WS: conexión persistente por cliente

Estado de rooms: map room_id -> broadcast channel (fan-out)

Persistencia: DB (mensajes, rooms, usuarios)

Redis (opcional): presence, cache, pubsub si escalas

🛣️ Roadmap
Presence + typing

Rate limit / anti-spam

Moderación (ban/slow mode)

Mensajes privados

Tests (unit + integration) y CI

Observabilidad (tracing + logs estructurados)

📜 Licencia
Este proyecto usa una licencia propietaria “source-available”:

✅ puedes clonar/usar/modificar para uso personal o interno

❌ no puedes redistribuir (publicar copias) ni usarlo comercialmente

Ver archivo LICENSE.