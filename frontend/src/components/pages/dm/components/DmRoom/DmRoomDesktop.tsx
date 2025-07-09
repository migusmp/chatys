import { useUserContext } from "../../../../../context/UserContext";
import type { FullConversation } from "../../../../../types/user";
import { OnlineIndicator } from "../OnlineIndicator";
import styles from "../../css/DmRoomDesktop.module.css";
import { useTranslation } from "react-i18next";

type Props = {
    conversationData: FullConversation;
};

export default function DmRoomDesktop({ conversationData }: Props) {
    const { user, checkUserIsOnline } = useUserContext();
    const { t } = useTranslation();

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
                Esta es la versión de escritorio del chat.
            </div>
        </div>
    );
}
