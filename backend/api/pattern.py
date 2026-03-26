from fastapi import APIRouter
from backend.services.data_loader import load_dataset
from backend.services.dtw_similarity import search_pattern, z_normalize
import numpy as np
import time

router = APIRouter()

data = load_dataset()

series = data["value"].values

dates = data.index


@router.post("/scores")
def compute_all_scores(request: dict):
    """Calcule le score Euclidien normalisé du pattern vs les N premières
    sous-séquences. Utilise la distance euclidienne (O(n)) au lieu de DTW
    (O(n²)) pour une réponse quasi-instantanée."""
    start = request["start"]
    end = request["end"]
    n_subseq = int(request.get("n_subseq", 1000))

    pattern = data.loc[start:end]["value"].values

    if len(pattern) < 10:
        return {"scores": [], "error": "Sélection trop courte."}

    pattern_len = len(pattern)
    pattern_norm = z_normalize(pattern)
    step = max(1, int(pattern_len * 0.2))
    total_positions = range(0, len(series) - pattern_len, step)

    positions = list(total_positions)[:n_subseq]

    scores = []
    for i in positions:
        window = series[i:i + pattern_len]
        window_norm = z_normalize(window)
        score = float(np.sqrt(np.sum((pattern_norm - window_norm) ** 2)))
        scores.append({"index": i, "score": score})

    return {
        "scores": scores,
        "total_subsequences": len(list(total_positions)),
        "computed": len(scores)
    }


@router.post("/pattern")
def detect_pattern(request: dict):

    start = request["start"]
    end = request["end"]
    top_k = int(request.get("top_k", 10))

    t0 = time.time()

    pattern = data.loc[start:end]["value"].values

    # Validation : le pattern doit avoir au moins 10 points
    if len(pattern) < 10:
        return {"matches": [], "error": "Sélection trop courte. Choisissez une zone d'au moins 10 points."}

    # Validation : top_k raisonnable (MASS calcule tout en un seul passage,
    # donc pas de surcoût à retourner beaucoup de résultats)
    top_k = max(1, min(top_k, 10000))

    matches, diagnostics = search_pattern(series, pattern, top_k)

    elapsed = time.time() - t0

    # ─── Construire les résultats enrichis ───
    results = []
    for m in matches:
        start_date = dates[m["index"]]
        end_idx = min(m["index"] + len(pattern), len(dates) - 1)
        end_date = dates[end_idx]

        # Stats individuelles du match
        match_window = series[m["index"]:m["index"] + len(pattern)]
        results.append({
            "start": str(start_date),
            "end": str(end_date),
            "score": float(m["score"]),
            "match_mean": float(np.mean(match_window)),
            "match_std": float(np.std(match_window)),
            "match_min": float(np.min(match_window)),
            "match_max": float(np.max(match_window)),
        })

    # ─── Monitoring : infos pattern ───
    pattern_start_date = str(data.loc[start:end].index[0]) if len(pattern) > 0 else start
    pattern_end_date = str(data.loc[start:end].index[-1]) if len(pattern) > 0 else end
    # Durée en heures
    try:
        duration_sec = (data.loc[start:end].index[-1] - data.loc[start:end].index[0]).total_seconds()
        duration_hours = round(duration_sec / 3600, 2)
    except Exception:
        duration_hours = 0

    pattern_info = {
        "nb_points": int(len(pattern)),
        "start": pattern_start_date,
        "end": pattern_end_date,
        "duration_hours": duration_hours,
        "amplitude": round(float(np.max(pattern) - np.min(pattern)), 4),
        "mean": round(float(np.mean(pattern)), 4),
        "std": round(float(np.std(pattern)), 4),
        "min": round(float(np.min(pattern)), 4),
        "max": round(float(np.max(pattern)), 4),
        "energy_total": round(float(np.sum(pattern)), 2),
    }

    # ─── Monitoring : recherche ───
    search_info = {
        "series_length": int(len(series)),
        "step": diagnostics["step"],
        "total_positions_scanned": diagnostics["total_positions"],
        "passed_amplitude_filter": diagnostics["passed_amplitude"],
        "passed_variance_filter": diagnostics["passed_variance"],
        "passed_correlation_filter": diagnostics["passed_correlation"],
        "mass_computed": diagnostics["final_computed"],
        "matches_returned": len(results),
        "computation_time_sec": round(elapsed, 3),
    }

    # ─── Monitoring : distribution par similarité ───
    # Calculer la similarité pour chaque match
    if results:
        scores_list = [r["score"] for r in results]
        min_score = min(scores_list)
        max_score = max(scores_list)
        score_range = max_score - min_score if max_score > min_score else 1

        excellent = []  # 80-100%
        good = []       # 50-79%
        low = []        # <50%

        for r in results:
            sim = 95 - ((r["score"] - min_score) / score_range) * 55
            r["similarity"] = round(sim, 1)
            if sim >= 80:
                excellent.append(r)
            elif sim >= 50:
                good.append(r)
            else:
                low.append(r)

        distribution = {
            "excellent": {"label": "80–100%", "count": len(excellent), "color": "#2ecc71"},
            "good": {"label": "50–79%", "count": len(good), "color": "#3498db"},
            "low": {"label": "<50%", "count": len(low), "color": "#f39c12"},
        }

        score_stats = {
            "best_score": round(min_score, 4),
            "worst_score": round(max_score, 4),
            "avg_score": round(float(np.mean(scores_list)), 4),
            "median_score": round(float(np.median(scores_list)), 4),
            "std_score": round(float(np.std(scores_list)), 4),
        }
    else:
        distribution = {
            "excellent": {"label": "80–100%", "count": 0, "color": "#2ecc71"},
            "good": {"label": "50–79%", "count": 0, "color": "#3498db"},
            "low": {"label": "<50%", "count": 0, "color": "#f39c12"},
        }
        score_stats = {}

    return {
        "matches": results,
        "monitoring": {
            "pattern_info": pattern_info,
            "search_info": search_info,
            "distribution": distribution,
            "score_stats": score_stats,
        }
    }