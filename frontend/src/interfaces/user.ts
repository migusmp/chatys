import type { UserProfile } from "../types/user";

// Interface to UserContext
export interface UserContextType {
    user: UserProfile | null,
    setUser: (user: UserProfile | null) => void,
}

export interface RegisterUserData {
    name: string,
    username: string,
    email: string,
    password: string,
}

export interface LoginUserData {
    username: string,
    password: string,
}

