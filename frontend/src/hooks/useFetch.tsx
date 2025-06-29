import type { Friend } from "../types/friend";
import type { Conversations, ProfileData } from "../types/user";

export default function useFetch() {

    async function fetchFriendsList(username: string): Promise<Friend[] | void> {
        try {
            const res = await fetch(`/api/user/get-friends/${username}`, {
                method: "GET",
                credentials: "include"
            });

            if (!res.ok) {
                throw new Error(`Error HTTP: ${res.status}`);
            }

            const data = await res.json();

            console.log("Friends: ", data);
            return data.data as Friend[];
        } catch (e) {
            console.error("Error al cargar la lista de amigos:", e);
        }
    }

    async function fetchProfileUserData(username: string): Promise<ProfileData | void> {
        try {
            const res = await fetch(`/api/user/profile/${username}`, {
                method: "GET",
                credentials: "include"
            });

            if (!res.ok) {
                throw new Error(`Error HTTP: ${res.status}`);
            }

            const data = await res.json();

            return data.data as ProfileData;
        } catch (e) {
            console.error("Error al cargar la lista de amigos:", e);
        }
    }

    async function fetchProfileUserLogued(): Promise<ProfileData | void> {
        try {
            const res = await fetch(`/api/user/profile`, {
                method: "GET",
                credentials: "include"
            });

            if (!res.ok) {
                throw new Error(`Error HTTP: ${res.status}`);
            }

            const data = await res.json();

            return data.data as ProfileData;
        } catch (e) {
            console.error("Error al cargar la lista de amigos:", e);
        }
    }

    async function fetchUserDms(): Promise<Conversations[]> {
        try {
            const res = await fetch("/api/user/conversations", {
                method: "GET",
                credentials: "include"
            });

            if (!res.ok) {
                throw new Error(`Error HTTP: ${res.status}`);
            }

            const data = await res.json();
            return data as Conversations[];
        } catch (e) {
            console.error("Error en fetchUserDms:", e);
            return []; // ✅ Retorna un array vacío en caso de error
        }
    }




    return { fetchFriendsList, fetchProfileUserData, fetchProfileUserLogued, fetchUserDms }
}