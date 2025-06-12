import type { LoginUserData, RegisterUserData } from "../interfaces/user";
import type { UserProfile } from "../types/user";

export default function useUser() {
    // Function to send register user data to backend
    async function sendRegisterFormData(data: RegisterUserData) {
        try {
            const formData = new URLSearchParams({
                name: data.name,
                username: data.username,
                email: data.email,
                password: data.password,
            });

            const res = await fetch("/api/user/register", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData
            });

            if (!res.ok) {
                console.error("Error response from server: ", res);
                return false;
            }

            const result = await res.json();
            console.log("Data received from server: ", result);
            return true;

        } catch (e) {
            console.error("Error sending register data to Backend:", e);
            return false;
        }
    }

    // Function to send login user data to backend
    async function sendLoginFormData(data: LoginUserData): Promise<boolean> {
        try {
            const formData = new URLSearchParams({
                username: data.username,
                password: data.password,
            });

            const res = await fetch("/api/user/login", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded', // <-- CORREGIDO
                },
                credentials: "include",
                body: formData
            });

            if (!res.ok) {
                console.error("Error response from backend:", res);
                return false;
            }

            const result = await res.json();
            console.log("Data received from server:", result);

            return true;

        } catch (e) {
            console.error("Error sending login user data:", e);
            return false;
        }
    }

    async function profile(): Promise<UserProfile | void> {
        try {
            const res = await fetch("/api/user/profile", {
                method: "GET",
                credentials: "include",
            });

            if (!res.ok) {
                console.error("Error fetching profile:", res.statusText);
                return;
            }

            const data = await res.json();
            console.log("Profile data: ", data);

            // Devuelve solo la propiedad `data` que contiene el perfil
            return data.data;

        } catch (e) {
            console.error("Error al obtener la información del perfil del usuario: ", e);
        }
    }

    return { sendRegisterFormData, sendLoginFormData, profile };

}