# Configuration des Seuils par Pattern

## Vue d'ensemble

Lors de la sauvegarde d'un pattern, l'utilisateur peut maintenant configurer :
- **Seuil d'alerte** (`alert_threshold`) : pourcentage de similarité (0-100%)
- **Type d'alerte** (`alert_type`) : mécanisme de détection (`anomaly` ou `failure`)

## Types d'alerte

### 1. Type "anomaly" (comportement anormal)
**Configuration** : défence d'une consommation ou d'un comportement _normal_.

- **Déclenchement** : alerte si similarité **< seuil**
- **Cas d'usage** : patterns normaux (ex: "Cycle production classique")
- **Exemple** : pattern de cycle normal avec seuil 50%
  - Si similarité = 30% → alerte "anomalie" (comportement déviant)
  - Si similarité = 70% → pas d'alerte (comportement normal)

**Logique d'états** :
```
IDLE → WATCHING (2 checks) → WARNING (3 checks) → IDLE
```

### 2. Type "failure" (comportement de panne)
**Configuration** : détection d'un motif _ressemblant à une panne_.

- **Déclenchement** : alerte si similarité **>= seuil**
- **Cas d'usage** : patterns de panne (ex: "Démarrage dégradé", "Arrêt anormal")
- **Exemple** : pattern de panne avec seuil 70%
  - Si similarité = 80% → alerte "panne" (ressemblance détectée)
  - Si similarité = 40% → pas d'alerte (pas de ressemblance)

**Logique d'états** :
```
IDLE → ALERT (2 checks) → CONFIRMED (2 checks) → IDLE
```

## Configuration pratique

### Lors de la création d'un pattern

**Exemple 1 : Pattern normal (électricité)**
```json
{
  "name": "Cycle production standard",
  "pattern_type": "normal",
  "alert_type": "anomaly",
  "alert_threshold": 50.0,
  "description": "Cycle de fonctionnement classique. Alerter si déviation anormale."
}
```

**Exemple 2 : Pattern de panne (électricité)**
```json
{
  "name": "Démarrage défaillant",
  "pattern_type": "failure",
  "alert_type": "failure",
  "alert_threshold": 75.0,
  "description": "Motif d'un démarrage dégradé. Alerter si détecté."
}
```

### Paramètres d'ajustement

| Paramètre | Plage | Description |
|---|---|---|
| `alert_threshold` | 0-100 (%) | Seuil de similarité déclenchant alerte |
| `alert_type` | `anomaly` \| `failure` | Mécanisme : déviation vs ressemblance |

## API

### POST /patterns/save

Corps étendu :
```json
{
  "start": "2022-03-15T08:00:00",
  "end": "2022-03-15T09:00:00",
  "name": "Mon Pattern",
  "description": "Description optionnelle",
  "pattern_type": "normal",
  "alert_type": "anomaly",
  "alert_threshold": 50.0,
  "dataset": "C2 elect kw.csv"
}
```

### GET /patterns

Réponse enrichie :
```json
{
  "patterns": [
    {
      "id": 1,
      "name": "Cycle production standard",
      "pattern_type": "normal",
      "alert_type": "anomaly",
      "alert_threshold": 50.0,
      "stats": {...}
    }
  ]
}
```

## Recommandations

- **Seuils anomaly** : commencer à 40-60% selon la variabilité du process
- **Seuils failure** : commencer à 65-80% pour éviter faux positifs sur motif de panne
- **Checks consécutifs** : pré-configurés à 2-3 pour robustesse (évite oscillations)
- **Test** : valider en simulation avant déploiement

## Voir aussi

[README.md](README.md) — Architecture complète  
[EARLY_WARNING_SYSTEM.md](EARLY_WARNING_SYSTEM.md) — Moteur EWS
