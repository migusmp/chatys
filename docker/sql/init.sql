CREATE SEQUENCE IF NOT EXISTS users_id_seq;

CREATE TABLE IF NOT EXISTS users (
    id          integer PRIMARY KEY DEFAULT nextval('users_id_seq'),
    name        varchar(50) NOT NULL,
    description text NOT NULL DEFAULT '',
    username    varchar(50) NOT NULL UNIQUE,
    email       varchar(100) NOT NULL UNIQUE,
    password    text NOT NULL,
    created_at  timestamp DEFAULT CURRENT_TIMESTAMP,
    image       varchar(255) DEFAULT 'default.png'
);

CREATE TABLE IF NOT EXISTS friends (
    user_id    integer NOT NULL,
    friend_id  integer NOT NULL,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, friend_id),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_friend FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS friend_requests (
    id          integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id     integer NOT NULL,
    sender_id   integer NOT NULL,
    sender_name text NOT NULL,
    type_msg    text NOT NULL,
    status      character varying(20) DEFAULT 'pending',
    message     text NOT NULL DEFAULT 'FR',
    seen        boolean NOT NULL DEFAULT false,
    created_at  timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT friend_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT friend_requests_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS conversations (
    id         integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    type       character varying(20),
    is_group   boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS messages (
    id              integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    conversation_id integer NOT NULL,
    sender_id       integer NOT NULL,
    content         text NOT NULL,
    created_at      timestamp with time zone DEFAULT now(),
    read_by         jsonb DEFAULT '[]'::jsonb,
    edited_at       timestamp with time zone,
    is_deleted      boolean DEFAULT false,
    CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS conversation_participants (
    conversation_id integer NOT NULL,
    user_id         integer NOT NULL,
    PRIMARY KEY (conversation_id, user_id),
    CONSTRAINT fk_conversation
        FOREIGN KEY (conversation_id)
        REFERENCES conversations(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS undelivered_messages (
    id              integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    message_id      integer NOT NULL,
    recipient_id    integer NOT NULL,
    conversation_id integer NOT NULL,
    created_at      timestamp with time zone DEFAULT now(),
    CONSTRAINT undelivered_messages_message_id_recipient_id_key UNIQUE (message_id, recipient_id),
    CONSTRAINT undelivered_messages_message_id_fkey FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    CONSTRAINT undelivered_messages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT undelivered_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rooms (
    id             SERIAL PRIMARY KEY,
    name           VARCHAR(100) NOT NULL UNIQUE,
    description    TEXT,
    image          VARCHAR(255),
    created_by     INT REFERENCES users(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_conv_participants_user_id ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_undelivered_recipient ON undelivered_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_user_status ON friend_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON friend_requests(sender_id);

-- Phase 3: read receipt performance index
CREATE INDEX IF NOT EXISTS idx_messages_read_by ON messages USING GIN (read_by);

-- Phase 3: group chat support columns on conversation_participants
ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'member';

-- Phase 4: link rooms to their conversation for message persistence
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS conversation_id INT REFERENCES conversations(id) ON DELETE SET NULL;

-- Phase 5: explicit message persistence flag — creator can opt out of history
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS persist_messages BOOLEAN NOT NULL DEFAULT TRUE;

-- Phase 6: emoji reactions on messages
CREATE TABLE IF NOT EXISTS message_reactions (
    id         BIGSERIAL PRIMARY KEY,
    message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji      VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON message_reactions(message_id);

-- Phase 7: message replies (quote-reply)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id INT REFERENCES messages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_messages_reply_to_id ON messages(reply_to_id);

-- ─── Servers ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS servers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    description TEXT,
    image       TEXT,
    is_public   BOOLEAN NOT NULL DEFAULT TRUE,
    invite_code TEXT UNIQUE,
    created_by  INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_servers_is_public ON servers(is_public);
CREATE INDEX IF NOT EXISTS idx_servers_invite_code ON servers(invite_code) WHERE invite_code IS NOT NULL;

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES servers(id) ON DELETE CASCADE;

DO $$ BEGIN
    CREATE TYPE server_role AS ENUM ('owner', 'admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS server_members (
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    user_id   INT  NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    role      server_role NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (server_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_server_members_user_id ON server_members(user_id);

DO $$ BEGIN
    CREATE TYPE join_request_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS server_join_requests (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id   UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    user_id     INT  NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    status      join_request_status NOT NULL DEFAULT 'pending',
    message     TEXT,
    reviewed_by INT REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (server_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_join_requests_server_status ON server_join_requests(server_id, status);

CREATE TABLE IF NOT EXISTS channels (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id       UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    conversation_id INT  NOT NULL UNIQUE REFERENCES conversations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (server_id, name)
);

CREATE INDEX IF NOT EXISTS idx_channels_server_id ON channels(server_id);

-- Seed: Chatys default public server
-- Uses a DO block so the SERIAL conversation_id is captured dynamically
DO $$
DECLARE
    chatys_server_id UUID := '00000000-0000-0000-0000-000000000001';
    chatys_conv_id   INT;
BEGIN
    -- Insert default server
    INSERT INTO servers(id, name, description, is_public, created_by)
    SELECT chatys_server_id, 'Chatys', 'The global Chatys community', TRUE, id
    FROM users ORDER BY id LIMIT 1
    ON CONFLICT DO NOTHING;

    -- Only proceed if server was inserted (skip on subsequent startups)
    IF EXISTS (SELECT 1 FROM servers WHERE id = chatys_server_id) AND
       NOT EXISTS (SELECT 1 FROM channels WHERE server_id = chatys_server_id) THEN

        -- Create the conversation for #general
        INSERT INTO conversations(type, is_group, created_at, updated_at)
        VALUES ('room', TRUE, NOW(), NOW())
        RETURNING id INTO chatys_conv_id;

        -- Update the conversation with server_id
        UPDATE conversations SET server_id = chatys_server_id WHERE id = chatys_conv_id;

        -- Create #general channel
        INSERT INTO channels(server_id, conversation_id, name, is_default)
        VALUES (chatys_server_id, chatys_conv_id, 'general', TRUE);
    END IF;
END $$;
