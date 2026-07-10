# Maple Leafs de Toronto — Tableau de bord du DG (USHL Pro)

Poste de direction générale des **Maple Leafs de Toronto** dans la ligue simulée
USHL Pro (simulateur FHL, [ushl.ca](https://ushl.ca)). Un seul fichier
`index.html`, aucun build, aucune dépendance à l'exécution : ouvre-le dans un
navigateur ou héberge-le tel quel (GitHub Pages).

Adapté du tableau de bord des Sharks de San Jose
([merciermathieu5/Sharks](https://github.com/merciermathieu5/Sharks)), avec de
nouveaux outils et les couleurs du club (bleu `#00205B` et blanc).

## Les onglets

| Onglet | Ce qu'il fait |
|---|---|
| **Alignement** | Cotes, salaires, contrats et profils des 25 joueurs, triables par colonne. Filtre par nom / position / profil, export CSV, masse salariale sous le plafond de 104 M$, et bouton **Prolonger** (charte officielle des re-signatures Y22) pour les contrats échus. |
| **Production** | Pointage de la saison en cours (TeamScoring), enrichi des minutes et mises en échec de XtraStats. |
| **Progression** | Cartes d'attentes par joueur : seuils des matrices officielles (article 6.2.6, recote été 2022) selon le profil et l'overall, statuts (Mémorable → À oublier), ModA / ModS et fourchette de recote probable. Cibles Mémorable personnalisables. |
| **Comparateur** | *(nouveau)* Deux joueurs côte à côte : les 13 cotes + OV en barres miroir, profil, contrat, ModA, statistiques évaluées. |
| **Plafond** | *(nouveau)* Projection de la masse engagée sur 5 saisons selon les contrats en cours (et les prolongations enregistrées), avec la liste des contrats qui expirent chaque saison. |
| **OV détaillé** | Reproduit au centième l'overall du simulateur à partir des 13 cotes (pondérations calibrées sur les 697 patineurs de la ligue). |
| **Réglages** | Éditeur des matrices d'attentes (rangées personnalisées, export/import JSON), gestion du cache et sources. |

## Données

- **En direct** : le bouton *Actualiser depuis ushl.ca* télécharge
  `TeamRosters.php?team=TORONTO`, `TeamScoring.php?team=TORONTO` et
  `USHLxtrastats.html` via une chaîne de relais anti-CORS, avec validation de
  l'équipe reçue (le serveur de la ligue sert parfois la dernière équipe
  consultée) et cache local (formation 12 h, production 30 min).
- **Hors ligne** : l'alignement de secours provient des fichiers FHL officiels
  de la ligue (`USHL21.ros`, recote Y22 — dépôt FHL-analyse). L'OV des
  patineurs y est calculé par la formule du calculateur ; celui des gardiens
  est une **estimation** (affichée `~82`) remplacée par la valeur réelle à la
  première actualisation.
- Les limites d'utilisation des gardiens proviennent du projet
  [gestiongardiens](https://merciermathieu5.github.io/gestiongardiens/limites.json).

## Tests

Harnais jsdom qui charge la vraie page et vérifie moteur, parseurs, charte
salariale, fenêtres et les nouveaux outils (335+ vérifications) :

```bash
npm install
npm test
```

## Déploiement

GitHub Pages, sans étape de build : *Settings → Pages → Deploy from a branch*,
branche par défaut, dossier `/ (root)`. La page est servie telle quelle.
