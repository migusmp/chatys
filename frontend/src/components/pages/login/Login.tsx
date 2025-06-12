import { Link, useNavigate } from 'react-router-dom'
import '../../../styles/Login.css'
import { useState } from 'react'
import useUser from '../../../hooks/useUser'

export default function Login() {
    const { sendLoginFormData } = useUser()
    const navigate = useNavigate()
    
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")

    async function handleLoginData() {

        const success = await sendLoginFormData({
            username,
            password
        });
        
        if (success) {
            navigate('/')
        } else {
            console.log("Login fallido")
        }
    }


    return (
        <form id="login-form">
            <h2 style={{ textAlign: "center", marginBottom: "2rem" }}>Login</h2>

            <div className="input-group">
                <label htmlFor="username" >Usuario</label>
                <input
                    type="text"
                    id="username"
                    name="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                />
            </div>

            <div className="input-group">
                <label htmlFor="password">Contraseña</label>
                <input
                    type="password"
                    id="password"
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
            </div>

            <button type="submit" onClick={handleLoginData}>Entrar</button>

            <p className="register-text">
                Don't have an account?
                <Link to="/register" >Register</Link>
            </p>
        </form>
    )
}