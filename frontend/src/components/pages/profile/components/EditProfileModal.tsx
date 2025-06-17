import { useState, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import styles from '../css/Modal.module.css';
import type { ProfileData } from '../../../../types/user';

interface Props {
    setModal: Dispatch<SetStateAction<boolean>>;
    profile?: ProfileData;
    setProfile: Dispatch<SetStateAction<ProfileData | undefined>>;
}

export default function EditProfileModal({ setModal, profile, setProfile }: Props) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [formData, setFormData] = useState({
        name: profile?.name || '',
        username: profile?.username || '',
        email: profile?.email || '',
        image: profile?.image || '',
        description: profile?.description || '',
    });

    async function uploadImage(file: File): Promise<string> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload-avatar', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error('Error al subir la imagen');
        }

        const data = await response.json();
        return data.url; // Supongamos que el servidor devuelve { url: "https://..." }
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
        } catch (err) {
            console.error('Error al subir la imagen', err);
            alert('No se pudo subir la imagen');
        }
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        setProfile(prev => ({
            ...prev!,
            name: formData.name,
            username: formData.username,
            email: formData.email,
            image: formData.image,
            description: formData.description,
        }));

        setModal(false);
    }

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <form onSubmit={handleSubmit} className={styles.modalForm}>
                    <div className={styles.profileImageWrapper}>
                        <img
                            src={formData.image}
                            alt="Imagen de perfil"
                            className={styles.profileImage}
                            onClick={() => fileInputRef.current?.click()}
                        />
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            onChange={handleImageChange}
                            className={styles.hiddenInput}
                        />
                        <span className={styles.imageHint}>Haz clic en la imagen para cambiarla</span>
                    </div>

                    <label>
                        Nombre:
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                        />
                    </label>

                    <label>
                        Usuario:
                        <input
                            type="text"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                        />
                    </label>
                    
                    <label>
                        Descripción:
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            rows={4}
                            className={styles.textarea}
                        />
                    </label>

                    <label>
                        Email:
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                        />
                    </label>

                    <div className={styles.modalButtons}>
                        <button type="submit">Guardar</button>
                        <button type="button" onClick={() => setModal(false)}>Cancelar</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
