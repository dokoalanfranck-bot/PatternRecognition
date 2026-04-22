# Améliorations du système — Seuils de détection configurables

## Résumé des changements

Vous avez demandé une plus grande flexibilité : permettre à l'utilisateur de définir des seuils de similarité personnalisés lors de la sauvegarde d'un pattern, avec deux modes de détection (anomalie vs panne).

Cette implémentation ajoute la capacité à configurer :
- **Seuil de similarité** : pourcentage (0-100%) déclenchant l'alerte
- **Type d'alerte** : "anomaly" ou "failure" (logiques inverses)

## Fichiers modifiés

### Backend

#### 1. `backend/services/database.py`
- **Migration DB** : ajout des colonnes `alert_threshold` (REAL) et `alert_type` (TEXT) à la table `patterns`
- **Fonction `save_pattern()`** : accepte maintenant `alert_threshold` et `alert_type` en paramètres
- **Fonction `list_patterns()` & `get_pattern()`** : retournent now `alert_threshold` et `alert_type`
- Code de migration : gère l'ajout des colonnes sur DB existantes (pas de suppression de données)

#### 2. `backend/api/pattern.py`
- **Endpoint `POST /patterns/save`** : accepte dans le corps :
  - `alert_threshold` (float, 0-100, défaut 55.0)
  - `alert_type` (string, "anomaly" ou "failure", défaut "anomaly")
- Validation des paramètres (clamping des valeurs)
- Réponse incluant confirmation du seuil et du type

#### 3. `backend/services/realtime_engine.py`
- **Classe `PatternTracker.__init__()`** : accepte `alert_threshold` et `alert_type`
- **Méthode `update()`** : logique basée sur le type d'alerte :
  - **"anomaly"** : alerte si `similarité < seuil` (déviation = anormal)
  - **"failure"** : alerte si `similarité >= seuil` (ressemblance = similaire à panne)
- **Machine à états adaptée** :
  - Anomaly : IDLE → WATCHING → WARNING → IDLE
  - Failure : IDLE → ALERT → CONFIRMED → IDLE
- **Fonction `_run_simulation()`** : charge les seuils depuis la DB et les passe aux `PatternTracker`
- **Méthode `to_dict()`** : sérialise `alert_threshold` et `alert_type` dans la réponse

### Frontend

#### 1. `frontend/src/api/api.js`
- **Fonction `savePattern()`** : signature étendue avec `alertThreshold` et `alertType`
- Génère le corps de requête `POST /patterns/save` avec les seuils

#### 2. `frontend/src/components/MonitoringPanel.jsx`
- **États locaux ajoutés** : `alertThreshold` (défaut 55.0), `alertType` (défaut "anomaly")
- **Formulaire enrichi** : 
  - Dropdown pour sélectionner le type d'alerte
  - Slider pour ajuster le seuil (0-100%)
  - Affichage visuel de la valeur sélectionnée
- **Fonction `handleSave()`** : passe les seuils à `savePattern()`
- Design lisible : selecteur et slider dans une grille 2 colonnes avec background distinct

## Logiques de détection

### Type "anomaly" (déviation)
```text
Alerter si : similarité < seuil
Cas d'usage : patterns normaux (cycle classique, fonctionnement standard)
Exemple : pattern "Cycle normal" avec seuil 50%
  - Sim 30% → ALERTE (comportement déviant)
  - Sim 70% → OK (comportement normal)
```

### Type "failure" (ressemblance à panne)
```text
Alerter si : similarité >= seuil
Cas d'usage : patterns de panne (démarrage dégradé, arrêt anormal)
Exemple : pattern "Panne démarrage" avec seuil 75%
  - Sim 80% → ALERTE (détecté motif de panne)
  - Sim 40% → OK (pas de ressemblance à panne)
```

## Données persistées en base

Table `patterns` (nouvelle structure) :
```sql
id, name, description, values_json, dates_json, stats_json, 
match_count, pattern_type, alert_threshold, alert_type, created_at
```

**Exemple d'entrée** :
```json
{
  "id": 1,
  "name": "Cycle production standard",
  "pattern_type": "normal",
  "alert_type": "anomaly",
  "alert_threshold": 50.0,
  "stats": { ... },
  "created_at": 1712345678.0
}
```

## Endpoints modifiés & nouveaux

### POST /patterns/save
**Nouveau corps** :
```json
{
  "start": "2022-03-15T08:00:00",
  "end": "2022-03-15T09:00:00",
  "name": "Mon Pattern",
  "pattern_type": "normal",
  "alert_type": "anomaly",
  "alert_threshold": 50.0,
  "dataset": "C2 elect kw.csv",
  ...
}
```

**Réponse** :
```json
{
  "id": 1,
  "message": "Pattern 'Mon Pattern' sauvegardé avec seuil 50.0%.",
  "alert_threshold": 50.0,
  "alert_type": "anomaly"
}
```

### GET /patterns
La réponse inclut maintenant `alert_threshold` et `alert_type` pour chaque pattern.

## Recommandations de seuils

| Type | Plage | Recommandation | Raison |
|---|---|---|---|
| Anomaly | 30-70% | 40-60% | Détecter les déviances tout en tolérant des variations |
| Failure | 60-95% | 70-85% | Haute confiance pour éviter faux positifs sur motif de panne |

## Compatibilité

- ✅ Base de données existante : migration automatique via `try/except` sur ALTER TABLE
- ✅ Patterns sauvegardés avant changement : défaut à "anomaly" / 55% lors de chargement
- ✅ Frontend & Backend : bwd-compatible (seuils optionnels, valeurs par défaut)

## Prochaines étapes

1. Tester l'UI de sauvegarde avec le slider de seuil
2. Vérifier que la simulation temps réel respecte les seuils configurés
3. Valider la détection d'anomalies vs pannes sur jeux de test
4. Optionnel : ajouter des presets (Ex: "Strict" 35%, "Normal" 55%, "Relâché" 75%)

## Documentation supplémentaire

Voir [THRESHOLD_CONFIG.md](THRESHOLD_CONFIG.md) pour guide complet d'utilisation.
