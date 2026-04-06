"""
Moteur de détection temps réel par SPLITS.

Principe :
  1. Un simulateur lit un CSV ligne par ligne (simule un flux temps réel)
  2. Un buffer circulaire accumule les observations
  3. Quand assez de points sont reçus pour un split, on compare via MASS
  4. La similarité est calculée de façon graduelle (split par split)
  5. Les événements sont enregistrés en base
"""

import numpy as np
import stumpy
import time
import threading
import json
from collections import deque
from backend.services import database as db
from backend.services.data_loader import load_dataset

# ═══════════════════════════════════════════════════════════════════════════════
#  CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

NUM_SPLITS = 4                    # Nombre de segments par pattern
DETECTION_THRESHOLD = 60.0        # Seuil de similarité (%) pour déclencher une alerte
SIMULATION_SPEED = 0.005          # Secondes entre chaque point simulé
CONFIDENCE_MAP = {
    1: "low",        # 1 split validé
    2: "medium",     # 2 splits validés
    3: "high",       # 3 splits validés
    4: "confirmed",  # 4 splits validés → confirmation
}

# ═══════════════════════════════════════════════════════════════════════════════
#  ÉTAT GLOBAL DU MOTEUR
# ═══════════════════════════════════════════════════════════════════════════════

_state = {
    "running": False,
    "thread": None,
    "buffer": [],               # Points accumulés (temps réel)
    "buffer_timestamps": [],    # Timestamps des points
    "current_split": 0,         # Split en cours d'évaluation
    "split_results": [],        # Résultats par split [{pattern_id, similarity, ...}]
    "active_patterns": [],      # Patterns chargés depuis la base
    "total_points_received": 0,
    "events": [],               # Derniers événements (en mémoire)
    "dataset": None,
    "speed": SIMULATION_SPEED,
    "simulation_progress": 0.0, # 0-100%
    "simulation_total": 0,
    "best_match": None,         # Meilleur match global courant
}

_lock = threading.Lock()


def get_state():
    """Retourne l'état courant du moteur (thread-safe)."""
    with _lock:
        # Normaliser les données pour les graphiques
        buffer_data = list(_state["buffer"])
        best_match_copy = None
        
        if _state["best_match"]:
            best_match_copy = dict(_state["best_match"])
            # Récupérer aussi les données du pattern si disponibles via cache
            pattern_id = _state["best_match"].get("pattern_id")
            if pattern_id:
                # Chercher dans nos patterns en mémoire
                for key, val in _state.items():
                    if key.startswith("pattern_data_"):
                        if _state.get("pattern_data_id") == pattern_id:
                            best_match_copy["pattern_data"] = val
                            break
        
        return {
            "running": _state["running"],
            "current_split": _state["current_split"],
            "total_splits": NUM_SPLITS,
            "split_results": list(_state["split_results"]),
            "total_points_received": _state["total_points_received"],
            "buffer_size": len(_state["buffer"]),
            "buffer_data": buffer_data[-1000:],  # Max 1000 points pour graphique
            "active_patterns_count": len(_state["active_patterns"]),
            "events": _state["events"][-20:],  # 20 derniers
            "dataset": _state["dataset"],
            "speed": _state["speed"],
            "simulation_progress": _state["simulation_progress"],
            "best_match": best_match_copy,
        }


# ═══════════════════════════════════════════════════════════════════════════════
#  SPLITS : Découper un pattern en N segments
# ═══════════════════════════════════════════════════════════════════════════════

def split_pattern(values, num_splits=NUM_SPLITS):
    """Découpe un pattern en N segments égaux."""
    arr = np.array(values, dtype=np.float64)
    split_size = len(arr) // num_splits
    splits = []
    for i in range(num_splits):
        start = i * split_size
        end = start + split_size if i < num_splits - 1 else len(arr)
        splits.append(arr[start:end])
    return splits


# ═══════════════════════════════════════════════════════════════════════════════
#  COMPARAISON MASS PAR SPLIT
# ═══════════════════════════════════════════════════════════════════════════════

