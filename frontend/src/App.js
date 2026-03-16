import React, { useState, useEffect } from "react"
import { fetchData } from "./api/api"
import EnergyGraph from "./components/EnergyGraph"
import SimilarPatterns from "./components/SimilarPatterns"
import ScoreDistribution from "./components/ScoreDistribution"

function App() {

  const [data, setData] = useState([])
  const [matches, setMatches] = useState([])
  const [allScores, setAllScores] = useState([])
  const [focusedMatch, setFocusedMatch] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", padding: "0 24px 24px", maxWidth: 1400, margin: "0 auto" }}>

      <header style={{ padding: "16px 0 8px", borderBottom: "1px solid #eee", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "#2d3436" }}>Détection de Patterns Énergétiques</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888" }}>
          {loading ? "Chargement..." : `${data.length.toLocaleString()} points chargés`}
        </p>
      </header>

      <EnergyGraph data={data} setMatches={setMatches} setAllScores={setAllScores} focusedMatch={focusedMatch} />

      <ScoreDistribution allScores={allScores} matches={matches} />

      <SimilarPatterns matches={matches} onNavigate={setFocusedMatch} />

    </div>
  )
}

export default App