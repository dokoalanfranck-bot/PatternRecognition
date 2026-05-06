import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from "react"
import Plot from "react-plotly.js"
import {
  startRealtime, stopRealtime, getRealtimeStatus, clearRealtimeEvents, listPatterns
} from "../api/api"
import {
  Play, Square, Activity, AlertCircle, Clock, Zap,
  Loader, Trash2, Radio, AlertTriangle, Info, Shield, Eye,
  ChevronDown, ChevronUp, TrendingUp, FileText, Settings, Target,
  CheckCircle, Bell, Cpu, XCircle, Download
} from "lucide-react"
import { generateRealtimeReport } from "../utils/generateRealtimeReport"

// =============================================================================
//  CONSTANTES & HELPERS
// =============================================================================

const LEVEL_META = {
  normal:       { label: "Normal",       color: "#34d399", bg: "rgba(52,211,153,.08)",  icon: Shield,        desc: "Aucune correspondance significative" },
  surveillance: { label: "Surveillance", color: "#60a5fa", bg: "rgba(96,165,250,.08)",  icon: Eye,           desc: "Debut de pattern detecte" },
  attention:    { label: "Attention",    color: "#fbbf24", bg: "rgba(251,191,36,.08)",  icon: AlertTriangle, desc: "Correspondance partielle confirmee" },
  danger:       { label: "Danger",       color: "#f97316", bg: "rgba(249,115,22,.10)",  icon: AlertCircle,   desc: "Pattern en cours - haute confiance" },
  critique:     { label: "Critique",     color: "#ef4444", bg: "rgba(239,68,68,.12)",   icon: Zap,           desc: "Pattern quasi-complet - action requise" },
}
const LEVELS_ORDER = ["normal", "surveillance", "attention", "danger", "critique"]

const darkLayout = (extra = {}) => ({
  paper_bgcolor: "transparent", plot_bgcolor: "transparent",
  font: { family: "Inter, system-ui, sans-serif", color: "#94a3b8", size: 11 },
  margin: { l: 44, r: 14, t: 8, b: 28 },
  hovermode: "x unified",
  hoverlabel: { bgcolor: "#1e293b", bordercolor: "#334155", font: { color: "#f1f5f9", size: 11 } },
  legend: { orientation: "h", x: .5, xanchor: "center", y: 1.08, font: { size: 10, color: "#94a3b8" }, bgcolor: "transparent" },
  xaxis: { showgrid: true, gridcolor: "rgba(148,163,184,.06)", zeroline: false, linecolor: "rgba(148,163,184,.1)", tickfont: { size: 9, color: "#475569" } },
  yaxis: { showgrid: true, gridcolor: "rgba(148,163,184,.06)", zeroline: false, linecolor: "rgba(148,163,184,.1)", tickfont: { size: 9, color: "#475569" } },
  ...extra,
})

function fmt(v) { return v != null ? v.toLocaleString("fr-FR") : "-" }

function formatETA(seconds) {
  if (seconds == null) return "\u2014"
  if (seconds <= 0) return "Imminent"
  if (seconds < 60) return Math.round(seconds) + "s"
  if (seconds < 3600) return Math.round(seconds / 60) + "min"
  return (seconds / 3600).toFixed(1) + "h"
}

// =============================================================================
//  INDICATEUR DE COMPARAISON ACTIVE
// =============================================================================

const ComparingIndicator = memo(({ isRunning, evalCount, isComparing }) => {
  if (!isRunning) return null
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 16px", borderRadius: 12,
      background: isComparing
        ? "rgba(99,102,241,.15)"
        : "rgba(30,41,59,.5)",
      border: "1px solid " + (isComparing ? "rgba(99,102,241,.4)" : "rgba(148,163,184,.08)"),
      transition: "all .25s ease",
    }}>
      <Cpu size={14} style={{
        color: isComparing ? "#818cf8" : "#475569",
        animation: isComparing ? "spin 1s linear infinite" : "none",
      }} />
      <span style={{
        fontSize: 11, fontWeight: 700,
        color: isComparing ? "#a5b4fc" : "#64748b",
        transition: "color .25s",
      }}>
        {isComparing ? "Comparaison des patterns..." : "En attente..."}
      </span>
      {evalCount > 0 && (
        <span style={{
          fontSize: 10, color: "#475569", fontWeight: 600,
          background: "rgba(15,23,42,.4)", padding: "2px 8px", borderRadius: 10,
        }}>
          {evalCount} éval.
        </span>
      )}
    </div>
  )
})

// =============================================================================
//  TOAST NOTIFICATION (NOUVEAU MATCH)
// =============================================================================

