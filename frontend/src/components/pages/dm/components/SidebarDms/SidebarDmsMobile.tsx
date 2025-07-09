import { useNavigate } from "react-router-dom";
import type { Conversations } from "../../../../../types/user";
import { OnlineIndicator } from "../OnlineIndicator";

type Props = { dms: Conversations[] };

export default function SidebarDmsMobile({ dms }: Props) {
    const navigate = useNavigate();

    return (
        <div
            style={{
                width: "100%",
                backgroundColor: "#000",
                height: "90vh",
                overflowY: "auto",
                padding: "1rem",
                borderRight: "1px solid #272727",
            }}
        >
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {dms.map((dm) => {
                    const user = dm.participants[0];
                    return (
                        <li
                            key={dm.conversation_id}
                            onClick={() => navigate(`/dm/${dm.conversation_id}`)}
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
                                    src={`/media/user/${user.image}`}
                                    alt={user.username}
                                    style={{
                                        width: "45px",
                                        height: "45px",
                                        borderRadius: "50%",
                                        objectFit: "cover",
                                    }}
                                />
                                <OnlineIndicator userId={user.id} />
                            </div>
                            <div style={{ flex: 1, overflow: "hidden" }}>
                                <div style={{ fontWeight: "bold", color: "#fff" }}>{user.username}</div>
                                <div
                                    style={{
                                        fontSize: "0.85rem",
                                        color: "#ccc",
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                    }}
                                >
                                    {dm.last_message_content || <i>No hay mensajes</i>}
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
