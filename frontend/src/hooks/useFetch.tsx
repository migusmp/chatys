import type { Friend } from "../types/friend";
import type { ProfileData } from "../types/user";

export default function useFetch() {
    // async function fetchFriendsList(): Promise<[] | void> {
    //     await fetch('/api/user/get-friends', {
    //         method: "GET",
    //         credentials: "include"
    //     })
    //         .then(res => res.json())
    //         .then(data => {
    //             console.log("Friends: ", data);
    //             return data.data;
    //             //console.log("Lista de amigos cargada:", GlobalState.get('friends'));
    //         })
    //         .catch(e => {
    //             console.error("Error al cargar la lista de amigos:", e);
    //         })
    // }

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

            console.log("Friends: ", data);
            return data.data as ProfileData;
        } catch (e) {
            console.error("Error al cargar la lista de amigos:", e);
        }
    }

    return { fetchFriendsList, fetchProfileUserData }
}