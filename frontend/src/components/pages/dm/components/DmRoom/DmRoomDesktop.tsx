import { useUserContext } from "../../../../../context/UserContext";
import type { FullConversation } from "../../../../../types/user";
import styles from "../../css/DmRoomDesktop.module.css";
import { useState, useEffect, useRef } from "react";
import type { ChatMessage } from "../../../../../types/chat_message";
import { OnlineIndicator } from "../OnlineIndicator";
import { useTranslation } from "react-i18next";

type Props = {
    conversationData: FullConversation;
};

export default function DmRoomDesktop({ conversationData }: Props) {
    const { user, checkUserIsOnline, setNotifications } = useUserContext();
    const { t } = useTranslation();
    const [message, setMessage] = useState("");
    const [allMessages, setAllMessages] = useState<ChatMessage[]>(conversationData.messages);
    const [socket, setSocket] = useState<WebSocket | null>(null);

    const otherParticipant = conversationData.conversation.participants.find(
        (p) => p.id !== user?.id
    );

    const isOnline = checkUserIsOnline(otherParticipant?.id ?? -1);

    const bottomRef = useRef<HTMLDivElement | null>(null);
    const firstLoadRef = useRef(true);

    // Sincronizar mensajes cuando cambia la conversación
    useEffect(() => {
        // ELIMINAR LAS NOIFICACIONES DE ESTE CHAT
        setNotifications((prev) =>
            prev.filter(
                (n) =>
                    !(
                        (n.type_msg === "NEW_DM_MESSAGE" || n.type_msg === "chat_message") &&
                        n.conversation_id === conversationData.conversation.id
                    )
            )
        );


        // Actualizar mensajes
        if (!conversationData.messages) return;
        setAllMessages(conversationData.messages);
        firstLoadRef.current = true; // para scroll instantáneo en nuevo chat
    }, [conversationData]);

    // Scroll al último mensaje
    useEffect(() => {
        if (firstLoadRef.current) {
            bottomRef.current?.scrollIntoView({ behavior: "auto" });
            firstLoadRef.current = false;
        } else {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [allMessages]);

    // Abrir socket y escuchar mensajes nuevos
    useEffect(() => {
        if (!otherParticipant) return;

        const protocol = location.protocol === "https:" ? "wss" : "ws";
        const ws = new WebSocket(`${protocol}://${location.host}/ws/${conversationData.conversation.id}`);
        ws.onopen = () => {
            console.log("[WS] Conectado al WebSocket de", otherParticipant.username);
        }

        ws.onmessage = (event) => {
            const raw = JSON.parse(event.data);
            console.log("[WS] Mensaje recibido:", raw);
            const data: ChatMessage = {
                id: Date.now(),
                content: raw.content,
                sender_id: raw.from_user,
                created_at: new Date().toISOString(),
            };
            setAllMessages((prev) => [...prev, data]);
        };

        ws.onclose = () => {
            console.log("[WS] Socket cerrado por servidor o cliente");
        };

        setSocket(ws);

        return () => {
            ws.close();
            console.log("[WS] Socket cerrado");
        };
    }, [otherParticipant]);

    const handleSendMessage = () => {
        if (!message.trim() || !socket) return;
        socket.send(JSON.stringify({ content: message }));
        console.log("ALL MESSAGES:", allMessages);
        // setAllMessages((prev) => [
        //     ...prev,
        //     {
        //         id: Date.now(),
        //         content: message,
        //         sender_id: user?.id ?? 0,
        //         created_at: new Date().toISOString(),
        //     },
        // ]);
        setMessage("");
    };

    if (!otherParticipant) return null;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.userInfo}>
                    <div className={styles.avatarWrapper}>
                        <img
                            src={`/media/user/${otherParticipant.image}`}
                            alt={otherParticipant.username}
                            className={styles.avatar}
                        />
                        <OnlineIndicator userId={otherParticipant.id} isHeader={true} />
                    </div>
                    <div className={styles.userText}>
                        <span className={styles.username}>{otherParticipant.username}</span>
                        <span className={isOnline ? styles.online : styles.offline}>
                            {isOnline
                                ? t("directMessages.userDm.connected")
                                : t("directMessages.userDm.disconnected")}
                        </span>
                    </div>
                </div>
            </header>

            <div className={styles.chatArea}>
                {allMessages.map((msg) => {
                    const isOwn = msg.sender_id === user?.id;
                    const time = new Date(msg.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                    });

                    return (
                        <div
                            key={msg.id}
                            className={`${styles.messageBubble} ${isOwn ? styles.ownMessage : styles.otherMessage
                                }`}
                        >
                            <div className={styles.messageRow}>
                                <span className={styles.messageText}>{msg.content}</span>
                                <span className={styles.messageTime}>{time}</span>
                            </div>
                        </div>
                    );
                })}
                <div ref={bottomRef}></div>
            </div>

            <div className={styles.inputSection}>
                <input
                    type="text"
                    placeholder="Escribe un mensaje..."
                    className={styles.messageInput}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                />
                <button
                    className={styles.sendButton}
                    onClick={handleSendMessage}
                    disabled={!message.trim()}
                >
                    Enviar
                </button>
            </div>
        </div>
    );
}
