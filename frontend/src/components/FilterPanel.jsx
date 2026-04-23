import React, { useState, useCallback, useEffect, useRef, memo } from "react"
import { SlidersHorizontal, X } from "lucide-react"

const PRESETS = [
  { label: "Tous",     min: 0,  max: 100, dot: "#64748b" },
  { label: "≥ 80%",   min: 80, max: 100, dot: "#34d399" },
  { label: "50–79%",  min: 50, max: 79,  dot: "#60a5fa" },
  { label: "< 50%",   min: 0,  max: 49,  dot: "#fbbf24" },
]

const FilterPanel = memo(({ allMatches, onFilterChange }) => {
  const [open, setOpen]               = useState(true)
  const [minSim, setMinSim]           = useState(0)
  const [maxSim, setMaxSim]           = useState(100)
  const [maxCount, setMaxCount]       = useState("50")
  const prevLenRef                    = useRef(0)

  const apply = useCallback((mn, mx, cnt) => {
    const filtered = allMatches
      .filter(m => { const s = m.similarity ?? 0; return s >= mn && s <= mx })
      .sort((a, b) => b.similarity - a.similarity)
    const limited = cnt && !isNaN(cnt) && parseInt(cnt) > 0
      ? filtered.slice(0, parseInt(cnt))
      : filtered
    onFilterChange(limited)
  }, [allMatches, onFilterChange])

  useEffect(() => {
    if (allMatches.length > 0 && allMatches.length !== prevLenRef.current) {
      prevLenRef.current = allMatches.length
      setMinSim(0); setMaxSim(100); setMaxCount("50")
      apply(0, 100, "50")
    }
  }, [allMatches, apply])

  if (allMatches.length === 0) return null

  const total     = allMatches.length
  const excellent = allMatches.filter(m => (m.similarity ?? 0) >= 80).length
  const good      = allMatches.filter(m => { const s = m.similarity ?? 0; return s >= 50 && s < 80 }).length
  const low       = allMatches.filter(m => (m.similarity ?? 0) < 50).length
  const passing   = allMatches.filter(m => { const s = m.similarity ?? 0; return s >= minSim && s <= maxSim }).length
  const displayed = maxCount && parseInt(maxCount) > 0 ? Math.min(parseInt(maxCount), passing) : passing
  const isFiltered = minSim > 0 || maxSim < 100

  return (
    <div style={{
      position: 'fixed', top: 76, right: 16, zIndex: 1000,
      width: open ? 252 : 42,
      background: 'var(--bg-card)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid var(--border-subtle)',
      borderRadius: open ? 14 : 21,
      boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
      overflow: 'hidden',
      transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1), border-radius 0.22s',
      animation: 'slideInRight 0.3s ease-out',
    }}>

      {/* ── Toggle / Header ── */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: open ? 'space-between' : 'center',
          padding: open ? '10px 14px' : '10px',
          cursor: 'pointer', userSelect: 'none',
          borderBottom: open ? '1px solid var(--border-subtle)' : 'none',
          minHeight: 42,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <SlidersHorizontal size={15} style={{
            color: isFiltered ? 'var(--accent-indigo)' : 'var(--text-muted)',
            flexShrink: 0,
          }} />
          {open && (
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              Filtres
            </span>
          )}
        </div>
        {open && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {isFiltered && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: 'var(--accent-indigo)',
                background: 'var(--accent-indigo-bg)',
                padding: '1px 6px', borderRadius: 10,
              }}>
                {minSim}–{maxSim}%
              </span>
            )}
            <X size={13} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
          </div>
        )}
      </div>

      {/* ── Body ── */}
      {open && (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Mini stats row */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 2 }}>{total}</span>
            {[
              { count: excellent, color: '#34d399', label: '≥80%' },
              { count: good,      color: '#60a5fa', label: '50–79%' },
              { count: low,       color: '#fbbf24', label: '<50%' },
            ].map(s => (
              <span key={s.label} title={s.label} style={{
                display: 'flex', alignItems: 'center', gap: 3,
                fontSize: 11, color: s.color, fontWeight: 600,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                {s.count}
              </span>
            ))}
          </div>

          {/* Plage de similarité — double slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Similarité</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-indigo)' }}>
                {minSim}% — {maxSim}%
              </span>
            </div>

            {/* Track */}
            <div style={{ position: 'relative', height: 20, marginBottom: 2 }}>
              <div style={{
                position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                left: 0, right: 0, height: 4, borderRadius: 2,
                background: 'var(--bg-elevated)',
              }} />
              {/* Colored fill between handles */}
              <div style={{
                position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                left: `${minSim}%`, width: `${maxSim - minSim}%`,
                height: 4, borderRadius: 2,
                background: 'linear-gradient(90deg, #fbbf24, #60a5fa, #34d399)',
                transition: 'left 0.08s, width 0.08s',
              }} />
              {/* Min thumb */}
              <input type="range" min={0} max={100} step={1} value={minSim}
                onChange={e => {
                  const v = Math.min(Number(e.target.value), maxSim)
                  setMinSim(v); apply(v, maxSim, maxCount)
                }}
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%',
                  opacity: 0, cursor: 'pointer', zIndex: minSim > 95 ? 3 : 2, margin: 0,
                }}
              />
              {/* Max thumb */}
              <input type="range" min={0} max={100} step={1} value={maxSim}
                onChange={e => {
                  const v = Math.max(Number(e.target.value), minSim)
                  setMaxSim(v); apply(minSim, v, maxCount)
                }}
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%',
                  opacity: 0, cursor: 'pointer', zIndex: 3, margin: 0,
                }}
              />
              {/* Visual min handle */}
              <div style={{
                position: 'absolute', top: '50%',
                left: `${minSim}%`, transform: 'translate(-50%, -50%)',
                width: 14, height: 14, borderRadius: '50%',
                background: '#fff', border: '2px solid #60a5fa',
                boxShadow: '0 1px 6px rgba(96,165,250,0.4)',
                pointerEvents: 'none', transition: 'left 0.08s',
              }} />
              {/* Visual max handle */}
              <div style={{
                position: 'absolute', top: '50%',
                left: `${maxSim}%`, transform: 'translate(-50%, -50%)',
                width: 14, height: 14, borderRadius: '50%',
                background: '#fff', border: '2px solid #34d399',
                boxShadow: '0 1px 6px rgba(52,211,153,0.4)',
                pointerEvents: 'none', transition: 'left 0.08s',
              }} />
            </div>
          </div>

          {/* Presets */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {PRESETS.map(p => {
              const active = minSim === p.min && maxSim === p.max
              return (
                <button key={p.label}
                  onClick={() => { setMinSim(p.min); setMaxSim(p.max); apply(p.min, p.max, maxCount) }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 8px',
                    fontSize: 10, fontWeight: 600,
                    borderRadius: 20,
                    cursor: 'pointer',
                    border: active ? `1px solid ${p.dot}` : '1px solid var(--border-subtle)',
                    background: active ? `${p.dot}18` : 'transparent',
                    color: active ? p.dot : 'var(--text-muted)',
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: p.dot, flexShrink: 0 }} />
                  {p.label}
                </button>
              )
            })}
          </div>

          {/* Max count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Max affiché</span>
            <input
              type="number" min={1} value={maxCount}
              onChange={e => { setMaxCount(e.target.value); apply(minSim, maxSim, e.target.value) }}
              placeholder="∞"
              style={{
                flex: 1, padding: '4px 8px', fontSize: 11,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6, color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
          </div>

          {/* Summary pill */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '5px 10px',
            background: 'var(--accent-indigo-bg)',
            borderRadius: 20,
            fontSize: 11, color: 'var(--accent-indigo)', fontWeight: 600,
          }}>
            {displayed} / {total} visibles
          </div>

        </div>
      )}
    </div>
  )
})

export default FilterPanel

