# Pattern Recognition — Energy Analytics

> Application web de détection de patterns dans des séries temporelles industrielles.  
> Sélectionnez visuellement un profil sur un graphe interactif et retrouvez toutes ses occurrences similaires grâce à l'algorithme **MASS** (`stumpy`), avec un dashboard de monitoring complet et une bibliothèque de patterns sauvegardés.

---

## Table des matières

1. [Stack technique](#stack-technique)
2. [Installation](#installation)
3. [Lancement](#lancement)
4. [Structure du projet](#structure-du-projet)
5. [Architecture générale](#architecture-générale)
6. [API REST](#api-rest)
7. [Pipeline de traitement des données](#pipeline-de-traitement-des-données)
8. [Algorithme MASS (stumpy)](#algorithme-mass-stumpy)
9. [Base de données (SQLite)](#base-de-données-sqlite)
10. [Datasets](#datasets)
11. [Corrections et historique](#corrections-et-historique)

---

## Stack technique

| Composant | Technologie | Version |
|---|---|---|
| Backend | Python, FastAPI, uvicorn | Python 3.10+ |
| Traitement données | pandas, numpy | |
| Algorithme de recherche | **stumpy** (MASS — Mueen's Algorithm for Similarity Search) | |
| Base de données | SQLite (via `sqlite3`) | |
| Frontend | React, react-plotly.js, axios, **lucide-react** | React 19.2, Plotly.js 3.4 |
| Visualisation | Plotly.js `scattergl` (WebGL) | |
| Design | Dark theme glassmorphism, CSS variables, Inter font | |

**Dépendances Python** (`requirements.txt`) :
```
fastapi
uvicorn
pandas
numpy
stumpy
```

**Dépendances Node.js** (principales dans `package.json`) :
```
react 19.2.4, react-dom 19.2.4, react-plotly.js 2.6.0, plotly.js 3.4.0,
axios 1.13.6, lucide-react 1.7.0
```

---

## Installation

### Prérequis
- Python 3.10+
- Node.js 18+

### Backend

```bash
# Depuis la racine du projet
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux/macOS

pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

---

## Lancement

### Backend (depuis la racine du projet)

```bash
.venv\Scripts\activate
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

→ API disponible sur `http://127.0.0.1:8000`

> **Important** : utiliser `python -m uvicorn` (et non `uvicorn` directement) pour que les imports relatifs `from backend.xxx` fonctionnent.

### Frontend (dans un deuxième terminal)

```bash
cd frontend
npm start
```

→ Interface disponible sur `http://localhost:3000`

---

## Structure du projet

```
Pfe_Project/
├── README.md                          # Documentation développeur backend
├── FRONTEND_DEV.md                    # Documentation développeur frontend
├── GUIDE_UTILISATEUR.md               # Guide utilisateur final
├── requirements.txt                   # Dépendances Python
│
├── backend/
│   ├── main.py                        # Point d'entrée FastAPI + CORS
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── data.py                    # GET /datasets + GET /data (pagination)
│   │   └── pattern.py                 # POST /pattern, POST /scores, CRUD /patterns/*
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── data_loader.py            # Chargement CSV multi-datasets, cache mémoire
│   │   ├── dtw_similarity.py         # Algorithme MASS (stumpy) + extraction non-chevauchante
│   │   └── database.py               # CRUD SQLite pour la bibliothèque de patterns
│   │
│   ├── datasets/
│   │   ├── C2 elect kw.csv           # Consommation électrique (kW)
│   │   ├── C2 Prod Poid Process.csv  # Poids de production
│   │   ├── C2 Prod Tc Process.csv    # Temps de cycle production
│   │   └── C2 Vap kgh.csv            # Vapeur (kg/h)
│   │
│   └── patterns.db                    # Base SQLite (générée automatiquement)
│
└── frontend/
    ├── package.json
    ├── public/
    │   └── index.html                 # Shell HTML (Inter font, meta)
    └── src/
        ├── App.jsx                    # Composant racine — orchestration état global
        ├── App.css                    # Design system dark theme (CSS variables)
        ├── index.js                   # Point d'entrée React
        ├── index.css                  # Reset CSS, scrollbar
        │
        ├── api/
        │   └── api.js                 # Client HTTP — tous les appels API
        │
        └── components/
            ├── DatasetSelector.jsx     # Sélection du dataset au démarrage
            ├── EnergyGraph.jsx         # Graphe Plotly interactif + sélection + navigation
            ├── FilterPanel.jsx         # Panneau de filtres (seuil, max, presets)
            ├── MonitoringPanel.jsx     # Dashboard monitoring post-détection
            ├── PatternLibrary.jsx      # Bibliothèque CRUD des patterns sauvegardés
            ├── ScoreDistribution.jsx   # Histogramme des scores MASS
            └── SimilarPatterns.jsx     # Cartes cliquables des matches
```

---

## Architecture générale

```
┌──────────────────────────────────────────────────────────────┐
│                     FRONTEND (React 19)                       │
│                                                               │
│  DatasetSelector → choix du CSV                               │
│       │                                                       │
│       ▼                                                       │
│  ┌──────────────┐  ┌────────────────┐  ┌───────────────────┐ │
│  │ EnergyGraph  │  │MonitoringPanel │  │ SimilarPatterns   │ │
│  │ (Plotly GL)  │  │  (Dashboard)   │  │   (Cards)         │ │
│  └──────┬───────┘  └────────────────┘  └────────┬──────────┘ │
│         │ sélection zone                         │ clic       │
│         ▼                                        ▼            │
│  ┌──────────────┐  ┌────────────────┐  ┌───────────────────┐ │
│  │ FilterPanel  │  │ScoreDistrib.   │  │ PatternLibrary    │ │
│  │ (Filtres)    │  │  (Histogram)   │  │ (CRUD patterns)   │ │
│  └──────────────┘  └────────────────┘  └───────────────────┘ │
│                          │                                    │
│  ┌────────────────────────────────────────────────────────┐   │
│  │                   api.js (axios)                        │   │
│  │  fetchDatasets() fetchData() detectPattern()            │   │
│  │  computeAllScores() savePattern() listPatterns() ...    │   │
│  └────────────────────────┬───────────────────────────────┘   │
└───────────────────────────┼───────────────────────────────────┘
                            │ HTTP REST
┌───────────────────────────┼───────────────────────────────────┐
│                     BACKEND (FastAPI)                          │
│                            │                                   │
│  ┌────────────┐  ┌────────┴───────┐  ┌──────────────────────┐│
│  │GET /datasets│  │POST /pattern   │  │POST /patterns/save   ││
│  │GET /data    │  │POST /scores    │  │GET /patterns/{id}    ││
│  │(data.py)    │  │(pattern.py)    │  │DELETE /patterns/{id}  ││
│  └──────┬──────┘  └───────┬────────┘  └──────────┬───────────┘│
│         │                 │                       │            │
│         ▼                 ▼                       ▼            │
│  ┌──────────────────────────────┐  ┌──────────────────────┐   │
│  │  data_loader.py              │  │  database.py         │   │
│  │  Cache mémoire multi-dataset │  │  SQLite CRUD         │   │
│  └──────────────────────────────┘  └──────────────────────┘   │
│                  │                                             │
│  ┌───────────────┴─────────────────────┐                      │
│  │    dtw_similarity.py                 │                      │
│  │    stumpy.mass() + extraction        │                      │
│  │    non-chevauchante                  │                      │
│  └──────────────────────────────────────┘                      │
└────────────────────────────────────────────────────────────────┘
```

### Flux de données

1. **Sélection dataset** : `DatasetSelector` → `fetchDatasets()` → `GET /datasets` → l'utilisateur choisit un CSV
2. **Chargement** : `App.jsx` → `fetchData(page, dataset)` → `GET /data?page=0&dataset=xxx` → 50 000 points paginés
3. **Sélection** : l'utilisateur sélectionne une zone sur le graphe (drag)
4. **Détection** : `EnergyGraph` → `detectPattern(start, end, 9999, dataset)` → `POST /pattern`
5. **Résultats** : le backend renvoie `matches[]` + `monitoring{}` (distribution, stats, scores)
6. **Affichage** : rectangles colorés sur le graphe + monitoring panel + cartes similaires
7. **Filtrage** : `FilterPanel` filtre côté client par seuil de similarité et nombre max
8. **Navigation** : clic sur une carte ou boutons ◀/▶ pour zoomer sur un match
9. **Sauvegarde** : `MonitoringPanel` → `savePattern()` → `POST /patterns/save` → SQLite
10. **Bibliothèque** : `PatternLibrary` → `listPatterns()` / `getPattern()` / `deletePattern()`

---

## API REST

### `GET /datasets`

Liste tous les fichiers CSV disponibles dans `backend/datasets/`.

**Réponse :**
```json
{
  "datasets": [
    {
      "filename": "C2 elect kw.csv",
      "name": "C2 elect kw",
      "size_kb": 123456.7,
      "rows_estimate": 1801502,
      "columns": ["date", "cc_m", "value"]
    }
  ]
}
```

---

### `GET /data`

Retourne les points de données paginés (50 000 par page par défaut).

**Paramètres query :**

| Paramètre | Type | Défaut | Description |
|---|---|---|---|
| `page` | int | 0 | Numéro de page (0-indexé) |
| `page_size` | int | 50000 | Points par page |
| `dataset` | string | null | Nom du fichier CSV (null = dataset par défaut) |

**Réponse :**
```json
{
  "points": [
    { "date": "2021-12-01T00:00:01", "cc_m": "C14", "value": 2.9 }
  ],
  "page": 0,
  "page_size": 50000,
  "total_points": 1801502,
  "total_pages": 37
}
```

---

### `POST /pattern`

Recherche toutes les occurrences similaires d'un pattern via **MASS** (`stumpy.mass`).

**Corps de la requête :**
```json
{
  "start": "2022-03-15T08:00:00",
  "end":   "2022-03-15T09:00:00",
  "top_k": 9999,
  "dataset": "C2 elect kw.csv"
}
```

| Paramètre | Type | Défaut | Description |
|---|---|---|---|
| `start` | string (ISO date) | requis | Début du pattern sélectionné |
| `end` | string (ISO date) | requis | Fin du pattern sélectionné |
| `top_k` | int | 0 | 0 = tous les matches non-chevauchants, >0 = au plus top_k |
| `dataset` | string | null | Fichier CSV cible |

**Réponse :**
```json
{
  "matches": [
    {
      "start": "2022-06-10T14:00:00",
      "end": "2022-06-10T15:00:00",
      "score": 12.4,
      "similarity": 93.2,
      "match_mean": 45.6,
      "match_std": 12.3,
      "match_min": 20.1,
      "match_max": 78.9
    }
  ],
  "monitoring": {
    "pattern_info": {
      "nb_points": 720,
      "start": "2022-03-15 08:00:00",
      "end": "2022-03-15 09:00:00",
      "duration_hours": 1.0,
      "amplitude": 58.8,
      "mean": 45.2,
      "std": 12.1,
      "min": 20.0,
      "max": 78.8,
      "energy_total": 32544.0
    },
    "search_info": {
      "series_length": 1801502,
      "total_positions_scanned": 1800782,
      "matches_returned": 150,
      "computation_time_sec": 1.234
    },
    "distribution": {
      "excellent": { "label": "80–100%", "count": 42 },
      "good":      { "label": "50–79%",  "count": 68 },
      "low":       { "label": "<50%",    "count": 40 }
    },
    "score_stats": {
      "best_score": 12.4,
      "worst_score": 89.7,
      "avg_score": 45.6,
      "median_score": 42.1,
      "std_score": 18.3
    }
  }
}
```

> **Score MASS** : distance euclidienne normalisée. Plus il est **bas**, plus le match est similaire.  
> **Similarity** : score normalisé 0–100%. Trois intervalles : Excellent (≥80%), Bon (50–79%), Faible (<50%).

---

### `POST /scores`

Calcule les scores de distance du pattern contre N sous-séquences échantillonnées (pour l'histogramme).

**Corps :**
```json
{
  "start": "2022-03-15T08:00:00",
  "end":   "2022-03-15T09:00:00",
  "n_subseq": 1000,
  "dataset": "C2 elect kw.csv"
}
```

**Réponse :**
```json
{
  "scores": [
    { "index": 0, "score": 45.6 },
    { "index": 144, "score": 23.1 }
  ],
  "total_subsequences": 1000,
  "computed": 1000
}
```

---

### `POST /patterns/save`

Sauvegarde un pattern dans la bibliothèque SQLite.

**Corps :**
```json
{
  "start": "2022-03-15T08:00:00",
  "end":   "2022-03-15T09:00:00",
  "name": "Cycle production A",
  "description": "Cycle typique haute puissance",
  "match_count": 150,
  "distribution": { "excellent": 42, "good": 68, "low": 40 },
  "dataset": "C2 elect kw.csv"
}
```

---

### `GET /patterns`

Liste tous les patterns sauvegardés (résumé).

---

### `GET /patterns/{id}`

Retourne le détail complet d'un pattern (valeurs, dates, stats, distribution).

---

### `DELETE /patterns/{id}`

Supprime un pattern de la bibliothèque.

---

## Pipeline de traitement des données

### 1. Chargement multi-dataset (`data_loader.py`)

```python
DATASETS_DIR = Path(__file__).parent.parent / "datasets"
```

| Étape | Description |
|---|---|
| 1. Liste datasets | `list_datasets()` — scanne `datasets/*.csv`, retourne nom, taille, colonnes |
| 2. Lecture CSV | `pd.read_csv(path)` via `pathlib` |
| 3. Parsing dates | `pd.to_datetime(format="mixed")` — gère les formats avec et sans microsecondes |
| 4. Conversion valeurs | Remplacement virgules → points, `pd.to_numeric(errors="coerce")` puis `.astype(np.float64)` |
| 5. Tri chronologique | `sort_values("date")` |
| 6. Nettoyage | `dropna()` — supprime les lignes NaN |
| 7. Indexation | `set_index("date")` — la date devient l'index |
| 8. Cache mémoire | Dict `_cache` indexé par chemin — chaque CSV n'est lu qu'**une seule fois** |

> **Note** : le `.astype(np.float64)` est critique pour `stumpy.mass()` qui attend du float64 (sinon TypeError avec des données entières).

### 2. Pagination (`data.py`)

L'endpoint `GET /data` retourne des pages de 50 000 points :

```python
start_idx = page * page_size
end_idx = start_idx + page_size
result = data.iloc[start_idx:end_idx].reset_index().to_dict(orient="records")
```

---

## Algorithme MASS (stumpy)

### Vue d'ensemble

L'algorithme dans `dtw_similarity.py` utilise **MASS** (Mueen's Algorithm for Similarity Search) via la bibliothèque `stumpy` pour calculer le profil de distance en **O(n log n)** sur toute la série.

### Pipeline

```
Série complète (ex: 1,8M points)
    │
    ▼ stumpy.mass(pattern, series)
    │
    │  → Retourne un profil de distance (1 score par position)
    │  → Complexité O(n log n) via FFT
    │
    ▼ Remplacement NaN → Inf
    │
    ▼ Extraction non-chevauchante (_get_non_overlapping_fast)
    │  → Tri du profil par score croissant
    │  → Sélection gloutonne avec zone d'exclusion (pattern_len / 2)
    │  → Si top_k=0 : retourne TOUS les matches non-chevauchants
    │  → Si top_k>0 : retourne au plus top_k
    │
    ▼ Résultats : [{ index, score }, ...]
```

### Détails techniques

- **z-normalisation** : comparaison indépendante de l'amplitude (`z_normalize`)
- **Zone d'exclusion** : `pattern_len // 2` — empêche les matches chevauchants
- **Pattern plat** : si amplitude < 0.01, abandon immédiat (évite résultats absurdes)
- **Extraction vectorisée** : tri O(n log n) puis parcours linéaire avec masque de blocage

### Avantages vs DTW

| | MASS (stumpy) | DTW (tslearn) |
|---|---|---|
| Complexité | O(n log n) | O(n × m²) par fenêtre |
| Vitesse (1,8M pts) | ~1-2 sec | ~45-120 sec |
| Pré-filtres nécessaires | Non | Oui (amplitude, variance, corrélation) |
| Normalisation | Z-score intégré | Manuelle |

---

## Base de données (SQLite)

### Schéma (`database.py`)

```sql
CREATE TABLE patterns (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    description TEXT    DEFAULT '',
    values_json TEXT    NOT NULL,        -- JSON array des valeurs du pattern
    dates_json  TEXT    NOT NULL,        -- JSON array des dates ISO
    stats_json  TEXT    NOT NULL,        -- JSON objet (mean, std, distribution, etc.)
    match_count INTEGER DEFAULT 0,       -- Nombre d'occurrences trouvées
    created_at  REAL    NOT NULL         -- Timestamp Unix
);
```

Le fichier `patterns.db` est créé automatiquement dans `backend/` au premier lancement.

**Pragma** : `journal_mode=WAL` pour les performances de lecture concurrente.

---

## Datasets

Les fichiers CSV sont dans `backend/datasets/` :

| Fichier | Description | Colonnes |
|---|---|---|
| `C2 elect kw.csv` | Consommation électrique (kW) | date, cc_m, value |
| `C2 Prod Poid Process.csv` | Poids de production | date, cc_m, value |
| `C2 Prod Tc Process.csv` | Temps de cycle production | date, cc_m, value |
| `C2 Vap kgh.csv` | Vapeur (kg/h) | date, cc_m, value |

**Format CSV** :

| Colonne | Type | Exemple |
|---|---|---|
| `date` | string | `2021-12-01 00:00:01` ou `2024-08-20 10:26:00.394807` |
| `cc_m` | string | `C14` |
| `value` | string (décimal virgule) | `2,9` |

> Deux formats de date coexistent → `format="mixed"` dans le parsing.  
> Les valeurs utilisent la virgule décimale → conversion `.str.replace(",", ".")`.

---

## Corrections et historique

### Bugs corrigés

| Problème | Cause | Solution |
|---|---|---|
| `TypeError` stumpy avec dataset Poids | `stumpy.mass()` attend float64, les entiers passaient en int64 | `.astype(np.float64)` dans `data_loader.py` |
| `SyntaxError` pattern.py ligne 109 | Deux statements sur une seule ligne (manque de newline) | Ajout du retour à la ligne |
| 889K points au lieu de 1,8M | `pd.to_datetime` sans `format="mixed"` → NaT sur dates avec microsecondes | `format="mixed"` |
| Crash 500 IndexError | `dates[index + len(pattern)]` dépassait le tableau | `min(index + len(pattern), len(dates) - 1)` |
| Division par zéro | Pattern plat (amplitude 0) | Vérification `pattern_amp < 0.01` |
| Chemin CSV cassé | Chemin relatif dépendant du CWD | `pathlib.Path(__file__).parent.parent / "datasets"` |
| Frontend recevait 1,8M points | `GET /data` retournait tout | Pagination par pages de 50 000 |

### Fonctionnalités

| Fonctionnalité | Description |
|---|---|
| Multi-dataset | Sélection du CSV au démarrage (4 datasets disponibles) |
| MASS (stumpy) | Remplacement de DTW par MASS : ~50× plus rapide |
| Pagination | Navigation par pages de 50 000 points |
| Bibliothèque patterns | CRUD complet avec SQLite (save, list, get, delete) |
| Filtrage côté client | Seuil de similarité + nombre max via FilterPanel |
| Navigation matches | Boutons ◀/▶ + clic sur carte → zoom automatique |
| Score distribution | Histogramme des scores MASS de toutes les sous-séquences |
| Monitoring complet | Distribution, stats pattern, scores, pipeline |
| Dark theme premium | Design glassmorphism avec CSS variables et Lucide icons |
