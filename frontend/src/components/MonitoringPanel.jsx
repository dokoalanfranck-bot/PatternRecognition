import React, { memo, useState, useCallback } from "react"
import { savePattern } from "../api/api"

function fmt(v, d = 2) {
  if (v === undefined || v === null) return "-"
  return typeof v === "number" ? v.toLocaleString("fr-FR", { maximumFractionDigits: d }) : v
}

function formatDate(d) {
  if (!d) return "-"
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  })
}

const SEC = {
  background: "#fff", border: "1px solid #e8e8e8",
  borderRadius: 10, padding: "14px 18px", marginBottom: 12
}
const TITLE = { margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#2d3436" }
const CARDS = { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }

const StatCard = memo(({ title, value, unit, color, icon }) => (
  <div style={{
    background: "#fff", border: "1px solid #e8e8e8", borderRadius: 8,
    padding: "10px 14px", minWidth: 130, flex: "1 1 130px",
    borderLeft: `4px solid ${color || "#0984e3"}`
  }}>
    <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>{icon} {title}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color: color || "#2d3436" }}>
      {value}
      <span style={{ fontSize: 11, fontWeight: 400, color: "#aaa", marginLeft: 3 }}>{unit}</span>
    </div>
  </div>
))

const DistributionBar = memo(({ distribution }) => {
  const total = distribution.excellent.count + distribution.good.count + distribution.low.count
  if (total === 0) return null
  const segs = [
    { ...distribution.excellent, key: "excellent" },
    { ...distribution.good, key: "good" },
    { ...distribution.low, key: "low" },
  ]
  return (
    <div>
      <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", height: 28, marginBottom: 6 }}>
        {segs.map(s => {
          const pct = (s.count / total) * 100
          if (pct === 0) return null
          return (
            <div key={s.key} style={{
              width: `${pct}%`, background: s.color,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 11, fontWeight: 700,
              minWidth: s.count > 0 ? 30 : 0
            }}>
              {s.count}
            </div>
          )
        })}
      </div>
      <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#555" }}>
        {segs.map(s => (
          <span key={s.key}>
            <span style={{
              display: "inline-block", width: 8, height: 8,
              borderRadius: "50%", background: s.color, marginRight: 4
            }} />
            {s.label} : {s.count}
          </span>
        ))}
      </div>
    </div>
  )
})

