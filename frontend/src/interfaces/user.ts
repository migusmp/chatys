import type { UserProfile } from "../types/user";

// Interface to UserContext
export interface UserContextType {
    user: UserProfile | null,
    setUser: (user: UserProfile | null) => void,
    refreshUser: () => Promise<void>,
    loading: boolean;
    logout: () => Promise<boolean>;
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

