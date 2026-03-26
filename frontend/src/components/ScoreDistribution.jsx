import React, { useMemo, memo } from "react"
import Plot from "react-plotly.js"

// ─── Config Plotly stable hors du composant ──────────────────────────────────
const PLOT_CONFIG = { scrollZoom: true, displayModeBar: true }

const LAYOUT_BASE = {
  height: 250,
  margin: { t: 10, b: 45, l: 50, r: 20 },
  xaxis: {
    title: { text: "Sous-séquence (position)", font: { size: 11 } },
    showgrid: false
  },
  yaxis: {
    title: { text: "Score (distance euclidienne)", font: { size: 11 } },
    showgrid: true,
    gridcolor: "#f0f0f0"
  },
  plot_bgcolor: "#fafafa",
  paper_bgcolor: "#fff",
  showlegend: false,
  bargap: 0.1
}

const ScoreDistribution = memo(({ allScores, matches }) => {
  // ✅ Hooks toujours appelés en premier, avant tout return conditionnel
  const topScores = useMemo(
    () => new Set((matches || []).map(m => m.score)),
    [matches]
  )

  const plotData = useMemo(() => {
    if (!allScores || allScores.length === 0) return []
    const scores = allScores.map(s => s.score)
    const indices = allScores.map((_, i) => i + 1)
    return [{
      x: indices,
      y: scores,
      type: "bar",
      marker: {
        color: scores.map(s => topScores.has(s) ? "#e74c3c" : "#b2bec3"),
        line: { width: 0 }
      },
      hovertemplate: "Sous-séquence #%{x}<br>Score : %{y:.2f}<extra></extra>"
    }]
  }, [allScores, topScores])

  // ✅ Early return après les hooks
  if (!allScores || allScores.length === 0) return null

  return (
    <div style={{ marginTop: 16, marginBottom: 8 }}>
      <h3 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 600, color: "#2d3436" }}>
        Scores de similarité — pattern vs sous-séquences
        <span style={{ fontWeight: 400, color: "#888", fontSize: 12, marginLeft: 8 }}>
          {allScores.length} sous-séquences calculées · {(matches || []).length} top matches (rouge)
        </span>
      </h3>

      {/* ✅ layout stable — ne déclenche pas de re-render Plotly inutile */}
      <Plot
        data={plotData}
        layout={LAYOUT_BASE}
        style={{ width: "100%" }}
        useResizeHandler
        config={PLOT_CONFIG}
      />
    </div>
  )
})

export default ScoreDistribution
