"""
Moteur de detection temps reel v3 - Sliding Window Progressive Matching.

Principe fondamental :
  Au lieu de decouper le pattern en phases rigides, on compare en CONTINU
  les dernieres donnees du flux avec des PREFIXES CROISSANTS du pattern.
  Quand le debut du pattern commence a apparaitre dans le flux, la confiance
  monte naturellement au fur et a mesure que le match progresse.

Architecture :
  1. DETECTION CONTINUE : A chaque evaluation, on teste des prefixes de
     tailles 15%, 30%, 50%, 70%, 90%, 100% du pattern.
  2. PROGRESSION NATURELLE : Le plus long prefixe qui matche bien donne
     la progression actuelle (ex: 50% = on est a la moitie du pattern).
  3. PREDICTION : Les points restants du pattern (apres la zone matchee)
     representent ce qui va probablement arriver ensuite.
  4. CONFIANCE CUMULATIVE : confiance = progression x qualite_du_match
  5. ALERTES GRADUELLES selon la confiance.

Avantages vs l'ancien systeme :
  - Pas de state machine fragile (SEARCHING/TRACKING)
  - Pas d'ancrage rigide qui casse au moindre decalage
  - Detection tres precoce (des 15% du pattern visible)
  - Prediction visuelle du futur
  - Tolerant aux variations de vitesse (Â±30%)
"""

import threading
import time
import numpy as np
import stumpy

from backend.services.data_loader import load_dataset
from backend.services import database as db

# ===========================================================================
#  CONFIGURATION
# ===========================================================================

SIMULATION_SPEED = 0.005       # Delai entre chaque point (secondes)
EVAL_EVERY = 5                 # Evaluer toutes les N observations
MATCH_THRESHOLD = 55.0         # Seuil de similarite minimum (%)

# Prefixes a tester (fraction du pattern)
PREFIX_RATIOS = [0.15, 0.30, 0.50, 0.70, 0.90, 1.0]

# Seuils d'alerte (confiance 0-100)
ALERT_LEVELS = {
    "normal":       {"min": 0,  "max": 20},
    "surveillance": {"min": 20, "max": 45},
    "attention":    {"min": 45, "max": 65},
    "danger":       {"min": 65, "max": 85},
    "critique":     {"min": 85, "max": 100},
}
LEVELS = ["normal", "surveillance", "attention", "danger", "critique"]


def _confidence_to_level(conf):
    for level in reversed(LEVELS):
        if conf >= ALERT_LEVELS[level]["min"]:
            return level
    return "normal"


# ===========================================================================
#  FONCTIONS DE SIMILARITE
# ===========================================================================

def _znorm_similarity(query, segment):
    """
    Similarite basee sur la distance z-normalisee (MASS).
    Retourne un score 0-100 (100 = identique).
    """
    n = len(query)
    if n < 4 or len(segment) < n:
        return 0.0, -1

    try:
        # MASS calcule le profil de distance pour chaque position
        dist_profile = stumpy.mass(query, segment)
        best_idx = int(np.nanargmin(dist_profile))
        best_dist = float(dist_profile[best_idx])

        # Normaliser : distance max theorique = sqrt(2*n) pour des series z-norm
        max_dist = np.sqrt(2.0 * n)
        similarity = max(0.0, min(100.0, (1.0 - best_dist / max_dist) * 100.0))

        return similarity, best_idx
    except Exception:
        return 0.0, -1


def _pearson_similarity(query, segment):
    """
    Fallback : correlation de Pearson pour petits segments.
    Retourne un score 0-100.
    """
    if len(query) < 4 or len(segment) < len(query):
        return 0.0

    seg = segment[:len(query)]
    std_q = np.std(query)
    std_s = np.std(seg)

    if std_q < 1e-6 and std_s < 1e-6:
        return 100.0
    if std_q < 1e-6 or std_s < 1e-6:
        return 0.0

    q_norm = (query - np.mean(query)) / std_q
    s_norm = (seg - np.mean(seg)) / std_s
    corr = float(np.dot(q_norm, s_norm) / len(q_norm))
    return max(0.0, min(100.0, (corr + 1.0) * 50.0))