def compare_split(incoming_segment, reference_split):
    """Compare un segment entrant avec un split de référence via MASS."""
    incoming = np.array(incoming_segment, dtype=np.float64)
    reference = np.array(reference_split, dtype=np.float64)

    # Vérifications
    if len(incoming) < 10 or len(reference) < 10:
        return 0.0

    # Ajuster les tailles si nécessaire
    min_len = min(len(incoming), len(reference))
    incoming = incoming[:min_len]
    reference = reference[:min_len]

    # Vérifier amplitude (pattern plat → pas de comparaison)
    if np.ptp(reference) < 0.01 or np.ptp(incoming) < 0.01:
        return 0.0

    try:
        # MASS retourne un profil de distance, on prend le score minimum
        if len(reference) > len(incoming):
            distance_profile = stumpy.mass(incoming, reference)
        else:
            distance_profile = stumpy.mass(reference, incoming)

        best_distance = float(np.nanmin(distance_profile))

        # Normaliser en similarité 0-100%
        # Score MASS: 0 = identique, plus élevé = plus différent
        # On normalise avec une borne max empirique
        max_distance = np.sqrt(2 * min_len)  # Distance max théorique z-normalisée
        similarity = max(0.0, (1.0 - best_distance / max_distance) * 100)
        return round(similarity, 2)

    except Exception:
        return 0.0


# ═══════════════════════════════════════════════════════════════════════════════
#  BOUCLE PRINCIPALE DE DÉTECTION
# ═══════════════════════════════════════════════════════════════════════════════

