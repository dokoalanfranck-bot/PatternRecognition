import React from "react"

function fmt(v, decimals = 2) {
  if (v === undefined || v === null) return "—"
  return typeof v === "number" ? v.toLocaleString("fr-FR", { maximumFractionDigits: decimals }) : v
}

function formatDate(d) {
  if (!d) return "—"
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  })
}

function StatCard({ title, value, unit, color, icon }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e8e8e8", borderRadius: 8,
      padding: "10px 14px", minWidth: 130, flex: "1 1 130px",
      borderLeft: `4px solid ${color || "#0984e3"}`
    }}>
      <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>{icon} {title}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || "#2d3436" }}>
        {value}<span style={{ fontSize: 11, fontWeight: 400, color: "#aaa", marginLeft: 3 }}>{unit}</span>
      </div>
    </div>
  )
}

function ProgressBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#555", marginBottom: 2 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600 }}>{fmt(value, 0)} / {fmt(max, 0)} ({pct}%)</span>
      </div>
      <div style={{ background: "#f0f0f0", borderRadius: 4, height: 8, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color || "#0984e3", borderRadius: 4, transition: "width 0.4s ease" }} />
      </div>
    </div>
  )
}

function DistributionBar({ distribution }) {
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
              color: "#fff", fontSize: 11, fontWeight: 700, minWidth: seg.count > 0 ? 30 : 0,
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
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: seg.color, marginRight: 4 }} />
            {seg.label} : {seg.count} cycle{seg.count > 1 ? "s" : ""}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function MonitoringPanel({ monitoring }) {
  if (!monitoring) return null

  const { pattern_info, search_info, distribution, score_stats } = monitoring

  const sectionStyle = {
    background: "#fff", border: "1px solid #e8e8e8", borderRadius: 10,
    padding: "14px 18px", marginBottom: 12
  }
  const sectionTitle = { margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#2d3436" }

  return (
    <div style={{ marginTop: 16 }}>
      <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: "#2d3436", borderBottom: "2px solid #0984e3", paddingBottom: 6 }}>
        📊 Monitoring de la détection
      </h3>

      {/* ═══ Distribution des similitudes ═══ */}
      <div style={sectionStyle}>
        <h4 style={sectionTitle}>📈 Distribution des similitudes</h4>
        <DistributionBar distribution={distribution} />
        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
          <StatCard title="Excellent (80–100%)" value={distribution.excellent.count} unit="cycles" color="#2ecc71" icon="🟢" />
          <StatCard title="Bon (50–79%)" value={distribution.good.count} unit="cycles" color="#3498db" icon="🔵" />
          <StatCard title="Faible (<50%)" value={distribution.low.count} unit="cycles" color="#f39c12" icon="🟡" />
        </div>
      </div>

      {/* ═══ Caractéristiques du pattern sélectionné ═══ */}
      <div style={sectionStyle}>
        <h4 style={sectionTitle}>🔍 Pattern sélectionné</h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px", fontSize: 12 }}>
          <div><span style={{ color: "#888" }}>Début :</span> <strong>{formatDate(pattern_info.start)}</strong></div>
          <div><span style={{ color: "#888" }}>Fin :</span> <strong>{formatDate(pattern_info.end)}</strong></div>
          <div><span style={{ color: "#888" }}>Durée :</span> <strong>{fmt(pattern_info.duration_hours)} h</strong></div>
          <div><span style={{ color: "#888" }}>Points :</span> <strong>{fmt(pattern_info.nb_points, 0)}</strong></div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          <StatCard title="Moyenne" value={fmt(pattern_info.mean)} unit="kW" color="#0984e3" icon="μ" />
          <StatCard title="Écart-type" value={fmt(pattern_info.std)} unit="kW" color="#6c5ce7" icon="σ" />
          <StatCard title="Min" value={fmt(pattern_info.min)} unit="kW" color="#00b894" icon="▼" />
          <StatCard title="Max" value={fmt(pattern_info.max)} unit="kW" color="#d63031" icon="▲" />
          <StatCard title="Amplitude" value={fmt(pattern_info.amplitude)} unit="kW" color="#e17055" icon="↕" />
          <StatCard title="Énergie totale" value={fmt(pattern_info.energy_total, 0)} unit="kW·pts" color="#fdcb6e" icon="⚡" />
        </div>
      </div>

      {/* ═══ Scores DTW ═══ */}
      {score_stats && score_stats.best_score !== undefined && (
        <div style={sectionStyle}>
          <h4 style={sectionTitle}>🎯 Scores de similarité (distance MASS)</h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <StatCard title="Meilleur score" value={fmt(score_stats.best_score, 4)} unit="MASS" color="#2ecc71" icon="🏆" />
            <StatCard title="Score moyen" value={fmt(score_stats.avg_score, 4)} unit="MASS" color="#0984e3" icon="⊘" />
            <StatCard title="Score médian" value={fmt(score_stats.median_score, 4)} unit="MASS" color="#6c5ce7" icon="~" />
            <StatCard title="Pire score" value={fmt(score_stats.worst_score, 4)} unit="MASS" color="#e74c3c" icon="⚠" />
            <StatCard title="Écart-type scores" value={fmt(score_stats.std_score, 4)} unit="MASS" color="#fdcb6e" icon="σ" />
          </div>
        </div>
      )}

      {/* ═══ Pipeline de recherche ═══ */}
      <div style={sectionStyle}>
        <h4 style={sectionTitle}>⚙️ Pipeline de recherche</h4>
        <div style={{ marginBottom: 8, fontSize: 12, color: "#555" }}>
          Série totale : <strong>{fmt(search_info.series_length, 0)}</strong> points · 
          Positions scannées : <strong>{fmt(search_info.total_positions_scanned, 0)}</strong> · 
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
}
