import { useNavigate, useLocation } from "react-router-dom";
import type { Conversations } from "../../../../../types/user";
import { OnlineIndicator } from "../OnlineIndicator";
import {
    useNotificationsContext,
    useUserProfileContext,
} from "../../../../../context/UserContext";

type Props = { dms: Conversations[] };

export default function SidebarDmsMobile({ dms }: Props) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useUserProfileContext();
    const { newLastMessage, dmNotifications } = useNotificationsContext();

    const [, route, currentUsername] = location.pathname.split("/");

    // Actualizar las conversaciones con posibles nuevos mensajes
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

    // Ordenar por el último mensaje más reciente
    const sortedDms = [...dmsWithUpdatedMessages].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    return (
        <div
            style={{
                width: "100%",
                backgroundColor: "#000",
                height: "90vh",
                overflowY: "auto",
                padding: "0.5rem",
                borderRight: "1px solid #272727",
            }}
        >
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {sortedDms.map((dm) => {
                    const userOther = dm.participants[0];
                    const isLastMessageFromCurrentUser = dm.last_message_user_id === user?.id;
                    const lastMessageText = dm.last_message
                        ? (isLastMessageFromCurrentUser ? `Tú: ${dm.last_message}` : dm.last_message)
                        : "";

                    // Calcular número de mensajes no leídos
                    const unreadCount = dmNotifications.filter(
                        n =>
                            (n.type_msg === "NEW_DM_MESSAGE" || n.type_msg === "chat_message") &&
                            n.conversation_id === dm.conversation_id &&
                            !(route === "dm" && currentUsername === userOther.username)
                    ).length;

                    const isSelected = route === "dm" && currentUsername === userOther.username;

                    return (
                        <li
                            key={dm.conversation_id}
                            onClick={() => navigate(`/dm/${userOther.username}`)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                padding: "0.75rem",
                                cursor: "pointer",
                                transition: "background 0.2s",
                                borderRadius: "8px",
                                backgroundColor: isSelected
                                    ? "rgba(0, 255, 102, 0.15)"
                                    : "transparent",
                                position: "relative"
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = isSelected
                                    ? "rgba(0, 255, 102, 0.15)"
                                    : "rgba(0, 255, 102, 0.07)";
                            }}
                            onMouseLeave={(e) => {
                                if (!isSelected) {
                                    e.currentTarget.style.backgroundColor = "transparent";
                                }
                            }}
                        >
                            <div style={{ position: "relative", marginRight: "1rem" }}>
                                <img
                                    src={`/media/user/${userOther.image}`}
                                    alt={userOther.username}
                                    style={{
                                        width: "45px",
                                        height: "45px",
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
                                    {lastMessageText || <i>No hay mensajes</i>}
                                </div>
                            </div>

                            {/* Badge de mensajes nuevos */}
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
                                    {unreadCount}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
