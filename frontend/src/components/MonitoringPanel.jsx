import React, { memo, useState, useCallback } from "react"
import { savePattern } from "../api/api"
import {
  Activity, Clock, Hash, TrendingUp, TrendingDown, Minus,
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

const DistributionBar = memo(({ distribution }) => {
  const total = distribution.excellent.count + distribution.good.count + distribution.low.count
  if (total === 0) return null
  const segs = [
    { ...distribution.excellent, key: "excellent", bg: "var(--accent-emerald)" },
    { ...distribution.good, key: "good", bg: "var(--accent-blue)" },
    { ...distribution.low, key: "low", bg: "var(--accent-amber)" },
  ]
  return (
    <div>
      <div className="distribution-bar" style={{ marginBottom: 10 }}>
        {segs.map(s => {
          const pct = (s.count / total) * 100
          if (pct === 0) return null
          return (
            <div key={s.key} style={{
              width: `${pct}%`, background: s.bg,
              minWidth: s.count > 0 ? 32 : 0
            }}>
              {s.count}
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)' }}>
        {segs.map(s => (
          <span key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.bg, display: 'inline-block' }} />
            {s.label} : {s.count}
          </span>
        ))}
      </div>
    </div>
  )
})

const MonitoringPanel = memo(({ monitoring, matchCount, onPatternSaved, dataset }) => {
  const [saving, setSaving] = useState(false)
  const [saveName, setSaveName] = useState("")
  const [saveDesc, setSaveDesc] = useState("")
  const [patternType, setPatternType] = useState("normal")
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
      const res = await savePattern(pi.start, pi.end, saveName.trim(), saveDesc.trim(), matchCount || 0, dist, patternType, dataset)
      if (res.error) { setSaveMsg({ type: "error", text: res.error }) }
      else {
        setSaveMsg({ type: "ok", text: res.message })
        setSaveName("")
        setSaveDesc("")
        setPatternType("normal")
        setShowSaveForm(false)
        if (onPatternSaved) onPatternSaved()
      }
    } catch { setSaveMsg({ type: "error", text: "Erreur réseau." }) }
    setSaving(false)
  }, [saveName, saveDesc, patternType, monitoring, matchCount, onPatternSaved, dataset])

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
      <div className="section">
        <h4 className="section-title"><BarChart3 size={15} /> Distribution des similitudes</h4>
        <DistributionBar distribution={distribution} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          <StatCard title="Excellent (80–100%)" value={distribution.excellent.count} unit="cycles" colorClass="stat-card-emerald" icon={Award} />
          <StatCard title="Bon (50–79%)" value={distribution.good.count} unit="cycles" colorClass="stat-card-blue" icon={Target} />
          <StatCard title="Faible (<50%)" value={distribution.low.count} unit="cycles" colorClass="stat-card-amber" icon={Minus} />
        </div>
      </div>

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
