import { useNavigate, useLocation } from "react-router-dom";
import { OnlineIndicator } from "../OnlineIndicator";
import type { Conversations } from "../../../../../types/user";
import { useUserContext } from "../../../../../context/UserContext";
import SearchUsers from "../SearchUsers";

type Props = { dms: Conversations[] };

export default function SidebarDmsDesktop({ dms }: Props) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, newLastMessage, dmNotifications } = useUserContext();

    const [, route, currentUsername] = location.pathname.split("/");
    console.log("Current route:", route, "Current username:", currentUsername);

    // Actualizar las conversaciones con posibles nuevos mensajes
    const dmsWithUpdatedMessages = dms.map(dm => {
        const newMsg = newLastMessage.find(msg => msg.conversation_id === dm.conversation_id);
        if (!newMsg) return dm;

        return {
            ...dm,
            last_message: newMsg.content,
            last_message_user_id: newMsg.from_user,
            updated_at: newMsg.created_at // importante para reordenar
        };
    });

    // Ordenar por el último mensaje más reciente
    const sortedDms = [...dmsWithUpdatedMessages].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

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
            <SearchUsers />
            <ul style={{ display: "flex", flexDirection: "column", listStyle: "none", padding: 0, margin: 0, gap: "0.2rem", marginTop: "1rem" }}>
                {sortedDms.map((dm) => {
                    const userOther = dm.participants[0];
                    const isLastMessageFromCurrentUser = dm.last_message_user_id === user?.id;
                    const lastMessageText = dm.last_message
                        ? (isLastMessageFromCurrentUser ? `Tú: ${dm.last_message}` : dm.last_message)
                        : "";

                    // Calcular número de mensajes no leídos
                    const [, route, username] = location.pathname.split("/");
                    const unreadCount = dmNotifications.filter(
                        n =>
                            (n.type_msg === "NEW_DM_MESSAGE" || n.type_msg === "chat_message") &&
                            n.conversation_id === dm.conversation_id &&
                            !(route === "dm" && username === userOther.username)
                    ).length;

                    return (

                        <li
                            key={dm.conversation_id}
                            onClick={() => navigate(`/dm/${userOther.username}`)}
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
                                        ? "rgba(0, 255, 102, 0.15)" // mismo color que hover
                                        : "transparent"
                            }}
                            onMouseEnter={(e) => {
                                const selected = route === "dm" && currentUsername === userOther.username;
                                e.currentTarget.style.backgroundColor = selected
                                    ? "rgba(0, 255, 102, 0.15)"
                                    : "rgba(0, 255, 102, 0.07)";
                            }}

                            onMouseLeave={(e) => {
                                if (!(route === "dm" && currentUsername === userOther.username)) {
                                    e.currentTarget.style.backgroundColor = "transparent";
                                }
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
                                    {lastMessageText || <i></i>}
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
