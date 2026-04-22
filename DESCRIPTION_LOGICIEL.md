# 📊 Description du Logiciel — Pattern Recognition Energy Analytics

## Vue d'ensemble

**Pattern Recognition Energy Analytics** est une application web de détection, d'analyse et de **surveillance en temps réel** de patterns (formes récurrentes) dans des **séries temporelles industrielles**. Elle permet d'identifier automatiquement toutes les occurrences similaires à un motif sélectionné dans un historique de données, grâce à l'algorithme **MASS** (Mueen's Algorithm for Similarity Search), et dispose d'un **système d'alerte précoce (Early Warning System)** basé sur une machine à états pour le monitoring continu.

L'interface dark moderne et performante offre une visualisation interactive haute résolution, une bibliothèque personnelle pour sauvegarder les patterns pertinents, et un tableau de bord temps réel pour la surveillance industrielle.

---

## 🎯 Fonctionnalités principales

### 1. **Sélection de jeu de données**
- Choix parmi 4 types de données industrielles préchargées
- Affichage des statistiques (nombre de points, taille fichier, colonnes)
- Données disponibles :
  - 📈 **Électricité (kW)** — Consommation électrique
  - 💨 **Vapeur (kg/h)** — Débit vapeur
  - ⚖️ **Poids (kg)** — Production/poids processus
  - ⏱️ **Temps de cycle (s)** — Durée de production

### 2. **Visualisation interactive**
- Graphe haute performance avec technologie **WebGL** (Plotly scattergl)
- Zoom, pan, sélection de zones
- Thème sombre avec interface glassmorphism
- Chargement paginé pour gérer de grandes séries temporelles

### 3. **Détection de patterns**
- **Sélection visuelle** : cliquez et glissez pour choisir un motif sur le graphe
- **Recherche automatique** : l'algorithme MASS détecte toutes les portions similaires
- **Score de similarité** : chaque match reçoit un score (0 à 100%)
- **Filtrage** : ajustez le seuil de similarité pour affiner les résultats
- **Classification** : catégorisation des patterns en **Normal** ou **Panne**

### 4. **Dashboard de monitoring**
- Statistiques en temps réel sur les patterns trouvés
- Distribution des scores de similarité
- Informations détaillées du pattern (durée, stats, énergie)
- Pipeline de recherche (taille série, positions scannées, temps)

### 5. **Bibliothèque de patterns**
- Sauvegarde des patterns intéressants avec classification (Normal / Panne)
- Stockage local persistent (SQLite)
- Consultation et gestion des patterns mémorisés
- Suppression et organisation

### 6. **🚨 Système d'alerte précoce (Early Warning System)**
- **Monitoring temps réel** : simulation point par point d'un flux IoT
- **Sliding Window MASS** : comparaison continue du flux contre les patterns de référence
- **Machine à états à 5 niveaux** : IDLE → WATCHING → WARNING → ALERT → CONFIRMED
- **Suivi multi-patterns** : chaque pattern possède sa propre machine à états
- **Alerte progressive** : transitions nécessitant des checks consécutifs (anti faux-positifs)
- **Visualisation avancée** : jauge SVG, timeline de similarité, superposition Z-normalisée
- **Événements traçables** : historique complet des transitions d'états en base de données

---

## 🔧 Architecture technique

### Stack

| Couche | Technologie | Détails |
|--------|------------|---------|
| **Backend** | Python 3.10+ | FastAPI + uvicorn |
| **Algorithme** | stumpy (MASS) | Recherche de séquences similaires |
| **Temps réel** | Sliding Window MASS | Détection continue + machine à états |
| **Base de données** | SQLite | Stockage patterns, événements, metadata |
| **Frontend** | React 19.2 | Interface utilisateur |
| **Visualisation** | Plotly.js 3.4 | Graphiques interactifs WebGL |
| **Design** | CSS moderne | Dark theme, glassmorphism, variables CSS |

### Flux de données — Analyse

```
Données CSV → Backend (pandas) → Preprocessing → MASS Algorithm
                ↓
           Résultats (scores + positions)
                ↓
           Frontend (React) → Visualisation Plotly
                ↓
           Bibliothèque (SQLite) ← Patterns sauvegardés
```

### Flux de données — Early Warning System

```
Données CSV (simulation IoT)
    ↓  point par point
Buffer circulaire (1.5× max pattern)
    ↓  toutes les 20 observations
MASS (stumpy) — best match par pattern de référence
    ↓  distance → similarité %
Machine à états (par pattern)
    IDLE → WATCHING → WARNING → ALERT → CONFIRMED
    ↓  transitions
Événements → SQLite (traçabilité)
    ↓
Frontend → Jauge SVG + Timeline + Overlay Z-Norm
```

---

## 💼 Domaines d'application potentiels

### 1. **Optimisation énergétique**
- Identifier les **pics de consommation** récurrents
- Détecter les **profils de consommation anormaux**
- Planifier l'approvisionnement énergétique en fonction des patterns
- Réaliser des économies ciblées sur les heures/jours à patterns identifiés

