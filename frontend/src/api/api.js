import axios from "axios"

const API = axios.create({
  baseURL: "http://127.0.0.1:8000"
})

// ═══ Datasets ══════════════════════════════════════════════════════════════════
export const fetchDatasets = async () => {
  const res = await API.get("/datasets")
  return res.data.datasets
}

// ═══ Données ═══════════════════════════════════════════════════════════════════
export const fetchData = async (page = 0, pageSize = 50000, dataset = null) => {
  const params = { page, page_size: pageSize }
  if (dataset) params.dataset = dataset
  const res = await API.get("/data", { params })
  return res.data
}

// ═══ Analyse ═══════════════════════════════════════════════════════════════════
export const detectPattern = async (start, end, topK = 0, dataset = null) => {
  const body = { start, end, top_k: topK }
  if (dataset) body.dataset = dataset
  const res = await API.post("/pattern", body)
  return res.data
}

export const computeAllScores = async (start, end, nSubseq = 1000, dataset = null) => {
  const body = { start, end, n_subseq: nSubseq }
  if (dataset) body.dataset = dataset
  const res = await API.post("/scores", body)
  return res.data
}

// ═══ Bibliothèque de patterns ══════════════════════════════════════════════════
export const savePattern = async (start, end, name, description, matchCount, distribution, patternType = "normal", dataset = null) => {
  const body = {
    start, end, name, description, match_count: matchCount,
    distribution: distribution || null, pattern_type: patternType
  }
  if (dataset) body.dataset = dataset
  const res = await API.post("/patterns/save", body)
  return res.data
}

export const updatePattern = async (id, updates) => {
  const res = await API.put(`/patterns/${id}`, updates)
  return res.data
}

export const listPatterns = async () => {
  const res = await API.get("/patterns")
  return res.data
}

export const getPattern = async (id) => {
  const res = await API.get(`/patterns/${id}`)
  return res.data
}

export const deletePattern = async (id) => {
  const res = await API.delete(`/patterns/${id}`)
  return res.data
}

export const comparePattern = async (id, start, end, dataset = null) => {
  const body = { start, end }
  if (dataset) body.dataset = dataset
  const res = await API.post(`/patterns/${id}/compare`, body)
  return res.data
}
