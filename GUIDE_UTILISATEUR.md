# Guide utilisateur — Détection de Patterns Industriels

Bienvenue ! Ce guide vous explique comment utiliser l'application **pas à pas**, sans connaissances techniques requises.

---

## Table des matières

1. [À quoi sert cette application ?](#à-quoi-sert-cette-application-)
2. [Démarrage de l'application](#démarrage-de-lapplication)
3. [Écran d'accueil — Choix du jeu de données](#écran-daccueil--choix-du-jeu-de-données)
4. [Onglet Analyse](#onglet-analyse)
5. [Onglet Bibliothèque](#onglet-bibliothèque)
6. [Conseils d'utilisation](#conseils-dutilisation)
7. [Dépannage](#dépannage)
8. [Questions fréquentes](#questions-fréquentes)

---

## À quoi sert cette application ?

L'application vous permet de chercher des **formes récurrentes** (appelées *patterns*) dans des données industrielles :

✅ **Choisir** parmi 4 jeux de données (électricité, vapeur, poids, temps de cycle)  
✅ **Visualiser** les courbes sur un graphe interactif sombre haute performance  
✅ **Sélectionner** une portion de courbe qui vous intéresse  
✅ **Détecter** automatiquement toutes les portions similaires dans l'historique  
✅ **Filtrer** les résultats par niveau de similarité  
✅ **Sauvegarder** les meilleurs patterns dans une bibliothèque personnelle  
✅ **Consulter** et gérer vos patterns sauvegardés  

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
