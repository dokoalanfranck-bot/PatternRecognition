import React, { useState, useRef, useEffect, useMemo, useCallback } from "react"
import Plot from "react-plotly.js"
import Plotly from "plotly.js/dist/plotly.min"
import { detectPattern } from "../api/api"
import FilterPanel from "./FilterPanel"

let abortController = null

const BATCH_SIZE = 120
const BATCH_MS = 100
const COLORS = { high: "#2ecc71", mid: "#3498db", low: "#f39c12", sel: "#e74c3c" }
const Y0 = 0.12
const BTN = {
  padding: "5px 12px", border: "1px solid #ddd", borderRadius: 4,
  background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600
}
const PLOT_CFG = {
  scrollZoom: true, displayModeBar: true,
  modeBarButtonsToAdd: ["zoomIn2d", "zoomOut2d", "autoScale2d"]
}

function getColor(sim) {
  if (sim >= 80) return COLORS.high
  if (sim >= 50) return COLORS.mid
  return COLORS.low
}

function enrichMatches(raw) {
  if (!raw?.length) return []
  const scores = raw.map(m => m.score)
  const min = Math.min(...scores), max = Math.max(...scores), rng = max - min || 1
  return raw.map(m => ({
    ...m,
    similarity: Math.round((95 - ((m.score - min) / rng) * 55) * 10) / 10
  }))
}

