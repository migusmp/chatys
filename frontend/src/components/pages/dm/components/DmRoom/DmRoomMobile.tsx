import { useEffect, useRef, useState, type CSSProperties } from "react";
import MessageReactions from "../../../../MessageReactions";
import useDmRoom from "../../../../../hooks/useDmRoom";
import type { FullConversation } from "../../../../../types/user";
import { OnlineIndicator } from "../OnlineIndicator";
import { ReadReceipt } from "./ReadReceipt";

// Minimum gap (ms) between outgoing typing events sent to the server.
const TYPING_DEBOUNCE_MS = 2000;

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
    sendDelete,
    sendEdit,
    sendTyping,
    setMessage,
    toggleReaction,
    typingUser,
  } = useDmRoom(conversationData);

  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const menuRef = useRef<HTMLDivElement | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks the last time we sent a typing event so we debounce outgoing signals
  const lastTypingSentRef = useRef(0);

  useEffect(() => {
    if (menuOpenId === null) return;
    const handleOutside = (e: TouchEvent | MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [menuOpenId]);

  const startLongPress = (id: number) => {
    longPressTimer.current = setTimeout(() => setMenuOpenId(id), 500);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const startEdit = (id: number, content: string) => {
    setEditingId(id);
    setEditValue(content);
    setMenuOpenId(null);
  };

  const confirmEdit = () => {
    if (editingId !== null && editValue.trim()) {
      sendEdit(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);

    // Send at most one typing event every TYPING_DEBOUNCE_MS to avoid flooding
    const now = Date.now();
    if (now - lastTypingSentRef.current >= TYPING_DEBOUNCE_MS) {
      lastTypingSentRef.current = now;
      sendTyping();
    }
  };

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

        {allMessages.map((msg) => {
          const isOwn = msg.sender_id === currentUserId;
          const isEditing = editingId === msg.id;
          const isRead = isOwn && (msg.read_by?.includes(otherParticipant.id) ?? false);
          const time = new Date(msg.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div key={msg.id} style={{ position: "relative", alignSelf: isOwn ? "flex-end" : "flex-start", maxWidth: "60%" }}>
              {menuOpenId === msg.id && (
                <div ref={menuRef} style={{ ...contextMenuStyle, [isOwn ? "right" : "left"]: 0 }}>
                  <button
                    style={contextMenuItemStyle}
                    onTouchStart={(e) => e.currentTarget.style.background = "#222"}
                    onTouchEnd={(e) => e.currentTarget.style.background = "none"}
                    onClick={() => startEdit(msg.id, msg.content)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z" />
                    </svg>
                    Editar
                  </button>
                  <button
                    style={{ ...contextMenuItemStyle, color: "#ff5555" }}
                    onTouchStart={(e) => e.currentTarget.style.background = "rgba(255,60,60,0.1)"}
                    onTouchEnd={(e) => e.currentTarget.style.background = "none"}
                    onClick={() => { sendDelete(msg.id); setMenuOpenId(null); }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z" />
                      <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z" />
                    </svg>
                    Eliminar
                  </button>
                </div>
              )}

              <article
                style={isOwn ? ownBubbleStyle : otherBubbleStyle}
                onTouchStart={() => isOwn && !msg.is_deleted ? startLongPress(msg.id) : undefined}
                onTouchEnd={cancelLongPress}
                onTouchMove={cancelLongPress}
              >
                {msg.is_deleted ? (
                  <>
                    <p style={{ ...messageTextStyle, opacity: 0.4, fontStyle: "italic" }}>
                      Mensaje eliminado
                    </p>
                    <span style={timeStyle}>{time}</span>
                  </>
                ) : isEditing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", width: "100%" }}>
                    <textarea
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); confirmEdit(); }
                        if (e.key === "Escape") cancelEdit();
                      }}
                      style={editTextareaStyle}
                      rows={2}
                    />
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <button style={editSaveButtonStyle} onClick={confirmEdit}>Guardar</button>
                      <button style={editCancelButtonStyle} onClick={cancelEdit}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p style={messageTextStyle}>{msg.content}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", justifyContent: "flex-end" }}>
                      {msg.edited_at && (
                        <span style={{ fontSize: "10px", opacity: 0.4 }}>(editado)</span>
                      )}
                      <span style={timeStyle}>{time}</span>
                      {isOwn && <ReadReceipt isRead={isRead} />}
                    </div>
                  </>
                )}
              </article>
              {!msg.is_deleted && (
                <MessageReactions
                  messageId={msg.id}
                  reactions={msg.reactions ?? []}
                  currentUserId={currentUserId}
                  onToggle={toggleReaction}
                  visible={menuOpenId === msg.id}
                />
              )}
            </div>
          );
        })}

        <div ref={bottomRef}></div>
      </div>

      <footer style={inputWrapperStyle}>
        {typingUser && (
          <p style={typingIndicatorStyle}>{typingUser} está escribiendo…</p>
        )}
        <div style={inputRowStyle}>
          <div style={messageInputContainerStyle}>
            <button type="button" style={iconButtonStyle} aria-label="Emoji">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="#0f6" className="bi bi-emoji-sunglasses" viewBox="0 0 16 16">
                <path d="M4.968 9.75a.5.5 0 1 0-.866.5A4.5 4.5 0 0 0 8 12.5a4.5 4.5 0 0 0 3.898-2.25.5.5 0 1 0-.866-.5A3.5 3.5 0 0 1 8 11.5a3.5 3.5 0 0 1-3.032-1.75M7 5.116V5a1 1 0 0 0-1-1H3.28a1 1 0 0 0-.97 1.243l.311 1.242A2 2 0 0 0 4.561 8H5a2 2 0 0 0 1.994-1.839A3 3 0 0 1 8 6c.393 0 .74.064 1.006.161A2 2 0 0 0 11 8h.438a2 2 0 0 0 1.94-1.515l.311-1.242A1 1 0 0 0 12.72 4H10a1 1 0 0 0-1 1v.116A4.2 4.2 0 0 0 8 5c-.35 0-.69.04-1 .116" />
                <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-1 0A7 7 0 1 0 1 8a7 7 0 0 0 14 0" />
              </svg>
            </button>

            <input
              value={message}
              onChange={handleInputChange}
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
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="#000" className="bi bi-send-fill" viewBox="0 0 16 16">
              <path d="M15.964.686a.5.5 0 0 0-.65-.65L.767 5.855H.766l-.452.18a.5.5 0 0 0-.082.887l.41.26.001.002 4.995 3.178 3.178 4.995.002.002.26.41a.5.5 0 0 0 .886-.083zm-1.833 1.89L6.637 10.07l-.215-.338a.5.5 0 0 0-.154-.154l-.338-.215 7.494-7.494 1.178-.471z" />
            </svg>
          </button>
        </div>
      </footer>
    </section>
  );
}