# ===========================================================================
#  DETECTEUR PAR PATTERN (Sliding Progressive Matcher)
# ===========================================================================

class PatternDetector:
    """
    Detecteur temps reel pour un pattern de reference.

    A chaque evaluation :
    1. Teste des prefixes croissants du pattern contre le buffer
    2. Identifie le plus long prefixe qui matche bien
    3. Calcule confiance = progression x score
    4. Genere une prediction (suite attendue du pattern)
    """

    def __init__(self, pattern_id, name, pattern_type, values,
                 alert_threshold=MATCH_THRESHOLD, alert_type="failure"):
        self.pattern_id = pattern_id
        self.name = name
        self.pattern_type = pattern_type
        self.values = np.array(values, dtype=np.float64)
        self.m = len(values)

        self.alert_threshold = alert_threshold
        self.alert_type = alert_type

        # Prefixes pre-calcules
        self.prefixes = []
        for ratio in PREFIX_RATIOS:
            length = max(20, int(self.m * ratio))
            length = min(length, self.m)
            self.prefixes.append({
                "ratio": ratio,
                "length": length,
                "values": self.values[:length],
            })

        # Etat de detection
        self.progress = 0.0           # 0-1 (fraction du pattern matchee)
        self.best_similarity = 0.0    # Score du meilleur match actuel (0-100)
        self.confidence = 0.0         # confidence = progress * similarity (0-100)
        self.alert_level = "normal"
        self.match_position = -1      # Position du match dans le buffer
        self.matched_length = 0       # Nombre de points actuellement matches

        # Prediction
        self.prediction = []          # Points futurs predits
        self.prediction_offset = 0    # Decalage par rapport au buffer actuel

        # Scores par prefixe (pour visualisation)
        self.prefix_scores = [0.0] * len(PREFIX_RATIOS)

        # Historique de confiance
        self.history = []
        self.max_history = 500

        # Compteur de stabilite (evite les faux positifs)
        self.stable_count = 0
        self.min_stable = 2  # Confirmations avant de monter le niveau

        # Alarme : logique inversee selon le type
        # failure: alarm quand similarite HAUTE (on detecte la panne)
        # normal:  alarm quand similarite BASSE (on s'eloigne du normal)
        self.alarm_confidence = 0.0   # Confiance d'alarme effective (0-100)
        self.alarm_triggered = False   # Seuil d'alarme atteint

        # Meilleur match historique de cette session
        self.peak_confidence = 0.0
        self.peak_progress = 0.0
        self.detections_count = 0     # Nombre de detections completes
        self.last_detection_buf_len = 0  # Cooldown inter-detections (evite double-comptage)
        self.matched_segment = []         # Segment du buffer correspondant au meilleur match

    def evaluate(self, buffer):
        """
        Evalue le buffer et met a jour l'etat de detection.
        Retourne un evenement si le niveau d'alerte change significativement.
        """
        buf = np.array(buffer, dtype=np.float64)
        now = time.time()
        event = None

        # Zone de recherche = les derniers 2x pattern_length points
        search_len = min(len(buf), int(self.m * 2.5))
        if search_len < self.prefixes[0]["length"]:
            self._record(now)
            return None

        search_buf = buf[-search_len:]

        # --- Tester chaque prefixe du plus long au plus court ---
        best_progress = 0.0
        best_sim = 0.0
        best_pos = -1
        best_matched_len = 0

        for i in range(len(self.prefixes) - 1, -1, -1):
            prefix = self.prefixes[i]
            plen = prefix["length"]

            if len(search_buf) < plen + 3:
                self.prefix_scores[i] = 0.0
                continue

            sim, pos = _znorm_similarity(prefix["values"], search_buf)
            self.prefix_scores[i] = round(sim, 1)

            # Si ce prefixe matche bien ET c'est plus long que le meilleur actuel
            if sim >= self.alert_threshold and plen > best_matched_len:
                best_progress = prefix["ratio"]
                best_sim = sim
                best_pos = pos
                best_matched_len = plen

        # Si aucun prefixe long ne matche, essayer les plus courts
        if best_matched_len == 0:
            for i, prefix in enumerate(self.prefixes):
                if self.prefix_scores[i] >= self.alert_threshold:
                    best_progress = prefix["ratio"]
                    best_sim = self.prefix_scores[i]
                    best_matched_len = prefix["length"]
                    # Position from previous MASS call
                    if len(search_buf) >= prefix["length"] + 3:
                        _, pos = _znorm_similarity(prefix["values"], search_buf)
                        best_pos = pos
                    break

        # --- Mettre a jour l'etat ---
        prev_confidence = self.confidence
        prev_alarm_conf = self.alarm_confidence
        prev_level = self.alert_level

        if best_matched_len > 0:
            self.progress = best_progress
            self.best_similarity = best_sim
            # Confiance = progression ponderee par la qualite du match
            # On utilise une courbe qui accelere quand on avance
            weight = best_progress ** 0.7  # LÃ©gÃ¨rement non-lineaire
            self.confidence = round(min(100.0, weight * (best_sim / 100.0) * 100.0), 1)
            self.match_position = best_pos
            self.matched_length = best_matched_len
            # Stocker le segment reel du buffer pour visualisation
            self.matched_segment = list(search_buf[best_pos:best_pos + best_matched_len])

            # Generer la prediction (points restants du pattern)
            remaining_start = best_matched_len
            if remaining_start < self.m:
                self.prediction = list(self.values[remaining_start:])
                self.prediction_offset = best_pos + best_matched_len
            else:
                self.prediction = []
                self.prediction_offset = 0

            # Stabilite (pour failure: match = stable alarm, pour normal: match = stable OK)
            if self.pattern_type == "normal":
                # Normal: quand on matche, on est stable en mode OK (baisser stable_count)
                self.stable_count = max(0, self.stable_count - 1)
            else:
                # Failure: quand on matche, on est stable en mode alarme
                self.stable_count = min(self.stable_count + 1, 10)

            # Peak tracking
            if self.confidence > self.peak_confidence:
                self.peak_confidence = self.confidence
                self.peak_progress = self.progress

            # Detection complete (pour failure: pattern complet detecte)
            # Cooldown = 50% de la longueur du pattern pour eviter de compter
            # plusieurs fois la meme occurrence
            if self.pattern_type != "normal":
                if best_progress >= 0.9 and best_sim >= self.alert_threshold:
                    buf_len = len(buf)
                    if buf_len - self.last_detection_buf_len >= int(self.m * 0.5):
                        self.detections_count += 1
                        self.last_detection_buf_len = buf_len
        else:
            # Pas de match - decroissance douce
            self.confidence = round(max(0.0, self.confidence * 0.7), 1)
            self.progress = max(0.0, self.progress * 0.5)
            self.best_similarity = max(0.0, self.best_similarity * 0.6)
            self.matched_length = 0
            self.prediction = []
            self.matched_segment = []

            if self.pattern_type == "normal":
                # Normal: pas de match = anomalie, augmenter stable_count pour alarme
                self.stable_count = min(self.stable_count + 1, 10)
            else:
                # Failure: pas de match = tout va bien
                self.stable_count = max(0, self.stable_count - 1)

            # Pour normal: non-match = anomalie detectee
            if self.pattern_type == "normal":
                if self.alarm_confidence >= 70 and prev_alarm_conf < 70:
                    self.detections_count += 1

        # --- Calcul de l'alarm_confidence selon le type de pattern ---
        if self.pattern_type == "normal":
            # Pattern NORMAL : alarme quand on NE matche PAS le pattern
            # Plus la similarite est basse, plus l'alarme est haute
            if best_matched_len > 0:
                # On matche le pattern normal => tout va bien
                self.alarm_confidence = round(max(0.0, 100.0 - self.confidence), 1)
            else:
                # Pas de match du pattern normal => deviation detectee
                self.alarm_confidence = round(min(100.0, self.alarm_confidence * 0.9 + 10.0), 1)
            self.alarm_triggered = bool(self.alarm_confidence >= 50.0)
        else:
            # Pattern FAILURE/PANNE : alarme quand on MATCHE le pattern
            self.alarm_confidence = self.confidence
            self.alarm_triggered = bool(self.confidence >= 50.0 and
                                        self.best_similarity >= self.alert_threshold)

        # Niveau d'alerte base sur alarm_confidence (pas confidence brute)
        raw_level = _confidence_to_level(self.alarm_confidence)
        if LEVELS.index(raw_level) > LEVELS.index(self.alert_level):
            # Monter => besoin de stabilite
            if self.stable_count >= self.min_stable:
                self.alert_level = raw_level
        elif LEVELS.index(raw_level) < LEVELS.index(self.alert_level):
            # Descendre => immediat mais pas trop brutal
            current_idx = LEVELS.index(self.alert_level)
            target_idx = LEVELS.index(raw_level)
            # Descendre d'un cran a la fois
            self.alert_level = LEVELS[max(target_idx, current_idx - 1)]

        # Generer un evenement si changement notable
        if self.alert_level != prev_level:
            event = {
                "type": "level_change",
                "pattern_id": self.pattern_id,
                "pattern_name": self.name,
                "pattern_type": self.pattern_type,
                "from_level": prev_level,
                "to_level": self.alert_level,
                "confidence": self.alarm_confidence,
                "progress": round(self.progress * 100, 1),
                "similarity": round(self.best_similarity, 1),
                "alarm_triggered": self.alarm_triggered,
                "timestamp": now,
            }
        elif (self.alarm_confidence >= 75 and prev_alarm_conf < 75):
            # Alerte haute atteinte
            event = {
                "type": "high_confidence",
                "pattern_id": self.pattern_id,
                "pattern_name": self.name,
                "pattern_type": self.pattern_type,
                "confidence": self.alarm_confidence,
                "progress": round(self.progress * 100, 1),
                "similarity": round(self.best_similarity, 1),
                "alert_level": self.alert_level,
                "alarm_triggered": self.alarm_triggered,
                "timestamp": now,
            }

        self._record(now)
        return event

    def _record(self, now):
        self.history.append((now, self.confidence, self.progress))
        if len(self.history) > self.max_history:
            self.history = self.history[-self.max_history:]

    def get_eta(self, points_per_second):
        """Estime le temps restant avant completion."""
        if self.progress <= 0 or self.progress >= 1.0:
            return None, None

        remaining_points = int(self.m * (1.0 - self.progress))
        if points_per_second > 0:
            remaining_sec = round(remaining_points / points_per_second, 1)
        else:
            remaining_sec = None
        return remaining_sec, remaining_points

    def to_dict(self, buffer_len=0, points_per_second=1.0):
        """Serialise l'etat pour l'API."""
        eta_sec, eta_pts = self.get_eta(points_per_second)

        return {
            "pattern_id": self.pattern_id,
            "name": self.name,
            "pattern_type": self.pattern_type,
            "alert_threshold": self.alert_threshold,
            "pattern_length": self.m,
            # Detection
            "progress": round(self.progress * 100, 1),
            "similarity": round(self.best_similarity, 1),
            "confidence": self.confidence,
            "alarm_confidence": self.alarm_confidence,
            "alarm_triggered": self.alarm_triggered,
            "alert_level": self.alert_level,
            "matched_length": self.matched_length,
            "match_position": self.match_position,
            # Scores detailles par prefixe
            "prefix_scores": list(self.prefix_scores),
            "prefix_ratios": [p["ratio"] for p in self.prefixes],
            # Prediction
            "prediction": self.prediction[:200],  # Max 200 pts pour transfert
            "prediction_offset": self.prediction_offset,
            # Estimation
            "eta_seconds": eta_sec,
            "eta_points": eta_pts,
            # Stats
            "peak_confidence": self.peak_confidence,
            "peak_progress": round(self.peak_progress * 100, 1),
            "detections_count": self.detections_count,
            "stable_count": self.stable_count,
            # Historique
            "history": [(h[0], h[1], round(h[2] * 100, 1)) for h in self.history[-200:]],
            # Donnees pattern (pour overlay)
            "pattern_data": list(self.values),
            # Segment du buffer correspondant au meilleur match (pour comparaison visuelle)
            "matched_segment": self.matched_segment[:500],
        }


