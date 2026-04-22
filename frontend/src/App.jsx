import React, { useState, useEffect, useCallback, memo } from "react"
import { fetchData, fetchDataRange, computeAllScores } from "./api/api"
import { Activity, ChevronLeft, ChevronRight, BarChart3, BookOpen, Radio, ArrowLeft, Loader, Calendar, Search } from "lucide-react"
import EnergyGraph from "./components/EnergyGraph"
import SimilarPatterns from "./components/SimilarPatterns"
import ScoreDistribution from "./components/ScoreDistribution"
import MonitoringPanel from "./components/MonitoringPanel"
import PatternLibrary from "./components/PatternLibrary"
import RealtimeMonitor from "./components/RealtimeMonitor"
import DatasetSelector from "./components/DatasetSelector"
import "./App.css"

const PERIODS = [
  { key: "day",   label: "Jour" },
  { key: "week",  label: "Semaine" },
  { key: "month", label: "Mois" },
  { key: "year",  label: "Année" },
  { key: "custom", label: "Personnalisé" },
]

const MONTH_NAMES = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre"
]

function formatPeriodLabel(period, info) {
  if (!info?.current_start) return ""
  const d = new Date(info.current_start)
  if (period === "day") {
    return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  }
  if (period === "week") {
    const end = new Date(info.current_end)
    end.setDate(end.getDate() - 1)
    const fmt = (dt) => dt.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
    return `${fmt(d)} — ${fmt(end)} ${end.getFullYear()}`
  }
  if (period === "month") {
    return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
  }
  if (period === "year") {
    return `${d.getFullYear()}`
  }
  return ""
}

const NavBar = memo(({ period, offset, periodInfo, loading, onPrev, onNext, onPeriodChange,
  customStart, customEnd, onCustomStartChange, onCustomEndChange, onCustomSearch, dataRange }) => (
  <div className="nav-bar animate-in">
    <div className="period-selector">
      {PERIODS.map(p => (
        <button key={p.key}
          className={`period-btn ${period === p.key ? "active" : ""}`}
          onClick={() => onPeriodChange(p.key)}>
          {p.label}
        </button>
      ))}
    </div>

    {period !== "custom" ? (
      <>
        <div className="period-nav">
          <button className="btn btn-sm" onClick={onPrev} disabled={offset === 0 || loading}>
            <ChevronLeft size={14} />
          </button>
          <span className="period-label">
            <Calendar size={13} style={{ opacity: 0.5 }} />
            {formatPeriodLabel(period, periodInfo)}
          </span>
          <button className="btn btn-sm" onClick={onNext}
            disabled={offset >= (periodInfo?.total_periods ?? 1) - 1 || loading}>
            <ChevronRight size={14} />
          </button>
        </div>
      </>
    ) : (
      <div className="custom-range">
        <label className="range-field">
          <span>Du</span>
          <input type="date" value={customStart}
            min={dataRange?.min_date?.slice(0, 10)}
            max={dataRange?.max_date?.slice(0, 10)}
            onChange={e => onCustomStartChange(e.target.value)} />
        </label>
        <label className="range-field">
          <span>Au</span>
          <input type="date" value={customEnd}
            min={dataRange?.min_date?.slice(0, 10)}
            max={dataRange?.max_date?.slice(0, 10)}
            onChange={e => onCustomEndChange(e.target.value)} />
        </label>
        <button className="btn btn-primary btn-sm" onClick={onCustomSearch}
          disabled={!customStart || !customEnd || loading}>
          <Search size={13} /> Afficher
        </button>
      </div>
    )}

    <span className="total-info">
      {loading ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Loader size={12} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
          Chargement…
        </span>
      ) : (
        `${(periodInfo?.period_points ?? 0).toLocaleString()} points`
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
  const [period, setPeriod] = useState("month")
  const [offset, setOffset] = useState(0)
  const [periodInfo, setPeriodInfo] = useState(null)
  const [scoreBusy, setScoreBusy] = useState(false)
  const [lastSelection, setLastSelection] = useState(null)
  const [tab, setTab] = useState("analyse")
  const [libRefresh, setLibRefresh] = useState(0)
  const [filterMin, setFilterMin] = useState(0)
  const [filterMax, setFilterMax] = useState(100)
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")
  const [dataRange, setDataRange] = useState(null)
  const [customTrigger, setCustomTrigger] = useState(0)

  // Fetch date range when dataset changes
  useEffect(() => {
    if (!dataset) return
    fetchDataRange(dataset).then(setDataRange).catch(() => {})
  }, [dataset])

  useEffect(() => {
    if (!dataset) return
    if (period === "custom") return  // custom is triggered manually
    setLoading(true)
    fetchData(period, offset, dataset)
      .then(res => { setData(res.points); setPeriodInfo(res); setLoading(false) })
      .catch(() => setLoading(false))
  }, [period, offset, dataset])

  // Custom range fetch
  useEffect(() => {
    if (!dataset || period !== "custom" || !customStart || !customEnd || customTrigger === 0) return
    setLoading(true)
    fetchData("custom", 0, dataset, customStart, customEnd)
      .then(res => { setData(res.points); setPeriodInfo(res); setLoading(false) })
      .catch(() => setLoading(false))
  }, [customTrigger])  // eslint-disable-line react-hooks/exhaustive-deps

  const handleCustomSearch = useCallback(() => {
    if (customStart && customEnd) setCustomTrigger(t => t + 1)
  }, [customStart, customEnd])

  const handleMonitoring = useCallback((m) => {
    setMonitoring(m)
    if (m?.pattern_info) setLastSelection({ start: m.pattern_info.start, end: m.pattern_info.end })
    setAllScores([])
    setFilterMin(0)
    setFilterMax(100)
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

  const handleFilterChange = useCallback((range) => {
    setFilterMin(range.min)
    setFilterMax(range.max)
  }, [])

  const handleSelectDataset = useCallback((filename) => {
    setDataset(filename)
    setPeriod("month")
    setOffset(0)
    setData([])
    setMatches([])
    setAllScores([])
    setMonitoring(null)
    setPeriodInfo(null)
    setTab("analyse")
    setFilterMin(0)
    setFilterMax(100)
  }, [])

  const handleBackToSelector = useCallback(() => {
    setDataset(null)
    setData([])
    setMatches([])
    setAllScores([])
    setMonitoring(null)
    setPeriodInfo(null)
    setFilterMin(0)
    setFilterMax(100)
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
            {(periodInfo || period === "custom") && (
              <NavBar period={period} offset={offset} periodInfo={periodInfo} loading={loading}
                onPrev={() => setOffset(o => Math.max(0, o - 1))}
                onNext={() => setOffset(o => o + 1)}
                onPeriodChange={(p) => { setPeriod(p); setOffset(0) }}
                customStart={customStart} customEnd={customEnd}
                onCustomStartChange={setCustomStart} onCustomEndChange={setCustomEnd}
                onCustomSearch={handleCustomSearch} dataRange={dataRange}
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
            <SimilarPatterns matches={matches} onNavigate={setFocusedMatch} filterMin={filterMin} filterMax={filterMax} />
          </div>
        )}

        {tab === "library" && (
          <div className="animate-in">
            <PatternLibrary refreshKey={libRefresh} dataset={dataset} />
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
