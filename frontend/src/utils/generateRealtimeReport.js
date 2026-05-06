import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

const C = {
  primary: [79,  70,  229],
  danger:  [220, 38,  38 ],
  warning: [217, 119, 6  ],
  success: [5,   150, 105],
  info:    [37,  99,  235],
  muted:   [100, 116, 139],
  text:    [15,  23,  42 ],
  border:  [226, 232, 240],
  white:   [255, 255, 255],
  bgLight: [248, 250, 252],
  bgCard:  [30,  41,  59 ],
}

const LEVEL_META = {
  normal:       { label: "Normal",       color: C.success },
  surveillance: { label: "Surveillance", color: C.info    },
  attention:    { label: "Attention",    color: C.warning },
  danger:       { label: "Danger",       color: [239, 68, 68] },
  critique:     { label: "Critique",     color: C.danger  },
}
const LEVELS_ORDER = ["normal", "surveillance", "attention", "danger", "critique"]

function getHighestLevel(detectors) {
  let best = 0
  detectors.forEach(d => {
    const i = LEVELS_ORDER.indexOf(d.alert_level || "normal")
    if (i > best) best = i
  })
  return LEVELS_ORDER[best]
}

function fmtNum(n, d = 1) { return n == null ? "-" : Number(n).toFixed(d) }

function setFont(doc, size, style, color) {
  if (!style) style = "normal"
  if (!color) color = C.text
  doc.setFontSize(size); doc.setFont("helvetica", style); doc.setTextColor(...color)
}
function fillRect(doc, x, y, w, h, color) {
  doc.setFillColor(...color); doc.rect(x, y, w, h, "F")
}

/**
 * @param {object}   status    - full realtime status from API
 * @param {string}   dataset   - dataset filename
 * @param {Array}    snapshots - [{ timestamp, patternName, confidence, level, imageData }]
 */
