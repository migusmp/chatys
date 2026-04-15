import { useEffect, useRef, useState } from "react";
import {
    connectToRoom,
    disconnectFromRoom,
    sendRoomMarkRead,
    sendRoomMessage,
    sendRoomTyping,
} from "../utils/roomSocket";
import type { ReactionCount } from "../types/chat_message";

export type { ReactionCount };

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
    /** ISO timestamp from DB history; absent for live WS messages. */
    createdAt?: string;
    /** Emoji reactions grouped by emoji. */
    reactions?: ReactionCount[];
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

interface RawTypingEvent {
    type_msg: "TYPING";
    userId: number;
    user: string;
}

interface RawReactionUpdate {
    type_msg: "REACTION_UPDATE";
    message_id: number;
    conversation_id: number;
    reactions: ReactionCount[];
}

type RawServerEvent =
    | RawChatMessage
    | RawReadReceipt
    | RawTypingEvent
    | RawReactionUpdate;

function isReadReceipt(event: RawServerEvent): event is RawReadReceipt {
    return (event as RawReadReceipt).type_msg === "READ_RECEIPT";
}

function isTypingEvent(event: RawServerEvent): event is RawTypingEvent {
    return (event as RawTypingEvent).type_msg === "TYPING";
}

function isReactionUpdate(event: RawServerEvent): event is RawReactionUpdate {
    return (event as RawReactionUpdate).type_msg === "REACTION_UPDATE";
}

// ─── HTTP history response shape ──────────────────────────────────────────────

interface HistoryMessage {
    id: number;
    sender_id: number;
    username: string;
    content: string;
    created_at: string | null;
    read_by: number[];
    edited_at: string | null;
    is_deleted: boolean | null;
    reactions?: ReactionCount[];
}

