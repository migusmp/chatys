import { Link, useNavigate } from 'react-router-dom';
import React, { useState } from 'react';
import useUser from '../../../hooks/useUser';
import styles from '../../../styles/modules/Register.module.css';

export default function Register() {
    const navigate = useNavigate();

    const [usernameError, setUsernameError] = useState("");
    const [nameError, setNameError] = useState("");
    const [emailError, setEmailError] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [generalError, setGeneralError] = useState("");

    const { sendRegisterFormData } = useUser();

    const [name, setName] = useState("");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    async function handleRegisterData(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setNameError("");
        setUsernameError("");
        setEmailError("");
        setPasswordError("");
        setGeneralError("");

        const data = await sendRegisterFormData({
            name,
            username,
            email,
            password
        });

        if (data) {
            if (data.status == "error") {
                switch (data.type) {
                    case "USERNAME_INVALID":
                    case "USERNAME_EMPTY":
                    case "USER_ALREADY_EXISTS":
                        setUsernameError(data.message);
                        break;
                    case "NAME_EMPTY":
                        setNameError(data.message);
                        break;
                    case "EMAIL_INVALID":
                        setEmailError(data.message);
                        break;
                    case "EMAIL_EXISTS":
                        setEmailError(data.message);
                        break;
                    case "SHORT_PASSWORD":
                        setPasswordError(data.message);
                        break;
                    default:
                        setGeneralError(data.message);
                        break;
                }
            } else if (data.status == "success") {
                navigate('/login')
            }
        } 

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
                    {nameError && <div className={styles.error}>{nameError}</div>}

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
                    {usernameError && <div className={styles.error}>{usernameError}</div>}

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
                    {emailError && <div className={styles.error}>{emailError}</div>}

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
                    {passwordError && <div className={styles.error}>{passwordError}</div>}

                    <button type="submit">Register</button>

                    {generalError && <div className={styles.error} style={{ marginTop: "1rem", textAlign: "center" }}>{generalError}</div>}
                </form>

                <p className={styles.footerText}>
                    Already have an account? <Link to="/login">Login here</Link>
                </p>
            </div>
        </div>
    );
}
