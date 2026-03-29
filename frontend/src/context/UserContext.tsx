import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type {
    DmNotification,
    Notification,
} from "../interfaces/notifications";
import type { UserProfile } from "../types/user";
import useUser from "../hooks/useUser";
import Loader from "../components/Loader";
import useDynamicTitle from "../hooks/useDynamicTitle";

interface UserProfileContextType {
    user: UserProfile | null;
    setUser: (user: UserProfile | null) => void;
    refreshUser: () => Promise<void>;
    loading: boolean;
    logout: () => Promise<boolean>;
}

interface FriendsContextType {
    activeFriends: number[];
    setActiveFriends: React.Dispatch<React.SetStateAction<number[]>>;
    checkUserIsOnline: (userId: number) => boolean;
}

interface NotificationsContextType {
    notifications: Notification[];
    setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
    setNewLastMessage: React.Dispatch<React.SetStateAction<DmNotification[]>>;
    newLastMessage: DmNotification[];
    dmNotifications: DmNotification[];
    setDmNotifications: React.Dispatch<React.SetStateAction<DmNotification[]>>;
}

type UserContextType = UserProfileContextType & FriendsContextType & NotificationsContextType;

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);
const FriendsContext = createContext<FriendsContextType | undefined>(undefined);
const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

interface Props {
    children: ReactNode;
}

export function useUserProfileContext() {
    const context = useContext(UserProfileContext);
    if (!context) {
        throw new Error("useUserProfileContext debe usarse dentro de un <UserProvider>");
    }
    return context;
}

export function useFriendsContext() {
    const context = useContext(FriendsContext);
    if (!context) {
        throw new Error("useFriendsContext debe usarse dentro de un <UserProvider>");
    }
    return context;
}

export function useNotificationsContext() {
    const context = useContext(NotificationsContext);
    if (!context) {
        throw new Error("useNotificationsContext debe usarse dentro de un <UserProvider>");
    }
    return context;
}

export function useUserContext(): UserContextType {
    return {
        ...useUserProfileContext(),
        ...useFriendsContext(),
        ...useNotificationsContext(),
    };
}

export function UserProvider({ children }: Props) {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [activeFriends, setActiveFriends] = useState<number[]>([]);
    const [newLastMessage, setNewLastMessage] = useState<DmNotification[]>([]);
    const [dmNotifications, setDmNotifications] = useState<DmNotification[]>([]);
    const [loading, setLoading] = useState(true);

    const { profile } = useUser();

    const totalNotifications = notifications.length + dmNotifications.length;
    useDynamicTitle(totalNotifications);

    async function logout(): Promise<boolean> {
        try {
            const res = await fetch("/api/user/logout", {
                method: "POST",
                credentials: "include",
            });

            if (!res.ok) {
                return false;
            }

            return true;
        } catch {
            console.error("Error al cerrar sesión");
            return false;
        }
    }

    const checkUserIsOnline = (userId: number): boolean => {
        return activeFriends.includes(userId);
    };

    const fetchProfile = async () => {
        const userData = await profile();
        if (userData) {
            setUser(userData);
        }

        setLoading(false);
    };

    useEffect(() => {
        fetchProfile();
    }, []);

    const refreshUser = async () => {
        setLoading(true);
        await fetchProfile();
    };

    if (loading) return <Loader />;

    return (
        <UserProfileContext.Provider
            value={{ user, setUser, refreshUser, logout, loading }}
        >
            <FriendsContext.Provider
                value={{ activeFriends, setActiveFriends, checkUserIsOnline }}
            >
                <NotificationsContext.Provider
                    value={{
                        notifications,
                        setNotifications,
                        setNewLastMessage,
                        newLastMessage,
                        dmNotifications,
                        setDmNotifications,
                    }}
                >
                    {children}
                </NotificationsContext.Provider>
            </FriendsContext.Provider>
        </UserProfileContext.Provider>
    );
}