const containerStyle: CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: "flex",
  flexDirection: "column",
  backgroundColor: "#000",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  position: "fixed",
  left: 0,
  right: 0,
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
  marginBottom: "7.5rem",
  flex: 1,
  width: "100%",
  boxSizing: "border-box",
  overflowY: "auto",
  overflowX: "hidden",
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

const contextMenuStyle: CSSProperties = {
  position: "absolute",
  bottom: "calc(100% + 0.4rem)",
  background: "#141414",
  border: "1px solid #2a2a2a",
  borderRadius: "0.85rem",
  boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
  zIndex: 30,
  minWidth: "145px",
  overflow: "hidden",
};

const contextMenuItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.55rem",
  width: "100%",
  background: "none",
  border: "none",
  color: "#ccc",
  cursor: "pointer",
  padding: "0.75rem 1rem",
  fontSize: "0.9rem",
  textAlign: "left",
};

const editTextareaStyle: CSSProperties = {
  background: "#222",
  color: "#fff",
  border: "1px solid #444",
  borderRadius: "0.4rem",
  padding: "0.35rem 0.5rem",
  width: "100%",
  outline: "none",
  resize: "none",
  fontSize: "0.95rem",
  fontFamily: "inherit",
};

const editSaveButtonStyle: CSSProperties = {
  background: "#0f6",
  color: "#000",
  border: "none",
  borderRadius: "0.4rem",
  padding: "0.25rem 0.6rem",
  cursor: "pointer",
  fontSize: "0.8rem",
  fontWeight: 600,
};

const editCancelButtonStyle: CSSProperties = {
  background: "#333",
  color: "#ddd",
  border: "none",
  borderRadius: "0.4rem",
  padding: "0.25rem 0.6rem",
  cursor: "pointer",
  fontSize: "0.8rem",
};

const inputWrapperStyle: CSSProperties = {
  position: "fixed",
  bottom: "3.5rem",
  left: 0,
  right: 0,
  padding: "0 0.75rem 0.75rem",
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  zIndex: 20,
};

const typingIndicatorStyle: CSSProperties = {
  margin: 0,
  padding: "2px 4px",
  fontSize: "11px",
  fontStyle: "italic",
  color: "#555",
};

const inputRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
};

const messageInputContainerStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
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
  minWidth: "44px",
  borderRadius: "50%",
  backgroundColor: "#0f6",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 0 0 2px rgba(15, 255, 102, 0.2)",
  flexShrink: 0,
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
