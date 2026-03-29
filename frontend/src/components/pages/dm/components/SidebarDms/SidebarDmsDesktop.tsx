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

type Props = {
    dms: Conversations[];
    setDms: React.Dispatch<React.SetStateAction<Conversations[]>>;
};

export default function SidebarDmsDesktop({ dms }: Props) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useUserProfileContext();
    const { newLastMessage, dmNotifications } = useNotificationsContext();
    const [searchResults, setSearchResults] = useState<UserSearchData[]>([]);
    const [searching, setSearching] = useState(false);
    const { t } = useTranslation();

    const [, route, currentUsername] = location.pathname.split("/");
    console.log(route)

    // Actualizar mensajes en DMs
    const dmsWithUpdatedMessages = dms.map(dm => {
        const newMsg = newLastMessage.find(msg => msg.conversation_id === dm.conversation_id);
        if (!newMsg) return dm;

        return {
            ...dm,
            last_message: newMsg.content,
            last_message_user_id: newMsg.from_user,
            updated_at: newMsg.created_at
        };
    });

    const handleClickDm = async (userOther: UserSearchData | Participants) => {
        // Si tiene conversation_id numérico ya existe
        if ("conversation_id" in userOther && typeof userOther.conversation_id === "number") {
            navigate(`/dm/${userOther.username}`);
            return;
        }

        // Si no, es un UserSearchData, crear la conversación
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


    // Fusionar resultados de búsqueda con los DMs
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

    // Ordenar por updated_at
    const sortedDms = [...combinedList].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    const handleSearchResults = (results: UserSearchData[], isSearching: boolean) => {
        setSearchResults(results);
        setSearching(isSearching);
    };

    return (
        <div
            style={{
                width: "300px",
                backgroundColor: "#000",
                height: "100vh",
                overflowY: "auto",
                borderRight: "1px solid #272727",
            }}
        >
            <SearchUsers onResults={handleSearchResults} />
            {searching && searchResults.length === 0 && (
                <div style={{ color: "#999", padding: "1rem", textAlign: "center" }}>
                    {t("directMessages.desktopSidebarDm.userSearchNotFoundTxt")}
                </div>
            )}

            <ul style={{ display: "flex", flexDirection: "column", listStyle: "none", padding: 0, margin: 0, gap: "0.2rem", marginTop: "1rem" }}>
                {sortedDms.map((dm) => {
                    const userOther = dm.participants[0];
                    const isLastMessageFromCurrentUser = dm.last_message_user_id === user?.id;
                    const lastMessageText = dm.last_message
                        ? (isLastMessageFromCurrentUser ? `Tú: ${dm.last_message}` : dm.last_message)
                        : "";

                    const [, route, username] = location.pathname.split("/");
                    console.log("ROUTE:", route, username);
                    // LOG para ver qué mensajes hay en dmNotifications
                    console.log("🔔 DM NOTIFICATIONS:", dmNotifications);
                    console.log("🔔 Filtrando para conversation_id:", dm.conversation_id);

                    const unreadCount = dmNotifications.filter(
                        n => Number(n.conversation_id) === dm.conversation_id
                    ).length;

                    return (
                        <li
                            key={dm.conversation_id}
                            onClick={() => handleClickDm(userOther)}
                            style={{
                                display: "flex",
                                width: "90%",
                                height: "55px",
                                borderRadius: "8px",
                                margin: "0 auto",
                                alignItems: "center",
                                padding: "0.5rem",
                                cursor: "pointer",
                                transition: "background 0.2s",
                                position: "relative",
                                backgroundColor:
                                    route === "dm" && currentUsername === userOther.username
                                        ? "rgba(0, 255, 102, 0.15)"
                                        : "transparent"
                            }}
                        >
                            <div style={{ position: "relative", marginRight: "1rem" }}>
                                <img
                                    src={`/media/user/${userOther.image}`}
                                    alt={userOther.username}
                                    style={{
                                        width: "37px",
                                        height: "37px",
                                        borderRadius: "50%",
                                        objectFit: "cover",
                                    }}
                                />
                                <OnlineIndicator userId={userOther.id} isHeader={false} />
                            </div>
                            <div style={{ flex: 1, overflow: "hidden" }}>
                                <div style={{ fontWeight: "bold", color: "#fff" }}>{userOther.username}</div>
                                <div
                                    style={{
                                        fontSize: "0.85rem",
                                        color: "#ccc",
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                    }}
                                >
                                    {lastMessageText || ""}
                                </div>
                            </div>

                            {unreadCount > 0 && (
                                <div
                                    style={{
                                        backgroundColor: "red",
                                        color: "white",
                                        borderRadius: "50%",
                                        width: "20px",
                                        height: "20px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "0.75rem",
                                        fontWeight: "bold",
                                        marginLeft: "8px"
                                    }}
                                >
                                    {unreadCount > 9 ? "9+" : unreadCount}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
