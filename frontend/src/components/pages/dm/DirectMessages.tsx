import { useEffect, useState } from "react"
import type { Conversations } from "../../../types/user";
import useFetch from "../../../hooks/useFetch";

export default function DirectMessages() {
    const [dms, setDms] = useState<Conversations[]>([]);
    const { fetchUserDms } = useFetch();

    useEffect(() => {
        const fetchDms = async () => {
            const data = await fetchUserDms();
            console.log("Datos recibidos:", data); // ✅ Aquí sí verás los datos inmediatamente
            if (data) {
                setDms(data);
            }
        };

        fetchDms();
    }, []);

    return (
        <h1 style={{ color: '#fff' }}>Direct Messages</h1>
    )
}