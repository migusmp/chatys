import { Link } from 'react-router-dom'
import '../styles/Register.css'
import { useState } from 'react'
import type { RegisterUserData } from '../types/user'
import useFetch from '../hooks/useFetch'

export default function Register() {
    const { sendRegisterFormData } = useFetch();

    const [name, setName] = useState("")
    const [username, setUsername] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")

    async function handleRegisterData() {
        const data: RegisterUserData = {
            name,
            username,
            email,
            password
        }
        await sendRegisterFormData(data);
    }


    return (
        <div className="container">
            <h2>Create an Account</h2>
            <form id="register-form">
                <label htmlFor="name">Full Name</label>
                <input
                    id="name"
                    name="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    required />

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
                    required />

                <button type="submit" onClick={handleRegisterData}>Register</button>
            </form>
            <p className="footer-text">
                Already have an account?  <Link to="/login">Login here</Link>
            </p>
        </div>
    )
}