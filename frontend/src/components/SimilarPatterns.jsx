import React, { useState, useCallback, memo } from "react"
import { Clock, ChevronDown, Navigation, Award, Target, TrendingDown } from "lucide-react"

const VISIBLE_STEP = 20

function getRawColor(sim) {
  if (sim >= 80) return "#34d399"
  if (sim >= 50) return "#60a5fa"
  return "#fbbf24"
}

function getLabel(sim) {
  if (sim >= 80) return "Très similaire"
  if (sim >= 50) return "Similaire"
  return "Peu similaire"
}

function getIcon(sim) {
  if (sim >= 80) return Award
  if (sim >= 50) return Target
  return TrendingDown
}

function formatDate(d) {
  if (!d) return ""
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit"
  })
}

const MatchCard = memo(({ match, index, onNavigate }) => {
  const sim = match.similarity ?? 0
  const rawColor = getRawColor(sim)
  const Icon = getIcon(sim)

  const handleClick = useCallback(() => {
    onNavigate?.(match)
  }, [match, onNavigate])

  return (
    <div onClick={handleClick} className="glass-card-interactive" style={{
      minWidth: 190, flex: '0 0 190px',
      borderTop: `3px solid ${rawColor}`,
      cursor: 'pointer',
      animationDelay: `${index * 30}ms`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{
          fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', gap: 4
        }}>
          <Navigation size={11} /> #{index + 1}
        </span>
        <span className="badge" style={{ background: `${rawColor}22`, color: rawColor, fontWeight: 700 }}>
          {sim.toFixed(0)}%
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Icon size={14} style={{ color: rawColor }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{getLabel(sim)}</span>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={10} /> {formatDate(match.start)}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={10} /> {formatDate(match.end)}
        </span>
      </div>

      <div style={{
        fontSize: 10, color: 'var(--text-muted)', marginTop: 8,
        paddingTop: 6, borderTop: '1px solid var(--border-subtle)'
      }}>
        Score MASS : {match.score?.toFixed(2)}
      </div>
    </div>
  )
})

const SimilarPatterns = memo(({ matches, onNavigate }) => {
  const [visibleCount, setVisibleCount] = useState(VISIBLE_STEP)

  const handleShowMore = useCallback(() => {
    setVisibleCount(c => c + VISIBLE_STEP)
  }, [])

  if (!matches || !matches.length) {
    return (
      <div style={{
        padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13,
        borderRadius: 12, border: '2px dashed var(--border-subtle)', marginTop: 16,
      }}>
        <Navigation size={28} style={{ opacity: 0.3, margin: '0 auto 12px', display: 'block' }} />
        Sélectionnez une zone sur le graphe pour détecter les patterns similaires.
      </div>
    )
  }

  const visible = matches.slice(0, visibleCount)
  const hasMore = visibleCount < matches.length

  return (
    <div style={{ marginTop: 16 }} className="animate-in">
      <h3 style={{
        margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <Target size={16} style={{ color: 'var(--accent-indigo)' }} />
        Patterns similaires
        <span className="badge" style={{ background: 'var(--accent-indigo)', color: '#fff' }}>
          {matches.length}
        </span>
      </h3>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {visible.map((m, i) => (
          <MatchCard key={`${m.start}-${m.end}`} match={m} index={i} onNavigate={onNavigate} />
        ))}
      </div>

      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button className="btn" onClick={handleShowMore} style={{ gap: 6 }}>
            <ChevronDown size={14} />
            Afficher plus ({matches.length - visibleCount} restants)
          </button>
        </div>
      )}
    </div>
  )
})

export default SimilarPatterns
