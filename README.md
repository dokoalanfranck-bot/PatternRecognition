# Energy Pattern Detection — Documentation complète du projet

Application web de détection de patterns de consommation électrique industrielle.  
Permet de sélectionner visuellement un profil de consommation sur un graphe interactif et de retrouver **toutes** ses occurrences similaires dans un historique de ~1,8 million de points, avec un tableau de bord de monitoring complet.

---

## Table des matières

1. [Stack technique](#stack-technique)
2. [Installation](#installation)
3. [Lancement](#lancement)
4. [Structure du projet](#structure-du-projet)
5. [Architecture générale](#architecture-générale)
6. [API REST](#api-rest)
7. [Pipeline de traitement des données](#pipeline-de-traitement-des-données)
8. [Algorithme de recherche DTW](#algorithme-de-recherche-dtw)
9. [Downsampling LTTB](#downsampling-lttb)
10. [Composants Frontend](#composants-frontend)
11. [Datasets](#datasets)
12. [Corrections et historique](#corrections-et-historique)

---

## Stack technique

| Composant | Technologie | Version |
|---|---|---|
| Backend | Python, FastAPI, uvicorn | 3.10+ |
| Traitement données | pandas, numpy | |
| Algorithme DTW | `tslearn` (Dynamic Time Warping) | |
| Pré-filtres statistiques | `scipy` (Pearson), numpy | |
| Frontend | React, react-plotly.js, axios | React 19.2, Plotly.js 3.4 |
| Visualisation | Plotly.js `scattergl` (WebGL) | |
| Gestion données lourdes | Git LFS | |

**Dépendances Python** (`requirements.txt`) :
```
fastapi, uvicorn, pandas, numpy, scipy, tslearn, dtaidistance
```

**Dépendances Node.js** (principales dans `package.json`) :
```
react 19.2.4, react-dom 19.2.4, react-plotly.js 2.6.0, plotly.js 3.4.0, axios 1.13.6
```

---

## Installation

### Prérequis
- Python 3.10+
- Node.js 18+
- Git LFS (pour les fichiers CSV volumineux)

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

### Git LFS

Les fichiers CSV (~451 MB au total) sont gérés par Git LFS. Si les fichiers CSV ne sont pas téléchargés après un clone :

```bash
git lfs install
git lfs pull
```

---

## Lancement

### Backend (depuis la racine du projet)

```bash
.venv\Scripts\activate
uvicorn backend.main:app --reload
```

→ API disponible sur `http://127.0.0.1:8000`

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
├── README.md                          # Cette documentation
├── requirements.txt                   # Dépendances Python
├── .gitattributes                     # Règles Git LFS pour les CSV
│
├── backend/
│   ├── main.py                        # Point d'entrée FastAPI + CORS
│   ├── test_mass.py                   # Tests
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── data.py                    # GET /data — sert les données au frontend
│   │   └── pattern.py                 # POST /pattern + POST /scores — détection + monitoring
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── data_loader.py            # Chargement CSV, parsing dates, cache mémoire
│   │   ├── dtw_similarity.py         # Algorithme DTW avec pré-filtres adaptatifs + fallback
│   │   └── downsampling.py           # Algorithme LTTB (Largest-Triangle-Three-Buckets)
│   │
│   └── datasets/
│       ├── C2 elect kw.csv           # Consommation électrique (kW) — ~1,8M points
│       ├── C2 Prod Poid Process.csv  # Poids de production
│       ├── C2 Prod Tc Process.csv    # Temps de cycle production
│       └── C2 Vap kgh.csv            # Vapeur (kg/h)
│
└── frontend/
    ├── package.json
    ├── public/
    │   └── index.html
    └── src/
        ├── App.js                     # Composant racine — orchestration état global
        ├── App.css                    # Styles globaux
        ├── index.js                   # Point d'entrée React
        │
        ├── api/
        │   └── api.js                 # Client HTTP — fetchData, detectPattern, computeAllScores
        │
        └── components/
            ├── EnergyGraph.js         # Graphe interactif Plotly + sélection + filtres + navigation
            ├── MonitoringPanel.js     # Dashboard de monitoring post-détection
            ├── SimilarPatterns.js     # Cartes cliquables des matches
            └── ScoreDistribution.js   # Histogramme des scores DTW
```

---

## Architecture générale

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                     │
│                                                          │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ EnergyGraph│  │MonitoringPanel│ │ SimilarPatterns │  │
│  │ (Plotly GL)│  │  (Dashboard) │  │   (Cards)       │  │
│  └─────┬──────┘  └──────────────┘  └────────┬────────┘  │
│        │ sélection zone                      │ clic      │
│        ▼                                     ▼           │
│  ┌──────────────────────────────────────────────────┐    │
│  │                api.js (axios)                     │    │
│  │  fetchData()  detectPattern()  computeAllScores() │    │
│  └──────────────────────┬───────────────────────────┘    │
└─────────────────────────┼────────────────────────────────┘
                          │ HTTP
┌─────────────────────────┼────────────────────────────────┐
│                     BACKEND (FastAPI)                     │
│                          │                                │
│  ┌──────────┐  ┌────────┴──────┐  ┌──────────────────┐  │
│  │ GET /data │  │ POST /pattern │  │  POST /scores    │  │
│  │ (data.py) │  │ (pattern.py)  │  │  (pattern.py)    │  │
│  └─────┬─────┘  └──────┬───────┘  └────────┬─────────┘  │
│        │               │                    │             │
│        ▼               ▼                    ▼             │
│  ┌──────────────────────────────────────────────────┐    │
│  │            data_loader.py (cache mémoire)         │    │
│  │            → charge C2 elect kw.csv une seule fois│    │
│  └──────────────────────────────────────────────────┘    │
│                         │                                 │
│  ┌──────────────────────┴──────────────────────────┐     │
│  │           dtw_similarity.py                      │     │
│  │  Fenêtre glissante + pré-filtres + DTW + fallback│     │
│  └──────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────┘
```

### Flux de données

1. **Chargement** : `App.js` → `fetchData()` → `GET /data` → retourne 5 000 points
2. **Sélection** : l'utilisateur sélectionne une zone sur le graphe (drag)
3. **Détection** : `EnergyGraph.js` → `detectPattern(start, end, 9999)` → `POST /pattern`
4. **Résultats** : le backend envoie tous les cycles similaires + données de monitoring
5. **Affichage** : les matches sont colorés sur le graphe, le monitoring s'affiche, les cartes apparaissent
6. **Filtrage** : l'utilisateur filtre par intervalle de similarité (boutons 80-100%, 50-79%, <50%)
7. **Navigation** : clic sur une carte ou boutons ◀/▶ pour zoomer sur un match

---

## API REST

### `GET /data`

Retourne les points de consommation pour l'affichage du graphe principal.

**Comportement** : retourne les 5 000 premiers points de la série triée chronologiquement.

**Réponse** (tableau JSON) :
```json
[
  { "date": "2021-12-01T00:00:01", "cc_m": "C14", "value": 2.9 },
  ...
]
```

---

### `POST /pattern`

Recherche **toutes** les occurrences similaires d'un pattern dans la série complète (1,8M points).  
Retourne les résultats enrichis avec un objet de **monitoring** complet.

**Corps de la requête :**
```json
{
  "start": "2022-03-15T08:00:00",
  "end":   "2022-03-15T09:00:00",
  "top_k": 9999
}
```

| Paramètre | Type | Défaut | Plage | Description |
|---|---|---|---|---|
| `start` | string (ISO date) | — | — | Début du pattern sélectionné |
| `end` | string (ISO date) | — | — | Fin du pattern sélectionné |
| `top_k` | int | 10 | 1–10 000 | Nombre max de résultats (le frontend envoie 9999 pour récupérer tous les cycles) |

**Réponse complète :**
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
      "step": 72,
      "total_positions_scanned": 25020,
      "passed_amplitude_filter": 18200,
      "passed_variance_filter": 18150,
      "passed_correlation_filter": 5400,
      "dtw_computed": 5400,
      "matches_returned": 10,
      "computation_time_sec": 45.234
    },
    "distribution": {
      "excellent": { "label": "80–100%", "count": 3, "color": "#2ecc71" },
      "good":      { "label": "50–79%",  "count": 5, "color": "#3498db" },
      "low":       { "label": "<50%",    "count": 2, "color": "#f39c12" }
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

**Réponse si pattern invalide :**
```json
{
  "matches": [],
  "error": "Sélection trop courte. Choisissez une zone d'au moins 10 points."
}
```

> **Score DTW** : distance Dynamic Time Warping. Plus il est **bas**, plus le match est similaire.  
> **Similarity** : score normalisé 0–100% (calculé côté frontend et backend).

#### Calcul de la similarité

```
similarity = 95 - ((score - min_score) / (max_score - min_score)) * 55
```

Le meilleur match obtient ~95%, le pire ~40%. Trois intervalles :
- **Excellent** (vert) : 80–100%
- **Bon** (bleu) : 50–79%
- **Faible** (orange) : < 50%

---

### `POST /scores`

Calcule le score DTW brut du pattern contre les N premières sous-séquences **sans aucun filtre**.  
Utilisé pour afficher la distribution complète des scores dans le composant `ScoreDistribution`.

**Corps de la requête :**
```json
{
  "start": "2022-03-15T08:00:00",
  "end":   "2022-03-15T09:00:00",
  "n_subseq": 1000
}
```

| Paramètre | Type | Défaut | Description |
|---|---|---|---|
| `start` | string | — | Début du pattern |
| `end` | string | — | Fin du pattern |
| `n_subseq` | int | 1000 | Nombre de sous-séquences à évaluer |

**Réponse :**
```json
{
  "scores": [
    { "index": 0, "score": 45.6 },
    { "index": 144, "score": 23.1 }
  ],
  "total_subsequences": 25020,
  "computed": 1000
}
```

---

## Pipeline de traitement des données

### 1. Chargement (`data_loader.py`)

```
CSV_PATH = Path(__file__).parent.parent / "datasets" / "C2 elect kw.csv"
```

| Étape | Description |
|---|---|
| 1. Lecture CSV | `pd.read_csv()` avec chemin absolu via `pathlib` |
| 2. Parsing dates | `pd.to_datetime(format="mixed")` — gère `2021-12-01 00:00:01` ET `2024-08-20 10:26:00.394807` |
| 3. Conversion valeurs | Remplacement virgules → points, puis `pd.to_numeric(errors="coerce")` |
| 4. Tri chronologique | `sort_values("date")` |
| 5. Nettoyage | `dropna()` — supprime les lignes avec NaN (dates ou valeurs invalides) |
| 6. Indexation | `set_index("date")` — la date devient l'index du DataFrame |
| 7. Cache mémoire | Variable globale `_cache` — le CSV n'est lu qu'**une seule fois** au démarrage |

### 2. Servir les données (`data.py`)

L'endpoint `GET /data` retourne les 5 000 premiers points après `reset_index()` :

```python
data.reset_index().head(5000).to_dict(orient="records")
```

> **Note** : un module LTTB (Largest-Triangle-Three-Buckets) est disponible dans `downsampling.py` pour un downsampling préservant la forme des courbes (voir section dédiée).

---

## Algorithme de recherche DTW

### Vue d'ensemble

L'algorithme dans `dtw_similarity.py` utilise une **fenêtre glissante** sur toute la série (1,8M points), avec une cascade de **pré-filtres** du moins coûteux au plus coûteux pour éliminer rapidement les candidats non pertinents avant le calcul DTW (coûteux).

### Pipeline de filtres (passe principale)

```
Série (1,8M pts)
    │
    ▼ Fenêtre glissante (pas = 10% longueur pattern)
    │
    ├─ ① Filtre amplitude ──── élimine si amp < 30% ou > 170% de l'amplitude du pattern
    │
    ├─ ② Filtre variance ───── élimine si std(fenêtre) < 0.01
    │
    ├─ ③ Filtre corrélation ── élimine si pearsonr(pattern, fenêtre) < seuil adaptatif
    │                           • > 500 points : seuil = 0.2
    │                           • > 200 points : seuil = 0.3
    │                           • ≤ 200 points : seuil = 0.4
    │
    └─ ④ Score DTW ─────────── calcul tslearn.metrics.dtw() uniquement sur les survivants
```

### Pas de la fenêtre glissante

```python
step = max(1, int(pattern_len * 0.1))   # 10% de la longueur du pattern
```

### Seuil de corrélation adaptatif

Le seuil de corrélation de Pearson s'adapte à la longueur du pattern :

| Longueur pattern | Seuil corrélation | Raison |
|---|---|---|
| > 500 points | 0.2 | Longs patterns → plus de variabilité locale → seuil souple |
| > 200 points | 0.3 | Intermédiaire |
| ≤ 200 points | 0.4 | Courts patterns → corrélation plus stable → seuil strict |

### Passe de fallback

Si le nombre de résultats après la passe principale est inférieur à `top_k`, une **deuxième passe** est lancée avec des filtres relâchés :

| Filtre | Passe principale | Passe fallback |
|---|---|---|
| Pas de la fenêtre | 10% du pattern | 20% du pattern |
| Amplitude | ±70% (0.3x–1.7x) | ±100% (0.2x–2.0x) |
| Variance | std ≥ 0.01 | std ≥ 0.01 |
| Corrélation | Seuil adaptatif (0.2–0.4) | **Aucun filtre** |
| Dédoublonnage | Non | Oui (distance < `pattern_len` → ignoré) |
| Limite | top_k | top_k × 3 |

### Détection de pattern plat

Si l'amplitude du pattern sélectionné est < 0.01, la recherche est abandonnée immédiatement (évite les divisions par zéro et les résultats absurdes).

### Diagnostics retournés

La fonction `search_pattern()` retourne un tuple `(results, diagnostics)` :

```python
diagnostics = {
    "total_positions": 25020,       # nombre de fenêtres scannées
    "passed_amplitude": 18200,      # passé le filtre amplitude
    "passed_variance": 18150,       # passé le filtre variance
    "passed_correlation": 5400,     # passé le filtre corrélation
    "final_computed": 5400,         # DTW effectivement calculés
    "step": 72                      # pas de la fenêtre
}
```

---

## Downsampling LTTB

Le module `downsampling.py` implémente l'algorithme **Largest-Triangle-Three-Buckets (LTTB)** pour réduire le nombre de points affichés tout en **préservant au maximum la forme** des courbes.

### Principe

1. Divise la série en N buckets de taille égale
2. Pour chaque bucket, calcule l'aire du triangle formé par :
   - Le point sélectionné du bucket précédent
   - Chaque point candidat du bucket courant
   - Le premier point du bucket suivant
3. Sélectionne le point qui **maximise l'aire du triangle** (donc celui qui contribue le plus à la forme)
4. Le premier et le dernier point sont toujours conservés

### Fonctions

```python
lttb(data: np.array, threshold: int) → np.array  # indices des points sélectionnés
downsample_series(series: np.array, target_points=500) → np.array  # wrapper
```

### Utilisation

Le module est disponible et testé mais n'est pas utilisé par défaut dans `data.py` (qui utilise `head(5000)`).  
Pour l'activer, modifier `data.py` :

```python
from backend.services.downsampling import downsample_series

@router.get("/data")
def get_data(points: int = 500):
    indices = downsample_series(data["value"].values, target_points=points)
    downsampled = data.iloc[indices].reset_index()
    return downsampled.to_dict(orient="records")
```

---

## Composants Frontend

### `App.js` — Composant racine

Orchestration de l'état global de l'application.

| State | Type | Description |
|---|---|---|
| `data` | `Array` | Points de consommation chargés au démarrage |
| `matches` | `Array` | Matches filtrés actuellement affichés |
| `allScores` | `Array` | Scores DTW de toutes les sous-séquences |
| `monitoring` | `Object \| null` | Données de monitoring retournées par `/pattern` |
| `focusedMatch` | `Object \| null` | Match actuellement focalisé (zoom) |
| `loading` | `boolean` | Indicateur de chargement initial |

**Arbre des composants :**
```
App
├── EnergyGraph       ← données + handlers
├── MonitoringPanel   ← monitoring
├── ScoreDistribution ← allScores + matches
└── SimilarPatterns   ← matches + onNavigate
```

---

### `EnergyGraph.js` — Graphe interactif principal

Composant central de l'application. Affiche un graphe Plotly WebGL (`scattergl`) avec :

#### Fonctionnalités

- **Sélection par drag** : l'utilisateur sélectionne visuellement une zone → déclenche la recherche DTW
- **Affichage des matches** : rectangles colorés sur le graphe (vert ≥80%, bleu 50-79%, orange <50%)
- **Bandeau de sous-séquences** : bande colorée sous le graphe montrant la distribution DTW de toutes les sous-séquences
- **Navigation** : boutons ◀/▶ pour naviguer entre les matches avec zoom automatique
- **Rangeslider** : barre de navigation temporelle en bas du graphe
- **Bouton Réinitialiser** : retour au zoom initial

#### Boutons de filtrage

Après une détection, des **boutons-pills** apparaissent pour filtrer par intervalle de similarité :

| Bouton | Couleur | Filtre |
|---|---|---|
| Tous | Gris `#636e72` | Aucun filtre — affiche tous les cycles |
| 80–100% | Vert `#2ecc71` | `similarity >= 80` |
| 50–79% | Bleu `#3498db` | `50 <= similarity < 80` |
| <50% | Orange `#f39c12` | `similarity < 50` |

Chaque bouton indique le nombre de cycles correspondants. Cliquer à nouveau désactive le filtre (retour à "Tous").

#### Mode "tous les cycles"

Le frontend appelle toujours `detectPattern(start, end, 9999)` pour récupérer **tous** les cycles similaires d'un seul coup. Le filtrage se fait ensuite **côté client** via les boutons.

---

### `MonitoringPanel.js` — Dashboard de monitoring

Affiché après chaque détection de pattern. Quatre sections :

#### 1. Distribution des similitudes
- **Barre horizontale empilée** : vert / bleu / orange proportionnelle
- **Stat Cards** : nombre de cycles par intervalle

#### 2. Pattern sélectionné
- Dates de début/fin, durée en heures, nombre de points
- Statistiques : moyenne (μ), écart-type (σ), min, max, amplitude, énergie totale

#### 3. Scores DTW des matches
- Meilleur score, score moyen, score médian, pire score, écart-type des scores

#### 4. Pipeline de recherche
- **Barres de progression** montrant le taux de passage de chaque filtre :
  - ① Positions scannées (100%)
  - ② Filtre amplitude
  - ③ Filtre variance
  - ④ Filtre corrélation
  - ⑤ DTW calculés → Matches retournés
- Informations : taille de la série, pas de balayage, temps de calcul

---

### `SimilarPatterns.js` — Cartes des résultats

Grille de **cartes cliquables**, une par match trouvé :

- Numéro du match (`#1`, `#2`, ...)
- Badge coloré avec le pourcentage de similarité
- Label qualitatif : « Très similaire » / « Similaire » / « Peu similaire »
- Dates de début et fin (format français)
- Score DTW brut

**Interaction** : cliquer sur une carte appelle `onNavigate(match)` → zoom sur le graphe.

---

### `ScoreDistribution.js` — Histogramme des scores DTW

Graphe en barres Plotly montrant le score DTW de chaque sous-séquence :

- **Barres rouges** : sous-séquences retenues comme top matches
- **Barres grises** : toutes les autres sous-séquences
- Axe X : index de la sous-séquence
- Axe Y : score DTW

---

## Datasets

Les fichiers CSV sont stockés dans `backend/datasets/` et gérés par **Git LFS** (.gitattributes) :

| Fichier | Description | Taille approximative |
|---|---|---|
| `C2 elect kw.csv` | Consommation électrique en kW | ~1,8M lignes |
| `C2 Prod Poid Process.csv` | Poids de production | |
| `C2 Prod Tc Process.csv` | Temps de cycle de production | |
| `C2 Vap kgh.csv` | Consommation vapeur en kg/h | |

**Format du CSV principal** (`C2 elect kw.csv`) :

| Colonne | Type | Exemple |
|---|---|---|
| `date` | string (ISO-like) | `2021-12-01 00:00:01` ou `2024-08-20 10:26:00.394807` |
| `cc_m` | string | `C14` |
| `value` | string (décimal virgule) | `2,9` |

> Deux formats de date coexistent dans le fichier, d'où le `format="mixed"` dans le parsing.

---

## Corrections et historique

### Bugs critiques corrigés

| Problème | Cause | Solution |
|---|---|---|
| **889 234 points au lieu de 1 801 502** | `pd.to_datetime` sans `format="mixed"` échouait sur les dates avec microsecondes → 912K NaT supprimés | `format="mixed"` dans `data_loader.py` |
| **Crash serveur 500** (IndexError) | `dates[index + len(pattern)]` dépassait le tableau en fin de série | `min(index + len(pattern), len(dates) - 1)` |
| **Division par zéro** | Pattern plat (`pattern_amp = 0`) → filtre amplitude → `0 / 0` | Vérification `pattern_amp < 0.01` en entrée |
| **Chemin CSV cassé** | Chemin relatif `../datasets/...` dépendait du répertoire de lancement | `pathlib.Path(__file__).parent.parent / "datasets"` |
| **Double chargement du dataset** | `data.py` et `pattern.py` appelaient chacun `load_dataset()` → 2× en mémoire | Cache `_cache` dans `data_loader.py` |
| **Frontend recevait 1,8M points** | `GET /data` retournait tout le dataset → ~100 MB de JSON | Limitation à 5 000 points côté serveur |
| **Feedback loop rangeslider** | `onRelayout` → state update → re-render → re-fire | Suppression `handleRelayout`, compteur `revision` |
| **0 résultats de pattern** | Corrélation ≥ 0.5 trop stricte → 100% des candidats éliminés | Seuils adaptatifs (0.2–0.4) + passe fallback sans corrélation |
| **Filtre amplitude trop strict** | ±50% éliminait des patterns variants | Assoupli à ±70% (0.3x–1.7x) |
| **Pas de fenêtre trop grand** | 20% manquait des patterns entre deux pas | Réduit à 10% |

### Fonctionnalités ajoutées

| Fonctionnalité | Description |
|---|---|
| **Filtrage par intervalle** | Boutons-pills (Tous / 80-100% / 50-79% / <50%) pour filtrer les cycles affichés |
| **Mode "tous les cycles"** | Le frontend récupère tous les matches (top_k=9999) et filtre côté client |
| **Dashboard de monitoring** | `MonitoringPanel` avec distribution, stats pattern, scores DTW, pipeline |
| **Seuils adaptatifs** | Corrélation de Pearson ajustée selon la longueur du pattern (0.2–0.4) |
| **Passe fallback** | Si pas assez de résultats → deuxième passe avec filtres relâchés, sans corrélation |
| **Validation input** | Pattern < 10 points → message d'erreur explicite sans crash |
| **Score → similarité %** | Normalisation relative : meilleur score → ~95%, pire → ~40% |
| **Navigation ◀/▶** | Boutons pour zoomer successivement sur chaque match trouvé |
| **Cartes cliquables** | Clic sur un match dans `SimilarPatterns` → zoom sur le graphe |
| **Distribution DTW** | Histogramme des scores de toutes les sous-séquences (`ScoreDistribution`) |
| **Indicateur de recherche** | "Recherche en cours..." affiché pendant l'appel API |
| **Module LTTB** | Algorithme de downsampling préservant la forme (disponible, non activé par défaut) |

---

## Dépendances

### Python (`requirements.txt`)

```
fastapi        — framework API REST asynchrone
uvicorn        — serveur ASGI pour FastAPI
pandas         — manipulation et nettoyage du dataset CSV
numpy          — calculs numériques (amplitude, variance, etc.)
scipy          — corrélation de Pearson (filtre pré-DTW)
tslearn        — implémentation DTW optimisée (Dynamic Time Warping)
dtaidistance   — bibliothèque DTW alternative
```

### Node.js (`package.json`)

```
react 19.2         — framework UI
react-plotly.js    — composant React pour Plotly.js
plotly.js 3.4      — bibliothèque de visualisation (WebGL scattergl)
axios 1.13         — client HTTP pour les appels API
```
