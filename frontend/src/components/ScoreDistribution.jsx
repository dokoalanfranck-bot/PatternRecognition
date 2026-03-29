import React, { useMemo, memo } from "react"
import Plot from "react-plotly.js"
import { BarChart3 } from "lucide-react"

const PLOT_CONFIG = { scrollZoom: true, displayModeBar: true }

const LAYOUT_BASE = {
  height: 260,
  margin: { t: 10, b: 45, l: 50, r: 20 },
  xaxis: {
    title: { text: "Sous-séquence (position)", font: { size: 11, color: "#64748b" } },
    showgrid: false,
    tickfont: { color: "#94a3b8", size: 10 },
    tickcolor: "#334155",
    linecolor: "#334155",
  },
  yaxis: {
    title: { text: "Score (distance euclidienne)", font: { size: 11, color: "#64748b" } },
    showgrid: true,
    gridcolor: "rgba(148,163,184,0.08)",
    tickfont: { color: "#94a3b8", size: 10 },
    tickcolor: "#334155",
    linecolor: "#334155",
    zeroline: false,
  },
  plot_bgcolor: "transparent",
  paper_bgcolor: "transparent",
  showlegend: false,
  bargap: 0.1,
  font: { family: "Inter, sans-serif" },
}

const ScoreDistribution = memo(({ allScores, matches }) => {
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
        color: scores.map(s => topScores.has(s) ? "#f87171" : "rgba(129,140,248,0.3)"),
        line: { width: 0 }
      },
      hovertemplate: "Sous-séquence #%{x}<br>Score : %{y:.2f}<extra></extra>"
    }]
  }, [allScores, topScores])

  if (!allScores || allScores.length === 0) return null

  return (
    <div className="section animate-in" style={{ marginTop: 16, marginBottom: 8 }}>
      <h3 style={{
        margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <BarChart3 size={16} style={{ color: 'var(--accent-indigo)' }} />
        Scores de similarité
        <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12, marginLeft: 4 }}>
          {allScores.length} sous-séquences · {(matches || []).length} top matches
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#f87171', marginLeft: 6, verticalAlign: 'middle' }} />
        </span>
      </h3>

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
