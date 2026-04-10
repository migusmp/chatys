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
