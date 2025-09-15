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

export type UserSearchData = {
  id: number;
  username: string;
  name: string;
  image: string;
  description: string;
};

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

export type Participants = {
    id: number,
    username: string,
    image: string,
}

export type Conversations = {
    conversation_id: number,
    is_group: boolean,
    updated_at: string,
    last_message: string,
    last_message_user_id: number,
    participants: Participants[],
}

export type FullConversation = {
    conversation: {
        id: number,
        created_at: string,
        is_group: boolean,
        updated_at: string,
        participants: Participants[],
    }
    messages: {
        id: number,
        conversation_id: number,
        content: string,
        sender_id: number,
        created_at: string,
        read_by: number[],
    }[],
}