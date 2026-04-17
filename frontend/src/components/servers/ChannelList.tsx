import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useServerStore from "../../stores/useServerStore";
import type { Channel } from "../../stores/useServerStore";
import ServerAdminModal from "./ServerAdminModal";
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

interface ChannelListProps {
    onBack?: () => void;
}

export default function ChannelList({ onBack }: ChannelListProps = {}) {
    const navigate = useNavigate();
    const activeServer   = useServerStore((s) => s.activeServer);
    const activeChannel  = useServerStore((s) => s.activeChannel);
    const channels       = useServerStore((s) => s.channels);
    const setActiveChannel = useServerStore((s) => s.setActiveChannel);

    const [adminOpen, setAdminOpen] = useState(false);

    if (!activeServer) return null;

    const isAdmin =
        activeServer.member_role === "owner" || activeServer.member_role === "admin";

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
        <>
            <div className={styles.sidebar}>
                {/* Header */}
                <div className={styles.header}>
                    {onBack && (
                        <button
                            type="button"
                            className={styles.backBtn}
                            onClick={onBack}
                            aria-label="Volver"
                        >
                            ‹
                        </button>
                    )}
                    {/* Server avatar in header */}
                    {activeServer.image ? (
                        <img
                            src={activeServer.image.startsWith("/") ? activeServer.image : `/media/servers/${activeServer.image}`}
                            alt={activeServer.name}
                            className={styles.headerAvatar}
                        />
                    ) : (
                        <div className={styles.headerAvatarPlaceholder}>
                            {activeServer.name.charAt(0).toUpperCase()}
                        </div>
                    )}

                    <span className={styles.headerName} title={activeServer.name}>
                        {activeServer.name}
                    </span>

                    {isAdmin && (
                        <button
                            type="button"
                            className={styles.settingsBtn}
                            aria-label="Administrar servidor"
                            onClick={() => setAdminOpen(true)}
                            title="Administrar servidor"
                        >
                            <i className="bi bi-gear" />
                        </button>
                    )}
                </div>

                {/* Channel list */}
                <div className={styles.sectionHeader}>
                    <p className={styles.sectionLabel}>Canales de texto</p>
                    {isAdmin && (
                        <button
                            type="button"
                            className={styles.addChannelBtn}
                            onClick={() => setAdminOpen(true)}
                            title="Crear canal"
                            aria-label="Crear canal de texto"
                        >
                            +
                        </button>
                    )}
                </div>

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

            {adminOpen && <ServerAdminModal onClose={() => setAdminOpen(false)} />}
        </>
    );
}
