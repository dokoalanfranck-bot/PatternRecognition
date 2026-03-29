# Frontend — Documentation développeur

> React 19 + Plotly.js + Lucide React — Interface premium dark theme pour la détection de patterns dans des séries temporelles industrielles.

---

## Table des matières

1. [Stack & dépendances](#stack--dépendances)
2. [Installation & lancement](#installation--lancement)
3. [Design system](#design-system)
4. [Arbre des composants](#arbre-des-composants)
5. [Composants détaillés](#composants-détaillés)
6. [Client API](#client-api)
7. [Conventions de code](#conventions-de-code)

---

## Stack & dépendances

| Bibliothèque | Version | Rôle |
|---|---|---|
| `react` | 19.2.4 | Framework UI |
| `react-dom` | 19.2.4 | Rendu DOM |
| `plotly.js` | 3.4.0 | Visualisation WebGL (`scattergl`) |
| `react-plotly.js` | 2.6.0 | Composant React pour Plotly |
| `axios` | 1.13.6 | Client HTTP |
| `lucide-react` | 1.7.0 | Icônes SVG premium |

---

## Installation & lancement

```bash
cd frontend
npm install
npm start        # → http://localhost:3000
```

Le backend doit tourner sur `http://127.0.0.1:8000` (voir README.md).

---

## Design system

### Thème dark glassmorphism

Tout le design est centralisé dans `App.css` via des **CSS variables** :

```css
:root {
  --bg-primary: #050a18;           /* Fond principal */
  --bg-secondary: #0a1628;         /* Fond secondaire */
  --bg-card: rgba(15,23,42,0.6);   /* Fond carte glassmorphism */
  --border-subtle: rgba(148,163,184,0.1);

  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;

  --accent-indigo: #818cf8;        /* Couleur principale */
  --accent-emerald: #34d399;       /* Succès, excellent */
  --accent-blue: #60a5fa;          /* Info, bon */
  --accent-amber: #fbbf24;         /* Warning, faible */
  --accent-rose: #fb7185;          /* Danger, erreur */
  --accent-violet: #a78bfa;
  --accent-cyan: #22d3ee;
}
```

### Classes CSS réutilisables

| Classe | Usage |
|---|---|
| `.glass-card` | Carte avec `backdrop-filter: blur(16px)`, fond semi-transparent, bordure subtile |
| `.glass-card-interactive` | Comme `.glass-card` avec hover scale + ombre |
| `.section` | Conteneur avec fond `var(--bg-card)`, padding 16px, border-radius 12px |
| `.section-title` | Titre de section (15px, bold, flex avec icône) |
| `.btn` | Bouton de base (fond transparent, bordure, hover) |
| `.btn-primary` | Bouton indigo |
| `.btn-success` | Bouton émeraude |
| `.btn-danger` | Bouton rose |
| `.btn-ghost` | Bouton sans fond ni bordure |
| `.input` | Champ de saisie dark |
| `.badge` | Badge compact (padding 4px 10px, border-radius 20px) |
| `.stat-card` | Carte statistique avec bordure left colorée |
| `.stat-card-indigo`, `.stat-card-emerald`, etc. | Variantes de couleur du stat-card |
| `.distribution-bar` | Barre empilée horizontale pour les distributions |
| `.skeleton` | Placeholder animé (shimmer) |
| `.spinner` | Animation de rotation infinie |
| `.animate-in` | Fade-in au montage |
| `.animate-in-up` | Fade-in vers le haut |

### Animations

- `fadeIn` / `fadeInUp` / `slideInRight` — apparition progressive
- `shimmer` — skeleton loading
- `glow` — effet lumineux pulsant
- `spin` — rotation continue (spinner)
- `gradientShift` — dégradé animé (topbar)

### Police

**Inter** (Google Fonts) — chargée dans `index.html` via `<link>` avec `preconnect`.

### Icônes

**Lucide React** — icônes SVG importées à la demande :

```jsx
import { Activity, Search, ChevronLeft, BarChart3 } from "lucide-react"
<Activity size={16} />
```

> Convention : `size={14-18}` selon le contexte (boutons = 14, titres = 16-18).

### Couleurs des matches

| Seuil | Couleur | Variable CSS |
|---|---|---|
| ≥ 80% (Excellent) | `#34d399` | `--accent-emerald` |
| 50-79% (Bon) | `#60a5fa` | `--accent-blue` |
| < 50% (Faible) | `#fbbf24` | `--accent-amber` |
| Sélection | `#fb7185` | `--accent-rose` |

### Plotly dark theme

Tous les graphes Plotly utilisent un thème sombre cohérent :

```js
{
  plot_bgcolor: "transparent",
  paper_bgcolor: "transparent",
  font: { family: "Inter, sans-serif", color: "#94a3b8" },
  xaxis: { tickcolor: "#334155", gridcolor: "rgba(148,163,184,0.08)" },
  yaxis: { tickcolor: "#334155", gridcolor: "rgba(148,163,184,0.08)" },
}
```

---

## Arbre des composants

```
App.jsx
│
├── DatasetSelector        (si aucun dataset sélectionné)
│
└── (après sélection d'un dataset)
    │
    ├── TopBar               (sticky : logo, nom dataset, tabs Analyse/Bibliothèque)
    │
    ├── [Tab: Analyse]
    │   ├── NavBar            (pagination : page X/Y, ◀ ▶, input)
    │   ├── EnergyGraph       (graphe Plotly + sélection + rectangles)
    │   │   └── FilterPanel   (panneau flottant : seuil, max, presets)
    │   ├── MonitoringPanel   (dashboard post-détection)
    │   │   └── DistributionBar + StatCards
    │   ├── ScoreDistribution (histogramme MASS)
    │   └── SimilarPatterns   (cartes cliquables)
    │       └── MatchCard × N
    │
    └── [Tab: Bibliothèque]
        └── PatternLibrary
            ├── PatternCard × N  (liste avec sparklines)
            └── PatternDetail    (vue détail : courbe, stats, distribution)
```

---

## Composants détaillés

### `App.jsx` — Orchestrateur

Gère tout l'état global de l'application.

| State | Type | Description |
|---|---|---|
| `dataset` | `string \| null` | Fichier CSV sélectionné (null = écran de sélection) |
| `data` | `Array` | Points chargés pour la page courante |
| `totalPoints` | `number` | Nombre total de points dans le dataset |
| `totalPages` | `number` | Nombre de pages |
| `currentPage` | `number` | Page courante (0-indexé) |
| `matches` | `Array` | Tous les matches retournés par `/pattern` |
| `allScores` | `Array` | Scores MASS des sous-séquences |
| `monitoring` | `Object \| null` | Objet monitoring complet |
| `tab` | `string` | `"analyse"` ou `"library"` |
| `refreshKey` | `number` | Incrémenté pour actualiser la bibliothèque |

**Callbacks passés aux enfants :**
- `handleDetection(matches, monitoring, allMatches)` — résultats de détection
- `handleScores(scores)` — résultats de la distribution
- `handlePatternSaved()` — incrémente `refreshKey`
- `handleNavigate(match)` — met à jour `focusedMatch`

---

### `DatasetSelector.jsx` — Sélection du dataset

Écran d'accueil listant les 4 CSV disponibles sous forme de cartes glassmorphism.

- Appelle `fetchDatasets()` au montage
- Chaque carte affiche : icône Lucide, nom, nombre de lignes, taille, colonnes
- Au clic → `onSelect(filename)` → `App` charge la première page

---

### `EnergyGraph.jsx` — Graphe Plotly interactif

Composant le plus complexe. ~500 lignes.

**Fonctionnalités clés :**
- **Plotly `scattergl`** WebGL pour les performances (50k+ points)
- **Sélection par drag** (`plotly_selected`) → extrait `start`/`end` → appelle `detectPattern()`
- **Rectangles colorés** : un `shape` Plotly par match, coloré selon similarité
- **Rendu par batch** : les rectangles sont ajoutés par groupes de 50 (debounced) pour éviter le gel
- **Légende custom** : barre de légende avec points colorés (HTML, pas Plotly natif)
- **Navigation ◀/▶** : zoom sur le match précédent/suivant avec `plotly_relayout`
- **AbortController** : annule la requête précédente si l'utilisateur re-sélectionne avant la fin

**Props :**

| Prop | Type | Description |
|---|---|---|
| `data` | `Array` | Points `{date, value}` |
| `matches` | `Array` | Matches filtrés |
| `allMatches` | `Array` | Tous les matches (non filtrés) |
| `focusedMatch` | `Object` | Match actuellement zoomé |
| `onDetection` | `Function` | Callback avec `(matches, monitoring, allMatches)` |
| `onScores` | `Function` | Callback avec les scores |
| `onNavigate` | `Function` | Callback de navigation |
| `dataset` | `string` | Nom du fichier CSV |

---

### `FilterPanel.jsx` — Panneau de filtres flottant

Panneau glassmorphism qui apparaît après une détection.

**Filtres :**
- **Seuil de similarité** (0-100%) — slider + input numérique
- **Nombre max de matches** — input numérique (vide = tous)
- **Presets rapides** : badges cliquables ("Top 10", "Top 50", "≥ 80%", "≥ 50%", "Tout")
- **Application automatique** : les filtres se mettent à jour en temps réel

**Props :**

| Prop | Type |
|---|---|
| `allMatches` | `Array` — tous les matches non filtrés |
| `onFilter` | `(filteredMatches) => void` |
| `matchCount` | `number` — total des matches |

---

### `MonitoringPanel.jsx` — Dashboard monitoring

Affiché après une détection. 5 sections :

1. **Header** + bouton "Sauvegarder"
2. **Formulaire de sauvegarde** — nom (obligatoire) + description → `savePattern()`
3. **Distribution** — `DistributionBar` + 3 `StatCard` (excellent/bon/faible)
4. **Pattern sélectionné** — dates, durée, stats (mean, std, min, max, amplitude, énergie)
5. **Scores MASS** — meilleur, moyen, médian, pire
6. **Pipeline** — taille série, positions scannées, matches, temps

---

### `SimilarPatterns.jsx` — Cartes des matches

- **Chargement progressif** : affiche 20 cartes à la fois, bouton "Afficher plus"
- **MatchCard** (mémoïsée) : bordure top colorée, badge %, icône Lucide, dates, score MASS
- **Clic** → `onNavigate(match)` → zoom sur le graphe
- **État vide** : message avec icône et bordure dashed

---

### `ScoreDistribution.jsx` — Histogramme des scores

- Graphe Plotly `bar` sombre
- Barres indigo semi-transparentes pour toutes les sous-séquences
- Barres rouges (`#f87171`) pour les top matches
- Wrapper `.section`

---

### `PatternLibrary.jsx` — Bibliothèque CRUD

Deux vues :

**Vue liste :**
- `PatternCard` : sparkline SVG + nom + badge occurrences + stats rapides + chevron
- Bouton "Rafraîchir" (icône `RefreshCw`)
- État vide avec icône `FolderOpen`

**Vue détail :**
- Header : bouton retour, nom, description, date, bouton supprimer (avec confirmation)
- `StatCard` × 7 : points, durée, mean, std, min, max, amplitude
- Courbe Plotly (scattergl, fill, ligne mean pointillée)
- `DistributionSection` : barre + 3 cards per intervalle
- Infos temporelles : début, fin, date de sauvegarde

---

## Client API

Fichier `api/api.js` — tous les appels HTTP centralisés :

```js
import axios from "axios"
const API = axios.create({ baseURL: "http://127.0.0.1:8000" })
```

| Fonction | Méthode | Endpoint | Description |
|---|---|---|---|
| `fetchDatasets()` | GET | `/datasets` | Liste des CSV disponibles |
| `fetchData(page, dataset)` | GET | `/data?page=&dataset=` | Données paginées |
| `detectPattern(start, end, topK, dataset, signal)` | POST | `/pattern` | Recherche MASS |
| `computeAllScores(start, end, n, dataset)` | POST | `/scores` | Distribution scores |
| `savePattern(start, end, name, desc, count, dist, dataset)` | POST | `/patterns/save` | Sauvegarder |
| `listPatterns()` | GET | `/patterns` | Lister la bibliothèque |
| `getPattern(id)` | GET | `/patterns/{id}` | Détail d'un pattern |
| `deletePattern(id)` | DELETE | `/patterns/{id}` | Supprimer un pattern |
| `comparePattern(id, dataset)` | POST | `/patterns/{id}/compare` | Comparer un pattern |

> `detectPattern` accepte un `AbortController.signal` pour annuler les requêtes en cours.

---

## Conventions de code

### Structure des composants

```jsx
import React, { useState, useCallback, memo } from "react"
import { IconName } from "lucide-react"

const MyComponent = memo(({ prop1, prop2 }) => {
  // hooks
  // callbacks
  // render
})

export default MyComponent
```

### Règles

- **`memo()`** sur tous les composants exportés (évite les re-renders inutiles)
- **`useCallback`** pour tous les handlers passés en props
- **`useMemo`** pour les données Plotly (data, layout) — évite les re-renders du graphe
- **Pas d'inline styles pour les couleurs** → utiliser les CSS variables `var(--xxx)`
- **Lucide icons** au lieu d'emoji (pas de 📊, utiliser `<BarChart3 size={16} />`)
- **Extensions `.jsx`** pour tous les composants React
- **Pas de `useEffect` sans cleanup** pour les appels API (AbortController ou flag `cancelled`)
- **Format français** pour les nombres (`toLocaleString("fr-FR")`) et les dates