# ===========================================================================
#  ETAT GLOBAL DU MOTEUR
# ===========================================================================

_state = {
    "running": False,
    "thread": None,
    "buffer": [],
    "total_points": 0,
    "detectors": [],
    "events": [],
    "dataset": None,
    "speed": SIMULATION_SPEED,
    "sim_progress": 0.0,
    "sim_total": 0,
    "points_per_second": 0.0,
    "eval_count": 0,
    "is_comparing": False,
}

_lock = threading.Lock()


def get_state():
    """Retourne l'etat complet du moteur (thread-safe)."""
    with _lock:
        buf = list(_state["buffer"])
        pps = _state["points_per_second"]
        detectors_data = [d.to_dict(buffer_len=len(buf), points_per_second=pps)
                          for d in _state["detectors"]]

        # Niveau global = le plus eleve (base sur alarm_confidence)
        if detectors_data:
            max_idx = max(LEVELS.index(d["alert_level"]) for d in detectors_data)
            global_level = LEVELS[max_idx]
            max_conf = max(d["alarm_confidence"] for d in detectors_data)
        else:
            global_level = "normal"
            max_conf = 0.0

        return {
            "running": _state["running"],
            "total_points": _state["total_points"],
            "buffer_size": len(buf),
            "buffer_data": buf[-2000:],
            "detectors": detectors_data,
            "active_count": len(_state["detectors"]),
            "events": _state["events"][-50:],
            "dataset": _state["dataset"],
            "speed": _state["speed"],
            "sim_progress": _state["sim_progress"],
            "global_level": global_level,
            "global_confidence": round(max_conf, 1),
            "points_per_second": pps,
            "eval_count": _state["eval_count"],
            "is_comparing": _state["is_comparing"],
            "config": {
                "eval_every": EVAL_EVERY,
                "match_threshold": MATCH_THRESHOLD,
                "prefix_ratios": PREFIX_RATIOS,
                "alert_levels": ALERT_LEVELS,
            },
        }


