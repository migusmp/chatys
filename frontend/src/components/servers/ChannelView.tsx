import { useEffect, useRef, useState } from "react";
import { useChannelSocket, type ChannelMessage } from "../../hooks/useChannelSocket";
import useServerStore from "../../stores/useServerStore";
import { useUserProfileContext } from "../../context/UserContext";
import chatStyles from "../pages/chats/css/ChatRoom.module.css";

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
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(isoString?: string | null): string {
    if (!isoString) return "";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── ChannelView ──────────────────────────────────────────────────────────────

export default function ChannelView() {
    const { user } = useUserProfileContext();
    const activeServer  = useServerStore((s) => s.activeServer);
    const activeChannel = useServerStore((s) => s.activeChannel);
    const members       = useServerStore((s) => s.members);
    const fetchMembers  = useServerStore((s) => s.fetchMembers);

    const [messages, setMessages] = useState<DisplayMessage[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [inputValue, setInputValue] = useState("");

    const chatAreaRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const prevMessageCountRef = useRef(0);

    // ── Member lookup (for resolving sender_id → username in history) ─────────
    const serverMembers = activeServer ? (members[activeServer.id] ?? []) : [];

    useEffect(() => {
        if (activeServer && serverMembers.length === 0) {
            fetchMembers(activeServer.id);
        }
    }, [activeServer?.id]);

    function resolveMember(senderId: number): { username: string; image?: string } {
        const member = serverMembers.find((m) => m.user_id === senderId);
        return {
            username: member?.username ?? `User ${senderId}`,
            image: member?.image,
        };
    }

    // ── Fetch message history on channel change ───────────────────────────────
    useEffect(() => {
        if (!activeChannel) {
            // Avoid extra re-render when messages is already empty
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

                // History comes newest-first from the backend — reverse for display
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
    }, [activeChannel?.id]);

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

    // ── Auto-scroll on new messages ───────────────────────────────────────────
    useEffect(() => {
        const el = chatAreaRef.current;
        if (!el) return;

        const newCount = messages.length;
        const prevCount = prevMessageCountRef.current;

        if (newCount > prevCount) {
            const addedAtEnd = newCount - prevCount === 1 || prevCount === 0;
            if (addedAtEnd) {
                el.scrollTop = el.scrollHeight;
            }
        }

        prevMessageCountRef.current = newCount;
    }, [messages]);

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
                    Select a channel to start chatting
                </p>
            </div>
        );
    }

    return (
        <div className={chatStyles.container}>
            {/* Header */}
            <div className={chatStyles.header}>
                <div className={chatStyles.headerLeft}>
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
            <div className={chatStyles.chatArea} ref={chatAreaRef}>
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
                        <span>No messages yet. Be the first to say something!</span>
                    </div>
                )}

                {messages.map((msg, index) => {
                    const isOwn = msg.sender_id === user?.id;
                    const msgKey = msg.id ?? index;

                    return (
                        <div
                            key={msgKey}
                            className={`${chatStyles.messageGroup} ${
                                isOwn ? chatStyles.messageGroupOwn : chatStyles.messageGroupOther
                            }`}
                        >
                            {!isOwn && (
                                <span className={chatStyles.messageSender}>{msg.username}</span>
                            )}
                            <div
                                className={`${chatStyles.bubble} ${
                                    isOwn ? chatStyles.bubbleOwn : chatStyles.bubbleOther
                                }`}
                            >
                                {msg.content}
                                <span
                                    className={`${chatStyles.bubbleTimestamp} ${
                                        !isOwn ? chatStyles.bubbleTimestampOther : ""
                                    }`}
                                >
                                    {formatTime(msg.created_at)}
                                </span>
                            </div>
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
                                    ? `Message #${activeChannel.name}…`
                                    : "Reconnecting…"
                            }
                            disabled={!connected}
                            maxLength={2000}
                        />
                    </div>
                    <button
                        className={chatStyles.sendBtn}
                        onClick={handleSend}
                        disabled={!connected || !inputValue.trim()}
                        aria-label="Send message"
                        type="button"
                    >
                        ↑
                    </button>
                </div>
            </div>
        </div>
    );
}
