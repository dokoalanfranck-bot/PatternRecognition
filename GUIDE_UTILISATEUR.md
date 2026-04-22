# Guide utilisateur — Détection de Patterns Industriels

Bienvenue ! Ce guide vous explique comment utiliser l'application **pas à pas**, sans connaissances techniques requises.

---

## Table des matières

1. [À quoi sert cette application ?](#à-quoi-sert-cette-application-)
2. [Démarrage de l'application](#démarrage-de-lapplication)
3. [Écran d'accueil — Choix du jeu de données](#écran-daccueil--choix-du-jeu-de-données)
4. [Onglet Analyse](#onglet-analyse)
5. [Onglet Bibliothèque](#onglet-bibliothèque)
6. [Onglet Temps Réel — Early Warning System](#onglet-temps-réel--early-warning-system)
7. [Conseils d'utilisation](#conseils-dutilisation)
8. [Dépannage](#dépannage)
9. [Questions fréquentes](#questions-fréquentes)

---

## À quoi sert cette application ?

L'application vous permet de chercher des **formes récurrentes** (appelées *patterns*) dans des données industrielles :

✅ **Choisir** parmi 4 jeux de données (électricité, vapeur, poids, temps de cycle)  
✅ **Visualiser** les courbes sur un graphe interactif sombre haute performance  
✅ **Sélectionner** une portion de courbe qui vous intéresse  
✅ **Détecter** automatiquement toutes les portions similaires dans l'historique  
✅ **Filtrer** les résultats par niveau de similarité  
✅ **Sauvegarder** les meilleurs patterns dans une bibliothèque personnelle (Normal ou Panne)  
✅ **Consulter** et gérer vos patterns sauvegardés  
✅ **Surveiller en temps réel** vos données avec le système d'alerte précoce (Early Warning)  

---

## Démarrage de l'application

### Prérequis

- Python installé sur votre ordinateur
- Node.js installé sur votre ordinateur
- Les dépendances déjà installées (voir README.md)

### Étape 1 : Lancer le serveur (backend)

Ouvrez un terminal (ou l'invite de commandes) et tapez :

```bash
cd Pfe_Project
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Attendez le message **`Application startup complete`**. Le serveur est prêt.

> Si vous avez un environnement virtuel, activez-le d'abord :
> ```bash
> .venv\Scripts\activate
> ```

### Étape 2 : Lancer l'interface (frontend)

Ouvrez un **deuxième terminal** et tapez :

```bash
cd Pfe_Project\frontend
npm start
```

L'application s'ouvre automatiquement dans votre navigateur sur **http://localhost:3000**.

---

## Écran d'accueil — Choix du jeu de données

Au démarrage, vous arrivez sur un écran sombre avec **4 cartes** :

| Carte | Données | Unité |
|---|---|---|
| **C2 elect kw** | Consommation électrique | kW |
| **C2 Vap kgh** | Vapeur | kg/h |
| **C2 Prod Poid Process** | Poids de production | kg |
| **C2 Prod Tc Process** | Temps de cycle | s |

**Cliquez sur la carte** du jeu de données que vous souhaitez analyser.

Chaque carte affiche :
- Le nombre de lignes (points de mesure)
- La taille du fichier
- Les colonnes disponibles

---

## Onglet Analyse

C'est ici que vous **cherchez et explorez** les patterns. L'interface a un thème sombre avec des éléments en verre semi-transparent.

### 1️⃣ Barre de navigation (en haut)

En haut de l'écran, vous voyez :
- Le **nom du jeu de données** sélectionné (avec une icône)
- Deux onglets : **Analyse** et **Bibliothèque**
- Un bouton **Changer** pour revenir à l'écran de sélection

### 2️⃣ Naviguer dans les données

Juste en dessous, la barre de pagination affiche :
- **Page X / Y** : numéro de la page actuelle
- **Boutons ◀ ▶** : page précédente / suivante
- **Champ de saisie** : tapez un numéro et appuyez sur Entrée pour sauter à une page
- **Nombre de points total** dans le jeu de données

Chaque page contient **50 000 points** de données.

### 3️⃣ Sélectionner un pattern sur le graphe

Le graphe affiche la courbe de vos données en **bleu-indigo**.

**Pour lancer une recherche :**

1. **Cliquez et glissez** horizontalement sur la portion de courbe qui vous intéresse
2. La zone sélectionnée apparaît en **rouge**
3. **Relâchez** : la recherche démarre automatiquement

⏳ La recherche prend généralement **0.5 à 2 secondes**.

> **Minimum 10 points** requis. Si la sélection est trop petite, un message d'alerte apparaîtra.

### 4️⃣ Comprendre les résultats

Après la recherche, des **rectangles colorés** apparaissent sur le graphe aux endroits où des portions similaires ont été trouvées :

| Couleur | Signification |
|---|---|
| 🟩 **Vert** | Excellent — ≥ 80% de similarité |
| 🟦 **Bleu** | Bon — entre 50% et 79% |
| 🟨 **Jaune** | Faible — moins de 50% |
| 🟥 **Rouge** | Votre sélection d'origine |

Une **légende** en haut du graphe rappelle ces codes couleurs.

### 5️⃣ Filtrer les résultats

Un **panneau de filtres** semi-transparent apparaît à droite du graphe :

- **Curseur "Seuil de similarité"** : déplacez-le pour ne garder que les résultats au-dessus d'un certain % (ex : 80% = uniquement les excellents)
- **Nombre max** : limitez le nombre de rectangles affichés
- **Boutons rapides** :
  - **Top 10** / **Top 50** — les meilleurs résultats
  - **≥ 80%** / **≥ 50%** — filtrer par seuil
  - **Tout** — tout afficher

Les filtres s'appliquent **en temps réel** sur le graphe.

### 6️⃣ Naviguer entre les résultats

Sous le graphe, des boutons permettent de :
- **◀ / ▶** : passer au résultat précédent / suivant (le graphe zoome automatiquement dessus)
- **Réinitialiser** : revenir à la vue complète

### 7️⃣ Tableau de bord (Monitoring)

Sous le graphe, un panneau de monitoring affiche :

**Distribution des similitudes :**
- Une barre colorée horizontale montrant la répartition excellent / bon / faible
- 3 cartes avec le nombre et le pourcentage pour chaque catégorie

**Informations sur le pattern sélectionné :**
- Dates de début et fin
- Durée
- Statistiques : moyenne, écart-type, min, max, amplitude, énergie

**Scores de la recherche :**
- Meilleur score, score moyen, score médian, pire score

**Pipeline :**
- Taille de la série analysée, nombre de positions scannées, nombre de résultats, temps d'exécution

### 8️⃣ Sauvegarder un pattern

Dans le panneau de monitoring, cliquez sur **"Sauvegarder ce pattern"** :

1. Un formulaire apparaît avec deux champs :
   - **Nom** (obligatoire) : donnez un nom parlant (ex : "Cycle démarrage four")
   - **Description** (optionnel) : ajoutez des notes
2. Cliquez **"Confirmer"**
3. Un message de confirmation vert apparaît

Le pattern est désormais dans votre **Bibliothèque**.

### 9️⃣ Cartes des résultats similaires

En dessous du monitoring, les résultats s'affichent sous forme de **cartes cliquables** :

- Chaque carte montre : numéro, % de similarité, dates, score brut
- Les cartes ont une **bordure colorée** (vert / bleu / jaune) selon la qualité
- **Cliquez sur une carte** : le graphe zoome automatiquement sur cette portion

> Les cartes s'affichent par groupes de 20. Cliquez **"Afficher plus"** pour en voir davantage.

### 🔟 Distribution des scores

Un bouton **"Calculer la distribution"** permet d'afficher un **histogramme** montrant tous les scores de similarité calculés sur l'ensemble des données. Les résultats sélectionnés sont surlignés en rouge.

---

## Onglet Bibliothèque

Cliquez sur l'onglet **Bibliothèque** en haut pour accéder à vos patterns sauvegardés.

### Vue liste

Chaque pattern sauvegardé est une **carte** montrant :
- Un **mini-graphe** (sparkline) de la forme du pattern
- Le **nom** que vous lui avez donné
- Un **badge** avec le nombre d'occurrences trouvées (ex : "312 occ.")
- Des infos rapides : durée, moyenne, écart-type, amplitude

Cliquez sur **"Rafraîchir"** pour mettre à jour la liste après une sauvegarde.

### Vue détail (après clic sur une carte)

En cliquant sur un pattern, vous accédez à sa fiche complète :

**En haut :**
- Bouton **← Retour** pour revenir à la liste
- Nom, description, date de sauvegarde
- Bouton **"Supprimer"**

**Courbe :**
- Le graphe complet du pattern avec un remplissage bleu-indigo
- Une ligne pointillée indiquant la **moyenne**

**Répartition des occurrences (information clé) :**
- Barre visuelle colorée (vert / bleu / jaune)
- 3 cartes : Excellent (≥80%), Bon (50-79%), Faible (<50%)

> **Comment interpréter :**
> - Beaucoup de vert → pattern très fiable, à conserver
> - Beaucoup de jaune → pattern peu discriminant, envisagez de le supprimer

**Statistiques :**
- Points, durée, moyenne, écart-type, min, max, amplitude

**Dates :**
- Début et fin du pattern, date de sauvegarde

### Supprimer un pattern

1. En vue détail, cliquez **"Supprimer"**
2. Le bouton devient **"Confirmer la suppression"**
3. Cliquez une seconde fois pour confirmer
4. Vous revenez automatiquement à la liste

---

## Onglet Temps Réel — Early Warning System

Cliquez sur l'onglet **Temps Réel** en haut pour accéder au système d'alerte précoce. Ce module surveille un flux de données en continu et compare chaque nouvelle observation aux patterns de votre bibliothèque.

> **Prérequis** : vous devez avoir au moins un pattern sauvegardé dans la Bibliothèque (minimum 40 points). Les patterns servent de référence pour la détection.

### 1️⃣ Configurer et lancer

Avant le lancement, vous pouvez régler :
- **Vitesse (s/pt)** : délai entre chaque point simulé (0.005 = très rapide, 0.1 = lent)
- **Nb points max** : nombre de points à traiter (0 = tout le jeu de données)

Cliquez sur **"Lancer"** pour démarrer la simulation.

### 2️⃣ Barre de progression

Pendant la simulation, une barre de progression indique :
- Le **pourcentage** de données traitées
- **Points reçus** : nombre de points injectés dans le buffer
- **Buffer** : taille actuelle du buffer circulaire
- **Patterns** : nombre de patterns de référence surveillés

Cliquez **"Stop"** pour arrêter la simulation à tout moment.

### 3️⃣ Bandeau d'alerte globale

Un bandeau en haut du panneau affiche le **niveau d'alerte maximal** parmi tous les patterns surveillés :

| Niveau | Couleur | Signification |
|---|---|---|
| **Idle** | Gris | Aucune activité détectée |
| **Watching** | Bleu | Ressemblance faible détectée, surveillance active |
| **Warning** | Jaune/Ambre | Ressemblance modérée, attention requise |
| **Alert** | Orange | Ressemblance forte, intervention probable |
| **Confirmed** | Rouge | Correspondance confirmée, action requise |

Un pipeline de **5 points connectés** montre la progression visuelle à travers les niveaux.

### 4️⃣ Cartes de suivi par pattern (Tracker Cards)

Chaque pattern de référence possède sa propre carte avec :

**En-tête :**
- Nom du pattern et type (**✓ Normal** en vert ou **⚠ Panne** en rouge)
- Nombre de points du pattern
- **Jauge circulaire SVG** : pourcentage de similarité en temps réel (coloré selon le niveau)
- **Badge de niveau** : état actuel de la machine à états

**Graphiques :**
- **Évolution Similarité** (gauche) : timeline montrant l'historique de similarité avec les lignes de seuils en pointillés
- **Superposition Z-Norm** (droite) : overlay du pattern de référence (violet) et du segment correspondant du flux (couleur dynamique) après normalisation, permettant de comparer les formes

### 5️⃣ Journal des événements

En bas, le journal affiche toutes les **transitions d'états** :
- Chaque événement montre : `ancien_niveau → nouveau_niveau`, nom du pattern, similarité %
- Les événements sont colorés selon la gravité (escalade = couleur du nouveau niveau)
- Les patterns de type "Panne" sont marqués **⚠ PANNE** en rouge
- Cliquez **"Effacer"** pour vider l'historique (disponible quand la simulation est arrêtée)

### 6️⃣ Comprendre la machine à états

Le système utilise une **machine à états progressive** pour éviter les faux positifs :

```
IDLE ──(≥35%, 2 checks)──→ WATCHING ──(≥55%, 3 checks)──→ WARNING
                                                              │
              CONFIRMED ←──(≥85%, 2 checks)── ALERT ←──(≥72%, 2 checks)──┘
```

- Chaque transition nécessite un **nombre de checks consécutifs** au-dessus du seuil
- Le retour à IDLE nécessite **3 checks consécutifs** sous 25% de similarité
- Les évaluations se font **toutes les 20 observations** (pas à chaque point)
- Le buffer est **circulaire** : il garde les 1.5× derniers points du plus grand pattern

### 7️⃣ Conseils pour le temps réel

1. **Sauvegardez des patterns de qualité** : plus le pattern de référence est propre, meilleure sera la détection
2. **Patterns de panne** : sauvegardez les signatures précédant les pannes connues pour que le système les détecte prématurément
3. **Vitesse** : commencez avec 0.005 pour tester rapidement, puis 0.05-0.1 pour observer les transitions en temps réel
4. **Interprétation** : un niveau WARNING sur un pattern "Panne" est plus préoccupant qu'un WARNING sur un pattern "Normal"

---

## Conseils d'utilisation

### Comment sélectionner un bon pattern ?

1. **Choisissez une zone régulière** — évitez les zones bruitées ou en transition
2. **Préférez 50 à 200 points** — ni trop court ni trop long
3. **Vérifiez la distribution** après la recherche :
   - Plus de 80% d'excellents → pattern fiable
   - Moins de 50% d'excellents → pattern peu discriminant

### Utiliser les filtres efficacement

- **Cycle parfait ?** → seuil à 80%
- **Variations acceptables ?** → seuil à 50%
- **Vue d'ensemble rapide ?** → Top 10

### Stratégie de sauvegarde

1. Explorez plusieurs pages pour voir différentes périodes
2. Pour chaque cycle intéressant : lancez la recherche
3. Sauvegardez uniquement si la qualité est bonne (≥80% excellent)
4. Dans la Bibliothèque : supprimez les patterns peu fiables

### Interprétation des statistiques

| Stat | Signification | Ce que ça veut dire |
|---|---|---|
| **Moyenne haute** | Valeurs élevées en moyenne | Cycle à haute puissance/production |
| **Écart-type bas** | Peu de variation | Cycle très régulier et stable |
| **Amplitude grande** | Grand écart entre min et max | Cycle avec de fortes oscillations |
| **Durée longue** | Beaucoup de points | Cycle lent, étalé dans le temps |

---

## Dépannage

| Problème | Solution |
|---|---|
| **"Erreur lors de la recherche"** | Vérifiez que le serveur backend est bien lancé. Vérifiez le terminal du backend pour les erreurs. |
| **Aucun résultat trouvé** | La sélection est trop courte (< 10 points) → agrandissez-la. Ou le pattern n'existe pas dans l'historique. |
| **Le graphe est vide** | Attendez le chargement (~2-3 sec). Essayez de changer de page ou rafraîchissez (F5). |
| **La bibliothèque ne se met pas à jour** | Cliquez le bouton "Rafraîchir" en haut de la liste. |
| **L'application ne s'ouvre pas** | Vérifiez que le backend tourne (terminal 1) et le frontend aussi (terminal 2). |
| **Beaucoup de résultats "Faible"** | Le pattern est trop générique. Essayez de sélectionner une zone plus spécifique. |
| **Temps réel : "Aucun pattern en base"** | Sauvegardez au moins un pattern dans la Bibliothèque (min. 40 points) avant de lancer le temps réel. |
| **Temps réel : aucune transition** | Le jeu de données ne contient peut-être pas de segments similaires. Essayez un pattern plus court ou un dataset différent. |
| **Temps réel : reste bloqué sur IDLE** | Les seuils sont élevés par défaut. Vérifiez que vos patterns de référence correspondent bien aux données du flux simulé. |

---

## Questions fréquentes

**Q : Combien de temps prend une recherche ?**  
R : Généralement 0.5 à 2 secondes selon la taille du pattern et du jeu de données.

**Q : Peut-on sauvegarder plusieurs fois le même pattern ?**  
R : Oui, ils auront des noms et IDs différents. Utilisez des noms distincts (ex : "Cycle-V1", "Cycle-V2").

**Q : Peut-on exporter les patterns ?**  
R : Pas directement via l'interface. Les patterns sont stockés dans une base de données locale.

**Q : Peut-on analyser plusieurs jeux de données en même temps ?**  
R : Non, un seul à la fois. Pour changer, cliquez "Changer" en haut et sélectionnez un autre jeu.

**Q : Les patterns sauvegardés sont-ils partagés entre jeux de données ?**  
R : La bibliothèque est globale. Vous pouvez sauvegarder des patterns de n'importe quel jeu de données.

**Q : Que signifie le "score MASS" ?**  
R : C'est la distance brute calculée par l'algorithme. Plus le score est **bas**, plus la similarité est **haute**. Le pourcentage affiché est la conversion inverse pour que ce soit plus intuitif.

**Q : Comment fonctionne le système d'alerte temps réel ?**  
R : Le système lit les données point par point (comme un capteur IoT), accumule un buffer glissant, et toutes les 20 observations compare le buffer à chaque pattern de référence grâce à l'algorithme MASS. Si la similarité dépasse un seuil pendant plusieurs évaluations consécutives, le niveau d'alerte augmente progressivement.

**Q : Quelle est la différence entre un pattern Normal et Panne ?**  
R : C'est une classification que vous attribuez lors de la sauvegarde. Un pattern "Panne" correspond à un profil de données précédant une défaillance connue. Le système d'alerte précoce l'utilise pour vous avertir quand un comportement similaire réapparait.

**Q : Pourquoi le niveau passe-t-il de WARNING à IDLE directement ?**  
R : Si la similarité chute sous 25% pendant 3 évaluations consécutives, le système revient directement à IDLE. C'est un mécanisme de protection contre les alertes persistantes injustifiées.

---

## Raccourcis et astuces

| Action | Comment faire |
|---|---|
| Aller à une page précise | Tapez le numéro dans le champ et appuyez Entrée |
| Sélectionner un pattern | Cliquez-glissez horizontalement sur le graphe |
| Zoomer sur un résultat | Cliquez sur sa carte dans la liste |
| Changer de jeu de données | Bouton "Changer" dans la barre du haut |
| Rafraîchir la bibliothèque | Bouton "Rafraîchir" en haut de la liste |

---

## Support

Pour toute question ou problème :
- Vérifiez que backend ET frontend sont lancés
- Vérifiez les URL : backend `http://127.0.0.1:8000`, frontend `http://localhost:3000`
- Checkez la console du navigateur (F12) pour voir les erreurs

Bon analyse ! 🚀
