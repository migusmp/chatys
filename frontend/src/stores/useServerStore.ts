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

  // Async admin actions
  updateServerInfo: (serverId: string, data: { name?: string; description?: string; is_public?: boolean }) => Promise<void>;
  updateServerImage: (serverId: string, file: File) => Promise<string | null>;
  createChannel: (serverId: string, name: string) => Promise<Channel | null>;
  renameChannelRemote: (serverId: string, channelId: string, name: string) => Promise<void>;
  deleteChannelRemote: (serverId: string, channelId: string) => Promise<void>;
  kickMember: (serverId: string, userId: number) => Promise<void>;
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
      const res = await fetch("/api/servers", {
        credentials: "include",
      });
      if (!res.ok) return;
      const body = await res.json();
      const servers: ServerSummary[] = body.data ?? body;
      set({ servers });
    } catch {
      // Non-critical: silently ignore network errors
    }
  },

  fetchChannels: async (serverId) => {
    try {
      const res = await fetch(`/api/servers/${serverId}/channels`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const body = await res.json();
      const channels: Channel[] = body.data ?? body;
      set((state) => ({
        channels: { ...state.channels, [serverId]: channels },
      }));
    } catch {
      // Non-critical: silently ignore network errors
    }
  },

  fetchMembers: async (serverId) => {
    try {
      const res = await fetch(`/api/servers/${serverId}/members`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const body = await res.json();
      const members: ServerMember[] = body.data ?? body;
      set((state) => ({
        members: { ...state.members, [serverId]: members },
      }));
    } catch {
      // Non-critical: silently ignore network errors
    }
  },

  updateServerInfo: async (serverId, data) => {
    const res = await fetch(`/api/servers/${serverId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update server");
    const body = await res.json();
    const updated = body.data ?? body;
    set((state) => ({
      servers: state.servers.map((s) =>
        s.id === serverId ? { ...s, ...updated } : s
      ),
      activeServer:
        state.activeServer?.id === serverId
          ? { ...state.activeServer, ...updated }
          : state.activeServer,
    }));
  },

  updateServerImage: async (serverId, file) => {
    const form = new FormData();
    form.append("image", file);
    const res = await fetch(`/api/servers/${serverId}/image`, {
      method: "PATCH",
      credentials: "include",
      body: form,
    });
    if (!res.ok) throw new Error("Failed to update server image");
    const body = await res.json();
    const imageUrl: string = body.data?.image ?? null;
    if (imageUrl) {
      set((state) => ({
        servers: state.servers.map((s) =>
          s.id === serverId ? { ...s, image: imageUrl } : s
        ),
        activeServer:
          state.activeServer?.id === serverId
            ? { ...state.activeServer, image: imageUrl }
            : state.activeServer,
      }));
    }
    return imageUrl;
  },

  createChannel: async (serverId, name) => {
    const res = await fetch(`/api/servers/${serverId}/channels`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error("Failed to create channel");
    const body = await res.json();
    const channel: Channel = body.data ?? body;
    set((state) => ({
      channels: {
        ...state.channels,
        [serverId]: [...(state.channels[serverId] ?? []), channel],
      },
    }));
    return channel;
  },

  renameChannelRemote: async (serverId, channelId, name) => {
    const res = await fetch(`/api/servers/${serverId}/channels/${channelId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error("Failed to rename channel");
    const body = await res.json();
    const updated: Channel = body.data ?? body;
    set((state) => ({
      channels: {
        ...state.channels,
        [serverId]: (state.channels[serverId] ?? []).map((c) =>
          c.id === channelId ? { ...c, name: updated.name } : c
        ),
      },
    }));
  },

  deleteChannelRemote: async (serverId, channelId) => {
    const res = await fetch(`/api/servers/${serverId}/channels/${channelId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to delete channel");
    set((state) => ({
      channels: {
        ...state.channels,
        [serverId]: (state.channels[serverId] ?? []).filter((c) => c.id !== channelId),
      },
      activeChannel:
        state.activeChannel?.id === channelId ? null : state.activeChannel,
    }));
  },

  kickMember: async (serverId, userId) => {
    const res = await fetch(`/api/servers/${serverId}/members/${userId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to kick member");
    set((state) => ({
      members: {
        ...state.members,
        [serverId]: (state.members[serverId] ?? []).filter((m) => m.user_id !== userId),
      },
    }));
  },
}));

export default useServerStore;
