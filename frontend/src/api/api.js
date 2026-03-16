import axios from "axios"

const API = axios.create({
  baseURL: "http://127.0.0.1:8000"
})

export const fetchData = async () => {
  const res = await API.get("/data")
  return res.data
}

export const detectPattern = async (start, end, topK = 10) => {
  const res = await API.post("/pattern", { start, end, top_k: topK })
  return res.data
}

export const computeAllScores = async (start, end, nSubseq = 1000) => {
  const res = await API.post("/scores", { start, end, n_subseq: nSubseq })
  return res.data
}