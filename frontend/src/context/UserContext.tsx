import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { UserContextType } from "../interfaces/user";
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
  const [loading, setLoading] = useState(true);
  const { profile } = useUser();

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
    <UserContext.Provider value={{ user, setUser, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
}