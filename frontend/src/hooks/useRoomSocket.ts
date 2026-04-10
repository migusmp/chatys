import { useEffect, useRef, useState } from "react";
import {
    connectToRoom,
    disconnectFromRoom,
    sendRoomMarkRead,
    sendRoomMessage,
} from "../utils/roomSocket";

// TODO: When adding persistence history load, fetch message history here before connecting WS
// endpoint will be: GET /api/chat/messages/{roomId}?limit=50

export interface RoomMessageReader {
    id: number;
    username: string;
}

export interface RoomMessage {
    /** DB-assigned message ID. Present for persisted messages, absent for system events. */
    id?: number;
    userId?: number;
    /** "system" for join/leave notifications */
    user: string;
    message: string;
    image?: string;
    /** Derived: true when user === "system" */
    isSystem?: boolean;
    /** Users who have read this message (populated from READ_RECEIPT events). */
    readBy: RoomMessageReader[];
}

// ─── Raw shapes coming in from the server ────────────────────────────────────

interface RawChatMessage {
    type_msg?: never;
    userId?: number;
    user: string;
    message: string;
    image?: string;
    id?: number;
}

interface RawReadReceipt {
    type_msg: "READ_RECEIPT";
    message_id: number;
    reader_id: number;
    reader_username: string;
}

type RawServerEvent = RawChatMessage | RawReadReceipt;

function isReadReceipt(event: RawServerEvent): event is RawReadReceipt {
    return (event as RawReadReceipt).type_msg === "READ_RECEIPT";
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRoomSocket(roomId: string | null, currentUserId?: number) {
    const [messages, setMessages] = useState<RoomMessage[]>([]);
    const [connected, setConnected] = useState(false);

    // Keep a stable ref to avoid stale closure issues in callbacks
    const roomIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!roomId) {
            setConnected(false);
            return;
        }

        roomIdRef.current = roomId;
        setMessages([]);

        const handleMessage = (raw: RawServerEvent) => {
            if (isReadReceipt(raw)) {
                // Update the readBy array on the matching message
                setMessages((prev) =>
                    prev.map((msg) => {
                        if (msg.id !== raw.message_id) return msg;
                        // Avoid duplicates in case the event arrives more than once
                        const alreadyTracked = msg.readBy.some((r) => r.id === raw.reader_id);
                        if (alreadyTracked) return msg;
                        return {
                            ...msg,
                            readBy: [...msg.readBy, { id: raw.reader_id, username: raw.reader_username }],
                        };
                    })
                );
                return;
            }

            const isSystem = raw.user === "system";
            const msg: RoomMessage = {
                id: raw.id,
                userId: raw.userId,
                user: raw.user,
                message: raw.message,
                image: raw.image,
                isSystem,
                readBy: [],
            };
            setMessages((prev) => [...prev, msg]);

            // Auto-acknowledge receipt for messages from other users that have a DB ID
            const isFromOtherUser = raw.userId !== undefined && raw.userId !== currentUserId;
            if (!isSystem && isFromOtherUser && raw.id !== undefined && roomIdRef.current) {
                sendRoomMarkRead(roomIdRef.current, raw.id);
            }
        };

        connectToRoom<RawServerEvent>(
            roomId,
            handleMessage,
            () => setConnected(true),
            () => setConnected(false),
        );

        return () => {
            disconnectFromRoom(roomId);
            setConnected(false);
        };
    }, [roomId, currentUserId]);

    const sendMessage = (content: string) => {
        if (!roomId) return;
        const trimmed = content.trim();
        if (!trimmed) return;
        sendRoomMessage(roomId, trimmed);
    };

    const clearMessages = () => setMessages([]);

    return {
        messages,
        connected,
        sendMessage,
        clearMessages,
    };
}
