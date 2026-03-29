import React, { useState, useEffect } from "react"
import { fetchDatasets } from "../api/api"
import { Zap, Weight, Thermometer, CloudRain, Database, ArrowRight, Activity } from "lucide-react"

const DATASET_META = {
  "C2 elect kw":         { icon: Zap,         color: "#fbbf24", gradient: "linear-gradient(135deg, #f59e0b, #d97706)", label: "Électricité (kW)" },
  "C2 Prod Poid Process": { icon: Weight,     color: "#34d399", gradient: "linear-gradient(135deg, #10b981, #059669)", label: "Poids Process" },
  "C2 Prod Tc Process":  { icon: Thermometer, color: "#60a5fa", gradient: "linear-gradient(135deg, #3b82f6, #2563eb)", label: "Température Process" },
  "C2 Vap kgh":          { icon: CloudRain,   color: "#a78bfa", gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)", label: "Vapeur (kg/h)" },
}

const FALLBACK = { icon: Database, color: "#94a3b8", gradient: "linear-gradient(135deg, #64748b, #475569)", label: "" }

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M"
  if (n >= 1000) return (n / 1000).toFixed(1) + "k"
  return n.toString()
}

export default function DatasetSelector({ onSelect }) {
  const [datasets, setDatasets] = useState([])
  const [loading, setLoading] = useState(true)
  const [hovered, setHovered] = useState(null)

  useEffect(() => {
    fetchDatasets()
      .then(ds => { setDatasets(ds); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px 60px',
      position: 'relative',
    }}>
      {/* Background effects */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: `
          radial-gradient(ellipse 80% 50% at 50% -10%, rgba(129,140,248,0.12), transparent 60%),
          radial-gradient(ellipse 50% 40% at 80% 60%, rgba(59,130,246,0.06), transparent),
          radial-gradient(ellipse 50% 40% at 20% 80%, rgba(168,85,247,0.06), transparent)
        `,
      }} />

      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 56, position: 'relative', zIndex: 1, animation: 'fadeInUp 0.7s ease-out' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 72, height: 72, borderRadius: 20,
          background: 'linear-gradient(135deg, rgba(129,140,248,0.15), rgba(59,130,246,0.1))',
          border: '1px solid rgba(129,140,248,0.2)',
          marginBottom: 24,
          boxShadow: '0 0 40px rgba(129,140,248,0.15)'
        }}>
          <Activity size={32} style={{ color: 'var(--accent-indigo)' }} />
        </div>
        <h1 style={{
          fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em',
          margin: '0 0 16px',
          background: 'linear-gradient(135deg, #f1f5f9 0%, #94a3b8 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          lineHeight: 1.1,
        }}>
          Pattern Recognition
        </h1>
        <p style={{
          fontSize: 17, color: 'var(--text-secondary)',
          maxWidth: 520, margin: '0 auto', lineHeight: 1.7, fontWeight: 400,
        }}>
          Sélectionnez une courbe à analyser pour détecter des motifs récurrents,
          comparer des patterns et surveiller vos données industrielles.
        </p>
      </div>

      {/* Dataset Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', position: 'relative', zIndex: 1 }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
          <p style={{ color: 'var(--text-muted)', marginTop: 16, fontSize: 14 }}>Chargement des datasets…</p>
        </div>
      ) : (
        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 1000 }}>
          <p style={{
            fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '2px',
            marginBottom: 24, textAlign: 'center',
          }}>
            Courbes disponibles
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 20 }}>
            {datasets.map((ds, i) => {
              const meta = DATASET_META[ds.name] || FALLBACK
              const Icon = meta.icon
              const isHovered = hovered === i
              return (
                <div
                  key={ds.filename}
                  style={{
                    background: isHovered ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                    backdropFilter: 'blur(20px)',
                    border: `1px solid ${isHovered ? `${meta.color}40` : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-xl)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: isHovered ? 'translateY(-6px)' : 'translateY(0)',
                    boxShadow: isHovered
                      ? `0 20px 40px rgba(0,0,0,0.3), 0 0 30px ${meta.color}15`
                      : 'var(--shadow-md)',
                    animation: `fadeInUp 0.5s ease-out ${i * 0.1}s both`,
                  }}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => onSelect(ds.filename)}
                >
                  {/* Card Header */}
                  <div style={{
                    padding: '28px 24px 20px',
                    background: meta.gradient,
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      position: 'absolute', top: -20, right: -20,
                      width: 80, height: 80, borderRadius: '50%',
                      background: 'rgba(255,255,255,0.1)',
                    }} />
                    <Icon size={36} style={{ color: '#fff', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
                  </div>

                  {/* Card Body */}
                  <div style={{ padding: '20px 24px 24px' }}>
                    <h3 style={{
                      fontSize: 16, fontWeight: 700, color: 'var(--text-primary)',
                      margin: '0 0 4px',
                    }}>
                      {meta.label || ds.name}
                    </h3>
                    <p style={{
                      fontSize: 11, color: 'var(--text-muted)', margin: '0 0 16px',
                      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    }}>
                      {ds.filename}
                    </p>

                    {/* Stats */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
                      padding: '10px 14px', marginBottom: 16,
                    }}>
                      {[
                        { val: formatNumber(ds.rows_estimate), lab: 'points' },
                        { val: ds.size_kb + ' KB', lab: 'taille' },
                        { val: ds.columns.length, lab: 'cols' },
                      ].map((s, j) => (
                        <React.Fragment key={j}>
                          {j > 0 && <div style={{ width: 1, height: 24, background: 'var(--border-default)' }} />}
                          <div style={{ textAlign: 'center', flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{s.val}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px', marginTop: 2 }}>{s.lab}</div>
                          </div>
                        </React.Fragment>
                      ))}
                    </div>

                    {/* CTA Button */}
                    <button style={{
                      width: '100%', padding: '10px 0',
                      border: `1px solid ${isHovered ? 'transparent' : meta.color + '40'}`,
                      borderRadius: 'var(--radius-md)',
                      fontSize: 13, fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      background: isHovered ? meta.gradient : 'transparent',
                      color: isHovered ? '#fff' : meta.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      fontFamily: "'Inter', sans-serif",
                    }}>
                      Analyser <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
