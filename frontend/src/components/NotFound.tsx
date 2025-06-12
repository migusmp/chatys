import { Link } from "react-router-dom";
import styles from '../styles/modules/NotFound.module.css'
// import gifNotFound from '../assets/404.gif'

export default function NotFound() {

    return (
        <div className={styles.container}>
            <div className={styles.glowingBackground}></div>
            <div className={styles.content}>
                <div className={styles.header}>
                    <h1 className={styles.errorCode} data-text="404">
                        404
                    </h1>
                    <h2 className={styles.title} data-text="Page Not Found">
                        Page Not Found
                    </h2>
                    <p className={styles.description}>Sorry, the page you are looking for does not exist or has been moved.</p>
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
                        <span className={styles.buttonText}>Back to Home</span>
                        <span className={styles.buttonIcon}></span>
                    </Link>
                </div>
            </div>
        </div>
    )
}