import React, { useState, useCallback, memo } from "react"

// ─── Styles ───────────────────────────────────────────────────────────────────
const PANEL_STYLE = {
  position: "fixed",
  top: 80,
  right: 16,
  zIndex: 1000,
  width: 260,
  background: "#fff",
  border: "1px solid #dde",
  borderRadius: 10,
  boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
  fontFamily: "'Segoe UI', sans-serif",
  fontSize: 13,
  overflow: "hidden",
}

const HEADER_STYLE = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 14px",
  background: "#6c5ce7",
  color: "#fff",
  cursor: "pointer",
  userSelect: "none",
}

const BODY_STYLE = {
  padding: "14px 16px",
  display: "flex",
  flexDirection: "column",
  gap: 14,
}

const LABEL_STYLE = { fontWeight: 600, color: "#2d3436", marginBottom: 6, display: "block" }

const INPUT_STYLE = {
  width: "100%",
  padding: "5px 8px",
  borderRadius: 5,
  border: "1px solid #ccc",
  fontSize: 13,
  boxSizing: "border-box",
}

const STAT_STYLE = {
  background: "#f5f6fa",
  borderRadius: 6,
  padding: "6px 10px",
  fontSize: 11,
  color: "#636e72",
  lineHeight: 1.7,
}

const CATEGORY_COLORS = {
  all:       "#636e72",
  excellent: "#2ecc71",
  good:      "#3498db",
  low:       "#f39c12",
}

// ─── Composant ────────────────────────────────────────────────────────────────
const FilterPanel = memo(({ allMatches, onFilterChange }) => {
  const [open, setOpen] = useState(true)
  const [minSimilarity, setMinSimilarity] = useState(0)   // % minimum de similarité
  const [maxCount, setMaxCount] = useState("")            // nb max de rectangles ("" = tous)

  // Compteurs par catégorie (basés sur le filtre similarité en cours)
  const counts = {
    total:     allMatches.length,
    excellent: allMatches.filter(m => m.similarity >= 80).length,
    good:      allMatches.filter(m => m.similarity >= 50 && m.similarity < 80).length,
    low:       allMatches.filter(m => m.similarity < 50).length,
  }

  // Nombre de matches qui passent le filtre similarité
  const passFilter = allMatches.filter(m => m.similarity >= minSimilarity).length

  // Appliquer immédiatement dès qu'un contrôle change
  const apply = useCallback((sim, count) => {
    const filtered = allMatches
      .filter(m => m.similarity >= sim)
      .sort((a, b) => b.similarity - a.similarity)  // meilleurs en premier

    const limited = count && !isNaN(count) && parseInt(count) > 0
      ? filtered.slice(0, parseInt(count))
      : filtered

    onFilterChange(limited)
  }, [allMatches, onFilterChange])

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

  // Raccourci : cliquer une catégorie pré-remplit le filtre
  const applyPreset = useCallback((sim) => {
    setMinSimilarity(sim)
    setMaxCount("")
    apply(sim, "")
  }, [apply])

  if (allMatches.length === 0) return null

  return (
    <div style={PANEL_STYLE}>

      {/* ── Header cliquable ── */}
      <div style={HEADER_STYLE} onClick={() => setOpen(o => !o)}>
        <span>🎛️ Filtres d'affichage</span>
        <span style={{ fontSize: 16 }}>{open ? "▲" : "▼"}</span>
      </div>

      {/* ── Corps réductible ── */}
      {open && (
        <div style={BODY_STYLE}>

          {/* Stats globales */}
          <div style={STAT_STYLE}>
            <div><strong>{counts.total}</strong> patterns détectés au total</div>
            <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              <span style={{ color: CATEGORY_COLORS.excellent, cursor: "pointer", fontWeight: 600 }}
                onClick={() => applyPreset(80)}>
                ≥80% : {counts.excellent}
              </span>
              <span style={{ color: CATEGORY_COLORS.good, cursor: "pointer", fontWeight: 600 }}
                onClick={() => applyPreset(50)}>
                50–79% : {counts.good}
              </span>
              <span style={{ color: CATEGORY_COLORS.low, cursor: "pointer", fontWeight: 600 }}
                onClick={() => applyPreset(0)}>
                &lt;50% : {counts.low}
              </span>
            </div>
          </div>

          {/* Filtre similarité minimum */}
          <div>
            <label style={LABEL_STYLE}>
              Similarité minimum : <span style={{ color: "#6c5ce7" }}>{minSimilarity}%</span>
            </label>
            <input
              type="number"
              min={0} max={100} step={5}
              value={minSimilarity}
              onChange={handleSimilarityChange}
              style={INPUT_STYLE}
              placeholder="ex: 80"
            />
            <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
              → {passFilter} patterns passent ce seuil
            </div>
          </div>

          {/* Nombre max de rectangles */}
          <div>
            <label style={LABEL_STYLE}>
              Nb de rectangles à afficher
            </label>
            <input
              type="number"
              min={1}
              value={maxCount}
              onChange={handleCountChange}
              style={INPUT_STYLE}
              placeholder={`tous (${passFilter})`}
            />
            <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
              Laisse vide pour afficher tous les patterns filtrés.
              Les meilleurs scores sont priorisés.
            </div>
          </div>

          {/* Raccourcis rapides */}
          <div>
            <label style={{ ...LABEL_STYLE, marginBottom: 6 }}>Raccourcis</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                { label: "Top 10", sim: 0, count: "10" },
                { label: "Top 50", sim: 0, count: "50" },
                { label: "≥80%",   sim: 80, count: "" },
                { label: "≥50%",   sim: 50, count: "" },
                { label: "Tout",   sim: 0,  count: "" },
              ].map(({ label, sim, count }) => (
                <button key={label}
                  onClick={() => {
                    setMinSimilarity(sim)
                    setMaxCount(count)
                    apply(sim, count)
                  }}
                  style={{
                    padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                    border: "1px solid #6c5ce7", background: "#f3f0ff",
                    color: "#6c5ce7", cursor: "pointer"
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Résumé de la sélection active */}
          <div style={{ ...STAT_STYLE, background: "#f0f0ff", borderLeft: "3px solid #6c5ce7" }}>
            Affichage actuel :{" "}
            <strong style={{ color: "#6c5ce7" }}>
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
