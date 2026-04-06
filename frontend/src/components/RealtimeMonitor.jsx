import React, { useState, useEffect, useCallback, useRef, memo } from "react"
import Plot from "react-plotly.js"
import {
  startRealtime, stopRealtime, getRealtimeStatus, clearRealtimeEvents
} from "../api/api"
import {
  Play, Square, Activity, AlertCircle, TrendingUp, Clock, Zap,
  Loader, Trash2, Radio, CheckCircle, AlertTriangle, Info
} from "lucide-react"

// ═══════════════════════════════════════════════════════════════════════════════
//  SOUS-COMPOSANTS
// ═══════════════════════════════════════════════════════════════════════════════

const SplitBar = memo(({ results, totalSplits }) => {
  const splits = []
  for (let i = 0; i < totalSplits; i++) {
    const result = results.find(r => r.split_index === i)
    const sim = result?.similarity || 0
    const done = !!result

    let bg = "var(--border-subtle)"
    let label = `Split ${i + 1}`
    if (done) {
      if (sim >= 80) bg = "var(--accent-emerald)"
      else if (sim >= 60) bg = "var(--accent-blue)"
      else if (sim >= 40) bg = "var(--accent-amber)"
      else bg = "var(--accent-rose)"
      label = `${sim.toFixed(1)}%`
    }

    splits.push(
      <div key={i} style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6
      }}>
        <div style={{
          width: "100%", height: 40, borderRadius: 8,
          background: done ? bg : "var(--bg-elevated)",
          border: done ? "none" : "2px dashed var(--border-default)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700,
          color: done ? "#fff" : "var(--text-muted)",
          transition: "all 0.4s ease",
          boxShadow: done && sim >= 60 ? `0 0 12px ${bg}44` : "none",
        }}>
          {done ? label : `${i + 1}`}
        </div>
        <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>
          Split {i + 1}
        </span>
      </div>
    )
  }
  return <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>{splits}</div>
})

const ConfidenceBadge = memo(({ confidence }) => {
  const map = {
    low: { color: "var(--accent-amber)", bg: "rgba(251,191,36,0.12)", label: "Faible", icon: Info },
    medium: { color: "var(--accent-blue)", bg: "rgba(96,165,250,0.12)", label: "Moyenne", icon: AlertTriangle },
    high: { color: "var(--accent-emerald)", bg: "rgba(52,211,153,0.12)", label: "Haute", icon: CheckCircle },
    confirmed: { color: "var(--accent-emerald)", bg: "rgba(52,211,153,0.18)", label: "Confirmée", icon: CheckCircle },
  }
  const c = map[confidence] || map.low
  const Icon = c.icon
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      color: c.color, background: c.bg,
    }}>
      <Icon size={12} /> {c.label}
    </span>
  )
})

