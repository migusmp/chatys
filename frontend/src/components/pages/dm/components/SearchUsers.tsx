import { useState, useEffect } from "react";
import type { UserSearchData } from "../../../../types/user";

type Props = {
  onResults: (results: UserSearchData[]) => void;
};

export default function SearchUsers({ onResults }: Props) {
  const [userSearched, setUserSearched] = useState("");

  async function fetchSearchedUsers(query: string) {
    if (!query.trim()) {
      onResults([]); // limpiar resultados
      return;
    }

    try {
      const res = await fetch(`/api/user/search/${query}`, {
        method: "GET",
        credentials: "include",
      });
      const data: UserSearchData[] = await res.json();
      onResults(data);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchSearchedUsers(userSearched);
    }, 400);

    return () => clearTimeout(timeout);
  }, [userSearched]);

  return (
    <section
      style={{
        width: "100%",
        height: "60px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        borderBottom: "1px solid #333",
      }}
    >
      <input
        type="text"
        placeholder="Search user"
        value={userSearched}
        onChange={(e) => setUserSearched(e.target.value)}
        style={{
          width: "85%",
          padding: "7px",
          paddingLeft: "12px",
          outline: "none",
          fontSize: "1rem",
          borderRadius: "24px",
          border: "1px solid #333",
          backgroundColor: "#111",
          color: "#fff",
        }}
      />
    </section>
  );
}
