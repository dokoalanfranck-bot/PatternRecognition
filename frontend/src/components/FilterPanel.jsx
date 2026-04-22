import React, { useState, useCallback, useEffect, useRef, memo } from "react"
import { SlidersHorizontal, ChevronUp, ChevronDown } from "lucide-react"

const CATEGORY_COLORS = {
  excellent: "var(--accent-emerald)",
  good:      "var(--accent-blue)",
  low:       "var(--accent-amber)",
}

const FilterPanel = memo(({ allMatches, onFilterChange }) => {
  const [open, setOpen] = useState(true)
  const [minSimilarity, setMinSimilarity] = useState(0)
  const [maxSimilarity, setMaxSimilarity] = useState(100)
  const [maxCount, setMaxCount] = useState("50")
  const prevLenRef = useRef(0)

  const apply = useCallback((minSim, maxSim, count) => {
    const filtered = allMatches
      .filter(m => (m.similarity ?? 0) >= minSim && (m.similarity ?? 0) <= maxSim)
      .sort((a, b) => b.similarity - a.similarity)
    const limited = count && !isNaN(count) && parseInt(count) > 0
      ? filtered.slice(0, parseInt(count))
      : filtered
    onFilterChange(limited)
  }, [allMatches, onFilterChange])

  useEffect(() => {
    if (allMatches.length > 0 && allMatches.length !== prevLenRef.current) {
      prevLenRef.current = allMatches.length
      setMinSimilarity(0)
      setMaxSimilarity(100)
      setMaxCount("50")
      apply(0, 100, "50")
    }
  }, [allMatches, apply])

  const counts = {
    total:     allMatches.length,
    excellent: allMatches.filter(m => (m.similarity ?? 0) >= 80).length,
    good:      allMatches.filter(m => (m.similarity ?? 0) >= 50 && (m.similarity ?? 0) < 80).length,
    low:       allMatches.filter(m => (m.similarity ?? 0) < 50).length,
  }

  const passFilter = allMatches.filter(m => {
    const sim = m.similarity ?? 0
    return sim >= minSimilarity && sim <= maxSimilarity
  }).length

  const handleSimilarityChange = useCallback((e) => {
    const val = Math.min(100, Math.max(0, Number(e.target.value)))
    setMinSimilarity(val)
    if (val > maxSimilarity) setMaxSimilarity(val)
    apply(val, Math.max(val, maxSimilarity), maxCount)
  }, [apply, maxCount, maxSimilarity])

  const handleMaxSimilarityChange = useCallback((e) => {
    const val = Math.min(100, Math.max(0, Number(e.target.value)))
    setMaxSimilarity(val)
    if (val < minSimilarity) setMinSimilarity(val)
    apply(Math.min(val, minSimilarity), val, maxCount)
  }, [apply, maxCount, minSimilarity])

  const handleCountChange = useCallback((e) => {
    const val = e.target.value
    setMaxCount(val)
    apply(minSimilarity, maxSimilarity, val)
  }, [apply, minSimilarity, maxSimilarity])

  const applyPreset = useCallback((minSim, maxSim) => {
    setMinSimilarity(minSim)
    setMaxSimilarity(maxSim)
    setMaxCount("")
    apply(minSim, maxSim, "")
  }, [apply])

  if (allMatches.length === 0) return null

  return (
    <div style={{
      position: 'fixed', top: 80, right: 16, zIndex: 1000,
      width: 272,
      background: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-xl)',
      overflow: 'hidden',
      animation: 'slideInRight 0.3s ease-out',
    }}>
      {/* Header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(129,140,248,0.08))',
          cursor: 'pointer', userSelect: 'none',
          borderBottom: open ? '1px solid var(--border-subtle)' : 'none',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', fontWeight: 600, fontSize: 13 }}>
          <SlidersHorizontal size={15} style={{ color: 'var(--accent-indigo)' }} />
          Filtres
        </span>
        {open ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
      </div>

      {/* Body */}
      {open && (
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Global stats */}
          <div style={{
            background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)',
            padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7,
          }}>
            <div><strong style={{ color: 'var(--text-primary)' }}>{counts.total}</strong> patterns détectés</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
              {[
                { label: '≥80%', count: counts.excellent, color: CATEGORY_COLORS.excellent, sim: 80 },
                { label: '50–79%', count: counts.good, color: CATEGORY_COLORS.good, sim: 50 },
                { label: '<50%', count: counts.low, color: CATEGORY_COLORS.low, sim: 0 },
              ].map(c => (
                <span key={c.label}
                  onClick={() => applyPreset(c.sim)}
                  style={{ color: c.color, cursor: 'pointer', fontWeight: 600, fontSize: 11 }}>
                  {c.label}: {c.count}
                </span>
              ))}
            </div>
          </div>

          {/* Bandes de couleur avec intervalle */}
          <div>
            <label style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, display: 'block', fontSize: 12 }}>
              Intervalle de similarité
            </label>
            
            {/* Bandes colorées */}
            <div style={{ display: 'flex', gap: 1, height: 28, borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
              {[
                { min: 0, max: 30, color: '#ef4444', label: 'Très peu' },
                { min: 30, max: 50, color: '#f97316', label: 'Peu' },
                { min: 50, max: 70, color: '#fbbf24', label: 'Moyen' },
                { min: 70, max: 85, color: '#60a5fa', label: 'Bien' },
                { min: 85, max: 100, color: '#34d399', label: 'Très bien' },
              ].map((band) => {
                const isInRange = minSimilarity <= band.max && maxSimilarity >= band.min
                return (
                  <div
                    key={`${band.min}-${band.max}`}
                    onClick={() => applyPreset(band.min, band.max)}
                    style={{
                      flex: 1,
                      background: band.color,
                      opacity: isInRange ? 1 : 0.2,
                      transition: 'opacity 0.2s ease',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                    }}
                    title={`${band.label}: ${band.min}%-${band.max}%`}
                  >
                    <span style={{
                      fontSize: 8,
                      color: '#fff',
                      fontWeight: 700,
                      textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                      pointerEvents: 'none',
                    }}>
                      {band.min}%
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Sliders pour min et max */}
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Min: <span style={{ color: 'var(--accent-indigo)', fontWeight: 700 }}>{minSimilarity}%</span>
                </label>
                <input type="range" min={0} max={100} step={1} value={minSimilarity} onChange={handleSimilarityChange}
                  style={{ width: '100%', height: 5, borderRadius: 3, background: 'linear-gradient(90deg, #ef4444, #34d399)', outline: 'none' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Max: <span style={{ color: 'var(--accent-indigo)', fontWeight: 700 }}>{maxSimilarity}%</span>
                </label>
                <input type="range" min={0} max={100} step={1} value={maxSimilarity} onChange={handleMaxSimilarityChange}
                  style={{ width: '100%', height: 5, borderRadius: 3, background: 'linear-gradient(90deg, #ef4444, #34d399)', outline: 'none' }}
                />
              </div>
            </div>
          </div>

          {/* Max count */}
          <div>
            <label style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, display: 'block', fontSize: 12 }}>
              Nb rectangles max
            </label>
            <input type="number" className="input" min={1} value={maxCount} onChange={handleCountChange}
              placeholder={`tous (${passFilter})`} style={{ fontSize: 12 }}
            />
          </div>

          {/* Quick presets */}
          <div>
            <label style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, display: 'block', fontSize: 12 }}>Raccourcis</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { label: "Très bien", minSim: 85, maxSim: 100, count: "" },
                { label: "Bien", minSim: 70, maxSim: 85, count: "" },
                { label: "Moyen", minSim: 50, maxSim: 70, count: "" },
                { label: "Tous", minSim: 0, maxSim: 100, count: "" },
              ].map(({ label, minSim, maxSim, count }) => (
                <button key={label} className="badge badge-indigo"
                  onClick={() => { setMinSimilarity(minSim); setMaxSimilarity(maxSim); setMaxCount(count); apply(minSim, maxSim, count) }}
                  style={{ cursor: 'pointer', border: '1px solid rgba(129,140,248,0.2)', fontSize: 10 }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div style={{
            background: 'var(--accent-indigo-bg)',
            borderLeft: '3px solid var(--accent-indigo)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px 12px', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7,
          }}>
            Affichage :{" "}
            <strong style={{ color: 'var(--accent-indigo)' }}>
              {maxCount && parseInt(maxCount) > 0
                ? `${Math.min(parseInt(maxCount), passFilter)} / ${passFilter}`
                : passFilter}{" "}
              rectangles
            </strong>
            {(minSimilarity > 0 || maxSimilarity < 100) && 
              <span> · plage {minSimilarity}%—{maxSimilarity}%</span>
            }
          </div>
        </div>
      )}
    </div>
  )
})

export default FilterPanel
