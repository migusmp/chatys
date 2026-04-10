import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import useDmRoom from "../../../../../hooks/useDmRoom";
import type { FullConversation } from "../../../../../types/user";
import { OnlineIndicator } from "../OnlineIndicator";
import { ReadReceipt } from "./ReadReceipt";
import styles from "../../css/DmRoomDesktop.module.css";

type Props = {
    conversationData: FullConversation;
};

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
        sendDelete,
        sendEdit,
        setMessage,
    } = useDmRoom(conversationData);

    const [hoveredId, setHoveredId] = useState<number | null>(null);
    const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);

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

    if (!otherParticipant) {
        return null;
    }

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
            </header>

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
                            onMouseEnter={() => setHoveredId(msg.id)}
                            onMouseLeave={() => setHoveredId(null)}
                            className={`${styles.messageBubble} ${
                                isOwn ? styles.ownMessage : styles.otherMessage
                            }`}
                            style={{ position: "relative" }}
                        >
                            {hoveredId === msg.id && !msg.is_deleted && isOwn && (
                                <button
                                    className={styles.menuTrigger}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setMenuOpenId((prev) => (prev === msg.id ? null : msg.id));
                                    }}
                                    aria-label="Opciones"
                                >
                                    ⋮
                                </button>
                            )}

                            {menuOpenId === msg.id && (
                                <div ref={menuRef} className={styles.contextMenu}>
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
                                        <span className={styles.messageText}>{msg.content}</span>
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
                    );
                })}
                <div ref={bottomRef}></div>
            </div>

            <div className={styles.inputSection}>
                <div className={styles.inputPill}>
                    <button type="button" className={styles.iconButton} aria-label="Emoji">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="#0f6" viewBox="0 0 16 16">
                            <path d="M4.968 9.75a.5.5 0 1 0-.866.5A4.5 4.5 0 0 0 8 12.5a4.5 4.5 0 0 0 3.898-2.25.5.5 0 1 0-.866-.5A3.5 3.5 0 0 1 8 11.5a3.5 3.5 0 0 1-3.032-1.75M7 5.116V5a1 1 0 0 0-1-1H3.28a1 1 0 0 0-.97 1.243l.311 1.242A2 2 0 0 0 4.561 8H5a2 2 0 0 0 1.994-1.839A3 3 0 0 1 8 6c.393 0 .74.064 1.006.161A2 2 0 0 0 11 8h.438a2 2 0 0 0 1.94-1.515l.311-1.242A1 1 0 0 0 12.72 4H10a1 1 0 0 0-1 1v.116A4.2 4.2 0 0 0 8 5c-.35 0-.69.04-1 .116" />
                            <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-1 0A7 7 0 1 0 1 8a7 7 0 0 0 14 0" />
                        </svg>
                    </button>
                    <input
                        type="text"
                        placeholder="Escribí un mensaje..."
                        className={styles.messageInput}
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        onKeyDown={(event) => event.key === "Enter" && handleSendMessage()}
                    />
                    <button type="button" className={styles.iconButton} aria-label="Adjuntar">
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
    );
}
