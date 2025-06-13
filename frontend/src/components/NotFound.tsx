import { Link } from "react-router-dom";
import styles from '../styles/modules/NotFound.module.css'
import { useTranslation } from "react-i18next";
// import gifNotFound from '../assets/404.gif'

export default function NotFound() {
    const { t } = useTranslation();
    return (
        <div className={styles.container}>
            <div className={styles.glowingBackground}></div>
            <div className={styles.content}>
                <div className={styles.header}>
                    <h1 className={styles.errorCode} data-text={t("notFound.errorCode")}>
                        {t("notFound.errorCode")}
                    </h1>
                    <h2 className={styles.title} data-text={t("notFound.title")}>
                        {t("notFound.title")}
                    </h2>
                    <p className={styles.description}>{t("notFound.description")}</p>
                </div>

                <div className={styles.matrix}>
                    {Array.from({ length: 50 }).map((_, i) => (
                        <span
                            key={i}
                            style={{
                                animationDelay: `${Math.random() * 5}s`,
                                left: `${Math.random() * 100}%`,
                            }}
                            className={styles.matrixChar}
                        >
                            {String.fromCharCode(33 + Math.floor(Math.random() * 94))}
                        </span>
                    ))}
                </div>
                <div className={styles.buttonContainer}>
                    <Link to="/" className={styles.button}>
                        <span className={styles.buttonText}>{t("notFound.buttonText")}</span>
                        <span className={styles.buttonIcon}></span>
                    </Link>
                </div>
            </div>
        </div>
    )
}