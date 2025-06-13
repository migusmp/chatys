import { Link } from 'react-router-dom';
import React, { useState } from 'react';
import useUser from '../../../hooks/useUser';
import styles from '../../../styles/modules/Register.module.css';

export default function Register() {
    const { sendRegisterFormData } = useUser();

    const [name, setName] = useState("");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    async function handleRegisterData(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        await sendRegisterFormData({
            name,
            username,
            email,
            password
        });
    }

    return (
        <div className={styles.body}>

            <div className={styles.container}>
                <h2 className={styles.title}>Create an Account</h2>
                <form className={styles.registerForm} onSubmit={handleRegisterData}>
                    <label htmlFor="name">Full Name</label>
                    <input
                        id="name"
                        name="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="John Doe"
                        required
                    />

                    <label htmlFor="username">Username</label>
                    <input
                        id="username"
                        name="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="john_doe"
                        required
                    />

                    <label htmlFor="email">Email Address</label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="john@example.com"
                        required
                    />

                    <label htmlFor="password">Password</label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                    />

                    <button type="submit">Register</button>
                </form>
                <p className={styles.footerText}>
                    Already have an account? <Link to="/login">Login here</Link>
                </p>
            </div>
        </div>

    );
}
