document.getElementById("login-form").addEventListener("submit", async function (e) {
    e.preventDefault(); // Prevenir comportamiento por defecto del formulario

    const form = e.target;
    const formData = new URLSearchParams({
        username: form.username.value,
        password: form.password.value,
    });

    try {
        const response = await fetch("/api/user/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            credentials: "include", // Incluir cookies para la sesión
            body: formData,
        });

        // Si el backend redirige con 303 o 302
        if (response.redirected) {
            window.location.href = response.url;
        } else if (response.status === 200) {
            const result = await response.text();
            if (result.includes("success")) {
                window.location.href = "/"; // Redirige a la principal
            } else {
                alert("Credenciales incorrectas.");
            }
        } else {
            alert("Error al iniciar sesión.");
        }

    } catch (err) {
        console.error("Login error:", err);
        alert("Error al enviar el formulario.");
    }
});
