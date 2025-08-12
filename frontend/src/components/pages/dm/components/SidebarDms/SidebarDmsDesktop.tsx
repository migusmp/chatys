import { useNavigate } from "react-router-dom";
import { OnlineIndicator } from "../OnlineIndicator";
import type { Conversations } from "../../../../../types/user";
import { useUserContext } from "../../../../../context/UserContext";

type Props = { dms: Conversations[] };

export default function SidebarDmsDesktop({ dms }: Props) {
    const navigate = useNavigate();
    const { user } = useUserContext();

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
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {dms.map((dm) => {
                    const userOther = dm.participants[0];
                    const isLastMessageFromCurrentUser = dm.last_message_user_id === user?.id;
                    const lastMessageText = dm.last_message
                        ? (isLastMessageFromCurrentUser ? `Tú: ${dm.last_message}` : dm.last_message)
                        : "";

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
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0, 255, 102, 0.15)")}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
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
                                    {lastMessageText || <i></i>}
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