export default function EnergyGraph({
  data, setMatches: setParentMatches,
  setMonitoring, focusedMatch
}) {
  const [allMatches, setAllMatches] = useState([])
  const [filtered, setFiltered] = useState([])
  const [visibleMatches, setVisibleMatches] = useState([])
  const [selected, setSelected] = useState(null)
  const [focusIndex, setFocusIndex] = useState(-1)
  const [error, setError] = useState(null)
  const [searching, setSearching] = useState(false)
  const [batchProgress, setBatchProgress] = useState(null)

  const plotRef = useRef(null)
  const batchTimer = useRef(null)

  useEffect(() => () => { if (batchTimer.current) clearTimeout(batchTimer.current) }, [])

  const x = useMemo(() => data.map(d => d.date), [data])
  const y = useMemo(() => data.map(d => d.value), [data])
  const plotData = useMemo(() => ([
    { x, y, type: "scattergl", mode: "lines", name: "Consommation", line: { width: 1.2, color: "#0984e3" } }
  ]), [x, y])

  // ---- Shapes ----
  const shapes = useMemo(() => {
    const s = []
    if (selected) {
      s.push({
        type: "rect", x0: selected.start, x1: selected.end,
        y0: Y0, y1: 1, yref: "paper",
        fillcolor: "rgba(231,76,60,0.25)", line: { width: 2, color: COLORS.sel }
      })
    }
    visibleMatches.forEach((m, i) => {
      if (!m.start || !m.end) return
      const c = getColor(m.similarity)
      const focused = i === focusIndex
      s.push({
        type: "rect", x0: m.start, x1: m.end, y0: Y0, y1: 1, yref: "paper",
        fillcolor: c, opacity: focused ? 0.35 : 0.15,
        line: { width: focused ? 3 : 1, color: c, dash: focused ? "solid" : "dot" }
      })
    })
    return s
  }, [visibleMatches, selected, focusIndex])

  const layout = useMemo(() => ({
    dragmode: "select", shapes, uirevision: "stable",
    xaxis: { type: "date", showticklabels: true, tickfont: { size: 10 } },
    yaxis: { fixedrange: false, domain: [Y0, 1], showticklabels: true, tickfont: { size: 10 } },
    margin: { t: 20, b: 30, l: 50, r: 20 },
    plot_bgcolor: "#fafafa", paper_bgcolor: "#fff"
  }), [shapes])

  // ---- Batch progressive render ----
  const startBatch = useCallback((list) => {
    if (batchTimer.current) clearTimeout(batchTimer.current)
    const first = list.slice(0, BATCH_SIZE)
    setVisibleMatches(first)
    setBatchProgress(list.length > BATCH_SIZE ? { done: first.length, total: list.length } : null)

    const addMore = (offset) => {
      if (offset >= list.length) { setBatchProgress(null); return }
      batchTimer.current = setTimeout(() => {
        const next = list.slice(0, offset + BATCH_SIZE)
        setVisibleMatches(next)
        setBatchProgress({ done: next.length, total: list.length })
        addMore(offset + BATCH_SIZE)
      }, BATCH_MS)
    }
    if (first.length < list.length) addMore(BATCH_SIZE)
  }, [])

  // ---- FilterPanel drives display ----
  const handleFilterChange = useCallback((list) => {
    setFiltered(list)
    if (setParentMatches) setParentMatches(list)
    setFocusIndex(-1)
    startBatch(list)
  }, [setParentMatches, startBatch])

  // ---- Search ----
  const handleSelected = useCallback(async (event) => {
    if (!event?.range) return
    const [start, end] = event.range.x

    if (batchTimer.current) clearTimeout(batchTimer.current)
    if (abortController) abortController.abort()
    abortController = new AbortController()

    setSelected({ start, end })
    setFocusIndex(-1)
    setError(null)
    setSearching(true)
    setAllMatches([])
    setFiltered([])
    setVisibleMatches([])
    setBatchProgress(null)
    if (setParentMatches) setParentMatches([])
    if (setMonitoring) setMonitoring(null)

    try {
      const result = await detectPattern(start, end, 0)
      if (result.error) { setError(result.error); return }

      const enriched = enrichMatches(result.matches || [])
      if (!enriched.length) { setError("Aucun pattern similaire trouve."); return }

      setAllMatches(enriched)
      if (setMonitoring) setMonitoring(result.monitoring || null)
      // FilterPanel useEffect will call handleFilterChange with defaults
    } catch {
      setError("Erreur lors de la recherche.")
      setAllMatches([])
    } finally {
      setSearching(false)
    }
  }, [setParentMatches, setMonitoring])

  // ---- Navigation ----
  const computeYRange = useCallback((x0, x1) => {
    if (!data.length) return null
    const t0 = new Date(x0).getTime(), t1 = new Date(x1).getTime()
    const vals = data
      .filter(d => { const t = new Date(d.date).getTime(); return t >= t0 && t <= t1 })
      .map(d => d.value)
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
      const upd = { "xaxis.range[0]": x0, "xaxis.range[1]": x1 }
      if (yr) { upd["yaxis.range[0]"] = yr[0]; upd["yaxis.range[1]"] = yr[1] }
      Plotly.relayout(el, upd)
    }
    setFocusIndex(filtered.findIndex(m => m.start === match.start && m.end === match.end))
  }, [filtered, computeYRange])

  useEffect(() => { if (focusedMatch) navigateToMatch(focusedMatch) }, [focusedMatch, navigateToMatch])

  const navigate = useCallback((dir) => {
    if (!filtered.length) return
    const idx = dir === "prev"
      ? (focusIndex <= 0 ? filtered.length - 1 : focusIndex - 1)
      : (focusIndex >= filtered.length - 1 ? 0 : focusIndex + 1)
    navigateToMatch(filtered[idx])
  }, [filtered, focusIndex, navigateToMatch])

  const resetZoom = useCallback(() => {
    const el = plotRef.current?.el
    if (el) Plotly.relayout(el, { "xaxis.autorange": true, "yaxis.autorange": true })
    setFocusIndex(-1)
  }, [])

  const cancelSearch = useCallback(() => {
    if (abortController) abortController.abort()
    if (batchTimer.current) clearTimeout(batchTimer.current)
    setSearching(false)
    setBatchProgress(null)
  }, [])

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6, fontSize: 12, color: "#666" }}>
        <span><span style={{ color: COLORS.high }}>&#9632;</span> &ge;80%</span>
        <span><span style={{ color: COLORS.mid }}>&#9632;</span> 50-79%</span>
        <span><span style={{ color: COLORS.low }}>&#9632;</span> &lt;50%</span>
        <span><span style={{ color: COLORS.sel }}>&#9632;</span> Selection</span>

        {(searching || batchProgress) && (
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            {searching && <span style={{ color: "#0984e3" }}>Recherche en cours...</span>}
            {!searching && batchProgress && (
              <span style={{ color: "#6c5ce7", fontSize: 11 }}>
                Affichage {batchProgress.done} / {batchProgress.total}
              </span>
            )}
            <button onClick={cancelSearch}
              style={{ padding: "2px 8px", border: "1px solid #e74c3c", borderRadius: 4, background: "#fff", color: "#e74c3c", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
              Annuler
            </button>
          </span>
        )}
      </div>

      {error && (
        <div style={{ padding: "6px 12px", marginBottom: 6, background: "#ffeaa7", borderRadius: 5, color: "#856404", fontSize: 12 }}>
          {error}
        </div>
      )}

      {filtered.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <button style={BTN} onClick={() => navigate("prev")}>&#9664;</button>
          <span style={{ fontSize: 12 }}>
            {focusIndex >= 0
              ? `#${focusIndex + 1} / ${filtered.length} - ${filtered[focusIndex]?.similarity?.toFixed(0)}%`
              : `${visibleMatches.length} rectangles affiches`}
          </span>
          <button style={BTN} onClick={() => navigate("next")}>&#9654;</button>
          <button style={{ ...BTN, color: COLORS.sel, borderColor: COLORS.sel }} onClick={resetZoom}>
            Reinitialiser
          </button>
        </div>
      )}

      <Plot
        ref={plotRef}
        data={plotData}
        layout={layout}
        onSelected={handleSelected}
        style={{ width: "100%", height: "520px" }}
        useResizeHandler
        config={PLOT_CFG}
      />

      <FilterPanel allMatches={allMatches} onFilterChange={handleFilterChange} />
    </div>
  )
}
