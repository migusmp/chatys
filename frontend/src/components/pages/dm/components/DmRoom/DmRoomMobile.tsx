import type { CSSProperties } from "react";
import useDmRoom from "../../../../../hooks/useDmRoom";
import type { FullConversation } from "../../../../../types/user";
import { OnlineIndicator } from "../OnlineIndicator";

type Props = {
    conversationData: FullConversation;
};

export default function DmRoomMobile({ conversationData }: Props) {
    const {
        allMessages,
        bottomRef,
        containerRef,
        currentUserId,
        handleSendMessage,
        isOnline,
        loadingMore,
        message,
        otherParticipant,
        setMessage,
    } = useDmRoom(conversationData);

    if (!otherParticipant) {
        return null;
    }

    return (
        <section style={containerStyle}>
            <header style={headerStyle}>
                <div style={headerInfoStyle}>
                    <div style={avatarWrapperStyle}>
                        <img
                            src={`/media/user/${otherParticipant.image}`}
                            alt={otherParticipant.username}
                            style={avatarStyle}
                        />
                        <OnlineIndicator userId={otherParticipant.id} isHeader={true} />
                    </div>
                    <div>
                        <p style={usernameStyle}>{otherParticipant.username}</p>
                        <p style={statusStyle}>{isOnline ? "Conectado" : "Desconectado"}</p>
                    </div>
                </div>
            </header>

            <div ref={containerRef} style={messagesWrapperStyle}>
                {loadingMore && <p style={loadingStyle}>Cargando mensajes...</p>}

                {allMessages.map((msg) => (
                    <article
                        key={msg.id}
                        style={msg.sender_id === currentUserId ? ownBubbleStyle : otherBubbleStyle}
                    >
                        <p style={messageTextStyle}>{msg.content}</p>
                        <span style={timeStyle}>
                            {new Date(msg.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                            })}
                        </span>
                    </article>
                ))}

                <div ref={bottomRef}></div>
            </div>

            <footer style={inputWrapperStyle}>
                <input
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && handleSendMessage()}
                    placeholder="Escribi un mensaje..."
                    style={inputStyle}
                />
                <button
                    onClick={handleSendMessage}
                    disabled={!message.trim()}
                    style={sendButtonStyle}
                >
                    Enviar
                </button>
            </footer>
        </section>
    );
}

const containerStyle: CSSProperties = {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#000",
};

const headerStyle: CSSProperties = {
    borderBottom: "1px solid #333",
    padding: "0.75rem",
    color: "#fff",
};

const headerInfoStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
};

const avatarWrapperStyle: CSSProperties = {
    position: "relative",
};

const avatarStyle: CSSProperties = {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    objectFit: "cover",
};

const usernameStyle: CSSProperties = {
    margin: 0,
    fontWeight: 700,
};

const statusStyle: CSSProperties = {
    margin: 0,
    color: "#89f7b4",
    fontSize: "0.8rem",
};

const messagesWrapperStyle: CSSProperties = {
    flex: 1,
    overflowY: "auto",
    padding: "1rem 0.75rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
};

const loadingStyle: CSSProperties = {
    color: "#999",
    textAlign: "center",
    margin: "0.5rem 0",
};

const ownBubbleStyle: CSSProperties = {
    alignSelf: "flex-end",
    maxWidth: "85%",
    backgroundColor: "rgba(0, 255, 102, 0.2)",
    color: "#c8ffd9",
    borderRadius: "12px 12px 0 12px",
    padding: "0.5rem 0.75rem",
};

const otherBubbleStyle: CSSProperties = {
    alignSelf: "flex-start",
    maxWidth: "85%",
    backgroundColor: "#222",
    color: "#eee",
    borderRadius: "12px 12px 12px 0",
    padding: "0.5rem 0.75rem",
};

const messageTextStyle: CSSProperties = {
    margin: 0,
};

const timeStyle: CSSProperties = {
    display: "block",
    marginTop: "0.25rem",
    fontSize: "0.7rem",
    color: "#9b9b9b",
};

const inputWrapperStyle: CSSProperties = {
    borderTop: "1px solid #333",
    padding: "0.75rem",
    display: "flex",
    gap: "0.5rem",
};

const inputStyle: CSSProperties = {
    flex: 1,
    borderRadius: "9999px",
    border: "1px solid #444",
    backgroundColor: "#121212",
    color: "#fff",
    padding: "0.6rem 0.9rem",
};

const sendButtonStyle: CSSProperties = {
    border: "none",
    borderRadius: "9999px",
    padding: "0.6rem 0.9rem",
    backgroundColor: "rgba(0, 255, 102, 0.2)",
    color: "#89f7b4",
};
