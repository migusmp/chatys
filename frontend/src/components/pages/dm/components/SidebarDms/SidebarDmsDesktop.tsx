import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { OnlineIndicator } from "../OnlineIndicator";
import type { Conversations, Participants, UserSearchData } from "../../../../../types/user";
import {
    useNotificationsContext,
    useUserProfileContext,
} from "../../../../../context/UserContext";
import SearchUsers from "../SearchUsers";
import { useTranslation } from "react-i18next";
import { mergeDmsWithRealtimeMessages } from "./realtimeDmList";
import styles from "../../css/SidebarDms.module.css";

type Props = {
    dms: Conversations[];
    setDms: React.Dispatch<React.SetStateAction<Conversations[]>>;
};

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

export default function SidebarDmsDesktop({ dms }: Props) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useUserProfileContext();
    const { newLastMessage, dmNotifications } = useNotificationsContext();
    const [searchResults, setSearchResults] = useState<UserSearchData[]>([]);
    const [searching, setSearching] = useState(false);
    const { t } = useTranslation();

    const [, route, currentUsername] = location.pathname.split("/");

    const dmsWithUpdatedMessages = mergeDmsWithRealtimeMessages(dms, newLastMessage);

    const handleClickDm = async (userOther: UserSearchData | Participants) => {
        // If it has a numeric conversation_id the conversation already exists
        if ("conversation_id" in userOther && typeof userOther.conversation_id === "number") {
            navigate(`/dm/${userOther.username}`);
            return;
        }

        // Otherwise it's a UserSearchData — create the conversation first
        try {
            const res = await fetch(`/api/chat/create-dm/${userOther.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            if (!res.ok) throw new Error("Error al crear la conversación");

            navigate(`/dm/${userOther.username}`);
        } catch (err) {
            console.error("No se pudo iniciar el chat:", err);
        }
    };

    // Merge search results with existing DMs
    const combinedList = searchResults.length > 0
        ? searchResults.map(u => {
            const existingDm = dmsWithUpdatedMessages.find(dm => dm.participants[0].id === u.id);
            return existingDm || {
                conversation_id: `temp-${u.id}`,
                participants: [u],
                last_message: "",
                last_message_user_id: null,
                updated_at: new Date(0).toISOString(),
            };
        })
        : dmsWithUpdatedMessages;

    const sortedDms = [...combinedList].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    const handleSearchResults = (results: UserSearchData[], isSearching: boolean) => {
        setSearchResults(results);
        setSearching(isSearching);
    };

    const searchPresenceById = new Map(searchResults.map((result) => [result.id, result.is_online]));

    return (
        <div className={`${styles.sidebar} ${styles.sidebarDesktop}`}>
            <SearchUsers onResults={handleSearchResults} />

            {searching && searchResults.length === 0 && (
                <div className={styles.emptyHint}>
                    {t("directMessages.desktopSidebarDm.userSearchNotFoundTxt")}
                </div>
            )}

            <ul className={styles.list}>
                {sortedDms.map((dm) => {
                    const userOther = dm.participants[0];
                    const isLastMessageFromCurrentUser = dm.last_message_user_id === user?.id;
                    const lastMessageText = dm.last_message
                        ? (isLastMessageFromCurrentUser ? `Tú: ${dm.last_message}` : dm.last_message)
                        : "";

                    const isSelected = route === "dm" && currentUsername === userOther.username;

                    const unreadCount = dmNotifications.filter(
                        n =>
                            (n.type_msg === "NEW_DM_MESSAGE" || n.type_msg === "chat_message") &&
                            n.conversation_id === dm.conversation_id &&
                            !isSelected
                    ).length;

                    const timestamp = formatTimestamp(dm.updated_at);

                    return (
                        <li
                            key={dm.conversation_id}
                            onClick={() => handleClickDm(userOther)}
                            className={`${styles.item} ${isSelected ? styles.itemActive : ""}`}
                        >
                            <div className={styles.avatarWrapper}>
                                <img
                                    src={`/media/user/${userOther.image}`}
                                    alt={userOther.username}
                                    className={styles.avatar}
                                />
                                <OnlineIndicator
                                    userId={userOther.id}
                                    isHeader={false}
                                    isOnline={searchPresenceById.get(userOther.id)}
                                />
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
