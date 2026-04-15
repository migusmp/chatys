import { useState, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import styles from '../css/Modal.module.css';
import type { ProfileData } from '../../../../types/user';
import { useTranslation } from 'react-i18next';

interface Props {
    setModal: Dispatch<SetStateAction<boolean>>;
    profile?: ProfileData;
    setProfile: Dispatch<SetStateAction<ProfileData | undefined>>;
}

type EditableProfileFields = Pick<ProfileData, "name" | "username" | "email" | "image" | "description">;

export default function EditProfileModal({ setModal, profile, setProfile }: Props) {
    const { t } = useTranslation();

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [formData, setFormData] = useState<EditableProfileFields>({
        name: profile?.name || '',
        username: profile?.username || '',
        email: profile?.email || '',
        image: profile?.image || '',
        description: profile?.description || '',
    });

    async function uploadImage(file: File): Promise<string> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/user/upload', {
            method: 'POST',
            credentials: "include",
            body: formData,
        });

        if (!response.ok) {
            throw new Error('Error al subir la imagen');
        }

        const data = await response.json();
        return data.data; // Supongamos que el servidor devuelve { url: "https://..." }
    }


    function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value,
        }));
    }

    async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const uploadedUrl = await uploadImage(file);
            setFormData(prev => ({
                ...prev,
                image: uploadedUrl,
            }));
            if (profile?.image) {
                setProfile(prev => ({
                    ...prev!,
                    image: uploadedUrl,
                }))
            }

        } catch (err) {
            console.error('Error al subir la imagen', err);
            alert('No se pudo subir la imagen');
        }
    }

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();

        if (!profile) return;

        const updatedFields: Partial<EditableProfileFields> = {};

        (Object.keys(formData) as Array<keyof EditableProfileFields>).forEach((key) => {
            if (formData[key] !== profile?.[key]) {
                updatedFields[key] = formData[key];
            }
        });

        if (Object.keys(updatedFields).length === 0) {
            setModal(false);
            return;
        }

        const body = new URLSearchParams();
        Object.entries(updatedFields).forEach(([key, value]) => {
            if (value !== undefined) {
                body.append(key, value);
            }
        });

        fetch("/api/user/update", {
            method: "PATCH",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            credentials: "include",
            body: body.toString(),
        })
            .then(res => {
                if (!res.ok) throw new Error("Error al actualizar el perfil");
                return res.json();
            })
            .then(() => {
                setProfile(prev => ({
                    ...prev!,
                    ...updatedFields,
                }));
                setModal(false);
            })
            .catch(err => {
                console.error(err);
                alert("No se pudo actualizar el perfil");
            });
    }


    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                {/* Header */}
                <div className={styles.header}>
                    <h2 className={styles.title}>{t("profile.editProfile") || "Edit Profile"}</h2>
                    <button
                        type="button"
                        className={styles.closeBtn}
                        onClick={() => setModal(false)}
                        aria-label="Close"
                    >
                        <i className="bi bi-x-lg" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    {/* Avatar */}
                    <div className={styles.avatarSection}>
                        <div
                            className={styles.avatarWrapper}
                            onClick={() => fileInputRef.current?.click()}
                            role="button"
                            tabIndex={0}
                            aria-label={t("profile.editProfileModal.changeImgMessage")}
                        >
                            {formData.image ? (
                                <img src={formData.image} alt="Profile" className={styles.avatarImg} />
                            ) : (
                                <div className={styles.avatarPlaceholder}>
                                    {profile?.name?.charAt(0).toUpperCase() || '?'}
                                </div>
                            )}
                            <div className={styles.avatarOverlay}>
                                <i className="bi bi-camera-fill" />
                            </div>
                        </div>
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} className={styles.hiddenInput} />
                        <span className={styles.imageHint}>{t("profile.editProfileModal.changeImgMessage")}</span>
                    </div>

                    {/* Fields */}
                    <div className={styles.fields}>
                        <div className={styles.field}>
                            <label htmlFor="edit-name" className={styles.label}>{t("profile.editProfileModal.nameLabel")}</label>
                            <input id="edit-name" type="text" name="name" value={formData.name} onChange={handleChange} className={styles.input} />
                        </div>
                        <div className={styles.field}>
                            <label htmlFor="edit-username" className={styles.label}>{t("profile.editProfileModal.usernameLabel")}</label>
                            <input id="edit-username" type="text" name="username" value={formData.username} onChange={handleChange} className={styles.input} />
                        </div>
                        <div className={styles.field}>
                            <label htmlFor="edit-description" className={styles.label}>{t("profile.editProfileModal.descriptionLabel")}</label>
                            <textarea id="edit-description" name="description" value={formData.description} onChange={handleChange} rows={3} className={styles.textarea} />
                        </div>
                        <div className={styles.field}>
                            <label htmlFor="edit-email" className={styles.label}>{t("profile.editProfileModal.emailLabel")}</label>
                            <input id="edit-email" type="email" name="email" value={formData.email} onChange={handleChange} className={styles.input} />
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className={styles.actions}>
                        <button type="submit" className={styles.saveBtn}>{t("profile.editProfileModal.saveBtn")}</button>
                        <button type="button" className={styles.cancelBtn} onClick={() => setModal(false)}>{t("profile.editProfileModal.dontSaveBtn")}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
