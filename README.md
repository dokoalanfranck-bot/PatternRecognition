# Energy Pattern Detection — Documentation du projet

Application web de détection de patterns de consommation électrique industrielle.  
Permet de sélectionner visuellement un profil de consommation et de retrouver toutes ses occurrences similaires dans un historique de ~1,8 million de points.

---

## Stack technique

| Composant | Technologie |
|---|---|
| Backend | Python 3.10+, FastAPI, pandas, numpy |
| Algorithme | DTW (Dynamic Time Warping) via `tslearn` |
| Pré-filtres | Amplitude, variance, corrélation de Pearson (`scipy`) |
| Frontend | React 19, react-plotly.js, axios |
| Visualisation | Plotly.js (scattergl pour les performances) |

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
├── requirements.txt
├── backend/
│   ├── main.py                    # Point d'entrée FastAPI
│   ├── api/
│   │   ├── data.py                # GET /data — sert les données au frontend
│   │   └── pattern.py             # POST /pattern — détection de patterns
│   ├── services/
│   │   ├── data_loader.py         # Chargement et nettoyage du dataset
│   │   └── dtw_similarity.py      # Algorithme de recherche DTW
│   └── datasets/
│       └── C2 elect kw.csv        # Dataset de consommation électrique
└── frontend/
    └── src/
        ├── App.js                 # Composant racine
        ├── api/api.js             # Appels HTTP vers le backend
        └── components/
            ├── EnergyGraph.js     # Graphe principal + sélection
            └── SimilarPatterns.js # Cartes des résultats
```

---

## API

### `GET /data`

Retourne les points de consommation pour l'affichage du graphe.  
**Les données sont downsamplees côté serveur à ~10 000 points** (algorithme min-max par bucket) pour limiter le volume JSON tout en conservant les extrema.

**Réponse :**
```json
[
  { "date": "2021-12-01T00:00:01", "cc_m": "...", "value": 2.9 },
  ...
]
```

### `POST /pattern`

Recherche les occurrences d'un pattern dans la série complète (1,8M points).

**Corps de la requête :**
```json
{
  "start": "2022-03-15T08:00:00",
  "end":   "2022-03-15T09:00:00",
  "top_k": 10
}
```

| Paramètre | Type | Défaut | Description |
|---|---|---|---|
| `start` | string (ISO date) | — | Début du pattern |
| `end` | string (ISO date) | — | Fin du pattern |
| `top_k` | int | 10 | Nombre de résultats voulus (1–100) |

**Réponse normale :**
```json
{
  "matches": [
    { "start": "2022-06-10T14:00:00", "end": "2022-06-10T15:00:00", "score": 12.4 },
    ...
  ]
}
```

**Réponse si pattern invalide :**
```json
{
  "matches": [],
  "error": "Sélection trop courte. Choisissez une zone d'au moins 10 points."
}
```

> **Score DTW** : distance Dynamic Time Warping. Plus il est **bas**, plus le match est similaire au pattern sélectionné.

---

## Pipeline de traitement des données

### Chargement (`data_loader.py`)

1. Lecture du CSV via `pathlib.Path` — chemin absolu indépendant du répertoire de lancement
2. Parsing des dates avec `format="mixed"` — gère les deux formats présents dans le dataset :
   - `2021-12-01 00:00:01` (sans microsecondes)
   - `2024-08-20 10:26:00.394807` (avec microsecondes)
3. Conversion des valeurs : remplacement de virgules par des points, `pd.to_numeric`
4. Tri chronologique, suppression des NaN
5. Suppression des outliers : méthode IQR étendue (`Q1 − 10×IQR`, `Q3 + 10×IQR`)
6. **Cache en mémoire** : le dataset est chargé une seule fois au démarrage (variable globale `_cache`)

### Downsampling pour l'affichage (`data.py`)

Algorithme **min-max par bucket** :
- Divise la série en N buckets de taille égale
- Conserve le minimum ET le maximum de chaque bucket dans l'ordre chronologique
- Résultat : ~10 000 points qui **préservent tous les pics et creux**
- Réduit le JSON de ~100 MB à ~400 KB

### Recherche de patterns (`dtw_similarity.py`)

Fenêtre glissante avec pré-filtres en cascade (du moins coûteux au plus coûteux) :

1. **Pattern plat** : si l'amplitude du pattern < 0.01 → abandon immédiat (évite division par zéro)
2. **Filtre amplitude** : élimine les fenêtres dont l'amplitude est < 50% ou > 150% de celle du pattern
3. **Filtre variance** : élimine les fenêtres "plates" (`std < 0.1`)
4. **Filtre corrélation** : corrélation de Pearson < 0.5 → formes trop différentes
5. **Score DTW** : calculé uniquement sur les candidats ayant passé tous les filtres
6. Tri par score croissant, retour des `top_k` meilleurs

**Pas de la fenêtre** : 20% de la longueur du pattern (`step = 0.2 × len(pattern)`)

---

## Corrections apportées au cours du développement

### Bugs critiques corrigés

| Problème | Cause | Solution |
|---|---|---|
| **889 234 points au lieu de 1 801 502** | `pd.to_datetime` sans `format="mixed"` échouait sur les dates avec microsecondes → 912K NaT supprimés | `format="mixed"` dans `data_loader.py` |
| **Crash serveur 500** (IndexError) | `dates[index + len(pattern)]` dépassait le tableau en fin de série | `min(index + len(pattern), len(dates) - 1)` |
| **Division par zéro** | Pattern sélectionné entièrement plat (`pattern_amp = 0`) → filtre amplitude → `0/0` | Vérification `pattern_amp < 0.01` en entrée de `search_pattern` |
| **Chemin CSV cassé** | Chemin relatif `../datasets/...` ne fonctionnait que si uvicorn lancé depuis `backend/` | `pathlib.Path(__file__).parent.parent / "datasets" / ...` |
| **Double chargement du dataset** | `data.py` et `pattern.py` appelaient chacun `load_dataset()` → CSV lu 2× en mémoire | Cache `_cache` dans `data_loader.py` |
| **Frontend recevait 1,8M points** | `GET /data` retournait tout le dataset → ~100 MB de JSON par chargement | Downsampling min-max côté serveur avant envoi |
| **Feedback loop rangeslider** | `onRelayout` mettait à jour le state `xRange` → re-render → re-fire `onRelayout` | Suppression de `handleRelayout`, utilisation d'un compteur `revision` |

### Fonctionnalités ajoutées

| Fonctionnalité | Description |
|---|---|
| **Contrôle `top_k`** | Champ numérique dans l'UI (1–100) pour choisir le nombre de résultats |
| **Validation input** | Pattern < 10 points → message d'erreur explicite sans crash |
| **Score → similarité %** | Normalisation relative : meilleur score → 95%, pire → 40% (affiché avec couleurs) |
| **Navigation ◀/▶** | Boutons pour zoomer successivement sur chaque match trouvé |
| **Marqueurs sur la courbe** | Mode `lines+markers` pour voir chaque point mesuré |
| **Indicateur de recherche** | "Recherche en cours..." affiché pendant l'appel API |

---

## Dépendances

```
fastapi       — framework API REST
uvicorn       — serveur ASGI
pandas        — manipulation du dataset
numpy         — calculs numériques
scipy         — corrélation de Pearson (filtre pré-DTW)
tslearn       — implémentation DTW optimisée
dtaidistance  — bibliothèque DTW alternative (présente dans l'env)
```
