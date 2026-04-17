import { useEffect, useRef, useState } from "react";
import { useChannelSocket, type ChannelMessage } from "../../hooks/useChannelSocket";
import useServerStore from "../../stores/useServerStore";
import { useUserProfileContext } from "../../context/UserContext";
import chatStyles from "../pages/chats/css/ChatRoom.module.css";
import dmStyles from "../pages/dm/css/DmRoomDesktop.module.css";
import styles from "./css/ChannelView.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HistoryMessage {
    id: number;
    conversation_id: number;
    sender_id: number;
    content: string;
    created_at: string | null;
}

interface DisplayMessage {
    id: number;
    sender_id: number;
    username: string;
    image?: string;
    content: string;
    created_at: string | null;
    is_deleted?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(isoString?: string | null): string {
    if (!isoString) return "";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── ChannelView ──────────────────────────────────────────────────────────────

interface ChannelViewProps {
    onBack?: () => void;
}

export default function ChannelView({ onBack }: ChannelViewProps = {}) {
    const { user } = useUserProfileContext();
    const activeServer  = useServerStore((s) => s.activeServer);
    const activeChannel = useServerStore((s) => s.activeChannel);
    const members       = useServerStore((s) => s.members);
    const fetchMembers  = useServerStore((s) => s.fetchMembers);

    const [messages, setMessages] = useState<DisplayMessage[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const chatAreaRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const prevMessageCountRef = useRef(0);

    // ── Member lookup ─────────────────────────────────────────────────────────
    const serverMembers = activeServer ? (members[activeServer.id] ?? []) : [];

    const isAdmin = activeServer?.member_role === "owner" || activeServer?.member_role === "admin";

    useEffect(() => {
        if (activeServer && serverMembers.length === 0) {
            fetchMembers(activeServer.id);
        }
    }, [activeServer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    function resolveMember(senderId: number): { username: string; image?: string } {
        const member = serverMembers.find((m) => m.user_id === senderId);
        return {
            username: member?.username ?? `User ${senderId}`,
            image: member?.image,
        };
    }

    // ── Fetch history on channel change ───────────────────────────────────────
    useEffect(() => {
        if (!activeChannel) {
            setMessages((prev) => (prev.length > 0 ? [] : prev));
            return;
        }

        const controller = new AbortController();
        setIsLoadingHistory(true);
        setMessages([]);

        const load = async () => {
            try {
                const res = await fetch(
                    `/api/chat/messages/${activeChannel.conversation_id}?limit=50&offset=0`,
                    { credentials: "include", signal: controller.signal },
                );
                if (!res.ok) return;
                const history: HistoryMessage[] = await res.json();

                const display: DisplayMessage[] = history.reverse().map((m) => {
                    const { username, image } = resolveMember(m.sender_id);
                    return {
                        id: m.id,
                        sender_id: m.sender_id,
                        username,
                        image,
                        content: m.content,
                        created_at: m.created_at,
                    };
                });

                setMessages(display);
            } catch (e) {
                if (e instanceof DOMException && e.name === "AbortError") return;
                console.error("Error loading channel history:", e);
            } finally {
                setIsLoadingHistory(false);
            }
        };

        load();
        return () => controller.abort();
    }, [activeChannel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Real-time WebSocket messages ──────────────────────────────────────────
    const handleIncoming = (msg: ChannelMessage) => {
        setMessages((prev) => [
            ...prev,
            {
                id: msg.id,
                sender_id: msg.sender_id,
                username: msg.username,
                image: msg.image,
                content: msg.content,
                created_at: msg.created_at,
            },
        ]);
    };

    const { sendMessage, connected } = useChannelSocket(
        activeServer?.id ?? null,
        activeChannel?.id ?? null,
        handleIncoming,
    );

    // ── Auto-scroll ───────────────────────────────────────────────────────────
    useEffect(() => {
        const el = chatAreaRef.current;
        if (!el) return;

        const newCount = messages.length;
        const prevCount = prevMessageCountRef.current;

        if (newCount > prevCount) {
            const addedAtEnd = newCount - prevCount === 1 || prevCount === 0;
            if (addedAtEnd) el.scrollTop = el.scrollHeight;
        }

        prevMessageCountRef.current = newCount;
    }, [messages]);

    // ── Delete message ────────────────────────────────────────────────────────
    const handleDeleteMessage = async (messageId: number) => {
        if (!activeServer || !activeChannel) return;
        setDeletingId(messageId);
        try {
            const res = await fetch(
                `/api/servers/${activeServer.id}/channels/${activeChannel.id}/messages/${messageId}`,
                { method: "DELETE", credentials: "include" },
            );
            if (res.ok) {
                setMessages((prev) => prev.filter((m) => m.id !== messageId));
            }
        } finally {
            setDeletingId(null);
        }
    };

    // ── Input handlers ────────────────────────────────────────────────────────
    const handleSend = () => {
        const trimmed = inputValue.trim();
        if (!trimmed || !connected) return;
        sendMessage(trimmed);
        setInputValue("");
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // ── No channel selected ───────────────────────────────────────────────────
    if (!activeChannel) {
        return (
            <div className={chatStyles.noRoomSelected}>
                <div className={chatStyles.noRoomHero}>#</div>
                <h2 className={chatStyles.noRoomTitle}>Canales</h2>
                <p className={chatStyles.noRoomSubtitle}>
                    Seleccioná un canal para empezar a chatear
                </p>
            </div>
        );
    }

    return (
        <div className={chatStyles.container}>
            {/* Header */}
            <div className={chatStyles.header}>
                <div className={chatStyles.headerLeft}>
                    {onBack && (
                        <button
                            type="button"
                            className={chatStyles.backBtn}
                            onClick={onBack}
                            aria-label="Volver"
                        >
                            ‹
                        </button>
                    )}
                    <span className={chatStyles.roomHash}>#</span>
                    <span className={chatStyles.roomName}>{activeChannel.name}</span>
                </div>
                <div className={chatStyles.headerRight}>
                    <span className={connected ? chatStyles.connectedLabel : chatStyles.disconnectedLabel}>
                        {connected ? "connected" : "reconnecting…"}
                    </span>
                </div>
            </div>

            {/* Messages */}
            <div className={dmStyles.chatArea} ref={chatAreaRef}>
                {isLoadingHistory && (
                    <div className={chatStyles.historyLoading}>
                        <span className={chatStyles.historyLoadingDot} />
                        <span className={chatStyles.historyLoadingDot} />
                        <span className={chatStyles.historyLoadingDot} />
                    </div>
                )}

                {messages.length === 0 && !isLoadingHistory && (
                    <div className={chatStyles.emptyChatState}>
                        <span className={chatStyles.emptyChatIcon}>💬</span>
                        <span>No hay mensajes aún. ¡Sé el primero!</span>
                    </div>
                )}

                {messages.map((msg, index) => {
                    const isOwn = msg.sender_id === user?.id;
                    const canDelete = isAdmin || isOwn;
                    const msgKey = msg.id ?? index;

                    return (
                        <div
                            key={msgKey}
                            className={`${dmStyles.messageBubble} ${
                                isOwn ? dmStyles.ownMessage : dmStyles.otherMessage
                            } ${styles.msgRow}`}
                            style={{ position: "relative" }}
                        >
                            <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
                                {!isOwn && (
                                    <span className={chatStyles.messageSender}>{msg.username}</span>
                                )}
                                <div className={dmStyles.messageRow}>
                                    <span className={dmStyles.messageText}>{msg.content}</span>
                                    <span className={dmStyles.messageTime}>
                                        {formatTime(msg.created_at)}
                                    </span>
                                </div>
                            </div>

                            {canDelete && (
                                <button
                                    type="button"
                                    className={styles.deleteBtn}
                                    title="Eliminar mensaje"
                                    disabled={deletingId === msg.id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteMessage(msg.id);
                                    }}
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Input */}
            <div className={chatStyles.inputArea}>
                <div className={chatStyles.inputBar}>
                    <div className={chatStyles.inputPill}>
                        <input
                            ref={inputRef}
                            className={chatStyles.textInput}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={
                                connected
                                    ? `Mensaje #${activeChannel.name}…`
                                    : "Reconectando…"
                            }
                            disabled={!connected}
                            maxLength={2000}
                        />
                    </div>
                    <button
                        className={chatStyles.sendBtn}
                        onClick={handleSend}
                        disabled={!connected || !inputValue.trim()}
                        aria-label="Enviar"
                        type="button"
                    >
                        ↑
                    </button>
                </div>
            </div>
        </div>
    );
}
