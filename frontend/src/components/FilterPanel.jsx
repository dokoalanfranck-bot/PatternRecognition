import React, { useState, useCallback, useEffect, useRef, memo } from "react"
import { SlidersHorizontal, ChevronUp, ChevronDown } from "lucide-react"

const CATEGORY_COLORS = {
  excellent: "var(--accent-emerald)",
  good:      "var(--accent-blue)",
  low:       "var(--accent-amber)",
}

const FilterPanel = memo(({ allMatches, onFilterChange }) => {
  const [open, setOpen] = useState(true)
  const [minSimilarity, setMinSimilarity] = useState(80)
  const [maxCount, setMaxCount] = useState("50")
  const prevLenRef = useRef(0)

  const apply = useCallback((sim, count) => {
    const filtered = allMatches
      .filter(m => m.similarity >= sim)
      .sort((a, b) => b.similarity - a.similarity)
    const limited = count && !isNaN(count) && parseInt(count) > 0
      ? filtered.slice(0, parseInt(count))
      : filtered
    onFilterChange(limited)
  }, [allMatches, onFilterChange])

  useEffect(() => {
    if (allMatches.length > 0 && allMatches.length !== prevLenRef.current) {
      prevLenRef.current = allMatches.length
      setMinSimilarity(80)
      setMaxCount("50")
      apply(80, "50")
    }
  }, [allMatches, apply])

  const counts = {
    total:     allMatches.length,
    excellent: allMatches.filter(m => m.similarity >= 80).length,
    good:      allMatches.filter(m => m.similarity >= 50 && m.similarity < 80).length,
    low:       allMatches.filter(m => m.similarity < 50).length,
  }

  const passFilter = allMatches.filter(m => m.similarity >= minSimilarity).length

  const handleSimilarityChange = useCallback((e) => {
    const val = Math.min(100, Math.max(0, Number(e.target.value)))
    setMinSimilarity(val)
    apply(val, maxCount)
  }, [apply, maxCount])

  const handleCountChange = useCallback((e) => {
    const val = e.target.value
    setMaxCount(val)
    apply(minSimilarity, val)
  }, [apply, minSimilarity])

  const applyPreset = useCallback((sim) => {
    setMinSimilarity(sim)
    setMaxCount("")
    apply(sim, "")
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

          {/* Similarity slider */}
          <div>
            <label style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, display: 'block', fontSize: 12 }}>
              Similarité minimum : <span style={{ color: 'var(--accent-indigo)' }}>{minSimilarity}%</span>
            </label>
            <input type="range" min={0} max={100} step={1} value={minSimilarity} onChange={handleSimilarityChange} />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
              <input type="number" className="input" min={0} max={100} step={5}
                value={minSimilarity} onChange={handleSimilarityChange}
                style={{ width: 65, padding: '4px 8px', fontSize: 12 }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>→ {passFilter} patterns</span>
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
                { label: "Top 10", sim: 0, count: "10" },
                { label: "Top 50", sim: 0, count: "50" },
                { label: "≥80%",   sim: 80, count: "" },
                { label: "≥50%",   sim: 50, count: "" },
                { label: "Tout",   sim: 0,  count: "" },
              ].map(({ label, sim, count }) => (
                <button key={label} className="badge badge-indigo"
                  onClick={() => { setMinSimilarity(sim); setMaxCount(count); apply(sim, count) }}
                  style={{ cursor: 'pointer', border: '1px solid rgba(129,140,248,0.2)' }}
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
            {minSimilarity > 0 && <span> · seuil ≥{minSimilarity}%</span>}
          </div>
        </div>
      )}
    </div>
  )
})

export default FilterPanel