export function generateRealtimeReport(status, dataset, snapshots) {
  if (!snapshots) snapshots = []
  const doc   = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const M     = 18
  const CW    = pageW - M * 2
  const now   = new Date()
  let y       = 0

  const checkPage = function(need) {
    if (!need) need = 40
    if (y + need > pageH - 18) { doc.addPage(); y = 20 }
  }

  const detectors    = (status && status.detectors) ? status.detectors : []
  const events       = (status && status.events)    ? status.events    : []
  const totalAlerts  = detectors.reduce(function(s, d) { return s + (d.detections_count || 0) }, 0)
  const highestLevel = getHighestLevel(detectors)
  const levelMeta    = LEVEL_META[highestLevel] || LEVEL_META.normal
  const isAnomaly    = totalAlerts > 0 || highestLevel === "danger" || highestLevel === "critique"
  const anomalyEvents = events.filter(function(e) {
    return e.type === "new_match" ||
      (e.type === "level_change" && (e.to_level === "danger" || e.to_level === "critique"))
  })

  // --- HEADER ---
  fillRect(doc, 0, 0, pageW, 30, C.primary)
  fillRect(doc, 0, 0, 4, 30, isAnomaly ? C.danger : C.success)
  setFont(doc, 7, "normal", [199, 210, 254])
  doc.text("RAPPORT DE SURVEILLANCE INDUSTRIELLE", M + 2, 9)
  setFont(doc, 17, "bold", C.white)
  doc.text("Analyse des anomalies", M + 2, 22)
  setFont(doc, 8, "normal", [199, 210, 254])
  const ds = now.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
  doc.text(ds, pageW - M - doc.getTextWidth(ds), 22)

  y = 38

  setFont(doc, 8.5, "normal", C.muted)
  const dsName = (dataset || "-").replace(/[^\x00-\x7F]/g, "?")
  doc.text("Jeu de donnees : " + dsName + "   -   Genere le " + now.toLocaleString("fr-FR"), M, y)
  y += 10

  // --- KPI BOXES ---
  const kpiBoxH = 28
  const kpiBoxW = (CW - 9) / 4
  const kpis = [
    {
      label: "ANOMALIES DETECTEES",
      value: String(totalAlerts),
      color: totalAlerts > 0 ? C.danger : C.success,
      bg:    totalAlerts > 0 ? [254,242,242] : [240,253,250],
    },
    {
      label: "PATTERNS SURVEILLES",
      value: String(detectors.length),
      color: C.primary,
      bg:    [238, 242, 255],
    },
    {
      label: "NIVEAU D'ALERTE MAX",
      value: levelMeta.label,
      color: levelMeta.color,
      bg:    [248, 250, 252],
    },
    {
      label: "POINTS ANALYSES",
      value: ((status && status.total_points) ? status.total_points : 0).toLocaleString("fr-FR"),
      color: C.info,
      bg:    [239, 246, 255],
    },
  ]

  kpis.forEach(function(k, i) {
    const bx = M + i * (kpiBoxW + 3)
    const by = y
    fillRect(doc, bx, by, kpiBoxW, kpiBoxH, k.bg)
    doc.setDrawColor(...k.color); doc.setLineWidth(2.5)
    doc.line(bx, by, bx + kpiBoxW, by)
    doc.setLineWidth(0.25); doc.rect(bx, by, kpiBoxW, kpiBoxH)
    setFont(doc, 7, "bold", k.color)
    doc.text(k.label, bx + 4, by + 8)
    setFont(doc, 16, "bold", k.color)
    doc.text(k.value, bx + 4, by + 22)
  })
  y += kpiBoxH + 8

  // --- STATUS BANNER ---
  const bannerBg    = isAnomaly ? [254,242,242] : [240,253,250]
  const bannerColor = isAnomaly ? C.danger      : C.success
  fillRect(doc, M, y, CW, 13, bannerBg)
  doc.setDrawColor(...bannerColor); doc.setLineWidth(3)
  doc.line(M, y, M, y + 13)
  doc.setLineWidth(0.2); doc.rect(M, y, CW, 13)
  setFont(doc, 9.5, "bold", bannerColor)
  const bannerTxt = isAnomaly
    ? String(totalAlerts) + " anomalie(s) detectee(s) sur " + String(detectors.length) + " pattern(s) surveille(s)"
    : "Aucune anomalie detectee - comportement normal sur toute la plage analysee"
  doc.text(bannerTxt, M + 7, y + 8.5)
  y += 20

  // --- RESUME PAR PATTERN ---
  if (detectors.length > 0) {
    checkPage(50)
    fillRect(doc, M, y, CW, 8, [238, 242, 255])
    setFont(doc, 9, "bold", C.primary)
    doc.text("RESUME PAR PATTERN", M + 4, y + 5.5)
    y += 12

    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      styles: {
        fontSize: 9, font: "helvetica",
        cellPadding: { top: 4, bottom: 4, left: 5, right: 5 },
        textColor: C.text, lineColor: C.border, lineWidth: 0.2,
      },
      headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: "bold", fontSize: 8.5 },
      alternateRowStyles: { fillColor: C.bgLight },
      columnStyles: {
        0: { cellWidth: 58 },
        1: { cellWidth: 24, halign: "center" },
        2: { cellWidth: 34, halign: "center" },
        3: { cellWidth: 20, halign: "center" },
        4: { cellWidth: "auto", halign: "center" },
      },
      head: [["Nom du pattern", "Type", "Niveau alerte", "Alertes", "Statut"]],
      body: detectors.map(function(d) {
        return [
          d.name || "-",
          d.pattern_type === "failure" ? "Panne" : "Normal",
          (LEVEL_META[d.alert_level] || LEVEL_META.normal).label,
          String(d.detections_count || 0),
          d.alarm_triggered ? "ALARME" : (d.detections_count > 0 ? "Alerte" : "OK"),
        ]
      }),
      didDrawCell: function(data) {
        if (data.section !== "body") return
        const det = detectors[data.row.index]
        if (data.column.index === 2) {
          const lm = LEVEL_META[det && det.alert_level] || LEVEL_META.normal
          doc.setFillColor(...lm.color)
          doc.roundedRect(data.cell.x + 3, data.cell.y + 2, data.cell.width - 6, data.cell.height - 4, 2, 2, "F")
          doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont("helvetica", "bold")
          const t = lm.label
          doc.text(t, data.cell.x + (data.cell.width - doc.getTextWidth(t)) / 2, data.cell.y + data.cell.height / 2 + 1.5)
          return false
        }
        if (data.column.index === 4) {
          const alarm = det && det.alarm_triggered
          const alert = (det && det.detections_count || 0) > 0
          const c = alarm ? C.danger : alert ? [217,119,6] : C.success
          const bg = alarm ? [254,242,242] : alert ? [255,251,235] : [240,253,250]
          doc.setFillColor(...bg)
          doc.roundedRect(data.cell.x + 3, data.cell.y + 2, data.cell.width - 6, data.cell.height - 4, 2, 2, "F")
          doc.setTextColor(...c); doc.setFontSize(8.5); doc.setFont("helvetica", "bold")
          const t = alarm ? "ALARME" : alert ? "Alerte" : "OK"
          doc.text(t, data.cell.x + (data.cell.width - doc.getTextWidth(t)) / 2, data.cell.y + data.cell.height / 2 + 1.5)
          return false
        }
      },
    })
    y = doc.lastAutoTable.finalY + 12
  }

  // --- EVENEMENTS D'ANOMALIE ---
  if (anomalyEvents.length > 0) {
    checkPage(50)
    fillRect(doc, M, y, CW, 8, [254, 242, 242])
    setFont(doc, 9, "bold", C.danger)
    doc.text("EVENEMENTS D'ANOMALIE  (" + String(anomalyEvents.length) + ")", M + 4, y + 5.5)
    y += 12

    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      styles: {
        fontSize: 8.5, font: "helvetica",
        cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 },
        textColor: C.text, lineColor: C.border, lineWidth: 0.2,
      },
      headStyles: { fillColor: [220, 38, 38], textColor: C.white, fontStyle: "bold", fontSize: 8.5 },
      alternateRowStyles: { fillColor: [254, 248, 248] },
      columnStyles: {
        0: { cellWidth: 52 },
        1: { cellWidth: "auto" },
        2: { cellWidth: 28, halign: "center" },
        3: { cellWidth: 14, halign: "center" },
      },
      head: [["Pattern concerne", "Evenement detecte", "Confiance", "No"]],
      body: anomalyEvents.slice().reverse().map(function(e, i) {
        const evtTxt = e.type === "new_match"
          ? "Correspondance complete (match #" + String(e.detections_count || 1) + ")"
          : "Escalade vers niveau " + ((LEVEL_META[e.to_level] || {}).label || e.to_level || "-")
        return [
          e.pattern_name || "-",
          evtTxt,
          fmtNum(e.confidence, 0) + "%",
          String(anomalyEvents.length - i),
        ]
      }),
    })
    y = doc.lastAutoTable.finalY + 12
  } else if (!isAnomaly) {
    checkPage(20)
    fillRect(doc, M, y, CW, 14, [240, 253, 250])
    doc.setDrawColor(...C.success); doc.setLineWidth(3)
    doc.line(M, y, M, y + 14)
    doc.setLineWidth(0.2); doc.rect(M, y, CW, 14)
    setFont(doc, 10, "bold", C.success)
    doc.text("Aucune anomalie enregistree durant cette session d'analyse.", M + 7, y + 9)
    y += 22
  }

  // --- CAPTURES ---
  if (snapshots && snapshots.length > 0) {
    doc.addPage(); y = 18
    fillRect(doc, 0, 0, pageW, 16, C.danger)
    setFont(doc, 11, "bold", C.white)
    doc.text("CAPTURES - ANOMALIES DETECTEES EN TEMPS REEL", M, 11)
    y = 24

    snapshots.forEach(function(snap, idx) {
      checkPage(snap.imageData ? 100 : 30)
      fillRect(doc, M, y, CW, 12, [254, 242, 242])
      doc.setDrawColor(...C.danger); doc.setLineWidth(3)
      doc.line(M, y, M, y + 12)
      doc.setLineWidth(0.2); doc.rect(M, y, CW, 12)
      const lm = LEVEL_META[snap.level] || LEVEL_META.normal
      const tsStr = new Date(snap.timestamp).toLocaleString("fr-FR")
      setFont(doc, 9, "bold", C.danger)
      doc.text("#" + String(idx + 1) + "  " + (snap.patternName || "-"), M + 6, y + 5.5)
      setFont(doc, 8, "normal", C.muted)
      doc.text("Confiance " + fmtNum(snap.confidence, 0) + "%  -  Niveau " + lm.label + "  -  " + tsStr, M + 6, y + 10)
      y += 16
      if (snap.imageData) {
        const imgH = 72
        try { doc.addImage(snap.imageData, "PNG", M, y, CW, imgH) } catch (_) {}
        y += imgH + 8
      }
      if (idx < snapshots.length - 1) {
        doc.setDrawColor(...C.border); doc.setLineWidth(0.3)
        doc.line(M, y, M + CW, y)
        y += 8
      }
    })
  }

  // --- FOOTER ---
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    fillRect(doc, 0, pageH - 9, pageW, 9, C.bgLight)
    doc.setDrawColor(...C.border); doc.setLineWidth(0.3)
    doc.line(0, pageH - 9, pageW, pageH - 9)
    setFont(doc, 7, "normal", C.muted)
    doc.text("Systeme de surveillance industrielle - Pattern Recognition", M, pageH - 3)
    const p = "Page " + String(i) + " / " + String(pageCount)
    doc.text(p, pageW - M - doc.getTextWidth(p), pageH - 3)
  }

  const dateTag = now.toISOString().slice(0, 10)
  const dsTag = (dataset || "session").replace(/\s/g, "_")
  doc.save("rapport_anomalies_" + dsTag + "_" + dateTag + ".pdf")
}