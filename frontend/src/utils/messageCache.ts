import type { ChatMessage } from "../types/chat_message";

type CacheEntry = {
    messages: ChatMessage[];
    cursor: number;
    hasMore: boolean;
};

const cache = new Map<string, CacheEntry>();

export const messageCache = {
    get(key: string): CacheEntry | undefined {
        return cache.get(key);
    },

    set(key: string, entry: CacheEntry): void {
        cache.set(key, entry);
    },

    appendMessage(key: string, message: ChatMessage): void {
        const entry = cache.get(key);
        if (!entry) return;

        // Avoid duplicates (message already in cache via optimistic update or re-delivery)
        const alreadyExists = entry.messages.some((m) => m.id === message.id);
        if (alreadyExists) return;

        cache.set(key, {
            ...entry,
            messages: [...entry.messages, message],
            cursor: entry.cursor + 1,
        });
    },

    updateMessage(key: string, updated: ChatMessage): void {
        const entry = cache.get(key);
        if (!entry) return;

        cache.set(key, {
            ...entry,
            messages: entry.messages.map((m) =>
                m.id === updated.id ? { ...m, ...updated } : m,
            ),
        });
    },

    deleteMessage(key: string, messageId: number): void {
        const entry = cache.get(key);
        if (!entry) return;

        cache.set(key, {
            ...entry,
            messages: entry.messages.map((m) =>
                m.id === messageId ? { ...m, is_deleted: true, content: "" } : m,
            ),
        });
    },

    invalidate(key: string): void {
        cache.delete(key);
    },
};
