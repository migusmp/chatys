import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import useServerStore from "../../stores/useServerStore";
import type { ServerSummary, Channel } from "../../stores/useServerStore";
import styles from "./css/ServersLanding.module.css";
import ServerCard from "./ServerCard";

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
                            <ServerCard
                                key={server.id}
                                name={server.name}
                                memberCount={server.member_count}
                                image={server.image}
                                description={server.description}
                                onClick={() => enterServer(server.id, server)}
                                isEnter
                            />
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
                            <ServerCard
                                key={server.id}
                                name={server.name}
                                memberCount={server.member_count}
                                image={server.image}
                                description={server.description}
                                friendsInServer={server.friends_in_server}
                                buttonText={joinedIds.has(server.id) ? "Unido ✓" : "Unirse"}
                                onButtonClick={(e) => {
                                    e.stopPropagation();
                                    handleJoin(server);
                                }}
                                buttonDisabled={joiningId === server.id || joinedIds.has(server.id)}
                                isJoined={joinedIds.has(server.id)}
                            />
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
                            <ServerCard
                                key={server.id}
                                name={server.name}
                                memberCount={server.member_count}
                                image={server.image}
                                description={server.description}
                                buttonText={joinedIds.has(server.id) ? "Unido ✓" : "Unirse"}
                                onButtonClick={(e) => {
                                    e.stopPropagation();
                                    handleJoin(server);
                                }}
                                buttonDisabled={joiningId === server.id || joinedIds.has(server.id)}
                                isJoined={joinedIds.has(server.id)}
                            />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
