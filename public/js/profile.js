import { GlobalState } from "./state.js";
import { getChangedFields, updateUserData } from "./utils/fetch_api.js";

export function initPage() {
    const profileContainer = document.getElementById("profile-container");
    const fileInput = document.getElementById("file-input");
    const profileImage = document.getElementById("profile-picture");
    const divUploadImage = document.getElementById("upload-success");
    const messageUploadImageSuccessFull = document.getElementById('upload-message');
    const divSaveUserData = document.getElementById("save-new-data-msg");

    // MODAL ITEMS
    const deleteBtn = document.getElementById("delete-profile");
    const modal = document.getElementById("delete-modal");
    const confirmDelete = document.getElementById("confirm-delete");
    const cancelDelete = document.getElementById("cancel-delete");

    deleteBtn.addEventListener("click", () => {
        modal.classList.remove("hidden");
    });
    
    cancelDelete.addEventListener("click", () => {
        modal.classList.add("hidden");
    });
    
    confirmDelete.addEventListener("click", () => {
        modal.classList.add("hidden");
        // Aquí va la lógica real para eliminar cuenta
        alert("Cuenta eliminada (aquí iría la llamada real al backend).");
    });

    modal.addEventListener("click", (event) => {
        if (!event.target.closest(".modal-content")) {
            modal.classList.add("hidden");
        }
    });

    const createdAtStr = GlobalState.get('created_at');
    const createdAtDate = createdAtStr ? new Date(createdAtStr) : null;

    // Por ejemplo, formatearlo como "10/01/2023" (dd/mm/yyyy)
    const formattedDate = createdAtDate
        ? createdAtDate.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' })
        : 'Fecha no disponible';

    // Datos iniciales (temporal o por fallback)
    const fallbackUser = {
        photoUrl: `/media/user/${GlobalState.get('image')}`,
        joinedAt: "2023-01-10"
    };

    // Prellenar datos actuales
    profileImage.src = fallbackUser.photoUrl;
    document.getElementById("name").value = GlobalState.get("name");
    document.getElementById("username").value = GlobalState.get("username");
    document.getElementById("email").value = GlobalState.get("email");
    document.getElementById("joined").value = formattedDate;

    // 🔁 Escuchar cambios del estado y reflejarlos en inputs
    GlobalState.on("name", (val) => {
        document.getElementById("name").value = val;
    });

    GlobalState.on("username", (val) => {
        document.getElementById("username").value = val;
    });

    GlobalState.on("email", (val) => {
        document.getElementById("email").value = val;
    });

    // 👉 Clic en la imagen abre el selector de archivos
    profileImage.addEventListener("click", () => {
        fileInput.click();
    });

    // 📸 Previsualizar imagen seleccionada
    fileInput.addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (!file) return;
    
        const reader = new FileReader();
        reader.onload = (e) => {
            profileImage.src = e.target.result;
        };
        reader.readAsDataURL(file);
    
        // ⬆️ Subir imagen al servidor
        try {
            const formData = new FormData();
            formData.append("file", file);
    
            const res = await fetch("/api/user/upload", {
                method: "POST",
                credentials: "include",
                body: formData
            });
    
            if (!res.ok) {
                const error = await res.text();
                throw new Error(error || "Error al subir la imagen");
            }
    
            const json = await res.json();
            console.log("Imagen subida correctamente:", json);
            divUploadImage.classList.remove('hidden');
            messageUploadImageSuccessFull.textContent = json.message;
    
            // (opcional) refrescar el perfil
            await GlobalState.fetchProfileInfo();
        } catch (err) {
            console.error("Error subiendo la imagen:", err);
            alert("Error al subir la imagen");
        }
    });

    // Guardar datos
    document.getElementById("save-profile").addEventListener("click", async () => {
        const updatedUser = {
            name: document.getElementById("name").value,
            username: document.getElementById("username").value,
            email: document.getElementById("email").value,
            // photoDataUrl: profileImage.src // si decides comparar la imagen también
        };

        const currentUser = {
            name: GlobalState.get("name"),
            username: GlobalState.get("username"),
            email: GlobalState.get("email"),
        };

        const changedFields = getChangedFields(updatedUser, currentUser);

        if (Object.keys(changedFields).length === 0) {
            console.log("No hay cambios, no se envía nada.");
            return;
        }

        console.log("Solo enviar:", changedFields);

        try {
            const data = await updateUserData(changedFields);
            console.log("DATA RETORNADA: ", data);
            if (data.status == 'success') {
                divSaveUserData.classList.remove('hidden');
                divSaveUserData.style.color = "#00ff6a"; // Verde
                divSaveUserData.textContent = data.message;
            } else {
                divSaveUserData.classList.remove('hidden');
                divSaveUserData.style.color = "red"; // Verde
                divSaveUserData.textContent = data.message;
            }
            await GlobalState.fetchProfileInfo(); // esto hará set(...) y disparará los listeners
        } catch (err) {
            console.error("Error durante la actualización del perfil:", err);
        }
    });
}
