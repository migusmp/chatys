import { Link } from "react-router-dom";
import { type FriendRequestNotification, type Notification } from "../../../../interfaces/notifications";
import styles from '../css/Notifications.module.css';
import useUser from "../../../../hooks/useUser";
import { useNotificationsContext } from "../../../../context/UserContext";
import { formatDistanceToNow, type Locale } from 'date-fns';
import { es, enUS, fr } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useState } from "react";

interface Props {
    n: FriendRequestNotification;
}

const localeMap: Record<string, Locale> = {
    en: enUS,
    es: es,
    fr: fr,
};



export default function FriendRequestNotification({ n }: Props) {
    const { i18n } = useTranslation();
    const currentLocale = localeMap[i18n.language] || enUS;

    const { t } = useTranslation();

    const { rejectFriendRequest, acceptFriendRequest } = useUser();
    const { setNotifications } = useNotificationsContext();

    const [relativeTime, setRelativeTime] = useState("");

    // Convertir la fecha solo una vez
    const createdDate = useMemo(() => new Date(n.created_at), [n.created_at]);

    useEffect(() => {
        if (isNaN(createdDate.getTime())) return;

        function update() {
            setRelativeTime(formatDistanceToNow(createdDate, { addSuffix: true, locale: currentLocale }));
        }

        update(); // primer render inmediato

        const now = new Date();
        const diffMs = now.getTime() - createdDate.getTime();
        const diffMinutes = diffMs / 1000 / 60;

        // Determinar intervalo de actualización
        let intervalMs = 60_000; // por defecto cada minuto
        if (diffMinutes >= 60) intervalMs = 60 * 60 * 1000; // si ya pasó una hora, cada hora
        else if (diffMinutes < 1) intervalMs = 5_000; // si es muy reciente, actualiza más seguido

        const interval = setInterval(update, intervalMs);

        return () => clearInterval(interval);
    }, [createdDate]);

    async function handleRejectButtonClick() {
        await rejectFriendRequest(n.id);
        setNotifications((prev: Notification[]) =>
            prev.filter(notification =>
                (notification.type_msg !== 'FR' && notification.type_msg !== 'friend_request') || notification.id !== n.id
            )
        );
    }

    async function handleAcceptButtonClick() {
        await acceptFriendRequest(n.sender_id);
        setNotifications((prev: Notification[]) =>
            prev.filter(notification =>
                (notification.type_msg !== 'FR' && notification.type_msg !== 'friend_request') || notification.id !== n.id
            )
        );
    }

    if (!n.created_at || isNaN(createdDate.getTime())) return null;

    return (
        <div className={styles.friendRequestContent}>
            <img
                className={styles.profileImage}
                src={`/media/user/${n.image}`}
                alt={`profile-image-${n.sender_name}`}
            />

            <div className={styles.content}>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    <p>
                        <Link className={styles.linkProfile} to={`/profile/${n.sender_name}`}>
                            {n.sender_name}
                        </Link>{' '}
                        {t("notifications.message")}
                    </p>
                    <span className={styles.timestamp}>{relativeTime}</span>
                </div>
                <div className={styles.buttonGroup}>
                    <button className={styles.acceptButton} onClick={handleAcceptButtonClick}>
                        <i className="bi bi-check2"></i>
                    </button>
                    <button className={styles.rejectButton} onClick={handleRejectButtonClick}>
                        <i className="bi bi-x-lg"></i>
                    </button>
                </div>
            </div>
        </div>
    );
}
