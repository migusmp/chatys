import { useUserContext } from "../../../../../context/UserContext";
import type { FullConversation } from "../../../../../types/user";
import styles from "../../css/DmRoomDesktop.module.css";
import { useState, useEffect, useRef } from "react";
import type { ChatMessage } from "../../../../../types/chat_message";
import { OnlineIndicator } from "../OnlineIndicator";
import { useTranslation } from "react-i18next";
import type { NewDmMessageNotification } from "../../../../../interfaces/notifications";

type Props = {
    conversationData: FullConversation;
};

export default function DmRoomDesktop({ conversationData }: Props) {
    const { user, checkUserIsOnline, setDmNotifications, setNewLastMessage } = useUserContext();
    const { t } = useTranslation();

    const [message, setMessage] = useState("");
    const [allMessages, setAllMessages] = useState<ChatMessage[]>([...conversationData.messages].reverse());
    const [socket, setSocket] = useState<WebSocket | null>(null);

    const limit = 20;
    const [offset, setOffset] = useState(allMessages.length);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const firstLoadRef = useRef(true);

    const otherParticipant = conversationData.conversation.participants.find(
        (p) => p.id !== user?.id
    );

    const isOnline = checkUserIsOnline(otherParticipant?.id ?? -1);

    // --- Cargar mensajes antiguos ---
    const loadOlderMessages = async (initial = false) => {
        console.log("Cargando mensajes antiguos...")
        if (!hasMore || loadingMore || !otherParticipant) return;
        setLoadingMore(true);

        const container = containerRef.current;
        const previousScrollHeight = container?.scrollHeight ?? 0;

        const res = await fetch(
            `/api/chat/conversation/${otherParticipant.username}?limit=${limit}&offset=${offset}`
        );
        if (!res.ok) {
            console.error("Error al cargar mensajes antiguos");
            setLoadingMore(false);
            return;
        }

        const data = await res.json(); // { messages: ChatMessage[] }
        const olderMessages = [...data.messages].reverse(); // antiguos primero

        if (data.messages.length < limit) setHasMore(false);
        setAllMessages((prev) => [...olderMessages, ...prev]);
        setOffset((prev) => prev + data.messages.length);

        if (!initial) {
            setTimeout(() => {
                if (container) container.scrollTop = container.scrollHeight - previousScrollHeight;
            }, 0);
        }
        // Mantener scroll en la misma posición
        setTimeout(() => {
            if (container) {
                container.scrollTop = container.scrollHeight - previousScrollHeight;
            }
        }, 0);

        setLoadingMore(false);
    };

    // --- Scroll infinito ---
    // --- Scroll infinito y carga de mensajes antiguos correcta ---
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Inicial: colocar scroll abajo
        container.scrollTop = container.scrollHeight;
        firstLoadRef.current = false;

        const handleScroll = () => {
            if (!hasMore || loadingMore) return;
            // Solo cargar si el usuario hace scroll hacia arriba
            if (container.scrollTop < 50) loadOlderMessages();
        };

        container.addEventListener("scroll", handleScroll);
        return () => container.removeEventListener("scroll", handleScroll);
    }, [hasMore, loadingMore]);

    // --- Efecto para scroll al último mensaje cuando llega uno nuevo ---
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Si el usuario está casi al final, hacemos scroll automático
        const nearBottom =
            container.scrollHeight - container.scrollTop - container.clientHeight < 100;

        if (nearBottom) {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [allMessages]);

    // --- Sincronizar conversación ---
    useEffect(() => {
        if (!conversationData.messages) return;

        setAllMessages([...conversationData.messages].reverse());
        setOffset(conversationData.messages.length); // offset inicial = número de mensajes que ya tenemos
        setHasMore(true); // por si hay más mensajes en la DB
        firstLoadRef.current = true;

        // Marcar notificaciones de este chat como leídas
        setDmNotifications((prev) =>
            prev.filter(
                (n) =>
                    !(
                        (n.type_msg === "NEW_DM_MESSAGE" || n.type_msg === "chat_message") &&
                        n.conversation_id === conversationData.conversation.id
                    )
            )
        );
    }, [conversationData]);


    // --- Scroll al último mensaje ---
    useEffect(() => {
        if (firstLoadRef.current) {
            bottomRef.current?.scrollIntoView({ behavior: "auto" });
            firstLoadRef.current = false;
        } else {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [allMessages]);

    // --- WebSocket para mensajes en tiempo real ---
    useEffect(() => {
        if (!otherParticipant) return;

        const protocol = location.protocol === "https:" ? "wss" : "ws";
        const ws = new WebSocket(`${protocol}://${location.host}/ws/${conversationData.conversation.id}`);

        ws.onopen = () => console.log("[WS] Conectado al WebSocket de", otherParticipant.username);

        ws.onmessage = (event) => {
            const raw = JSON.parse(event.data);
            const data: ChatMessage = {
                id: Date.now(),
                content: raw.content,
                sender_id: raw.from_user,
                created_at: new Date().toISOString(),
            };
            setAllMessages((prev) => [...prev, data]);
        };

        ws.onclose = () => console.log("[WS] Socket cerrado por servidor o cliente");

        setSocket(ws);
        return () => ws.close();
    }, [otherParticipant]);

    // --- Enviar mensaje ---
    const handleSendMessage = () => {
        if (!message.trim() || !socket) return;

        socket.send(JSON.stringify({ content: message }));

        const newMessage: NewDmMessageNotification = {
            type_msg: "NEW_DM_MESSAGE",
            conversation_id: conversationData.conversation.id,
            from_user: user?.id ?? 0,
            to_user: otherParticipant?.id ?? 0,
            created_at: new Date().toISOString(),
            from_user_username: user?.username ?? "",
            from_user_image: user?.image ?? "",
            content: message,
        };

        setNewLastMessage((prev) => {
            const arr = Array.isArray(prev) ? prev : [];
            const filtered = arr.filter(
                (n) => Number(n.conversation_id) !== conversationData.conversation.id
            );
            return [newMessage, ...filtered];
        });

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

            <div className={styles.chatArea} ref={containerRef}>
                {allMessages.map((msg) => {
                    const isOwn = msg.sender_id === user?.id;
                    const time = new Date(msg.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                    });

                    return (
                        <div
                            key={msg.id}
                            className={`${styles.messageBubble} ${isOwn ? styles.ownMessage : styles.otherMessage}`}
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

