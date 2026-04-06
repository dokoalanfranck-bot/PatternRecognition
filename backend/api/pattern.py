from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool
from backend.services.data_loader import load_dataset
from backend.services.dtw_similarity import search_pattern, z_normalize
from backend.services import database as db
import numpy as np
import time

router = APIRouter()


def _get_data(dataset=None):
    data = load_dataset(dataset)
    series = data["value"].values
    dates = data.index
    return data, series, dates


# ═══════════════════════════════════════════════════════════════════════════════
#  ANALYSE — Recherche de patterns dans la série
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/pattern")
async def detect_pattern(request: dict):
    start = request["start"]
    end = request["end"]
    top_k = int(request.get("top_k", 0))
    dataset = request.get("dataset")

    def _detect():
        data, series, dates = _get_data(dataset)
        t0 = time.time()
        pattern = data.loc[start:end]["value"].values

        if len(pattern) < 10:
            return {"matches": [], "error": "Sélection trop courte (min 10 points)."}

        matches, diagnostics = search_pattern(series, pattern, top_k)
        elapsed = time.time() - t0

        # ─── Enrichir chaque match ─────────────────────────────────────────
        results = []
        for m in matches:
            end_idx = min(m["index"] + len(pattern), len(dates) - 1)
            window = series[m["index"]:m["index"] + len(pattern)]
            results.append({
                "start":      str(dates[m["index"]]),
                "end":        str(dates[end_idx]),
                "score":      float(m["score"]),
                "match_mean": float(np.mean(window)),
                "match_std":  float(np.std(window)),
                "match_min":  float(np.min(window)),
                "match_max":  float(np.max(window)),
            })

        # ─── Stats du pattern sélectionné ──────────────────────────────────
        pat_slice = data.loc[start:end]
        try:
            dur_h = round((pat_slice.index[-1] - pat_slice.index[0]).total_seconds() / 3600, 2)
        except Exception:
            dur_h = 0

        pattern_info = {
            "nb_points":      len(pattern),
            "start":          str(pat_slice.index[0]),
            "end":            str(pat_slice.index[-1]),
            "duration_hours": dur_h,
            "amplitude":      round(float(np.ptp(pattern)), 4),
            "mean":           round(float(np.mean(pattern)), 4),
            "std":            round(float(np.std(pattern)), 4),
            "min":            round(float(np.min(pattern)), 4),
            "max":            round(float(np.max(pattern)), 4),
            "energy_total":   round(float(np.sum(pattern)), 2),
        }

        # ─── Infos recherche ───────────────────────────────────────────────
        search_info = {
            "series_length":           len(series),
            "total_positions_scanned": diagnostics["total_positions"],
            "matches_returned":        len(results),
            "computation_time_sec":    round(elapsed, 3),
        }

        # ─── Distribution de similarité ────────────────────────────────────
        distribution, score_stats = _compute_distribution(results)

        return {
            "matches": results,
            "monitoring": {
                "pattern_info": pattern_info,
                "search_info":  search_info,
                "distribution": distribution,
                "score_stats":  score_stats,
            },
        }

    return await run_in_threadpool(_detect)


@router.post("/scores")
async def compute_all_scores(request: dict):
    start = request["start"]
    end = request["end"]
    n_subseq = int(request.get("n_subseq", 1000))
    dataset = request.get("dataset")

    def _compute():
        data, series, dates = _get_data(dataset)
        pattern = data.loc[start:end]["value"].values
        if len(pattern) < 10:
            return {"scores": [], "error": "Sélection trop courte."}

        pat_norm = z_normalize(pattern)
        step = max(1, int(len(pattern) * 0.2))
        positions = list(range(0, len(series) - len(pattern), step))[:n_subseq]

        scores = []
        for i in positions:
            w = z_normalize(series[i:i + len(pattern)])
            scores.append({"index": i, "score": float(np.sqrt(np.sum((pat_norm - w) ** 2)))})

        return {"scores": scores, "total_subsequences": len(positions), "computed": len(scores)}

    return await run_in_threadpool(_compute)