### 2. **Maintenance préventive**
- Reconnaître les **signatures de défaillance** avant une panne
- Suivre l'**usure progressive** des équipements
- Planifier les interventions de maintenance en fonction des patterns dégradés
- Augmenter la durée de vie des machines

### 3. **Contrôle de qualité**
- Détecter les variations de **qualité de production**
- Identifier les périodes où le processus sort de normes
- Tracer les causes des défauts (corrélation avec d'autres patterns)
- Assurer une production **conforme et qualitative**

### 4. **Détection d'anomalies**
- Isoler les **comportements inhabituels** dans les séries temporelles
- Déceler les **fuites** ou dysfonctionnements silencieux
- Alerter en temps réel sur les écarts anormaux
- Prévenir les incidents avant qu'ils ne deviennent critiques

### 5. **Prévisions et planification**
- Utiliser les patterns historiques comme prédicteurs
- **Prévoir la charge** future (électricité, production)
- Optimiser l'**allocation de ressources**
- Anticiper les besoins de maintenance ou d'upgrades

### 6. **Analyse de performance**
- Comparer les **efficacités** de différents runs de production
- Identifier les **best practices** (patterns optimaux)
- Mesurer l'impact des changements de procédé
- Établir des KPIs basés sur les patterns détectés

### 7. **Diagnostique et troubleshooting**
- Analyser l'**historique** pour localiser l'origine des problèmes
- Reproduire les conditions qui causent des dysfonctionnements
- Comparer des situations passées similaires pour trouver des solutions
- Réduire le **MTTR** (Mean Time To Repair)

### 8. **Secteurs d'application**

#### Industrie manufacturière
- Suivi de ligne de production
- Contrôle procédés (vapeur, énergie, poids)
- Optimisation chaînes d'assemblage

#### Secteur énergétique
- Gestion des pics de consommation
- Détection de fraude (consommation anormale)
- Planification réseau et équilibrage charges

#### Industrie agro-alimentaire
- Suivi temps de cycle productions
- Consommation énergétique frigorifiques
- Patterns vapeur stérilisation

#### Pharmaceutique/Chimie
- Processus batch avec signature énergétique
- Traçabilité de la qualité
- Détection déviations procédé

---

## 📈 Avantages de cet outil

✅ **Détection automatique** — plus rapide et fiable que l'analyse manuelle  
✅ **Early Warning System** — alerte progressive avant les pannes  
✅ **Machine à états** — anti faux-positifs avec checks consécutifs  
✅ **Interface intuitive** — pas besoin de connaissances techniques  
✅ **Performance** — traite des millions de points en temps réel (WebGL)  
✅ **Flexibilité** — paramétrable pour différents seuils/domaines  
✅ **Historique** — bibliothèque pour comparer patterns passés  
✅ **Traçabilité** — tous les événements d'alerte enregistrés en base  
✅ **Open-source** — basé sur stack moderne (React, FastAPI, stumpy)  
✅ **Scalable** — architecture backend/frontend facilement extensible  

---

## 🚀 Cas d'usage typiques

### Exemple 1 : Pic électrique périodique
Un gestionnaire d'usine charge les données de consommation électrique, sélectionne un pic anormal, et découvre qu'il se reproduit chaque lundi matin → reflète l'allumage d'une nouvelle ligne de production.

### Exemple 2 : Anomalie vapeur
Un opérateur détecte une consommation vapeur anormale, la compare à l'historique via la bibliothèque, et identifie une fuite partielle (comparaison avec patterns de fuites antérieures).

### Exemple 3 : Optimisation temps cycles
L'équipe QA utilise les patterns pour identifier les cycles les plus rapides (best performance), et documente les conditions qui y ont mené.

### Exemple 4 : Early Warning — Détection de panne imminente
Un technicien sauvegarde un pattern de type "Panne" dans la bibliothèque (signature énergétique précédant une défaillance connue). Le système d'alerte précoce surveille le flux en continu : dès que la machine à états passe en WARNING, l'opérateur est prévenu et peut intervenir avant la casse.

### Exemple 5 : Surveillance multi-patterns
Le responsable maintenance configure 5 patterns de référence (3 normaux, 2 pannes). Le dashboard affiche en temps réel l'état de chaque tracker avec sa jauge de similarité, permettant de détecter simultanément un cycle normal qui dévie ET une signature de panne qui émerge.

---

## 📝 Conclusion

Cette application transforme des données brutes en **intelligence exploitable**, permettant aux organisations d'optimiser leurs opérations, réduire les coûts énergétiques, améliorer la fiabilité et prévenir les défaillances. Le **système d'alerte précoce** apporte une dimension proactive en détectant les situations à risque avant qu'elles ne deviennent critiques, grâce à une machine à états robuste et un algorithme de recherche de similarité performant. Elle s'adresse à tous les secteurs avec des données temporelles critiques à analyser et à surveiller.
