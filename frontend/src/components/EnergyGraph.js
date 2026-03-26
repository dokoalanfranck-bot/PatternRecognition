import React, { useState, useRef, useEffect, useMemo, useCallback } from "react"
import Plot from "react-plotly.js"
import Plotly from "plotly.js/dist/plotly.min"
import { detectPattern } from "../api/api"

let abortController = null

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

export default function EnergyGraph({ data, setMatches: setParentMatches, setAllScores, allScores, setMonitoring, focusedMatch }) {
  const [allMatches, setAllMatches] = useState([])
  const [matches, setMatches] = useState([])
  const [selected, setSelected] = useState(null)
  const [activeFilter, setActiveFilter] = useState("all")
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

  // ── Appliquer le filtre sur allMatches ──
  const applyFilter = useCallback((all, filter) => {
    let filtered
    if (filter === "excellent") filtered = all.filter(m => m.similarity >= 80)
    else if (filter === "good") filtered = all.filter(m => m.similarity >= 50 && m.similarity < 80)
    else if (filter === "low") filtered = all.filter(m => m.similarity < 50)
    else filtered = all
    setMatches(filtered)
    if (setParentMatches) setParentMatches(filtered)
    setFocusIndex(-1)
  }, [setParentMatches])

  // Quand le filtre change, re-filtrer
  useEffect(() => {
    applyFilter(allMatches, activeFilter)
  }, [activeFilter, allMatches, applyFilter])

  const cancelSearch = useCallback(() => {
    if (abortController) abortController.abort()
    setSearching(false)
  }, [])

  const handleSelected = async (event) => {
    if (!event?.range) return
    const [start, end] = event.range.x
    setSelected({ start, end })
    setFocusIndex(-1)
    setError(null)
    setActiveFilter("all")
    setSearching(true)
    if (setMonitoring) setMonitoring(null)

    // Annuler toute recherche précédente
    if (abortController) abortController.abort()
    abortController = new AbortController()

    try {
      const result = await detectPattern(start, end, 9999)
      if (result.error) {
        setError(result.error)
        setAllMatches([])
        setMatches([])
        if (setParentMatches) setParentMatches([])
        if (setAllScores) setAllScores([])
        if (setMonitoring) setMonitoring(null)
        return
      }
      const enriched = enrichMatches(result.matches || [])
      setAllMatches(enriched)
      setMatches(enriched)
      if (setParentMatches) setParentMatches(enriched)
      if (setMonitoring) setMonitoring(result.monitoring || null)
      if (!enriched.length) setError("Aucun pattern similaire trouvé.")
    } catch {
      setError("Erreur lors de la détection. Essayez une sélection plus large.")
      setAllMatches([])
      setMatches([])
      if (setParentMatches) setParentMatches([])
    } finally {
      setSearching(false)
    }
  }

  const shapes = []

  const MAIN_Y0 = 0.12

  // Subsequence colored vertical lines in the paper strip [0, MAIN_Y0]
  if (allScores && allScores.length && data.length) {
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
  }

  matches.forEach((m, i) => {
    const color = getColor(m.similarity)
    const focused = i === focusIndex
    if (!m.start || !m.end) return
    shapes.push({
      type: "rect", x0: m.start, x1: m.end, y0: MAIN_Y0, y1: 1, yref: "paper",
      fillcolor: color, opacity: focused ? 0.35 : 0.15,
      line: { width: focused ? 3 : 1, color, dash: focused ? "solid" : "dot" }
    })
  })

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
        {searching && (
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#0984e3", animation: "pulse 1.2s infinite" }}>⏳ Recherche en cours...</span>
            <button onClick={cancelSearch} style={{ padding: "2px 8px", border: "1px solid #e74c3c", borderRadius: 4, background: "#fff", color: "#e74c3c", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Annuler</button>
          </span>
        )}
      </div>

      {/* Filter buttons by similarity interval */}
      {allMatches.length > 0 && (() => {
        const countExcellent = allMatches.filter(m => m.similarity >= 80).length
        const countGood = allMatches.filter(m => m.similarity >= 50 && m.similarity < 80).length
        const countLow = allMatches.filter(m => m.similarity < 50).length
        const filterBtn = (key, label, color, count) => {
          const active = activeFilter === key
          return (
            <button
              key={key}
              onClick={() => setActiveFilter(activeFilter === key ? "all" : key)}
              style={{
                padding: "4px 12px", borderRadius: 16, fontSize: 12, fontWeight: 600,
                border: `2px solid ${color}`, cursor: "pointer", transition: "all 0.2s",
                background: active ? color : "#fff",
                color: active ? "#fff" : color,
                opacity: count === 0 ? 0.4 : 1,
              }}
              disabled={count === 0}
            >
              {label} ({count})
            </button>
          )
        }
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 12 }}>
            <span style={{ color: "#555", fontWeight: 600 }}>Filtrer :</span>
            <button
              onClick={() => setActiveFilter("all")}
              style={{
                padding: "4px 12px", borderRadius: 16, fontSize: 12, fontWeight: 600,
                border: "2px solid #636e72", cursor: "pointer", transition: "all 0.2s",
                background: activeFilter === "all" ? "#636e72" : "#fff",
                color: activeFilter === "all" ? "#fff" : "#636e72",
              }}
            >
              Tous ({allMatches.length})
            </button>
            {filterBtn("excellent", "80–100%", "#2ecc71", countExcellent)}
            {filterBtn("good", "50–79%", "#3498db", countGood)}
            {filterBtn("low", "<50%", "#f39c12", countLow)}
          </div>
        )
      })()}

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
          { x, y, type: "scattergl", mode: "lines", name: "Consommation",
            line: { width: 1.2, color: "#0984e3" } }
        ]}
        layout={{
          dragmode: "select", shapes, uirevision: "stable",
          xaxis: { type: "date", showticklabels: true, tickfont: { size: 10 } },
          yaxis: { fixedrange: false, domain: [0.12, 1], showticklabels: true, tickfont: { size: 10 } },
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