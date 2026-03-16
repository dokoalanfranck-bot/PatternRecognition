from fastapi import APIRouter
from backend.services.data_loader import load_dataset
from backend.services.dtw_similarity import search_pattern
import numpy as np
from tslearn.metrics import dtw

router = APIRouter()

data = load_dataset()

series = data["value"].values

dates = data.index


@router.post("/scores")
def compute_all_scores(request: dict):
    """Calcule le score DTW du pattern vs les N premières sous-séquences
    sans aucun filtre. Pour visualiser la distribution complète."""
    start = request["start"]
    end = request["end"]
    n_subseq = int(request.get("n_subseq", 1000))

    pattern = data.loc[start:end]["value"].values

    if len(pattern) < 10:
        return {"scores": [], "error": "Sélection trop courte."}

    pattern_len = len(pattern)
    step = max(1, int(pattern_len * 0.2))
    total_positions = range(0, len(series) - pattern_len, step)

    # Limiter au nombre demandé
    positions = list(total_positions)[:n_subseq]

    scores = []
    for i in positions:
        window = series[i:i + pattern_len]
        score = float(dtw(pattern, window))
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

    pattern = data.loc[start:end]["value"].values

    # Validation : le pattern doit avoir au moins 10 points
    if len(pattern) < 10:
        return {"matches": [], "error": "Sélection trop courte. Choisissez une zone d'au moins 10 points."}

    # Validation : top_k raisonnable
    top_k = max(1, min(top_k, 100))

    matches = search_pattern(series, pattern, top_k)

    results = []

    for m in matches:

        start_date = dates[m["index"]]
        end_idx = min(m["index"] + len(pattern), len(dates) - 1)
        end_date = dates[end_idx]

        results.append({
            "start": str(start_date),
            "end": str(end_date),
            "score": float(m["score"])
        })

    return {"matches": results}