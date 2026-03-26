import React, { useState, useCallback, memo } from "react"

const VISIBLE_STEP = 20

// ─── Helpers stables hors du composant ───────────────────────────────────────
function getColor(sim) {
  if (sim >= 80) return "#2ecc71"
  if (sim >= 50) return "#3498db"
  return "#f39c12"
}

function getLabel(sim) {
  if (sim >= 80) return "Très similaire"
  if (sim >= 50) return "Similaire"
  return "Peu similaire"
}

function formatDate(d) {
  if (!d) return ""
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit"
  })
}

// ─── Carte d'un match — mémoïsée individuellement ────────────────────────────
// Évite de re-render toutes les cartes quand visibleCount change
const MatchCard = memo(({ match, index, onNavigate }) => {
  const sim = match.similarity ?? 0
  const color = getColor(sim)

  const handleMouseEnter = useCallback(e => {
    e.currentTarget.style.transform = "translateY(-2px)"
  }, [])
  const handleMouseLeave = useCallback(e => {
    e.currentTarget.style.transform = "none"
  }, [])
  const handleClick = useCallback(() => {
    onNavigate?.(match)
  }, [match, onNavigate])

  return (
    <div
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        border: `2px solid ${color}`,
        borderRadius: 8,
        padding: "10px 14px",
        minWidth: 180,
        backgroundColor: `${color}10`,
        cursor: "pointer",
        transition: "transform 0.15s",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <strong style={{ fontSize: 14 }}>#{index + 1}</strong>
        <span style={{
          backgroundColor: color, color: "#fff",
          borderRadius: 10, padding: "1px 8px",
          fontSize: 12, fontWeight: 700
        }}>
          {sim.toFixed(0)}%
        </span>
      </div>

      <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{getLabel(sim)}</div>

      <div style={{ fontSize: 11, color: "#555" }}>
        <div>{formatDate(match.start)}</div>
        <div>{formatDate(match.end)}</div>
      </div>

      <div style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>
        Score MASS : {match.score?.toFixed(2)}
      </div>
    </div>
  )
})

// ─── Composant principal mémoïsé ─────────────────────────────────────────────
const SimilarPatterns = memo(({ matches, onNavigate }) => {
  const [visibleCount, setVisibleCount] = useState(VISIBLE_STEP)

  const handleShowMore = useCallback(() => {
    setVisibleCount(c => c + VISIBLE_STEP)
  }, [])

  if (!matches || !matches.length) {
    return (
      <div style={{ padding: "20px 0", textAlign: "center", color: "#aaa", fontSize: 13 }}>
        Sélectionnez une zone sur le graphe pour détecter les patterns similaires.
      </div>
    )
  }

  const visible = matches.slice(0, visibleCount)
  const hasMore = visibleCount < matches.length

  return (
    <div style={{ marginTop: 16 }}>
      <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 600, color: "#2d3436" }}>
        Patterns similaires ({matches.length})
      </h3>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {visible.map((m, i) => (
          <MatchCard
            key={`${m.start}-${m.end}`}
            match={m}
            index={i}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      {hasMore && (
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button
            onClick={handleShowMore}
            style={{
              padding: "6px 20px", borderRadius: 6,
              border: "1px solid #ddd", background: "#fff",
              cursor: "pointer", fontSize: 12,
              fontWeight: 600, color: "#0984e3"
            }}
          >
            Afficher plus ({matches.length - visibleCount} restants)
          </button>
        </div>
      )}
    </div>
  )
})

export default SimilarPatterns
