import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useUserProfileContext } from "../../../context/UserContext";
import { useRoomSocket } from "../../../hooks/useRoomSocket";
import useIsMobile from "../../../hooks/useIsMobile";
import styles from "./css/Chats.module.css";
import roomListStyles from "./css/RoomList.module.css";
import chatStyles from "./css/ChatRoom.module.css";

// ─── Types ───────────────────────────────────────────────────────────────────

type ActiveRoom = {
    name: string;
    users: number;
    description?: string;
    image?: string;
};

type ActiveRoomsPayload = {
    rooms_active: ActiveRoom[];
    rooms_length: number;
    users_active: number;
};

type CreateRoomForm = {
    name: string;
    description: string;
    imagePreview: string | null;
    imageFile: File | null;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const GLOBAL_ROOM = "Global";
const WS_PROTOCOL = location.protocol === "https:" ? "wss" : "ws";
const MAX_ROOM_NAME_LENGTH = 40;
const MAX_DESCRIPTION_LENGTH = 200;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(isoOrFallback?: string): string {
    const date = isoOrFallback ? new Date(isoOrFallback) : new Date();
    if (isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── CreateRoomModal ──────────────────────────────────────────────────────────

type CreateRoomModalProps = {
    onClose: () => void;
    onCreated: (name: string) => void;
};

function CreateRoomModal({ onClose, onCreated }: CreateRoomModalProps) {
    const [form, setForm] = useState<CreateRoomForm>({
        name: "",
        description: "",
        imagePreview: null,
        imageFile: null,
    });
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            setError("Solo se permiten imágenes.");
            return;
        }

        if (file.size > MAX_IMAGE_SIZE_BYTES) {
            setError("La imagen no puede superar los 5 MB.");
            return;
        }

        // Keep base64 only for the <img> preview; the actual File is sent to the backend
        const reader = new FileReader();
        reader.onload = (ev) => {
            setForm((prev) => ({
                ...prev,
                imagePreview: ev.target?.result as string,
                imageFile: file,
            }));
        };
        reader.readAsDataURL(file);
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const trimmedName = form.name.trim();
        if (!trimmedName) {
            setError("El nombre de la sala es obligatorio.");
            return;
        }

        if (trimmedName.toLowerCase() === "global") {
            setError('El nombre "Global" está reservado.');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append("name", trimmedName);
            if (form.description.trim()) {
                formData.append("description", form.description.trim());
            }
            if (form.imageFile) {
                formData.append("image", form.imageFile);
            }

            const res = await fetch("/api/chat/create", {
                method: "POST",
                credentials: "include",
                body: formData,
            });

            if (!res.ok) {
                const body = await res.json().catch(() => null);
                setError(body?.message ?? "No se pudo crear la sala.");
                return;
            }

            onCreated(trimmedName);
        } catch {
            setError("Error de red al crear la sala.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") onClose();
    };

    return (
        <div
            className={roomListStyles.modalOverlay}
            onClick={(e) => e.target === e.currentTarget && onClose()}
            onKeyDown={handleKeyDown}
        >
            <div className={roomListStyles.modal} role="dialog" aria-modal="true" aria-labelledby="create-room-title">
                <div className={roomListStyles.modalHeader}>
                    <h2 id="create-room-title" className={roomListStyles.modalTitle}>Nueva sala</h2>
                    <button
                        type="button"
                        className={roomListStyles.modalCloseBtn}
                        onClick={onClose}
                        aria-label="Cerrar"
                    >
                        ✕
                    </button>
                </div>

                <div className={roomListStyles.avatarPicker}>
                    <button
                        type="button"
                        className={roomListStyles.avatarPickerBtn}
                        onClick={() => fileInputRef.current?.click()}
                        aria-label="Subir foto de sala"
                    >
                        {form.imagePreview ? (
                            <img src={form.imagePreview} alt="Vista previa" className={roomListStyles.avatarPickerImg} />
                        ) : (
                            <span className={roomListStyles.avatarPickerPlaceholder}>#</span>
                        )}
                        <div className={roomListStyles.avatarPickerOverlay}>📷</div>
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className={roomListStyles.hiddenFileInput}
                        onChange={handleImageChange}
                    />
                    <span className={roomListStyles.avatarPickerHint}>Foto opcional (máx. 5 MB)</span>
                </div>

                <form onSubmit={handleSubmit} className={roomListStyles.modalFields}>
                    <div className={roomListStyles.modalField}>
                        <label htmlFor="room-name" className={roomListStyles.modalLabel}>
                            Nombre *
                        </label>
                        <input
                            id="room-name"
                            type="text"
                            className={roomListStyles.modalInput}
                            value={form.name}
                            onChange={(e) => {
                                setForm((prev) => ({ ...prev, name: e.target.value }));
                                setError(null);
                            }}
                            placeholder="ej. gaming, música, general…"
                            maxLength={MAX_ROOM_NAME_LENGTH}
                            autoFocus
                            autoComplete="off"
                        />
                    </div>

                    <div className={roomListStyles.modalField}>
                        <label htmlFor="room-description" className={roomListStyles.modalLabel}>
                            Descripción
                        </label>
                        <textarea
                            id="room-description"
                            className={roomListStyles.modalTextarea}
                            value={form.description}
                            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                            placeholder="¿De qué trata esta sala?"
                            maxLength={MAX_DESCRIPTION_LENGTH}
                            rows={3}
                        />
                    </div>

                    {error && <div className={roomListStyles.errorBanner}>{error}</div>}

                    <div className={roomListStyles.modalActions}>
                        <button
                            type="submit"
                            className={roomListStyles.modalSubmitBtn}
                            disabled={submitting || !form.name.trim()}
                        >
                            {submitting ? "Creando…" : "Crear sala"}
                        </button>
                        <button
                            type="button"
                            className={roomListStyles.modalCancelBtn}
                            onClick={onClose}
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── RoomList component ───────────────────────────────────────────────────────

type RoomListProps = {
    rooms: ActiveRoom[];
    activeRoom: string | null;
    totalUsers: number;
    onSelectRoom: (name: string) => void;
    onCreateRoom: (name: string) => void;
    isMobile?: boolean;
};

function RoomList({ rooms, activeRoom, totalUsers, onSelectRoom, onCreateRoom, isMobile }: RoomListProps) {
    const [filter, setFilter] = useState("");
    const [showCreateModal, setShowCreateModal] = useState(false);

    const filteredRooms = filter.trim()
        ? rooms.filter((r) => r.name.toLowerCase().includes(filter.toLowerCase()))
        : rooms;

    // Global room is pinned at top; rest sorted by user count desc
    const globalRoom = filteredRooms.find((r) => r.name === GLOBAL_ROOM);
    const otherRooms = filteredRooms
        .filter((r) => r.name !== GLOBAL_ROOM)
        .sort((a, b) => b.users - a.users);
    const sortedRooms = globalRoom ? [globalRoom, ...otherRooms] : otherRooms;

    const handleCreated = (name: string) => {
        setShowCreateModal(false);
        onCreateRoom(name);
    };

    return (
        <>
            <div className={`${roomListStyles.sidebar} ${isMobile ? roomListStyles.sidebarMobile : ""}`}>
                <div className={roomListStyles.header}>
                    <div className={roomListStyles.headerTop}>
                        <h2 className={roomListStyles.headerTitle}>Salas</h2>
                        {totalUsers > 0 && (
                            <span className={roomListStyles.statsChip}>
                                {totalUsers} en línea
                            </span>
                        )}
                    </div>

                    <button
                        className={roomListStyles.newRoomBtn}
                        onClick={() => setShowCreateModal(true)}
                        type="button"
                    >
                        <span>＋</span>
                        <span>Nueva sala</span>
                    </button>

                    <div className={roomListStyles.searchWrapper}>
                        <input
                            className={roomListStyles.searchInput}
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            placeholder="Buscar sala…"
                            type="search"
                        />
                    </div>
                </div>

                {sortedRooms.length === 0 ? (
                    <p className={roomListStyles.emptyRooms}>
                        {filter ? "Sin resultados." : "Sin salas activas."}
                    </p>
                ) : (
                    <ul className={roomListStyles.list} role="listbox">
                        {sortedRooms.map((room) => {
                            const isGlobal = room.name === GLOBAL_ROOM;
                            const isActive = room.name === activeRoom;
                            return (
                                <li
                                    key={room.name}
                                    role="option"
                                    aria-selected={isActive}
                                    className={`${roomListStyles.item} ${isActive ? roomListStyles.itemActive : ""}`}
                                    onClick={() => onSelectRoom(room.name)}
                                >
                                    <div className={roomListStyles.roomIcon}>
                                        {room.image ? (
                                            <img
                                                src={room.image}
                                                alt={room.name}
                                                className={roomListStyles.roomIconImg}
                                            />
                                        ) : isGlobal ? "📡" : "#"}
                                    </div>
                                    <div className={roomListStyles.roomInfo}>
                                        <span className={roomListStyles.roomName}>{room.name}</span>
                                        <span className={roomListStyles.roomMeta}>
                                            {room.description
                                                ? room.description
                                                : isGlobal
                                                    ? "Sala principal"
                                                    : "Sala pública"}
                                        </span>
                                    </div>
                                    <span className={roomListStyles.usersBadge}>
                                        {room.users} {room.users === 1 ? "usuario" : "usuarios"}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {showCreateModal && (
                <CreateRoomModal
                    onClose={() => setShowCreateModal(false)}
                    onCreated={handleCreated}
                />
            )}
        </>
    );
}

// ─── ChatRoom component ───────────────────────────────────────────────────────

type ChatRoomProps = {
    roomId: string;
    userCount: number;
    currentUserId: number | undefined;
    onBack?: () => void;
};

function ChatRoom({ roomId, userCount, currentUserId, onBack }: ChatRoomProps) {
    const { messages, connected, sendMessage } = useRoomSocket(roomId, currentUserId);
    const [inputValue, setInputValue] = useState("");
    const chatAreaRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        const el = chatAreaRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [messages]);

    const handleSend = () => {
        const trimmed = inputValue.trim();
        if (!trimmed || !connected) return;
        sendMessage(trimmed);
        setInputValue("");
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className={chatStyles.container}>
            {/* Header */}
            <div className={chatStyles.header}>
                <div className={chatStyles.headerLeft}>
                    {onBack && (
                        <button className={chatStyles.backBtn} onClick={onBack} aria-label="Volver">
                            ←
                        </button>
                    )}
                    <span className={chatStyles.roomHash}>#</span>
                    <span className={chatStyles.roomName}>{roomId}</span>
                </div>
                <div className={chatStyles.headerRight}>
                    {userCount > 0 && (
                        <span className={chatStyles.usersCount}>
                            <span className={chatStyles.onlineDot} />
                            {userCount} {userCount === 1 ? "usuario" : "usuarios"}
                        </span>
                    )}
                    <span className={connected ? chatStyles.connectedLabel : chatStyles.disconnectedLabel}>
                        {connected ? "conectado" : "reconectando…"}
                    </span>
                </div>
            </div>

            {/* Messages */}
            <div className={chatStyles.chatArea} ref={chatAreaRef}>
                {messages.length === 0 && (
                    <div className={chatStyles.emptyChatState}>
                        <span className={chatStyles.emptyChatIcon}>💬</span>
                        <span>Sin mensajes aún. ¡Sé el primero en escribir!</span>
                    </div>
                )}

                {messages.map((msg, index) => {
                    if (msg.isSystem) {
                        return (
                            <p key={index} className={chatStyles.systemMessage}>
                                {msg.message}
                            </p>
                        );
                    }

                    const isOwn = msg.userId !== undefined && msg.userId === currentUserId;

                    return (
                        <div
                            key={index}
                            className={`${chatStyles.messageGroup} ${
                                isOwn ? chatStyles.messageGroupOwn : chatStyles.messageGroupOther
                            }`}
                        >
                            {!isOwn && (
                                <span className={chatStyles.messageSender}>{msg.user}</span>
                            )}
                            <div
                                className={`${chatStyles.bubble} ${
                                    isOwn ? chatStyles.bubbleOwn : chatStyles.bubbleOther
                                }`}
                            >
                                {msg.message}
                                <span
                                    className={`${chatStyles.bubbleTimestamp} ${
                                        !isOwn ? chatStyles.bubbleTimestampOther : ""
                                    }`}
                                >
                                    {formatTime()}
                                </span>
                            </div>
                            {/* Read receipt indicator — only shown for own persisted messages */}
                            {isOwn && msg.id !== undefined && msg.readBy.length > 0 && (
                                <div
                                    className={chatStyles.readReceipt}
                                    title={msg.readBy.map((r) => r.username).join(", ")}
                                >
                                    Leído por {msg.readBy.length}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Input bar */}
            <div className={chatStyles.inputBar}>
                <div className={chatStyles.inputPill}>
                    <input
                        ref={inputRef}
                        className={chatStyles.textInput}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={connected ? `Mensaje en #${roomId}…` : "Reconectando…"}
                        disabled={!connected}
                        maxLength={2000}
                    />
                </div>
                <button
                    className={chatStyles.sendBtn}
                    onClick={handleSend}
                    disabled={!connected || !inputValue.trim()}
                    aria-label="Enviar mensaje"
                    type="button"
                >
                    ↑
                </button>
            </div>
        </div>
    );
}

// ─── Empty state for "no room selected" ──────────────────────────────────────

function NoRoomSelected() {
    return (
        <div className={chatStyles.noRoomSelected}>
            <div className={chatStyles.noRoomHero}>📡</div>
            <h2 className={chatStyles.noRoomTitle}>Salas de chat</h2>
            <p className={chatStyles.noRoomSubtitle}>
                Selecciona una sala de la lista para unirte a la conversación en tiempo real.
            </p>
        </div>
    );
}

// ─── Main Chats component ─────────────────────────────────────────────────────

export default function Chats() {
    const { user } = useUserProfileContext();
    const isMobile = useIsMobile();
    const navigate = useNavigate();

    // roomName from URL — e.g. /chats/Global → "Global"
    const { roomName } = useParams<{ roomName: string }>();
    const activeRoom = roomName ? decodeURIComponent(roomName) : null;

    const [rooms, setRooms] = useState<ActiveRoom[]>([]);
    const [totalUsers, setTotalUsers] = useState(0);

    // Mobile: when a room is active via URL, show the chat panel directly
    const [mobileView, setMobileView] = useState<"list" | "chat">(
        activeRoom ? "chat" : "list"
    );

    // Sync mobileView when URL changes (e.g. browser back)
    useEffect(() => {
        setMobileView(activeRoom ? "chat" : "list");
    }, [activeRoom]);

    // Active rooms WebSocket
    const activeRoomsWsRef = useRef<WebSocket | null>(null);
    const activeRoomsReconnectRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const activeRoomUserCount = rooms.find((r) => r.name === activeRoom)?.users ?? 0;

    const connectActiveRoomsWs = () => {
        if (
            activeRoomsWsRef.current &&
            activeRoomsWsRef.current.readyState === WebSocket.OPEN
        ) {
            return;
        }

        const ws = new WebSocket(
            `${WS_PROTOCOL}://${location.host}/api/chat/active-rooms`
        );

        ws.addEventListener("message", (event) => {
            try {
                const data: ActiveRoomsPayload = JSON.parse(event.data);
                setRooms(data.rooms_active ?? []);
                setTotalUsers(data.users_active ?? 0);
            } catch {
                // Ignore malformed frames
            }
        });

        ws.addEventListener("close", () => {
            if (activeRoomsReconnectRef.current) return;
            activeRoomsReconnectRef.current = setInterval(() => {
                connectActiveRoomsWs();
                if (
                    activeRoomsWsRef.current?.readyState === WebSocket.OPEN &&
                    activeRoomsReconnectRef.current
                ) {
                    clearInterval(activeRoomsReconnectRef.current);
                    activeRoomsReconnectRef.current = null;
                }
            }, 5000);
        });

        ws.addEventListener("error", () => {
            ws.close();
        });

        activeRoomsWsRef.current = ws;
    };

    useEffect(() => {
        connectActiveRoomsWs();

        return () => {
            if (activeRoomsReconnectRef.current) {
                clearInterval(activeRoomsReconnectRef.current);
            }
            activeRoomsWsRef.current?.close();
        };
    }, []);

    const handleSelectRoom = (name: string) => {
        navigate(`/chats/${encodeURIComponent(name)}`);
        if (isMobile) setMobileView("chat");
    };

    const handleBack = () => {
        navigate("/chats");
        setMobileView("list");
    };

    // ── Mobile layout ──
    if (isMobile) {
        return (
            <div className={styles.layout}>
                {mobileView === "list" || !activeRoom ? (
                    <RoomList
                        rooms={rooms}
                        activeRoom={activeRoom}
                        totalUsers={totalUsers}
                        onSelectRoom={handleSelectRoom}
                        onCreateRoom={handleSelectRoom}
                        isMobile
                    />
                ) : (
                    <ChatRoom
                        roomId={activeRoom}
                        userCount={activeRoomUserCount}
                        currentUserId={user?.id}
                        onBack={handleBack}
                    />
                )}
            </div>
        );
    }

    // ── Desktop layout ──
    return (
        <div className={styles.layout}>
            <RoomList
                rooms={rooms}
                activeRoom={activeRoom}
                totalUsers={totalUsers}
                onSelectRoom={handleSelectRoom}
                onCreateRoom={handleSelectRoom}
            />
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                {activeRoom ? (
                    <ChatRoom
                        roomId={activeRoom}
                        userCount={activeRoomUserCount}
                        currentUserId={user?.id}
                    />
                ) : (
                    <NoRoomSelected />
                )}
            </div>
        </div>
    );
}
