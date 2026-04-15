import { useCallback, useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import {
    useFriendsContext,
    useNotificationsContext,
    useUserProfileContext,
} from "../context/UserContext";
import type { NewDmMessageNotification } from "../interfaces/notifications";
import type { ChatMessage, MessagePreview, ReactionCount } from "../types/chat_message";
import type { FullConversation, Participants } from "../types/user";
import { messageCache } from "../utils/messageCache";

type UseDmRoomReturn = {
    allMessages: ChatMessage[];
    bottomRef: RefObject<HTMLDivElement | null>;
    containerRef: RefObject<HTMLDivElement | null>;
    currentUserId: number | undefined;
    handleSendMessage: () => void;
    hasMore: boolean;
    isOnline: boolean;
    loadingMore: boolean;
    message: string;
    otherParticipant: Participants | undefined;
    replyingTo: ChatMessage | null;
    sendDelete: (messageId: number) => void;
    sendEdit: (messageId: number, newContent: string) => void;
    sendImageMessage: (url: string) => void;
    sendTyping: () => void;
    setMessage: Dispatch<SetStateAction<string>>;
    setReplyingTo: Dispatch<SetStateAction<ChatMessage | null>>;
    toggleReaction: (messageId: number, emoji: string) => Promise<void>;
    typingUser: string | null;
};

const MESSAGES_LIMIT = 10;
// Auto-clear the typing indicator after this many ms with no new typing event.
const TYPING_TIMEOUT_MS = 3000;

export default function useDmRoom(conversationData: FullConversation): UseDmRoomReturn {
    const { user } = useUserProfileContext();
    const { checkUserIsOnline } = useFriendsContext();
    const { setDmNotifications, setNewLastMessage } = useNotificationsContext();

    // Derive participant info and cache key before any state declarations
    const otherParticipant = conversationData.conversation.participants.find(
        (participant) => participant.id !== user?.id,
    );
    const otherParticipantId = otherParticipant?.id;
    const otherParticipantUsername = otherParticipant?.username;
    const isOnline = checkUserIsOnline(otherParticipantId ?? -1);

    // Stable cache key — username preferred, falls back to conversationId
    const cacheKey = otherParticipantUsername ?? String(conversationData.conversation.id);

    // Seed from cache if available — avoids re-fetch on remount within the same session
    const cachedEntry = messageCache.get(cacheKey);

    const [message, setMessage] = useState("");
    const [allMessages, setAllMessages] = useState<ChatMessage[]>(
        cachedEntry ? cachedEntry.messages : [...conversationData.messages].reverse(),
    );
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [offset, setOffset] = useState(cachedEntry ? cachedEntry.cursor : conversationData.messages.length);
    const [hasMore, setHasMore] = useState(cachedEntry ? cachedEntry.hasMore : true);
    const [loadingMore, setLoadingMore] = useState(false);
    // Username of the participant currently typing, or null if nobody is.
    const [typingUser, setTypingUser] = useState<string | null>(null);
    // The message the user is currently replying to, or null if not replying.
    const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const firstLoadRef = useRef(true);
    const wsRef = useRef<WebSocket | null>(null);
    // Timeout handle to auto-clear the typing indicator after TYPING_TIMEOUT_MS
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
        const map = new Map<string | number, ChatMessage>();

        for (const item of [...existing, ...incoming]) {
            map.set(item.id, item);
        }

        return Array.from(map.values()).sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
    }

    useEffect(() => {
        const container = containerRef.current;

        if (!container) {
            return;
        }

        const loadOlderMessages = async () => {
            if (!hasMore || loadingMore || !otherParticipant) {
                return;
            }

            setLoadingMore(true);

            const previousScrollHeight = container.scrollHeight;

            const res = await fetch(
                `/api/chat/conversation/${otherParticipant.username}?limit=${MESSAGES_LIMIT}&offset=${offset}`,
                { credentials: "include" },
            );

            if (!res.ok) {
                setLoadingMore(false);
                return;
            }

            const data = await res.json();
            const olderMessages = [...data.messages].reverse();

            const reachedEnd = data.messages.length < MESSAGES_LIMIT;
            if (reachedEnd) {
                setHasMore(false);
            }

            setAllMessages((prev) => {
                const merged = mergeMessages(prev, olderMessages);
                // Persist the expanded list to cache
                messageCache.set(cacheKey, {
                    messages: merged,
                    cursor: (messageCache.get(cacheKey)?.cursor ?? prev.length) + data.messages.length,
                    hasMore: !reachedEnd,
                });
                return merged;
            });
            setOffset((prev) => prev + data.messages.length);

            requestAnimationFrame(() => {
                const newScrollHeight = container.scrollHeight;
                container.scrollTop = newScrollHeight - previousScrollHeight;
            });

            setLoadingMore(false);
        };

        const handleScroll = () => {
            if (container.scrollTop < 80 && !loadingMore && hasMore) {
                loadOlderMessages();
            }
        };

        container.addEventListener("scroll", handleScroll);

        return () => {
            container.removeEventListener("scroll", handleScroll);
        };
    }, [allMessages, hasMore, loadingMore, offset, otherParticipant]);

    useEffect(() => {
        // When the conversation changes, check cache before falling back to server data
        const cached = messageCache.get(cacheKey);
        if (cached) {
            setAllMessages(cached.messages);
            setOffset(cached.cursor);
            setHasMore(cached.hasMore);
        } else {
            setAllMessages([...conversationData.messages].reverse());
            setOffset(conversationData.messages.length);
            setHasMore(true);
            // Seed the cache with the initial data provided by the server
            messageCache.set(cacheKey, {
                messages: [...conversationData.messages].reverse(),
                cursor: conversationData.messages.length,
                hasMore: true,
            });
        }
        firstLoadRef.current = true;
        // Clear any active reply when switching conversations
        setReplyingTo(null);

        setDmNotifications((prev) =>
            prev.filter(
                (notification) =>
                    !(
                        (notification.type_msg === "NEW_DM_MESSAGE" ||
                            notification.type_msg === "chat_message") &&
                        notification.conversation_id === conversationData.conversation.id
                    ),
            ),
        );
    }, [conversationData, setDmNotifications]);

    useEffect(() => {
        if (firstLoadRef.current) {
            bottomRef.current?.scrollIntoView({ behavior: "auto" });
            firstLoadRef.current = false;
        }
    }, [allMessages.length]);

    useEffect(() => {
        if (!otherParticipantId || !otherParticipantUsername) {
            return;
        }

        const protocol = location.protocol === "https:" ? "wss" : "ws";
        const ws = new WebSocket(`${protocol}://${location.host}/ws/${conversationData.conversation.id}`);

        wsRef.current = ws;

        ws.onopen = () => {
            // Marcar como leídos todos los mensajes al abrir la conversación
            ws.send(JSON.stringify({ action: "mark_read" }));
        };

        ws.onmessage = (event) => {
            const raw = JSON.parse(event.data);

            if (raw.type_msg === "TYPING_START") {
                // Reset the auto-clear timer every time we receive a fresh typing event
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                setTypingUser(raw.username as string);
                typingTimeoutRef.current = setTimeout(() => {
                    setTypingUser(null);
                    typingTimeoutRef.current = null;
                }, TYPING_TIMEOUT_MS);
                return;
            }

            if (raw.type_msg === "MESSAGE_READ") {
                setAllMessages((prev) => {
                    const updated = prev.map((msg) =>
                        (raw.message_ids as number[]).includes(msg.id)
                            ? { ...msg, read_by: [...(msg.read_by ?? []), raw.reader_id as number] }
                            : msg,
                    );
                    const entry = messageCache.get(cacheKey);
                    if (entry) messageCache.set(cacheKey, { ...entry, messages: updated });
                    return updated;
                });
                return;
            }

            if (raw.type_msg === "MESSAGE_EDITED") {
                setAllMessages((prev) => {
                    const updated = prev.map((msg) =>
                        msg.id === raw.message_id
                            ? { ...msg, content: raw.content as string, edited_at: raw.edited_at as string }
                            : msg,
                    );
                    const entry = messageCache.get(cacheKey);
                    if (entry) messageCache.set(cacheKey, { ...entry, messages: updated });
                    return updated;
                });
                return;
            }

            if (raw.type_msg === "MESSAGE_DELETED") {
                setAllMessages((prev) => {
                    const updated = prev.map((msg) =>
                        msg.id === raw.message_id
                            ? { ...msg, is_deleted: true, content: "" }
                            : msg,
                    );
                    const entry = messageCache.get(cacheKey);
                    if (entry) messageCache.set(cacheKey, { ...entry, messages: updated });
                    return updated;
                });
                return;
            }

            if (raw.type_msg === "REACTION_UPDATE") {
                setAllMessages((prev) => {
                    const updated = prev.map((msg) =>
                        msg.id === (raw.message_id as number)
                            ? { ...msg, reactions: raw.reactions as ReactionCount[] }
                            : msg,
                    );
                    const entry = messageCache.get(cacheKey);
                    if (entry) messageCache.set(cacheKey, { ...entry, messages: updated });
                    return updated;
                });
                return;
            }

            // existing chat_message handling
            const data: ChatMessage = {
                id: raw.message_id,
                content: raw.content,
                sender_id: raw.from_user,
                created_at: new Date().toISOString(),
                reply_to_id: (raw.reply_to_id as number | undefined) ?? null,
                reply_to: raw.reply_to
                    ? (raw.reply_to as MessagePreview)
                    : null,
            };

            const container = containerRef.current;
            const isAtBottom =
                container && container.scrollHeight - container.scrollTop - container.clientHeight < 100;

            setAllMessages((prev) => {
                const updated = [...prev, data];
                messageCache.appendMessage(cacheKey, data);
                return updated;
            });

            // El usuario está viendo la conversación: marcar el nuevo mensaje como leído
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ action: "mark_read" }));
            }

            if (isAtBottom) {
                setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
            }
        };

        setSocket(ws);

        return () => {
            // Clean up typing timeout when unmounting or switching conversations
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
            }
            setTypingUser(null);

            wsRef.current = null;
            ws.onopen = null;
            ws.onmessage = null;
            ws.onclose = null;
            ws.onerror = null;
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close();
            }
            setSocket((prev) => (prev === ws ? null : prev));
        };
    }, [conversationData.conversation.id, otherParticipantId, otherParticipantUsername]);

    const handleSendMessage = () => {
        if (!message.trim() || !socket) {
            return;
        }

        const payload: Record<string, unknown> = { content: message };
        if (replyingTo) {
            payload.reply_to_id = replyingTo.id;
        }
        socket.send(JSON.stringify(payload));

        const newMessage: NewDmMessageNotification = {
            type_msg: "NEW_DM_MESSAGE",
            conversation_id: conversationData.conversation.id,
            from_user: user?.id ?? 0,
            to_user: otherParticipant?.id ?? 0,
            created_at: new Date().toISOString(),
            from_user_username: user?.username ?? "",
            from_user_image: user?.image ?? "",
            content: message,
        };

        setNewLastMessage((prev) => {
            const list = Array.isArray(prev) ? prev : [];
            const filtered = list.filter(
                (notification) => Number(notification.conversation_id) !== conversationData.conversation.id,
            );
            return [newMessage, ...filtered];
        });

        setReplyingTo(null);
        setMessage("");
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    };

    const sendEdit = useCallback((messageId: number, newContent: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
                JSON.stringify({
                    action: "edit",
                    message_id: messageId,
                    content: newContent,
                }),
            );
        }
    }, []);

    const sendDelete = useCallback((messageId: number) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
                JSON.stringify({
                    action: "delete",
                    message_id: messageId,
                }),
            );
        }
    }, []);

    const sendImageMessage = useCallback((url: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ content: url }));
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        }
    }, []);

    const sendTyping = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ action: "typing" }));
        }
    }, []);

    /// Calls the REST endpoint to toggle a reaction.
    /// The server will broadcast REACTION_UPDATE to all participants,
    /// so the UI update happens via the WS handler above.
    const toggleReaction = useCallback(async (messageId: number, emoji: string) => {
        try {
            const res = await fetch(`/api/chat/messages/${messageId}/reactions`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ emoji }),
            });
            if (!res.ok) {
                console.error("[useDmRoom] toggleReaction failed:", res.status);
            }
        } catch (err) {
            console.error("[useDmRoom] toggleReaction network error:", err);
        }
    }, []);

    return {
        allMessages,
        bottomRef,
        containerRef,
        currentUserId: user?.id,
        handleSendMessage,
        hasMore,
        isOnline,
        loadingMore,
        message,
        otherParticipant,
        replyingTo,
        sendDelete,
        sendEdit,
        sendImageMessage,
        sendTyping,
        setMessage,
        setReplyingTo,
        toggleReaction,
        typingUser,
    };
}
