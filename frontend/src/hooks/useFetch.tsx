import type { LoginUserData, RegisterUserData } from "../interfaces/user";



export default function useFetch() {
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

    return { sendRegisterFormData, sendLoginFormData };
}