import { Link, useNavigate } from 'react-router-dom'
import React, { useState } from 'react'
import useUser from '../../../hooks/useUser'
import styles from '../../../styles/modules/Login.module.css'
import { useUserContext } from '../../../context/UserContext'

export default function Login() {
    const { sendLoginFormData } = useUser()
    const { refreshUser } = useUserContext()
    const navigate = useNavigate()

    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")

    async function handleLoginData(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const success = await sendLoginFormData({ username, password });

        if (success) {
            await refreshUser();
            navigate('/')
        } else {
            console.log("Login fallido")
        }
    }

    return (
        <div className={styles.body}>
            <form className={styles.loginForm} onSubmit={handleLoginData}>
                <h2 className={styles.title}>Login</h2>

                <div className={styles.inputGroup}>
                    <label htmlFor="username">Username</label>
                    <input
                        type="text"
                        id="username"
                        name="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                </div>

                <div className={styles.inputGroup}>
                    <label htmlFor="password">Password</label>
                    <input
                        type="password"
                        id="password"
                        name="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>

                <button className={styles.submitButton} type="submit">Login</button>

                <p className={styles.registerText}>
                    Don't have an account? <Link to="/register">Register</Link>
                </p>
            </form>
        </div>
    )
}
