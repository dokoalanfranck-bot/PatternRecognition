import React, { useState, useEffect, useCallback, memo } from "react"
import { fetchData, computeAllScores } from "./api/api"
import EnergyGraph from "./components/EnergyGraph"
import SimilarPatterns from "./components/SimilarPatterns"
import ScoreDistribution from "./components/ScoreDistribution"
import MonitoringPanel from "./components/MonitoringPanel"

// ─── Styles stables hors du composant ───────────────────────────────────────
const CONTAINER_STYLE = {
  fontFamily: "'Segoe UI', sans-serif",
  padding: "0 24px 24px",
  maxWidth: 1400,
  margin: "0 auto"
}
const HEADER_STYLE = {
  padding: "16px 0 8px",
  borderBottom: "1px solid #eee",
  marginBottom: 16
}
const NAV_BAR_STYLE = {
  display: "flex", alignItems: "center", gap: 12,
  marginBottom: 16, padding: "8px 12px",
  background: "#f5f6fa", borderRadius: 6, fontSize: 13
}
const NAV_BTN_STYLE = {
  padding: "6px 12px", borderRadius: 4,
  border: "1px solid #ddd", background: "#fff"
}
const SCORE_BTN_BASE = {
  padding: "8px 20px", borderRadius: 6,
  border: "2px solid #6c5ce7", fontSize: 13,
  fontWeight: 600, transition: "all 0.2s"
}

// ─── Sous-composant barre de navigation mémoïsé ──────────────────────────────
const NavBar = memo(({ page, pageInfo, loading, onPrev, onNext, onGoto }) => (
  <div style={NAV_BAR_STYLE}>
    <button
      onClick={onPrev}
      disabled={page === 0 || loading}
      style={{ ...NAV_BTN_STYLE, cursor: page === 0 || loading ? "not-allowed" : "pointer" }}
    >
      ◀ Précédent
    </button>

    <span style={{ fontWeight: 600, color: "#2d3436" }}>
      Page {page + 1} / {pageInfo.total_pages}
    </span>

    <button
      onClick={onNext}
      disabled={page >= pageInfo.total_pages - 1 || loading}
      style={{ ...NAV_BTN_STYLE, cursor: page >= pageInfo.total_pages - 1 || loading ? "not-allowed" : "pointer" }}
    >
      Suivant ▶
    </button>

    <span style={{ color: "#aaa", fontSize: 11 }}>|</span>

    <label style={{ fontSize: 12, color: "#555" }}>
      Aller à :
      <input
        type="number"
        min={1}
        max={pageInfo.total_pages}
        defaultValue={page + 1}
        key={page}
        onKeyDown={e => {
          if (e.key === "Enter") {
            const v = Math.max(0, Math.min(pageInfo.total_pages - 1, parseInt(e.target.value, 10) - 1))
            if (!isNaN(v)) onGoto(v)
          }
        }}
        style={{
          width: 50, marginLeft: 6, padding: "3px 6px",
          borderRadius: 4, border: "1px solid #ddd",
          fontSize: 12, textAlign: "center"
        }}
      />
    </label>

    <span style={{ marginLeft: "auto", color: "#666" }}>
      {loading ? "⏳ Chargement..." : `${pageInfo.total_points.toLocaleString()} points au total`}
    </span>
  </div>
))

// ─── Sous-composant bouton scores mémoïsé ────────────────────────────────────
const ScoreButton = memo(({ scoreBusy, onClick }) => (
  <div style={{ margin: "12px 0", textAlign: "center" }}>
    <button
      onClick={onClick}
      disabled={scoreBusy}
      style={{
        ...SCORE_BTN_BASE,
        background: scoreBusy ? "#dfe6e9" : "#6c5ce7",
        color: scoreBusy ? "#636e72" : "#fff",
        cursor: scoreBusy ? "wait" : "pointer"
      }}
    >
      {scoreBusy ? "⏳ Calcul en cours..." : "📊 Calculer la distribution des scores"}
    </button>
    <p style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
      Compare le pattern sélectionné à 1000 sous-séquences (distance euclidienne — instantané)
    </p>
  </div>
))

// ─── App principale ──────────────────────────────────────────────────────────
function App() {
  const [data, setData] = useState([])
  const [matches, setMatches] = useState([])
  const [allScores, setAllScores] = useState([])
  const [monitoring, setMonitoring] = useState(null)
  const [focusedMatch, setFocusedMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [pageInfo, setPageInfo] = useState(null)
  const [scoreBusy, setScoreBusy] = useState(false)
  const [lastSelection, setLastSelection] = useState(null)

  // ✅ Chargement des données paginées
  useEffect(() => {
    setLoading(true)
    fetchData(page, 50000)
      .then(res => {
        setData(res.points)
        setPageInfo(res)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [page])

  // ✅ handleMonitoring stable — ne recrée pas de référence à chaque render
  const handleMonitoring = useCallback((m) => {
    setMonitoring(m)
    if (m?.pattern_info) {
      setLastSelection({ start: m.pattern_info.start, end: m.pattern_info.end })
    }
    setAllScores([])
  }, [])

  // ✅ handleComputeScores stable
  const handleComputeScores = useCallback(async () => {
    if (!lastSelection) return
    setScoreBusy(true)
    try {
      const r = await computeAllScores(lastSelection.start, lastSelection.end, 1000)
      setAllScores(r.scores || [])
    } catch {}
    setScoreBusy(false)
  }, [lastSelection])

  // ✅ Handlers de navigation stables
  const handlePrev = useCallback(() => setPage(p => Math.max(0, p - 1)), [])
  const handleNext = useCallback(() => setPage(p => p + 1), [])
  const handleGoto = useCallback((v) => setPage(v), [])

  const showScoreButton = matches.length > 0 && allScores.length === 0

  return (
    <div style={CONTAINER_STYLE}>

      <header style={HEADER_STYLE}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "#2d3436" }}>
          Détection de Patterns Énergétiques
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888" }}>
          {loading ? "Chargement..." : `${data.length.toLocaleString()} points chargés`}
        </p>
      </header>

      {/* ✅ NavBar mémoïsée — ne re-render pas quand matches/scores changent */}
      {pageInfo && (
        <NavBar
          page={page}
          pageInfo={pageInfo}
          loading={loading}
          onPrev={handlePrev}
          onNext={handleNext}
          onGoto={handleGoto}
        />
      )}

      {/* ✅ EnergyGraph — reçoit allScores séparément pour les overlays */}
      <EnergyGraph
        data={data}
        setMatches={setMatches}
        setAllScores={setAllScores}
        allScores={allScores}
        setMonitoring={handleMonitoring}
        focusedMatch={focusedMatch}
      />

      {/* ✅ MonitoringPanel — ne re-render que si monitoring change */}
      <MonitoringPanel monitoring={monitoring} />

      {/* ✅ Bouton scores — composant isolé, ne pollue pas les autres */}
      {showScoreButton && (
        <ScoreButton scoreBusy={scoreBusy} onClick={handleComputeScores} />
      )}

      {/* ✅ ScoreDistribution — ne re-render que si allScores ou matches changent */}
      <ScoreDistribution allScores={allScores} matches={matches} />

      {/* ✅ SimilarPatterns — ne re-render que si matches change */}
      <SimilarPatterns matches={matches} onNavigate={setFocusedMatch} />

    </div>
  )
}

export default App
