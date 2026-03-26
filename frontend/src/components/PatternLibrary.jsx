import React, { useState, useEffect, useCallback, useMemo, memo } from "react"
import Plot from "react-plotly.js"
import { listPatterns, getPattern, deletePattern } from "../api/api"

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(v, d = 2) {
  if (v === undefined || v === null) return "-"
  return typeof v === "number" ? v.toLocaleString("fr-FR", { maximumFractionDigits: d }) : v
}

function formatDate(ts) {
  if (!ts) return "-"
  return new Date(ts * 1000).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  })
}

function formatDateStr(d) {
  if (!d) return "-"
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  })
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const SEC = {
  background: "#fff", border: "1px solid #e8e8e8",
  borderRadius: 10, padding: "14px 18px", marginBottom: 12
}
const CARD_BASE = {
  border: "1px solid #e8e8e8", borderRadius: 10,
  padding: "14px 18px", background: "#fff",
  cursor: "pointer", transition: "all 0.2s",
}
const STAT_CARD = (color) => ({
  background: "#fff", border: "1px solid #e8e8e8", borderRadius: 8,
  padding: "10px 14px", minWidth: 120, flex: "1 1 120px",
  borderLeft: `4px solid ${color}`
})
const BADGE = (bg, color) => ({
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700,
  background: bg, color
})
const PLOT_CFG = { displayModeBar: false, staticPlot: false, scrollZoom: false }

// ─── StatCard ─────────────────────────────────────────────────────────────────
const StatCard = memo(({ label, value, unit, color, icon }) => (
  <div style={STAT_CARD(color || "#0984e3")}>
    <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>{icon} {label}</div>
    <div style={{ fontSize: 18, fontWeight: 700, color: color || "#2d3436" }}>
      {value}
      {unit && <span style={{ fontSize: 10, fontWeight: 400, color: "#aaa", marginLeft: 3 }}>{unit}</span>}
    </div>
  </div>
))

// ─── Mini sparkline for the list card ─────────────────────────────────────────
const MiniSparkline = memo(({ values }) => {
  if (!values || values.length < 2) return null
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1
  const w = 120, h = 32, pad = 2
  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - 2 * pad)
    const y = h - pad - ((v - min) / range) * (h - 2 * pad)
    return `${x},${y}`
  }).join(" ")
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline points={points} fill="none" stroke="#6c5ce7" strokeWidth="1.5" strokeLinejoin="round" />
      <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#6c5ce7" stopOpacity="0.2" />
        <stop offset="100%" stopColor="#6c5ce7" stopOpacity="0" />
      </linearGradient>
      <polyline
        points={`${pad},${h} ${points} ${w - pad},${h}`}
        fill="url(#sparkGrad)" stroke="none"
      />
    </svg>
  )
})

