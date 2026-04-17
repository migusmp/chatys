import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ServerSidebar from "../../servers/ServerSidebar";
import ChannelList from "../../servers/ChannelList";
import ChannelView from "../../servers/ChannelView";
import ServerMembersSidebar from "../../servers/ServerMembersSidebar";
import ServersLanding from "../../servers/ServersLanding";
import CreateServerModal from "../../servers/CreateServerModal";
import JoinServerModal from "../../servers/JoinServerModal";
import useServerStore from "../../../stores/useServerStore";
import useIsMobile from "../../../hooks/useIsMobile";
import styles from "../chats/css/Chats.module.css";

export default function ServersPage() {
    const [createOpen, setCreateOpen] = useState(false);
    const [joinOpen, setJoinOpen] = useState(false);

    const { serverId, channelId } = useParams<{ serverId: string; channelId: string }>();
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    const activeServer = useServerStore((s) => s.activeServer);

    // Stable action selectors — these never change reference (Zustand actions are stable)
    const fetchServers    = useServerStore((s) => s.fetchServers);
    const fetchChannels   = useServerStore((s) => s.fetchChannels);
    const setActiveServer = useServerStore((s) => s.setActiveServer);
    const setActiveChannel = useServerStore((s) => s.setActiveChannel);

    /**
     * Single init effect — runs only when the URL params change.
     * Reads fresh state via getState() after each await so it never has
     * stale-closure issues and never reacts to intermediate store changes
     * (which was the cause of the cascading re-render loops).
     */
    useEffect(() => {
        let cancelled = false;

        const init = async () => {
            // 1. Load servers if not already in the store
            if (useServerStore.getState().servers.length === 0) {
                await fetchServers();
            }
            if (cancelled) return;

            if (!serverId) {
                // Root /servers — clear any previously active server so the landing shows
                setActiveServer(null);
                setActiveChannel(null);
                return;
            }

            // 2. Load channels for this server if not cached
            if (!useServerStore.getState().channels[serverId]) {
                await fetchChannels(serverId);
            }
            if (cancelled) return;

            // 3. Set active server + channel from fresh (post-fetch) state
            const { servers, channels } = useServerStore.getState();

            const found = servers.find((s) => s.id === serverId);
            if (found) {
                setActiveServer(found as unknown as Parameters<typeof setActiveServer>[0]);
            }

            if (channelId) {
                const serverChannels = channels[serverId] ?? [];
                const channel = serverChannels.find((c) => c.id === channelId);
                if (channel) setActiveChannel(channel);
            }
        };

        init();
        return () => { cancelled = true; };
    }, [serverId, channelId]); // eslint-disable-line react-hooks/exhaustive-deps

    const modals = (
        <>
            <CreateServerModal open={createOpen} onClose={() => setCreateOpen(false)} />
            <JoinServerModal open={joinOpen} onClose={() => setJoinOpen(false)} />
        </>
    );

    // ── Mobile layout: one panel at a time ────────────────────────────────────
    if (isMobile) {
        if (activeServer && channelId) {
            return (
                <div className={styles.layout}>
                    <ChannelView onBack={() => navigate(`/servers/${serverId}`)} />
                    {modals}
                </div>
            );
        }

        if (activeServer) {
            return (
                <div className={styles.layout}>
                    <ChannelList onBack={() => navigate("/servers")} />
                    {modals}
                </div>
            );
        }

        return (
            <div className={styles.layout}>
                <ServerSidebar
                    onCreateServer={() => setCreateOpen(true)}
                    onJoinServer={() => setJoinOpen(true)}
                />
                <ServersLanding
                    onCreateServer={() => setCreateOpen(true)}
                    onJoinServer={() => setJoinOpen(true)}
                />
                {modals}
            </div>
        );
    }

    // ── Desktop layout ────────────────────────────────────────────────────────
    return (
        <div className={styles.layout}>
            <ServerSidebar
                onCreateServer={() => setCreateOpen(true)}
                onJoinServer={() => setJoinOpen(true)}
            />

            {activeServer ? (
                <>
                    <ChannelList />
                    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                        <ChannelView />
                    </div>
                    <ServerMembersSidebar />
                </>
            ) : (
                <ServersLanding
                    onCreateServer={() => setCreateOpen(true)}
                    onJoinServer={() => setJoinOpen(true)}
                />
            )}

            {modals}
        </div>
    );
}
