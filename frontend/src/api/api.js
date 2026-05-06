import axios from "axios"

const API = axios.create({
  baseURL: "http://127.0.0.1:8000"
})

// ─── Intercepteur : injecte le token JWT dans chaque requête ──────────────────
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token")
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ─── Intercepteur : redirige vers login si 401 ───────────────────────────────
API.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("auth_token")
      localStorage.removeItem("auth_username")
      window.dispatchEvent(new Event("auth:logout"))
    }
    return Promise.reject(error)
  }
)

// ═══ Authentification ══════════════════════════════════════════════════════════
export const login = async (username, password) => {
  const res = await API.post("/auth/login", { username, password })
  return res.data
}

export const changePassword = async (currentPassword, newPassword, confirmPassword) => {
  const res = await API.post("/auth/change-password", {
    current_password: currentPassword,
    new_password: newPassword,
    confirm_password: confirmPassword,
  })
  return res.data
}

// ═══ Datasets ══════════════════════════════════════════════════════════════════
export const fetchDatasets = async () => {
  const res = await API.get("/datasets")
  return res.data.datasets
}

// ═══ Données ═══════════════════════════════════════════════════════════════════
export const fetchData = async (period = "month", offset = 0, dataset = null, startDate = null, endDate = null) => {
  const params = { period, offset }
  if (dataset) params.dataset = dataset
  if (period === "custom" && startDate && endDate) {
    params.start = startDate
    params.end = endDate
  }
  const res = await API.get("/data", { params })
  return res.data
}

export const fetchDataRange = async (dataset = null) => {
  const params = {}
  if (dataset) params.dataset = dataset
  const res = await API.get("/data/range", { params })
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
export const savePattern = async (start, end, name, description, matchCount, distribution, patternType = "normal", alertThreshold = 55.0, alertType = "anomaly", dataset = null) => {
  const body = {
    start, end, name, description, match_count: matchCount,
    distribution: distribution || null, pattern_type: patternType,
    alert_threshold: alertThreshold, alert_type: alertType
  }
  if (dataset) body.dataset = dataset
  const res = await API.post("/patterns/save", body)
  return res.data
}

export const updatePattern = async (id, updates) => {
  const res = await API.put(`/patterns/${id}`, updates)
  return res.data
}

export const listPatterns = async (dataset = null) => {
  const params = {}
  if (dataset) params.dataset = dataset
  const res = await API.get("/patterns", { params })
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

// ═══ Temps Réel ════════════════════════════════════════════════════════════════
export const startRealtime = async (dataset, speed = 0.005, startIndex = 0, maxPoints = 0) => {
  const res = await API.post("/realtime/start", {
    dataset, speed, start_index: startIndex, max_points: maxPoints
  })
  return res.data
}

export const stopRealtime = async () => {
  const res = await API.post("/realtime/stop")
  return res.data
}

export const getRealtimeStatus = async () => {
  const res = await API.get("/realtime/status")
  return res.data
}

export const getRealtimeEvents = async (limit = 100) => {
  const res = await API.get("/realtime/events", { params: { limit } })
  return res.data
}

export const clearRealtimeEvents = async () => {
  const res = await API.delete("/realtime/events")
  return res.data
}
