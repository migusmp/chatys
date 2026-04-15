export type ReactionCount = {
    emoji: string;
    count: number;
    users: string[];
    reacted_by_me: boolean;
};

export type MessagePreview = {
    id: number;
    content: string;
    sender_username: string;
};

export type ChatMessage = {
    id: number;
    sender_id: number;
    content: string;
    created_at: string;
    edited_at?: string | null;
    is_deleted?: boolean;
    read_by?: number[];
    reactions?: ReactionCount[];
    reply_to_id?: number | null;
    reply_to?: MessagePreview | null;
};
