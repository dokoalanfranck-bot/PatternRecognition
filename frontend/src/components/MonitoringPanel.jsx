import React, { memo } from "react"

// ─── Helpers stables hors du composant ───────────────────────────────────────
function fmt(v, decimals = 2) {
  if (v === undefined || v === null) return "—"
  return typeof v === "number"
    ? v.toLocaleString("fr-FR", { maximumFractionDigits: decimals })
    : v
}

function formatDate(d) {
  if (!d) return "—"
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  })
}

// ─── Styles stables hors du composant ────────────────────────────────────────
const SECTION_STYLE = {
  background: "#fff", border: "1px solid #e8e8e8",
  borderRadius: 10, padding: "14px 18px", marginBottom: 12
}
const SECTION_TITLE = {
  margin: "0 0 10px", fontSize: 14,
  fontWeight: 700, color: "#2d3436"
}
const CARDS_WRAP = {
  display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10
}

// ─── Sous-composants mémoïsés ─────────────────────────────────────────────────
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

const ProgressBar = memo(({ label, value, max, color }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#555", marginBottom: 2 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600 }}>{fmt(value, 0)} / {fmt(max, 0)} ({pct}%)</span>
      </div>
      <div style={{ background: "#f0f0f0", borderRadius: 4, height: 8, overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: color || "#0984e3",
          borderRadius: 4, transition: "width 0.4s ease"
        }} />
      </div>
    </div>
  )
})

const DistributionBar = memo(({ distribution }) => {
  const total = distribution.excellent.count + distribution.good.count + distribution.low.count
  if (total === 0) return null

  const segments = [
    { ...distribution.excellent, key: "excellent" },
    { ...distribution.good, key: "good" },
    { ...distribution.low, key: "low" },
  ]

  return (
    <div>
      <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", height: 28, marginBottom: 6 }}>
        {segments.map(seg => {
          const pct = (seg.count / total) * 100
          if (pct === 0) return null
          return (
            <div key={seg.key} style={{
              width: `${pct}%`, background: seg.color,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 11, fontWeight: 700,
              minWidth: seg.count > 0 ? 30 : 0,
              transition: "width 0.4s ease"
            }}>
              {seg.count}
            </div>
          )
        })}
      </div>
      <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#555" }}>
        {segments.map(seg => (
          <span key={seg.key}>
            <span style={{
              display: "inline-block", width: 8, height: 8,
              borderRadius: "50%", background: seg.color, marginRight: 4
            }} />
            {seg.label} : {seg.count} cycle{seg.count > 1 ? "s" : ""}
          </span>
        ))}
      </div>
    </div>
  )
})

// ─── Composant principal mémoïsé ─────────────────────────────────────────────
const MonitoringPanel = memo(({ monitoring }) => {
  if (!monitoring) return null

  const { pattern_info, search_info, distribution, score_stats } = monitoring

  return (
    <div style={{ marginTop: 16 }}>
      <h3 style={{
        margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: "#2d3436",
        borderBottom: "2px solid #0984e3", paddingBottom: 6
      }}>
        📊 Monitoring de la détection
      </h3>

      {/* Distribution des similitudes */}
      <div style={SECTION_STYLE}>
        <h4 style={SECTION_TITLE}>📈 Distribution des similitudes</h4>
        <DistributionBar distribution={distribution} />
        <div style={CARDS_WRAP}>
          <StatCard title="Excellent (80–100%)" value={distribution.excellent.count} unit="cycles" color="#2ecc71" icon="🟢" />
          <StatCard title="Bon (50–79%)" value={distribution.good.count} unit="cycles" color="#3498db" icon="🔵" />
          <StatCard title="Faible (<50%)" value={distribution.low.count} unit="cycles" color="#f39c12" icon="🟡" />
        </div>
      </div>

      {/* Pattern sélectionné */}
      <div style={SECTION_STYLE}>
        <h4 style={SECTION_TITLE}>🔍 Pattern sélectionné</h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px", fontSize: 12 }}>
          <div><span style={{ color: "#888" }}>Début :</span> <strong>{formatDate(pattern_info.start)}</strong></div>
          <div><span style={{ color: "#888" }}>Fin :</span> <strong>{formatDate(pattern_info.end)}</strong></div>
          <div><span style={{ color: "#888" }}>Durée :</span> <strong>{fmt(pattern_info.duration_hours)} h</strong></div>
          <div><span style={{ color: "#888" }}>Points :</span> <strong>{fmt(pattern_info.nb_points, 0)}</strong></div>
        </div>
        <div style={CARDS_WRAP}>
          <StatCard title="Moyenne" value={fmt(pattern_info.mean)} unit="kW" color="#0984e3" icon="μ" />
          <StatCard title="Écart-type" value={fmt(pattern_info.std)} unit="kW" color="#6c5ce7" icon="σ" />
          <StatCard title="Min" value={fmt(pattern_info.min)} unit="kW" color="#00b894" icon="▼" />
          <StatCard title="Max" value={fmt(pattern_info.max)} unit="kW" color="#d63031" icon="▲" />
          <StatCard title="Amplitude" value={fmt(pattern_info.amplitude)} unit="kW" color="#e17055" icon="↕" />
          <StatCard title="Énergie totale" value={fmt(pattern_info.energy_total, 0)} unit="kW·pts" color="#fdcb6e" icon="⚡" />
        </div>
      </div>

      {/* Scores MASS */}
      {score_stats?.best_score !== undefined && (
        <div style={SECTION_STYLE}>
          <h4 style={SECTION_TITLE}>🎯 Scores de similarité (distance MASS)</h4>
          <div style={CARDS_WRAP}>
            <StatCard title="Meilleur score" value={fmt(score_stats.best_score, 4)} unit="MASS" color="#2ecc71" icon="🏆" />
            <StatCard title="Score moyen" value={fmt(score_stats.avg_score, 4)} unit="MASS" color="#0984e3" icon="⊘" />
            <StatCard title="Score médian" value={fmt(score_stats.median_score, 4)} unit="MASS" color="#6c5ce7" icon="~" />
            <StatCard title="Pire score" value={fmt(score_stats.worst_score, 4)} unit="MASS" color="#e74c3c" icon="⚠" />
            <StatCard title="Écart-type scores" value={fmt(score_stats.std_score, 4)} unit="MASS" color="#fdcb6e" icon="σ" />
          </div>
        </div>
      )}

      {/* Pipeline de recherche */}
      <div style={SECTION_STYLE}>
        <h4 style={SECTION_TITLE}>⚙️ Pipeline de recherche</h4>
        <div style={{ marginBottom: 8, fontSize: 12, color: "#555" }}>
          Série totale : <strong>{fmt(search_info.series_length, 0)}</strong> points ·{" "}
          Positions scannées : <strong>{fmt(search_info.total_positions_scanned, 0)}</strong> ·{" "}
          Temps : <strong>{fmt(search_info.computation_time_sec, 3)} s</strong>
        </div>
        <ProgressBar
          label="① Profil de distance calculé (MASS — O(n log n))"
          value={search_info.total_positions_scanned}
          max={search_info.total_positions_scanned}
          color="#74b9ff"
        />
        <ProgressBar
          label="② Top matches extraits"
          value={search_info.matches_returned}
          max={search_info.total_positions_scanned}
          color="#a29bfe"
        />
      </div>
    </div>
  )
})

export default MonitoringPanel
