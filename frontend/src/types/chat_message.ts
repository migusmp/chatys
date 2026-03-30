export type ChatMessage = {
    id: number;
    sender_id: number;
    content: string;
    created_at: string;
    edited_at?: string | null;
    is_deleted?: boolean;
};
