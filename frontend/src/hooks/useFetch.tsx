import type { Friend } from "../types/friend";
import type { Conversations, FullConversation, ProfileData } from "../types/user";
import { useEffect, useRef } from "react";

type FetchOptions = {
    signal?: AbortSignal;
};

export default function useFetch() {
    const controllersRef = useRef<Record<string, AbortController | undefined>>({});

    useEffect(() => {
        const controllers = controllersRef.current;
        return () => {
            Object.values(controllers).forEach((controller) => {
                controller?.abort();
            });
        };
    }, []);

    const getRequestSignal = (key: string, externalSignal?: AbortSignal) => {
        if (externalSignal) {
            return externalSignal;
        }

        controllersRef.current[key]?.abort();
        const controller = new AbortController();
        controllersRef.current[key] = controller;
        return controller.signal;
    };

    const clearController = (key: string, signal: AbortSignal) => {
        const activeController = controllersRef.current[key];
        if (activeController && activeController.signal === signal) {
            delete controllersRef.current[key];
        }
    };

    async function fetchFriendsList(username: string, options?: FetchOptions): Promise<Friend[] | void> {
        const signal = getRequestSignal("fetchFriendsList", options?.signal);
        try {
            const res = await fetch(`/api/user/get-friends/${username}`, {
                method: "GET",
                credentials: "include",
                signal,
            });

            if (!res.ok) {
                throw new Error(`Error HTTP: ${res.status}`);
            }

            const data = await res.json();

            console.log("Friends: ", data);
            return data.data as Friend[];
        } catch (e) {
            if (e instanceof DOMException && e.name === "AbortError") {
                return;
            }
            console.error("Error al cargar la lista de amigos:", e);
        } finally {
            clearController("fetchFriendsList", signal);
        }
    }

    async function fetchProfileUserData(username: string, options?: FetchOptions): Promise<ProfileData | void> {
        const signal = getRequestSignal("fetchProfileUserData", options?.signal);
        try {
            const res = await fetch(`/api/user/profile/${username}`, {
                method: "GET",
                credentials: "include",
                signal,
            });

            if (!res.ok) {
                throw new Error(`Error HTTP: ${res.status}`);
            }

            const data = await res.json();

            return data.data as ProfileData;
        } catch (e) {
            if (e instanceof DOMException && e.name === "AbortError") {
                return;
            }
            console.error("Error al cargar la lista de amigos:", e);
        } finally {
            clearController("fetchProfileUserData", signal);
        }
    }

    async function fetchProfileUserLogued(options?: FetchOptions): Promise<ProfileData | void> {
        const signal = getRequestSignal("fetchProfileUserLogued", options?.signal);
        try {
            const res = await fetch(`/api/user/profile`, {
                method: "GET",
                credentials: "include",
                signal,
            });

            if (!res.ok) {
                throw new Error(`Error HTTP: ${res.status}`);
            }

            const data = await res.json();

            return data.data as ProfileData;
        } catch (e) {
            if (e instanceof DOMException && e.name === "AbortError") {
                return;
            }
            console.error("Error al cargar la lista de amigos:", e);
        } finally {
            clearController("fetchProfileUserLogued", signal);
        }
    }

    async function fetchUserDms(options?: FetchOptions): Promise<Conversations[]> {
        const signal = getRequestSignal("fetchUserDms", options?.signal);
        try {
            const res = await fetch("/api/user/conversations", {
                method: "GET",
                credentials: "include",
                signal,
            });

            if (!res.ok) {
                throw new Error(`Error HTTP: ${res.status}`);
            }

            const data = await res.json();
            console.log("DATAA:", data);
            return data as Conversations[];
        } catch (e) {
            if (e instanceof DOMException && e.name === "AbortError") {
                return [];
            }
            console.error("Error en fetchUserDms:", e);
            return []; // ✅ Retorna un array vacío en caso de error
        } finally {
            clearController("fetchUserDms", signal);
        }
    }

    async function fetchFullConversationInfo(
        username: string,
        limit: number,
        offset: number,
        options?: FetchOptions,
    ): Promise<FullConversation | void> {
        const signal = getRequestSignal("fetchFullConversationInfo", options?.signal);
        try {
            const res = await fetch(
                `/api/chat/conversation/${username}?limit=${limit}&offset=${offset}`,
                { method: "GET", credentials: "include", signal }
            );

            if (!res.ok) {
                throw new Error(`Error HTTP: ${res.status}`);
            }

            const data = await res.json();
            return data as FullConversation;
        } catch (e) {
            if (e instanceof DOMException && e.name === "AbortError") {
                return;
            }
            console.error("Error al cargar la conversación:", e);
        } finally {
            clearController("fetchFullConversationInfo", signal);
        }
    }



    return { fetchFriendsList, fetchProfileUserData, fetchProfileUserLogued, fetchUserDms, fetchFullConversationInfo }
}
