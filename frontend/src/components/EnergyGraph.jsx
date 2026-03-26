import React, { useState, useRef, useEffect, useMemo, useCallback } from "react"
import Plot from "react-plotly.js"
import Plotly from "plotly.js/dist/plotly.min"
import { detectPattern } from "../api/api"
import FilterPanel from "./FilterPanel"

let abortController = null

// ─── Paramètres du chargement progressif ─────────────────────────────────────
const GRAPH_BATCH_SIZE = 100   // shapes ajoutées par batch
const BATCH_INTERVAL_MS = 150  // délai entre batches (ms)
const FIRST_FETCH = 50         // matches affichés immédiatement
const TOTAL_FETCH = 999999     // on demande tout au backend

const COLORS = { high: "#2ecc71", mid: "#3498db", low: "#f39c12", selection: "#e74c3c" }
const MAIN_Y0 = 0.12

const BTN_STYLE = {
  padding: "5px 12px", border: "1px solid #ddd", borderRadius: 4,
  background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600
}
const PLOT_CONFIG = {
  scrollZoom: true, displayModeBar: true,
  modeBarButtonsToAdd: ["zoomIn2d", "zoomOut2d", "autoScale2d"]
}

function getColor(sim) {
  if (sim >= 80) return COLORS.high
  if (sim >= 50) return COLORS.mid
  return COLORS.low
}

function enrichMatches(rawMatches, globalMin, globalMax) {
  if (!rawMatches || !rawMatches.length) return []
  const scores = rawMatches.map(m => m.score)
  const minS = globalMin ?? Math.min(...scores)
  const maxS = globalMax ?? Math.max(...scores)
  const range = maxS - minS || 1
  return rawMatches.map(m => ({
    ...m,
    similarity: 95 - ((m.score - minS) / range) * 55
  }))
}

