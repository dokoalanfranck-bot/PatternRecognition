# Pattern Classification — Normal vs Failure

Ce document décrit les modifications apportées pour ajouter une classification des patterns en deux catégories : **Consommation Normale** et **Patterns de Panne**.

---

## Fonctionnalités Ajoutées

### 1. Classification à la Sauvegarde
- **Nouveau formulaire** dans le MonitoringPanel avec deux options radio :
  - 🟢 **Consommation Normale** : patterns de fonctionnement standard
  - 🔴 **Pattern de Panne** : patterns d'anomalie ou de défaillance
- La classification est définie au moment de la sauvegarde (default: Normal)

### 2. Groupage dans la Bibliothèque
- Les patterns sauvegardés sont maintenant **groupés par type** dans PatternLibrary
- Deux sections distinctes :
  - Section **Consommation Normale** (icône TrendingUp, bordure verte)
  - Section **Patterns de Panne** (icône AlertCircle, bordure rouge)
- Compteur du nombre de patterns par catégorie

### 3. Modification de Type
- L'utilisateur peut **modifier la classification à tout moment** dans la bibliothèque
- Lors de l'affichage du détail d'un pattern :
  - Affichage du type actuel avec description
  - Bouton "Modifier" pour changer de classification
  - Section d'édition avec options radio et sauvegarde

---

## Modifications Techniques

### Database (`backend/services/database.py`)

```python
# Nouveau schéma SQLite
CREATE TABLE IF NOT EXISTS patterns (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    description TEXT    DEFAULT '',
    values_json TEXT    NOT NULL,
    dates_json  TEXT    NOT NULL,
    stats_json  TEXT    NOT NULL,
    match_count INTEGER DEFAULT 0,
    pattern_type TEXT    DEFAULT 'normal',  # ← NOUVEAU
    created_at  REAL    NOT NULL
)
```

**Nouvelles fonctions :**
- `save_pattern(..., pattern_type="normal")` — sauvegarde avec type
- `update_pattern_type(pid, pattern_type)` — modification du type
- `list_patterns()` et `get_pattern()` — retournent maintenant `pattern_type`

### API Backend (`backend/api/pattern.py`)

**POST /patterns/save**
```json
{
  "start": "2022-03-15T08:00:00",
  "end": "2022-03-15T09:00:00",
  "name": "Cycle production A",
  "description": "...",
  "pattern_type": "normal",  // ← NOUVEAU : "normal" ou "failure"
  "match_count": 150,
  "distribution": {...},
  "dataset": "..."
}
```

**PUT /patterns/{id}** (Nouveau endpoint)
```json
{
  "pattern_type": "failure"  // Modifier le type
}
```

### Frontend API (`frontend/src/api/api.js`)

```javascript
// Signature modifiée avec patternType
export const savePattern = async (start, end, name, description, matchCount, distribution, patternType = "normal", dataset = null)

// Nouvelle fonction
export const updatePattern = async (id, updates) // { pattern_type: "failure" }
```

### MonitoringPanel Component (`frontend/src/components/MonitoringPanel.jsx`)

- Ajout d'un état `patternType` (default: "normal")
- UI avec deux options radio dans le formulaire de sauvegarde
- Les options sont visuellement distintives :
  - **Normal** : vert (TrendingUp icon)
  - **Failure** : rouge (AlertCircle icon)

### PatternLibrary Component (`frontend/src/components/PatternLibrary.jsx`)

**Groupage des patterns :**
```jsx
{/* Groupe Normal */}
const normal = patterns.filter(p => (p.pattern_type || "normal") === "normal")

{/* Groupe Failure */}
const failures = patterns.filter(p => p.pattern_type === "failure")
```

**Édition du type en détail :**
- État `editingType` pour basculer entre affichage/édition
- Section dédiée avec radio buttons
- Appel `updatePattern()` au save

---

## Migration de la Base de Données

L'ancienne base de données `patterns.db` a été **supprimée automatiquement** pour permettre sa recréation avec le nouveau schéma.

**Anciennes données :** Les patterns existants seront perdus mais recréés à partir de nouvelles classifications.

---

## Utilisation

### Pour l'Utilisateur

1. **Sauvegarde d'un pattern**
   - Détecter un pattern sur le graphe
   - Cliquer "Sauvegarder"
   - Entrer le nom et description
   - ✅ **Sélectionner le type** (Normal ou Panne)
   - Confirmer

2. **Consultation de la bibliothèque**
   - Les patterns sont automatiquement **groupés par type**
   - Chaque groupe affiche le nombre de patterns

3. **Modification du type**
   - Cliquer sur un pattern dans la bibliothèque
   - Cliquer sur "Modifier" dans la section Classification
   - Changer le type et sauvegarder

---

## Icônes et Couleurs

| Type | Icône | Couleur | Classe CSS |
|---|---|---|---|
| **Normal** | 📈 TrendingUp | 🟢 Vert (#22c55e / --accent-emerald) | stat-card-emerald |
| **Failure** | ⚠️ AlertCircle | 🔴 Rouge (#ef4444 / --accent-rose) | stat-card-rose |

---

## Détails d'Implémentation

### Validation du Type

Le backend valide strictement le type au moment de la sauvegarde/mise à jour :
```python
if pattern_type not in ("normal", "failure"):
    pattern_type = "normal"  # Valeur par défaut
```

### Rétrocompatibilité

Les patterns existants (avant cette modification) sont traités comme "normal" :
```javascript
pattern_type: details.pattern_type || "normal"  // Fallback à "normal"
```

---

## Fichiers Modifiés

```
backend/
  services/
    ├── database.py          ✏️ Schema + CRUD pattern_type
    └── api/
        └── pattern.py        ✏️ Endpoints save + PUT
frontend/
  src/
  ├── api/
  │   └── api.js             ✏️ savePattern + updatePattern
  └── components/
      ├── MonitoringPanel.jsx ✏️ Checkbox type
      └── PatternLibrary.jsx  ✏️ Groupage + édition type
```

**Base de données :**
- `patterns.db` — ❌ Supprimée (recréée au démarrage)

---

## Tests Recommandés

1. ✅ Sauvegarder un pattern de type "normal"
2. ✅ Sauvegarder un pattern de type "failure"
3. ✅ Vérifier le groupage dans la bibliothèque
4. ✅ Modifier le type d'un pattern existant
5. ✅ Rafraîchir les patterns et vérifier la persistance
6. ✅ Supprimer un pattern (dans l'une ou l'autre catégorie)
