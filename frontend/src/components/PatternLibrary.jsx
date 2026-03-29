import React, { useState, useEffect, useCallback, useMemo, memo } from "react"
import Plot from "react-plotly.js"
import { listPatterns, getPattern, deletePattern } from "../api/api"
import {
  BookOpen, ArrowLeft, Trash2, Clock, TrendingUp, TrendingDown,
  Activity, Sigma, Target, Award, Minus, RefreshCw, ChevronRight,
  Loader, AlertCircle, FolderOpen, BarChart3
} from "lucide-react"

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

const PLOT_CFG = { displayModeBar: false, staticPlot: false, scrollZoom: false }

const StatCard = memo(({ label, value, unit, colorClass, icon: Icon }) => (
  <div className={`stat-card ${colorClass || 'stat-card-indigo'}`}>
    <div className="stat-label">{Icon && <Icon size={11} />} {label}</div>
    <div className="stat-value">
      {value}
      {unit && <span className="stat-unit">{unit}</span>}
    </div>
  </div>
))

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
      <defs>
        <linearGradient id="sparkGradDark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={`${pad},${h} ${points} ${w - pad},${h}`}
        fill="url(#sparkGradDark)" stroke="none" />
      <polyline points={points} fill="none" stroke="#818cf8" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
})

const DistributionSection = memo(({ dist, matchCount }) => {
  if (!dist) {
    return (
      <div className="section" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: 24 }}>
        <AlertCircle size={20} style={{ opacity: 0.4, margin: '0 auto 8px', display: 'block' }} />
        Distribution non disponible (pattern sauvegardé avant cette fonctionnalité).
        <br />Resauvegardez le pattern pour enregistrer la distribution.
      </div>
    )
  }

  const excellent = dist.excellent || 0
  const good = dist.good || 0
  const low = dist.low || 0
  const total = excellent + good + low

  const segments = [
    { label: "Excellent (≥80%)", count: excellent, color: "var(--accent-emerald)", raw: "#34d399", icon: Award },
    { label: "Bon (50–79%)", count: good, color: "var(--accent-blue)", raw: "#60a5fa", icon: Target },
    { label: "Faible (<50%)", count: low, color: "var(--accent-amber)", raw: "#fbbf24", icon: Minus },
  ]

  return (
    <div className="section">
      <h4 className="section-title"><BarChart3 size={15} /> Répartition des occurrences
        <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12, marginLeft: 8 }}>
          {total} patterns trouvés
        </span>
      </h4>

      {total > 0 && (
        <div className="distribution-bar" style={{ marginBottom: 14 }}>
          {segments.map(s => {
            const pct = (s.count / total) * 100
            if (pct === 0) return null
            return (
              <div key={s.label} style={{
                width: `${pct}%`, background: s.raw,
                minWidth: s.count > 0 ? 36 : 0,
              }}>
                {s.count}
              </div>
            )
          })}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {segments.map(s => {
          const pct = total > 0 ? ((s.count / total) * 100).toFixed(1) : "0"
          const SIcon = s.icon
          return (
            <div key={s.label} style={{
              background: `${s.raw}0d`, borderRadius: 10, padding: '14px 16px',
              borderLeft: `4px solid ${s.raw}`, textAlign: 'center',
            }}>
              <SIcon size={16} style={{ color: s.raw, marginBottom: 4 }} />
              <div style={{ fontSize: 26, fontWeight: 800, color: s.raw }}>{s.count}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.raw, marginTop: 4 }}>{pct}%</div>
            </div>
          )
        })}
      </div>
    </div>
  )
})

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

  const computed = useMemo(() => {
    if (!detail?.values?.length) return null
    const v = detail.values
    const n = v.length
    const mean = v.reduce((a, b) => a + b, 0) / n
    const std = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / n)
    const sorted = [...v].sort((a, b) => a - b)
    const min = sorted[0], max = sorted[n - 1]
    const amplitude = max - min
    return { mean, std, min, max, amplitude, n }
  }, [detail])

  const curveData = useMemo(() => {
    if (!detail?.values?.length) return []
    const hasDates = detail.dates?.length === detail.values.length
    const x = hasDates ? detail.dates : detail.values.map((_, i) => i)
    return [{
      x, y: detail.values, type: "scattergl", mode: "lines",
      line: { width: 2, color: "#818cf8", shape: "spline" },
      fill: "tozeroy",
      fillcolor: "rgba(129,140,248,0.08)",
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
        showgrid: false, tickfont: { size: 10, color: "#94a3b8" },
        tickcolor: "#334155", linecolor: "#334155",
      },
      yaxis: {
        showgrid: true, gridcolor: "rgba(148,163,184,0.08)",
        tickfont: { size: 10, color: "#94a3b8" },
        tickcolor: "#334155", linecolor: "#334155",
        title: { text: "kW", font: { size: 11, color: "#64748b" } },
        zeroline: false,
      },
      plot_bgcolor: "transparent", paper_bgcolor: "transparent",
      font: { family: "Inter, sans-serif" },
      shapes: [
        { type: "line", x0: 0, x1: 1, xref: "paper", y0: computed.mean, y1: computed.mean,
          line: { color: "#818cf8", width: 1.5, dash: "dash" } },
      ],
      annotations: [
        { x: 1, xref: "paper", y: computed.mean, text: `μ = ${fmt(computed.mean)} kW`,
          showarrow: false, font: { size: 10, color: "#818cf8" }, xanchor: "left", xshift: 4 }
      ]
    }
  }, [computed, detail])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
        <Loader size={28} className="spinner" style={{ margin: '0 auto 12px', display: 'block' }} />
        Chargement du pattern...
      </div>
    )
  }

  if (!detail || !computed) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--accent-rose)' }}>
        <AlertCircle size={28} style={{ margin: '0 auto 8px', display: 'block' }} />
        Erreur : impossible de charger le pattern.
        <br />
        <button className="btn" onClick={onBack} style={{ marginTop: 12 }}>
          <ArrowLeft size={14} /> Retour
        </button>
      </div>
    )
  }

  const st = detail.stats || {}

  return (
    <div className="animate-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-ghost" onClick={onBack}>
          <ArrowLeft size={16} /> Retour
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
            {detail.name}
          </h2>
          {detail.description && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{detail.description}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={12} /> {formatDate(detail.created_at)}
          </span>
          {!confirming ? (
            <button className="btn btn-danger" onClick={() => setConfirming(true)}>
              <Trash2 size={13} /> Supprimer
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? <Loader size={13} className="spinner" /> : "Confirmer"}
              </button>
              <button className="btn" onClick={() => setConfirming(false)}>Annuler</button>
            </div>
          )}
        </div>
      </div>

      {/* Key metrics */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <StatCard label="Points" value={fmt(computed.n, 0)} colorClass="stat-card-violet" icon={Activity} />
        <StatCard label="Durée" value={fmt(st.duration_hours)} unit="h" colorClass="stat-card-indigo" icon={Clock} />
        <StatCard label="Moyenne" value={fmt(computed.mean)} unit="kW" colorClass="stat-card-blue" icon={TrendingUp} />
        <StatCard label="Écart-type" value={fmt(computed.std)} unit="kW" colorClass="stat-card-violet" icon={Sigma} />
        <StatCard label="Min" value={fmt(computed.min)} unit="kW" colorClass="stat-card-emerald" icon={TrendingDown} />
        <StatCard label="Max" value={fmt(computed.max)} unit="kW" colorClass="stat-card-rose" icon={TrendingUp} />
        <StatCard label="Amplitude" value={fmt(computed.amplitude)} unit="kW" colorClass="stat-card-amber" icon={Activity} />
      </div>

      {/* Pattern curve */}
      <div className="section">
        <h4 className="section-title">
          <Activity size={15} /> Forme du pattern
          <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11, marginLeft: 8 }}>
            Ligne pointillée = moyenne
          </span>
        </h4>
        {curveData.length > 0 && (
          <Plot data={curveData} layout={curveLayout} config={PLOT_CFG}
            style={{ width: "100%" }} useResizeHandler />
        )}
      </div>

      {/* Distribution */}
      <DistributionSection dist={st.distribution} matchCount={detail.match_count} />

      {/* Temporal info */}
      <div className="section">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px 20px', fontSize: 12 }}>
          <div><span style={{ color: 'var(--text-muted)' }}>Début :</span> <strong style={{ color: 'var(--text-primary)' }}>{formatDateStr(detail.dates?.[0])}</strong></div>
          <div><span style={{ color: 'var(--text-muted)' }}>Fin :</span> <strong style={{ color: 'var(--text-primary)' }}>{formatDateStr(detail.dates?.[detail.dates.length - 1])}</strong></div>
          <div><span style={{ color: 'var(--text-muted)' }}>Sauvegardé :</span> <strong style={{ color: 'var(--text-primary)' }}>{formatDate(detail.created_at)}</strong></div>
        </div>
      </div>
    </div>
  )
})

