import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { UserContextType } from "../interfaces/user";
import type { DmNotification, NewDmMessageNotification, Notification } from "../interfaces/notifications";
import type { UserProfile } from "../types/user";
import useUser from "../hooks/useUser";
import Loader from "../components/Loader";

const UserContext = createContext<UserContextType | undefined>(undefined)

// Provider
interface Props {
  children: ReactNode
}

export function useUserContext() {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error("useUserContext debe usarse dentro de un <UserProvider>")
  }
  return context
}

export function UserProvider({ children }: Props) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeFriends, setActiveFriends] = useState<number[]>([]); // Lista de amigos activos
  const [newLastMessage, setNewLastMessage] = useState<NewDmMessageNotification[]>([]);
  const [dmNotifications, setDmNotifications] = useState<DmNotification[]>([]);


  const [loading, setLoading] = useState(true);
  const { profile } = useUser();

  async function logout(): Promise<boolean> {
    try {
      const res = await fetch("/api/user/logout", {
        method: "POST",
        credentials: "include"
      })

      if (!res.ok) {
        return false;
      }

      return true;
    } catch (e) {
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

    setLoading(false); // Ya haya o no usuario
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const refreshUser = async () => {
    setLoading(true);
    await fetchProfile();
  }

  if (loading) return <Loader />;

  return (
    <UserContext.Provider value={{ user, setUser, refreshUser, logout, loading, notifications, setNotifications, activeFriends, setActiveFriends, checkUserIsOnline, setNewLastMessage, newLastMessage, dmNotifications, setDmNotifications }}>
      {children}
    </UserContext.Provider>
  );
}