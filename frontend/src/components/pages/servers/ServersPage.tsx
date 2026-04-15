import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import ServerSidebar from "../../servers/ServerSidebar";
import ChannelList from "../../servers/ChannelList";
import ChannelView from "../../servers/ChannelView";
import CreateServerModal from "../../servers/CreateServerModal";
import JoinServerModal from "../../servers/JoinServerModal";
import useServerStore from "../../../stores/useServerStore";
import styles from "../chats/css/Chats.module.css";

export default function ServersPage() {
    const [createOpen, setCreateOpen] = useState(false);
    const [joinOpen, setJoinOpen] = useState(false);

    const { serverId, channelId } = useParams<{ serverId: string; channelId: string }>();
    const { fetchServers, fetchChannels, servers, channels, setActiveServer, setActiveChannel } = useServerStore();

    // Bootstrap: load user's servers on mount
    useEffect(() => {
        fetchServers();
    }, []);

    // Sync active server/channel from URL params
    useEffect(() => {
        if (!serverId) return;

        const load = async () => {
            // Ensure channels for this server are loaded
            if (!channels[serverId]) {
                await fetchChannels(serverId);
            }

            const storeState = useServerStore.getState();

            // Set active server from store list; fall back to a minimal shape if not found yet
            const found = storeState.servers.find((s) => s.id === serverId);
            if (found) {
                storeState.setActiveServer(found as Parameters<typeof storeState.setActiveServer>[0]);
            }

            // Set active channel from URL
            if (channelId) {
                const serverChannels = storeState.channels[serverId] ?? [];
                const channel = serverChannels.find((c) => c.id === channelId);
                if (channel) {
                    storeState.setActiveChannel(channel);
                }
            }
        };

        load();
    }, [serverId, channelId]);

    // Once servers are loaded, re-sync the active server object (handles page refresh)
    useEffect(() => {
        if (!serverId || servers.length === 0) return;

        const found = servers.find((s) => s.id === serverId);
        if (found) {
            setActiveServer(found as Parameters<typeof setActiveServer>[0]);
        }
    }, [servers, serverId]);

    // Re-sync active channel when channels load for the active server
    useEffect(() => {
        if (!serverId || !channelId) return;

        const serverChannels = channels[serverId];
        if (!serverChannels) return;

        const channel = serverChannels.find((c) => c.id === channelId);
        if (channel) {
            setActiveChannel(channel);
        }
    }, [channels, serverId, channelId]);

    return (
        <div className={styles.layout}>
            <ServerSidebar
                onCreateServer={() => setCreateOpen(true)}
                onJoinServer={() => setJoinOpen(true)}
            />
            <ChannelList />
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                <ChannelView />
            </div>

            <CreateServerModal open={createOpen} onClose={() => setCreateOpen(false)} />
            <JoinServerModal open={joinOpen} onClose={() => setJoinOpen(false)} />
        </div>
    );
}
