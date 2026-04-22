# 🚨 Early Warning System — Documentation Technique

> Système d'alerte précoce basé sur **Sliding Window MASS + Machine à États** pour la détection en temps réel de patterns dans des séries temporelles industrielles.

---

## Table des matières

1. [Introduction](#introduction)
2. [Pourquoi un Early Warning System ?](#pourquoi-un-early-warning-system-)
3. [Architecture globale](#architecture-globale)
4. [Algorithme Sliding Window MASS](#algorithme-sliding-window-mass)
5. [Machine à États (State Machine)](#machine-à-états-state-machine)
6. [PatternTracker — Suivi individuel](#patterntracker--suivi-individuel)
7. [Buffer circulaire](#buffer-circulaire)
8. [Conversion distance → similarité](#conversion-distance--similarité)
9. [Configuration et seuils](#configuration-et-seuils)
10. [API REST temps réel](#api-rest-temps-réel)
11. [Frontend — Dashboard de monitoring](#frontend--dashboard-de-monitoring)
12. [Base de données — Traçabilité](#base-de-données--traçabilité)
13. [Flux de données complet](#flux-de-données-complet)
14. [Comparaison avec l'approche SPLITS](#comparaison-avec-lapproche-splits)
15. [Cas d'usage industriels](#cas-dusage-industriels)
16. [Limitations et perspectives](#limitations-et-perspectives)

---

## Introduction

L'**Early Warning System (EWS)** est un module de surveillance continue intégré à l'application Pattern Recognition Energy Analytics. Il permet de détecter en temps réel l'apparition de patterns connus (normaux ou de panne) dans un flux de données industrielles, et d'alerter progressivement l'opérateur avant qu'une situation critique ne se produise.

Le système repose sur deux piliers :
1. **Sliding Window MASS** : algorithme de recherche de similarité O(n log n) appliqué sur un buffer glissant
2. **Machine à États** : automate à 5 niveaux avec hystérésis pour éviter les faux positifs

---

## Pourquoi un Early Warning System ?

### Problématiques industrielles

| Problème | Impact | Solution EWS |
|---|---|---|
| Panne imprévue | Arrêt de production, coûts élevés | Détection précoce des signatures de panne |
| Faux positifs | Fatigue d'alerte, perte de confiance | Machine à états avec checks consécutifs |
| Détection tardive | Temps de réaction insuffisant | Surveillance continue, alerte progressive |
| Monitoring manuel | Coûteux, sujet à erreurs humaines | Automatisation avec algorithme MASS |
| Manque de traçabilité | Pas d'historique des incidents | Événements sauvegardés en base SQLite |

### Valeur ajoutée

- **Proactivité** : le système alerte AVANT la panne, pas après
- **Fiabilité** : les transitions d'état nécessitent des confirmations consécutives
- **Multi-patterns** : surveillance simultanée de plusieurs signatures de référence
- **Indépendance d'échelle** : la normalisation Z-score permet de comparer des patterns d'amplitudes différentes
- **Performance** : MASS O(n log n) vs DTW O(n × m²) — traitement rapide même sur de longues séries

---

## Architecture globale

```
┌─────────────────────────────────────────────────────────────────┐
│                    EARLY WARNING SYSTEM                          │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   realtime_engine.py                       │  │
│  │                                                            │  │
│  │  ┌──────────┐    ┌──────────────┐    ┌────────────────┐   │  │
│  │  │ CSV Data │───→│   Circular   │───→│  PatternTracker│   │  │
│  │  │ (IoT sim)│    │   Buffer     │    │  #1 (Normal)   │   │  │
│  │  └──────────┘    │              │    ├────────────────┤   │  │
│  │    point/point   │  1.5× max    │    │  PatternTracker│   │  │
│  │    (speed s)     │  pattern len │    │  #2 (Panne)    │   │  │
│  │                  │              │    ├────────────────┤   │  │
│  │                  └──────┬───────┘    │  PatternTracker│   │  │
│  │                         │            │  #N (...)       │   │  │
│  │                         │            └───────┬────────┘   │  │
│  │                  toutes les 20 obs           │            │  │
│  │                         │                    │            │  │
│  │                  ┌──────▼────────────────────▼────────┐   │  │
│  │                  │     stumpy.mass(pattern, buffer)    │   │  │
│  │                  │     → distance → similarité %       │   │  │
│  │                  │     → state machine update          │   │  │
│  │                  └──────────────┬─────────────────────┘   │  │
│  │                                 │                          │  │
│  │                          si transition                     │  │
│  │                                 │                          │  │
│  │                  ┌──────────────▼─────────────────────┐   │  │
│  │                  │     Événement → _state + SQLite     │   │  │
│  │                  └────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   realtime.py (API)                        │  │
│  │  POST /start · POST /stop · GET /status                    │  │
│  │  GET /events · DELETE /events · GET /config                │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                 RealtimeMonitor.jsx (Frontend)             │  │
│  │  AlertBanner · TrackerCard × N · EventCard × N             │  │
│  │  Polling 600ms · Jauge SVG · Timeline · Overlay Z-Norm    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Algorithme Sliding Window MASS

### Principe

Au lieu de segmenter les données en morceaux fixes, le système utilise un **buffer circulaire glissant** et l'algorithme **MASS** (Mueen's Algorithm for Similarity Search) pour chercher le meilleur alignement du pattern de référence dans le buffer, à n'importe quelle position.

### Fonctionnement

```python
# Pour chaque évaluation (toutes les 20 observations) :
distance_profile = stumpy.mass(pattern_values, buffer)
best_idx = np.nanargmin(distance_profile)
best_dist = np.nanmin(distance_profile)
```

- **Entrée** : un pattern de référence (ex : 200 points) et un buffer (ex : 300 points)
- **Sortie** : un profil de distance — un score pour chaque position possible du buffer
- **Complexité** : O(n log n) grâce à la FFT (Fast Fourier Transform)
- **Résultat** : la position `best_idx` et la distance minimale `best_dist`

### Avantages du Sliding Window

| Aspect | Description |
|---|---|
| **Tolérance temporelle** | Le pattern peut apparaître à n'importe quelle position dans le buffer |
| **Normalisation automatique** | MASS effectue une z-normalisation intégrée |
| **Pas de segmentation rigide** | Pas besoin de découper les données en morceaux de taille fixe |
| **Continuité** | Le buffer ne se vide jamais — il glisse (circulaire) |

---

## Machine à États (State Machine)

### Diagramme de transitions

```
                  ≥35%          ≥55%           ≥72%          ≥85%
                2 checks      3 checks       2 checks      2 checks
  ┌──────┐    ┌──────────┐    ┌─────────┐    ┌───────┐    ┌───────────┐
  │ IDLE │───→│ WATCHING │───→│ WARNING │───→│ ALERT │───→│ CONFIRMED │
  │(gris)│    │ (bleu)   │    │ (ambre) │    │(orange)│   │  (rouge)  │
  └──────┘    └──────────┘    └─────────┘    └───────┘    └───────────┘
     ▲                                                          │
     │                    <25%, 3 checks consécutifs            │
     └──────────────────────────────────────────────────────────┘
```

### Niveaux détaillés

| Niveau | Seuil | Checks consécutifs | Signification | Action recommandée |
|---|---|---|---|---|
| **IDLE** | — | — | Aucune activité significative | Aucune |
| **WATCHING** | ≥ 35% | 2 | Ressemblance faible détectée | Surveillance passive |
| **WARNING** | ≥ 55% | 3 | Ressemblance modérée confirmée | Attention, vérifier les paramètres |
| **ALERT** | ≥ 72% | 2 | Forte ressemblance, probabilité élevée | Préparer l'intervention |
| **CONFIRMED** | ≥ 85% | 2 | Correspondance quasi certaine | Agir immédiatement |

### Mécanisme anti faux-positifs

Le système exige des **checks consécutifs** avant chaque transition montante :

```
Éval 1 : sim = 40%  → consecutive = 1 (pas encore WATCHING, besoin de 2)
Éval 2 : sim = 38%  → consecutive = 2 → TRANSITION IDLE → WATCHING ✓
Éval 3 : sim = 30%  → consecutive reset (sous seuil WARNING, décrémente)
Éval 4 : sim = 56%  → consecutive = 1 (pas encore WARNING, besoin de 3)
Éval 5 : sim = 60%  → consecutive = 2
Éval 6 : sim = 58%  → consecutive = 3 → TRANSITION WATCHING → WARNING ✓
```

### Mécanisme de retour (drop)

Si la similarité chute sous **25%** pendant **3 évaluations consécutives**, le tracker revient directement à **IDLE**, quel que soit son niveau actuel.

```python
if sim < THRESH_DROP:
    drop_consecutive += 1
    consecutive = 0
    if drop_consecutive >= CONSEC_DROP and level != "idle":
        transition("idle")
```

### Propriétés de la machine à états

- **Monotone montante** : les transitions ne sautent jamais de niveaux (IDLE ne peut pas aller directement à ALERT)
- **Retour direct** : le drop revient toujours à IDLE (pas de désescalade progressive)
- **Indépendante par pattern** : chaque pattern a son propre tracker et sa propre machine à états
- **Persistante** : l'état est maintenu entre les évaluations

---

## PatternTracker — Suivi individuel

### Structure de données

```python
class PatternTracker:
    # Identité
    pattern_id: int          # ID en base
    name: str                # Nom du pattern
    pattern_type: str        # "normal" ou "failure"
    values: np.ndarray       # Valeurs du pattern de référence (float64)
    m: int                   # Longueur du pattern

    # État courant
    level: str               # "idle" | "watching" | "warning" | "alert" | "confirmed"
    similarity: float        # Dernière similarité calculée (0-100%)
    best_position: int       # Position du meilleur match dans le buffer
    consecutive: int         # Compteur de checks consécutifs montants
    drop_consecutive: int    # Compteur de checks consécutifs descendants

    # Historique
    history: list            # [(timestamp, similarity), ...] — max 200 points
```

### Méthode `update(buffer)`

1. Vérifie que le buffer est assez grand (≥ longueur du pattern)
2. Vérifie que ni le pattern ni le buffer ne sont plats (amplitude < 0.01)
3. Exécute `stumpy.mass(pattern, buffer)` → profil de distance
4. Trouve la position et la distance minimale
5. Convertit la distance en similarité (0-100%)
6. Met à jour la machine à états (transitions montantes ou drop)
7. Retourne l'événement de transition s'il y en a un

### Méthode `to_dict(buffer)`

Sérialise l'état pour l'API REST :

```python
{
    "pattern_id": 1,
    "name": "Cycle four",
    "pattern_type": "failure",
    "level": "warning",
    "similarity": 62.5,
    "consecutive": 2,
    "pattern_length": 200,
    "history": [(1712345678.0, 45.2), ...],    # 100 derniers points
    "pattern_data": [2.1, 3.4, 5.6, ...],     # Valeurs du pattern de référence
    "matched_segment": [2.3, 3.5, 5.8, ...]   # Segment du buffer correspondant
}
```

### Méthode `get_matched_segment(buffer)`

Extrait le segment du buffer qui correspond au meilleur match :

```python
start = max(0, best_position)
end = min(len(buffer), start + pattern_length)
return buffer[start:end]
```

Ce segment est utilisé par le frontend pour la **superposition Z-normalisée** (overlay) avec le pattern de référence.

---

## Buffer circulaire

### Principe

Le buffer accumule les données du flux point par point. Sa taille est limitée à **1.5× la longueur du plus grand pattern** de référence.

```python
buffer_capacity = int(max_pattern_length * 1.5)

# À chaque nouveau point :
buffer.append(value)
if len(buffer) > buffer_capacity:
    buffer = buffer[-buffer_capacity:]
```

### Justification de la taille

- **1.5× max pattern** : assure que le buffer contient au minimum un pattern complet + 50% de marge
- Pas de reset : le buffer glisse en permanence
- Maintient le contexte temporel entre les évaluations

### Exemple concret

Si le plus grand pattern fait 200 points :
- Buffer capacity = 300 points
- Le pattern de 200 pts peut être trouvé dans n'importe quelle fenêtre de 300 pts
- MASS calcule 101 scores de distance (300 - 200 + 1)

---

## Conversion distance → similarité

### Formule

```python
max_dist = np.sqrt(2 * pattern_length)
similarity = max(0, min(100, (1 - distance / max_dist) * 100))
```

### Explication

| Terme | Signification |
|---|---|
| `distance` | Distance euclidienne z-normalisée retournée par MASS |
| `max_dist` | Distance maximale théorique pour un pattern de longueur `m` |
| `√(2m)` | Basé sur la borne supérieure de la distance entre deux séries z-normalisées |
| `similarity` | Score 0-100% (0% = aucune ressemblance, 100% = identique) |

### Propriétés

- **Invariant d'échelle** : la z-normalisation de MASS rend la comparaison indépendante de l'amplitude
- **Borné** : toujours entre 0% et 100% grâce au `max(0, min(100, ...))`
- **Intuitif** : plus le pourcentage est élevé, plus les courbes se ressemblent

---

## Configuration et seuils

### Fichier : `backend/services/realtime_engine.py`

```python
# Fréquence d'évaluation
EVAL_EVERY       = 20       # Évaluation toutes les N observations

# Vitesse de simulation
SIMULATION_SPEED = 0.005    # Secondes entre chaque point simulé

# Seuils de transition (similarité %)
THRESH_WATCH   = 35.0       # IDLE → WATCHING
THRESH_WARNING = 55.0       # WATCHING → WARNING
THRESH_ALERT   = 72.0       # WARNING → ALERT
THRESH_CONFIRM = 85.0       # ALERT → CONFIRMED
THRESH_DROP    = 25.0       # Retour → IDLE

# Nombre de checks consécutifs requis
CONSEC_WATCH   = 2          # Pour passer à WATCHING
CONSEC_WARNING = 3          # Pour passer à WARNING
CONSEC_ALERT   = 2          # Pour passer à ALERT
CONSEC_CONFIRM = 2          # Pour passer à CONFIRMED
CONSEC_DROP    = 3          # Pour retourner à IDLE
```

### Ajustement des seuils

| Objectif | Modification |
|---|---|
| Moins de faux positifs | Augmenter `CONSEC_*` et/ou `THRESH_*` |
| Détection plus rapide | Réduire `EVAL_EVERY` et `CONSEC_*` |
| Détection plus sensible | Baisser `THRESH_WATCH` et `THRESH_WARNING` |
| Retour à IDLE plus strict | Augmenter `CONSEC_DROP` ou baisser `THRESH_DROP` |
| Performance temps réel | Augmenter `EVAL_EVERY` (moins de calculs MASS) |

---

## API REST temps réel

### Endpoints

| Méthode | Endpoint | Description |
|---|---|---|
| `POST` | `/realtime/start` | Démarre la simulation |
| `POST` | `/realtime/stop` | Arrête la simulation |
| `GET` | `/realtime/status` | État courant (trackers, buffer, events, progress) |
| `GET` | `/realtime/events` | Historique des événements en base |
| `DELETE` | `/realtime/events` | Supprime l'historique |
| `GET` | `/realtime/config` | Configuration (levels, thresholds, speed) |

### `POST /realtime/start`

```json
// Requête
{
  "dataset": "C2 elect kw.csv",
  "speed": 0.005,
  "start_index": 0,
  "max_points": 5000
}

// Réponse
{ "message": "Simulation démarrée." }
```

### `GET /realtime/status`

Réponse complète (extraits) :

```json
{
  "running": true,
  "total_points_received": 1234,
  "buffer_size": 300,
  "simulation_progress": 24.7,
  "global_alert_level": "warning",

  "trackers": [
    {
      "pattern_id": 1,
      "name": "Cycle démarrage",
      "pattern_type": "normal",
      "level": "warning",
      "similarity": 62.5,
      "consecutive": 2,
      "pattern_length": 200,
      "history": [[1712345678.0, 45.2], [1712345680.0, 62.5]],
      "pattern_data": [2.1, 3.4, ...],
      "matched_segment": [2.3, 3.5, ...]
    }
  ],

  "events": [
    {
      "type": "state_change",
      "pattern_name": "Cycle démarrage",
      "from_level": "watching",
      "to_level": "warning",
      "similarity": 62.5
    }
  ],

  "thresholds": {
    "watch": 35.0, "warning": 55.0,
    "alert": 72.0, "confirm": 85.0, "drop": 25.0
  }
}
```

### Champs clés de la réponse

| Champ | Type | Description |
|---|---|---|
| `running` | bool | Simulation en cours ? |
| `trackers` | array | Un objet par pattern de référence |
| `global_alert_level` | string | Niveau max parmi tous les trackers |
| `thresholds` | object | Seuils de la machine à états |
| `events` | array | 30 derniers événements (start, end, error, state_change) |
| `simulation_progress` | float | Pourcentage d'avancement (0-100) |
| `buffer_size` | int | Taille actuelle du buffer |
| `buffer_data` | array | Contenu du buffer (max 2000 points) |

---

## Frontend — Dashboard de monitoring

### Composant : `RealtimeMonitor.jsx`

Le composant principal est structuré en sous-composants mémoïsés (`React.memo`) :

### AlertBanner — Bandeau d'alerte globale

```
┌─────────────────────────────────────────────────────────────┐
│  ⚡ WARNING — Niveau d'alerte global     ○──○──●──○──○     │
│                                          idle       confirmed│
└─────────────────────────────────────────────────────────────┘
```

- Icône et couleur dynamiques selon le niveau
- Pipeline de 5 dots connectés montrant la progression
- Animation pulse pour les niveaux élevés (WARNING+)

### TrackerCard — Carte par pattern

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠ Cycle démarrage                    ╭──────╮   WARNING   │
│  ✓ Normal · 200 pts                   │  62  │             │
│                                       │  %   │             │
│                                       ╰──────╯             │
├────────────────────────────┬────────────────────────────────┤
│  ÉVOLUTION SIMILARITÉ      │  SUPERPOSITION (Z-NORM)        │
│  ╱╲    ╱╲                  │   ── Réf (violet)              │
│ ╱  ╲──╱  ╲        ·····55% │   ·· Flux (dynamique)          │
│╱         ╲──           35% │                                │
│  └──────────────────┘      │   └──────────────────────┘     │
└────────────────────────────┴────────────────────────────────┘
```

**Composants visuels :**

| Élément | Technologie | Description |
|---|---|---|
| Jauge circulaire | SVG `<circle>` | Stroke-dasharray animé, couleur dynamique selon similarité |
| Timeline | Plotly (line + fill) | Historique de similarité avec lignes de seuils en pointillés |
| Overlay Z-Norm | Plotly (2 lines) | Pattern de référence (violet) vs segment flux (couleur dynamique) |

**Z-normalisation frontend :**

```javascript
const zNorm = arr => {
  const mu = mean(arr), sigma = std(arr) || 1
  return arr.map(v => (v - mu) / sigma)
}
```

### EventCard — Événement de transition

```
┌─────────────────────────────────────────────────────────┐
│  [watching] → [warning]   Cycle démarrage   ⚠ PANNE  62.5% │
└─────────────────────────────────────────────────────────┘
```

- Badges colorés from/to avec les couleurs des niveaux
- Indicateur ⚠ PANNE pour les patterns de type failure
- Pourcentage de similarité à droite

### Configuration couleurs (LEVEL_META)

| Niveau | Couleur | Fond | Icône |
|---|---|---|---|
| `idle` | `#64748b` (gris) | `rgba(100,116,139,.10)` | `Shield` |
| `watching` | `#60a5fa` (bleu) | `rgba(96,165,250,.10)` | `Eye` |
| `warning` | `#fbbf24` (ambre) | `rgba(251,191,36,.10)` | `AlertTriangle` |
| `alert` | `#f97316` (orange) | `rgba(249,115,22,.12)` | `AlertCircle` |
| `confirmed` | `#ef4444` (rouge) | `rgba(239,68,68,.14)` | `Zap` |

### Polling et performance

- Intervalle de polling : **600ms** via `setInterval`
- Cleanup automatique lors du démontage (`clearInterval`)
- Composants mémoïsés (`React.memo`) pour éviter les re-renders inutiles
- Arrêt du polling quand la simulation est terminée

---

## Base de données — Traçabilité

### Table `realtime_events`

```sql
CREATE TABLE realtime_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_id      INTEGER,             -- Réf vers patterns.id
    pattern_name    TEXT,
    pattern_type    TEXT    DEFAULT 'normal',
    split_index     INTEGER,             -- Index du niveau atteint (0-4)
    total_splits    INTEGER,             -- Nombre total de niveaux (4)
    similarity      REAL,                -- Score de similarité (0-100%)
    confidence      TEXT    DEFAULT 'low', -- Nom du niveau atteint
    details_json    TEXT    DEFAULT '{}', -- JSON {"from": "...", "to": "..."}
    created_at      REAL    NOT NULL      -- Timestamp Unix
);
```

### Quels événements sont enregistrés ?

Seules les transitions vers **WARNING**, **ALERT** et **CONFIRMED** sont sauvegardées en base. Les transitions vers WATCHING et IDLE restent uniquement en mémoire (dans `_state["events"]`).

### Requêtes typiques

```sql
-- Derniers 10 événements
SELECT * FROM realtime_events ORDER BY created_at DESC LIMIT 10;

-- Alertes pour un pattern spécifique
SELECT * FROM realtime_events WHERE pattern_id = 1 AND confidence IN ('alert', 'confirmed');

-- Nombre d'alertes par pattern
SELECT pattern_name, COUNT(*) as nb_alerts
FROM realtime_events
WHERE confidence IN ('warning', 'alert', 'confirmed')
GROUP BY pattern_name
ORDER BY nb_alerts DESC;
```

---

## Flux de données complet

### Séquence de démarrage

```
1. L'utilisateur clique "Lancer" dans RealtimeMonitor
   │
2. POST /realtime/start {dataset, speed, start_index, max_points}
   │
3. Backend : start_simulation()
   ├── Vérifie qu'aucune simulation n'est en cours
   ├── Reset de l'état global (_state)
   └── Lance un thread daemon _run_simulation()
       │
4. Thread de simulation :
   ├── Charge le CSV via data_loader
   ├── Charge tous les patterns depuis SQLite (min 40 points)
   ├── Crée un PatternTracker par pattern
   ├── Calcule buffer_capacity = 1.5 × max_pattern_length
   │
5. Boucle point par point :
   │  ├── Lit series[i]
   │  ├── Ajoute au buffer circulaire
   │  ├── Incrémente eval_counter
   │  │
   │  └── Si eval_counter >= 20 et buffer >= 40 :
   │       ├── eval_counter = 0
   │       └── Pour chaque PatternTracker :
   │            ├── tracker.update(buffer)
   │            ├── Si transition → ajoute à _state["events"]
   │            └── Si WARNING+ → save_realtime_event() en SQLite
   │
   └── time.sleep(speed)

6. Frontend (en parallèle) :
   ├── Poll GET /realtime/status toutes les 600ms
   ├── Met à jour AlertBanner, TrackerCard, EventCard
   └── Arrête le polling quand running = false
```

### Séquence d'évaluation MASS (détail)

```
Buffer = [v1, v2, ..., v300]  (300 points)
Pattern = [p1, p2, ..., p200]  (200 points)

1. stumpy.mass(pattern, buffer)
   → distance_profile = [d0, d1, ..., d100]  (101 scores)
   → Chaque d_i = distance euclidienne z-normalisée
     entre pattern et buffer[i : i+200]

2. best_idx = argmin(distance_profile) = 42
   best_dist = min(distance_profile) = 3.14

3. max_dist = sqrt(2 × 200) = 20.0
   similarity = (1 - 3.14 / 20.0) × 100 = 84.3%

4. État courant = "alert", seuil confirm = 85%
   → 84.3% < 85% → pas de transition cette fois
   → consecutive décrementé
```

---

## Comparaison avec l'approche SPLITS

### Ancienne approche (SPLITS)

L'ancienne approche divisait le pattern en N segments (splits) et comparer chaque segment séquentiellement :

```
Pattern : [====|====|====|====|====]  (5 splits)
                 ↓ comparaison séquentielle
Flux    : [----][----][----][----][---]
```

### Limitations

| Limitation | Explication |
|---|---|
| Segmentation rigide | Les frontières de segments sont fixes → pas de tolérance au décalage |
| Pas de découverte naturelle | Si le pattern commence 10 points plus tard, aucun segment ne match |
| Reset systématique | Le buffer est vidé à chaque cycle → perte de contexte |
| Pas d'hystérésis | Un seul dépassement de seuil suffit → faux positifs |
| Complexité de configuration | Il faut choisir le nombre de splits, leur taille, etc. |

### Nouvelle approche (Sliding Window MASS)

```
Pattern : [========================]  (200 points, non découpé)
                 ↓ MASS (FFT, O(n log n))
Buffer  : [......................]  (300 points, glissant)
                    ↕ meilleur alignement trouvé automatiquement
```

### Avantages

| Aspect | SPLITS | Sliding Window MASS |
|---|---|---|
| Tolérance au décalage | ❌ | ✅ Trouve le meilleur alignement |
| Faux positifs | ❌ Fréquents | ✅ Checks consécutifs |
| Reset du buffer | ❌ À chaque cycle | ✅ Buffer circulaire continu |
| Configuration | Complexe (N splits) | Simple (seuils + consécutifs) |
| Complexité | O(m) par split | O(n log n) par évaluation |
| Monitoring | Par segment | Continu, toutes les 20 obs |

---

## Cas d'usage industriels

### 1. Détection de panne imminente

**Scénario** : Une signature énergétique spécifique précède toujours une panne de moteur.

**Configuration** :
1. Identifier la signature dans l'historique (onglet Analyse)
2. Sauvegarder comme pattern de type **"Panne"**
3. Lancer la surveillance temps réel
4. Le système alerte progressivement quand la signature réapparaît

**Interprétation** :
- WATCHING → surveillance passive, ne pas s'inquiéter
- WARNING → vérifier les paramètres de la machine
- ALERT → planifier une intervention
- CONFIRMED → intervenir immédiatement, panne imminente

### 2. Suivi de cycle de production normal

**Scénario** : Vérifier que le cycle de production suit le profil optimal.

**Configuration** :
1. Sélectionner un cycle de production "parfait" dans l'historique
2. Sauvegarder comme pattern de type **"Normal"**
3. Surveiller en temps réel
4. Le système confirme quand le cycle est normal (CONFIRMED = cycle conforme)

**Interprétation** :
- CONFIRMED sur un pattern Normal → le cycle est conforme
- Le pattern Normal reste en IDLE → le cycle actuel diffère du profil optimal

### 3. Monitoring multi-signes

**Scénario** : Surveiller simultanément 3 patterns normaux et 2 signatures de panne.

**Dashboard** :
- 5 TrackerCards affichées simultanément
- AlertBanner montre le niveau global le plus élevé
- Un pattern Panne en ALERT + un pattern Normal en CONFIRMED → situation cohérente mais critique
- Tous les patterns Normaux en IDLE + un pattern Panne en WARNING → vérification nécessaire

---

## Limitations et perspectives

### Limitations actuelles

| Limitation | Description |
|---|---|
| Simulation CSV | Le flux est simulé à partir d'un CSV, pas connecté à un capteur réel |
| Seuils fixes | Les seuils sont codés en dur dans `realtime_engine.py` |
| Mono-variable | Le système analyse une seule variable à la fois (la colonne `value`) |
| Buffer en mémoire | L'état du moteur est en RAM, perdu au redémarrage |
| Thread unique | Un seul thread de simulation (pas de parallélisme MASS) |

### Perspectives d'amélioration

| Amélioration | Description |
|---|---|
| Connexion IoT | Remplacer le CSV par un flux MQTT/Kafka réel |
| Seuils dynamiques | Interface pour ajuster les seuils depuis le frontend |
| Multi-variables | Surveillance de plusieurs colonnes simultanément |
| Persistance d'état | Sauvegarder l'état du moteur en base pour reprise après crash |
| Notifications | Email/SMS/webhook quand un niveau critique est atteint |
| MASS parallèle | Évaluer les patterns en parallèle (multiprocessing) |
| Auto-tuning | Ajustement automatique des seuils basé sur l'historique |

---

## Résumé technique

| Composant | Fichier | Rôle |
|---|---|---|
| Moteur EWS | `backend/services/realtime_engine.py` | PatternTracker + State Machine + Simulation |
| API REST | `backend/api/realtime.py` | Endpoints start/stop/status/events/config |
| Base de données | `backend/services/database.py` | Table `realtime_events` pour traçabilité |
| Dashboard | `frontend/src/components/RealtimeMonitor.jsx` | AlertBanner + TrackerCard + EventCard |
| Client API | `frontend/src/api/api.js` | startRealtime, stopRealtime, getRealtimeStatus, etc. |

---

*Documentation générée pour le projet Pattern Recognition Energy Analytics — Module Early Warning System.*
