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
        setMessage,
    } = useDmRoom(conversationData);

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

                    return (
                        <div
                            key={msg.id}
                            className={`${styles.messageBubble} ${
                                msg.sender_id === currentUserId
                                    ? styles.ownMessage
                                    : styles.otherMessage
                            }`}
                        >
                            <div className={styles.messageRow}>
                                <span className={styles.messageText}>{msg.content}</span>
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
