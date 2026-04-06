import React, { useState, useEffect, useCallback, memo } from "react"
import { fetchData, computeAllScores } from "./api/api"
import { Activity, ChevronLeft, ChevronRight, BarChart3, BookOpen, Radio, ArrowLeft, Loader } from "lucide-react"
import EnergyGraph from "./components/EnergyGraph"
import SimilarPatterns from "./components/SimilarPatterns"
import ScoreDistribution from "./components/ScoreDistribution"
import MonitoringPanel from "./components/MonitoringPanel"
import PatternLibrary from "./components/PatternLibrary"
import RealtimeMonitor from "./components/RealtimeMonitor"
import DatasetSelector from "./components/DatasetSelector"
import "./App.css"

const NavBar = memo(({ page, pageInfo, loading, onPrev, onNext, onGoto }) => (
  <div className="nav-bar animate-in">
    <button className="btn btn-sm" onClick={onPrev} disabled={page === 0 || loading}>
      <ChevronLeft size={14} /> Précédent
    </button>
    <span className="page-info">
      Page {page + 1} / {pageInfo.total_pages}
    </span>
    <button className="btn btn-sm" onClick={onNext} disabled={page >= pageInfo.total_pages - 1 || loading}>
      Suivant <ChevronRight size={14} />
    </button>
    <span style={{ color: 'var(--border-default)' }}>|</span>
    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
      Aller à :
      <input type="number" min={1} max={pageInfo.total_pages}
        defaultValue={page + 1} key={page}
        onKeyDown={e => {
          if (e.key === "Enter") {
            const v = Math.max(0, Math.min(pageInfo.total_pages - 1, parseInt(e.target.value, 10) - 1))
            if (!isNaN(v)) onGoto(v)
          }
        }}
      />
    </label>
    <span className="total-info">
      {loading ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Loader size={12} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
          Chargement…
        </span>
      ) : (
        `${pageInfo.total_points.toLocaleString()} points au total`
      )}
    </span>
  </div>
))

function App() {
  const [dataset, setDataset] = useState(null)
  const [data, setData] = useState([])
  const [matches, setMatches] = useState([])
  const [allScores, setAllScores] = useState([])
  const [monitoring, setMonitoring] = useState(null)
  const [focusedMatch, setFocusedMatch] = useState(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [pageInfo, setPageInfo] = useState(null)
  const [scoreBusy, setScoreBusy] = useState(false)
  const [lastSelection, setLastSelection] = useState(null)
  const [tab, setTab] = useState("analyse")
  const [libRefresh, setLibRefresh] = useState(0)

  useEffect(() => {
    if (!dataset) return
    setLoading(true)
    fetchData(page, 50000, dataset)
      .then(res => { setData(res.points); setPageInfo(res); setLoading(false) })
      .catch(() => setLoading(false))
  }, [page, dataset])

  const handleMonitoring = useCallback((m) => {
    setMonitoring(m)
    if (m?.pattern_info) setLastSelection({ start: m.pattern_info.start, end: m.pattern_info.end })
    setAllScores([])
  }, [])

  const handleComputeScores = useCallback(async () => {
    if (!lastSelection) return
    setScoreBusy(true)
    try {
      const r = await computeAllScores(lastSelection.start, lastSelection.end, 1000, dataset)
      setAllScores(r.scores || [])
    } catch {}
    setScoreBusy(false)
  }, [lastSelection, dataset])

  const handlePatternSaved = useCallback(() => { setLibRefresh(k => k + 1) }, [])

  const handleSelectDataset = useCallback((filename) => {
    setDataset(filename)
    setPage(0)
    setData([])
    setMatches([])
    setAllScores([])
    setMonitoring(null)
    setPageInfo(null)
    setTab("analyse")
  }, [])

  const handleBackToSelector = useCallback(() => {
    setDataset(null)
    setData([])
    setMatches([])
    setAllScores([])
    setMonitoring(null)
    setPageInfo(null)
  }, [])

  const showScoreButton = matches.length > 0 && allScores.length === 0

  if (!dataset) {
    return <DatasetSelector onSelect={handleSelectDataset} />
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* ── Top Bar ── */}
      <div className="topbar">
        <button className="btn btn-ghost" onClick={handleBackToSelector} style={{ gap: 6 }}>
          <ArrowLeft size={16} /> Datasets
        </button>
        <div className="topbar-divider" />
        <div className="topbar-logo">
          <Activity size={20} />
          Pattern Recognition
        </div>
        <span className="topbar-dataset">{dataset}</span>

        <div className="tab-pills">
          <button className={`tab-pill ${tab === "analyse" ? "active" : ""}`}
            onClick={() => setTab("analyse")}>
            <BarChart3 size={14} /> Analyse
          </button>
          <button className={`tab-pill ${tab === "library" ? "active" : ""}`}
            onClick={() => setTab("library")}>
            <BookOpen size={14} /> Bibliothèque
          </button>
          <button className={`tab-pill ${tab === "realtime" ? "active" : ""}`}
            onClick={() => setTab("realtime")}>
            <Radio size={14} /> Temps Réel
          </button>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '20px 24px 40px' }}>
        {tab === "analyse" && (
          <div className="animate-in">
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
              dataset={dataset}
            />

            <MonitoringPanel
              monitoring={monitoring}
              matchCount={matches.length}
              onPatternSaved={handlePatternSaved}
              dataset={dataset}
            />

            {showScoreButton && (
              <div style={{ margin: '16px 0', textAlign: 'center' }}>
                <button className="btn btn-primary btn-lg" onClick={handleComputeScores}
                  disabled={scoreBusy} style={{ minWidth: 280 }}>
                  {scoreBusy ? (
                    <>
                      <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                      Calcul en cours…
                    </>
                  ) : (
                    "Calculer la distribution des scores"
                  )}
                </button>
              </div>
            )}

            <ScoreDistribution allScores={allScores} matches={matches} />
            <SimilarPatterns matches={matches} onNavigate={setFocusedMatch} />
          </div>
        )}

        {tab === "library" && (
          <div className="animate-in">
            <PatternLibrary refreshKey={libRefresh} />
          </div>
        )}

        {tab === "realtime" && (
          <div className="animate-in">
            <RealtimeMonitor dataset={dataset} />
          </div>
        )}
      </div>
    </div>
  )
}

export default App
