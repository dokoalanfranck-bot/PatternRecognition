from fastapi import APIRouter
from backend.services.realtime_engine import (
    start_simulation, stop_simulation, get_state, NUM_SPLITS
)
from backend.services import database as db

router = APIRouter(prefix="/realtime", tags=["realtime"])


@router.post("/start")
async def start_realtime(request: dict):
    """Démarre la simulation temps réel."""
    dataset = request.get("dataset")
    speed = float(request.get("speed", 0.005))
    start_index = int(request.get("start_index", 0))
    max_points = int(request.get("max_points", 0))

    if not dataset:
        return {"error": "Le dataset est obligatoire."}

    return start_simulation(dataset, speed, start_index, max_points)


@router.post("/stop")
async def stop_realtime():
    """Arrête la simulation en cours."""
    return stop_simulation()


@router.get("/status")
async def get_realtime_status():
    """Retourne l'état courant du moteur temps réel."""
    return get_state()


@router.get("/events")
async def get_realtime_events(limit: int = 100):
    """Retourne l'historique des événements sauvegardés en base."""
    return {"events": db.list_realtime_events(limit)}


@router.delete("/events")
async def clear_events():
    """Supprime l'historique des événements."""
    db.clear_realtime_events()
    return {"message": "Historique supprimé."}


@router.get("/config")
async def get_config():
    """Retourne la configuration actuelle."""
    state = get_state()
    return {
        "num_splits": NUM_SPLITS,
        "speed": state["speed"],
        "active_patterns_count": state["active_patterns_count"],
    }
