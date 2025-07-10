import { useUserContext } from "../../../../../context/UserContext";
import type { FullConversation } from "../../../../../types/user";
import { OnlineIndicator } from "../OnlineIndicator";
import styles from "../../css/DmRoomDesktop.module.css";
import { useTranslation } from "react-i18next";
import { useState } from "react";

type Props = {
    conversationData: FullConversation;
};

export default function DmRoomDesktop({ conversationData }: Props) {
    const { user, checkUserIsOnline } = useUserContext();
    const { t } = useTranslation();
    const [message, setMessage] = useState("");
    const handleSendMessage = () => {
        if (!message.trim()) return;
        // lógica para enviar el mensaje...
        console.log("Enviado:", message);
        setMessage("");
    };


    const otherParticipant = conversationData.conversation.participants.find(
        (p) => p.id !== user?.id
    );

    const isOnline = checkUserIsOnline(otherParticipant?.id ?? -1);

    if (!otherParticipant) return null;

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
                            {isOnline ? t("directMessages.userDm.connected") : t("directMessages.userDm.disconnected")}
                        </span>
                    </div>
                </div>
            </header>

            <div className={styles.chatArea}>
                {conversationData.messages.map((msg) => {
                    const isOwn = msg.sender_id === user?.id;
                    const time = new Date(msg.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                    });

                    return (
                        <div
                            key={msg.id}
                            className={`${styles.messageBubble} ${isOwn ? styles.ownMessage : styles.otherMessage}`}
                        >
                            <div className={styles.messageRow}>
                                <span className={styles.messageText}>{msg.content}</span>
                                <span className={styles.messageTime}>{time}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className={styles.inputSection}>
                <input
                    type="text"
                    placeholder="Escribe un mensaje..."
                    className={styles.messageInput}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") handleSendMessage();
                    }}
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