const PatternCard = memo(({ pattern, onClick }) => {
  const st = pattern.stats || {}
  return (
    <div onClick={() => onClick(pattern)} className="glass-card-interactive" style={{
      borderLeft: '3px solid var(--accent-indigo)',
      display: 'flex', alignItems: 'center', gap: 14,
      cursor: 'pointer',
    }}>
      <div style={{ flexShrink: 0 }}>
        {pattern._preview ? (
          <MiniSparkline values={pattern._preview} />
        ) : (
          <div className="skeleton" style={{ width: 120, height: 32, borderRadius: 4 }} />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{
            fontSize: 15, fontWeight: 700, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {pattern.name}
          </span>
          <span className="badge" style={{ background: 'rgba(129,140,248,0.15)', color: 'var(--accent-indigo)' }}>
            {pattern.match_count} occ.
          </span>
        </div>
        {pattern.description && (
          <div style={{
            fontSize: 11, color: 'var(--text-muted)', marginBottom: 4,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {pattern.description}
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={10} /> {fmt(st.duration_hours)} h</span>
          <span>μ = {fmt(st.mean)} kW</span>
          <span>σ = {fmt(st.std)} kW</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Activity size={10} /> {fmt(st.amplitude)} kW</span>
        </div>
      </div>

      <ChevronRight size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
    </div>
  )
})

const PatternLibrary = memo(({ refreshKey }) => {
  const [patterns, setPatterns] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listPatterns()
      const list = res.patterns || []
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

  return (
    <div style={{ marginTop: 16 }} className="animate-in">
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16, paddingBottom: 10,
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <h3 style={{
          margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <BookOpen size={18} style={{ color: 'var(--accent-indigo)' }} />
          Bibliothèque de patterns
          <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 13, marginLeft: 4 }}>
            {patterns.length} pattern{patterns.length > 1 ? "s" : ""} sauvegardé{patterns.length > 1 ? "s" : ""}
          </span>
        </h3>
        <button className="btn" onClick={load} disabled={loading}>
          {loading ? <Loader size={14} className="spinner" /> : <RefreshCw size={14} />}
          {loading ? "Chargement…" : "Rafraîchir"}
        </button>
      </div>

      {patterns.length === 0 && !loading && (
        <div style={{
          textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)', fontSize: 14,
          borderRadius: 12, border: '2px dashed var(--border-subtle)',
        }}>
          <FolderOpen size={40} style={{ opacity: 0.3, margin: '0 auto 12px', display: 'block' }} />
          <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Bibliothèque vide</div>
          <div style={{ marginTop: 6, fontSize: 12 }}>
            Analysez un motif dans l'onglet Analyse, puis cliquez "Sauvegarder"
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {patterns.map(p => (
          <PatternCard key={p.id} pattern={p} onClick={setSelected} />
        ))}
      </div>
    </div>
  )
})

export default PatternLibrary