def _run_simulation(dataset_filename, speed, start_index=0, max_points=0):
    """Boucle de simulation : lit le CSV point par point et compare."""
    global _state

    # Charger les données du dataset
    data = load_dataset(dataset_filename)
    series = data["value"].values
    dates = data.index

    total = len(series) if max_points <= 0 else min(max_points, len(series))

    with _lock:
        _state["simulation_total"] = total
        _state["dataset"] = dataset_filename

    # Charger les patterns de référence depuis la base
    all_patterns = db.list_patterns()
    patterns_with_splits = []

    for p in all_patterns:
        full = db.get_pattern(p["id"])
        if full and full.get("values") and len(full["values"]) >= 40:
            splits = split_pattern(full["values"], NUM_SPLITS)
            patterns_with_splits.append({
                "id": full["id"],
                "name": full["name"],
                "pattern_type": full.get("pattern_type", "normal"),
                "values": full["values"],
                "splits": splits,
                "split_size": len(full["values"]) // NUM_SPLITS,
            })

    with _lock:
        _state["active_patterns"] = [
            {"id": p["id"], "name": p["name"], "pattern_type": p["pattern_type"],
             "total_points": len(p["values"]), "split_size": p["split_size"]}
            for p in patterns_with_splits
        ]

    if not patterns_with_splits:
        with _lock:
            _state["running"] = False
            _state["events"].append({
                "type": "error",
                "message": "Aucun pattern en base. Sauvegardez des patterns d'abord.",
                "timestamp": time.time(),
            })
        return

    # Taille d'un split (basée sur le premier pattern)
    ref_split_size = patterns_with_splits[0]["split_size"]

    # Buffer circulaire pour accumuler les points entrants
    buffer = []
    current_split_idx = 0
    split_results = []

    with _lock:
        _state["events"].append({
            "type": "start",
            "message": f"Simulation démarrée — {len(patterns_with_splits)} pattern(s) chargé(s), {total} points à traiter",
            "timestamp": time.time(),
        })

    for i in range(start_index, start_index + total):
        # Vérifier si on a demandé d'arrêter
        with _lock:
            if not _state["running"]:
                break

        # Simuler la réception d'un point
        value = float(series[i])
        timestamp = str(dates[i])
        buffer.append(value)

        with _lock:
            _state["buffer"] = buffer[-ref_split_size * NUM_SPLITS:]
            _state["buffer_timestamps"] = [str(dates[max(0, i - len(_state["buffer"]) + 1 + j)])
                                           for j in range(len(_state["buffer"]))]
            _state["total_points_received"] = len(buffer)
            _state["simulation_progress"] = round(((i - start_index + 1) / total) * 100, 1)

        # Vérifier si on a assez de points pour un split
        points_for_current_split = (current_split_idx + 1) * ref_split_size
        if len(buffer) >= points_for_current_split:
            # Extraire le segment correspondant
            seg_start = current_split_idx * ref_split_size
            seg_end = seg_start + ref_split_size
            incoming_segment = buffer[seg_start:seg_end]

            # Comparer avec chaque pattern
            best_sim = 0.0
            best_pattern = None

            for p in patterns_with_splits:
                if current_split_idx < len(p["splits"]):
                    sim = compare_split(incoming_segment, p["splits"][current_split_idx])
                    if sim > best_sim:
                        best_sim = sim
                        best_pattern = p

            # Enregistrer le résultat du split
            confidence = CONFIDENCE_MAP.get(current_split_idx + 1, "low")

            split_result = {
                "split_index": current_split_idx,
                "similarity": best_sim,
                "confidence": confidence,
                "pattern_id": best_pattern["id"] if best_pattern else None,
                "pattern_name": best_pattern["name"] if best_pattern else None,
                "pattern_type": best_pattern["pattern_type"] if best_pattern else None,
                "timestamp": timestamp,
            }
            split_results.append(split_result)

            with _lock:
                _state["current_split"] = current_split_idx
                _state["split_results"] = list(split_results)

            # Déterminer si on détecte quelque chose
            alert_type = None
            if best_sim >= DETECTION_THRESHOLD and best_pattern:
                if best_pattern["pattern_type"] == "failure":
                    alert_type = "failure"
                else:
                    alert_type = "normal"

            # Créer un événement
            event = {
                "type": "split_complete",
                "split_index": current_split_idx,
                "total_splits": NUM_SPLITS,
                "similarity": best_sim,
                "confidence": confidence,
                "pattern_id": best_pattern["id"] if best_pattern else None,
                "pattern_name": best_pattern["name"] if best_pattern else None,
                "pattern_type": best_pattern["pattern_type"] if best_pattern else None,
                "alert": alert_type,
                "timestamp": time.time(),
            }

            with _lock:
                _state["events"].append(event)
                if best_pattern:
                    _state["best_match"] = {
                        "pattern_id": best_pattern["id"],
                        "pattern_name": best_pattern["name"],
                        "pattern_type": best_pattern["pattern_type"],
                        "similarity": best_sim,
                        "confidence": confidence,
                        "splits_completed": current_split_idx + 1,
                        "pattern_data": list(best_pattern["values"]),  # Données du pattern pour graphique
                    }

            # Sauvegarder en base
            if best_pattern:
                db.save_realtime_event(
                    pattern_id=best_pattern["id"],
                    pattern_name=best_pattern["name"],
                    pattern_type=best_pattern["pattern_type"],
                    split_index=current_split_idx,
                    total_splits=NUM_SPLITS,
                    similarity=best_sim,
                    confidence=confidence,
                    details={"timestamp": timestamp, "alert": alert_type},
                )

            current_split_idx += 1

            # Cycle complet → reset pour le prochain cycle
            if current_split_idx >= NUM_SPLITS:
                avg_sim = np.mean([s["similarity"] for s in split_results[-NUM_SPLITS:]])
                with _lock:
                    _state["events"].append({
                        "type": "cycle_complete",
                        "message": f"Cycle complet — similarité moyenne {avg_sim:.1f}%",
                        "avg_similarity": round(avg_sim, 2),
                        "split_results": split_results[-NUM_SPLITS:],
                        "timestamp": time.time(),
                    })

                # Reset pour le prochain cycle
                current_split_idx = 0
                split_results = []
                buffer = []
                with _lock:
                    _state["current_split"] = 0
                    _state["split_results"] = []
                    _state["buffer"] = []

        # Pause pour simuler le temps réel
        time.sleep(speed)

    # Fin de la simulation
    with _lock:
        _state["running"] = False
        _state["events"].append({
            "type": "end",
            "message": "Simulation terminée.",
            "timestamp": time.time(),
        })


# ═══════════════════════════════════════════════════════════════════════════════
#  CONTRÔLE PUBLIC
# ═══════════════════════════════════════════════════════════════════════════════

def start_simulation(dataset_filename, speed=SIMULATION_SPEED,
                     start_index=0, max_points=0):
    """Démarre la simulation en arrière-plan."""
    global _state
    with _lock:
        if _state["running"]:
            return {"error": "Simulation déjà en cours."}
        _state["running"] = True
        _state["buffer"] = []
        _state["buffer_timestamps"] = []
        _state["current_split"] = 0
        _state["split_results"] = []
        _state["total_points_received"] = 0
        _state["events"] = []
        _state["simulation_progress"] = 0.0
        _state["best_match"] = None
        _state["speed"] = speed

    thread = threading.Thread(
        target=_run_simulation,
        args=(dataset_filename, speed, start_index, max_points),
        daemon=True,
    )
    thread.start()

    with _lock:
        _state["thread"] = thread

    return {"message": "Simulation démarrée."}


def stop_simulation():
    """Arrête la simulation."""
    global _state
    with _lock:
        if not _state["running"]:
            return {"message": "Aucune simulation en cours."}
        _state["running"] = False
    return {"message": "Simulation arrêtée."}
