import { useRef, useState } from "react";
import useServerStore from "../../stores/useServerStore";
import type { Channel } from "../../stores/useServerStore";
import styles from "./css/ServerAdminModal.module.css";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
    onClose: () => void;
}

type Tab = "info" | "channels";

// ─── ChannelRow ──────────────────────────────────────────────────────────────

interface ChannelRowProps {
    channel: Channel;
    serverId: string;
    onRenamed: (channelId: string, name: string) => void;
    onDeleted: (channelId: string) => void;
}

function ChannelRow({ channel, serverId, onRenamed, onDeleted }: ChannelRowProps) {
    const renameChannelRemote = useServerStore((s) => s.renameChannelRemote);
    const deleteChannelRemote = useServerStore((s) => s.deleteChannelRemote);

    const [editing, setEditing] = useState(false);
    const [renameVal, setRenameVal] = useState(channel.name);
    const [busy, setBusy] = useState(false);

    const handleRename = async () => {
        const trimmed = renameVal.trim();
        if (!trimmed || trimmed === channel.name) {
            setEditing(false);
            return;
        }
        setBusy(true);
        try {
            await renameChannelRemote(serverId, channel.id, trimmed);
            onRenamed(channel.id, trimmed);
        } catch {
            // ignore
        } finally {
            setBusy(false);
            setEditing(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(`¿Eliminar el canal #${channel.name}?`)) return;
        setBusy(true);
        try {
            await deleteChannelRemote(serverId, channel.id);
            onDeleted(channel.id);
        } catch {
            // ignore
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={`${styles.channelRow} ${channel.is_default ? styles.channelRowDefault : ""}`}>
            <span className={styles.channelHash}>#</span>

            {editing ? (
                <input
                    className={styles.renameInput}
                    value={renameVal}
                    onChange={(e) => setRenameVal(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename();
                        if (e.key === "Escape") setEditing(false);
                    }}
                    autoFocus
                    disabled={busy}
                />
            ) : (
                <span className={styles.channelRowName}>{channel.name}</span>
            )}

            {channel.is_default && !editing && (
                <span className={styles.channelDefaultBadge}>default</span>
            )}

            <div className={styles.channelRowActions}>
                {!channel.is_default && (
                    <>
                        {editing ? (
                            <>
                                <button
                                    type="button"
                                    className={styles.iconBtn}
                                    onClick={handleRename}
                                    disabled={busy}
                                    title="Guardar"
                                >
                                    ✓
                                </button>
                                <button
                                    type="button"
                                    className={styles.iconBtn}
                                    onClick={() => setEditing(false)}
                                    title="Cancelar"
                                >
                                    ✕
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    className={styles.iconBtn}
                                    onClick={() => {
                                        setRenameVal(channel.name);
                                        setEditing(true);
                                    }}
                                    title="Renombrar"
                                >
                                    <i className="bi bi-pencil" />
                                </button>
                                <button
                                    type="button"
                                    className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                                    onClick={handleDelete}
                                    disabled={busy}
                                    title="Eliminar"
                                >
                                    <i className="bi bi-trash" />
                                </button>
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// ─── InfoTab ─────────────────────────────────────────────────────────────────

function InfoTab({ serverId }: { serverId: string }) {
    const activeServer = useServerStore((s) => s.activeServer);
    const updateServerInfo = useServerStore((s) => s.updateServerInfo);
    const updateServerImage = useServerStore((s) => s.updateServerImage);

    const [name, setName] = useState(activeServer?.name ?? "");
    const [description, setDescription] = useState(activeServer?.description ?? "");
    const [isPublic, setIsPublic] = useState(activeServer?.is_public ?? true);
    const [imagePreview, setImagePreview] = useState<string | null>(activeServer?.image ?? null);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPendingFile(file);
        setImagePreview(URL.createObjectURL(file));
    };

    const handleSave = async () => {
        const trimmed = name.trim();
        if (!trimmed) {
            setMessage({ type: "error", text: "El nombre no puede estar vacío." });
            return;
        }
        setSaving(true);
        setMessage(null);
        try {
            await updateServerInfo(serverId, {
                name: trimmed,
                description: description.trim() || undefined,
                is_public: isPublic,
            });

            if (pendingFile) {
                await updateServerImage(serverId, pendingFile);
                setPendingFile(null);
            }

            setMessage({ type: "success", text: "Cambios guardados." });
        } catch {
            setMessage({ type: "error", text: "Error al guardar cambios." });
        } finally {
            setSaving(false);
        }
    };

    const initial = (activeServer?.name ?? "?").charAt(0).toUpperCase();

    return (
        <>
            {/* Image upload */}
            <div className={styles.imageSection}>
                {imagePreview ? (
                    <img src={imagePreview} alt="Server" className={styles.imagePreview} />
                ) : (
                    <div className={styles.imagePlaceholder}>{initial}</div>
                )}
                <div className={styles.imageUploadBtn}>
                    <button
                        type="button"
                        className={styles.uploadBtn}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        Cambiar imagen
                    </button>
                    <span className={styles.uploadHint}>JPEG, PNG, WebP · máx 5 MB</span>
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                />
            </div>

            {/* Name */}
            <div className={styles.field}>
                <label className={styles.label}>Nombre del servidor</label>
                <input
                    className={styles.input}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={100}
                />
            </div>

            {/* Description */}
            <div className={styles.field}>
                <label className={styles.label}>Descripción</label>
                <textarea
                    className={styles.textarea}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={500}
                    placeholder="Describe tu servidor..."
                />
            </div>

            {/* Visibility toggle */}
            <div className={styles.field}>
                <label className={styles.label}>Visibilidad</label>
                <div className={styles.toggleRow}>
                    <span className={styles.toggleLabel}>
                        {isPublic ? "Público — cualquiera puede unirse" : "Privado — solo por invitación"}
                    </span>
                    <button
                        type="button"
                        className={`${styles.toggle} ${isPublic ? styles.toggleOn : styles.toggleOff}`}
                        onClick={() => setIsPublic((v) => !v)}
                        aria-label="Toggle visibility"
                    />
                </div>
            </div>

            {message && (
                <div className={`${styles.message} ${message.type === "error" ? styles.messageError : styles.messageSuccess}`}>
                    {message.text}
                </div>
            )}

            <button
                type="button"
                className={styles.saveBtn}
                onClick={handleSave}
                disabled={saving}
            >
                {saving ? "Guardando…" : "Guardar cambios"}
            </button>
        </>
    );
}

// ─── ChannelsTab ─────────────────────────────────────────────────────────────

function ChannelsTab({ serverId }: { serverId: string }) {
    const channels = useServerStore((s) => s.channels[serverId] ?? []);
    const createChannel = useServerStore((s) => s.createChannel);

    const [newName, setNewName] = useState("");
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Default first, then the rest
    const sorted = [
        ...channels.filter((c) => c.is_default),
        ...channels.filter((c) => !c.is_default),
    ];

    const handleCreate = async () => {
        const trimmed = newName.trim().toLowerCase();
        if (!trimmed) return;
        setCreating(true);
        setError(null);
        try {
            await createChannel(serverId, trimmed);
            setNewName("");
        } catch {
            setError("No se pudo crear el canal. Verificá el nombre (solo letras minúsculas, números y guiones).");
        } finally {
            setCreating(false);
        }
    };

    return (
        <>
            <p className={styles.sectionTitle}>Canales de texto</p>

            {sorted.map((channel) => (
                <ChannelRow
                    key={channel.id}
                    channel={channel}
                    serverId={serverId}
                    onRenamed={() => {}}
                    onDeleted={() => {}}
                />
            ))}

            <div className={styles.addChannelRow}>
                <input
                    className={styles.addChannelInput}
                    placeholder="nuevo-canal"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                    disabled={creating}
                />
                <button
                    type="button"
                    className={styles.addBtn}
                    onClick={handleCreate}
                    disabled={creating || !newName.trim()}
                >
                    + Crear
                </button>
            </div>

            {error && (
                <div className={`${styles.message} ${styles.messageError}`} style={{ marginTop: 8 }}>
                    {error}
                </div>
            )}
        </>
    );
}

// ─── ServerAdminModal ─────────────────────────────────────────────────────────

export default function ServerAdminModal({ onClose }: Props) {
    const activeServer = useServerStore((s) => s.activeServer);
    const [tab, setTab] = useState<Tab>("info");

    if (!activeServer) return null;

    return (
        <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className={styles.modal}>
                {/* Header */}
                <div className={styles.header}>
                    <span className={styles.title}>Administrar servidor</span>
                    <button type="button" className={styles.closeBtn} onClick={onClose}>×</button>
                </div>

                {/* Tabs */}
                <div className={styles.tabs}>
                    <button
                        type="button"
                        className={`${styles.tab} ${tab === "info" ? styles.tabActive : ""}`}
                        onClick={() => setTab("info")}
                    >
                        Información
                    </button>
                    <button
                        type="button"
                        className={`${styles.tab} ${tab === "channels" ? styles.tabActive : ""}`}
                        onClick={() => setTab("channels")}
                    >
                        Canales
                    </button>
                </div>

                {/* Body */}
                <div className={styles.body}>
                    {tab === "info" && <InfoTab serverId={activeServer.id} />}
                    {tab === "channels" && <ChannelsTab serverId={activeServer.id} />}
                </div>
            </div>
        </div>
    );
}