export default function EnergyGraph({
  data, setMatches: setParentMatches,
  setAllScores, allScores,
  setMonitoring, focusedMatch
}) {
  const [allMatches, setAllMatches] = useState([])         // tous les matches reçus
  const [displayedMatches, setDisplayedMatches] = useState([]) // matches à afficher (contrôlés par FilterPanel)
  const [visibleMatches, setVisibleMatches] = useState([]) // batch progressif sur le graphique
  const [matches, setMatches] = useState([])               // matches filtrés → SimilarPatterns
  const [selected, setSelected] = useState(null)
  const [focusIndex, setFocusIndex] = useState(-1)
  const [error, setError] = useState(null)
  const [searching, setSearching] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadProgress, setLoadProgress] = useState({ loaded: 0, total: 0 })
  const plotRef = useRef(null)
  const batchTimerRef = useRef(null)

  useEffect(() => () => { if (batchTimerRef.current) clearTimeout(batchTimerRef.current) }, [])

  const x = useMemo(() => data.map(d => d.date), [data])
  const y = useMemo(() => data.map(d => d.value), [data])

  const plotData = useMemo(() => ([
    { x, y, type: "scattergl", mode: "lines", name: "Consommation", line: { width: 1.2, color: "#0984e3" } }
  ]), [x, y])

  // ─── Shapes sur visibleMatches (batch progressif de displayedMatches) ─────
  const shapes = useMemo(() => {
    const result = []

    if (allScores?.length && data.length) {
      const scoreVals = allScores.map(s => s.score)
      const minS = Math.min(...scoreVals), maxS = Math.max(...scoreVals), rng = maxS - minS || 1
      allScores.forEach(s => {
        const d = data[s.index]
        if (!d) return
        const norm = (s.score - minS) / rng
        const color = norm < 0.33 ? "#2ecc71" : norm < 0.66 ? "#f39c12" : "#e74c3c"
        result.push({
          type: "line", x0: d.date, x1: d.date, y0: 0.005, y1: MAIN_Y0 - 0.01,
          xref: "x", yref: "paper", line: { color, width: 1.5 }
        })
      })
      result.push({
        type: "line", x0: 0, x1: 1, y0: MAIN_Y0, y1: MAIN_Y0,
        xref: "paper", yref: "paper", line: { color: "#ccc", width: 1 }
      })
    }

    if (selected) {
      result.push({
        type: "rect", x0: selected.start, x1: selected.end,
        y0: MAIN_Y0, y1: 1, yref: "paper",
        fillcolor: "rgba(231,76,60,0.25)", line: { width: 2, color: COLORS.selection }
      })
    }

    // ✅ On dessine seulement les matches du batch visible
    visibleMatches.forEach((m, i) => {
      const color = getColor(m.similarity)
      const focused = i === focusIndex
      if (!m.start || !m.end) return
      result.push({
        type: "rect", x0: m.start, x1: m.end, y0: MAIN_Y0, y1: 1, yref: "paper",
        fillcolor: color, opacity: focused ? 0.35 : 0.15,
        line: { width: focused ? 3 : 1, color, dash: focused ? "solid" : "dot" }
      })
    })

    return result
  }, [allScores, visibleMatches, selected, focusIndex, data])

  const layout = useMemo(() => ({
    dragmode: "select", shapes, uirevision: "stable",
    xaxis: { type: "date", showticklabels: true, tickfont: { size: 10 } },
    yaxis: { fixedrange: false, domain: [MAIN_Y0, 1], showticklabels: true, tickfont: { size: 10 } },
    margin: { t: 20, b: 30, l: 50, r: 20 },
    plot_bgcolor: "#fafafa", paper_bgcolor: "#fff"
  }), [shapes])

  // ─── Chargement progressif des shapes ────────────────────────────────────
  const scheduleBatch = useCallback((pending, total) => {
    if (batchTimerRef.current) clearTimeout(batchTimerRef.current)
    if (!pending.length) { setLoadingMore(false); return }

    batchTimerRef.current = setTimeout(() => {
      const nextBatch = pending.slice(0, GRAPH_BATCH_SIZE)
      const remaining = pending.slice(GRAPH_BATCH_SIZE)
      setVisibleMatches(prev => {
        const updated = [...prev, ...nextBatch]
        setLoadProgress({ loaded: updated.length, total })
        return updated
      })
      scheduleBatch(remaining, total)
    }, BATCH_INTERVAL_MS)
  }, [])

  // ─── Quand FilterPanel change la sélection → recharger les shapes ─────────
  // C'est le point central : l'user contrôle ce qui s'affiche
  const handleFilterChange = useCallback((filtered) => {
    setDisplayedMatches(filtered)
    setMatches(filtered)
    if (setParentMatches) setParentMatches(filtered)
    setFocusIndex(-1)

    // Relancer le batch progressif sur la nouvelle sélection
    if (batchTimerRef.current) clearTimeout(batchTimerRef.current)
    const firstBatch = filtered.slice(0, GRAPH_BATCH_SIZE)
    const remaining = filtered.slice(GRAPH_BATCH_SIZE)
    setVisibleMatches(firstBatch)
    setLoadProgress({ loaded: firstBatch.length, total: filtered.length })
    if (remaining.length > 0) {
      setLoadingMore(true)
      scheduleBatch(remaining, filtered.length)
    } else {
      setLoadingMore(false)
    }
  }, [setParentMatches, scheduleBatch])

  // ─── Recherche principale ─────────────────────────────────────────────────
  const handleSelected = useCallback(async (event) => {
    if (!event?.range) return
    const [start, end] = event.range.x

    if (batchTimerRef.current) clearTimeout(batchTimerRef.current)
    if (abortController) abortController.abort()
    abortController = new AbortController()

    setSelected({ start, end })
    setFocusIndex(-1)
    setError(null)
    setSearching(true)
    setLoadingMore(false)
    setAllMatches([])
    setDisplayedMatches([])
    setVisibleMatches([])
    setMatches([])
    setLoadProgress({ loaded: 0, total: 0 })
    if (setMonitoring) setMonitoring(null)

    try {
      // ── Étape 1 : 50 meilleurs → affichage immédiat ───────────────────────
      const firstResult = await detectPattern(start, end, FIRST_FETCH)

      if (firstResult.error) {
        setError(firstResult.error)
        if (setAllScores) setAllScores([])
        if (setMonitoring) setMonitoring(null)
        return
      }

      const firstEnriched = enrichMatches(firstResult.matches || [])
      setAllMatches(firstEnriched)
      setDisplayedMatches(firstEnriched)
      setMatches(firstEnriched)
      if (setParentMatches) setParentMatches(firstEnriched)
      if (setMonitoring) setMonitoring(firstResult.monitoring || null)
      if (!firstEnriched.length) { setError("Aucun pattern similaire trouvé."); return }

      const firstBatch = firstEnriched.slice(0, GRAPH_BATCH_SIZE)
      setVisibleMatches(firstBatch)
      setLoadProgress({ loaded: firstBatch.length, total: FIRST_FETCH })
      setSearching(false)
      setLoadingMore(true)
      scheduleBatch(firstEnriched.slice(GRAPH_BATCH_SIZE), FIRST_FETCH)

      // ── Étape 2 : tous les matches en arrière-plan ────────────────────────
      setTimeout(async () => {
        try {
          const fullResult = await detectPattern(start, end, TOTAL_FETCH)
          if (!fullResult.error && fullResult.matches?.length > 0) {
            const allScoresArr = fullResult.matches.map(m => m.score)
            const globalMin = Math.min(...allScoresArr)
            const globalMax = Math.max(...allScoresArr)
            const fullEnriched = enrichMatches(fullResult.matches, globalMin, globalMax)

            // Mettre à jour allMatches — FilterPanel réagit et recalcule
            setAllMatches(fullEnriched)

            // Par défaut, afficher tout (FilterPanel démarrera à 0% min, tout)
            setDisplayedMatches(fullEnriched)
            setMatches(fullEnriched)
            if (setParentMatches) setParentMatches(fullEnriched)

            // Reprendre le batch depuis ce qui est déjà affiché
            if (batchTimerRef.current) clearTimeout(batchTimerRef.current)
            setVisibleMatches(prev => {
              scheduleBatch(fullEnriched.slice(prev.length), fullEnriched.length)
              return prev
            })
          } else {
            setLoadingMore(false)
          }
        } catch {
          setLoadingMore(false)
        }
      }, 400)

    } catch {
      setError("Erreur lors de la détection. Essayez une sélection plus large.")
      setAllMatches([])
      setDisplayedMatches([])
      setVisibleMatches([])
      setMatches([])
      if (setParentMatches) setParentMatches([])
    } finally {
      setSearching(false)
    }
  }, [setParentMatches, setAllScores, setMonitoring, scheduleBatch])

  const cancelSearch = useCallback(() => {
    if (abortController) abortController.abort()
    if (batchTimerRef.current) clearTimeout(batchTimerRef.current)
    setSearching(false)
    setLoadingMore(false)
  }, [])

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
      const update = { "xaxis.range[0]": x0, "xaxis.range[1]": x1 }
      if (yr) { update["yaxis.range[0]"] = yr[0]; update["yaxis.range[1]"] = yr[1] }
      Plotly.relayout(el, update)
    }
    setFocusIndex(matches.findIndex(m => m.start === match.start && m.end === match.end))
  }, [matches, computeYRange])

  useEffect(() => { if (focusedMatch) navigateToMatch(focusedMatch) }, [focusedMatch, navigateToMatch])

  const navigate = useCallback((dir) => {
    if (!matches.length) return
    const idx = dir === "prev"
      ? (focusIndex <= 0 ? matches.length - 1 : focusIndex - 1)
      : (focusIndex >= matches.length - 1 ? 0 : focusIndex + 1)
    navigateToMatch(matches[idx])
  }, [matches, focusIndex, navigateToMatch])

  const resetZoom = useCallback(() => {
    const el = plotRef.current?.el
    if (el) Plotly.relayout(el, { "xaxis.autorange": true, "yaxis.autorange": true })
    setFocusIndex(-1)
  }, [])

  return (
    <div>
      {/* ── Légende + indicateur de chargement ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6, fontSize: 12, color: "#666" }}>
        <span><span style={{ color: COLORS.high }}>■</span> ≥80%</span>
        <span><span style={{ color: COLORS.mid }}>■</span> 50-79%</span>
        <span><span style={{ color: COLORS.low }}>■</span> &lt;50%</span>
        <span><span style={{ color: COLORS.selection }}>■</span> Sélection</span>

        {(searching || loadingMore) && (
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            {searching && <span style={{ color: "#0984e3" }}>⏳ Recherche en cours...</span>}
            {!searching && loadingMore && (
              <span style={{ color: "#6c5ce7", fontSize: 11 }}>
                ⬇ Affichage {loadProgress.loaded} / {loadProgress.total} rectangles...
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

      {matches.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <button style={BTN_STYLE} onClick={() => navigate("prev")}>◀</button>
          <span style={{ fontSize: 12 }}>
            {focusIndex >= 0
              ? `#${focusIndex + 1} / ${matches.length} — ${matches[focusIndex].similarity.toFixed(0)}%`
              : `${visibleMatches.length} / ${displayedMatches.length} rectangles affichés`}
          </span>
          <button style={BTN_STYLE} onClick={() => navigate("next")}>▶</button>
          <button style={{ ...BTN_STYLE, color: COLORS.selection, borderColor: COLORS.selection }} onClick={resetZoom}>
            Réinitialiser
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
        config={PLOT_CONFIG}
      />

      {/* ✅ Panneau flottant — apparaît uniquement après une recherche */}
      <FilterPanel
        allMatches={allMatches}
        onFilterChange={handleFilterChange}
      />
    </div>
  )
}