const MatchToast = memo(({ toast, onDismiss }) => {
  const e = toast.event
  const isFailure = e.pattern_type === "failure" || e.pattern_type !== "normal"
  const color = isFailure ? "#ef4444" : "#34d399"
  const bg = isFailure ? "rgba(239,68,68,.12)" : "rgba(52,211,153,.12)"
  const border = isFailure ? "rgba(239,68,68,.35)" : "rgba(52,211,153,.35)"
  const Icon = isFailure ? AlertTriangle : CheckCircle
  const count = e.detections_count || 1

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12,
      padding: "14px 16px", borderRadius: 14,
      background: bg, border: "1.5px solid " + border,
      boxShadow: "0 8px 32px rgba(0,0,0,.35)",
      animation: "slideInRight .35s cubic-bezier(.4,0,.2,1)",
      position: "relative", minWidth: 280,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: isFailure ? "rgba(239,68,68,.15)" : "rgba(52,211,153,.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "pulse 1.5s ease-in-out 3",
      }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color, lineHeight: 1.2 }}>
          {isFailure ? "Nouveau match détecté !" : "Pattern normal reconnu"}
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, fontWeight: 600 }}>
          {e.pattern_name}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <span style={{ fontSize: 10, color: "#64748b", background: "rgba(15,23,42,.4)", padding: "2px 8px", borderRadius: 8 }}>
            Confiance {(e.confidence || 0).toFixed(0)}%
          </span>
          <span style={{ fontSize: 10, color: "#64748b", background: "rgba(15,23,42,.4)", padding: "2px 8px", borderRadius: 8 }}>
            Similarité {(e.similarity || 0).toFixed(0)}%
          </span>
          {count > 1 && (
            <span style={{ fontSize: 10, color, background: isFailure ? "rgba(239,68,68,.1)" : "rgba(52,211,153,.1)", padding: "2px 8px", borderRadius: 8, fontWeight: 700 }}>
              #{count}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        style={{ background: "none", border: "none", cursor: "pointer", color: "#475569", padding: 2, flexShrink: 0 }}
      >
        <XCircle size={14} />
      </button>
    </div>
  )
})