const EventCard = memo(({ event }) => {
  if (event.type === "start" || event.type === "end") {
    return (
      <div style={{
        padding: "10px 14px", borderRadius: 8,
        background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
        fontSize: 12, color: "var(--text-secondary)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        {event.type === "start" ? <Play size={14} style={{ color: "var(--accent-emerald)" }} />
          : <Square size={14} style={{ color: "var(--text-muted)" }} />}
        {event.message}
      </div>
    )
  }

  if (event.type === "error") {
    return (
      <div style={{
        padding: "10px 14px", borderRadius: 8,
        background: "rgba(239,68,68,0.08)", border: "1px solid var(--accent-rose)",
        fontSize: 12, color: "var(--accent-rose)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <AlertCircle size={14} /> {event.message}
      </div>
    )
  }

  if (event.type === "cycle_complete") {
    return (
      <div style={{
        padding: "12px 16px", borderRadius: 10,
        background: "var(--accent-indigo-bg)", border: "1px solid var(--accent-indigo)",
        fontSize: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: "var(--accent-indigo)", marginBottom: 6 }}>
          <Zap size={14} /> Cycle complet
        </div>
        <span style={{ color: "var(--text-secondary)" }}>
          Similarité moyenne : <strong style={{ color: "var(--text-primary)" }}>
            {event.avg_similarity?.toFixed(1)}%
          </strong>
        </span>
      </div>
    )
  }

  if (event.type === "split_complete") {
    const isAlert = !!event.alert
    const isFailure = event.alert === "failure"
    return (
      <div style={{
        padding: "10px 14px", borderRadius: 8,
        background: isFailure ? "rgba(239,68,68,0.08)"
          : isAlert ? "rgba(52,211,153,0.06)"
            : "var(--bg-elevated)",
        border: `1px solid ${isFailure ? "var(--accent-rose)"
          : isAlert ? "var(--accent-emerald)"
            : "var(--border-subtle)"}`,
        fontSize: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: "var(--text-primary)" }}>
            {isFailure ? <AlertCircle size={14} style={{ color: "var(--accent-rose)" }} />
              : <Activity size={14} style={{ color: "var(--accent-indigo)" }} />}
            Split {event.split_index + 1}/{event.total_splits}
            {event.pattern_name && (
              <span style={{ fontWeight: 400, color: "var(--text-muted)" }}> — {event.pattern_name}</span>
            )}
          </span>
          <ConfidenceBadge confidence={event.confidence} />
        </div>
        <div style={{ display: "flex", gap: 16, color: "var(--text-secondary)" }}>
          <span>Similarité : <strong style={{
            color: event.similarity >= 80 ? "var(--accent-emerald)"
              : event.similarity >= 60 ? "var(--accent-blue)"
                : event.similarity >= 40 ? "var(--accent-amber)"
                  : "var(--accent-rose)"
          }}>{event.similarity?.toFixed(1)}%</strong></span>
          {event.pattern_type && (
            <span style={{
              color: event.pattern_type === "failure" ? "var(--accent-rose)" : "var(--accent-emerald)",
              fontWeight: 600,
            }}>
              {event.pattern_type === "failure" ? "⚠ Panne" : "✓ Normal"}
            </span>
          )}
        </div>
      </div>
    )
  }

  return null
})

const ChartComparison = memo(({ bestMatch, bufferData }) => {
  if (!bestMatch || !bufferData || bufferData.length === 0) {
    return null
  }

  const patternData = bestMatch.pattern_data || []
  if (patternData.length === 0) return null

  // Préparer les traces pour les graphiques
  const referenceTrace = {
    y: patternData,
    mode: 'lines',
    name: 'Pattern de Référence',
    line: { color: 'rgb(52, 211, 153)', width: 2 },
    hovertemplate: 'Point: %{x}<br>Valeur: %{y:.2f}<extra></extra>',
  }

  const realtimeTrace = {
    y: bufferData,
    mode: 'lines',
    name: 'Données Temps Réel',
    line: { 
      color: bestMatch.similarity >= 80 ? 'rgb(34, 211, 238)' 
           : bestMatch.similarity >= 60 ? 'rgb(129, 140, 248)'
           : bestMatch.similarity >= 40 ? 'rgb(251, 191, 36)'
           : 'rgb(239, 68, 68)',
      width: 2 
    },
    hovertemplate: 'Point: %{x}<br>Valeur: %{y:.2f}<extra></extra>',
  }

  const layout = {
    margin: { l: 50, r: 20, t: 30, b: 30 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { family: 'var(--font-family)', color: 'var(--text-primary)', size: 12 },
    hovermode: 'x unified',
    xaxis: {
      showgrid: true,
      gridwidth: 1,
      gridcolor: 'rgba(100, 100, 100, 0.1)',
      zeroline: false,
    },
    yaxis: {
      showgrid: true,
      gridwidth: 1,
      gridcolor: 'rgba(100, 100, 100, 0.1)',
      zeroline: false,
    },
  }

  const config = { responsive: true, displayModeBar: false }

  return (
    <div className="section" style={{ marginBottom: 20 }}>
      <h4 style={{
        margin: "0 0 16px", fontSize: 14, fontWeight: 700,
        color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6,
      }}>
        <TrendingUp size={14} style={{ color: "var(--accent-indigo)" }} />
        Comparaison Visuelle
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Graphique de référence */}
        <div style={{
          padding: 12, borderRadius: 10,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
        }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10,
          }}>
            📊 Pattern de Référence
          </div>
          <div style={{ height: 200 }}>
            <Plot
              data={[referenceTrace]}
              layout={{ ...layout, title: { text: bestMatch.pattern_name, font:{size: 10} } }}
              config={config}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>

        {/* Graphique temps réel */}
        <div style={{
          padding: 12, borderRadius: 10,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
        }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            📈 Données Temps Réel
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 16,
              background: bestMatch.similarity >= 80 ? 'rgba(52,211,153,0.1)'
                        : bestMatch.similarity >= 60 ? 'rgba(96,165,250,0.1)'
                        : bestMatch.similarity >= 40 ? 'rgba(251,191,36,0.1)'
                        : 'rgba(239,68,68,0.1)',
              color: bestMatch.similarity >= 80 ? 'var(--accent-emerald)'
                   : bestMatch.similarity >= 60 ? 'var(--accent-blue)'
                   : bestMatch.similarity >= 40 ? 'var(--accent-amber)'
                   : 'var(--accent-rose)',
            }}>
              Similarité: {bestMatch.similarity?.toFixed(1)}%
            </span>
          </div>
          <div style={{ height: 200 }}>
            <Plot
              data={[realtimeTrace]}
              layout={layout}
              config={config}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
})

// ═══════════════════════════════════════════════════════════════════════════════
//  COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

const RealtimeMonitor = memo(({ dataset }) => {
  const [status, setStatus] = useState(null)
  const [starting, setStarting] = useState(false)
  const [speed, setSpeed] = useState(0.005)
  const [maxPoints, setMaxPoints] = useState(5000)
  const pollRef = useRef(null)

  // Polling de l'état toutes les 500ms quand la simulation tourne
  const startPolling = useCallback(() => {
    if (pollRef.current) return
    const poll = async () => {
      try {
        const s = await getRealtimeStatus()
        setStatus(s)
        if (!s.running) {
          clearInterval(pollRef.current)
          pollRef.current = null
          // Un dernier refresh
          const final = await getRealtimeStatus()
          setStatus(final)
        }
      } catch (e) { /* ignore */ }
    }
    poll()
    pollRef.current = setInterval(poll, 500)
  }, [])

  useEffect(() => {
    // Check initial state
    getRealtimeStatus().then(s => {
      setStatus(s)
      if (s.running) startPolling()
    }).catch(() => { })
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [startPolling])

  const handleStart = useCallback(async () => {
    if (!dataset) return
    setStarting(true)
    try {
      const res = await startRealtime(dataset, speed, 0, maxPoints)
      if (!res.error) {
        startPolling()
      }
    } catch (e) { console.error(e) }
    setStarting(false)
  }, [dataset, speed, maxPoints, startPolling])

  const handleStop = useCallback(async () => {
    try {
      await stopRealtime()
      // Refresh
      const s = await getRealtimeStatus()
      setStatus(s)
    } catch (e) { console.error(e) }
  }, [])

  const handleClear = useCallback(async () => {
    try {
      await clearRealtimeEvents()
      setStatus(prev => prev ? { ...prev, events: [] } : prev)
    } catch (e) { console.error(e) }
  }, [])

  const isRunning = status?.running || false
  const progress = status?.simulation_progress || 0
  const events = status?.events || []
  const splitResults = status?.split_results || []
  const totalSplits = status?.total_splits || 4
  const bestMatch = status?.best_match

  return (
    <div className="animate-in">
      {/* ── Header ── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 20, paddingBottom: 12,
        borderBottom: "1px solid var(--border-subtle)",
      }}>
        <h3 style={{
          margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-primary)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <Radio size={18} style={{
            color: isRunning ? "var(--accent-emerald)" : "var(--accent-indigo)",
            animation: isRunning ? "pulse 1.5s ease-in-out infinite" : "none",
          }} />
          Détection Temps Réel
          {isRunning && (
            <span style={{
              fontSize: 11, fontWeight: 600, color: "var(--accent-emerald)",
              background: "rgba(52,211,153,0.12)", padding: "2px 10px", borderRadius: 20,
            }}>
              EN COURS
            </span>
          )}
        </h3>
      </div>

      {/* ── Controls ── */}
      {!isRunning && (
        <div className="section" style={{ borderLeft: "3px solid var(--accent-indigo)", marginBottom: 20 }}>
          <h4 style={{
            margin: "0 0 12px", fontSize: 14, fontWeight: 700,
            color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6,
          }}>
            <Zap size={14} style={{ color: "var(--accent-indigo)" }} />
            Paramètres de simulation
          </h4>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                Vitesse (sec/point)
              </label>
              <input className="input" type="number" step="0.001" min="0.001" max="1"
                value={speed} onChange={e => setSpeed(parseFloat(e.target.value) || 0.005)}
                style={{ width: 120 }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                Nb points max (0 = tout)
              </label>
              <input className="input" type="number" min="0" step="1000"
                value={maxPoints} onChange={e => setMaxPoints(parseInt(e.target.value) || 0)}
                style={{ width: 140 }} />
            </div>
            <button className="btn btn-success" onClick={handleStart} disabled={starting || !dataset}
              style={{ height: 38 }}>
              {starting
                ? <><Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> Démarrage…</>
                : <><Play size={14} /> Démarrer la simulation</>}
            </button>
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-muted)" }}>
            <Info size={12} style={{ verticalAlign: "middle" }} /> Les données du dataset <strong>{dataset}</strong> seront
            envoyées point par point pour simuler un flux temps réel. Les patterns sauvegardés en bibliothèque
            serviront de stéréotypes de référence.
          </div>
        </div>
      )}

      {/* ── Running panel ── */}
      {isRunning && (
        <div style={{ marginBottom: 20 }}>
          {/* Progress bar */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12, marginBottom: 16,
          }}>
            <div style={{
              flex: 1, height: 8, borderRadius: 4,
              background: "var(--bg-elevated)", overflow: "hidden",
            }}>
              <div style={{
                width: `${progress}%`, height: "100%",
                background: "linear-gradient(90deg, var(--accent-indigo), var(--accent-cyan))",
                borderRadius: 4, transition: "width 0.3s ease",
              }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", minWidth: 48 }}>
              {progress.toFixed(1)}%
            </span>
            <button className="btn btn-danger" onClick={handleStop} style={{ padding: "6px 14px" }}>
              <Square size={13} /> Stop
            </button>
          </div>

          {/* Stats rapides */}
          <div style={{
            display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap",
          }}>
            <div style={{
              padding: "10px 16px", borderRadius: 10, background: "var(--accent-indigo-bg)",
              border: "1px solid rgba(129,140,248,0.2)", flex: 1, minWidth: 120,
            }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>Points reçus</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--accent-indigo)" }}>
                {(status?.total_points_received || 0).toLocaleString()}
              </div>
            </div>
            <div style={{
              padding: "10px 16px", borderRadius: 10, background: "var(--accent-blue-bg)",
              border: "1px solid rgba(96,165,250,0.2)", flex: 1, minWidth: 120,
            }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>Buffer</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--accent-blue)" }}>
                {(status?.buffer_size || 0).toLocaleString()}
              </div>
            </div>
            <div style={{
              padding: "10px 16px", borderRadius: 10, background: "var(--accent-cyan-bg)",
              border: "1px solid rgba(34,211,238,0.2)", flex: 1, minWidth: 120,
            }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>Patterns chargés</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--accent-cyan)" }}>
                {status?.active_patterns_count || 0}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Comparaison Graphique ── */}
      {(isRunning || bestMatch) && (
        <ChartComparison bestMatch={bestMatch} bufferData={status?.buffer_data} />
      )}

      {/* ── Split Progress ── */}
      {(isRunning || splitResults.length > 0) && (
        <div className="section" style={{ marginBottom: 20 }}>
          <h4 style={{
            margin: "0 0 12px", fontSize: 14, fontWeight: 700,
            color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6,
          }}>
            <Activity size={14} style={{ color: "var(--accent-indigo)" }} />
            Progression des Splits
          </h4>
          <SplitBar results={splitResults} totalSplits={totalSplits} />
        </div>
      )}

      {/* ── Best Match ── */}
      {bestMatch && (
        <div className="section" style={{
          marginBottom: 20,
          borderLeft: `3px solid ${bestMatch.pattern_type === "failure" ? "var(--accent-rose)" : "var(--accent-emerald)"}`,
        }}>
          <h4 style={{
            margin: "0 0 12px", fontSize: 14, fontWeight: 700,
            color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6,
          }}>
            {bestMatch.pattern_type === "failure"
              ? <AlertCircle size={14} style={{ color: "var(--accent-rose)" }} />
              : <TrendingUp size={14} style={{ color: "var(--accent-emerald)" }} />
            }
            Meilleur Match
          </h4>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>
                {bestMatch.pattern_name}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {bestMatch.pattern_type === "failure" ? "⚠ Pattern de Panne" : "✓ Consommation Normale"}
              </div>
            </div>
            <div style={{
              fontSize: 28, fontWeight: 800,
              color: bestMatch.similarity >= 80 ? "var(--accent-emerald)"
                : bestMatch.similarity >= 60 ? "var(--accent-blue)"
                  : bestMatch.similarity >= 40 ? "var(--accent-amber)"
                    : "var(--accent-rose)",
            }}>
              {bestMatch.similarity?.toFixed(1)}%
            </div>
            <ConfidenceBadge confidence={bestMatch.confidence} />
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              <Clock size={12} style={{ verticalAlign: "middle" }} /> {bestMatch.splits_completed}/{totalSplits} splits
            </div>
          </div>
        </div>
      )}

      {/* ── Events Feed ── */}
      <div className="section">
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 12,
        }}>
          <h4 style={{
            margin: 0, fontSize: 14, fontWeight: 700,
            color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6,
          }}>
            <Clock size={14} style={{ color: "var(--accent-indigo)" }} />
            Événements
            <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: 12 }}>
              ({events.length})
            </span>
          </h4>
          {events.length > 0 && !isRunning && (
            <button className="btn btn-ghost" onClick={handleClear} style={{ fontSize: 11, padding: "4px 10px" }}>
              <Trash2 size={12} /> Effacer
            </button>
          )}
        </div>
        <div style={{
          display: "flex", flexDirection: "column", gap: 8,
          maxHeight: 400, overflowY: "auto",
        }}>
          {events.length === 0 && (
            <div style={{
              textAlign: "center", padding: "30px 20px",
              color: "var(--text-muted)", fontSize: 13,
            }}>
              <Radio size={28} style={{ opacity: 0.3, margin: "0 auto 8px", display: "block" }} />
              Aucun événement. Démarrez une simulation pour commencer.
            </div>
          )}
          {[...events].reverse().map((evt, i) => <EventCard key={i} event={evt} />)}
        </div>
      </div>
    </div>
  )
})

export default RealtimeMonitor
