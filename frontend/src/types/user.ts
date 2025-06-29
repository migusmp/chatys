// User profile type from /api/user/profile
export type UserProfile = {
    id: number,
    name: string,
    username: string,
    email: string,
    image: string,
    created_at: string,
}

export type RegisterUserData = {
    name: string,
    username: string,
    email: string,
    password: string,
}

export type LoginUserData = {
    username: string,
    password: string,
}

export type ProfileData = {
    id: number,
    name: string,
    username: string,
    email: string,
    image: string,
    created_at: string,
    friends_count: number,
    description: string
}

export type Conversations = {
    conversation_id: number,
    is_group: boolean,
    updated_at: string,
    last_message_content: string,
    last_message_sender_id: string,
    last_message_created_at: string,
}