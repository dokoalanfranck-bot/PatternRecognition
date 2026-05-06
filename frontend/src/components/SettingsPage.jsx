import React, { useState } from "react"
import { Lock, CheckCircle, Loader, ShieldCheck } from "lucide-react"
import { changePassword } from "../api/api"

export default function SettingsPage({ username }) {
  const [current, setCurrent] = useState("")
  const [newPwd, setNewPwd] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (!current || !newPwd || !confirm) {
      setError("Tous les champs sont requis.")
      return
    }
    if (newPwd !== confirm) {
      setError("Le nouveau mot de passe et la confirmation ne correspondent pas.")
      return
    }
    if (newPwd.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.")
      return
    }

    setLoading(true)
    try {
      const data = await changePassword(current, newPwd, confirm)
      setSuccess(data.message || "Mot de passe modifié avec succès.")
      setCurrent("")
      setNewPwd("")
      setConfirm("")
    } catch (err) {
      setError(err.response?.data?.detail || "Une erreur est survenue.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="settings-page animate-in">
      <div className="settings-card">
        <div className="settings-header">
          <ShieldCheck size={22} style={{ color: "var(--accent-indigo)" }} />
          <div>
            <h2 className="settings-title">Paramètres du compte</h2>
            <p className="settings-sub">Connecté en tant que <strong>{username}</strong></p>
          </div>
        </div>

        <div className="settings-section">
          <h3 className="settings-section-title">
            <Lock size={15} /> Modifier le mot de passe
          </h3>

          <form onSubmit={handleSubmit} className="settings-form">
            <div className="settings-field">
              <label className="settings-label">Mot de passe actuel</label>
              <input
                className="settings-input"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={e => setCurrent(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            <div className="settings-field">
              <label className="settings-label">Nouveau mot de passe</label>
              <input
                className="settings-input"
                type="password"
                autoComplete="new-password"
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                placeholder="6 caractères minimum"
                disabled={loading}
              />
            </div>

            <div className="settings-field">
              <label className="settings-label">Confirmer le nouveau mot de passe</label>
              <input
                className="settings-input"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            {error && <div className="settings-error">{error}</div>}
            {success && (
              <div className="settings-success">
                <CheckCircle size={14} /> {success}
              </div>
            )}

            <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 4 }}>
              {loading
                ? <><Loader size={15} style={{ animation: "spin 1s linear infinite" }} /> Enregistrement…</>
                : "Enregistrer le nouveau mot de passe"
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
