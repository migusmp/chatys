import { useNavigate, useLocation } from "react-router-dom";
import type { Conversations } from "../../../../../types/user";
import { OnlineIndicator } from "../OnlineIndicator";
import {
    useNotificationsContext,
    useUserProfileContext,
} from "../../../../../context/UserContext";
import { mergeDmsWithRealtimeMessages } from "./realtimeDmList";
import styles from "../../css/SidebarDms.module.css";

type Props = { dms: Conversations[] };

function formatTimestamp(isoString: string): string {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    if (diffDays === 1) {
        return "ayer";
    }
    if (diffDays < 7) {
        return date.toLocaleDateString([], { weekday: "short" });
    }
    return date.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
}

export default function SidebarDmsMobile({ dms }: Props) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useUserProfileContext();
    const { newLastMessage, dmNotifications } = useNotificationsContext();

    const [, route, currentUsername] = location.pathname.split("/");

    const dmsWithUpdatedMessages = mergeDmsWithRealtimeMessages(dms, newLastMessage);

    const sortedDms = [...dmsWithUpdatedMessages].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    return (
        <div className={`${styles.sidebar} ${styles.sidebarMobile}`}>
            <ul className={styles.list}>
                {sortedDms.filter((dm) => dm.participants[0] != null).map((dm) => {
                    const userOther = dm.participants[0];
                    const isLastMessageFromCurrentUser = dm.last_message_user_id === user?.id;
                    const lastMessageText = dm.last_message
                        ? (isLastMessageFromCurrentUser ? `Tú: ${dm.last_message}` : dm.last_message)
                        : "";

                    const unreadCount = dmNotifications.filter(
                        n =>
                            (n.type_msg === "NEW_DM_MESSAGE" || n.type_msg === "chat_message") &&
                            n.conversation_id === dm.conversation_id &&
                            !(route === "dm" && currentUsername === userOther.username)
                    ).length;

                    const isSelected = route === "dm" && currentUsername === userOther.username;
                    const timestamp = formatTimestamp(dm.updated_at);

                    return (
                        <li
                            key={dm.conversation_id}
                            onClick={() => navigate(`/dm/${userOther.username}`)}
                            className={`${styles.item} ${isSelected ? styles.itemActive : ""}`}
                        >
                            <div className={styles.avatarWrapper}>
                                <img
                                    src={`/media/user/${userOther.image}`}
                                    alt={userOther.username}
                                    className={styles.avatar}
                                />
                                <OnlineIndicator userId={userOther.id} isHeader={false} />
                            </div>

                            <div className={styles.content}>
                                <div className={styles.topRow}>
                                    <span className={styles.username}>{userOther.username}</span>
                                    {timestamp && (
                                        <span className={styles.timestamp}>{timestamp}</span>
                                    )}
                                </div>
                                <div className={lastMessageText ? styles.preview : `${styles.preview} ${styles.previewEmpty}`}>
                                    {lastMessageText || "Sin mensajes"}
                                </div>
                            </div>

                            {unreadCount > 0 && (
                                <span className={styles.badge}>
                                    {unreadCount > 9 ? "9+" : unreadCount}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
