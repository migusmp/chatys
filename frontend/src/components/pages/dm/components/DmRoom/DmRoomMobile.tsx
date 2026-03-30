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
        <svg xmlns="http://www.w3.org/2000/svg" width="2em" height="2em" viewBox="0 0 24 24">
          <path fill="#0f6" d="M13.83 19a1 1 0 0 1-.78-.37l-4.83-6a1 1 0 0 1 0-1.27l5-6a1 1 0 0 1 1.54 1.28L10.29 12l4.32 5.36a1 1 0 0 1-.78 1.64" />
        </svg>

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
            {msg.is_deleted ? (
              <>
                <p style={{ ...messageTextStyle, opacity: 0.4, fontStyle: "italic" }}>
                  Mensaje eliminado
                </p>
                <span style={timeStyle}>
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </>
            ) : (
              <>
                <p style={messageTextStyle}>{msg.content}</p>
                <span style={timeStyle}>
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </>
            )}
          </article>
        ))}

        <div ref={bottomRef}></div>
      </div>

      <footer style={inputWrapperStyle}>
        <div style={messageInputContainerStyle}>
          <button type="button" style={iconButtonStyle} aria-label="Emoji">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="#0f6" className="bi bi-emoji-sunglasses" viewBox="0 0 16 16">
              <path d="M4.968 9.75a.5.5 0 1 0-.866.5A4.5 4.5 0 0 0 8 12.5a4.5 4.5 0 0 0 3.898-2.25.5.5 0 1 0-.866-.5A3.5 3.5 0 0 1 8 11.5a3.5 3.5 0 0 1-3.032-1.75M7 5.116V5a1 1 0 0 0-1-1H3.28a1 1 0 0 0-.97 1.243l.311 1.242A2 2 0 0 0 4.561 8H5a2 2 0 0 0 1.994-1.839A3 3 0 0 1 8 6c.393 0 .74.064 1.006.161A2 2 0 0 0 11 8h.438a2 2 0 0 0 1.94-1.515l.311-1.242A1 1 0 0 0 12.72 4H10a1 1 0 0 0-1 1v.116A4.2 4.2 0 0 0 8 5c-.35 0-.69.04-1 .116" />
              <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-1 0A7 7 0 1 0 1 8a7 7 0 0 0 14 0" />
            </svg>
          </button>

          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleSendMessage()}
            placeholder="Escribí un mensaje..."
            style={inputStyle}
          />

          <button type="button" style={iconButtonStyle} aria-label="Adjuntar">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="#0f6" className="bi bi-paperclip" viewBox="0 0 16 16">
              <path d="M4.5 3a2.5 2.5 0 0 1 5 0v9a1.5 1.5 0 0 1-3 0V5a.5.5 0 0 1 1 0v7a.5.5 0 0 0 1 0V3a1.5 1.5 0 1 0-3 0v9a2.5 2.5 0 0 0 5 0V5a.5.5 0 0 1 1 0v7a3.5 3.5 0 1 1-7 0z" />
            </svg>
          </button>

          <button type="button" style={iconButtonStyle} aria-label="Audio">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="#0f6" className="bi bi-mic" viewBox="0 0 16 16">
              <path d="M3.5 6.5A.5.5 0 0 1 4 7v1a4 4 0 0 0 8 0V7a.5.5 0 0 1 1 0v1a5 5 0 0 1-4.5 4.975V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 .5-.5" />
              <path d="M10 8a2 2 0 1 1-4 0V3a2 2 0 1 1 4 0zM8 0a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V3a3 3 0 0 0-3-3" />
            </svg>
          </button>
        </div>

        <button
          onClick={handleSendMessage}
          disabled={!message.trim()}
          style={micButtonStyle}
          aria-label="Enviar mensaje"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="#000" className="bi bi-send" viewBox="0 0 16 16">
            <path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11ZM6.636 10.07l2.761 4.338L14.13 2.576zm6.787-8.201L1.591 6.602l4.339 2.76z" />
          </svg>
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
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  position: "fixed",
  width: "100%",
  backgroundColor: "#000",
  borderBottom: "1px solid #333",
  padding: "0.75rem",
  color: "#fff",
  zIndex: 10,
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
  marginTop: "60px",
  marginBottom: "7.5rem", // deja espacio extra para el footer + nav inferior
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
  maxWidth: "60%",
  backgroundColor: "rgba(0, 255, 102, 0.15)",
  color: "#0f6",
  display: "flex",
  gap: "0.5rem",
  justifyContent: "center",
  alignItems: "center",
  borderRadius: "1rem 1rem 0 1rem",
  padding: "0.6rem",
};

const otherBubbleStyle: CSSProperties = {
  alignSelf: "flex-start",
  maxWidth: "60%",
  display: "flex",
  gap: "0.5rem",
  justifyContent: "center",
  alignItems: "center",
  backgroundColor: "#222",
  color: "#ddd",
  borderRadius: "1rem 1rem 1rem 0",
  padding: "0.6rem",
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
  position: "fixed",
  bottom: "3.5rem", // separa el input de la barra de navegación inferior fija
  width: "100%",
  padding: "0.6rem 0.75rem 0.75rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.5rem",
  zIndex: 20,
};

const messageInputContainerStyle: CSSProperties = {
  flex: 1,
  width: "50%",
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  padding: "0.45rem 0.75rem",
  borderRadius: "9999px",
  backgroundColor: "#121212",
  border: "1px solid #444",
};

const iconButtonStyle: CSSProperties = {
  border: "none",
  backgroundColor: "transparent",
  padding: "0.2rem",
  color: "#89f7b4",
  cursor: "pointer",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const micButtonStyle: CSSProperties = {
  border: "none",
  cursor: "pointer",
  width: "44px",
  height: "44px",
  borderRadius: "50%",
  backgroundColor: "#0f6",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 0 0 2px rgba(15, 255, 102, 0.2)",
  opacity: 1,
};

const inputStyle: CSSProperties = {
  flex: 1,
  border: "none",
  backgroundColor: "transparent",
  color: "#fff",
  outline: "none",
  fontSize: "1rem",
  minWidth: "0",
};
