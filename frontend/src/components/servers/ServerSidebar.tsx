import { useNavigate } from "react-router-dom";
import useServerStore from "../../stores/useServerStore";
import type { Server, ServerSummary } from "../../stores/useServerStore";
import styles from "./css/ServerSidebar.module.css";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
    onCreateServer: () => void;
    onJoinServer: () => void;
}

// ─── ServerIcon ───────────────────────────────────────────────────────────────

interface ServerIconProps {
    server: ServerSummary;
    isActive: boolean;
    onClick: () => void;
}

function ServerIcon({ server, isActive, onClick }: ServerIconProps) {
    return (
        <button
            type="button"
            className={`${styles.serverBtn} ${isActive ? styles.serverBtnActive : ""}`}
            onClick={onClick}
            aria-label={server.name}
            aria-pressed={isActive}
            style={{ overflow: "hidden" }}
        >
            {isActive && <span className={styles.activeIndicator} aria-hidden="true" />}

            {server.image ? (
                <img
                    src={server.image.startsWith("/") ? server.image : `/media/servers/${server.image}`}
                    alt={server.name}
                    className={styles.serverImg}
                />
            ) : (
                <div className={styles.serverLetter}>
                    {server.name.charAt(0)}
                </div>
            )}

            <span className={styles.tooltip} role="tooltip">
                {server.name}
            </span>
        </button>
    );
}

// ─── ServerSidebar ────────────────────────────────────────────────────────────

export default function ServerSidebar({ onCreateServer, onJoinServer }: Props) {
    const navigate = useNavigate();
    const servers       = useServerStore((s) => s.servers);
    const activeServer  = useServerStore((s) => s.activeServer);
    const channels      = useServerStore((s) => s.channels);
    const setActiveServer = useServerStore((s) => s.setActiveServer);
    const fetchChannels = useServerStore((s) => s.fetchChannels);

    const handleSelectServer = async (server: ServerSummary) => {
        // ServerSummary is a subset of Server; cast is safe here since the store
        // only reads id/name/image for display purposes when active.
        setActiveServer(server as unknown as Server);

        // Ensure channels are loaded
        if (!channels[server.id]) {
            await fetchChannels(server.id);
        }

        // Navigate to first channel (default channel preferred)
        const serverChannels = useServerStore.getState().channels[server.id] ?? [];
        const defaultChannel =
            serverChannels.find((c) => c.is_default) ?? serverChannels[0];

        if (defaultChannel) {
            navigate(`/servers/${server.id}/channels/${defaultChannel.id}`);
        } else {
            navigate(`/servers/${server.id}`);
        }
    };

    return (
        <nav className={styles.rail} aria-label="Servidores">
            {servers.map((server) => (
                <ServerIcon
                    key={server.id}
                    server={server}
                    isActive={activeServer?.id === server.id}
                    onClick={() => handleSelectServer(server)}
                />
            ))}

            {servers.length > 0 && <div className={styles.divider} />}

            {/* Join server */}
            <button
                type="button"
                className={styles.actionBtn}
                onClick={onJoinServer}
                aria-label="Explorar y unirse a servidores"
            >
                🧭
                <span className={styles.tooltip} role="tooltip">
                    Explorar servidores
                </span>
            </button>

            {/* Create server */}
            <button
                type="button"
                className={styles.actionBtn}
                onClick={onCreateServer}
                aria-label="Crear servidor"
            >
                +
                <span className={styles.tooltip} role="tooltip">
                    Crear servidor
                </span>
            </button>
        </nav>
    );
}
