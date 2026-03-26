import React, { useState, useEffect, useCallback, memo } from "react"
import { listPatterns, deletePattern } from "../api/api"

function fmt(v, d = 2) {
  if (v === undefined || v === null) return "-"
  return typeof v === "number" ? v.toLocaleString("fr-FR", { maximumFractionDigits: d }) : v
}

const SEC = {
  background: "#fff", border: "1px solid #e8e8e8",
  borderRadius: 10, padding: "14px 18px", marginBottom: 12
}

const PatternCard = memo(({ pattern, onDelete }) => {
  const [confirming, setConfirming] = useState(false)
  const st = pattern.stats || {}
  const date = new Date(pattern.created_at * 1000).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  })

  const handleDelete = useCallback(async () => {
    await deletePattern(pattern.id)
    onDelete()
  }, [pattern.id, onDelete])

  return (
    <div style={{
      border: "1px solid #e8e8e8", borderRadius: 10,
      padding: "12px 16px", background: "#fff",
      borderLeft: "4px solid #6c5ce7"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#2d3436" }}>{pattern.name}</div>
          {pattern.description && (
            <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{pattern.description}</div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {!confirming ? (
            <button onClick={() => setConfirming(true)} style={{
              padding: "4px 10px", borderRadius: 4, border: "1px solid #e74c3c",
              background: "#fff", color: "#e74c3c", fontSize: 11, cursor: "pointer"
            }}>
              Supprimer
            </button>
          ) : (
            <>
              <button onClick={handleDelete} style={{
                padding: "4px 10px", borderRadius: 4, border: "none",
                background: "#e74c3c", color: "#fff", fontSize: 11, cursor: "pointer", fontWeight: 700
              }}>
                Confirmer
              </button>
              <button onClick={() => setConfirming(false)} style={{
                padding: "4px 10px", borderRadius: 4, border: "1px solid #ddd",
                background: "#fff", fontSize: 11, cursor: "pointer"
              }}>
                Annuler
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px 16px", fontSize: 11, color: "#555", marginTop: 8 }}>
        <div>Points : <strong>{fmt(st.nb_points, 0)}</strong></div>
        <div>Durée : <strong>{fmt(st.duration_hours)} h</strong></div>
        <div>Matches : <strong style={{ color: "#6c5ce7" }}>{pattern.match_count}</strong></div>
        <div>Moyenne : <strong>{fmt(st.mean)} kW</strong></div>
        <div>Amplitude : <strong>{fmt(st.amplitude)} kW</strong></div>
        <div>Écart-type : <strong>{fmt(st.std)} kW</strong></div>
      </div>

      <div style={{ fontSize: 10, color: "#aaa", marginTop: 6 }}>
        Sauvegardé le {date}
      </div>
    </div>
  )
})

const PatternLibrary = memo(({ refreshKey }) => {
  const [patterns, setPatterns] = useState([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listPatterns()
      setPatterns(res.patterns || [])
    } catch { setPatterns([]) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load, refreshKey])

  return (
    <div style={{ ...SEC, marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#2d3436" }}>
          Bibliothèque de patterns ({patterns.length})
        </h3>
        <button onClick={load} disabled={loading} style={{
          padding: "4px 12px", borderRadius: 4, border: "1px solid #ddd",
          background: "#fff", fontSize: 11, cursor: "pointer"
        }}>
          {loading ? "..." : "Rafraîchir"}
        </button>
      </div>

      {patterns.length === 0 && !loading && (
        <div style={{ textAlign: "center", padding: "20px 0", color: "#aaa", fontSize: 13 }}>
          Aucun pattern sauvegardé. Analysez un motif puis cliquez "Sauvegarder ce pattern".
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {patterns.map(p => (
          <PatternCard key={p.id} pattern={p} onDelete={load} />
        ))}
      </div>
    </div>
  )
})

export default PatternLibrary
