import styles from '../css/PostsProfileSection.module.css'

export default function PostsProfileSection() {
    return (
        <section
            className={styles.body}
        >
            <h2>No hay publicaciones</h2>
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