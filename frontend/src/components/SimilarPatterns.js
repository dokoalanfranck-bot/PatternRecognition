import React from "react"

function getColor(sim) {
  if (sim >= 80) return "#2ecc71"
  if (sim >= 50) return "#3498db"
  return "#f39c12"
}

function getLabel(sim) {
  if (sim >= 80) return "Très similaire"
  if (sim >= 50) return "Similaire"
  return "Peu similaire"
}

function formatDate(d) {
  if (!d) return ""
  return new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

export default function SimilarPatterns({ matches, onNavigate }) {
  if (!matches || !matches.length) {
    return (
      <div style={{ padding: "20px 0", textAlign: "center", color: "#aaa", fontSize: 13 }}>
        Sélectionnez une zone sur le graphe pour détecter les patterns similaires.
      </div>
    )
  }

  return (
    <div style={{ marginTop: 16 }}>
      <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 600, color: "#2d3436" }}>
        Patterns similaires ({matches.length})
      </h3>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {matches.map((m, i) => {
          const sim = m.similarity ?? 0
          const color = getColor(sim)

          return (
            <div
              key={i}
              onClick={() => onNavigate?.(m)}
              style={{
                border: `2px solid ${color}`,
                borderRadius: 8,
                padding: "10px 14px",
                minWidth: 180,
                backgroundColor: `${color}10`,
                cursor: "pointer",
                transition: "transform 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
              onMouseLeave={e => e.currentTarget.style.transform = "none"}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <strong style={{ fontSize: 14 }}>#{i + 1}</strong>
                <span style={{
                  backgroundColor: color, color: "#fff", borderRadius: 10,
                  padding: "1px 8px", fontSize: 12, fontWeight: 700
                }}>
                  {sim.toFixed(0)}%
                </span>
              </div>

              <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{getLabel(sim)}</div>

              <div style={{ fontSize: 11, color: "#555" }}>
                <div>{formatDate(m.start)}</div>
                <div>{formatDate(m.end)}</div>
              </div>

              <div style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>
                Score DTW : {m.score?.toFixed(2)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}