const MonitoringPanel = memo(({ monitoring, matchCount, onPatternSaved }) => {
  const [saving, setSaving] = useState(false)
  const [saveName, setSaveName] = useState("")
  const [saveDesc, setSaveDesc] = useState("")
  const [saveMsg, setSaveMsg] = useState(null)
  const [showSaveForm, setShowSaveForm] = useState(false)

  const handleSave = useCallback(async () => {
    if (!saveName.trim()) return
    const pi = monitoring?.pattern_info
    if (!pi) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await savePattern(pi.start, pi.end, saveName.trim(), saveDesc.trim(), matchCount || 0)
      if (res.error) { setSaveMsg({ type: "error", text: res.error }) }
      else {
        setSaveMsg({ type: "ok", text: res.message })
        setSaveName("")
        setSaveDesc("")
        setShowSaveForm(false)
        if (onPatternSaved) onPatternSaved()
      }
    } catch { setSaveMsg({ type: "error", text: "Erreur reseau." }) }
    setSaving(false)
  }, [saveName, saveDesc, monitoring, matchCount, onPatternSaved])

  if (!monitoring) return null
  const { pattern_info: pi, search_info: si, distribution, score_stats: ss } = monitoring

  return (
    <div style={{ marginTop: 16 }}>
      <h3 style={{
        margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: "#2d3436",
        borderBottom: "2px solid #0984e3", paddingBottom: 6,
        display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        Monitoring de la detection
        {!showSaveForm && (
          <button onClick={() => setShowSaveForm(true)} style={{
            padding: "6px 16px", borderRadius: 6, border: "2px solid #2ecc71",
            background: "#2ecc71", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer"
          }}>
            Sauvegarder ce pattern
          </button>
        )}
      </h3>

      {/* Save form */}
      {showSaveForm && (
        <div style={{ ...SEC, borderLeft: "4px solid #2ecc71" }}>
          <h4 style={TITLE}>Sauvegarder dans la bibliotheque</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              value={saveName} onChange={e => setSaveName(e.target.value)}
              placeholder="Nom du pattern (obligatoire)"
              style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13 }}
            />
            <textarea
              value={saveDesc} onChange={e => setSaveDesc(e.target.value)}
              placeholder="Description (optionnel)"
              rows={2}
              style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13, resize: "vertical" }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleSave} disabled={saving || !saveName.trim()}
                style={{
                  padding: "8px 20px", borderRadius: 6, border: "none",
                  background: saveName.trim() ? "#2ecc71" : "#ddd",
                  color: "#fff", fontWeight: 700, cursor: saveName.trim() ? "pointer" : "not-allowed"
                }}>
                {saving ? "Sauvegarde..." : "Confirmer"}
              </button>
              <button onClick={() => { setShowSaveForm(false); setSaveMsg(null) }}
                style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>
                Annuler
              </button>
            </div>
          </div>
          {saveMsg && (
            <div style={{ marginTop: 8, fontSize: 12, color: saveMsg.type === "ok" ? "#2ecc71" : "#e74c3c" }}>
              {saveMsg.text}
            </div>
          )}
        </div>
      )}

      {/* Distribution */}
      <div style={SEC}>
        <h4 style={TITLE}>Distribution des similitudes</h4>
        <DistributionBar distribution={distribution} />
        <div style={CARDS}>
          <StatCard title="Excellent (80-100%)" value={distribution.excellent.count} unit="cycles" color="#2ecc71" icon="+" />
          <StatCard title="Bon (50-79%)" value={distribution.good.count} unit="cycles" color="#3498db" icon="o" />
          <StatCard title="Faible (<50%)" value={distribution.low.count} unit="cycles" color="#f39c12" icon="-" />
        </div>
      </div>

      {/* Pattern info */}
      <div style={SEC}>
        <h4 style={TITLE}>Pattern selectionne</h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px", fontSize: 12 }}>
          <div><span style={{ color: "#888" }}>Debut :</span> <strong>{formatDate(pi.start)}</strong></div>
          <div><span style={{ color: "#888" }}>Fin :</span> <strong>{formatDate(pi.end)}</strong></div>
          <div><span style={{ color: "#888" }}>Duree :</span> <strong>{fmt(pi.duration_hours)} h</strong></div>
          <div><span style={{ color: "#888" }}>Points :</span> <strong>{fmt(pi.nb_points, 0)}</strong></div>
        </div>
        <div style={CARDS}>
          <StatCard title="Moyenne" value={fmt(pi.mean)} unit="kW" color="#0984e3" icon="u" />
          <StatCard title="Ecart-type" value={fmt(pi.std)} unit="kW" color="#6c5ce7" icon="o" />
          <StatCard title="Min" value={fmt(pi.min)} unit="kW" color="#00b894" icon="v" />
          <StatCard title="Max" value={fmt(pi.max)} unit="kW" color="#d63031" icon="^" />
          <StatCard title="Amplitude" value={fmt(pi.amplitude)} unit="kW" color="#e17055" icon="|" />
          <StatCard title="Energie totale" value={fmt(pi.energy_total, 0)} unit="kW*pts" color="#fdcb6e" icon="E" />
        </div>
      </div>

      {/* Scores */}
      {ss?.best_score !== undefined && (
        <div style={SEC}>
          <h4 style={TITLE}>Scores MASS</h4>
          <div style={CARDS}>
            <StatCard title="Meilleur" value={fmt(ss.best_score, 4)} unit="MASS" color="#2ecc71" icon="*" />
            <StatCard title="Moyen" value={fmt(ss.avg_score, 4)} unit="MASS" color="#0984e3" icon="~" />
            <StatCard title="Median" value={fmt(ss.median_score, 4)} unit="MASS" color="#6c5ce7" icon="~" />
            <StatCard title="Pire" value={fmt(ss.worst_score, 4)} unit="MASS" color="#e74c3c" icon="!" />
          </div>
        </div>
      )}

      {/* Pipeline */}
      <div style={SEC}>
        <h4 style={TITLE}>Pipeline de recherche</h4>
        <div style={{ fontSize: 12, color: "#555" }}>
          Serie : <strong>{fmt(si.series_length, 0)}</strong> points |
          Positions scannees : <strong>{fmt(si.total_positions_scanned, 0)}</strong> |
          Matches : <strong>{si.matches_returned}</strong> |
          Temps : <strong>{fmt(si.computation_time_sec, 3)} s</strong>
        </div>
      </div>
    </div>
  )
})

export default MonitoringPanel