# ===========================================================================
#  BOUCLE DE SIMULATION
# ===========================================================================

def _run_simulation(dataset_filename, speed, start_index=0, max_points=0):
    """Boucle principale : simule un flux point par point."""
    global _state

    # Charger les donnees
    data = load_dataset(dataset_filename)
    series = data["value"].values
    total = len(series) if max_points <= 0 else min(max_points, len(series))

    with _lock:
        _state["sim_total"] = total
        _state["dataset"] = dataset_filename

    # Charger les patterns de reference
    all_patterns = db.list_patterns(dataset=dataset_filename)
    detectors = []
    max_pat_len = 0

    for p in all_patterns:
        full = db.get_pattern(p["id"])
        if full and full.get("values") and len(full["values"]) >= 20:
            d = PatternDetector(
                pattern_id=full["id"],
                name=full["name"],
                pattern_type=full.get("pattern_type", "normal"),
                values=full["values"],
                alert_threshold=full.get("alert_threshold", MATCH_THRESHOLD),
                alert_type=full.get("alert_type", "failure"),
            )
            detectors.append(d)
            max_pat_len = max(max_pat_len, len(full["values"]))

    with _lock:
        _state["detectors"] = detectors

    if not detectors:
        with _lock:
            _state["running"] = False
            _state["events"].append({
                "type": "error",
                "message": f"Aucun pattern trouve pour '{dataset_filename}'. "
                           "Sauvegardez des patterns depuis l'onglet Analyse.",
                "timestamp": time.time(),
            })
        return

    # Buffer
    buffer_capacity = int(max_pat_len * 3)
    buffer = []
    eval_counter = 0
    points_per_second = 1.0 / speed if speed > 0 else 200.0

    with _lock:
        _state["points_per_second"] = points_per_second
        _state["events"].append({
            "type": "start",
            "message": (f"Simulation demarree - {len(detectors)} pattern(s), "
                        f"eval chaque {EVAL_EVERY} pts, seuil {MATCH_THRESHOLD}%"),
            "timestamp": time.time(),
        })

    # Boucle point par point
    for i in range(start_index, start_index + total):
        with _lock:
            if not _state["running"]:
                break

        value = float(series[i])
        buffer.append(value)
        if len(buffer) > buffer_capacity:
            buffer = buffer[-buffer_capacity:]

        eval_counter += 1

        with _lock:
            _state["buffer"] = list(buffer)
            _state["total_points"] = i - start_index + 1
            _state["sim_progress"] = round(
                ((i - start_index + 1) / total) * 100, 1)

        # Evaluation periodique
        if eval_counter >= EVAL_EVERY and len(buffer) >= 30:
            eval_counter = 0

            with _lock:
                _state["eval_count"] += 1
                _state["is_comparing"] = True

            for detector in detectors:
                prev_detections = detector.detections_count
                event = detector.evaluate(buffer)

                # Nouveau match complet detecte
                if detector.detections_count > prev_detections:
                    new_match_event = {
                        "type": "new_match",
                        "pattern_id": detector.pattern_id,
                        "pattern_name": detector.name,
                        "pattern_type": detector.pattern_type,
                        "confidence": round(detector.confidence, 1),
                        "similarity": round(detector.best_similarity, 1),
                        "progress": round(detector.progress * 100, 1),
                        "detections_count": detector.detections_count,
                        "timestamp": time.time(),
                    }
                    with _lock:
                        _state["events"].append(new_match_event)

                if event:
                    with _lock:
                        _state["events"].append(event)

                    # Sauvegarder les evenements importants en DB
                    if event["type"] in ("high_confidence", "level_change"):
                        db.save_realtime_event(
                            pattern_id=detector.pattern_id,
                            pattern_name=detector.name,
                            pattern_type=detector.pattern_type,
                            split_index=int(detector.progress * 100),
                            total_splits=100,
                            similarity=event.get("similarity", 0),
                            confidence=event.get("alert_level", event.get("to_level", "normal")),
                            details={
                                "confidence": event.get("confidence", 0),
                                "progress": event.get("progress", 0),
                            },
                        )

            with _lock:
                _state["is_comparing"] = False

        time.sleep(speed)

    # Fin
    total_matches = sum(d.detections_count for d in detectors)
    with _lock:
        _state["running"] = False
        _state["is_comparing"] = False
        _state["events"].append({
            "type": "end",
            "message": f"Simulation terminee. {total_matches} correspondance(s) detectee(s) sur {len(detectors)} pattern(s).",
            "total_matches": total_matches,
            "patterns_count": len(detectors),
            "timestamp": time.time(),
        })


# ===========================================================================
#  CONTROLE PUBLIC
# ===========================================================================

def start_simulation(dataset_filename, speed=SIMULATION_SPEED,
                     start_index=0, max_points=0):
    with _lock:
        if _state["running"]:
            return {"error": "Simulation deja en cours."}
        _state["running"] = True
        _state["buffer"] = []
        _state["total_points"] = 0
        _state["detectors"] = []
        _state["events"] = []
        _state["sim_progress"] = 0.0
        _state["speed"] = speed
        _state["eval_count"] = 0
        _state["is_comparing"] = False

    thread = threading.Thread(
        target=_run_simulation,
        args=(dataset_filename, speed, start_index, max_points),
        daemon=True,
    )
    thread.start()

    with _lock:
        _state["thread"] = thread

    return {"message": "Simulation demarree."}


def stop_simulation():
    with _lock:
        if not _state["running"]:
            return {"message": "Aucune simulation en cours."}
        _state["running"] = False
    return {"message": "Simulation arretee."}
