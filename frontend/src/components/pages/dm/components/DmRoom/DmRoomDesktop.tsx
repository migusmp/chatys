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

    const limit = 10;
    const [offset, setOffset] = useState(allMessages.length);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const firstLoadRef = useRef(true);

    const otherParticipant = conversationData.conversation.participants.find(
        (p) => p.id !== user?.id
    );
    const otherParticipantId = otherParticipant?.id;
    const otherParticipantUsername = otherParticipant?.username;

    function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
        const map = new Map<number, ChatMessage>();
        for (const msg of [...existing, ...incoming]) {
            map.set(msg.id, msg);
        }
        // Mantén el orden por fecha
        return Array.from(map.values()).sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
    }


    const isOnline = checkUserIsOnline(otherParticipant?.id ?? -1);

    // === Cargar mensajes antiguos (scroll arriba, estilo WhatsApp) ===
    const loadOlderMessages = async () => {
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
        const olderMessages = [...data.messages].reverse();

        if (data.messages.length < limit) setHasMore(false);

        // Agregar arriba sin alterar el scroll
        setAllMessages((prev) => mergeMessages(prev, olderMessages));
        setOffset((prev) => prev + data.messages.length);

        // Restaurar posición exacta
        requestAnimationFrame(() => {
            if (container) {
                const newScrollHeight = container.scrollHeight;
                container.scrollTop = newScrollHeight - previousScrollHeight;
            }
        });

        setLoadingMore(false);
    };

    // === Scroll infinito (detectar cuando se llega al top) ===
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            if (container.scrollTop < 80 && !loadingMore && hasMore) {
                loadOlderMessages();
            }
        };

        container.addEventListener("scroll", handleScroll);
        return () => container.removeEventListener("scroll", handleScroll);
    }, [allMessages, hasMore, loadingMore]);

    // === Sincronizar conversación inicial ===
    useEffect(() => {
        if (!conversationData.messages) return;

        setAllMessages([...conversationData.messages].reverse());
        setOffset(conversationData.messages.length);
        setHasMore(true);
        firstLoadRef.current = true;

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

    // === Scroll automático solo en primera carga ===
    useEffect(() => {
        if (firstLoadRef.current) {
            bottomRef.current?.scrollIntoView({ behavior: "auto" });
            firstLoadRef.current = false;
        }
    }, [allMessages.length]);

    // === WebSocket para recibir mensajes en tiempo real ===
    useEffect(() => {
        if (!otherParticipantId || !otherParticipantUsername) return;

        const protocol = location.protocol === "https:" ? "wss" : "ws";
        const ws = new WebSocket(`${protocol}://${location.host}/ws/${conversationData.conversation.id}`);

        ws.onopen = () => console.log("[WS] Conectado al WebSocket de", otherParticipantUsername);

        ws.onmessage = (event) => {
            const raw = JSON.parse(event.data);
            const data: ChatMessage = {
                id: Date.now(),
                content: raw.content,
                sender_id: raw.from_user,
                created_at: new Date().toISOString(),
            };

            const container = containerRef.current;
            const isAtBottom =
                container &&
                container.scrollHeight - container.scrollTop - container.clientHeight < 100;

            setAllMessages((prev) => [...prev, data]);

            // Solo hacer scroll si estaba al fondo (como WhatsApp)
            if (isAtBottom) {
                setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
            }
        };

        ws.onclose = () => console.log("[WS] Socket cerrado por servidor o cliente");

        setSocket(ws);
        return () => {
            ws.onopen = null;
            ws.onmessage = null;
            ws.onclose = null;
            ws.onerror = null;
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close();
            }
            setSocket((prev) => (prev === ws ? null : prev));
        };
    }, [conversationData.conversation.id, otherParticipantId, otherParticipantUsername]);

    // === Enviar mensaje ===
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
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
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
                {loadingMore && (
                    <div className={styles.loaderWrapper}>
                        <div className={styles.loader}></div>
                    </div>
                )}

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
