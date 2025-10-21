import { useTranslation } from "react-i18next";
import { useUserContext } from "../../../context/UserContext";
import type { Notification } from "../../../interfaces/notifications";
import FriendRequestNotification from "./components/FriendRequestNotification";
// import ChatMessageNotification from "./components/ChatMessageNotification";
import styles from './css/Notifications.module.css';
// import ChatMessageNotificationRealTime from "./components/ChatMessageNotificationRealTime";

export default function Notifications() {
    const { notifications } = useUserContext();
    const { t } = useTranslation();

    const renderNotification = (n: Notification) => {
        switch (n.type_msg) {
            case 'FR':
            case 'friend_request':
                return <FriendRequestNotification n={n} />;

            // case 'chat_message':
            //   return <ChatMessageNotification n={n} />;

            // case 'NEW_DM_MESSAGE':
            //   return <ChatMessageNotificationRealTime n={n} />;

            default:
                return <p>🔔 Unknown notification type</p>;
        }
    };

    return (
        <div className={styles.container}>
            {notifications.length === 0 ? (
                <p className={styles.empty}>{t('notifications.noNotifications')}</p>
            ) : (
                <ul className={styles.list}>
                    {[...notifications]
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .map((n, idx) => (
                            <li
                                key={"id" in n ? n.id : "message_id" in n ? n.message_id : idx}
                                className={styles.notificationItem}
                            >
                                {renderNotification(n)}
                            </li>
                        ))}
                </ul>
            )}
        </div>
    );
}
