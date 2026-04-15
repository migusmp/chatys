import { useNavigate } from "react-router-dom";
import useServerStore from "../../stores/useServerStore";
import type { Channel } from "../../stores/useServerStore";
import styles from "./css/ChannelList.module.css";

// ─── ChannelItem ──────────────────────────────────────────────────────────────

interface ChannelItemProps {
    channel: Channel;
    isActive: boolean;
    onClick: () => void;
}

function ChannelItem({ channel, isActive, onClick }: ChannelItemProps) {
    return (
        <li
            role="option"
            aria-selected={isActive}
            className={`${styles.item} ${isActive ? styles.itemActive : ""}`}
            onClick={onClick}
        >
            <span className={styles.channelHash} aria-hidden="true">#</span>
            <span className={styles.channelName}>{channel.name}</span>
        </li>
    );
}

// ─── ChannelList ──────────────────────────────────────────────────────────────

export default function ChannelList() {
    const navigate = useNavigate();
    const { activeServer, activeChannel, channels, setActiveChannel } = useServerStore();

    if (!activeServer) {
        return (
            <div className={styles.sidebar}>
                <p className={styles.noServer}>Seleccioná un servidor</p>
            </div>
        );
    }

    const serverChannels = channels[activeServer.id] ?? [];

    // Default channel first, rest in original order
    const defaultChannel = serverChannels.find((c) => c.is_default);
    const otherChannels = serverChannels.filter((c) => !c.is_default);
    const sortedChannels: Channel[] = defaultChannel
        ? [defaultChannel, ...otherChannels]
        : serverChannels;

    const handleSelectChannel = (channel: Channel) => {
        setActiveChannel(channel);
        navigate(`/servers/${activeServer.id}/channels/${channel.id}`);
    };

    return (
        <div className={styles.sidebar}>
            {/* Header */}
            <div className={styles.header}>
                <span className={styles.headerName} title={activeServer.name}>
                    {activeServer.name}
                </span>
                {/* Settings icon — placeholder for Phase 2 */}
                <button
                    type="button"
                    className={styles.settingsBtn}
                    aria-label="Configuración del servidor"
                    disabled
                    title="Próximamente"
                >
                    ⚙
                </button>
            </div>

            {/* Channel list */}
            <p className={styles.sectionLabel}>Canales de texto</p>

            {sortedChannels.length === 0 ? (
                <p className={styles.empty}>Sin canales aún.</p>
            ) : (
                <ul className={styles.list} role="listbox" aria-label="Canales">
                    {sortedChannels.map((channel) => (
                        <ChannelItem
                            key={channel.id}
                            channel={channel}
                            isActive={activeChannel?.id === channel.id}
                            onClick={() => handleSelectChannel(channel)}
                        />
                    ))}
                </ul>
            )}
        </div>
    );
}