// ═══════════════════════════════════════════════════════════════════════════════
//  Pattern Detail View — the "dream" view
// ═══════════════════════════════════════════════════════════════════════════════
const PatternDetail = memo(({ patternSummary, onBack, onDeleted }) => {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getPattern(patternSummary.id).then(res => {
      if (!cancelled) { setDetail(res); setLoading(false) }
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [patternSummary.id])

  const handleDelete = useCallback(async () => {
    setDeleting(true)
    try {
      await deletePattern(patternSummary.id)
      onDeleted()
    } catch { setDeleting(false) }
  }, [patternSummary.id, onDeleted])

  // ── Derived stats ──
  const computed = useMemo(() => {
    if (!detail?.values?.length) return null
    const v = detail.values
    const n = v.length
    const mean = v.reduce((a, b) => a + b, 0) / n
    const variance = v.reduce((a, b) => a + (b - mean) ** 2, 0) / n
    const std = Math.sqrt(variance)
    const sorted = [...v].sort((a, b) => a - b)
    const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)]
    const min = sorted[0], max = sorted[n - 1]
    const amplitude = max - min
    const energy = v.reduce((a, b) => a + b, 0)
    const rms = Math.sqrt(v.reduce((a, b) => a + b * b, 0) / n)

    // Trend (linear regression slope)
    const xMean = (n - 1) / 2
    let num = 0, den = 0
    for (let i = 0; i < n; i++) { num += (i - xMean) * (v[i] - mean); den += (i - xMean) ** 2 }
    const slope = den !== 0 ? num / den : 0
    const trendPct = mean !== 0 ? (slope * n / mean) * 100 : 0

    // Quartiles
    const q1 = sorted[Math.floor(n * 0.25)]
    const q3 = sorted[Math.floor(n * 0.75)]
    const iqr = q3 - q1

    // Coefficient of variation
    const cv = mean !== 0 ? (std / Math.abs(mean)) * 100 : 0

    // Peak-to-peak changes
    const diffs = []
    for (let i = 1; i < n; i++) diffs.push(Math.abs(v[i] - v[i - 1]))
    const avgChange = diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 0
    const maxChange = diffs.length ? Math.max(...diffs) : 0

    return {
      mean, std, variance, median, min, max, amplitude, energy, rms,
      slope, trendPct, q1, q3, iqr, cv, avgChange, maxChange, n
    }
  }, [detail])

  // ── Plotly: main curve ──
  const curveData = useMemo(() => {
    if (!detail?.values?.length) return []
    const hasDates = detail.dates?.length === detail.values.length
    const x = hasDates ? detail.dates : detail.values.map((_, i) => i)
    return [{
      x, y: detail.values, type: "scattergl", mode: "lines",
      line: { width: 2, color: "#6c5ce7", shape: "spline" },
      fill: "tozeroy",
      fillcolor: "rgba(108,92,231,0.08)",
      hovertemplate: hasDates
        ? "%{x|%d %b %H:%M}<br><b>%{y:.2f} kW</b><extra></extra>"
        : "Point %{x}<br><b>%{y:.2f} kW</b><extra></extra>"
    }]
  }, [detail])

  const curveLayout = useMemo(() => {
    if (!computed) return {}
    return {
      height: 300, margin: { t: 10, b: 40, l: 55, r: 20 },
      xaxis: {
        type: detail?.dates?.length ? "date" : "linear",
        showgrid: false, tickfont: { size: 10 },
        title: { text: detail?.dates?.length ? "" : "Index", font: { size: 10, color: "#aaa" } }
      },
      yaxis: {
        showgrid: true, gridcolor: "#f0f0f0", tickfont: { size: 10 },
        title: { text: "kW", font: { size: 11, color: "#666" } }
      },
      plot_bgcolor: "#fafafa", paper_bgcolor: "#fff",
      shapes: [
        // Mean line
        { type: "line", x0: 0, x1: 1, xref: "paper", y0: computed.mean, y1: computed.mean,
          line: { color: "#0984e3", width: 1.5, dash: "dash" } },
        // ±1 std band
        { type: "rect", x0: 0, x1: 1, xref: "paper",
          y0: computed.mean - computed.std, y1: computed.mean + computed.std,
          fillcolor: "rgba(9,132,227,0.06)", line: { width: 0 } },
      ],
      annotations: [
        { x: 1, xref: "paper", y: computed.mean, text: `μ=${fmt(computed.mean)}`,
          showarrow: false, font: { size: 10, color: "#0984e3" }, xanchor: "left", xshift: 4 }
      ]
    }
  }, [computed, detail])

  // ── Plotly: histogram ──
  const histData = useMemo(() => {
    if (!detail?.values?.length) return []
    return [{
      x: detail.values, type: "histogram", nbinsx: 25,
      marker: { color: "rgba(108,92,231,0.5)", line: { color: "#6c5ce7", width: 1 } },
      hovertemplate: "%{x:.1f} kW<br>Fréquence: %{y}<extra></extra>"
    }]
  }, [detail])

  const histLayout = useMemo(() => ({
    height: 200, margin: { t: 8, b: 35, l: 45, r: 15 },
    xaxis: { title: { text: "Valeur (kW)", font: { size: 10, color: "#888" } }, tickfont: { size: 9 }, showgrid: false },
    yaxis: { title: { text: "Fréquence", font: { size: 10, color: "#888" } }, tickfont: { size: 9 }, showgrid: true, gridcolor: "#f0f0f0" },
    plot_bgcolor: "#fafafa", paper_bgcolor: "#fff",
    bargap: 0.05,
    shapes: computed ? [
      { type: "line", x0: computed.median, x1: computed.median, y0: 0, y1: 1, yref: "paper",
        line: { color: "#e17055", width: 1.5, dash: "dot" } }
    ] : []
  }), [computed])

  // ── Plotly: box plot ──
  const boxData = useMemo(() => {
    if (!detail?.values?.length) return []
    return [{
      y: detail.values, type: "box", name: "Distribution",
      marker: { color: "#6c5ce7", outliercolor: "#e74c3c" },
      boxmean: "sd",
      fillcolor: "rgba(108,92,231,0.15)",
      line: { color: "#6c5ce7" }
    }]
  }, [detail])

  const boxLayout = useMemo(() => ({
    height: 200, margin: { t: 8, b: 10, l: 45, r: 15 },
    yaxis: { title: { text: "kW", font: { size: 10, color: "#888" } }, tickfont: { size: 9 }, showgrid: true, gridcolor: "#f0f0f0" },
    plot_bgcolor: "#fafafa", paper_bgcolor: "#fff",
    showlegend: false
  }), [])

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0", color: "#aaa" }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
        Chargement du pattern...
      </div>
    )
  }

  if (!detail || !computed) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", color: "#e74c3c" }}>
        Erreur : impossible de charger le pattern.
        <br />
        <button onClick={onBack} style={{ marginTop: 12, padding: "6px 16px", borderRadius: 6, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>
          Retour
        </button>
      </div>
    )
  }

  const st = detail.stats || {}

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{
          padding: "6px 14px", borderRadius: 6, border: "1px solid #ddd",
          background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600
        }}>
          ← Retour
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#2d3436" }}>
            {detail.name}
          </h2>
          {detail.description && (
            <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{detail.description}</div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={BADGE("#f0edff", "#6c5ce7")}>
            {detail.match_count} occurrences
          </span>
          <span style={{ fontSize: 11, color: "#aaa" }}>
            {formatDate(detail.created_at)}
          </span>
          {!confirming ? (
            <button onClick={() => setConfirming(true)} style={{
              padding: "5px 12px", borderRadius: 6, border: "1px solid #e74c3c",
              background: "#fff", color: "#e74c3c", fontSize: 11, cursor: "pointer", fontWeight: 600
            }}>
              Supprimer
            </button>
          ) : (
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={handleDelete} disabled={deleting} style={{
                padding: "5px 12px", borderRadius: 6, border: "none",
                background: "#e74c3c", color: "#fff", fontSize: 11, cursor: "pointer", fontWeight: 700
              }}>
                {deleting ? "..." : "Confirmer"}
              </button>
              <button onClick={() => setConfirming(false)} style={{
                padding: "5px 12px", borderRadius: 6, border: "1px solid #ddd",
                background: "#fff", fontSize: 11, cursor: "pointer"
              }}>
                Annuler
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Key metrics row ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        <StatCard label="Points" value={fmt(computed.n, 0)} color="#6c5ce7" icon="📐" />
        <StatCard label="Durée" value={fmt(st.duration_hours)} unit="h" color="#0984e3" icon="⏱" />
        <StatCard label="Occurrences" value={fmt(detail.match_count, 0)} color="#2ecc71" icon="🔁" />
        <StatCard label="Énergie totale" value={fmt(computed.energy, 0)} unit="kW·pts" color="#fdcb6e" icon="⚡" />
        <StatCard label="RMS" value={fmt(computed.rms)} unit="kW" color="#e17055" icon="〰" />
        <StatCard label="Tendance" value={`${computed.trendPct >= 0 ? "+" : ""}${fmt(computed.trendPct, 1)}%`}
          color={computed.trendPct >= 0 ? "#2ecc71" : "#e74c3c"}
          icon={computed.trendPct >= 0 ? "📈" : "📉"} />
      </div>

      {/* ── Pattern curve ── */}
      <div style={{ ...SEC, padding: "10px 14px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#2d3436", marginBottom: 6 }}>
          Forme du pattern
          <span style={{ fontWeight: 400, color: "#aaa", fontSize: 11, marginLeft: 8 }}>
            Ligne pointillée = moyenne · Bande = ±1σ
          </span>
        </div>
        {curveData.length > 0 && (
          <Plot data={curveData} layout={curveLayout} config={PLOT_CFG}
            style={{ width: "100%" }} useResizeHandler />
        )}
      </div>

      {/* ── Stats grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        {/* Left: Central tendency & dispersion */}
        <div style={SEC}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#2d3436", marginBottom: 10 }}>
            Tendance centrale & Dispersion
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <StatCard label="Moyenne" value={fmt(computed.mean)} unit="kW" color="#0984e3" icon="μ" />
            <StatCard label="Médiane" value={fmt(computed.median)} unit="kW" color="#e17055" icon="M" />
            <StatCard label="Écart-type" value={fmt(computed.std)} unit="kW" color="#6c5ce7" icon="σ" />
            <StatCard label="Variance" value={fmt(computed.variance)} unit="kW²" color="#a29bfe" icon="σ²" />
            <StatCard label="CV" value={fmt(computed.cv, 1)} unit="%" color="#fd79a8" icon="%" />
          </div>
        </div>

        {/* Right: Extremes */}
        <div style={SEC}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#2d3436", marginBottom: 10 }}>
            Extrêmes & Amplitude
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <StatCard label="Min" value={fmt(computed.min)} unit="kW" color="#00b894" icon="▼" />
            <StatCard label="Max" value={fmt(computed.max)} unit="kW" color="#d63031" icon="▲" />
            <StatCard label="Amplitude" value={fmt(computed.amplitude)} unit="kW" color="#e17055" icon="↕" />
            <StatCard label="IQR (Q3−Q1)" value={fmt(computed.iqr)} unit="kW" color="#00cec9" icon="┃" />
          </div>
        </div>
      </div>

      {/* ── Charts row: histogram + boxplot ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div style={{ ...SEC, padding: "10px 14px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#2d3436", marginBottom: 6 }}>
            Distribution des valeurs
            <span style={{ fontWeight: 400, color: "#aaa", fontSize: 11, marginLeft: 8 }}>
              Ligne pointillée = médiane
            </span>
          </div>
          {histData.length > 0 && (
            <Plot data={histData} layout={histLayout} config={PLOT_CFG}
              style={{ width: "100%" }} useResizeHandler />
          )}
        </div>

        <div style={{ ...SEC, padding: "10px 14px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#2d3436", marginBottom: 6 }}>
            Boîte à moustaches
            <span style={{ fontWeight: 400, color: "#aaa", fontSize: 11, marginLeft: 8 }}>
              Diamant = moyenne ± σ
            </span>
          </div>
          {boxData.length > 0 && (
            <Plot data={boxData} layout={boxLayout} config={PLOT_CFG}
              style={{ width: "100%" }} useResizeHandler />
          )}
        </div>
      </div>

      {/* ── Variability & quartiles ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div style={SEC}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#2d3436", marginBottom: 10 }}>
            Variabilité point-à-point
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <StatCard label="Δ moyen" value={fmt(computed.avgChange)} unit="kW" color="#0984e3" icon="≈" />
            <StatCard label="Δ max" value={fmt(computed.maxChange)} unit="kW" color="#e74c3c" icon="!" />
            <StatCard label="Pente" value={fmt(computed.slope, 4)} unit="kW/pt" color="#00b894" icon="⟋" />
          </div>
        </div>

        <div style={SEC}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#2d3436", marginBottom: 10 }}>
            Quartiles
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <StatCard label="Q1 (25%)" value={fmt(computed.q1)} unit="kW" color="#74b9ff" icon="¼" />
            <StatCard label="Médiane (50%)" value={fmt(computed.median)} unit="kW" color="#e17055" icon="½" />
            <StatCard label="Q3 (75%)" value={fmt(computed.q3)} unit="kW" color="#a29bfe" icon="¾" />
          </div>
        </div>
      </div>

      {/* ── Temporal info ── */}
      <div style={SEC}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#2d3436", marginBottom: 8 }}>
          Informations temporelles
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px 20px", fontSize: 12, color: "#555" }}>
          <div><span style={{ color: "#888" }}>Début :</span> <strong>{formatDateStr(detail.dates?.[0])}</strong></div>
          <div><span style={{ color: "#888" }}>Fin :</span> <strong>{formatDateStr(detail.dates?.[detail.dates.length - 1])}</strong></div>
          <div><span style={{ color: "#888" }}>Durée :</span> <strong>{fmt(st.duration_hours)} h</strong></div>
          <div><span style={{ color: "#888" }}>Points :</span> <strong>{computed.n}</strong></div>
          <div>
            <span style={{ color: "#888" }}>Résolution :</span>{" "}
            <strong>
              {detail.dates?.length >= 2
                ? `${fmt((new Date(detail.dates[1]) - new Date(detail.dates[0])) / 1000, 0)} s`
                : "-"}
            </strong>
          </div>
          <div><span style={{ color: "#888" }}>Sauvegardé :</span> <strong>{formatDate(detail.created_at)}</strong></div>
        </div>
      </div>
    </div>
  )
})

// ═══════════════════════════════════════════════════════════════════════════════
//  Pattern List Card (compact, with sparkline)
// ═══════════════════════════════════════════════════════════════════════════════
const PatternCard = memo(({ pattern, onClick }) => {
  const st = pattern.stats || {}
  return (
    <div
      onClick={() => onClick(pattern)}
      style={{
        ...CARD_BASE,
        borderLeft: "4px solid #6c5ce7",
        display: "flex", alignItems: "center", gap: 14
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(108,92,231,0.15)"; e.currentTarget.style.borderColor = "#6c5ce7" }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "#e8e8e8" }}
    >
      {/* Sparkline preview */}
      <div style={{ flexShrink: 0 }}>
        {pattern._preview ? (
          <MiniSparkline values={pattern._preview} />
        ) : (
          <div style={{ width: 120, height: 32, background: "#f5f6fa", borderRadius: 4 }} />
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#2d3436", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {pattern.name}
          </span>
          <span style={BADGE("#f0edff", "#6c5ce7")}>{pattern.match_count} occ.</span>
        </div>
        {pattern.description && (
          <div style={{ fontSize: 11, color: "#888", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {pattern.description}
          </div>
        )}
        <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#555", marginTop: 4 }}>
          <span>⏱ {fmt(st.duration_hours)} h</span>
          <span>μ = {fmt(st.mean)} kW</span>
          <span>σ = {fmt(st.std)} kW</span>
          <span>↕ {fmt(st.amplitude)} kW</span>
        </div>
      </div>

      {/* Arrow */}
      <div style={{ fontSize: 18, color: "#bbb", flexShrink: 0 }}>›</div>
    </div>
  )
})

// ═══════════════════════════════════════════════════════════════════════════════
//  Main PatternLibrary
// ═══════════════════════════════════════════════════════════════════════════════
const PatternLibrary = memo(({ refreshKey }) => {
  const [patterns, setPatterns] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null) // null = list view, object = detail view

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listPatterns()
      const list = res.patterns || []
      // Fetch a lightweight preview (first N values) for sparklines
      const withPreviews = await Promise.all(
        list.map(async (p) => {
          try {
            const full = await getPattern(p.id)
            return { ...p, _preview: full.values?.slice(0, 200) || null }
          } catch { return { ...p, _preview: null } }
        })
      )
      setPatterns(withPreviews)
    } catch { setPatterns([]) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load, refreshKey])

  const handleDeleted = useCallback(() => {
    setSelected(null)
    load()
  }, [load])

  // ── Detail view ──
  if (selected) {
    return (
      <div style={{ marginTop: 16 }}>
        <PatternDetail
          patternSummary={selected}
          onBack={() => setSelected(null)}
          onDeleted={handleDeleted}
        />
      </div>
    )
  }

  // ── List view ──
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#2d3436" }}>
          Bibliothèque de patterns
          <span style={{ fontWeight: 400, color: "#aaa", fontSize: 13, marginLeft: 8 }}>
            {patterns.length} pattern{patterns.length > 1 ? "s" : ""} sauvegardé{patterns.length > 1 ? "s" : ""}
          </span>
        </h3>
        <button onClick={load} disabled={loading} style={{
          padding: "6px 16px", borderRadius: 6, border: "1px solid #ddd",
          background: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 600
        }}>
          {loading ? "Chargement..." : "⟳ Rafraîchir"}
        </button>
      </div>

      {patterns.length === 0 && !loading && (
        <div style={{
          textAlign: "center", padding: "50px 20px", color: "#aaa", fontSize: 14,
          background: "#fafafa", borderRadius: 12, border: "2px dashed #e0e0e0"
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
          <div style={{ fontWeight: 600, color: "#888" }}>Bibliothèque vide</div>
          <div style={{ marginTop: 6, fontSize: 12 }}>
            Analysez un motif dans l'onglet Analyse, puis cliquez "Sauvegarder ce pattern"
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {patterns.map(p => (
          <PatternCard key={p.id} pattern={p} onClick={setSelected} />
        ))}
      </div>
    </div>
  )
})

export default PatternLibrary
