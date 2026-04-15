import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import EmojiPicker from "../../../../EmojiPicker";
import MessageReactions from "../../../../MessageReactions";
import useDmRoom from "../../../../../hooks/useDmRoom";
import type { FullConversation } from "../../../../../types/user";
import type { ChatMessage } from "../../../../../types/chat_message";
import { OnlineIndicator } from "../OnlineIndicator";
import { ReadReceipt } from "./ReadReceipt";
import styles from "../../css/DmRoomDesktop.module.css";

// Minimum gap (ms) between outgoing typing events sent to the server.
const TYPING_DEBOUNCE_MS = 2000;
// Debounce delay (ms) before firing a search request after the user stops typing.
const SEARCH_DEBOUNCE_MS = 300;
// Maximum characters allowed in a search query.
const MAX_SEARCH_QUERY_LEN = 200;

type Props = {
    conversationData: FullConversation;
};

/** Highlights all case-insensitive occurrences of `term` inside `text`. */
function highlightMatch(text: string, term: string): React.ReactNode {
    if (!term) return text;
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
        regex.test(part)
            ? <mark key={i} className={styles.searchResultHighlight}>{part}</mark>
            : part
    );
}

export default function DmRoomDesktop({ conversationData }: Props) {
    const { t } = useTranslation();
    const {
        allMessages,
        bottomRef,
        containerRef,
        currentUserId,
        handleSendMessage,
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
    } = useDmRoom(conversationData);

    const [hoveredId, setHoveredId] = useState<number | null>(null);
    const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
    const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    const [editingId, setEditingId] = useState<number | null>(null);
    const [highlightedId, setHighlightedId] = useState<number | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const emojiPickerRef = useRef<HTMLDivElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const messageInputRef = useRef<HTMLInputElement | null>(null);
    // Tracks the last time we sent a typing event so we debounce outgoing signals
    const lastTypingSentRef = useRef(0);

    // ── Search state ──────────────────────────────────────────────────────────
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (menuOpenId === null) return;
        const handleOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpenId(null);
            }
        };
        document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, [menuOpenId]);

    useEffect(() => {
        if (!showEmojiPicker) return;
        const handleOutside = (e: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
                setShowEmojiPicker(false);
            }
        };
        document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, [showEmojiPicker]);

    // Focus the search input when the bar opens
    useEffect(() => {
        if (searchOpen) {
            searchInputRef.current?.focus();
        }
    }, [searchOpen]);

    // Clear results when the search bar is closed
    useEffect(() => {
        if (!searchOpen) {
            setSearchQuery("");
            setSearchResults([]);
        }
    }, [searchOpen]);

    // Focus the message input after selecting a reply target
    useEffect(() => {
        if (replyingTo) {
            messageInputRef.current?.focus();
        }
    }, [replyingTo]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";

        const formData = new FormData();
        formData.append("image", file);

        try {
            const res = await fetch("/api/chat/messages/upload", {
                method: "POST",
                credentials: "include",
                body: formData,
            });
            if (!res.ok) return;
            const data = await res.json();
            sendImageMessage(data.data.url as string);
        } catch (err) {
            console.error("[DmRoomDesktop] image upload failed:", err);
        }
    };

    const handleEmojiSelect = (emoji: string) => {
        setMessage((prev) => prev + emoji);
        setShowEmojiPicker(false);
        messageInputRef.current?.focus();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setMessage(e.target.value);

        // Send at most one typing event every TYPING_DEBOUNCE_MS to avoid flooding
        const now = Date.now();
        if (now - lastTypingSentRef.current >= TYPING_DEBOUNCE_MS) {
            lastTypingSentRef.current = now;
            sendTyping();
        }
    };

    const handleSearchQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchQuery(value);

        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

        const trimmed = value.trim();
        if (!trimmed || trimmed.length > MAX_SEARCH_QUERY_LEN) {
            setSearchResults([]);
            return;
        }

        searchDebounceRef.current = setTimeout(async () => {
            if (!otherParticipant) return;
            setSearchLoading(true);
            try {
                const res = await fetch(
                    `/api/chat/conversation/${encodeURIComponent(otherParticipant.username)}/search?q=${encodeURIComponent(trimmed)}`,
                    { credentials: "include" }
                );
                if (!res.ok) {
                    setSearchResults([]);
                    return;
                }
                const json = await res.json();
                setSearchResults(json.data ?? []);
            } catch (err) {
                console.error("[DmRoomDesktop] search failed:", err);
                setSearchResults([]);
            } finally {
                setSearchLoading(false);
            }
        }, SEARCH_DEBOUNCE_MS);
    };

    const closeSearch = () => {
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        setSearchOpen(false);
    };

    const scrollToMessage = (msgId: number) => {
        const el = document.getElementById(`msg-${msgId}`);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedId(msgId);
        setTimeout(() => setHighlightedId(null), 1500);
    };

    if (!otherParticipant) {
        return null;
    }

    const showResultsPanel = searchOpen && searchQuery.trim().length > 0;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.userInfo}>
                    <div className={styles.avatarWrapper}>
                        <img
                            src={`/media/user/${otherParticipant.image}`}
                            alt={otherParticipant.username}
                            className={styles.avatar}
                        />
                        <OnlineIndicator userId={otherParticipant.id} isHeader={true} />
                    </div>
                    <div className={styles.userText}>
                        <span className={styles.username}>{otherParticipant.username}</span>
                        <span className={isOnline ? styles.online : styles.offline}>
                            {isOnline
                                ? t("directMessages.userDm.connected")
                                : t("directMessages.userDm.disconnected")}
                        </span>
                    </div>
                </div>

                {/* Search toggle button */}
                <button
                    type="button"
                    className={`${styles.searchToggleBtn}${searchOpen ? ` ${styles.active}` : ""}`}
                    aria-label={searchOpen ? "Cerrar búsqueda" : "Buscar mensajes"}
                    onClick={() => setSearchOpen((prev) => !prev)}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" />
                    </svg>
                </button>
            </header>

            {/* Search bar — only rendered when open */}
            {searchOpen && (
                <div className={styles.searchBar}>
                    <input
                        ref={searchInputRef}
                        type="text"
                        className={styles.searchInput}
                        placeholder="Buscar mensajes..."
                        value={searchQuery}
                        onChange={handleSearchQueryChange}
                        maxLength={MAX_SEARCH_QUERY_LEN}
                        onKeyDown={(e) => e.key === "Escape" && closeSearch()}
                    />
                    <button
                        type="button"
                        className={styles.searchCloseBtn}
                        aria-label="Cerrar búsqueda"
                        onClick={closeSearch}
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Search results panel */}
            {showResultsPanel && (
                <div className={styles.searchResults}>
                    {searchLoading ? (
                        <div className={styles.searchResultsEmpty}>Buscando…</div>
                    ) : searchResults.length === 0 ? (
                        <div className={styles.searchResultsEmpty}>Sin resultados para "{searchQuery}"</div>
                    ) : (
                        searchResults.map((msg) => {
                            const time = msg.created_at
                                ? new Date(msg.created_at).toLocaleString([], {
                                    day: "2-digit",
                                    month: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })
                                : "";
                            const isOwn = msg.sender_id === currentUserId;
                            return (
                                <div
                                    key={msg.id}
                                    className={styles.searchResultItem}
                                    onClick={() => { closeSearch(); setTimeout(() => scrollToMessage(msg.id), 80); }}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => { if (e.key === "Enter") { closeSearch(); setTimeout(() => scrollToMessage(msg.id), 80); } }}
                                >
                                    <div className={styles.searchResultMeta}>
                                        <span className={styles.searchResultSender}>
                                            {isOwn ? "Tú" : otherParticipant.username}
                                        </span>
                                        <span>{time}</span>
                                    </div>
                                    <div className={styles.searchResultContent}>
                                        {highlightMatch(msg.content, searchQuery.trim())}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            <div className={styles.chatArea} ref={containerRef}>
                {loadingMore && (
                    <div className={styles.loaderWrapper}>
                        <div className={styles.loader}></div>
                    </div>
                )}

                {allMessages.map((msg) => {
                    const time = new Date(msg.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                    });

                    const isOwn = msg.sender_id === currentUserId;
                    const isRead = isOwn && (msg.read_by?.includes(otherParticipant.id) ?? false);

                    return (
                        <div
                            key={msg.id}
                            id={`msg-${msg.id}`}
                            onMouseEnter={() => setHoveredId(msg.id)}
                            onMouseLeave={() => setHoveredId(null)}
                            className={`${styles.messageBubble} ${
                                isOwn ? styles.ownMessage : styles.otherMessage
                            }${highlightedId === msg.id ? ` ${styles.messageHighlighted}` : ""}`}
                            style={{ position: "relative" }}
                        >
                            {hoveredId === msg.id && !msg.is_deleted && (
                                <button
                                    className={styles.menuTrigger}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (menuOpenId === msg.id) {
                                            setMenuOpenId(null);
                                            return;
                                        }
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const menuWidth = 180;
                                        const menuHeight = 280;
                                        const left = rect.right + menuWidth > window.innerWidth
                                            ? rect.left - menuWidth
                                            : rect.right;
                                        const top = rect.top - menuHeight < 0
                                            ? rect.bottom
                                            : rect.top - menuHeight;
                                        setMenuPos({ top, left });
                                        setMenuOpenId(msg.id);
                                    }}
                                    aria-label="Opciones"
                                >
                                    ⋮
                                </button>
                            )}

                            {menuOpenId === msg.id && (
                                <div
                                    ref={menuRef}
                                    className={styles.contextMenu}
                                    style={{ position: "fixed", top: menuPos.top, left: menuPos.left, bottom: "auto", right: "auto" }}
                                >
                                    {/* Quick reaction row */}
                                    <div className={styles.contextMenuReactionRow}>
                                        {["👍", "❤️", "😂", "😮", "😢", "🔥"].map((emoji) => {
                                            const alreadyReacted = (msg.reactions ?? []).some(
                                                (r) => r.emoji === emoji && r.reacted_by_me
                                            );
                                            return (
                                                <button
                                                    key={emoji}
                                                    type="button"
                                                    className={`${styles.contextMenuReactionBtn}${alreadyReacted ? ` ${styles.contextMenuReactionBtnActive}` : ""}`}
                                                    aria-label={emoji}
                                                    onClick={() => {
                                                        toggleReaction(msg.id, emoji);
                                                        setMenuOpenId(null);
                                                    }}
                                                >
                                                    {emoji}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {/* Reply — available for all non-deleted messages */}
                                    <button
                                        className={styles.contextMenuItem}
                                        onClick={() => {
                                            setReplyingTo(msg);
                                            setMenuOpenId(null);
                                        }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                                            <path d="M6.598 5.013a.144.144 0 0 1 .202.134V6.3a.5.5 0 0 0 .5.5c.667 0 2.013.005 3.3.822.984.624 1.99 1.76 2.595 3.876-1.02-.983-2.185-1.516-3.205-1.799a8.7 8.7 0 0 0-1.445-.252 7 7 0 0 0-.5-.01h-.126l-.003.001a.5.5 0 0 0-.5.5v1.152c0 .12-.07.226-.18.283L6.598 12.9A.144.144 0 0 1 6.4 12.77V5.23a.144.144 0 0 1 .198-.217" />
                                            <path d="M5 0a.5.5 0 0 1 .5.5v15a.5.5 0 0 1-1 0V.5A.5.5 0 0 1 5 0" />
                                        </svg>
                                        Responder
                                    </button>
                                    {isOwn && (
                                        <>
                                            <button
                                                className={styles.contextMenuItem}
                                                onClick={() => {
                                                    setEditingId(msg.id);
                                                    setMenuOpenId(null);
                                                }}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                                                    <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                                                </svg>
                                                Editar
                                            </button>
                                            <button
                                                className={`${styles.contextMenuItem} ${styles.contextMenuItemDanger}`}
                                                onClick={() => {
                                                    sendDelete(msg.id);
                                                    setMenuOpenId(null);
                                                }}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                                                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
                                                    <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
                                                </svg>
                                                Eliminar
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}

                            <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
                                {/* Quoted block — rendered above the message text when this is a reply */}
                                {msg.reply_to && !msg.is_deleted && (
                                    <div
                                        className={styles.quotedMessage}
                                        style={{ cursor: "pointer" }}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => msg.reply_to_id != null && scrollToMessage(msg.reply_to_id)}
                                        onKeyDown={(e) => e.key === "Enter" && msg.reply_to_id != null && scrollToMessage(msg.reply_to_id)}
                                    >
                                        <div className={styles.quotedMessageAuthor}>
                                            {msg.reply_to.sender_username}
                                        </div>
                                        <div className={styles.quotedMessageContent}>
                                            {msg.reply_to.content}
                                        </div>
                                    </div>
                                )}

                                <div className={styles.messageRow}>
                                    {msg.is_deleted ? (
                                        <span
                                            style={{
                                                opacity: 0.4,
                                                fontStyle: "italic",
                                            }}
                                        >
                                            Mensaje eliminado
                                        </span>
                                    ) : editingId === msg.id ? (
                                        <input
                                            autoFocus
                                            defaultValue={msg.content}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && e.currentTarget.value.trim()) {
                                                    sendEdit(msg.id, e.currentTarget.value.trim());
                                                    setEditingId(null);
                                                }
                                                if (e.key === "Escape") setEditingId(null);
                                            }}
                                            style={{
                                                background: "#222",
                                                color: "#fff",
                                                border: "1px solid #444",
                                                borderRadius: 4,
                                                padding: "2px 6px",
                                                width: "100%",
                                            }}
                                        />
                                    ) : (
                                        <>
                                            {msg.content.startsWith("/media/messages/") ? (
                                                <div className={styles.imageWrapper}>
                                                    <img
                                                        src={msg.content}
                                                        alt="imagen"
                                                        className={styles.messageImage}
                                                        loading="lazy"
                                                    />
                                                    <a
                                                        href={msg.content}
                                                        download
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={styles.downloadBtn}
                                                        aria-label="Descargar imagen"
                                                    >
                                                        ⬇
                                                    </a>
                                                </div>
                                            ) : (
                                                <span className={styles.messageText}>{msg.content}</span>
                                            )}
                                            {msg.edited_at && (
                                                <span
                                                    style={{
                                                        fontSize: "10px",
                                                        opacity: 0.4,
                                                        marginLeft: 4,
                                                    }}
                                                >
                                                    (editado)
                                                </span>
                                            )}
                                        </>
                                    )}
                                    <span className={styles.messageTime}>{time}</span>
                                    {isOwn && !msg.is_deleted && (
                                        <ReadReceipt isRead={isRead} />
                                    )}
                                </div>
                            </div>

                            {!msg.is_deleted && (
                                <MessageReactions
                                    messageId={msg.id}
                                    reactions={msg.reactions ?? []}
                                    currentUserId={currentUserId}
                                    onToggle={toggleReaction}
                                    visible={hoveredId === msg.id}
                                />
                            )}
                        </div>
                    );
                })}
                <div ref={bottomRef}></div>
            </div>

            <div className={styles.inputSection}>
                {typingUser && (
                    <div className={styles.typingIndicator}>
                        {typingUser} está escribiendo…
                    </div>
                )}

                {/* Reply preview bar — shown when the user has selected a message to reply to */}
                {replyingTo && (
                    <div className={styles.replyPreviewBar}>
                        <span className={styles.replyPreviewText}>
                            <span className={styles.replyPreviewAuthor}>
                                {replyingTo.sender_id === currentUserId ? "Tú" : otherParticipant.username}
                            </span>
                            {replyingTo.content}
                        </span>
                        <button
                            type="button"
                            className={styles.replyPreviewCancelBtn}
                            aria-label="Cancelar respuesta"
                            onClick={() => setReplyingTo(null)}
                        >
                            ✕
                        </button>
                    </div>
                )}

                <div className={styles.inputRow}>
                    <div className={styles.inputPill} style={{ position: "relative" }}>
                        <div ref={emojiPickerRef} style={{ position: "relative" }}>
                            {showEmojiPicker && <EmojiPicker onSelect={handleEmojiSelect} />}
                            <button
                                type="button"
                                className={styles.iconButton}
                                aria-label="Emoji"
                                onClick={() => setShowEmojiPicker((prev) => !prev)}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="#0f6" viewBox="0 0 16 16">
                                    <path d="M4.968 9.75a.5.5 0 1 0-.866.5A4.5 4.5 0 0 0 8 12.5a4.5 4.5 0 0 0 3.898-2.25.5.5 0 1 0-.866-.5A3.5 3.5 0 0 1 8 11.5a3.5 3.5 0 0 1-3.032-1.75M7 5.116V5a1 1 0 0 0-1-1H3.28a1 1 0 0 0-.97 1.243l.311 1.242A2 2 0 0 0 4.561 8H5a2 2 0 0 0 1.994-1.839A3 3 0 0 1 8 6c.393 0 .74.064 1.006.161A2 2 0 0 0 11 8h.438a2 2 0 0 0 1.94-1.515l.311-1.242A1 1 0 0 0 12.72 4H10a1 1 0 0 0-1 1v.116A4.2 4.2 0 0 0 8 5c-.35 0-.69.04-1 .116" />
                                    <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-1 0A7 7 0 1 0 1 8a7 7 0 0 0 14 0" />
                                </svg>
                            </button>
                        </div>
                        <input
                            ref={messageInputRef}
                            type="text"
                            placeholder="Escribí un mensaje..."
                            className={styles.messageInput}
                            value={message}
                            onChange={handleInputChange}
                            onKeyDown={(event) => event.key === "Enter" && handleSendMessage()}
                        />
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: "none" }}
                            onChange={handleImageUpload}
                        />
                        <button
                            type="button"
                            className={styles.iconButton}
                            aria-label="Adjuntar"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="#0f6" viewBox="0 0 16 16">
                                <path d="M4.5 3a2.5 2.5 0 0 1 5 0v9a1.5 1.5 0 0 1-3 0V5a.5.5 0 0 1 1 0v7a.5.5 0 0 0 1 0V3a1.5 1.5 0 1 0-3 0v9a2.5 2.5 0 0 0 5 0V5a.5.5 0 0 1 1 0v7a3.5 3.5 0 1 1-7 0z" />
                            </svg>
                        </button>
                        <button type="button" className={styles.iconButton} aria-label="Audio">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="#0f6" viewBox="0 0 16 16">
                                <path d="M3.5 6.5A.5.5 0 0 1 4 7v1a4 4 0 0 0 8 0V7a.5.5 0 0 1 1 0v1a5 5 0 0 1-4.5 4.975V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 .5-.5" />
                                <path d="M10 8a2 2 0 1 1-4 0V3a2 2 0 1 1 4 0zM8 0a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V3a3 3 0 0 0-3-3" />
                            </svg>
                        </button>
                    </div>
                    <button
                        className={styles.sendButton}
                        onClick={handleSendMessage}
                        disabled={!message.trim()}
                        aria-label="Enviar mensaje"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="#000" viewBox="0 0 16 16">
                            <path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11ZM6.636 10.07l2.761 4.338L14.13 2.576zm6.787-8.201L1.591 6.602l4.339 2.76z" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
