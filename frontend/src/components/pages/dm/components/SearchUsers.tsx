import { useState, useEffect, useRef, type MutableRefObject } from "react";
import type { UserSearchData } from "../../../../types/user";
import { useTranslation } from "react-i18next";
import { useWebSocket } from "../../../../context/WebSocketContext";
import styles from "../css/SidebarDms.module.css";

type Props = {
    onResults: (results: UserSearchData[], searching: boolean) => void;
};

async function fetchSearchedUsers(
    query: string,
    onResults: (results: UserSearchData[], searching: boolean) => void,
    searchControllerRef: MutableRefObject<AbortController | null>,
) {
    searchControllerRef.current?.abort();

    if (!query.trim()) {
        onResults([], false);
        return;
    }

    const controller = new AbortController();
    searchControllerRef.current = controller;

    try {
        const res = await fetch(`/api/user/search/${query}`, {
            method: "GET",
            credentials: "include",
            signal: controller.signal,
        });
        const data: UserSearchData[] = await res.json();
        onResults(data, true);
    } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
            return;
        }
        console.error(e);
        onResults([], true);
    } finally {
        if (searchControllerRef.current === controller) {
            searchControllerRef.current = null;
        }
    }
}

export default function SearchUsers({ onResults }: Props) {
    const [userSearched, setUserSearched] = useState("");
    const searchControllerRef = useRef<AbortController | null>(null);
    const { t } = useTranslation();
    const ws = useWebSocket();

    useEffect(() => {
        const timeout = setTimeout(() => {
            void fetchSearchedUsers(userSearched, onResults, searchControllerRef);
        }, 400);

        const activeController = searchControllerRef.current;

        return () => {
            clearTimeout(timeout);
            activeController?.abort();
        };
    }, [userSearched, onResults]);

    useEffect(() => {
        if (!userSearched.trim() || !ws) {
            return;
        }

        const refreshPresence = () => {
            void fetchSearchedUsers(userSearched, onResults, searchControllerRef);
        };

        const intervalId = window.setInterval(refreshPresence, 5000);

        ws.addEventListener("open", refreshPresence);

        return () => {
            ws.removeEventListener("open", refreshPresence);
            window.clearInterval(intervalId);
        };
    }, [userSearched, ws, onResults]);

    const clearSearch = () => {
        searchControllerRef.current?.abort();
        setUserSearched("");
        onResults([], false);
    };

    return (
        <div className={styles.searchSection}>
            <input
                type="text"
                placeholder={t("dmRoomSearchUserPlaceholder")}
                value={userSearched}
                onChange={(e) => setUserSearched(e.target.value)}
                className={styles.searchInput}
            />
            {userSearched && (
                <button
                    onClick={clearSearch}
                    className={styles.searchClearBtn}
                    aria-label="Limpiar búsqueda"
                >
                    ✕
                </button>
            )}
        </div>
    );
}