const ToastContainer = memo(({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      display: "flex", flexDirection: "column", gap: 10,
      maxWidth: 360,
    }}>
      {toasts.map(t => (
        <MatchToast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
})

// =============================================================================
//  BANNIERE DE FIN DE SIMULATION
// =============================================================================

const CompletionBanner = memo(({ endEvent }) => {
  if (!endEvent) return null
  const hasMatches = (endEvent.total_matches || 0) > 0
  const color = hasMatches ? "#ef4444" : "#34d399"
  const bg = hasMatches ? "rgba(239,68,68,.08)" : "rgba(52,211,153,.08)"
  const border = hasMatches ? "rgba(239,68,68,.2)" : "rgba(52,211,153,.2)"
  const Icon = hasMatches ? Bell : CheckCircle

  return (
    <div style={{
      padding: "14px 20px", borderRadius: 14, marginBottom: 16,
      background: bg, border: "1.5px solid " + border,
      display: "flex", alignItems: "center", gap: 14,
      animation: "fadeIn .4s ease-out",
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
        background: hasMatches ? "rgba(239,68,68,.12)" : "rgba(52,211,153,.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={22} style={{ color }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color, marginBottom: 3 }}>
          Simulation terminée
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8" }}>
          {endEvent.total_matches > 0
            ? <><span style={{ color, fontWeight: 700 }}>{endEvent.total_matches}</span> correspondance(s) détectée(s) sur {endEvent.patterns_count || "—"} pattern(s) surveillé(s)</>
            : "Aucune correspondance détectée — comportement normal sur toute la plage analysée"
          }
        </div>
      </div>
    </div>
  )
})

// =============================================================================
//  JAUGE DE CONFIANCE (Arc animee)
// =============================================================================

const ConfidenceGauge = memo(({ confidence, level, size = 120 }) => {
  const meta = LEVEL_META[level] || LEVEL_META.normal
  const R = (size - 16) / 2
  const SW = Math.max(6, size * 0.07)
  const C = 2 * Math.PI * R
  const dash = C - (C * Math.min(confidence, 100)) / 100
  const center = size / 2

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={center} cy={center} r={R} fill="none" stroke="rgba(148,163,184,.06)" strokeWidth={SW} />
        <circle cx={center} cy={center} r={R} fill="none" stroke={meta.color} strokeWidth={SW}
          strokeDasharray={C} strokeDashoffset={dash} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset .8s cubic-bezier(.4,0,.2,1), stroke .4s ease", filter: confidence > 60 ? `drop-shadow(0 0 6px ${meta.color}60)` : "none" }} />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: size * 0.28, fontWeight: 800, color: meta.color, lineHeight: 1, transition: "color .3s" }}>
          {confidence.toFixed(0)}
        </span>
        <span style={{ fontSize: size * 0.09, color: "#64748b", marginTop: 2 }}>% confiance</span>
      </div>
    </div>
  )
})

// =============================================================================
//  BARRE DE PROGRESSION DU PATTERN
// =============================================================================

const ProgressBar = memo(({ progress, prefixScores, prefixRatios, threshold }) => {
  return (
    <div>
      {/* Barre principale */}
      <div style={{ position: "relative", height: 28, borderRadius: 14, background: "rgba(30,41,59,.5)", overflow: "hidden", border: "1px solid rgba(148,163,184,.08)" }}>
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: Math.min(progress, 100) + "%",
          borderRadius: 14,
          background: progress > 70
            ? "linear-gradient(90deg, #f97316, #ef4444)"
            : progress > 40
              ? "linear-gradient(90deg, #60a5fa, #fbbf24)"
              : "linear-gradient(90deg, #34d399, #60a5fa)",
          transition: "width .6s cubic-bezier(.4,0,.2,1)",
          boxShadow: progress > 50 ? "0 0 12px rgba(239,68,68,.2)" : "none",
        }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#f1f5f9", textShadow: "0 1px 2px rgba(0,0,0,.5)" }}>
            {progress.toFixed(0)}% du pattern reconnu
          </span>
        </div>
      </div>

      {/* Indicateurs par prefixe */}
      <div style={{ display: "flex", gap: 3, marginTop: 8 }}>
        {prefixRatios && prefixRatios.map((ratio, i) => {
          const score = prefixScores?.[i] || 0
          const isActive = score >= (threshold || 55)
          return (
            <div key={i} style={{ flex: 1, textAlign: "center" }}>
              <div style={{
                height: 4, borderRadius: 2,
                background: isActive
                  ? score > 80 ? "#ef4444" : score > 65 ? "#fbbf24" : "#60a5fa"
                  : "rgba(51,65,85,.4)",
                transition: "background .3s",
              }} />
              <div style={{ fontSize: 8, color: isActive ? "#94a3b8" : "#334155", marginTop: 3, fontWeight: 600 }}>
                {Math.round(ratio * 100)}%
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})



// =============================================================================
//  GRAPHIQUE LIVE AVEC OVERLAY PATTERN + PREDICTION
// =============================================================================

const LiveChartWithOverlay = memo(({ bufferData, detectors, bufferSize }) => {
  if (!bufferData || bufferData.length < 10) return null

  // Trouver le detecteur avec la plus haute confiance
  const bestDetector = detectors && detectors.length > 0
    ? detectors.reduce((a, b) => (b.confidence || 0) > (a.confidence || 0) ? b : a, detectors[0])
    : null

  const traces = []

  // Trace principale : flux live
  traces.push({
    y: bufferData,
    mode: "lines",
    name: "Flux en direct",
    line: { color: "#818cf8", width: 1.5 },
    fill: "tozeroy",
    fillcolor: "rgba(129,140,248,.04)",
    hovertemplate: "%{y:.2f}<extra>Flux</extra>",
  })

  // Overlay du pattern matche (si confiance > 20%)
  if (bestDetector && bestDetector.confidence > 20 && bestDetector.match_position >= 0) {
    const patternData = bestDetector.pattern_data || []
    const matchedLen = bestDetector.matched_length || 0
    const patternLength = bestDetector.pattern_length || patternData.length

    if (patternData.length > 0 && matchedLen > 0) {
      // match_position est relatif a search_buf = buf[-searchLen:]
      // bufferData = buf[-2000:]
      // On recalcule la position dans bufferData
      const totalBuf = bufferSize || bufferData.length
      const searchLen = Math.min(totalBuf, Math.round(patternLength * 2.5))
      const matchPosInBufData = bufferData.length - searchLen + bestDetector.match_position

      if (matchPosInBufData < 0 || matchPosInBufData >= bufferData.length) {
        // Position hors fenetre visible, skip overlay
      } else {
        // Aligner le pattern sur le buffer : calculer l'echelle
        const bufSlice = bufferData.slice(matchPosInBufData, matchPosInBufData + matchedLen)
        const patSlice = patternData.slice(0, matchedLen)

        if (bufSlice.length > 4 && patSlice.length > 4) {
          const bufMean = bufSlice.reduce((a, b) => a + b, 0) / bufSlice.length
          const patMean = patSlice.reduce((a, b) => a + b, 0) / patSlice.length
          const bufStd = Math.sqrt(bufSlice.reduce((a, b) => a + (b - bufMean) ** 2, 0) / bufSlice.length) || 1
          const patStd = Math.sqrt(patSlice.reduce((a, b) => a + (b - patMean) ** 2, 0) / patSlice.length) || 1

          const scale = bufStd / patStd
          const offset = bufMean - patMean * scale

          // Partie matchee du pattern
          const overlayY = new Array(bufferData.length).fill(null)
          for (let j = 0; j < matchedLen && (matchPosInBufData + j) < bufferData.length; j++) {
            overlayY[matchPosInBufData + j] = patternData[j] * scale + offset
          }

          traces.push({
            y: overlayY,
            mode: "lines",
            name: "Pattern reconnu",
            line: { color: "#ef4444", width: 2.5, dash: "dot" },
            hovertemplate: "%{y:.2f}<extra>Pattern</extra>",
          })

          // Zone de prediction (suite du pattern)
          const prediction = bestDetector.prediction || []
          if (prediction.length > 0) {
            const predStart = matchPosInBufData + matchedLen
            const predY = new Array(bufferData.length + prediction.length).fill(null)
            for (let j = 0; j < prediction.length && (predStart + j) < predY.length; j++) {
              predY[predStart + j] = prediction[j] * scale + offset
            }
            traces.push({
              y: predY,
              mode: "lines",
              name: "Prediction",
              line: { color: "#fbbf24", width: 2, dash: "dash" },
              fill: "tonexty",
              fillcolor: "rgba(251,191,36,.04)",
              hovertemplate: "%{y:.2f}<extra>Prediction</extra>",
            })
          }
        }
      }
    }
  }

  return (
    <div className="section" style={{ marginBottom: 16 }}>
      <h4 className="section-title">
        <Activity size={15} style={{ color: "#818cf8" }} />
        Flux en direct
        {bestDetector && bestDetector.confidence > 30 && (
          <span style={{
            fontSize: 10, fontWeight: 700, marginLeft: 10,
            color: "#ef4444", background: "rgba(239,68,68,.08)",
            padding: "2px 10px", borderRadius: 10,
          }}>
            Pattern en cours de detection
          </span>
        )}
      </h4>
      <div id="realtime-live-chart">
        <Plot
          data={traces}
          layout={darkLayout({
            height: 220,
            margin: { l: 44, r: 14, t: 6, b: 24 },
            showlegend: true,
            yaxis: { ...darkLayout().yaxis, title: { text: "Valeur", font: { size: 9, color: "#475569" } } },
          })}
          config={{ responsive: true, displayModeBar: false }}
          style={{ width: "100%", height: 220 }}
        />
      </div>
    </div>
  )
})

// =============================================================================
//  DASHBOARD GLOBAL
// =============================================================================

const StatusDashboard = memo(({ status, isRunning }) => {
  const globalLevel = status?.global_level || "normal"
  const globalConf = status?.global_confidence || 0
  const meta = LEVEL_META[globalLevel] || LEVEL_META.normal
  const Icon = meta.icon
  const detectors = useMemo(() => status?.detectors || [], [status])
  const progress = status?.sim_progress || 0
  const isHigh = ["attention", "danger", "critique"].includes(globalLevel)

  return (
    <div style={{
      borderRadius: 16, overflow: "hidden",
      background: meta.bg, border: "1.5px solid " + meta.color + "30",
      marginBottom: 20,
      animation: isHigh ? "pulse 2s ease-in-out infinite" : "none",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 24px" }}>
        <ConfidenceGauge confidence={globalConf} level={globalLevel} size={90} />

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon size={22} style={{ color: meta.color }} />
            <div style={{ fontSize: 22, fontWeight: 800, color: meta.color, lineHeight: 1.1 }}>
              {meta.label}
            </div>
          </div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 5 }}>{meta.desc}</div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>
            {detectors.length} pattern(s) surveille(s) \u2014 {fmt(status?.total_points || 0)} points traites
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { label: "Patterns", value: detectors.length, color: "#818cf8" },
            { label: "Buffer", value: fmt(status?.buffer_size || 0), color: "#22d3ee" },
            { label: "Vitesse", value: (status?.points_per_second || 0).toFixed(0) + "/s", color: "#a78bfa" },
          ].map(s => (
            <div key={s.label} style={{
              textAlign: "center", padding: "8px 12px", borderRadius: 10,
              background: "rgba(15,23,42,.4)", border: "1px solid rgba(148,163,184,.06)", minWidth: 70,
            }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 9, color: "#64748b", marginTop: 3, fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Barre de progression simulation */}
      {isRunning && (
        <div style={{ padding: "0 24px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, height: 5, borderRadius: 3, background: "rgba(30,41,59,.5)", overflow: "hidden" }}>
              <div style={{
                width: progress + "%", height: "100%", borderRadius: 3,
                background: "linear-gradient(90deg, " + meta.color + ", #22d3ee)",
                transition: "width .3s ease",
              }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#f1f5f9", minWidth: 45 }}>
              {progress.toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      {/* Niveaux d'alerte */}
      <div style={{ display: "flex", padding: "0 24px 14px", gap: 3 }}>
        {LEVELS_ORDER.map((l, i) => {
          const m = LEVEL_META[l]
          const active = LEVELS_ORDER.indexOf(globalLevel) >= i
          return (
            <div key={l} style={{
              flex: 1, padding: "6px 0", borderRadius: 6, textAlign: "center",
              background: active ? m.color + "15" : "rgba(30,41,59,.3)",
              border: "1px solid " + (active ? m.color + "40" : "transparent"),
              transition: "all .3s",
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: active ? m.color : "#475569" }}>{m.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
})

// =============================================================================
//  CARTE DETECTEUR DETAILLEE
// =============================================================================

const DetectorCard = memo(({ detector }) => {
  const [expanded, setExpanded] = useState(false)
  const meta = LEVEL_META[detector.alert_level] || LEVEL_META.normal
  const Icon = meta.icon
  const alarmConf = detector.alarm_confidence || 0
  const conf = detector.confidence || 0
  const prog = detector.progress || 0
  const history = detector.history || []
  const isNormal = detector.pattern_type === "normal"
  const triggered = detector.alarm_triggered

  return (
    <div style={{
      borderRadius: 14, overflow: "hidden",
      background: "var(--bg-card)", border: "1.5px solid " + meta.color + "30",
      transition: "all .3s",
      boxShadow: triggered ? "0 0 20px " + meta.color + "15" : "none",
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 18px", cursor: "pointer",
          borderBottom: expanded ? "1px solid " + meta.color + "20" : "none",
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: meta.bg, display: "flex", alignItems: "center", justifyContent: "center",
          border: "1px solid " + meta.color + "30",
        }}>
          <Icon size={18} style={{ color: meta.color }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: "#f1f5f9",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{detector.name}</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
            {isNormal
              ? (triggered
                ? "Deviation du comportement normal detectee"
                : "Comportement normal confirme")
              : <>Progression : {prog.toFixed(0)}% \u2014 ETA : {formatETA(detector.eta_seconds)}</>
            }
            {detector.detections_count > 0 && (
              <span style={{ color: "#ef4444", marginLeft: 6 }}>
                ({detector.detections_count} alerte{detector.detections_count > 1 ? "s" : ""})
              </span>
            )}
          </div>
        </div>

        <div style={{
          padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700,
          color: detector.pattern_type === "failure" ? "#fb7185" : "#34d399",
          background: detector.pattern_type === "failure" ? "rgba(251,113,133,.1)" : "rgba(52,211,153,.1)",
        }}>
          {detector.pattern_type === "failure" ? "Panne" : "Normal"}
        </div>

        {triggered && (
          <div style={{
            padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700,
            color: "#ef4444", background: "rgba(239,68,68,.1)",
            animation: "pulse 1.5s ease-in-out infinite",
          }}>
            ALARME
          </div>
        )}

        <ConfidenceGauge confidence={alarmConf} level={detector.alert_level} size={52} />

        <div style={{
          padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
          color: meta.color, background: meta.bg, border: "1px solid " + meta.color + "30",
          minWidth: 80, textAlign: "center",
        }}>{meta.label}</div>

        <div style={{ color: "#475569" }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: "16px 18px", animation: "fadeIn .25s ease-out" }}>
          {/* Barre de progression */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>
              <Target size={11} style={{ verticalAlign: "middle" }} /> Progression du match
            </div>
            <ProgressBar
              progress={prog}
              prefixScores={detector.prefix_scores}
              prefixRatios={detector.prefix_ratios}
              threshold={detector.alert_threshold}
            />
          </div>

          {/* Graphique historique */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 6 }}>
              <TrendingUp size={11} style={{ verticalAlign: "middle" }} /> Evolution de la confiance
            </div>
            {history.length > 2 ? (
              <Plot
                data={[
                  {
                    y: history.map(h => h[1]),
                    mode: "lines", name: "Confiance",
                    line: { color: meta.color, width: 2 },
                    fill: "tozeroy", fillcolor: meta.color + "08",
                    hovertemplate: "%{y:.1f}%<extra></extra>",
                  },
                  {
                    y: history.map(h => h[2]),
                    mode: "lines", name: "Progression",
                    line: { color: "#22d3ee", width: 1.5, dash: "dot" },
                    hovertemplate: "%{y:.0f}%<extra></extra>",
                  },
                ]}
                layout={darkLayout({
                  height: 130,
                  yaxis: { ...darkLayout().yaxis, range: [0, 105], title: { text: "%", font: { size: 9 } } },
                  showlegend: true,
                })}
                config={{ responsive: true, displayModeBar: false }}
                style={{ width: "100%", height: 130 }}
              />
            ) : (
              <div style={{
                height: 50, display: "flex", alignItems: "center", justifyContent: "center",
                color: "#475569", fontSize: 12, background: "rgba(15,23,42,.3)", borderRadius: 8,
              }}>En attente de donnees...</div>
            )}
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { label: "Similarite", value: (detector.similarity || 0).toFixed(0) + "%", color: "#818cf8" },
              { label: "Alarme", value: (detector.alarm_confidence || 0).toFixed(0) + "%", color: triggered ? "#ef4444" : "#34d399" },
              { label: isNormal ? "Seuil min" : "Seuil max", value: (detector.alert_threshold || 0).toFixed(0) + "%", color: "#a78bfa" },
              { label: "Match", value: (detector.matched_length || 0) + "/" + detector.pattern_length + " pts", color: "#22d3ee" },
            ].map(s => (
              <div key={s.label} style={{
                flex: 1, minWidth: 80, textAlign: "center", padding: "8px 10px",
                borderRadius: 8, background: "rgba(15,23,42,.3)", border: "1px solid rgba(148,163,184,.05)",
              }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 9, color: "#475569", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
})

// =============================================================================
//  TABLEAU D'EVENEMENTS
// =============================================================================

const EventsTable = memo(({ events, isRunning, onClear }) => {
  const [showAll, setShowAll] = useState(false)
  const alertEvents = events.filter(e => e.type === "level_change" || e.type === "high_confidence" || e.type === "new_match")
  const infoEvents = events.filter(e => e.type === "error" || e.type === "start" || e.type === "end")
  const reversed = [...alertEvents].reverse()
  const visible = showAll ? reversed : reversed.slice(0, 8)

  return (
    <div className="section" style={{ marginBottom: 16 }}>
      {infoEvents.length > 0 && (
        <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          {infoEvents.map((e, i) => {
            const isError = e.type === "error"
            return (
              <div key={i} style={{
                padding: "10px 14px", borderRadius: 10, fontSize: 12,
                display: "flex", alignItems: "center", gap: 8,
                background: isError ? "rgba(239,68,68,.08)" : "rgba(96,165,250,.08)",
                border: "1px solid " + (isError ? "rgba(239,68,68,.2)" : "rgba(96,165,250,.15)"),
                color: isError ? "#f87171" : "#60a5fa",
              }}>
                {isError ? <AlertCircle size={14} /> : <Info size={14} />}
                <span style={{ fontWeight: 600 }}>{e.message}</span>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h4 className="section-title" style={{ marginBottom: 0 }}>
          <Clock size={15} style={{ color: "#818cf8" }} />
          Journal de detection
          <span style={{ fontWeight: 400, color: "#64748b", fontSize: 11 }}> ({alertEvents.length})</span>
        </h4>
        <div style={{ display: "flex", gap: 6 }}>
          {alertEvents.length > 8 && (
            <button className="btn btn-ghost" onClick={() => setShowAll(s => !s)} style={{ fontSize: 10, padding: "3px 10px" }}>
              {showAll ? "Voir moins" : "Tout (" + alertEvents.length + ")"}
            </button>
          )}
          {alertEvents.length > 0 && !isRunning && (
            <button className="btn btn-ghost" onClick={onClear} style={{ fontSize: 10, padding: "3px 10px", color: "var(--accent-rose)" }}>
              <Trash2 size={11} /> Effacer
            </button>
          )}
        </div>
      </div>

      {alertEvents.length === 0 ? (
        <div style={{ textAlign: "center", padding: "28px 16px", color: "#475569", fontSize: 12 }}>
          <Radio size={24} style={{ opacity: .2, margin: "0 auto 8px", display: "block" }} />
          Aucun evenement detecte.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                {["Pattern", "Evenement", "Confiance", "Progression", "Niveau"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((e, i) => {
                const lm = LEVEL_META[e.alert_level || e.to_level] || LEVEL_META.normal
                const isNewMatch = e.type === "new_match"
                const rowColor = isNewMatch ? "#ef4444" : undefined
                return (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(148,163,184,.04)", background: isNewMatch ? "rgba(239,68,68,.04)" : "transparent" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: "#f1f5f9" }}>{e.pattern_name || "-"}</td>
                    <td style={{ padding: "8px 10px" }}>
                      {isNewMatch ? (
                        <span style={{ color: "#ef4444", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                          <Bell size={11} /> Match complet #{e.detections_count}
                        </span>
                      ) : e.type === "high_confidence" ? (
                        <span style={{ color: "#ef4444", fontWeight: 600 }}>Haute confiance atteinte</span>
                      ) : (
                        <span>
                          <span style={{ color: LEVEL_META[e.from_level]?.color || "#64748b" }}>{LEVEL_META[e.from_level]?.label || e.from_level}</span>
                          {" \u2192 "}
                          <span style={{ color: LEVEL_META[e.to_level]?.color || "#64748b", fontWeight: 700 }}>{LEVEL_META[e.to_level]?.label || e.to_level}</span>
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "8px 10px", fontWeight: 700, color: isNewMatch ? "#ef4444" : lm.color }}>{(e.confidence || 0).toFixed(0)}%</td>
                    <td style={{ padding: "8px 10px", color: "#94a3b8" }}>{(e.progress || 0).toFixed(0)}%</td>
                    <td style={{ padding: "8px 10px" }}>
                      {isNewMatch ? (
                        <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700, color: "#ef4444", background: "rgba(239,68,68,.1)" }}>
                          Match !
                        </span>
                      ) : (
                        <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700, color: lm.color, background: lm.bg }}>
                          {lm.label}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
})

// =============================================================================
//  COMPOSANT PRINCIPAL
// =============================================================================

const RealtimeMonitor = memo(({ dataset }) => {
  const [status, setStatus] = useState(null)
  const [starting, setStarting] = useState(false)
  const [speed, setSpeed] = useState(0.005)
  const [maxPoints, setMaxPoints] = useState(5000)
  const [showConfig, setShowConfig] = useState(true)
  const [patternCount, setPatternCount] = useState(null)
  const [startError, setStartError] = useState(null)
  const [toasts, setToasts] = useState([])
  const [pdfLoading, setPdfLoading] = useState(false)
  const [snapshots, setSnapshots] = useState([])
  const pollRef = useRef(null)
  const seenMatchesRef = useRef(new Set())
  const prevGlobalLevelRef = useRef("normal")
  const captureSnapshotRef = useRef(null)

  const dismissToast = useCallback((id) => {
    setToasts(t => t.filter(toast => toast.id !== id))
  }, [])

  const captureAnomalySnapshot = useCallback(async ({ patternName, confidence, level }) => {
    try {
      const el = document.getElementById("realtime-live-chart")
      if (!el) return
      const imageData = await window.Plotly?.toImage(el, { format: "png", width: 900, height: 280, scale: 1.5 })
      if (!imageData) return
      setSnapshots(prev => [
        ...prev.slice(-4),
        { timestamp: Date.now(), patternName, confidence, level, imageData },
      ])
    } catch (_) {}
  }, [])

  const startPolling = useCallback(() => {
    if (pollRef.current) return
    const poll = async () => {
      try {
        const s = await getRealtimeStatus()
        setStatus(s)

        // Detecter nouveaux matches pour les toasts + captures
        const newMatches = (s.events || []).filter(e => e.type === "new_match")
        newMatches.forEach(e => {
          const key = `${e.pattern_id}-${e.detections_count}-${e.timestamp}`
          if (!seenMatchesRef.current.has(key)) {
            seenMatchesRef.current.add(key)
            const id = Date.now() + Math.random()
            setToasts(t => [...t.slice(-4), { id, event: e }])
            setTimeout(() => setToasts(t => t.filter(toast => toast.id !== id)), 7000)
            // Capture screenshot at anomaly match
            captureSnapshotRef.current?.({ patternName: e.pattern_name, confidence: e.confidence || 0, level: s.global_level || "critique" })
          }
        })

        // Capture on first reach of danger / critique level
        const currentLevel = s.global_level || "normal"
        const prev = prevGlobalLevelRef.current
        if (["danger", "critique"].includes(currentLevel) && !["danger", "critique"].includes(prev)) {
          const best = (s.detectors || []).reduce((a, b) => (b.confidence || 0) > (a.confidence || 0) ? b : a, s.detectors?.[0] || {})
          captureSnapshotRef.current?.({ patternName: best?.name || "—", confidence: best?.confidence || 0, level: currentLevel })
        }
        prevGlobalLevelRef.current = currentLevel

        if (!s.running) {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
      } catch (err) { /* ignore */ }
    }
    poll()
    pollRef.current = setInterval(poll, 500)
  }, [])

  useEffect(() => {
    getRealtimeStatus().then(s => {
      setStatus(s)
      if (s.running) startPolling()
    }).catch(() => {})
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [startPolling])

  useEffect(() => {
    if (!dataset) return
    listPatterns(dataset).then(res => {
      setPatternCount((res.patterns || []).length)
    }).catch(() => setPatternCount(0))
  }, [dataset])

  const handleStart = useCallback(async () => {
    if (!dataset) return
    setStarting(true)
    setStartError(null)
    try {
      const res = await startRealtime(dataset, speed, 0, maxPoints)
      if (res.error) {
        setStartError(res.error)
      } else {
        setShowConfig(false)
        startPolling()
      }
    } catch (e) {
      setStartError("Erreur de connexion au serveur.")
      console.error(e)
    }
    setStarting(false)
  }, [dataset, speed, maxPoints, startPolling])

  const handleStop = useCallback(async () => {
    try { await stopRealtime(); setStatus(await getRealtimeStatus()) } catch (err) { /* ignore */ }
  }, [])

  const handleClear = useCallback(async () => {
    try { await clearRealtimeEvents(); setStatus(p => p ? { ...p, events: [] } : p) } catch (err) { /* ignore */ }
  }, [])

  // keep captureSnapshotRef fresh (no stale closure)
  captureSnapshotRef.current = captureAnomalySnapshot

  const handleDownloadPdf = useCallback(async () => {
    if (!status) return
    setPdfLoading(true)
    try {
      await new Promise(r => setTimeout(r, 80))
      generateRealtimeReport(status, dataset, snapshots)
    } catch (err) {
      console.error("Erreur génération PDF", err)
    } finally {
      setPdfLoading(false)
    }
  }, [status, dataset, snapshots])

  const isRunning = status?.running || false
  const events = status?.events || []
  const detectors = status?.detectors || []
  const bufferData = status?.buffer_data || []
  const hasData = detectors.length > 0 || events.length > 0
  const isComparing = status?.is_comparing || false
  const evalCount = status?.eval_count || 0
  const endEvent = !isRunning ? events.findLast?.(e => e.type === "end") ?? events.slice().reverse().find(e => e.type === "end") : null

  return (
    <div className="animate-in">
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 20, paddingBottom: 14, borderBottom: "1px solid var(--border-subtle)",
      }}>
        <div>
          <h3 style={{
            margin: 0, fontSize: 20, fontWeight: 800, color: "#f1f5f9",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <Radio size={20} style={{
              color: isRunning ? "#34d399" : "#818cf8",
              animation: isRunning ? "pulse 1.5s ease-in-out infinite" : "none",
            }} />
            Detection Temps Reel
            {isRunning && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: "#34d399",
                background: "rgba(52,211,153,.12)", padding: "3px 12px", borderRadius: 20,
                animation: "pulse 2s ease-in-out infinite",
              }}>EN COURS</span>
            )}
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>
            Matching progressif par prefixes croissants \u2014 prediction en temps reel \u2014 overlay visuel
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {snapshots.length > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 700, color: "#f87171",
              background: "rgba(239,68,68,.12)", padding: "3px 10px", borderRadius: 20,
              border: "1px solid rgba(239,68,68,.25)",
            }}>📸 {snapshots.length} capture(s)</span>
          )}
          {status && (
            <button
              className="btn btn-pdf"
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
              title="Télécharger le rapport PDF"
            >
              {pdfLoading
                ? <><Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> Génération…</>
                : <><Download size={13} /> Rapport PDF</>
              }
            </button>
          )}
          {isRunning && (
            <button className="btn btn-danger" onClick={handleStop} style={{ fontWeight: 600 }}>
              <Square size={13} /> Arreter
            </button>
          )}
        </div>
      </div>

      {/* Configuration */}
      {!isRunning && showConfig && (
        <div className="section" style={{ borderLeft: "3px solid #818cf8", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h4 className="section-title" style={{ marginBottom: 0 }}>
              <Settings size={15} style={{ color: "#818cf8" }} /> Configuration
            </h4>
            {hasData && (
              <button className="btn btn-ghost" onClick={() => setShowConfig(false)} style={{ fontSize: 10, padding: "3px 10px" }}>
                <ChevronUp size={11} /> Masquer
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Vitesse (s/point)</label>
              <input className="input" type="number" step="0.001" min="0.001" max="1"
                value={speed} onChange={e => setSpeed(parseFloat(e.target.value) || 0.005)}
                style={{ width: 120 }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Points max (0 = tout)</label>
              <input className="input" type="number" min="0" step="1000"
                value={maxPoints} onChange={e => setMaxPoints(parseInt(e.target.value) || 0)}
                style={{ width: 140 }} />
            </div>
            <button className="btn btn-success" onClick={handleStart}
              disabled={starting || !dataset || patternCount === 0} style={{ height: 38, fontWeight: 600 }}>
              {starting
                ? <><Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> Demarrage...</>
                : <><Play size={14} /> Lancer la detection</>
              }
            </button>
          </div>

          {patternCount !== null && (
            <div style={{
              marginTop: 10, padding: "8px 14px", borderRadius: 8,
              background: patternCount > 0 ? "rgba(52,211,153,.08)" : "rgba(251,191,36,.08)",
              border: "1px solid " + (patternCount > 0 ? "rgba(52,211,153,.15)" : "rgba(251,191,36,.15)"),
              fontSize: 11, color: patternCount > 0 ? "#34d399" : "#fbbf24",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              {patternCount > 0
                ? <><Info size={13} /> {patternCount} pattern(s) de reference disponible(s).</>
                : <><AlertTriangle size={13} /> Aucun pattern sauvegarde. Creez-en dans l'onglet Analyse.</>
              }
            </div>
          )}

          {startError && (
            <div style={{
              marginTop: 10, padding: "8px 14px", borderRadius: 8,
              background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)",
              fontSize: 11, color: "#f87171", display: "flex", alignItems: "center", gap: 6,
            }}>
              <AlertCircle size={13} /> {startError}
            </div>
          )}
        </div>
      )}

      {!isRunning && !showConfig && (
        <div style={{ marginBottom: 12 }}>
          <button className="btn btn-ghost" onClick={() => setShowConfig(true)} style={{ fontSize: 11 }}>
            <Settings size={13} /> Parametres
          </button>
        </div>
      )}

      {/* Dashboard */}
      {(isRunning || hasData) && <StatusDashboard status={status} isRunning={isRunning} />}

      {/* Banniere de fin */}
      {!isRunning && endEvent && <CompletionBanner endEvent={endEvent} />}

      {/* Indicateur de comparaison active + graphique live */}
      {isRunning && (
        <div style={{ marginBottom: 8 }}>
          <ComparingIndicator isRunning={isRunning} evalCount={evalCount} isComparing={isComparing} />
        </div>
      )}

      {/* Graphique live avec overlay */}
      {isRunning && <LiveChartWithOverlay bufferData={bufferData} detectors={detectors} bufferSize={status?.buffer_size} />}

      {/* Detecteurs detailles */}
      {detectors.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h4 style={{
            margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#f1f5f9",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <Target size={15} style={{ color: "#818cf8" }} />
            Detecteurs ({detectors.length})
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[...detectors]
              .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
              .map(d => <DetectorCard key={d.pattern_id} detector={d} />)}
          </div>
        </div>
      )}

      {/* Journal */}
      <EventsTable events={events} isRunning={isRunning} onClear={handleClear} />

      {/* Toast notifications nouveaux matches */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Guide */}
      {!isRunning && !hasData && (
        <div style={{
          textAlign: "center", padding: "50px 30px",
          background: "var(--bg-card)", borderRadius: 16,
          border: "1px solid var(--border-subtle)",
        }}>
          <FileText size={40} style={{ color: "#475569", opacity: .3, marginBottom: 12 }} />
          <h4 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>
            Systeme de Detection Intelligente
          </h4>
          <div style={{ fontSize: 13, color: "#94a3b8", maxWidth: 540, margin: "0 auto", lineHeight: 1.9 }}>
            <p><strong>1.</strong> Sauvegardez des patterns de reference depuis l'onglet <em>Analyse</em></p>
            <p><strong>2.</strong> Lancez la detection ci-dessus</p>
            <p><strong>3.</strong> Le systeme compare en continu le flux avec des prefixes croissants du pattern</p>
            <p><strong>4.</strong> Des que le debut du pattern est reconnu, la confiance monte progressivement</p>
            <p><strong>5.</strong> Le pattern est superpose visuellement sur le flux + prediction du futur</p>
            <p style={{ marginTop: 14, fontSize: 11, color: "#64748b" }}>
              <Info size={12} style={{ verticalAlign: "middle" }} /> La detection est precoce : des 15% du pattern visible, l'alerte commence.
              A 90%+, le pattern est quasi-confirme.
            </p>
          </div>
        </div>
      )}
    </div>
  )
})

export default RealtimeMonitor
