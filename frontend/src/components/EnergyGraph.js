import React, { useState, useRef, useEffect, useMemo, useCallback } from "react"
import Plot from "react-plotly.js"
import Plotly from "plotly.js/dist/plotly.min"
import { detectPattern, computeAllScores } from "../api/api"

const COLORS = { high: "#2ecc71", mid: "#3498db", low: "#f39c12", selection: "#e74c3c" }

function getColor(sim) {
  if (sim >= 80) return COLORS.high
  if (sim >= 50) return COLORS.mid
  return COLORS.low
}

function enrichMatches(rawMatches) {
  if (!rawMatches || !rawMatches.length) return []
  const scores = rawMatches.map(m => m.score)
  const minS = Math.min(...scores)
  const maxS = Math.max(...scores)
  const range = maxS - minS || 1
  return rawMatches.map(m => ({
    ...m,
    similarity: 95 - ((m.score - minS) / range) * 55
  }))
}

export default function EnergyGraph({ data, setMatches: setParentMatches, setAllScores, focusedMatch }) {
  const [matches, setMatches] = useState([])
  const [allScores, setLocalAllScores] = useState([])
  const [selected, setSelected] = useState(null)
  const [topK, setTopK] = useState(10)
  const [focusIndex, setFocusIndex] = useState(-1)
  const [error, setError] = useState(null)
  const [searching, setSearching] = useState(false)
  const plotRef = useRef(null)

  // Le serveur envoie déjà des données downsampliées — on utilise directement
  const x = useMemo(() => data.map(d => d.date), [data])
  const y = useMemo(() => data.map(d => d.value), [data])

  const computeYRange = useCallback((x0, x1) => {
    if (!data.length) return null
    const t0 = new Date(x0).getTime(), t1 = new Date(x1).getTime()
    const vals = data.filter(d => { const t = new Date(d.date).getTime(); return t >= t0 && t <= t1 }).map(d => d.value)
    if (!vals.length) return null
    const lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.15 || 1
    return [lo - pad, hi + pad]
  }, [data])

  const navigateToMatch = useCallback((match) => {
    const s = new Date(match.start), e = new Date(match.end)
    const margin = (e - s) * 0.5
    const x0 = new Date(s.getTime() - margin).toISOString()
    const x1 = new Date(e.getTime() + margin).toISOString()
    const yr = computeYRange(x0, x1)
    const el = plotRef.current?.el
    if (el) {
      const update = { "xaxis.range[0]": x0, "xaxis.range[1]": x1 }
      if (yr) { update["yaxis.range[0]"] = yr[0]; update["yaxis.range[1]"] = yr[1] }
      Plotly.relayout(el, update)
    }
    setFocusIndex(matches.findIndex(m => m.start === match.start && m.end === match.end))
  }, [matches, computeYRange])

  useEffect(() => {
    if (focusedMatch) navigateToMatch(focusedMatch)
  }, [focusedMatch, navigateToMatch])

  const navigate = (dir) => {
    if (!matches.length) return
    const idx = dir === "prev"
      ? (focusIndex <= 0 ? matches.length - 1 : focusIndex - 1)
      : (focusIndex >= matches.length - 1 ? 0 : focusIndex + 1)
    navigateToMatch(matches[idx])
  }

  const resetZoom = () => {
    const el = plotRef.current?.el
    if (el) Plotly.relayout(el, { "xaxis.autorange": true, "yaxis.autorange": true })
    setFocusIndex(-1)
  }

  const handleSelected = async (event) => {
    if (!event?.range) return
    const [start, end] = event.range.x
    setSelected({ start, end })
    setFocusIndex(-1)
    setError(null)
    setLocalAllScores([])
    setSearching(true)

    try {
      const result = await detectPattern(start, end, topK)
      // Le backend peut renvoyer un champ error (ex: sélection trop courte)
      if (result.error) {
        setError(result.error)
        setMatches([])
        if (setParentMatches) setParentMatches([])
        if (setAllScores) setAllScores([])
        return
      }
      const enriched = enrichMatches(result.matches || [])
      setMatches(enriched)
      if (setParentMatches) setParentMatches(enriched)
      if (!enriched.length) setError("Aucun pattern similaire trouvé.")

      // Calcul des scores bruts pour toutes les sous-séquences (1000 premières)
      computeAllScores(start, end, 1000)
        .then(r => {
          const scores = r.scores || []
          setLocalAllScores(scores)
          if (setAllScores) setAllScores(scores)
        })
        .catch(() => {})
    } catch {
      setError("Erreur lors de la détection. Essayez une sélection plus large.")
      setMatches([])
      if (setParentMatches) setParentMatches([])
    } finally {
      setSearching(false)
    }
  }

  const shapes = []
  const annotations = []

  const MAIN_Y0 = 0.12

  // Subsequence colored vertical lines in the paper strip [0, MAIN_Y0]
  if (allScores.length && data.length) {
    const scoreVals = allScores.map(s => s.score)
    const minS = Math.min(...scoreVals), maxS = Math.max(...scoreVals), rng = maxS - minS || 1
    allScores.forEach(s => {
      const d = data[s.index]
      if (!d) return
      const norm = (s.score - minS) / rng
      const color = norm < 0.33 ? "#2ecc71" : norm < 0.66 ? "#f39c12" : "#e74c3c"
      shapes.push({
        type: "line",
        x0: d.date, x1: d.date,
        y0: 0.005, y1: MAIN_Y0 - 0.01,
        xref: "x", yref: "paper",
        line: { color, width: 1.5 }
      })
    })
    // Separator between strip and main chart
    shapes.push({
      type: "line", x0: 0, x1: 1, y0: MAIN_Y0, y1: MAIN_Y0,
      xref: "paper", yref: "paper",
      line: { color: "#ccc", width: 1 }
    })
  }

  if (selected) {
    shapes.push({
      type: "rect", x0: selected.start, x1: selected.end, y0: MAIN_Y0, y1: 1, yref: "paper",
      fillcolor: "rgba(231,76,60,0.25)", line: { width: 2, color: COLORS.selection }
    })
    annotations.push({
      x: selected.start, y: 1.05, yref: "paper",
      text: "<b>Sélection</b>", showarrow: false, font: { size: 11, color: COLORS.selection }
    })
  }

  matches.forEach((m, i) => {
    const color = getColor(m.similarity)
    const focused = i === focusIndex
    shapes.push({
      type: "rect", x0: m.start, x1: m.end, y0: MAIN_Y0, y1: 1, yref: "paper",
      fillcolor: color, opacity: focused ? 0.35 : 0.15,
      line: { width: focused ? 3 : 1, color, dash: focused ? "solid" : "dot" }
    })
    annotations.push({
      x: m.start, y: 1 - i * 0.055, yref: "paper",
      text: `<b>#${i + 1}</b> ${m.similarity.toFixed(0)}%`,
      showarrow: false, font: { size: focused ? 13 : 10, color },
      bgcolor: "rgba(255,255,255,0.85)", borderpad: 2
    })
  })

  const xaxis = { rangeslider: { visible: true }, type: "date" }
  const yaxis = { fixedrange: false, domain: [MAIN_Y0, 1] }

  const btn = { padding: "5px 12px", border: "1px solid #ddd", borderRadius: 4, background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }

  return (
    <div>
      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6, fontSize: 12, color: "#666" }}>
        <span><span style={{ color: COLORS.high }}>■</span> ≥80%</span>
        <span><span style={{ color: COLORS.mid }}>■</span> 50-79%</span>
        <span><span style={{ color: COLORS.low }}>■</span> &lt;50%</span>
        <span><span style={{ color: COLORS.selection }}>■</span> Sélection</span>
        <span style={{ borderLeft: "1px solid #ddd", paddingLeft: 14 }}>
          <span style={{ color: "#2ecc71" }}>▲</span>–<span style={{ color: "#e74c3c" }}>▲</span> Sous-séquences (DTW)
        </span>
        {searching && <span style={{ marginLeft: "auto", color: "#0984e3" }}>Recherche en cours...</span>}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 12 }}>
        <label style={{ color: "#555" }}>Nombre de résultats :</label>
        <input
          type="number"
          min={1}
          max={100}
          value={topK}
          onChange={e => setTopK(e.target.value === "" ? "" : Number(e.target.value))}
          onBlur={e => {
            const v = Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 10))
            setTopK(v)
          }}
          style={{ width: 70, padding: "3px 6px", border: "1px solid #ddd", borderRadius: 4, fontSize: 12 }}
        />
        <span style={{ color: "#aaa" }}>(1–100)</span>
      </div>

      {error && (
        <div style={{ padding: "6px 12px", marginBottom: 6, background: "#ffeaa7", borderRadius: 5, color: "#856404", fontSize: 12 }}>
          {error}
        </div>
      )}

      {matches.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <button style={btn} onClick={() => navigate("prev")}>◀</button>
          <span style={{ fontSize: 12 }}>
            {focusIndex >= 0
              ? `#${focusIndex + 1} / ${matches.length} — ${matches[focusIndex].similarity.toFixed(0)}%`
              : `${matches.length} patterns trouvés`}
          </span>
          <button style={btn} onClick={() => navigate("next")}>▶</button>
          <button style={{ ...btn, color: COLORS.selection, borderColor: COLORS.selection }} onClick={resetZoom}>Réinitialiser</button>
        </div>
      )}

      <Plot
        ref={plotRef}
        data={[
          { x, y, type: "scattergl", mode: "lines+markers", name: "Consommation",
            line: { width: 1, color: "#0984e3" },
            marker: { size: 4, color: "#0984e3", opacity: 0.6 } }
        ]}
        layout={{
          dragmode: "select", shapes, annotations, uirevision: "stable",
          xaxis, yaxis,
          margin: { t: 20, b: 30, l: 50, r: 20 },
          plot_bgcolor: "#fafafa",
          paper_bgcolor: "#fff"
        }}
        onSelected={handleSelected}
        style={{ width: "100%", height: "520px" }}
        useResizeHandler
        config={{ scrollZoom: true, displayModeBar: true, modeBarButtonsToAdd: ["zoomIn2d", "zoomOut2d", "autoScale2d"] }}
      />
    </div>
  )
}