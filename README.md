# Poste du DG — USHL Pro

Tableau de bord de direction générale pour la ligue simulée USHL Pro
(simulateur FHL, [ushl.ca](https://ushl.ca)). Page statique, sans étape de
build ni dépendance à l'exécution : elle s'héberge telle quelle (GitHub Pages).

**Les 32 clubs sont servis par la même page.** À la première ouverture elle se
présente aux Maple Leafs de Toronto ; dans *Réglages → Mon club*, chaque DG
choisit le sien et la page bascule sur sa formation et prend ses couleurs. Le
choix est conservé dans le navigateur.

Adapté du tableau de bord des Sharks de San Jose
([merciermathieu5/Sharks](https://github.com/merciermathieu5/Sharks)).

## Les sections

| Section | Sous-vues | Ce qu'on y trouve |
|---|---|---|
| **Mon club** | Formation · Production · Plafond | Les alertes du *Bureau du DG* (plafond, contrats échus ou qui expirent, joueurs sous les attentes, gardiens près de leur limite) et un sommaire commun : fiche, masse, effectif. **Formation** : cotes, contrats, profils, blessures et suspensions, bouton *Prolonger* (charte des re-signatures Y22), export CSV, transferts locaux. **Production** : statistiques de la saison, patineurs et gardiens, triables. **Plafond** : masse engagée sur 5 saisons. |
| **Progression** | — | Cartes d'attentes par joueur : seuils des matrices officielles (article 6.2.6) selon le profil et l'overall, statuts, ModA / ModS, fourchette de recote. |
| **Trios** | — | Quatre trios, trois paires, gardiens et unités spéciales ; remplissage par OV, export texte. |
| **Ligue** | Classement · Joueurs · Recotes | **Classement** officiel par ligue, association ou section. **Joueurs** : une seule table pour le dépistage et les meneurs — mêmes filtres (équipe, position, profil, OV, âge, contrat), colonnes *Cotes et contrats* ou *Statistiques*. **Recotes** : évolution de chaque cote depuis la fin Y21, classement des 32 équipes. |
| **Échange** | — | Analyseur d'échange : impact sur la masse (3 saisons), l'OV et l'âge du club. |
| **Analyse** | Comparateur · OV détaillé | Deux joueurs côte à côte avec centiles ; calcul de l'OV au centième et permutations de profil. |
| **Réglages** | — | Club du DG, état et provenance des données, matrices d'attentes, cibles individuelles. |

L'adresse suit la navigation (`#ligue/joueurs`) : un lien ou un rechargement
revient au même endroit. L'application est une **PWA** : installable, elle
s'ouvre hors ligne avec les dernières données vues.

## Données

Le site de la ligue expose une **API JSON** qui accepte les requêtes directes
d'un navigateur. C'est la source principale :

| Donnée | Source | Chemin |
|---|---|---|
| Alignements, cotes, contrats, blessures des 32 équipes | `api/?api=search` | direct |
| Statistiques des patineurs et des gardiens | `api/?api=stats` | direct |
| Classement officiel (points, BP/BC, séries, sections) | `Standings.php` | relais ou relevé |
| Minutes jouées | `USHLxtrastats.html` | relais ou relevé |
| Historique des attributs d'un joueur, matrices | pages du site | relais, à la demande |
| Limites d'utilisation des gardiens | [gestiongardiens](https://merciermathieu5.github.io/gestiongardiens/limites.json) | direct |

À l'ouverture :

1. **Le relevé intégré** (`data/releve.js`) s'affiche immédiatement — ou la
   dernière lecture conservée dans le navigateur, si elle est plus récente.
2. **Trois requêtes simultanées à l'API** remplacent le tout par les chiffres
   du moment, en une seconde environ. Aucun intermédiaire.
3. Les deux pages sans API (classement, XtraStats) sont demandées à des relais
   publics, tous **en course** — le premier qui répond gagne. Si aucun ne
   répond, le relevé intégré fournit déjà ces données ; rien n'est bloqué.
   Sans classement officiel à jour, les fiches V-D-N sont calculées des
   décisions des gardiens.

La pastille de l'en-tête dit d'où viennent les chiffres : verte (en direct),
jaune (relevé ou dernière lecture), rouge (ushl.ca injoignable). Ce qui est lu
est conservé sous forme compacte (~120 ko), jamais en pages HTML.

### Le relevé intégré

```bash
npm run releve
```

`scripts/releve.js` lit ushl.ca (Node 18+, sans dépendance) et régénère
`data/releve.js`. L'action GitHub `.github/workflows/releve.yml` le fait toutes
les trois heures et n'enregistre que si les données ont changé. Si le site ne
répond pas ou renvoie une ligue incomplète, le fichier précédent est conservé.

### Par club, par navigateur

Les prolongations, les trios et les transferts locaux sont enregistrés sous le
code du club. Les matrices et les données de la ligue sont communes à tous.

## Organisation du code

```
index.html              balisage seulement
css/style.css
js/config.js            clubs, configuration, clés de stockage
js/reglements.js        profils, matrices, modificateurs (règlements USHL)
js/ushl.js              lecture de ushl.ca : adresses, API, classement, XtraStats
                        (partagé avec scripts/releve.js)
js/moteur.js            formats, parseurs des matrices et des fiches, attentes
js/etat.js              état de l'application, modèle de la ligue, production
js/sources.js           réseau : API directe, relais, actualisation
js/ui.js                outils d'interface, navigation, en-tête
js/contrats.js          charte salariale, masse
js/vues/*.js            une vue par fichier
js/app.js               branchements et ouverture
data/releve.js          relevé de ushl.ca (généré)
data/s21.js             base de fin de saison S21 (suivi des recotes)
scripts/releve.js       génère data/releve.js
test/                   harnais jsdom et relevé figé
```

## Tests

Harnais jsdom qui charge la vraie page sur un relevé figé et vérifie moteur,
lecture de l'API, actualisation, charte salariale, navigation, le choix du club
et chaque vue (850+ vérifications) :

```bash
npm install
npm test
```

## Déploiement

GitHub Pages, sans étape de build : *Settings → Pages → Deploy from a branch*,
branche par défaut, dossier `/ (root)`.