function historyToRoomMessage(h: HistoryMessage): RoomMessage {
    return {
        id: h.id,
        userId: h.sender_id,
        user: h.username,
        message: h.content,
        isSystem: false,
        readBy: [],
        createdAt: h.created_at ?? undefined,
        reactions: h.reactions ?? [],
    };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

// Tracks per-user typing timeout handles so each user's indicator expires independently.
type TypingTimeouts = Map<string, ReturnType<typeof setTimeout>>;

export function useRoomSocket(roomId: string | null, currentUserId?: number) {
    const [messages, setMessages] = useState<RoomMessage[]>([]);
    const [connected, setConnected] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [typingUsers, setTypingUsers] = useState<string[]>([]);

    // Keep a stable ref to avoid stale closure issues in callbacks
    const roomIdRef = useRef<string | null>(null);
    // Typing timeout handles per username — cleared when a new event arrives or after 3s
    const typingTimeoutsRef = useRef<TypingTimeouts>(new Map());

    // ── Fetch history from REST endpoint ──────────────────────────────────────

    const fetchHistory = async (
        room: string,
        limit: number,
        beforeId?: number,
    ): Promise<HistoryMessage[]> => {
        const params = new URLSearchParams({ limit: String(limit) });
        if (beforeId !== undefined) params.set("before_id", String(beforeId));

        const res = await fetch(
            `/api/chat/room/${encodeURIComponent(room)}/messages?${params}`,
            { credentials: "include" },
        );

        if (!res.ok) {
            throw new Error(`History fetch failed: ${res.status}`);
        }

        return res.json() as Promise<HistoryMessage[]>;
    };

    // ── Effect: load history then connect WS ─────────────────────────────────

    useEffect(() => {
        if (!roomId) {
            setConnected(false);
            return;
        }

        roomIdRef.current = roomId;
        setMessages([]);
        setHasMore(false);
        setTypingUsers([]);

        // Clear any leftover typing timeouts when switching rooms
        typingTimeoutsRef.current.forEach((handle) => clearTimeout(handle));
        typingTimeoutsRef.current.clear();

        let cancelled = false;

        const initRoom = async () => {
            setIsLoadingHistory(true);

            try {
                const history = await fetchHistory(roomId, 50);
                if (cancelled) return;

                setMessages(history.map(historyToRoomMessage));
                setHasMore(history.length === 50);
            } catch (err) {
                if (!cancelled) {
                    console.error(`[RoomSocket] Error cargando historial de "${roomId}":`, err);
                }
            } finally {
                if (!cancelled) setIsLoadingHistory(false);
            }

            if (cancelled) return;

            // Connect WS after history is ready
            const handleMessage = (raw: RawServerEvent) => {
                if (isTypingEvent(raw)) {
                    // Ignore own typing events reflected back from the server
                    if (raw.userId === currentUserId) return;

                    const username = raw.user;

                    // Reset the 3s expiry timer for this user
                    const existing = typingTimeoutsRef.current.get(username);
                    if (existing) clearTimeout(existing);

                    setTypingUsers((prev) =>
                        prev.includes(username) ? prev : [...prev, username],
                    );

                    const handle = setTimeout(() => {
                        setTypingUsers((prev) => prev.filter((u) => u !== username));
                        typingTimeoutsRef.current.delete(username);
                    }, 3000);

                    typingTimeoutsRef.current.set(username, handle);
                    return;
                }

                if (isReadReceipt(raw)) {
                    setMessages((prev) =>
                        prev.map((msg) => {
                            if (msg.id !== raw.message_id) return msg;
                            const alreadyTracked = msg.readBy.some((r) => r.id === raw.reader_id);
                            if (alreadyTracked) return msg;
                            return {
                                ...msg,
                                readBy: [
                                    ...msg.readBy,
                                    { id: raw.reader_id, username: raw.reader_username },
                                ],
                            };
                        }),
                    );
                    return;
                }

                if (isReactionUpdate(raw)) {
                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === raw.message_id
                                ? { ...msg, reactions: raw.reactions }
                                : msg,
                        ),
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
                    reactions: [],
                };
                setMessages((prev) => [...prev, msg]);

                // Auto-acknowledge receipt for messages from other users that have a DB ID
                const isFromOtherUser =
                    raw.userId !== undefined && raw.userId !== currentUserId;
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
        };

        initRoom();

        return () => {
            cancelled = true;
            disconnectFromRoom(roomId);
            setConnected(false);
            typingTimeoutsRef.current.forEach((handle) => clearTimeout(handle));
            typingTimeoutsRef.current.clear();
        };
    }, [roomId, currentUserId]);

    // ── Load more (backwards pagination) ─────────────────────────────────────

    const loadMore = async () => {
        const room = roomIdRef.current;
        if (!room || isLoadingHistory || !hasMore) return;

        // The oldest message currently shown is at index 0 (history is chronological)
        const oldestId = messages.find((m) => m.id !== undefined)?.id;

        setIsLoadingHistory(true);
        try {
            const older = await fetchHistory(room, 50, oldestId);
            setHasMore(older.length === 50);
            // Prepend in chronological order (server returns chronological after reversal)
            setMessages((prev) => [...older.map(historyToRoomMessage), ...prev]);
        } catch (err) {
            console.error(`[RoomSocket] Error cargando más mensajes de "${room}":`, err);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const sendMessage = (content: string) => {
        if (!roomId) return;
        const trimmed = content.trim();
        if (!trimmed) return;
        sendRoomMessage(roomId, trimmed);
    };

    const sendTyping = () => {
        if (!roomId) return;
        sendRoomTyping(roomId);
    };

    const clearMessages = () => setMessages([]);

    const toggleReaction = async (messageId: number, emoji: string) => {
        try {
            const res = await fetch(`/api/chat/messages/${messageId}/reactions`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ emoji }),
            });
            if (!res.ok) {
                console.error("[useRoomSocket] toggleReaction failed:", res.status);
            }
        } catch (err) {
            console.error("[useRoomSocket] toggleReaction network error:", err);
        }
    };

    return {
        messages,
        connected,
        isLoadingHistory,
        hasMore,
        typingUsers,
        sendMessage,
        sendTyping,
        loadMore,
        clearMessages,
        toggleReaction,
    };
}
