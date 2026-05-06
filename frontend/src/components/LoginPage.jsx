import React, { useState } from "react"
import { Activity, Lock, User, Loader } from "lucide-react"
import { login } from "../api/api"

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    if (!username.trim() || !password) {
      setError("Veuillez renseigner l'identifiant et le mot de passe.")
      return
    }
    setLoading(true)
    try {
      const data = await login(username.trim(), password)
      localStorage.setItem("auth_token", data.access_token)
      localStorage.setItem("auth_username", data.username)
      onLogin(data.username)
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur de connexion.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-overlay">
      <div className="login-card animate-in">
        {/* Logo */}
        <div className="login-logo">
          <Activity size={32} />
        </div>
        <h1 className="login-title">Pattern Recognition</h1>
        <p className="login-subtitle">Connectez-vous pour accéder à la plateforme</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label className="login-label">
              <User size={14} /> Identifiant
            </label>
            <input
              className="login-input"
              type="text"
              autoComplete="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="login"
              disabled={loading}
            />
          </div>

          <div className="login-field">
            <label className="login-label">
              <Lock size={14} /> Mot de passe
            </label>
            <input
              className="login-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button className="btn btn-primary login-btn" type="submit" disabled={loading}>
            {loading
              ? <><Loader size={16} style={{ animation: "spin 1s linear infinite" }} /> Connexion…</>
              : "Se connecter"
            }
          </button>
        </form>
      </div>
    </div>
  )
}
