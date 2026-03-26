import React, { useState, useEffect, useCallback, memo } from "react"
import { fetchData, computeAllScores } from "./api/api"
import EnergyGraph from "./components/EnergyGraph"
import SimilarPatterns from "./components/SimilarPatterns"
import ScoreDistribution from "./components/ScoreDistribution"
import MonitoringPanel from "./components/MonitoringPanel"
import PatternLibrary from "./components/PatternLibrary"
import "./App.css"

const CONTAINER = {
  fontFamily: "'Segoe UI', sans-serif",
  padding: "0 24px 24px",
  maxWidth: 1400,
  margin: "0 auto"
}
const HEADER = { padding: "16px 0 8px", borderBottom: "1px solid #eee", marginBottom: 16 }
const NAV = {
  display: "flex", alignItems: "center", gap: 12,
  marginBottom: 16, padding: "8px 12px",
  background: "#f5f6fa", borderRadius: 6, fontSize: 13
}
const NAV_BTN = {
  padding: "6px 12px", borderRadius: 4,
  border: "1px solid #ddd", background: "#fff"
}
const TABS = {
  display: "flex", gap: 0, marginBottom: 16,
  borderBottom: "2px solid #eee"
}

function tabStyle(active) {
  return {
    padding: "10px 24px", cursor: "pointer", fontWeight: 600, fontSize: 13,
    border: "none", background: "none",
    borderBottom: active ? "3px solid #0984e3" : "3px solid transparent",
    color: active ? "#0984e3" : "#888",
    transition: "all 0.2s"
  }
}

const NavBar = memo(({ page, pageInfo, loading, onPrev, onNext, onGoto }) => (
  <div style={NAV}>
    <button onClick={onPrev} disabled={page === 0 || loading}
      style={{ ...NAV_BTN, cursor: page === 0 || loading ? "not-allowed" : "pointer" }}>
      Precedent
    </button>
    <span style={{ fontWeight: 600, color: "#2d3436" }}>
      Page {page + 1} / {pageInfo.total_pages}
    </span>
    <button onClick={onNext} disabled={page >= pageInfo.total_pages - 1 || loading}
      style={{ ...NAV_BTN, cursor: page >= pageInfo.total_pages - 1 || loading ? "not-allowed" : "pointer" }}>
      Suivant
    </button>
    <span style={{ color: "#aaa", fontSize: 11 }}>|</span>
    <label style={{ fontSize: 12, color: "#555" }}>
      Aller a :
      <input type="number" min={1} max={pageInfo.total_pages}
        defaultValue={page + 1} key={page}
        onKeyDown={e => {
          if (e.key === "Enter") {
            const v = Math.max(0, Math.min(pageInfo.total_pages - 1, parseInt(e.target.value, 10) - 1))
            if (!isNaN(v)) onGoto(v)
          }
        }}
        style={{
          width: 50, marginLeft: 6, padding: "3px 6px",
          borderRadius: 4, border: "1px solid #ddd", fontSize: 12, textAlign: "center"
        }}
      />
    </label>
    <span style={{ marginLeft: "auto", color: "#666" }}>
      {loading ? "Chargement..." : `${pageInfo.total_points.toLocaleString()} points au total`}
    </span>
  </div>
))

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
  const [tab, setTab] = useState("analyse")
  const [libRefresh, setLibRefresh] = useState(0)

  useEffect(() => {
    setLoading(true)
    fetchData(page, 50000)
      .then(res => { setData(res.points); setPageInfo(res); setLoading(false) })
      .catch(() => setLoading(false))
  }, [page])

  const handleMonitoring = useCallback((m) => {
    setMonitoring(m)
    if (m?.pattern_info) setLastSelection({ start: m.pattern_info.start, end: m.pattern_info.end })
    setAllScores([])
  }, [])

  const handleComputeScores = useCallback(async () => {
    if (!lastSelection) return
    setScoreBusy(true)
    try {
      const r = await computeAllScores(lastSelection.start, lastSelection.end, 1000)
      setAllScores(r.scores || [])
    } catch {}
    setScoreBusy(false)
  }, [lastSelection])

  const handlePatternSaved = useCallback(() => {
    setLibRefresh(k => k + 1)
  }, [])

  const showScoreButton = matches.length > 0 && allScores.length === 0

  return (
    <div style={CONTAINER}>
      <header style={HEADER}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "#2d3436" }}>
          Detection de Patterns Energetiques
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888" }}>
          Analysez les motifs, sauvegardez les meilleurs, comparez en temps reel
        </p>
      </header>

      {/* Tabs */}
      <div style={TABS}>
        <button style={tabStyle(tab === "analyse")} onClick={() => setTab("analyse")}>
          Analyse
        </button>
        <button style={tabStyle(tab === "library")} onClick={() => setTab("library")}>
          Bibliotheque ({libRefresh >= 0 ? "" : ""})
        </button>
      </div>

      {tab === "analyse" && (
        <>
          {pageInfo && (
            <NavBar page={page} pageInfo={pageInfo} loading={loading}
              onPrev={() => setPage(p => Math.max(0, p - 1))}
              onNext={() => setPage(p => p + 1)}
              onGoto={setPage}
            />
          )}

          <EnergyGraph
            data={data}
            setMatches={setMatches}
            setMonitoring={handleMonitoring}
            focusedMatch={focusedMatch}
          />

          <MonitoringPanel
            monitoring={monitoring}
            matchCount={matches.length}
            onPatternSaved={handlePatternSaved}
          />

          {showScoreButton && (
            <div style={{ margin: "12px 0", textAlign: "center" }}>
              <button onClick={handleComputeScores} disabled={scoreBusy}
                style={{
                  padding: "8px 20px", borderRadius: 6,
                  border: "2px solid #6c5ce7", fontSize: 13, fontWeight: 600,
                  background: scoreBusy ? "#dfe6e9" : "#6c5ce7",
                  color: scoreBusy ? "#636e72" : "#fff",
                  cursor: scoreBusy ? "wait" : "pointer"
                }}>
                {scoreBusy ? "Calcul en cours..." : "Calculer la distribution des scores"}
              </button>
            </div>
          )}

          <ScoreDistribution allScores={allScores} matches={matches} />
          <SimilarPatterns matches={matches} onNavigate={setFocusedMatch} />
        </>
      )}

      {tab === "library" && (
        <PatternLibrary refreshKey={libRefresh} />
      )}
    </div>
  )
}

export default App
