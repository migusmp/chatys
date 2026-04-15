import { useState, useRef } from "react";
import useServerStore from "../../stores/useServerStore";
import styles from "../pages/chats/css/RoomList.module.css";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_NAME_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

type FormState = {
  name: string;
  description: string;
  isPublic: boolean;
  imagePreview: string | null;
  imageFile: File | null;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateServerModal({ open, onClose }: Props) {
  const fetchServers = useServerStore((s) => s.fetchServers);

  const [form, setForm] = useState<FormState>({
    name: "",
    description: "",
    isPublic: true,
    imagePreview: null,
    imageFile: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Solo se permiten imágenes.");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setError("La imagen no puede superar los 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm((prev) => ({
        ...prev,
        imagePreview: ev.target?.result as string,
        imageFile: file,
      }));
    };
    reader.readAsDataURL(file);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setError("El nombre del servidor es obligatorio.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("name", trimmedName);
      formData.append("is_public", String(form.isPublic));
      if (form.description.trim()) {
        formData.append("description", form.description.trim());
      }
      if (form.imageFile) {
        formData.append("image", form.imageFile);
      }

      const res = await fetch("/api/servers", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "No se pudo crear el servidor.");
        return;
      }

      await fetchServers();
      handleClose();
    } catch {
      setError("Error de red al crear el servidor.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setForm({ name: "", description: "", isPublic: true, imagePreview: null, imageFile: null });
    setError(null);
    onClose();
  };

  const handleOverlayKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") handleClose();
  };

  return (
    <div
      className={styles.modalOverlay}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
      onKeyDown={handleOverlayKeyDown}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-server-title"
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <h2 id="create-server-title" className={styles.modalTitle}>
            Nuevo servidor
          </h2>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={handleClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Avatar picker */}
        <div className={styles.avatarPicker}>
          <button
            type="button"
            className={styles.avatarPickerBtn}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Subir imagen del servidor"
          >
            {form.imagePreview ? (
              <img
                src={form.imagePreview}
                alt="Vista previa"
                className={styles.avatarPickerImg}
              />
            ) : (
              <span className={styles.avatarPickerPlaceholder}>🌐</span>
            )}
            <div className={styles.avatarPickerOverlay}>📷</div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className={styles.hiddenFileInput}
            onChange={handleImageChange}
          />
          <span className={styles.avatarPickerHint}>Imagen opcional (máx. 5 MB)</span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className={styles.modalFields}>
          <div className={styles.modalField}>
            <label htmlFor="server-name" className={styles.modalLabel}>
              Nombre *
            </label>
            <input
              id="server-name"
              type="text"
              className={styles.modalInput}
              value={form.name}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, name: e.target.value }));
                setError(null);
              }}
              placeholder="ej. Mi comunidad, Gaming…"
              maxLength={MAX_NAME_LENGTH}
              autoFocus
              autoComplete="off"
            />
          </div>

          <div className={styles.modalField}>
            <label htmlFor="server-description" className={styles.modalLabel}>
              Descripción
            </label>
            <textarea
              id="server-description"
              className={styles.modalTextarea}
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="¿De qué trata este servidor?"
              maxLength={MAX_DESCRIPTION_LENGTH}
              rows={3}
            />
          </div>

          <div className={styles.modalField}>
            <label className={styles.modalLabel} style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.isPublic}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, isPublic: e.target.checked }))
                }
                style={{ accentColor: "#0f6", width: "16px", height: "16px", cursor: "pointer" }}
              />
              Servidor público
            </label>
          </div>

          {error && <div className={styles.errorBanner}>{error}</div>}

          <div className={styles.modalActions}>
            <button
              type="submit"
              className={styles.modalSubmitBtn}
              disabled={submitting || !form.name.trim()}
            >
              {submitting ? "Creando…" : "Crear servidor"}
            </button>
            <button
              type="button"
              className={styles.modalCancelBtn}
              onClick={handleClose}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
