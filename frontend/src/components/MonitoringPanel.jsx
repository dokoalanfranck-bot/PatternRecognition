import React, { memo, useState, useCallback, useMemo } from "react"
import { savePattern } from "../api/api"
import {
  Activity, Clock, Hash, TrendingUp, TrendingDown,
  Award, Target, BarChart3, Save, X, Check, AlertCircle, Zap, Sigma
} from "lucide-react"

function fmt(v, d = 2) {
  if (v === undefined || v === null) return "-"
  return typeof v === "number" ? v.toLocaleString("fr-FR", { maximumFractionDigits: d }) : v
}

function formatDate(d) {
  if (!d) return "-"
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  })
}

const StatCard = memo(({ title, value, unit, colorClass, icon: Icon }) => (
  <div className={`stat-card ${colorClass || 'stat-card-indigo'}`}>
    <div className="stat-label">
      {Icon && <Icon size={12} />} {title}
    </div>
    <div className="stat-value">
      {value}
      {unit && <span className="stat-unit">{unit}</span>}
    </div>
  </div>
))

const BUCKET_COLOR = (min) => {
  if (min >= 80) return "#34d399"
  if (min >= 50) return "#60a5fa"
  if (min >= 30) return "#fbbf24"
  return "#f87171"
}

const SimilarityDistribution = memo(({ matches, threshold, onThresholdChange }) => {
  const buckets = useMemo(() => {
    const b = Array.from({ length: 10 }, (_, i) => ({ min: i * 10, max: (i + 1) * 10, count: 0 }))
    matches.forEach(m => {
      const sim = m.similarity ?? 0
      const idx = Math.min(9, Math.floor(sim / 10))
      b[idx].count++
    })
    return b
  }, [matches])

  const maxCount = useMemo(() => Math.max(...buckets.map(b => b.count), 1), [buckets])
  const above = useMemo(() => matches.filter(m => (m.similarity ?? 0) >= threshold).length, [matches, threshold])
  const below = matches.length - above

  return (
    <div>
      {/* Mini histogramme */}
      <div style={{ position: 'relative', height: 72, display: 'flex', alignItems: 'flex-end', gap: 3, marginBottom: 6 }}>
        {buckets.map(b => {
          const h = (b.count / maxCount) * 64
          const midpoint = b.min + 5
          const active = midpoint >= threshold
          const color = BUCKET_COLOR(b.min)
          return (
            <div key={b.min} title={`${b.min}–${b.max}% : ${b.count} matches`}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
              <div style={{
                width: '100%',
                height: Math.max(h, b.count > 0 ? 4 : 0),
                background: active ? color : `${color}28`,
                borderRadius: '3px 3px 0 0',
                transition: 'all 0.2s ease',
                boxShadow: active && b.count > 0 ? `0 0 8px ${color}55` : 'none',
              }} />
            </div>
          )
        })}
        {/* Ligne de seuil verticale */}
        <div style={{
          position: 'absolute',
          left: `${threshold}%`,
          top: 0, bottom: 0,
          width: 2,
          background: 'linear-gradient(180deg, #f59e0b, rgba(245,158,11,0.4))',
          boxShadow: '0 0 10px rgba(245,158,11,0.7)',
          borderRadius: 2,
          pointerEvents: 'none',
          transition: 'left 0.08s',
          zIndex: 2,
        }} />
      </div>

      {/* Axe X */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginBottom: 14 }}>
        {['0%', '25%', '50%', '75%', '100%'].map(l => <span key={l}>{l}</span>)}
      </div>

      {/* Barre de seuil glissante */}
      <div style={{ position: 'relative', marginBottom: 20, userSelect: 'none' }}>
        {/* Track gradient */}
        <div style={{
          height: 8, borderRadius: 4,
          background: 'linear-gradient(90deg, #f87171 0%, #fbbf24 30%, #60a5fa 50%, #34d399 80%)',
          position: 'relative',
        }}>
          {/* Overlay foncé sur la partie "hors seuil" */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${threshold}%`,
            background: 'rgba(5,10,24,0.62)',
            borderRadius: '4px 0 0 4px',
            transition: 'width 0.08s',
          }} />
        </div>

        {/* Input range invisible dessus */}
        <input
          type="range" min={0} max={100} step={1} value={threshold}
          onChange={e => onThresholdChange(Number(e.target.value))}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            opacity: 0, cursor: 'pointer', margin: 0,
          }}
        />

        {/* Thumb visuel */}
        <div style={{
          position: 'absolute',
          top: '50%', left: `${threshold}%`,
          transform: 'translate(-50%, -50%)',
          width: 22, height: 22,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #fde68a, #f59e0b)',
          border: '3px solid rgba(255,255,255,0.85)',
          boxShadow: '0 2px 12px rgba(245,158,11,0.6), 0 0 0 4px rgba(245,158,11,0.12)',
          pointerEvents: 'none',
          transition: 'left 0.08s',
          zIndex: 3,
        }} />

        {/* Tooltip seuil */}
        <div style={{
          position: 'absolute',
          top: -26, left: `${threshold}%`,
          transform: 'translateX(-50%)',
          background: '#f59e0b',
          color: '#000',
          fontSize: 11, fontWeight: 800,
          padding: '2px 7px', borderRadius: 5,
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
          pointerEvents: 'none',
          transition: 'left 0.08s',
          zIndex: 3,
        }}>
          {threshold}%
          <div style={{
            position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
            borderTop: '5px solid #f59e0b',
          }} />
        </div>
      </div>

      {/* Cartes résumé */}
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{
          flex: 1, borderRadius: 10,
          padding: '10px 14px',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(99,102,241,0.06))',
          border: '1px solid rgba(99,102,241,0.25)',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
            ≥ {threshold}% · dans le seuil
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: '#818cf8', lineHeight: 1 }}>{above}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>matches</span>
            {matches.length > 0 && (
              <span style={{ fontSize: 12, color: '#818cf8', fontWeight: 700, marginLeft: 'auto' }}>
                {((above / matches.length) * 100).toFixed(0)}%
              </span>
            )}
          </div>
        </div>

        <div style={{
          flex: 1, borderRadius: 10,
          padding: '10px 14px',
          background: 'rgba(15,23,42,0.45)',
          border: '1px solid rgba(148,163,184,0.12)',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
            &lt; {threshold}% · hors seuil
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-secondary)', lineHeight: 1 }}>{below}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>matches</span>
            {matches.length > 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, marginLeft: 'auto' }}>
                {((below / matches.length) * 100).toFixed(0)}%
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

const MonitoringPanel = memo(({ monitoring, matchCount, matches = [], onPatternSaved, dataset }) => {
  const [saving, setSaving] = useState(false)
  const [distThreshold, setDistThreshold] = useState(50)
  const [saveName, setSaveName] = useState("")
  const [saveDesc, setSaveDesc] = useState("")
  const [patternType, setPatternType] = useState("normal")
  const [alertThreshold, setAlertThreshold] = useState(55.0)
  // alertType est dérivé automatiquement du patternType
  const alertType = patternType === "failure" ? "failure" : "anomaly"
  const [saveMsg, setSaveMsg] = useState(null)
  const [showSaveForm, setShowSaveForm] = useState(false)

  const handleSave = useCallback(async () => {
    if (!saveName.trim()) return
    const pi = monitoring?.pattern_info
    if (!pi) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const dist = monitoring?.distribution || null
      const res = await savePattern(pi.start, pi.end, saveName.trim(), saveDesc.trim(), matchCount || 0, dist, patternType, alertThreshold, alertType, dataset)
      if (res.error) { setSaveMsg({ type: "error", text: res.error }) }
      else {
        setSaveMsg({ type: "ok", text: res.message })
        setSaveName("")
        setSaveDesc("")
        setPatternType("normal")
        setAlertThreshold(55.0)
        setShowSaveForm(false)
        if (onPatternSaved) onPatternSaved()
      }
    } catch { setSaveMsg({ type: "error", text: "Erreur réseau." }) }
    setSaving(false)
  }, [saveName, saveDesc, patternType, alertThreshold, alertType, monitoring, matchCount, onPatternSaved, dataset])

  if (!monitoring) return null
  const { pattern_info: pi, search_info: si, distribution, score_stats: ss } = monitoring

  return (
    <div style={{ marginTop: 20 }} className="animate-in">
      {/* Section Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16, paddingBottom: 10,
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <h3 style={{
          margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Activity size={18} style={{ color: 'var(--accent-indigo)' }} />
          Monitoring de la détection
        </h3>
        {!showSaveForm && (
          <button className="btn btn-success" onClick={() => setShowSaveForm(true)}>
            <Save size={14} /> Sauvegarder
          </button>
        )}
      </div>

      {/* Save Form */}
      {showSaveForm && (
        <div className="section animate-in" style={{ borderLeft: '3px solid var(--accent-emerald)', marginBottom: 16 }}>
          <h4 className="section-title"><Save size={15} /> Sauvegarder dans la bibliothèque</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input className="input" value={saveName} onChange={e => setSaveName(e.target.value)}
              placeholder="Nom du pattern (obligatoire)" />
            <textarea className="input" value={saveDesc} onChange={e => setSaveDesc(e.target.value)}
              placeholder="Description (optionnel)" rows={2} />
            
            {/* Type de pattern */}
            <div style={{ 
              display: 'flex', gap: 12, padding: '12px', 
              background: 'var(--surface-overlay)', borderRadius: 8,
              border: '1px solid var(--border-subtle)'
            }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                flex: 1, padding: '8px 12px', borderRadius: 6,
                background: patternType === "normal" ? "rgba(34, 197, 94, 0.15)" : "transparent",
                border: patternType === "normal" ? "1px solid var(--accent-emerald)" : "1px solid transparent",
                transition: 'all 0.2s'
              }}>
                <input type="radio" name="patternType" value="normal" checked={patternType === "normal"}
                  onChange={e => setPatternType(e.target.value)}
                  style={{ cursor: 'pointer' }} />
                <TrendingUp size={14} style={{ color: 'var(--accent-emerald)' }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Consommation Normale</span>
              </label>
              
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                flex: 1, padding: '8px 12px', borderRadius: 6,
                background: patternType === "failure" ? "rgba(239, 68, 68, 0.15)" : "transparent",
                border: patternType === "failure" ? "1px solid var(--accent-rose)" : "1px solid transparent",
                transition: 'all 0.2s'
              }}>
                <input type="radio" name="patternType" value="failure" checked={patternType === "failure"}
                  onChange={e => setPatternType(e.target.value)}
                  style={{ cursor: 'pointer' }} />
                <AlertCircle size={14} style={{ color: 'var(--accent-rose)' }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Pattern de Panne</span>
              </label>
            </div>

            {/* Type d'alerte et seuil */}
            <div style={{ 
              display: 'flex', flexDirection: 'column', gap: 10, padding: '14px', 
              background: 'var(--surface-overlay)', borderRadius: 8,
              border: `1px solid ${alertType === "anomaly" ? "rgba(99,102,241,0.3)" : "rgba(239,68,68,0.3)"}`
            }}>
              {/* Badge type d'alerte auto-dérivé */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: alertType === "anomaly" ? "rgba(99,102,241,0.15)" : "rgba(239,68,68,0.15)",
                  color: alertType === "anomaly" ? "var(--accent-indigo)" : "var(--accent-rose)",
                  border: `1px solid ${alertType === "anomaly" ? "var(--accent-indigo)" : "var(--accent-rose)"}`,
                }}>
                  {alertType === "anomaly" ? "⚡ Alerte ANOMALIE" : "🔴 Alerte PANNE"}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {alertType === "anomaly"
                    ? `→ Alerte si similarité < ${alertThreshold.toFixed(0)}%`
                    : `→ Alerte si similarité ≥ ${alertThreshold.toFixed(0)}%`}
                </span>
              </div>

              {/* Slider seuil */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span>Seuil de similarité</span>
                  <span style={{ 
                    fontWeight: 800, fontSize: 14,
                    color: alertType === "anomaly" ? "var(--accent-indigo)" : "var(--accent-rose)"
                  }}>
                    {alertThreshold.toFixed(0)}%
                  </span>
                </label>
                <input type="range" min="10" max="95" step="5" value={alertThreshold}
                  onChange={e => setAlertThreshold(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: alertType === "anomaly" ? "#818cf8" : "#f87171" }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                  <span>10% (relâché)</span>
                  <span>50% (normal)</span>
                  <span>95% (strict)</span>
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-success" onClick={handleSave} disabled={saving || !saveName.trim()}>
                {saving ? "Sauvegarde…" : <><Check size={14} /> Confirmer</>}
              </button>
              <button className="btn" onClick={() => { setShowSaveForm(false); setSaveMsg(null) }}>
                <X size={14} /> Annuler
              </button>
            </div>
          </div>
          {saveMsg && (
            <div style={{
              marginTop: 10, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
              color: saveMsg.type === "ok" ? 'var(--accent-emerald)' : 'var(--accent-rose)'
            }}>
              {saveMsg.type === "ok" ? <Check size={14} /> : <AlertCircle size={14} />}
              {saveMsg.text}
            </div>
          )}
        </div>
      )}

      {/* Distribution */}
      {matches.length > 0 && (
        <div className="section">
          <h4 className="section-title"><BarChart3 size={15} /> Distribution des similitudes
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>
              {matches.length} matches détectés
            </span>
          </h4>
          <SimilarityDistribution
            matches={matches}
            threshold={distThreshold}
            onThresholdChange={setDistThreshold}
          />
        </div>
      )}

      {/* Pattern Info */}
      <div className="section">
        <h4 className="section-title"><Zap size={15} /> Pattern sélectionné</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: 12, marginBottom: 14 }}>
          <div><span style={{ color: 'var(--text-muted)' }}>Début :</span> <strong style={{ color: 'var(--text-primary)' }}>{formatDate(pi.start)}</strong></div>
          <div><span style={{ color: 'var(--text-muted)' }}>Fin :</span> <strong style={{ color: 'var(--text-primary)' }}>{formatDate(pi.end)}</strong></div>
          <div><span style={{ color: 'var(--text-muted)' }}>Durée :</span> <strong style={{ color: 'var(--text-primary)' }}>{fmt(pi.duration_hours)} h</strong></div>
          <div><span style={{ color: 'var(--text-muted)' }}>Points :</span> <strong style={{ color: 'var(--text-primary)' }}>{fmt(pi.nb_points, 0)}</strong></div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <StatCard title="Moyenne" value={fmt(pi.mean)} unit="kW" colorClass="stat-card-blue" icon={TrendingUp} />
          <StatCard title="Écart-type" value={fmt(pi.std)} unit="kW" colorClass="stat-card-violet" icon={Sigma} />
          <StatCard title="Min" value={fmt(pi.min)} unit="kW" colorClass="stat-card-emerald" icon={TrendingDown} />
          <StatCard title="Max" value={fmt(pi.max)} unit="kW" colorClass="stat-card-rose" icon={TrendingUp} />
          <StatCard title="Amplitude" value={fmt(pi.amplitude)} unit="kW" colorClass="stat-card-amber" icon={Activity} />
          <StatCard title="Énergie totale" value={fmt(pi.energy_total, 0)} unit="kW·pts" colorClass="stat-card-cyan" icon={Zap} />
        </div>
      </div>

      {/* Scores MASS */}
      {ss?.best_score !== undefined && (
        <div className="section">
          <h4 className="section-title"><Target size={15} /> Scores MASS</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <StatCard title="Meilleur" value={fmt(ss.best_score, 4)} unit="MASS" colorClass="stat-card-emerald" icon={Award} />
            <StatCard title="Moyen" value={fmt(ss.avg_score, 4)} unit="MASS" colorClass="stat-card-blue" icon={TrendingUp} />
            <StatCard title="Médian" value={fmt(ss.median_score, 4)} unit="MASS" colorClass="stat-card-violet" icon={Target} />
            <StatCard title="Pire" value={fmt(ss.worst_score, 4)} unit="MASS" colorClass="stat-card-rose" icon={TrendingDown} />
          </div>
        </div>
      )}

      {/* Pipeline */}
      <div className="section">
        <h4 className="section-title"><Hash size={15} /> Pipeline de recherche</h4>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
          <span>Série : <strong style={{ color: 'var(--text-primary)' }}>{fmt(si.series_length, 0)}</strong> points</span>
          <span>Positions : <strong style={{ color: 'var(--text-primary)' }}>{fmt(si.total_positions_scanned, 0)}</strong></span>
          <span>Matches : <strong style={{ color: 'var(--text-primary)' }}>{si.matches_returned}</strong></span>
          <span><Clock size={12} style={{ verticalAlign: 'middle' }} /> <strong style={{ color: 'var(--text-primary)' }}>{fmt(si.computation_time_sec, 3)} s</strong></span>
        </div>
      </div>
    </div>
  )
})

export default MonitoringPanel
