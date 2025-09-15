import { useState } from "react";

export default function SearchUsers() {
    const [userSearched, setUserSearched] = useState("");

    // TODO: Hacer fetch a la búsqueda ya implementada en el backend

    return <section style={{
        width: "100%",
        height: "60px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        borderBottom: "1px solid #333",
    }}>
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
                borderStyle: "none",
                border: "1px solid #333",
                backgroundColor: "#111",
                color: "#fff"
            }}
        />
    </section>
}
