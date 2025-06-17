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