import { useState } from "react";
import { useTranslation } from "react-i18next";
import useDmRoom from "../../../../../hooks/useDmRoom";
import type { FullConversation } from "../../../../../types/user";
import { OnlineIndicator } from "../OnlineIndicator";
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
    const [editingId, setEditingId] = useState<number | null>(null);

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
                                <div
                                    style={{
                                        position: "absolute",
                                        top: -28,
                                        right: 0,
                                        display: "flex",
                                        gap: 4,
                                        background: "#1a1a1a",
                                        border: "1px solid #333",
                                        borderRadius: 6,
                                        padding: "2px 6px",
                                        zIndex: 10,
                                    }}
                                >
                                    <button
                                        onClick={() => setEditingId(msg.id)}
                                        style={{
                                            background: "none",
                                            border: "none",
                                            color: "#aaa",
                                            cursor: "pointer",
                                            fontSize: 12,
                                            padding: "2px 4px",
                                        }}
                                        title="Editar"
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        onClick={() => sendDelete(msg.id)}
                                        style={{
                                            background: "none",
                                            border: "none",
                                            color: "#ff4444",
                                            cursor: "pointer",
                                            fontSize: 12,
                                            padding: "2px 4px",
                                        }}
                                        title="Eliminar"
                                    >
                                        🗑️
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
                            </div>
                        </div>
                    );
                })}
                <div ref={bottomRef}></div>
            </div>

            <div className={styles.inputSection}>
                <input
                    type="text"
                    placeholder="Escribe un mensaje..."
                    className={styles.messageInput}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && handleSendMessage()}
                />
                <button
                    className={styles.sendButton}
                    onClick={handleSendMessage}
                    disabled={!message.trim()}
                >
                    Enviar
                </button>
            </div>
        </div>
    );
}
