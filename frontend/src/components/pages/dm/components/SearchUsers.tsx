import { useState, useEffect } from "react";
import type { UserSearchData } from "../../../../types/user";
import { useTranslation } from "react-i18next";

type Props = {
    onResults: (results: UserSearchData[], searching: boolean) => void;
};

export default function SearchUsers({ onResults }: Props) {
    const [userSearched, setUserSearched] = useState("");
    const { t } = useTranslation();

    async function fetchSearchedUsers(query: string) {
        if (!query.trim()) {
            onResults([], false); // búsqueda inactiva
            return;
        }

        try {
            const res = await fetch(`/api/user/search/${query}`, {
                method: "GET",
                credentials: "include",
            });
            const data: UserSearchData[] = await res.json();
            onResults(data, true); // búsqueda activa
        } catch (e) {
            console.error(e);
            onResults([], true);
        }
    }

    useEffect(() => {
        const timeout = setTimeout(() => {
            fetchSearchedUsers(userSearched);
        }, 400);

        return () => clearTimeout(timeout);
    }, [userSearched]);

    const clearSearch = () => {
        setUserSearched("");
        onResults([], false);
    };

    return (
        <section
            style={{
                width: "100%",
                height: "60px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                borderBottom: "1px solid #333",
                position: "relative",
            }}
        >
            <input
                type="text"
                placeholder={t('dmRoomSearchUserPlaceholder')}
                value={userSearched}
                onChange={(e) => setUserSearched(e.target.value)}
                style={{
                    width: "85%",
                    padding: "7px",
                    paddingLeft: "12px",
                    paddingRight: "30px",
                    outline: "none",
                    fontSize: "1rem",
                    borderRadius: "24px",
                    border: "1px solid #333",
                    backgroundColor: "#111",
                    color: "#fff",
                }}
            />
            {userSearched && (
                <button
                    onClick={clearSearch}
                    style={{
                        position: "absolute",
                        right: "12%",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "transparent",
                        border: "none",
                        color: "#999",
                        fontSize: "1.1rem",
                        cursor: "pointer",
                    }}
                >
                    ✕
                </button>
            )}
        </section>
    );
}

