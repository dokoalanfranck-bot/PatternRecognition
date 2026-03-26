# Guide utilisateur — Detection de Patterns Energetiques

Bienvenue dans l'application de détection de patterns de consommation électrique. Ce guide vous explique comment utiliser l'outil pas à pas.

---

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Démarrage de l'application](#démarrage-de-lapplication)
3. [Onglet Analyse](#onglet-analyse)
4. [Onglet Bibliothèque](#onglet-bibliothèque)
5. [Conseils d'utilisation](#conseils-dutilisation)

---

## Vue d'ensemble

L'application vous permet de :

✅ **Analyser** des patterns de consommation électrique sur un historique de ~1,8 million de points
✅ **Détecter** toutes les occurrences similaires d'un pattern sélectionné
✅ **Filtrer** les résultats par similarité (≥80%, ≥50%, etc.)
✅ **Sauvegarder** les meilleurs patterns dans une bibliothèque
✅ **Consulter** la répartition par intervalle de similarité pour chaque pattern

---

## Démarrage de l'application

### Étape 1 : Lancer le backend

Ouvrez un terminal et exécutez :

```bash
cd Pfe_Project
.venv\Scripts\activate
uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Attendez le message `Application startup complete`. Le backend est maintenant sur `http://127.0.0.1:8000`.

### Étape 2 : Lancer le frontend

Ouvrez un **deuxième terminal** et exécutez :

```bash
cd Pfe_Project\frontend
npm start
```

L'application s'ouvre dans votre navigateur sur `http://localhost:3000`.

---

## Onglet Analyse

C'est ici que vous **cherchez et explorez** les patterns.

### 1️⃣ Navigation dans les données

En haut de l'écran, vous voyez :
- **Page X / Y** : numéro de la page actuelle
- **Flèches** : naviguez entre les pages
- **Champ d'entrée** : allez directement à une page (entrez un numéro, appuyez sur Entrée)
- **"X points au total"** : affiche le nombre total de points dans l'historique (~1,8M)

Chaque page contient **50 000 points** de données.

### 2️⃣ Sélectionner un pattern

**Sur le graphe (courbe bleue) :**

1. **Cliquez et dragguez** pour tracer une zone rectangulaire
2. La zone devient **rouge** (sélection)
3. **Relâchez** : la recherche démarre automatiquement

⏳ **Attente** : le système demande au least 10 points. S'il en manque, vous verrez une alerte.

### 3️⃣ Résultats de la recherche

Une fois la recherche terminée, trois choses s'affichent :

#### A) **Légende des couleurs** (en haut à gauche du graphe)
```
🟩 ≥80%  = Excellent (très similaire)
🟦 50-79% = Bon (similaire)
🟨 <50%  = Faible (peu similaire)
🟥      = Sélection
```

#### B) **Filtres d'affichage** (panneau violet à droite)
Titre : "🎛️ Filtres d'affichage"

- **Curseur ou champ** : réglez le seuil minimum de similarité
  - 0% : affiche tous les patterns
  - 80% : affiche seulement les excellents matches
  
- **Nombre max de rectangles** : limite l'affichage (ex : afficher top 10, top 50, ou tous)
  - Laissez vide pour voir tous

- **Boutons rapides** : 
  - "Top 10", "Top 50" : affiche les meilleurs
  - "≥80%", "≥50%" : affiche par seuil
  - "Tout" : affiche tout sans limite

#### C) **Boutons de navigation**
Sous le graphe :
- **◀ / ▶** : allez au pattern précédent/suivant
- **#X / total** : affiche votre position dans la liste
- **"Réinitialiser"** : réinitialise le zoom et la sélection

#### D) **Monitoring de la détection** (section jaune)
Titre : "Monitoring de la detection"

Affiche :
- **"Sauvegarder ce pattern"** (bouton vert) : sauvegardez le pattern actuel
- **Distribution des similitudes** : barre colorée montrant excellent/bon/faible
- **Pattern sélectionné** : infos du pattern (début, fin, durée, points, stats)
- **Scores MASS** : meilleur/pire/moyen score trouvé
- **Pipeline de recherche** : nombre de points scannés, temps d'exécution

#### E) **Liste des patterns similaires** (bas de page)
Cartes cliquables montrant :
- **Numéro** et **% de similarité**
- **Dates** (début et fin)
- **Score MASS** (valeur brute)

**Cliquez sur une carte** : le graphe se centre sur ce pattern et vous pouvez le voir surligne.

### 4️⃣ Calculer la distribution des scores

Si vous avez une sélection active :

1. Un bouton **"Calculer la distribution des scores"** apparaît
2. Cliquez dessus
3. Un **histogramme** s'affiche montrant tous les scores de similarité

Les patterns de votre sélection sont surlignés en rouge dans l'histogramme.

---

## Onglet Bibliothèque

Ici vous **gérez les patterns sauvegardés**.

### 1️⃣ Vue liste

Chaque pattern sauvegardé est une **carte** montrant :
- **Sparkline** (petit graphe en miniature)
- **Nom** du pattern
- **Badge** : nombre d'occurrences trouvées (ex : "312 occ.")
- **Description** (si renseignée)
- **Infos rapides** : durée, moyenne, écart-type, amplitude

**Pour voir plus de détails :** cliquez sur la carte.

### 2️⃣ Vue détail (après clic)

Vous verrez :

#### En haut
- **← Retour** : revenir à la liste
- **Nom** et **description** du pattern
- **Bouton "Supprimer"** (avec confirmation)
- **Date de sauvegarde**

#### Courbe
- **Graphe Plotly** : le pattern en bleu
- **Ligne pointillée** : la moyenne (μ)
- Au survol : affiche la valeur et la date exacte

#### Répartition des occurrences (**LE INFO PRINCIPALE**)
- **Barre visuelle** : proportion excellent/bon/faible
- **3 cards** montrant :
  - **Excellent (≥80%)** : nombre + %
  - **Bon (50–79%)** : nombre + %
  - **Faible (<50%)** : nombre + %

💡 **Comment interpréter :**
- 80% excellent → **pattern très fiable**, à conserver
- 10% excellent, 60% faible → **pattern peu fiable**, à supprimer

#### Stats essentielles (bas)
- **Points** : nombre de points dans le pattern
- **Durée** : en heures
- **Moyenne (μ)** : valeur moyenne (kW)
- **Écart-type (σ)** : variabilité (kW)
- **Min / Max / Amplitude** : plage couverte

#### Dates temporelles
- **Début** : quand le pattern a commencé
- **Fin** : quand il a fini
- **Sauvegardé le** : quand vous l'avez enregistré

### 3️⃣ Supprimer un pattern

En vue détail, cliquez **"Supprimer"** :

1. Le bouton devient **"Confirmer"**
2. Cliquez de nouveau pour confirmer
3. Le pattern est supprimé et vous reveniez à la liste

---

## Conseils d'utilisation

### 📌 Comment sélectionner un bon pattern ?

1. **Choisir une zone régulière**
   - Évitez les zones bruitées ou en transition
   - Préférez une zone de 50–200 points (stabilité)

2. **Vérifier les résultats**
   - Si aucun match : zéro résultat → le pattern n'existe pas
   - Si peu de matches : pattern trop spécifique
   - Si beaucoup de matches : pattern générique

3. **Vérifier la distribution**
   - **>80% excellent** → excellent pattern, à sauvegarder
   - **<50% excellent** → pattern peu discriminant, à rejeter

### 🎯 Utiliser les filtres efficacement

- **Vous cherchez un cycle parfait ?** → mettez 80% minimum
- **Vous acceptez des variations ?** → mettez 50% minimum
- **Vous voulez comparer 2 patterns** → sauvegardez-les d'abord

### 💾 Stratégie de sauvegarde

1. **Analysez plusieurs cycles** dans le historique
2. **Pour chaque cycle** : sauvegardez si ≥80% excellent
3. **Dans la bibliothèque** : consultez la répartition pour valider
4. **Supprimez les mauvais** : gardez seulement les patterns fiables

### ⚙️ Gestion des pages

- **Chaque page = 50 000 points**
- **~36 pages** pour l'historique complet (~1,8M points)
- **Naviguez** pour explorer des période différentes

### 🔍 Interprétation des stats

| Stat | Signification | Action |
|---|---|---|
| **Moyenne haute** | Cycle à haute puissance | Inutile pour basse puissance |
| **Écart-type bas** | Cycle très régulier | Bon pour les alarmes |
| **Amplitude grande** | Gros écart min/max | Vérifie si c'est normal |
| **Durée longue** | Cycle lent | Attention aux seuils temps |

### 🚨 Dépannage

**Aucun resultat trouvé dans ma recherche ?**
- La zone est trop courte (<10 points) → agrandissez-la
- Le pattern n'existe pas dans l'historique → essayez une autre zone
- Les données sont trop bruitées → choisissez une zone plus stable

**Le graphe est vide ou blanc ?**
- Attendez le chargement initial (~2–3 sec)
- Naviguez vers une autre page
- Rafraîchissez la page (F5)

**Un pattern ne s'affiche pas dans la Bibliothèque ?**
- Cliquez "Rafraîchir" en haut à droite
- Vérifiez que la sauvegarde a réussi (message vert)

**Beaucoup de patterns "Faible (<50%)" dans la répartition ?**
- Le pattern est **peu discriminant** : trop générique
- À supprimer pour ne garder que les patterns pertinents

---

## Raccourci clavier & astuces

| Action | Résultat |
|---|---|
| **Entrée** (dans champ page) | Aller à la page |
| **Drag sur graphe** | Sélectionner un pattern |
| **Clic pattern card** | Voir le pattern en détail / naviguer vers lui |
| **"Rafraîchir"** bibliothèque | Recharger la liste (après sauvegarde) |

---

## Questions fréquentes

**Q: Combien de temps prend une recherche ?**  
A: Généralement 0.5–2 sec selon la taille du pattern et du historique.

**Q: Peux-tu sauvegarder plusieurs fois le même pattern ?**  
A: Oui, mais ils auront des IDs différents. Utilisez des noms distincts (ex: "Cycle-V1", "Cycle-V2").

**Q: Peut-on exporter les patterns sauvegardés ?**  
A: Actuellement, non. La bibliothèque est stockée en base de données locale (SQLite).

**Q: Comment supprimer tous les patterns ?**  
A: Allez dans la Bibliothèque et supprimez-les un par un.

**Q: Puis-je comparer 2 patterns directement ?**  
A: Sauvegardez-les d'abord, puis comparez leurs stats dans la vue détail.

---

## Support

Pour toute question ou problème :
- Vérifiez que backend ET frontend sont lancés
- Vérifiez les URL : backend `http://127.0.0.1:8000`, frontend `http://localhost:3000`
- Checkez la console du navigateur (F12) pour voir les erreurs

Bon analyse ! 🚀
