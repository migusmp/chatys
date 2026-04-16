import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import useServerStore from "../../stores/useServerStore";
import type { ServerSummary, Channel } from "../../stores/useServerStore";
import styles from "./css/ServersLanding.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FriendServer {
    id: string;
    name: string;
    description?: string;
    image?: string;
    is_public: boolean;
    member_count: number;
    friends_in_server: string[];
}

interface Props {
    onCreateServer: () => void;
    onJoinServer: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ServerAvatar({ name, image }: { name: string; image?: string }) {
    return (
        <div className={styles.cardAvatar}>
            {image ? (
                <img src={image} alt={name} />
            ) : (
                <span className={styles.cardAvatarLetter}>{name.charAt(0)}</span>
            )}
        </div>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ServersLanding({ onCreateServer, onJoinServer }: Props) {
    const navigate = useNavigate();

    const servers         = useServerStore((s) => s.servers);
    const channels        = useServerStore((s) => s.channels);
    const fetchServers    = useServerStore((s) => s.fetchServers);
    const fetchChannels   = useServerStore((s) => s.fetchChannels);
    const setChannels     = useServerStore((s) => s.setChannels);
    const setActiveServer = useServerStore((s) => s.setActiveServer);
    const setActiveChannel = useServerStore((s) => s.setActiveChannel);

    const [publicServers, setPublicServers]     = useState<ServerSummary[]>([]);
    const [friendServers, setFriendServers]     = useState<FriendServer[]>([]);
    const [loading, setLoading]                 = useState(true);
    const [joiningId, setJoiningId]             = useState<string | null>(null);
    const [joinedIds, setJoinedIds]             = useState<Set<string>>(new Set());

    // ── Data loading ──────────────────────────────────────────────────────────

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                // Both in parallel
                const [serversRes, friendsRes] = await Promise.all([
                    fetch("/api/servers", { credentials: "include" }),
                    fetch("/api/servers/friends", { credentials: "include" }),
                ]);

                if (serversRes.ok) {
                    const body = await serversRes.json();
                    const all: ServerSummary[] = body.data ?? body;
                    setPublicServers(all.filter((s) => s.is_public && !s.member_role));
                }

                if (friendsRes.ok) {
                    const body = await friendsRes.json();
                    setFriendServers(body.data ?? []);
                }
            } catch {
                // silently ignore
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // ── Navigation into a joined server ──────────────────────────────────────

    const enterServer = useCallback(
        async (serverId: string, serverObj: object) => {
            let serverChannels = channels[serverId];
            if (!serverChannels) {
                await fetchChannels(serverId);
                serverChannels = useServerStore.getState().channels[serverId] ?? [];
            }
            setActiveServer(serverObj as Parameters<typeof setActiveServer>[0]);
            const defaultChannel = serverChannels.find((c) => c.is_default) ?? serverChannels[0];
            if (defaultChannel) {
                setActiveChannel(defaultChannel);
                navigate(`/servers/${serverId}/channels/${defaultChannel.id}`);
            } else {
                navigate(`/servers/${serverId}`);
            }
        },
        [channels, fetchChannels, setActiveServer, setActiveChannel, navigate],
    );

    // ── Join a new server ─────────────────────────────────────────────────────

    const handleJoin = async (server: ServerSummary | FriendServer) => {
        setJoiningId(server.id);
        try {
            const res = await fetch(`/api/servers/${server.id}/join`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });

            if (!res.ok) return;

            const responseBody = await res.json().catch(() => null);
            const detail = responseBody?.data ?? null;

            setJoinedIds((prev) => new Set(prev).add(server.id));
            await fetchServers();

            if (detail) {
                const detailChannels: Channel[] = detail.channels ?? [];
                setChannels(server.id, detailChannels);
                setActiveServer(detail);
                const defaultChannel =
                    detailChannels.find((c) => c.is_default) ?? detailChannels[0];
                if (defaultChannel) {
                    setActiveChannel(defaultChannel);
                    navigate(`/servers/${server.id}/channels/${defaultChannel.id}`);
                }
            }
        } catch {
            // silently ignore
        } finally {
            setJoiningId(null);
        }
    };

    // ── Derived data ──────────────────────────────────────────────────────────

    const myServers = servers.filter((s) => s.member_role);

    // Public servers where no friend is present (deduplicate from friendServers)
    const friendServerIds = new Set(friendServers.map((s) => s.id));
    const discoveryServers = publicServers.filter((s) => !friendServerIds.has(s.id));

    // ── Render helpers ────────────────────────────────────────────────────────

    const renderJoinBtn = (server: ServerSummary | FriendServer) => {
        const isJoining = joiningId === server.id;
        const joined    = joinedIds.has(server.id);
        if (joined) {
            return <div className={styles.cardJoinedBtn}>Unido ✓</div>;
        }
        return (
            <button
                type="button"
                className={styles.cardJoinBtn}
                onClick={() => handleJoin(server)}
                disabled={isJoining}
            >
                {isJoining ? "Uniéndose…" : "Unirse"}
            </button>
        );
    };

    return (
        <div className={styles.container}>
            {/* Hero */}
            <div className={styles.hero}>
                <h1 className={styles.heroTitle}>
                    Bienvenido a <span>Servers</span>
                </h1>
                <p className={styles.heroSub}>
                    Encontrá tu comunidad. Unite a un servidor público o creá el tuyo propio.
                </p>
            </div>

            {/* CTAs */}
            <div className={styles.actions}>
                <button type="button" className={styles.btnPrimary} onClick={onCreateServer}>
                    + Crear servidor
                </button>
                <button type="button" className={styles.btnSecondary} onClick={onJoinServer}>
                    🧭 Explorar todos
                </button>
            </div>

            {/* ── Tus servidores ───────────────────────────────────────────── */}
            {myServers.length > 0 && (
                <section>
                    <p className={styles.sectionHeading}>Tus servidores</p>
                    <div className={styles.grid}>
                        {myServers.map((server) => (
                            <div key={server.id} className={styles.card}>
                                <div className={styles.cardTop}>
                                    <ServerAvatar name={server.name} image={server.image} />
                                    <div className={styles.cardInfo}>
                                        <p className={styles.cardName}>{server.name}</p>
                                        <p className={styles.cardMembers}>
                                            {server.member_count}{" "}
                                            {server.member_count === 1 ? "miembro" : "miembros"}
                                        </p>
                                    </div>
                                </div>
                                {server.description && (
                                    <p className={styles.cardDescription}>{server.description}</p>
                                )}
                                <button
                                    type="button"
                                    className={styles.cardEnterBtn}
                                    onClick={() => enterServer(server.id, server)}
                                >
                                    Entrar →
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ── Servidores de tus amigos ─────────────────────────────────── */}
            {!loading && friendServers.length > 0 && (
                <section>
                    <p className={styles.sectionHeading}>Servidores de tus amigos</p>
                    <div className={styles.grid}>
                        {friendServers.map((server) => (
                            <div key={server.id} className={styles.card}>
                                <div className={styles.cardTop}>
                                    <ServerAvatar name={server.name} image={server.image} />
                                    <div className={styles.cardInfo}>
                                        <p className={styles.cardName}>{server.name}</p>
                                        <p className={styles.cardMembers}>
                                            {server.member_count}{" "}
                                            {server.member_count === 1 ? "miembro" : "miembros"}
                                        </p>
                                    </div>
                                </div>
                                {server.description && (
                                    <p className={styles.cardDescription}>{server.description}</p>
                                )}
                                <p className={styles.cardFriends}>
                                    👥{" "}
                                    {server.friends_in_server.slice(0, 3).join(", ")}
                                    {server.friends_in_server.length > 3 &&
                                        ` y ${server.friends_in_server.length - 3} más`}
                                </p>
                                {renderJoinBtn(server)}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ── Descubrí más ─────────────────────────────────────────────── */}
            <section>
                <p className={styles.sectionHeading}>Descubrí más servidores</p>
                {loading && <p className={styles.loading}>Cargando…</p>}
                {!loading && discoveryServers.length === 0 && (
                    <p className={styles.empty}>No hay más servidores públicos disponibles.</p>
                )}
                {!loading && discoveryServers.length > 0 && (
                    <div className={styles.grid}>
                        {discoveryServers.map((server) => (
                            <div key={server.id} className={styles.card}>
                                <div className={styles.cardTop}>
                                    <ServerAvatar name={server.name} image={server.image} />
                                    <div className={styles.cardInfo}>
                                        <p className={styles.cardName}>{server.name}</p>
                                        <p className={styles.cardMembers}>
                                            {server.member_count}{" "}
                                            {server.member_count === 1 ? "miembro" : "miembros"}
                                        </p>
                                    </div>
                                </div>
                                {server.description && (
                                    <p className={styles.cardDescription}>{server.description}</p>
                                )}
                                {renderJoinBtn(server)}
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
