# Système de Comparaison Visuelle Temps Réel

## 🎯 Objectif
Afficher côte à côte les graphiques du **pattern de référence** et des **données en temps réel** pour une comparaison visuelle instantanée pendant la simulation.

## 🔄 Modifications Apportées

### Backend (`backend/services/realtime_engine.py`)

#### 1. **Enrichissement de `get_state()`**
```python
def get_state():
    """Retourne désormais:
    - buffer_data: Liste des points actuels du buffer (max 1000 derniers points)
    - best_match.pattern_data: Données du pattern de référence
    """
```

**Avant:** Retournait seulement `buffer_size` (nombre)  
**Après:** Retourne aussi `buffer_data` (valeurs complètes)

#### 2. **Ajout données pattern au best_match**
```python
_state["best_match"] = {
    ...
    "pattern_data": list(best_pattern["values"]),  # ← NOUVEAU
}
```

**Impact:** Le frontend peut maintenant tracer le pattern de référence

---

### Frontend (`frontend/src/components/RealtimeMonitor.jsx`)

#### 1. **Import de Plotly**
```jsx
import Plot from "react-plotly.js"
```

Utilisé pour les graphiques interactifs HTML5 Canvas

#### 2. **Nouvelle Composante: `ChartComparison`**

**Responsabilités:**
- Affiche 2 graphiques côte à côte
- **Gauche:** Graphique du pattern de référence (pattern_data)
- **Droite:** Graphique des données temps réel (buffer_data)

**Couleurs dynamiques:**
- `similarity >= 80%` → Cyan (très bon match)
- `similarity >= 60%` → Indigo (bon match)
- `similarity >= 40%` → Amber (match faible)
- `similarity < 40%` → Rose (mauvais match)

**Features:**
- Hover unified mode (comparer les valeurs à chaque point X)
- Responsive layout (grille 1fr 1fr)
- Pas de toolbar (plus lisible)
- Transparent background (intégration thème)

#### 3. **Intégration dans le Flux**
Affichée **après le running panel** et **avant la section splits** pour une meilleure UX

```jsx
{(isRunning || bestMatch) && (
  <ChartComparison bestMatch={bestMatch} bufferData={status?.buffer_data} />
)}
```

---

## 📊 Exemple de Rendu

```
┌────────────────────────────────────────────────────────────┐
│ Comparaison Visuelle                                        │
├─────────────────────────────┬──────────────────────────────┤
│ 📊 Pattern de Référence     │ 📈 Données Temps Réel        │
│ Pattern Demo                │ Similarité: 78.5%            │
│                             │                              │
│  [Graph 1]                  │  [Graph 2]                   │
│ - Stable                    │ - Données en flux             │
│ - Baseline                  │ - Couleur dynamique (78.5%)   │
│                             │                              │
└─────────────────────────────┴──────────────────────────────┘
```

---

## 🎮 Utilisation

### Étapes
1. Aller à l'onglet **"Temps Réel"**
2. Sélectionner un **dataset**
3. Ajuster **vitesse** (0.005s/point par défaut)
4. Cliquer **"Démarrer la simulation"**
5. **→ Les graphiques s'affichent automatiquement**

### Interactivité Plotly
- **Hover:** Position de souris = légende synchronisée
- **Zoom:** Drag pour zoomer
- **Pan:** Shift + Drag pour bouger
- **Réinitialiser:** Double-clic

---

## 🔧 Architecture Technique

### Flux de Données
```
Simulation (backend)
    ↓
_state["buffer"] + best_pattern["values"]
    ↓
get_state() → {buffer_data, best_match.pattern_data}
    ↓
getRealtimeStatus() (API)
    ↓
ChartComparison (frontend)
    ↓
Plotly Plot JSX
```

### Performance
- **Max buffer affichage:** 1000 points (évite surcharge Plotly)
- **Refresh:** 500ms (polling par getRealtimeStatus)
- **Layout:** Plotly Canvas (GPU-accelerated)

---

## ✅ Tests à Faire

1. ✅ Backend redémarrage sans erreur
2. ✅ Frontend compilation
3. **Tests fonctionnels:**
   - [ ] Lancer simulation → graphiques apparaissent
   - [ ] Vérifier couleur change selon similarité
   - [ ] Zoomer/hoversur les graphiques
   - [ ] Arrêter simulation → graphiques figent
   - [ ] Charger un nouveau pattern → graphiques mettent à jour

---

## 📝 Notes

- **Dépendance:** `react-plotly.js` + `plotly.js` (déjà dans package.json)
- **Performance:** Limité à 1000 points pour éviter lag frontend
- **Responsive:** Fonctionne sur desktop et mobile (grille 1fr 1fr)
- **Couleurs:** Cohérentes avec palette CSS (--accent-cyan, --accent-rose, etc.)

---

## 🚀 Améliorations Futures

- [ ] Overlay des graphiques (superposition semi-transparente)
- [ ] Export/capture des graphiques comparés
- [ ] Animation de transition lors du changement de pattern
- [ ] Heatmap de similarité par segment
