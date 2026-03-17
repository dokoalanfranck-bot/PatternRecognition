# Optimisation - Downsampling des Données

## Vue d'ensemble
Pour améliorer les performances et la réactivité de l'interface, nous utilisons l'algorithme **LTTB** (Largest-Triangle-Three-Buckets) pour réduire intelligemment le nombre de points affichés tout en conservant au maximum la forme des courbes.

## Fonctionnement

### Algorithme LTTB
- **Réduction intelligente** : Au lieu de supprimer des points aléatoires, LTTB sélectionne les points qui préservent au mieux la forme visuelle de la courbe
- **Préservation des pics** : Les points importants (pics, creux) sont automatiquement conservés
- **Linéarité détectée** : Les zones linéaires sont compressées davantage que les zones chaotiques

### Performances
| Points | Taille JSON | Rendu Plotly | Transf. réseau |
|--------|------------|-------------|----------------|
| 5000   | ~150-200 KB| Lent        | Lent           |
| 1000   | ~30-40 KB  | Normal      | Normal         |
| **500**| **~15-20 KB**| **Rapide**  | **Rapide**     |
| 300    | ~9-12 KB   | Très rapide | Très rapide    |

## Configuration

### Backend (FastAPI)
```python
# Dans backend/api/data.py
@router.get("/data")
def get_data(points: int = 500):  # Par défaut 500 points
    # ...
```

**Limites** :
- Minimum : 50 points
- Maximum : 5000 points
- Défaut : 500 points

### Frontend (React)
```javascript
// Dans src/App.js
const fetchData = async () => {
  const data = await fetchData(500)  // Vous pouvez ajuster: 300, 400, 600, etc.
}
```

## Utilisation

### Via l'API REST
```bash
# Obtenir 300 points (pour une visualisation ultra-rapide)
GET http://127.0.0.1:8000/data?points=300

# Obtenir 1000 points (maximal)
GET http://127.0.0.1:8000/data?points=1000

# Avec la limite min appliquée
GET http://127.0.0.1:8000/data?points=10  # → Retourne 50 points
```

## Résultats Testés
✅ 300 points : Visualisation très fluide, pas de lag observable  
✅ 500 points : **Recommandé** - meilleur compromis vitesse/précision  
✅ 1000 points : Pour applications critiques nécessitant plus de précision  

## Implémentation Technique
- **Fichier** : `backend/services/downsampling.py`
- **Fonction principale** : `lttb(data, threshold)` et `downsample_series(series, target_points)`
- **Complexité** : O(n × m) où n = nombre total de points, m = nombre cible
- **Stabilité** : Toujours déterministe, mêmes entrées = mêmes sorties

## Notes
- Le downsampling ne s'applique **qu'à l'affichage**, pas à la détection de patterns
- La détection de patterns conserve **la précision maximale** pour garantir la précision des matches
- Les données d'origine restent en mémoire pour le calcul de patterns
