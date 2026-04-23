import React, { useMemo, useState, memo } from "react"
import Plot from "react-plotly.js"
import { BarChart3 } from "lucide-react"

const PLOT_CONFIG = { scrollZoom: true, displayModeBar: true }

function toSimilarity(scores) {
  if (!scores || scores.length === 0) return []
  const raw = scores.map(s => s.score)
  const minS = Math.min(...raw)
  const maxS = Math.max(...raw)
  const range = maxS - minS
  return raw.map(s => range === 0 ? 100 : Math.round((1 - (s - minS) / range) * 100))
}

const ScoreDistribution = memo(({ allScores, matches }) => {
  const [threshold, setThreshold] = useState(50)

  const similarities = useMemo(() => toSimilarity(allScores), [allScores])

  const { aboveCount, belowCount } = useMemo(() => {
    let above = 0, below = 0
    similarities.forEach(sim => sim >= threshold ? above++ : below++)
    return { aboveCount: above, belowCount: below }
  }, [similarities, threshold])

  const plotData = useMemo(() => {
    if (!allScores || allScores.length === 0) return []
    const indices = allScores.map((_, i) => i + 1)
    return [{
      x: indices,
      y: similarities,
      type: "bar",
      marker: {
        color: similarities.map(sim =>
          sim >= threshold ? "rgba(99,102,241,0.85)" : "rgba(148,163,184,0.25)"
        ),
        line: { width: 0 }
      },
      hovertemplate: "Sous-séquence #%{x}<br>Similarité : %{y}%<extra></extra>"
    }]
  }, [allScores, similarities, threshold])

  const layout = useMemo(() => ({
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
      title: { text: "Similarité (%)", font: { size: 11, color: "#64748b" } },
      range: [0, 105],
      showgrid: true,
      gridcolor: "rgba(148,163,184,0.08)",
      tickfont: { color: "#94a3b8", size: 10 },
      tickcolor: "#334155",
      linecolor: "#334155",
      zeroline: false,
    },
    shapes: [{
      type: "line",
      x0: 0,
      x1: 1,
      xref: "paper",
      y0: threshold,
      y1: threshold,
      yref: "y",
      line: { color: "#f59e0b", width: 2, dash: "dot" }
    }],
    annotations: [{
      x: 1,
      y: threshold,
      xref: "paper",
      yref: "y",
      text: `${threshold}%`,
      showarrow: false,
      xanchor: "left",
      font: { color: "#f59e0b", size: 11, family: "Inter, sans-serif" },
      xshift: 4,
    }],
    plot_bgcolor: "transparent",
    paper_bgcolor: "transparent",
    showlegend: false,
    bargap: 0.1,
    font: { family: "Inter, sans-serif" },
  }), [threshold])

  if (!allScores || allScores.length === 0) return null

  return (
    <div className="section animate-in" style={{ marginTop: 16, marginBottom: 8 }}>
      <h3 style={{
        margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <BarChart3 size={16} style={{ color: 'var(--accent-indigo)' }} />
        Distribution des similitudes
        <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12, marginLeft: 4 }}>
          {allScores.length} sous-séquences
        </span>
      </h3>

      <Plot
        data={plotData}
        layout={layout}
        style={{ width: "100%" }}
        useResizeHandler
        config={PLOT_CONFIG}
      />

      {/* Slider seuil */}
      <div style={{ padding: '8px 4px 2px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Seuil de similarité</span>
          <span style={{
            fontSize: 13, fontWeight: 700, color: '#f59e0b',
            background: 'rgba(245,158,11,0.12)', borderRadius: 6, padding: '1px 8px'
          }}>
            {threshold}%
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={threshold}
          onChange={e => setThreshold(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }}
        />

        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
          <div style={{
            flex: 1, background: 'rgba(99,102,241,0.10)', borderRadius: 8,
            padding: '8px 12px', borderLeft: '3px solid rgba(99,102,241,0.7)'
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
              ≥ {threshold}% (dans le seuil)
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'rgba(129,140,248,0.95)' }}>
              {aboveCount}
              <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>
                sous-séquences
              </span>
            </div>
          </div>
          <div style={{
            flex: 1, background: 'rgba(148,163,184,0.07)', borderRadius: 8,
            padding: '8px 12px', borderLeft: '3px solid rgba(148,163,184,0.3)'
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
              &lt; {threshold}% (hors seuil)
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-muted)' }}>
              {belowCount}
              <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>
                sous-séquences
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default ScoreDistribution
