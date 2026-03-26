import axios from "axios"

const API = axios.create({
  baseURL: "http://127.0.0.1:8000"
})

// ═══ Données ═══════════════════════════════════════════════════════════════════
export const fetchData = async (page = 0, pageSize = 50000) => {
  const res = await API.get("/data", { params: { page, page_size: pageSize } })
  return res.data
}

// ═══ Analyse ═══════════════════════════════════════════════════════════════════
export const detectPattern = async (start, end, topK = 0) => {
  const res = await API.post("/pattern", { start, end, top_k: topK })
  return res.data
}

export const computeAllScores = async (start, end, nSubseq = 1000) => {
  const res = await API.post("/scores", { start, end, n_subseq: nSubseq })
  return res.data
}

// ═══ Bibliothèque de patterns ══════════════════════════════════════════════════
export const savePattern = async (start, end, name, description, matchCount, distribution) => {
  const res = await API.post("/patterns/save", {
    start, end, name, description, match_count: matchCount,
    distribution: distribution || null
  })
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

export const comparePattern = async (id, start, end) => {
  const res = await API.post(`/patterns/${id}/compare`, { start, end })
  return res.data
}