# ═══════════════════════════════════════════════════════════════════════════════
#  BIBLIOTHÈQUE — CRUD patterns sauvegardés
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/patterns/save")
async def save_pattern_endpoint(request: dict):
    start = request["start"]
    end = request["end"]
    name = request.get("name", "").strip()
    description = request.get("description", "").strip()
    dataset = request.get("dataset")
    pattern_type = request.get("pattern_type", "normal")
    if pattern_type not in ("normal", "failure"):
        pattern_type = "normal"

    if not name:
        return {"error": "Le nom du pattern est obligatoire."}

    data, series, dates = _get_data(dataset)
    pat_slice = data.loc[start:end]
    values = pat_slice["value"].tolist()
    dates_list = [str(d) for d in pat_slice.index]

    if len(values) < 10:
        return {"error": "Pattern trop court (min 10 points)."}

    # Stats à sauvegarder
    arr = np.array(values)
    try:
        dur_h = round((pat_slice.index[-1] - pat_slice.index[0]).total_seconds() / 3600, 2)
    except Exception:
        dur_h = 0

    stats = {
        "nb_points":      len(values),
        "duration_hours": dur_h,
        "amplitude":      round(float(np.ptp(arr)), 4),
        "mean":           round(float(np.mean(arr)), 4),
        "std":            round(float(np.std(arr)), 4),
        "min":            round(float(np.min(arr)), 4),
        "max":            round(float(np.max(arr)), 4),
    }

    # Distribution des similarités
    distribution = request.get("distribution")
    if distribution:
        stats["distribution"] = {
            "excellent": distribution.get("excellent", {}).get("count", 0),
            "good":      distribution.get("good", {}).get("count", 0),
            "low":       distribution.get("low", {}).get("count", 0),
        }

    match_count = int(request.get("match_count", 0))

    pid = db.save_pattern(name, description, values, dates_list, stats, match_count, pattern_type)
    return {"id": pid, "message": f"Pattern '{name}' sauvegardé."}



@router.get("/patterns")
async def list_patterns_endpoint():
    return {"patterns": db.list_patterns()}


@router.get("/patterns/{pid}")
async def get_pattern_endpoint(pid: int):
    p = db.get_pattern(pid)
    if not p:
        return {"error": "Pattern introuvable."}
    return p


@router.put("/patterns/{pid}")
async def update_pattern_endpoint(pid: int, request: dict):
    """Mettre à jour les propriétés d'un pattern (type, description, etc.)"""
    if not db.get_pattern(pid):
        return {"error": "Pattern introuvable."}
    
    pattern_type = request.get("pattern_type")
    if pattern_type:
        if pattern_type not in ("normal", "failure"):
            return {"error": "Type invalide. Utilisez 'normal' ou 'failure'."}
        db.update_pattern_type(pid, pattern_type)
    
    return {"message": "Pattern mis à jour.", "id": pid}


@router.delete("/patterns/{pid}")
async def delete_pattern_endpoint(pid: int):
    db.delete_pattern(pid)
    return {"message": "Pattern supprimé."}


@router.post("/patterns/{pid}/compare")
async def compare_pattern_endpoint(pid: int, request: dict):
    """Compare un pattern stocké contre une portion de la série."""
    stored = db.get_pattern(pid)
    if not stored:
        return {"error": "Pattern introuvable."}

    start = request.get("start")
    end = request.get("end")
    dataset = request.get("dataset")

    data, series, dates = _get_data(dataset)
    ref_values = np.array(stored["values"], dtype=float)

    if start and end:
        target = data.loc[start:end]["value"].values
    else:
        target = series

    def _compare():
        matches, diag = search_pattern(target, ref_values, top_k=0)
        results = []
        target_dates = data.loc[start:end].index if start and end else dates
        for m in matches:
            end_idx = min(m["index"] + len(ref_values), len(target_dates) - 1)
            results.append({
                "start": str(target_dates[m["index"]]),
                "end":   str(target_dates[end_idx]),
                "score": float(m["score"]),
            })
        # Enrichir avec similarité
        distribution, _ = _compute_distribution(results)
        return {
            "reference_pattern": stored["name"],
            "matches": results,
            "distribution": distribution,
            "total_matches": len(results),
        }

    return await run_in_threadpool(_compare)


# ═══════════════════════════════════════════════════════════════════════════════
#  Utilitaires
# ═══════════════════════════════════════════════════════════════════════════════

def _compute_distribution(results):
    if not results:
        return (
            {"excellent": {"label": "80–100%", "count": 0, "color": "#2ecc71"},
             "good":      {"label": "50–79%",  "count": 0, "color": "#3498db"},
             "low":       {"label": "<50%",     "count": 0, "color": "#f39c12"}},
            {},
        )

    scores_list = [r["score"] for r in results]
    min_s = min(scores_list)
    max_s = max(scores_list)
    rng = max_s - min_s if max_s > min_s else 1

    excellent, good, low = 0, 0, 0
    for r in results:
        sim = 95 - ((r["score"] - min_s) / rng) * 55
        r["similarity"] = round(sim, 1)
        if sim >= 80:
            excellent += 1
        elif sim >= 50:
            good += 1
        else:
            low += 1

    distribution = {
        "excellent": {"label": "80–100%", "count": excellent, "color": "#2ecc71"},
        "good":      {"label": "50–79%",  "count": good,      "color": "#3498db"},
        "low":       {"label": "<50%",     "count": low,       "color": "#f39c12"},
    }
    score_stats = {
        "best_score":   round(min_s, 4),
        "worst_score":  round(max_s, 4),
        "avg_score":    round(float(np.mean(scores_list)), 4),
        "median_score": round(float(np.median(scores_list)), 4),
        "std_score":    round(float(np.std(scores_list)), 4),
    }
    return distribution, score_stats
