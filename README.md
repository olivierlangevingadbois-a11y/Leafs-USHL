# Poste du DG — USHL Pro

Tableau de bord de direction générale pour la ligue simulée USHL Pro
(simulateur FHL, [ushl.ca](https://ushl.ca)). Un seul fichier `index.html`,
aucun build, aucune dépendance à l'exécution : ouvre-le dans un navigateur ou
héberge-le tel quel (GitHub Pages).

**Les 32 clubs sont servis par la même page.** À la première ouverture elle se
présente aux Maple Leafs de Toronto ; dans *Réglages → Mon club*, chaque DG
choisit le sien et la page bascule sur sa formation et prend ses couleurs. Le
choix est conservé dans le navigateur, donc deux DG qui ouvrent la même adresse
sur leurs appareils respectifs voient chacun son club.

Adapté du tableau de bord des Sharks de San Jose
([merciermathieu5/Sharks](https://github.com/merciermathieu5/Sharks)), avec de
nouveaux outils.

## Les onglets

| Onglet | Ce qu'il fait |
|---|---|
| **Alignement** | Cotes, salaires, contrats et profils des joueurs du club, triables par colonne. Filtre par nom / position / profil, export CSV, masse salariale sous le plafond de 104 M$, et bouton **Prolonger** (charte officielle des re-signatures Y22, incluant la règle du 87+ : +2,5 M$ par OV au-dessus du sommet de la charte) pour les contrats échus. |
| **Production** | Pointage de la saison en cours (TeamScoring), enrichi des minutes et mises en échec de XtraStats. |
| **Progression** | Cartes d'attentes par joueur : seuils des matrices officielles (article 6.2.6, recote été 2022) selon le profil et l'overall, statuts (Mémorable → À oublier), ModA / ModS et fourchette de recote probable. Cibles Mémorable personnalisables. |
| **Ligue** | *(nouveau)* Dépistage : les 609 joueurs des 32 équipes, triables et filtrables (nom, équipe, position, profil, OV min, âge max, contrats qui expirent). |
| **Meneurs** | *(nouveau)* Classements de toute la ligue (points, buts, MEÉ, minutes…) tirés de XtraStats, filtres position et «mon club». |
| **Classement** | *(nouveau)* Fiches V-D-N relevées des pages téléchargées, classées aux points ; bouton pour ramasser les 32 fiches d'un coup. |
| **Échange** | *(nouveau)* Analyseur d'échange : sortants/entrants, impact sur la masse (3 saisons), l'OV et l'âge du club. |
| **Recotes** | *(nouveau)* Évolution de chaque cote depuis la fin Y21 (783 joueurs recensés), OV avant→après, tri par gain. |
| **Trios** | *(nouveau)* Bâtisseur d'alignement : quatre trios, trois paires, gardiens et unités spéciales (2 AN, 2 IN), avec OV moyen par unité, remplissage automatique par OV, détection des doublons, sauvegarde locale et export texte prêt à coller. |
| **Comparateur** | *(nouveau)* Deux joueurs de **n'importe quelles équipes de la ligue** côte à côte : les 13 cotes + OV en barres miroir, profil, contrat, ModA, statistiques évaluées. Les 32 équipes sont intégrées depuis le relevé du site. |
| **Plafond** | *(nouveau)* Projection de la masse engagée sur 5 saisons selon les contrats en cours (et les prolongations enregistrées), avec la liste des contrats qui expirent chaque saison. |
| **OV détaillé** | Reproduit au centième l'overall du simulateur à partir des 13 cotes (pondérations calibrées sur les 697 patineurs de la ligue). Charge les cotes de n'importe quel patineur de n'importe quelle équipe. |
| **Réglages** | Choix du club du DG, éditeur des matrices d'attentes (rangées personnalisées, mise à jour depuis la page officielle, export/import JSON), instantané de la ligue, gestion du cache et sources. |

Le tableau **Alignement** s'ouvre sur le *Bureau du DG* : alertes plafond,
contrats échus ou qui expirent, joueurs sous les attentes, gardiens près de
leur limite de parties. Le comparateur affiche aussi le **centile** de chaque
cote dans la ligue. L'application est une **PWA** : installable, s'ouvre hors
ligne, et s'actualise depuis ushl.ca à chaque ouverture.

## Données

- **En direct** : le bouton *Actualiser depuis ushl.ca* télécharge
  `TeamRosters.php` et `TeamScoring.php` pour le club choisi, plus
  `USHLxtrastats.html`, via une chaîne de relais anti-CORS, avec validation de
  l'équipe reçue (le serveur de la ligue sert parfois la dernière équipe
  consultée) et cache local (formation 12 h, production 30 min).
- **Autres équipes** : dès qu'une équipe est consultée au comparateur ou au
  calculateur d'OV, son `TeamRosters.php` est téléchargé en direct (validé,
  mis en cache 12 h) et remplace l'instantané intégré — les cotes suivent
  donc les recotes de la ligue. Hors ligne, l'instantané des fichiers FHL
  demeure, avec sa date affichée.
- **Hors ligne** : la page embarque le relevé complet du site (32 équipes,
  609 joueurs), duquel est tirée la formation de départ du club choisi. Elle
  embarque aussi l'état de fin de saison S21 tiré des fichiers FHL officiels
  (`USHL21.ros` — dépôt FHL-analyse), qui sert de base « avant » au suivi des
  recotes et de dernier recours pour une équipe qui manquerait à un relevé
  futur ; l'OV des gardiens y est une **estimation** (affichée `~82`).
- **Par club** : les prolongations, les trios et les transferts locaux sont
  enregistrés sous le code du club. Les matrices, la cache et l'instantané de
  la ligue sont communs à tous.
- Les limites d'utilisation des gardiens proviennent du projet
  [gestiongardiens](https://merciermathieu5.github.io/gestiongardiens/limites.json).

## Tests

Harnais jsdom qui charge la vraie page et vérifie moteur, parseurs, charte
salariale, fenêtres, le choix du club et les nouveaux outils (730+
vérifications, dont deux pages ouvertes pour deux DG différents) :

```bash
npm install
npm test
```

## Déploiement

GitHub Pages, sans étape de build : *Settings → Pages → Deploy from a branch*,
branche par défaut, dossier `/ (root)`. La page est servie telle quelle.
