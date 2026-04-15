import { create } from "zustand";

export interface Server {
  id: string;
  name: string;
  description?: string;
  image?: string;
  is_public: boolean;
  invite_code?: string;
  created_by: number;
  created_at: string;
  member_role?: string;
}

export interface Channel {
  id: string;
  server_id: string;
  conversation_id: number;
  name: string;
  is_default: boolean;
}

export interface ServerMember {
  user_id: number;
  username: string;
  image?: string;
  role: string;
  joined_at: string;
}

export interface ServerSummary {
  id: string;
  name: string;
  description?: string;
  image?: string;
  is_public: boolean;
  member_count: number;
  member_role?: string;
}

interface ServerStore {
  servers: ServerSummary[];
  activeServer: Server | null;
  activeChannel: Channel | null;
  channels: Record<string, Channel[]>;
  members: Record<string, ServerMember[]>;

  // Sync actions
  setServers: (servers: ServerSummary[]) => void;
  setActiveServer: (server: Server | null) => void;
  setActiveChannel: (channel: Channel | null) => void;
  setChannels: (serverId: string, channels: Channel[]) => void;
  setMembers: (serverId: string, members: ServerMember[]) => void;
  addServer: (server: ServerSummary) => void;
  removeServer: (serverId: string) => void;
  updateServer: (serverId: string, updates: Partial<Server>) => void;
  addChannel: (serverId: string, channel: Channel) => void;
  removeChannel: (serverId: string, channelId: string) => void;

  // Async fetchers
  fetchServers: () => Promise<void>;
  fetchChannels: (serverId: string) => Promise<void>;
  fetchMembers: (serverId: string) => Promise<void>;
}

const useServerStore = create<ServerStore>((set) => ({
  servers: [],
  activeServer: null,
  activeChannel: null,
  channels: {},
  members: {},

  setServers: (servers) => set({ servers }),

  setActiveServer: (server) => set({ activeServer: server }),

  setActiveChannel: (channel) => set({ activeChannel: channel }),

  setChannels: (serverId, channels) =>
    set((state) => ({
      channels: { ...state.channels, [serverId]: channels },
    })),

  setMembers: (serverId, members) =>
    set((state) => ({
      members: { ...state.members, [serverId]: members },
    })),

  addServer: (server) =>
    set((state) => ({
      servers: [...state.servers, server],
    })),

  removeServer: (serverId) =>
    set((state) => {
      const { [serverId]: _channels, ...remainingChannels } = state.channels;
      const { [serverId]: _members, ...remainingMembers } = state.members;
      return {
        servers: state.servers.filter((s) => s.id !== serverId),
        channels: remainingChannels,
        members: remainingMembers,
        activeServer:
          state.activeServer?.id === serverId ? null : state.activeServer,
        activeChannel:
          state.activeChannel?.server_id === serverId
            ? null
            : state.activeChannel,
      };
    }),

  updateServer: (serverId, updates) =>
    set((state) => ({
      servers: state.servers.map((s) =>
        s.id === serverId ? { ...s, ...updates } : s
      ),
      activeServer:
        state.activeServer?.id === serverId
          ? { ...state.activeServer, ...updates }
          : state.activeServer,
    })),

  addChannel: (serverId, channel) =>
    set((state) => ({
      channels: {
        ...state.channels,
        [serverId]: [...(state.channels[serverId] ?? []), channel],
      },
    })),

  removeChannel: (serverId, channelId) =>
    set((state) => ({
      channels: {
        ...state.channels,
        [serverId]: (state.channels[serverId] ?? []).filter(
          (c) => c.id !== channelId
        ),
      },
      activeChannel:
        state.activeChannel?.id === channelId ? null : state.activeChannel,
    })),

  fetchServers: async () => {
    try {
      const res = await fetch("/api/server", {
        credentials: "include",
      });
      if (!res.ok) return;
      const servers: ServerSummary[] = await res.json();
      set({ servers });
    } catch {
      // Non-critical: silently ignore network errors
    }
  },

  fetchChannels: async (serverId) => {
    try {
      const res = await fetch(`/api/server/${serverId}/channels`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const channels: Channel[] = await res.json();
      set((state) => ({
        channels: { ...state.channels, [serverId]: channels },
      }));
    } catch {
      // Non-critical: silently ignore network errors
    }
  },

  fetchMembers: async (serverId) => {
    try {
      const res = await fetch(`/api/server/${serverId}/members`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const members: ServerMember[] = await res.json();
      set((state) => ({
        members: { ...state.members, [serverId]: members },
      }));
    } catch {
      // Non-critical: silently ignore network errors
    }
  },
}));

export default useServerStore;
