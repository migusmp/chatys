document.getElementById("register-form").addEventListener("submit", async function (e) {
    e.preventDefault(); // Prevenir comportamiento por defecto del formulario

    const form = e.target;
    const formData = new URLSearchParams({
        name: form.name.value,
        email: form.email.value,
        username: form.username.value,
        password: form.password.value,
    });

    try {
        const response = await fetch("/api/user/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: formData,
        });

        if (response.redirected) {
            window.location.href = response.url;
        } else if (response.status === 200) {
            const result = await response.text();
            if (result.includes("success")) {
                window.location.href = "/login";
            } else {
                alert("Error al registrarse");
            }
        } else {
            alert("Error al registrarse");
        }

    } catch (err) {
        console.error("Login error:", err);
        alert("Error al enviar el formulario.");
    }
});