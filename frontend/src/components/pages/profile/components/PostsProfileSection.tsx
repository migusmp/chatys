import { useTranslation } from 'react-i18next'
import styles from '../css/PostsProfileSection.module.css'

export default function PostsProfileSection() {
    const { t } = useTranslation()

    return (
        <section
            className={styles.body}
        >
            <h2>{t("profile.postsSection.noPublications")}</h2>
            <i
                className="bi bi-camera"
                style={{
                    fontSize: '3rem',
                    color: '#00ff66',
                    marginTop: '1rem',
                    opacity: 0.6,
                }}
            ></i>
        </section>
    )
}