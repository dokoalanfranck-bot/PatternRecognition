import React from "react"
import Plot from "react-plotly.js"

export default function ScoreDistribution({ allScores, matches }) {
  if (!allScores || allScores.length === 0) return null

  const topScores = (matches || []).map(m => m.score)
  const scores = allScores.map(s => s.score)
  const indices = allScores.map((s, i) => i + 1)

  return (
    <div style={{ marginTop: 16, marginBottom: 8 }}>
      <h3 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 600, color: "#2d3436" }}>
        Scores DTW — pattern vs sous-séquences
        <span style={{ fontWeight: 400, color: "#888", fontSize: 12, marginLeft: 8 }}>
          {allScores.length} sous-séquences calculées · {topScores.length} top matches (rouge)
        </span>
      </h3>

      <Plot
        data={[
          {
            x: indices,
            y: scores,
            type: "bar",
            marker: {
              color: scores.map(s =>
                topScores.includes(s) ? "#e74c3c" : "#b2bec3"
              ),
              line: { width: 0 }
            },
            hovertemplate: "Sous-séquence #%{x}<br>Score DTW : %{y:.2f}<extra></extra>"
          }
        ]}
        layout={{
          height: 250,
          margin: { t: 10, b: 45, l: 50, r: 20 },
          xaxis: {
            title: { text: "Sous-séquence (position)", font: { size: 11 } },
            showgrid: false
          },
          yaxis: {
            title: { text: "Score DTW", font: { size: 11 } },
            showgrid: true, gridcolor: "#f0f0f0"
          },
          plot_bgcolor: "#fafafa",
          paper_bgcolor: "#fff",
          showlegend: false,
          bargap: 0.1
        }}
        style={{ width: "100%" }}
        useResizeHandler
        config={{ scrollZoom: true, displayModeBar: true }}
      />
    </div>
  )
}
