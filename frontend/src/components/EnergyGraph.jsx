import React, { useState, useRef, useEffect, useMemo, useCallback } from "react"
import Plot from "react-plotly.js"
import Plotly from "plotly.js/dist/plotly.min"
import { detectPattern } from "../api/api"
import { Search, ChevronLeft, ChevronRight, RotateCcw, X, AlertTriangle, Loader, Sparkles } from "lucide-react"
import FilterPanel from "./FilterPanel"

let abortController = null

const BATCH_SIZE = 120
const BATCH_MS = 100
const COLORS = { high: "#34d399", mid: "#60a5fa", low: "#fbbf24", sel: "#fb7185" }
const Y0 = 0.12
const PLOT_CFG = {
  scrollZoom: true, displayModeBar: true,
  modeBarButtonsToAdd: ["zoomIn2d", "zoomOut2d", "autoScale2d", "lasso2d"]
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
  setAllMatchesRaw,
  setMonitoring, focusedMatch, dataset
}) {
  const [allMatches, setAllMatches] = useState([])
  const [filtered, setFiltered] = useState([])
  const [visibleMatches, setVisibleMatches] = useState([])
  const [selected, setSelected] = useState(null)
  const [pendingSelection, setPendingSelection] = useState(null)
  const [focusIndex, setFocusIndex] = useState(-1)
  const [error, setError] = useState(null)
  const [searching, setSearching] = useState(false)
  const [batchProgress, setBatchProgress] = useState(null)

  const plotRef = useRef(null)
  const batchTimer = useRef(null)

  useEffect(() => () => { if (batchTimer.current) clearTimeout(batchTimer.current) }, [])

  const x = useMemo(() => data.map(d => d.date), [data])
  const y = useMemo(() => data.map(d => d.value), [data])
  const plotData = useMemo(() => ([{
    x, y, type: "scattergl", mode: "lines", name: "Consommation",
    line: { width: 1.5, color: "#818cf8" },
    fill: "tozeroy",
    fillcolor: "rgba(129,140,248,0.06)",
  }]), [x, y])

  // ── Shapes ──
  const shapes = useMemo(() => {
    const s = []
    if (selected) {
      s.push({
        type: "rect", x0: selected.start, x1: selected.end,
        y0: Y0, y1: 1, yref: "paper",
        fillcolor: "rgba(251,113,133,0.2)", line: { width: 2, color: COLORS.sel }
      })
    }
    visibleMatches.forEach((m, i) => {
      if (!m.start || !m.end) return
      const c = getColor(m.similarity)
      const focused = i === focusIndex
      s.push({
        type: "rect", x0: m.start, x1: m.end, y0: Y0, y1: 1, yref: "paper",
        fillcolor: c, opacity: focused ? 0.35 : 0.12,
        line: { width: focused ? 3 : 1, color: c, dash: focused ? "solid" : "dot" }
      })
    })
    return s
  }, [visibleMatches, selected, focusIndex])

  const layout = useMemo(() => ({
    dragmode: "select", shapes, uirevision: "stable",
    xaxis: {
      type: "date", showticklabels: true,
      tickfont: { size: 10, color: "#64748b" },
      gridcolor: "rgba(148,163,184,0.06)",
      linecolor: "rgba(148,163,184,0.1)",
      zerolinecolor: "rgba(148,163,184,0.06)",
    },
    yaxis: {
      fixedrange: false, domain: [Y0, 1],
      showticklabels: true,
      tickfont: { size: 10, color: "#64748b" },
      gridcolor: "rgba(148,163,184,0.06)",
      linecolor: "rgba(148,163,184,0.1)",
      zerolinecolor: "rgba(148,163,184,0.06)",
    },
    margin: { t: 16, b: 32, l: 55, r: 16 },
    plot_bgcolor: "transparent",
    paper_bgcolor: "transparent",
    font: { family: "Inter, sans-serif", color: "#94a3b8" },
  }), [shapes])

  // ── Batch progressive render ──
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

  const handleFilterChange = useCallback((list) => {
    setFiltered(list)
    if (setParentMatches) setParentMatches(list)
    setFocusIndex(-1)
    startBatch(list)
  }, [setParentMatches, startBatch])

  // ── Search ──
  const launchSearch = useCallback(async (start, end) => {
    if (batchTimer.current) clearTimeout(batchTimer.current)
    if (abortController) abortController.abort()
    abortController = new AbortController()

    setSelected({ start, end })
    setPendingSelection(null)
    setFocusIndex(-1)
    setError(null)
    setSearching(true)
    setAllMatches([])
    setFiltered([])
    setVisibleMatches([])
    setBatchProgress(null)
    if (setParentMatches) setParentMatches([])
    if (setAllMatchesRaw) setAllMatchesRaw([])
    if (setMonitoring) setMonitoring(null)

    try {
      const result = await detectPattern(start, end, 0, dataset)
      if (result.error) { setError(result.error); return }
      const enriched = enrichMatches(result.matches || [])
      if (!enriched.length) { setError("Aucun pattern similaire trouvé."); return }
      setAllMatches(enriched)
      if (setAllMatchesRaw) setAllMatchesRaw(enriched)
      if (setMonitoring) setMonitoring(result.monitoring || null)
    } catch {
      setError("Erreur lors de la recherche.")
      setAllMatches([])
    } finally {
      setSearching(false)
    }
  }, [setParentMatches, setAllMatchesRaw, setMonitoring, dataset])

  const handleSelected = useCallback((event) => {
    if (!event?.range) return
    const [start, end] = event.range.x
    setSelected(null)
    setPendingSelection({ start, end })
    setError(null)
  }, [])

  // ── Navigation ──
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
      requestAnimationFrame(() => { try { Plotly.relayout(el, upd) } catch (_) {} })
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
    if (el) requestAnimationFrame(() => { try { Plotly.relayout(el, { "xaxis.autorange": true, "yaxis.autorange": true }) } catch (_) {} })
    setFocusIndex(-1)
  }, [])

  const cancelSearch = useCallback(() => {
    if (abortController) abortController.abort()
    if (batchTimer.current) clearTimeout(batchTimer.current)
    setSearching(false)
    setBatchProgress(null)
  }, [])

  return (
    <div className="animate-in">
      {/* Legend Bar */}
      <div className="legend-bar">
        {[
          { color: COLORS.high, label: "≥ 80%" },
          { color: COLORS.mid, label: "50–79%" },
          { color: COLORS.low, label: "< 50%" },
          { color: COLORS.sel, label: "Sélection" },
        ].map(l => (
          <span className="legend-item" key={l.label}>
            <span className="legend-dot" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}

        {(searching || batchProgress) && (
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {searching && (
              <span style={{ color: 'var(--accent-indigo)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} />
                Recherche…
              </span>
            )}
            {!searching && batchProgress && (
              <span style={{ color: 'var(--accent-violet)', fontSize: 11 }}>
                Affichage {batchProgress.done} / {batchProgress.total}
              </span>
            )}
            <button className="btn btn-danger btn-sm" onClick={cancelSearch}>
              <X size={12} /> Stop
            </button>
          </span>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="banner-warning">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Navigation Controls */}
      {filtered.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <button className="btn btn-sm" onClick={() => navigate("prev")}><ChevronLeft size={14} /></button>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {focusIndex >= 0
              ? <>
                  <strong style={{ color: 'var(--text-primary)' }}>#{focusIndex + 1}</strong> / {filtered.length}
                  <span className="badge badge-indigo" style={{ marginLeft: 8 }}>
                    {filtered[focusIndex]?.similarity?.toFixed(0)}%
                  </span>
                </>
              : `${visibleMatches.length} rectangles affichés`
            }
          </span>
          <button className="btn btn-sm" onClick={() => navigate("next")}><ChevronRight size={14} /></button>
          <button className="btn btn-sm" onClick={resetZoom} style={{ marginLeft: 4 }}>
            <RotateCcw size={13} /> Reset
          </button>
        </div>
      )}

      {/* Plotly Chart */}
      <div className="section" style={{ padding: '12px 14px', position: 'relative' }}>
        {x.length > 0 ? (
          <Plot
            ref={plotRef}
            data={plotData}
            layout={layout}
            onSelected={handleSelected}
            style={{ width: "100%", height: "520px" }}
            useResizeHandler
            config={PLOT_CFG}
          />
        ) : (
          <div style={{
            width: '100%', height: 520,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', fontSize: 14,
          }}>
            <div style={{ textAlign: 'center' }}>
              <Search size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
              <div>Chargement du graphe…</div>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation de recherche */}
      {pendingSelection && !searching && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 12, marginTop: 12,
          animation: 'fadeSlideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(129,140,248,0.06))',
            border: '1px solid rgba(129,140,248,0.25)',
            borderRadius: 'var(--radius-lg)',
            padding: '10px 18px',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 24px rgba(99,102,241,0.12)',
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Plage sélectionnée — lancer la recherche ?
            </span>
            <button
              onClick={() => launchSearch(pendingSelection.start, pendingSelection.end)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '7px 18px',
                background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                border: 'none', borderRadius: 'var(--radius-sm)',
                color: '#fff', fontSize: 13, fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 12px rgba(99,102,241,0.35)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(99,102,241,0.55)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 12px rgba(99,102,241,0.35)'}
            >
              <Sparkles size={14} />
              Analyser
            </button>
            <button
              onClick={() => { setPendingSelection(null) }}
              style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '7px 10px',
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-muted)', fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      <FilterPanel allMatches={allMatches} onFilterChange={handleFilterChange} />
    </div>
  )
}
