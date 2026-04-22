from fastapi import APIRouter
from backend.services.realtime_engine import (
    start_simulation, stop_simulation, get_state,
    LEVELS, ALERT_LEVELS, MATCH_THRESHOLD, PREFIX_RATIOS, EVAL_EVERY,
)
from backend.services import database as db

router = APIRouter(prefix="/realtime", tags=["realtime"])


@router.post("/start")
async def start_realtime(request: dict):
    """Demarre la simulation temps reel."""
    dataset = request.get("dataset")
    speed = float(request.get("speed", 0.005))
    start_index = int(request.get("start_index", 0))
    max_points = int(request.get("max_points", 0))

    if not dataset:
        return {"error": "Le dataset est obligatoire."}

    return start_simulation(dataset, speed, start_index, max_points)


@router.post("/stop")
async def stop_realtime():
    """Arrete la simulation en cours."""
    return stop_simulation()


@router.get("/status")
async def get_realtime_status():
    """Retourne l'etat courant du moteur temps reel."""
    return get_state()


@router.get("/events")
async def get_realtime_events(limit: int = 100):
    """Retourne l'historique des evenements sauvegardes en base."""
    return {"events": db.list_realtime_events(limit)}


@router.delete("/events")
async def clear_events():
    """Supprime l'historique des evenements."""
    db.clear_realtime_events()
    return {"message": "Historique supprime."}


@router.get("/config")
async def get_config():
    """Retourne la configuration actuelle du moteur."""
    return {
        "levels": LEVELS,
        "alert_levels": ALERT_LEVELS,
        "match_threshold": MATCH_THRESHOLD,
        "prefix_ratios": PREFIX_RATIOS,
        "eval_every": EVAL_EVERY,
    }
