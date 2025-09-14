import type { UserProfile } from "../types/user";
import type { DmNotification, NewDmMessageNotification, Notification } from "./notifications";

// Interface to UserContext
export interface UserContextType {
    user: UserProfile | null,
    setUser: (user: UserProfile | null) => void,
    refreshUser: () => Promise<void>,
    loading: boolean;
    logout: () => Promise<boolean>;
    notifications: Notification[];
    setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
    activeFriends: number[]; // Lista de amigos activos
    setActiveFriends: React.Dispatch<React.SetStateAction<number[]>>;
    checkUserIsOnline: (userId: number) => boolean;
    setNewLastMessage: React.Dispatch<React.SetStateAction<NewDmMessageNotification[]>>;
    newLastMessage: NewDmMessageNotification[];
    dmNotifications: DmNotification[];
    setDmNotifications: React.Dispatch<React.SetStateAction<DmNotification[]>>
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

