/* Harnais de validation — Maple Leafs de Toronto (jsdom) */
const fs = require('fs');
const path = require('path');
const {JSDOM} = require('jsdom');

let total = 0, echecs = 0;
function ok(cond, msg){
  total++;
  if (!cond){ echecs++; console.error('  ✗ ' + msg); }
}
function egal(a, b, msg){ ok(a===b, msg + ` (obtenu: ${JSON.stringify(a)}, attendu: ${JSON.stringify(b)})`); }
function proche(a, b, tol, msg){ ok(a!==null && a!==undefined && Math.abs(a-b)<=tol, msg + ` (obtenu: ${a}, attendu: ~${b})`); }
function tableauEgal(a, b, msg){ ok(JSON.stringify(a)===JSON.stringify(b), msg + ` (obtenu: ${JSON.stringify(a)}, attendu: ${JSON.stringify(b)})`); }

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

(async () => {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://example.org/',
    pretendToBeVisual: true,
    beforeParse(window){
      window.__TML_SANS_AUTO__ = true; // pas d'actualisation automatique en test
      window.fetch = () => Promise.reject(new Error('réseau désactivé en test'));
    }
  });
  // neutraliser fetch (aucun réseau pendant les tests)
  dom.window.fetch = () => Promise.reject(new Error('réseau désactivé en test'));
  await new Promise(r => setTimeout(r, 300));
  const W = dom.window;
  const S = W.__TML__;

  console.log('— Chargement');
  ok(!!S, 'API de test exposée (__TML__)');
  if (!S){ console.error('Arrêt.'); process.exit(1); }

  console.log('— Données de secours (fichiers FHL de la ligue, recote Y22)');
  egal(S.SECOURS_ROSTER.length, 25, '25 joueurs dans la formation de secours');
  egal(S.SECOURS_ROSTER.filter(j=>j.backup).length, 0, 'Aucun joueur Backup_ dans la formation TORONTO');
  const hayton = S.SECOURS_ROSTER.find(j => j.nom === 'Barrett Hayton');
  egal(hayton.salaire, 7250000, 'Salaire Hayton');
  egal(hayton.ct, 3, 'Contrat Hayton 3 ans');
  egal(hayton.no, 22, 'Numéro de chandail de Hayton');
  const bedard = S.SECOURS_ROSTER.find(j => j.nom === 'Connor Bedard');
  egal(bedard.age, 20, 'Bedard a 20 ans (catégorie junior)');
  const gibson = S.SECOURS_ROSTER.find(j => j.nom === 'Chris Gibson');
  egal(gibson.ov, 82, 'OV estimé de Gibson (gardien) = 82');
  egal(gibson.ovEstime, true, 'L\'OV des gardiens de secours porte le drapeau ovEstime');
  ok(S.SECOURS_ROSTER.filter(j=>j.po!=='G').every(j=>!j.ovEstime), 'L\'OV des patineurs n\'est pas marqué estimé');
  egal(gibson.df, null, 'DF du gardien = null');
  egal(S.SECOURS_Y21.length, 0, 'Aucun total Y21 intégré (compteurs de la ligue remis à zéro) — la référence vient de XtraStats');

  console.log('— Moteur de profils (tableaux 10-11-12) et matrices associées');
  const joueurDe = nom => S.SECOURS_ROSTER.find(j => j.nom === nom);
  const profilDe = nom => S.determinerProfil(joueurDe(nom));
  egal(profilDe('Filip Zadina').profil, 'Elite', 'Zadina → Elite');
  egal(profilDe('Filip Zadina').mat, 'ELITE', 'Zadina → matrice ELITE');
  tableauEgal(profilDe('Filip Zadina').stats, ['shotpct','gwg','ppg','pts','pmrang'],
    'Stats évaluées Elite = tableau 20 (PCTG, GWG, PP, P, +/-)');
  egal(profilDe('Barrett Hayton').profil, 'Playmaker', 'Hayton → Playmaker');
  tableauEgal(profilDe('Barrett Hayton').stats, ['assists','pts'], 'Stats Playmaker = A, P');
  egal(profilDe('Paul Cotter').profil, 'Grinder', 'Cotter → Grinder');
  egal(profilDe('Evan Rodrigues').profil, 'Two-Way Forward', 'Rodrigues → Two-Way Forward');
  egal(profilDe('Connor Bedard').profil, 'Junior Elite', 'Bedard (20 ans) → Junior Elite');
  egal(profilDe('Connor Bedard').mat, 'ELITE', 'Junior Elite → même matrice ELITE');
  egal(profilDe('Matvei Michkov').profil, 'Prospect Elite', 'Michkov (21 ans) → Prospect Elite');
  egal(profilDe('Rutger McGroarty').profil, 'Prospect Power Forward', 'McGroarty → Prospect Power Forward');
  egal(profilDe('Rutger McGroarty').mat, 'POWERFWD', 'Prospect Power Forward → matrice POWERFWD');
  egal(profilDe('Ryan Merkley').profil, 'DEliteQB', 'Merkley → DEliteQB');
  egal(profilDe('Chris Bigras').profil, 'DEliteShutdown', 'Bigras → DEliteShutdown');
  egal(profilDe('Travis Sanheim').profil, 'DEliteShutdown', 'Sanheim → DEliteShutdown');
  egal(profilDe('Eamon Powell').profil, 'Prospect DEliteQB', 'Powell (23 ans) → Prospect DEliteQB');
  egal(profilDe('Chris Gibson').profil, 'Starter Goalie', 'Gibson (OV 82) → Starter Goalie');
  tableauEgal(profilDe('Chris Gibson').stats, ['hs','svpct','qggp','ming'], 'Stats Starter = HS, SV%, DQ/M, MIN');
  egal(profilDe('Scott Wedgewood').profil, 'Backup Goalie', 'Wedgewood (OV 78) → Backup Goalie');
  tableauEgal(profilDe('Scott Wedgewood').stats, ['mp','qggp','psv'], 'Stats Backup = MP, DQ/M, Psv');

  console.log('— Matrices Y17 (article 6.2.6) : consultation par overall');
  egal(Object.keys(S.MATRICES).length, 15, '15 matrices de profils');
  const nbStats = Object.values(S.MATRICES).reduce((a,m)=>a+Object.keys(m).length,0);
  egal(nbStats, 40, '40 tableaux de seuils au total');
  tableauEgal(S.seuilsMatrice('ELITE','pts',82), [97,86,74,63,37,-1], 'Elite points OV 82');
  tableauEgal(S.seuilsMatrice('ELITE','pts',70), [23,20,17,15,9,-1], 'OV 70 ramené au rang 73');
  tableauEgal(S.seuilsMatrice('ELITE','pts',95), [117,104,90,77,45,-1], 'OV 95 ramené au rang 90');
  tableauEgal(S.seuilsMatrice('DELITEQB','ppg',80), [3,2,1,0,-1,-5], 'DElite QB buts en PP OV 80');
  tableauEgal(S.seuilsMatrice('STARTER','ming',85), [0.98,0.91,0.84,0.77,0.64,-1], 'Starter MIN (ratio) constant');
  tableauEgal(S.seuilsMatrice('BACKUP','psv',78), [908,899,890,881,872,-1], 'Backup Psv OV 78');
  tableauEgal(S.seuilsMatrice('GRINDER','hits20',77), [2.55,2.35,2.15,1.95,1.75,-1], 'Grinder MEÉ/20 OV 77');
  egal(S.seuilsMatrice('ELITE','inexistante',80), null, 'Statistique inconnue → null');

  console.log('— Statuts (tableau 18) : un degré exige de DÉPASSER STRICTEMENT son seuil');
  const sE82 = S.seuilsMatrice('ELITE','pts',82); // [97,86,74,63,37,-1]
  egal(S.statutSelonSeuils(97.5, sE82), 'memorable', '97,5 pts > 97 → Mémorable');
  egal(S.statutSelonSeuils(97,   sE82), 'excellente', '97 pts = seuil Mémorable → Excellente (pas de Mémorable sans dépasser)');
  egal(S.statutSelonSeuils(87,   sE82), 'excellente', '87 pts → Excellente');
  egal(S.statutSelonSeuils(75,   sE82), 'satisfaisante', '75 pts → Satisfaisante');
  egal(S.statutSelonSeuils(74,   sE82), 'correcte', '74 pts = seuil Satisfaisante → Correcte');
  egal(S.statutSelonSeuils(64,   sE82), 'correcte', '64 pts → Correcte');
  egal(S.statutSelonSeuils(38,   sE82), 'decevante', '38 pts → Décevante');
  egal(S.statutSelonSeuils(37,   sE82), 'oublier', '37 pts = seuil Décevante → À oublier');
  egal(S.statutSelonSeuils(null, sE82), 'indef', 'Valeur absente → à définir');
  egal(S.statutSelonSeuils(50, [60,null,null,null,null,null]), 'sousmemo', 'Seule cible Mémorable connue, non dépassée → sous le Mémorable');

  console.log('— Évaluation des totaux tels quels (aucune projection : facteur karma)');
  let ev = S.evaluerStat('pts', 98, sE82);
  egal(ev.valeur, 98, 'La valeur évaluée est le total courant, sans mise à l\'échelle');
  egal(ev.statut, 'memorable', '98 pts → Mémorable');
  egal(ev.mods, 60, 'ModS +60 pour un Mémorable');
  ev = S.evaluerStat('pts', 40, sE82);
  egal(ev.statut, 'decevante', '40 pts → Décevante');
  egal(ev.mods, -20, 'ModS -20 pour une Décevante');
  ev = S.evaluerStat('shotpct', 15.2, S.seuilsMatrice('ELITE','shotpct',82));
  egal(ev.statut, 'excellente', 'PCTG 15,2 sur seuils OV 82 → Excellente');
  ev = S.evaluerStat('pts', null, sE82);
  egal(ev.statut, 'indef', 'Sans valeur → à définir');

  console.log('— Statistiques dérivées');
  const prod = {gp:20, goals:10, shots:80, hits:60, mp:400, qs:8, svpct:0.905, pts:25};
  const jTest = {nom:'Test Joueur', po:'C'};
  proche(S.valeurStat(jTest, prod, 'shotpct'), 12.5, 1e-9, '%T = 10/80 = 12,5');
  proche(S.valeurStat(jTest, prod, 'hits20'), 3, 1e-9, 'MEÉ/20 = 60/(400/20) = 3');
  proche(S.valeurStat(jTest, prod, 'shots20'), 4, 1e-9, 'T/20 = 80/(400/20) = 4');
  proche(S.valeurStat(jTest, prod, 'mg'), 20, 1e-9, 'MIN/M = 400/20');
  proche(S.valeurStat(jTest, prod, 'qggp'), 0.4, 1e-9, 'DQ/M = 8/20');
  proche(S.valeurStat(jTest, prod, 'psv'), 905, 1e-9, 'Psv = %A × 1000');
  egal(S.valeurStat(jTest, prod, 'pts'), 25, 'Stat directe inchangée');
  const ctx = {limites: new Map([[S.normaliserNom('Test Joueur'), 62]])};
  proche(S.valeurStat(jTest, {gp:15}, 'ming', ctx), 15/62, 1e-9, 'MIN gardien = parties jouées / limite (ratio brut)');
  egal(S.valeurStat(jTest, {gp:15}, 'ming', {limites:new Map()}), null, 'Sans limite connue → à définir');

  console.log('— Rang du différentiel dans le club (tableau 20)');
  const rangs = S.calculerPmRangs([
    {nom:'Aa', gp:5, plusminus:5},
    {nom:'Bb', gp:5, plusminus:0},
    {nom:'Cc', gp:5, plusminus:-3},
    {nom:'Dd', gp:0, plusminus:9}   // exclu : aucun match
  ]);
  proche(rangs.get(S.normaliserNom('Aa'))?.prop, 1, 1e-9, 'Meilleur +/- → proportion 1,00');
  egal(rangs.get(S.normaliserNom('Aa'))?.rang, 1, 'Meilleur +/- → 1er rang');
  proche(rangs.get(S.normaliserNom('Bb'))?.prop, 0.5, 1e-9, 'Milieu → 0,50');
  egal(rangs.get(S.normaliserNom('Bb'))?.rang, 2, 'Milieu → 2e rang');
  proche(rangs.get(S.normaliserNom('Cc'))?.prop, 0, 1e-9, 'Dernier → 0,00');
  egal(rangs.get(S.normaliserNom('Cc'))?.total, 3, 'Classement sur 3 patineurs qualifiés');
  ok(!rangs.has(S.normaliserNom('Dd')), 'Joueur sans match exclu du classement');

  console.log('— Automatisation du rang +/- à l\'arrivée des statistiques (bout en bout)');
  {
    const ETAT2 = S.ETAT;
    const avantScoring2 = ETAT2.scoring, avantY212 = ETAT2.xtraEstY21;
    // dès que TeamScoring fournit des patineurs avec un différentiel, le rang se calcule seul
    const patineursRoster = S.SECOURS_ROSTER.filter(x9=>x9.po!=='G' && !x9.backup);
    const scoringFictif = patineursRoster.map((x9,i9)=>({
      nom:x9.nom, gp:10, goals:i9%4, assists:i9%5, pts:(i9%4)+(i9%5), shots:20+i9,
      pim:2, plusminus:(patineursRoster.length-1)/2 - i9, ppg:1, gwg:1
    }));
    ETAT2.scoring = {patineurs:scoringFictif, gardiens:[]};
    ETAT2.xtraEstY21 = true;
    const rangsAuto = S.calculerPmRangs(ETAT2.scoring.patineurs);
    egal(rangsAuto.size, patineursRoster.length, 'Tous les patineurs qualifiés sont classés automatiquement');
    const meilleur = patineursRoster[0];
    const rMeilleur = rangsAuto.get(S.normaliserNom(meilleur.nom));
    egal(rMeilleur?.rang, 1, 'Le meilleur différentiel du club obtient le 1er rang');
    proche(S.valeurStat(meilleur, {gp:10}, 'pmrang', {pmRangs:rangsAuto}), 1, 1e-9,
      'valeurStat lit la proportion de rang sans intervention');
    // un joueur évalué sur le rang +/- reçoit un statut réel dans l'interface re-rendue
    const jPm = ETAT2.roster.find(x9=>x9._profil?.stats?.includes('pmrang') && !x9.backup);
    ok(!!jPm, 'Au moins un joueur du club est évalué sur le rang +/-');
    if (jPm){
      W.document.querySelector('#progFiltres button[data-f="tous"]').click(); // force le re-rendu
      const carte = [...W.document.querySelectorAll('#progGrille .joueur-carte')]
        .find(c=>c.querySelector('.jc-nom').textContent===jPm.nom);
      ok(!!carte, 'Carte du joueur rendue avec la production fictive');
      const lignePm = [...(carte?.querySelectorAll('.stat-ligne')||[])]
        .find(l=>l.querySelector('.nom-stat').textContent.includes('Rang +/-'));
      ok(!!lignePm, 'Ligne «Rang +/- au club» présente');
      ok(lignePm && !lignePm.querySelector('.badge-etat.indef'), 'Le rang +/- reçoit un statut (plus «à définir»)');
      ok(lignePm && /ᵉ\/\d+/.test(lignePm.textContent), 'Rang ordinal affiché (ex. 4ᵉ/18)');
    }
    ETAT2.scoring = avantScoring2; ETAT2.xtraEstY21 = avantY212;
    W.document.querySelector('#progFiltres button[data-f="tous"]').click(); // retour à l'état initial
  }

  console.log('— Validation de l\'équipe des pages téléchargées (session des relais)');
  {
    egal(S.CONFIG.equipe, 'TORONTO', 'Équipe configurée : TORONTO');
    ok(S.CONFIG.urls.roster.includes('team=TORONTO'), 'URL de formation pointée sur TORONTO');
    const bonne = 'menu de la ligue… ' + S.CONFIG.equipe + ' 3-2-0 … table des joueurs';
    ok(S.validerPageEquipe(bonne), 'Page de la bonne équipe acceptée (sa fiche s\'y trouve)');
    ok(!S.validerPageEquipe('menu de la ligue… ZZAUTRE 11-8-0 … table des joueurs'),
       'Page d\'une autre équipe rejetée (fiche du club absente) — sera réessayée, jamais mise en cache');
    egal(S.extraireFiche(bonne), S.CONFIG.equipe + ' 3-2-0', 'Fiche extraite de la page validée');
  }

  console.log('— Modificateurs (tableaux 17 et 19) et fourchette de recote');
  egal(S.modA({po:'C', age:25}), 5, 'Patineur 25 ans → ModA +5');
  egal(S.modA({po:'C', age:35}), -25, 'Patineur 35 ans → ModA -25');
  egal(S.modA({po:'G', age:29}), 5, 'Gardien 29 ans → ModA +5');
  egal(S.modA({po:'G', age:33}), -10, 'Gardien 33 ans → ModA -10');
  egal(S.convertirJet(146), 3, 'Jet 146 → +3 (recote plafonnée à +3)');
  egal(S.convertirJet(200), 3, 'Aucun jet ne dépasse +3');
  egal(S.convertirJet(121), 2, 'Jet 121 → +2');
  egal(S.convertirJet(100), 0, 'Jet 100 → 0');
  egal(S.convertirJet(51), -1, 'Jet 51 → -1');
  egal(S.convertirJet(10), -4, 'Jet 10 → -4');
  egal(S.convertirJet(-25), -5, 'Jet -25 → -5');
  const four = S.fourchetteRecote(hayton, 10); // 25 ans → ModA+5 → base 75
  egal(four.base, 75, 'Base = 60 + ModA(5) + ModS(10)');
  egal(four.min, 0, 'Pire jet (76) → 0');
  egal(four.max, 1, 'Meilleur jet (115) → +1');

  console.log('— Priorité des seuils : rangée personnalisée > Y17 ; surcharge = Mémorable seul');
  const jz = joueurDe('Filip Zadina'); // Elite, OV 83
  jz._profil = S.determinerProfil(jz);
  let s = S.seuilsPour(jz, 'pts', {}, {});
  tableauEgal(s.seuils, [97,86,74,63,37,-1], 'Seuils Y17 par défaut (OV 83)');
  egal(s.source, 'Y17', 'Source = Y17');
  const perso = {ELITE: {pts: {83: [100,90,80,70,40,-1]}}};
  s = S.seuilsPour(jz, 'pts', perso, {});
  tableauEgal(s.seuils, [100,90,80,70,40,-1], 'La rangée personnalisée remplace Y17');
  egal(s.source, 'personnalisée', 'Source = personnalisée');
  s = S.seuilsPour(jz, 'pts', {}, {[S.normaliserNom(jz.nom)]: {pts: 120}});
  egal(s.seuils[0], 120, 'La surcharge fixe le seuil Mémorable');
  egal(s.seuils[2], 74, 'Les autres degrés restent ceux de la matrice');

  console.log('— Parseur de formation (fixture HTML réaliste)');
  const fixtureRoster = `<html><body><table>
    <tr><th>Nom</th><th>PO</th><th>HD</th><th>CD</th><th>IJ</th><th>IN</th><th>SP</th><th>ST</th><th>EN</th><th>DU</th><th>DI</th><th>SK</th><th>PA</th><th>PC</th><th>DF</th><th>OF</th><th>EX</th><th>LD</th><th>OV</th><th>Age</th><th>Salary</th><th>CT</th><th>HT</th><th>WT</th><th>Lien</th></tr>
    <tr><td>Barrett Hayton</td><td>C</td><td>G</td><td>OK</td><td></td><td>71</td><td>86</td><td>81</td><td>87</td><td>81</td><td>77</td><td>82</td><td>80</td><td>79</td><td>64</td><td>79</td><td>62</td><td>43</td><td>82</td><td>25</td><td>7 250 000 $</td><td>3</td><td>6 ' 1</td><td>190 lbs</td><td>Lien</td></tr>
    <tr><td>Chris Gibson</td><td>G</td><td>G</td><td>OK</td><td></td><td>84</td><td>91</td><td>92</td><td>89</td><td>83</td><td>79</td><td>91</td><td>66</td><td>88</td><td>NA</td><td>NA</td><td>86</td><td>66</td><td>82</td><td>33</td><td>6 750 000 $</td><td>2</td><td>6 ' 1</td><td>191 lbs</td><td>Lien</td></tr>
    <tr><td></td><td></td><td></td><td></td><td></td><td>70</td><td>76</td><td>76</td><td>80</td><td>77</td><td>79</td><td>78</td><td>73</td><td>73</td><td>68</td><td>70</td><td>68</td><td>61</td><td>78</td><td>28</td><td>3 370 000 $</td><td>1,5</td><td>6 ' 1</td><td>195</td><td></td></tr>
  </table></body></html>`;
  const docR = new W.DOMParser().parseFromString(fixtureRoster, 'text/html');
  const joueurs = S.parseRoster(null, docR);
  egal(joueurs.length, 2, 'Deux joueurs extraits (rangée des moyennes ignorée)');
  egal(joueurs[0].nom, 'Barrett Hayton', 'Nom du premier joueur');
  egal(joueurs[0].salaire, 7250000, 'Salaire converti (espaces et $)');
  egal(joueurs[0].sc, 79, 'Colonne OF lue comme SC');
  egal(joueurs[1].df, null, 'DF du gardien = NA → null');

  console.log('— Parseur de pointage (fixture)');
  const fixtureScoring = `<html><body><table>
    <tr><th>Name</th><th>GP</th><th>G</th><th>A</th><th>PTS</th><th>+/-</th><th>PIM</th><th>PP</th><th>GW</th><th>S</th><th>PCT</th></tr>
    <tr><td>Connor Bedard</td><td>10</td><td>4</td><td>8</td><td>12</td><td>5</td><td>2</td><td>2</td><td>1</td><td>25</td><td>16.0</td></tr>
  </table><table>
    <tr><th>Name</th><th>GP</th><th>W</th><th>L</th><th>T</th><th>AVG</th><th>SV%</th><th>SO</th><th>HS</th></tr>
    <tr><td>Chris Gibson</td><td>6</td><td>4</td><td>2</td><td>0</td><td>2.31</td><td>0.915</td><td>1</td><td>2</td></tr>
  </table></body></html>`;
  const docS = new W.DOMParser().parseFromString(fixtureScoring, 'text/html');
  const sc = S.parseScoring(null, docS);
  egal(sc.patineurs.length, 1, 'Un patineur extrait');
  egal(sc.patineurs[0].pts, 12, 'Points de Bedard');
  egal(sc.patineurs[0].plusminus, 5, 'Différentiel de Bedard');
  egal(sc.gardiens.length, 1, 'Un gardien extrait');
  egal(sc.gardiens[0].w, 4, 'Victoires de Gibson');
  ok(Math.abs(sc.gardiens[0].avg - 2.31) < 1e-9, 'Moyenne de Gibson');
  egal(sc.gardiens[0].hs, 2, 'Colonne HS lue');

  console.log('— Parseur XtraStats (fixture texte)');
  const fixtureXtra = [
    '    Player                    Team            POS GP   G   A   P  Sh PiM   MP   H Sh/G',
    '    [Connor Bedard](https://x/#Connor Bedard) TORONTO         C   82  40  55  95 250  20 1700  60 3.05',
    '    [Alex Tuch](https://x/#Alex Tuch) ANAHEIM         RW  77  27  32  59 183  16 1503 243 2.38',
    '    [* Backup_RW](https://x/#Backup_RW) TORONTO         LW   3   0   0   0   0   0    0   0 0.00'
  ].join('\n');
  const x = S.parseXtra(fixtureXtra, 'TORONTO');
  egal(x.length, 2, 'Deux patineurs TORONTO extraits (Anaheim exclu)');
  egal(x[0].hits, 60, 'MEÉ de Bedard depuis XtraStats');
  egal(x[0].mp, 1700, 'Minutes de Bedard depuis XtraStats');

  console.log('— Rendu de l\'interface');
  const doc = W.document;
  const rangees = doc.querySelectorAll('#tableAlignement tbody tr');
  egal(rangees.length, 25, '25 rangées dans la table d\'alignement');
  {
    const ligneGibson = [...rangees].find(r=>r.textContent.includes('Chris Gibson'));
    ok(ligneGibson && ligneGibson.textContent.includes('~82'), 'OV estimé du gardien affiché avec un tilde (~82)');
  }
  ok(doc.querySelector('#alignSommaire').textContent.includes('Masse salariale'), 'Sommaire de masse salariale rendu');
  ok(doc.querySelector('#ficheEquipe').textContent.includes('TORONTO'), 'Fiche d\'équipe affichée');
  const cartes = doc.querySelectorAll('#progGrille .joueur-carte');
  ok(cartes.length >= 20, 'Cartes de progression rendues (' + cartes.length + ')');
  ok(doc.querySelector('#progGrille').textContent.includes('ModS estimé'), 'ModA / ModS affichés sur les cartes');
  ok(doc.querySelectorAll('#progGrille .att-input').length > 0, 'Champs de cible Mémorable présents');
  const selMatrice = doc.querySelector('#selMatrice');
  egal(selMatrice.options.length, 15, 'Sélecteur des 15 matrices peuplé');
  ok(doc.querySelector('#selStat').options.length >= 1, 'Sélecteur de statistique peuplé');
  const rangeesMat = doc.querySelectorAll('#tableMatrice tbody tr');
  egal(rangeesMat.length, 18, 'Éditeur : rangées OV 73 à 90');
  egal(doc.querySelectorAll('#tableMatrice tbody input').length, 108, 'Éditeur : 18 rangées × 6 degrés');
  ok(doc.querySelector('#tableMatrice thead').textContent.includes('Mémorable'), 'Colonnes des degrés de satisfaction');
  ok(doc.querySelector('#sourcesTexte').textContent.includes('limites.json'), 'Source limites.json documentée');
  ok(doc.querySelector('#sourcesTexte').textContent.includes('estimation'), 'L\'estimation de l\'OV des gardiens est documentée');
  const boutonDiff = doc.querySelector('#progFiltres button[data-f="difficulte"]');
  ok(!!boutonDiff, 'Filtre «En difficulté» présent');

  console.log('— Masse salariale (cohérence)');
  const actifs = S.SECOURS_ROSTER.filter(x2 => !x2.backup);
  const comptabilises = actifs.filter(x2 => x2.ct > 0);
  egal(comptabilises.length, 25, 'Les 25 joueurs TORONTO sont sous contrat');
  const masse = comptabilises.reduce((s2, x2) => s2 + x2.salaire, 0);
  egal(masse, 83571666, 'Masse salariale des 25 joueurs sous contrat = 83 571 666 $');
  ok(!doc.querySelector('#alignSommaire .stat-carte').classList.contains('alerte'), 'Sous le plafond de 104 M$ : aucune alerte');
  ok(doc.querySelector('#alignSommaire .stat-carte .det').textContent.replace(/\s/g,'').includes('104000000'), 'Plafond affiché = 104 000 000 $');

  console.log('— Charte salariale des re-signatures (Y22, cap 104 M)');
  // Salaires minimums transcrits de la charte (en dollars)
  egal(S.salaireMinimum(74, 'RFA', 25), 700000, 'RFA OV74- = 700 000 $');
  egal(S.salaireMinimum(82, 'RFA', 25), 8750000, 'RFA OV82 = 8 750 000 $');
  egal(S.salaireMinimum(90, 'RFA', 22), 25000000, 'RFA OV90 = valeur 87+ (17,5 M) + 3 × 2,5 M (règle du 87+)');
  egal(S.salaireMinimum(80, 'UFA', 30), 5000000, 'UFA OV80 34- = 5 000 000 $');
  egal(S.salaireMinimum(80, 'UFA', 36), 3250000, 'UFA OV80 35+ = 3 250 000 $ (tranche d\'âge)');
  egal(S.salaireMinimum(83, 'UFAR2', 32), 7500000, 'UFA Ronde 2 OV83 34- = 7 500 000 $');
  egal(S.salaireMinimum(85, 'SANS', 37), 6000000, 'Sans contrat OV85 35+ = 6 000 000 $');
  egal(S.salaireMinimum(70, 'RFA', 25), 700000, 'OV sous 74 → clamp au plancher (700 000 $)');
  // Règle du sommet de la charte : +2,5 M par OV au-dessus de 87
  egal(S.SURCHARGE_OV87, 2500000, 'Surcharge de 2 500 000 $ par OV au-dessus de 87');
  egal(S.salaireMinimum(87, 'UFA', 30), 15500000, 'OV 87 : sommet de la charte, aucune surcharge');
  egal(S.salaireMinimum(88, 'UFA', 30), 18000000, 'OV 88 UFA 34- : 15,5 M + 2,5 M');
  egal(S.salaireMinimum(89, 'UFA', 30), 20500000, 'OV 89 : +5 M au-dessus de la valeur 87+ (cas Bigras)');
  egal(S.salaireMinimum(88, 'UFA', 30, 1, 'G'), 15500000, 'Gardien OV 88 → échelon 87 : pas de surcharge');
  // Statut déduit de l'âge (règle retenue : 28- = RFA, sinon UFA)
  egal(S.statutResignature({age:28}), 'RFA', '28 ans → RFA');
  egal(S.statutResignature({age:29}), 'UFA', '29 ans → UFA');
  egal(S.statutResignature({age:22}), 'RFA', '22 ans → RFA');
  // Durées maximales par statut (charte)
  egal(S.dureeMaxCharte('RFA'), 7, 'RFA : durée max 7 ans');
  egal(S.dureeMaxCharte('UFA'), 4, 'UFA : durée max 4 ans');
  egal(S.dureeMaxCharte('UFAR2'), 2, 'UFA Ronde 2 : durée max 2 ans');
  egal(S.dureeMaxCharte('SANS'), 1, 'Sans contrat : durée 1 an');
  // Clé de charte avec tranche d'âge
  egal(S.cleCharte('UFA', 34), 'UFA_34', 'UFA 34 ans → colonne 34-');
  egal(S.cleCharte('UFA', 35), 'UFA_35', 'UFA 35 ans → colonne 35+');
  // Règle RFA : 1 à 7 saisons à la discrétion du DG, +1 échelon par année après 3
  egal(S.echelonEffectif(80, 'RFA', 3), 80, 'RFA 3 ans → échelon de base (OV 80)');
  egal(S.echelonEffectif(80, 'RFA', 4), 81, 'RFA 4 ans → échelon +1 (OV 81)');
  egal(S.echelonEffectif(80, 'RFA', 7), 84, 'RFA 7 ans → échelon +4 (OV 84)');
  egal(S.echelonEffectif(80, 'UFA', 4), 80, 'La règle d\'échelon ne touche pas les UFA');
  egal(S.salaireMinimum(80, 'RFA', 25, 1), 5750000, 'RFA OV80, 1 an = 5 750 000 $');
  egal(S.salaireMinimum(80, 'RFA', 25, 3), 5750000, 'RFA OV80, 3 ans = même minimum (5 750 000 $)');
  egal(S.salaireMinimum(80, 'RFA', 25, 4), 7500000, 'RFA OV80, 4 ans = échelon 81 (7 500 000 $)');
  egal(S.salaireMinimum(80, 'RFA', 25, 7), 12250000, 'RFA OV80, 7 ans = échelon 84 (12 250 000 $)');
  egal(S.salaireMinimum(86, 'RFA', 24, 7), 25000000, 'RFA OV86, 7 ans → échelon 90 = 17,5 M + 3 × 2,5 M (règle du 87+)');
  egal(S.salaireMinimum(80, 'UFA', 30, 4), 5000000, 'UFA OV80, 4 ans = minimum inchangé (5 000 000 $)');
  // Règle des gardiens : un échelon plus bas à la prolongation
  egal(S.echelonEffectif(83, 'UFA', 2, 'G'), 82, 'Gardien OV83 → échelon 82 (un échelon plus bas)');
  egal(S.echelonEffectif(83, 'UFA', 2, 'C'), 83, 'Patineur OV83 → échelon inchangé');
  egal(S.echelonEffectif(80, 'RFA', 5, 'G'), 81, 'Gardien RFA 5 ans : +2 (durée) −1 (gardien) = OV81');
  egal(S.salaireMinimum(83, 'UFA', 32, 2, 'G'), 7500000, 'Gardien UFA OV83 34- → minimum de l\'échelon 82 (7 500 000 $)');
  egal(S.salaireMinimum(83, 'UFA', 32, 2, 'C'), 8750000, 'Patineur UFA OV83 34- → minimum de son échelon (8 750 000 $)');
  egal(S.salaireMinimum(74, 'UFA', 30, 1, 'G'), 900000, 'Gardien OV74 → clamp au plancher de la charte');
  // Éligibilité : seuls les contrats échus (0 an) se prolongent
  egal(S.peutProlonger({ct:0, backup:false}), true, 'Contrat échu (0 an) → prolongeable');
  egal(S.peutProlonger({ct:1, backup:false}), false, 'Sous contrat (1 an) → NON prolongeable');
  egal(S.peutProlonger({ct:0, backup:true}), false, 'Backup → jamais prolongeable');
  // Format et parsing des montants
  egal(S.parseArgent('8,5 M'), 8500000, 'parseArgent «8,5 M» = 8 500 000');
  egal(S.parseArgent('900 k'), 900000, 'parseArgent «900 k» = 900 000');
  egal(S.parseArgent('7500000'), 7500000, 'parseArgent «7500000» = 7 500 000');
  egal(S.fmtArgentCourt(8500000), '8,5 M', 'fmtArgentCourt 8,5 M');
  egal(S.fmtArgentCourt(900000), '900 k', 'fmtArgentCourt 900 k');

  console.log('— Fenêtre «Prolongation de contrat» : éligibilité, ouverture, bornage, impact, retrait');
  W.localStorage.removeItem('tml_resignatures_v1');
  doc.querySelector('[data-vue="alignement"]')?.click();
  // Aucun joueur sous contrat n'offre de bouton : seuls les contrats échus (0 an) se prolongent
  const jSous = S.ETAT.roster.find(x=>!x.backup && x.ct > 0);
  ok(!!jSous, 'Au moins un joueur sous contrat dans le club');
  ok(![...doc.querySelectorAll('button.btn-prolong[data-nom]')].find(b=>b.dataset.nom===jSous.nom),
    'Joueur sous contrat : pas de bouton «Prolonger» (règle de la ligue)');
  S.ouvrirProlongation(jSous.nom);
  ok(!doc.getElementById('modalProlong') || doc.getElementById('modalProlong').hidden,
    'ouvrirProlongation refuse un joueur sous contrat (défense en profondeur)');
  // Muter un patineur à contrat échu pour tester la mécanique complète, puis restaurer
  const jMut = S.ETAT.roster.find(x=>!x.backup && x.po!=='G');
  const ctAvant = jMut.ct;
  jMut.ct = 0;
  doc.querySelector('#tableAlignement thead th[data-col="ov"]')?.click(); // re-rendu
  const btnP = [...doc.querySelectorAll('button.btn-prolong[data-nom]')].find(b=>b.dataset.nom===jMut.nom);
  ok(!!btnP, 'Contrat échu (0 an) : bouton «Prolonger» présent');
  egal(btnP.textContent.trim(), 'Prolonger', 'Libellé initial du bouton');
  const nomP = jMut.nom, cleP = S.normaliserNom(nomP);
  const statutP = S.statutResignature(jMut);
  btnP.click();                                   // ouvre la fenêtre
  const modal = doc.getElementById('modalProlong');
  ok(!!modal && !modal.hidden, 'La fenêtre de prolongation s\'ouvre au clic');
  egal(doc.getElementById('mpNom').textContent, nomP, 'Nom du joueur affiché dans la fenêtre');
  egal(doc.getElementById('mpStatut').value, statutP, 'Statut proposé = statut déduit de l\'âge');
  const dureeInitP = statutP === 'RFA' ? 3 : S.dureeMaxCharte(statutP);
  const minPD = S.salaireMinimum(jMut.ov, statutP, jMut.age, dureeInitP, jMut.po);
  egal(+doc.getElementById('mpDuree').value, dureeInitP, 'Durée proposée : 3 ans pour un RFA (dernier palier sans hausse), durée max sinon');
  egal(S.parseArgent(doc.getElementById('mpSalaire').value), minPD, 'Salaire pré-rempli au minimum de la charte pour cette durée');
  egal(doc.getElementById('mpDuree').options.length, S.dureeMaxCharte(statutP),
    'Durées offertes = 1 à la durée max du statut');
  ok(doc.getElementById('mpImpact').textContent.includes('Masse projetée'), 'Aperçu d\'impact sur la masse affiché');
  ok(doc.getElementById('mpRetirer').style.display === 'none', 'Bouton «Retirer» masqué pour un joueur non prolongé');
  // Le salaire proposé SUIT le minimum quand la durée change — à la hausse ET à la baisse
  {
    const selDureeP = doc.getElementById('mpDuree'), inSalP = doc.getElementById('mpSalaire');
    const min3 = S.salaireMinimum(jMut.ov, statutP, jMut.age, 3, jMut.po);
    const min4 = S.salaireMinimum(jMut.ov, statutP, jMut.age, 4, jMut.po);
    const min7 = S.salaireMinimum(jMut.ov, statutP, jMut.age, 7, jMut.po);
    selDureeP.value = '7'; selDureeP.dispatchEvent(new W.Event('change'));
    egal(S.parseArgent(inSalP.value), min7, 'Durée montée à 7 ans → salaire proposé monte au minimum de 7 ans');
    selDureeP.value = '3'; selDureeP.dispatchEvent(new W.Event('change'));
    egal(S.parseArgent(inSalP.value), min3, 'Durée redescendue à 3 ans → le salaire proposé REDESCEND au minimum (correction du bogue)');
    // une saisie manuelle du DG est respectée quand la durée change ensuite
    inSalP.value = '15 M'; inSalP.dispatchEvent(new W.Event('input'));
    selDureeP.value = '4'; selDureeP.dispatchEvent(new W.Event('change'));
    egal(S.parseArgent(inSalP.value), 15000000, 'Salaire saisi manuellement (15 M) conservé au changement de durée');
    ok(15000000 > min4, 'Le montant manuel restait au-dessus du minimum de 4 ans');
    // repartir d'une fenêtre fraîche pour la suite du scénario
    doc.getElementById('mpAnnuler').click();
    const btnRouvre = [...doc.querySelectorAll('button.btn-prolong[data-nom]')].find(b=>b.dataset.nom===jMut.nom);
    btnRouvre.click();
    egal(+doc.getElementById('mpDuree').value, dureeInitP, 'Fenêtre rouverte : durée proposée réinitialisée');
    egal(S.parseArgent(doc.getElementById('mpSalaire').value), minPD, 'Fenêtre rouverte : salaire proposé réinitialisé au minimum');
  }
  // un salaire sous le minimum est ramené au minimum à la confirmation
  doc.getElementById('mpSalaire').value = '1';
  doc.getElementById('mpOk').click();
  ok(modal.hidden, 'La fenêtre se ferme après confirmation');
  const rP = S.litResignatures();
  ok(!!rP[cleP], 'Prolongation persistée');
  egal(rP[cleP].salaire, minPD, 'Salaire sous le minimum ramené au minimum de la charte');
  egal(rP[cleP].statut, statutP, 'Statut enregistré');
  ok(rP[cleP].duree >= 1 && rP[cleP].duree <= S.dureeMaxCharte(statutP), 'Durée enregistrée dans les bornes de la charte');
  ok(doc.querySelector('#alignSommaire .det').textContent.includes('prolongé'), 'Mention «prolongé» dans le sommaire de masse');
  const btnP2 = [...doc.querySelectorAll('button.btn-prolong[data-nom]')].find(b=>b.dataset.nom===nomP);
  ok(btnP2.classList.contains('actif') && btnP2.textContent.includes('Prolongé'), 'Bouton passe à l\'état «Prolongé»');
  // la masse inclut le salaire de prolongation (le joueur ct=0 rentre au plafond)
  const masseAvecP = S.calculerMasse(S.litResignatures()).masse;
  const masseSansP = S.calculerMasse({}).masse;
  egal(masseAvecP - masseSansP, minPD, 'Le prolongé (contrat échu) rentre au plafond avec son salaire de prolongation');
  // la projection du plafond couvre les saisons de la prolongation
  {
    const proj = S.projectionPlafond(3, S.litResignatures());
    const sansProj = S.projectionPlafond(3, {});
    egal(proj[0].masse - sansProj[0].masse, minPD, 'Projection : le salaire de prolongation engage la saison Y22');
    if (S.litResignatures()[cleP].duree >= 2){
      egal(proj[1].masse - sansProj[1].masse, minPD, 'Projection : la prolongation engage aussi la saison Y23');
    }
  }
  // hausse volontaire au-dessus du minimum
  btnP2.click();
  ok(doc.getElementById('mpRetirer').style.display !== 'none', 'Bouton «Retirer» visible pour un joueur prolongé');
  egal(doc.getElementById('mpOk').textContent, 'Mettre à jour', 'Bouton de confirmation devient «Mettre à jour»');
  const hausseP = minPD + 3000000;
  doc.getElementById('mpSalaire').value = String(hausseP);
  doc.getElementById('mpOk').click();
  egal(S.litResignatures()[cleP].salaire, hausseP, 'Hausse volontaire au-dessus du minimum conservée');
  // changement de statut : les durées se recalculent
  const btnP3 = [...doc.querySelectorAll('button.btn-prolong[data-nom]')].find(b=>b.dataset.nom===nomP);
  btnP3.click();
  const selSt = doc.getElementById('mpStatut');
  selSt.value = 'SANS';
  selSt.dispatchEvent(new W.Event('change'));
  egal(doc.getElementById('mpDuree').options.length, 1, 'Statut «Sans contrat» → une seule durée offerte (1 an)');
  doc.getElementById('mpAnnuler').click();
  ok(doc.getElementById('modalProlong').hidden, 'Annuler ferme la fenêtre');
  egal(S.litResignatures()[cleP].salaire, hausseP, 'Annuler ne modifie pas la prolongation enregistrée');
  // retrait
  const btnP4 = [...doc.querySelectorAll('button.btn-prolong[data-nom]')].find(b=>b.dataset.nom===nomP);
  btnP4.click();
  doc.getElementById('mpRetirer').click();
  ok(!S.litResignatures()[cleP], '«Retirer la prolongation» supprime l\'entrée');
  jMut.ct = ctAvant;
  // Gardien à contrat échu : le minimum descend d'un échelon
  const gMut = S.ETAT.roster.find(x=>!x.backup && x.po==='G');
  ok(!!gMut, 'Au moins un gardien dans le club');
  const ctG = gMut.ct;
  gMut.ct = 0;
  doc.querySelector('#tableAlignement thead th[data-col="ov"]')?.click(); // re-rendu
  const btnG = [...doc.querySelectorAll('button.btn-prolong[data-nom]')].find(b=>b.dataset.nom===gMut.nom);
  ok(!!btnG, 'Gardien à contrat échu : bouton présent');
  btnG.click();
  const stG = doc.getElementById('mpStatut').value;
  const dG = +doc.getElementById('mpDuree').value;
  const minG = S.salaireMinimum(gMut.ov, stG, gMut.age, dG, 'G');
  const minGPat = S.salaireMinimum(gMut.ov, stG, gMut.age, dG, 'C');
  egal(S.parseArgent(doc.getElementById('mpSalaire').value), minG, 'Salaire du gardien pré-rempli à l\'échelon INFÉRIEUR (règle des gardiens)');
  ok(minG < minGPat || gMut.ov - 1 < 74, 'Minimum gardien plus bas que celui d\'un patineur de même OV (sauf clamp au plancher)');
  ok(doc.getElementById('mpMin').textContent.includes('gardien'), 'La note d\'échelon explique la règle du gardien');
  doc.getElementById('mpAnnuler').click();
  gMut.ct = ctG;
  doc.querySelector('#tableAlignement thead th[data-col="ov"]')?.click(); // retour à l'état initial
  W.localStorage.removeItem('tml_resignatures_v1');

  console.log('— Divers');
  egal(S.matchsEquipe(), 0, 'Fiche 0-0-0 → 0 match d\'équipe');
  egal(S.echap('<b nom="a&b">'), '&lt;b nom=&quot;a&amp;b&quot;&gt;', 'echap neutralise le HTML');

  console.log('— XtraStats en repli de TeamScoring (archive ou saison courante)');
  const xtraY21 = [{nom:'Aa', gp:82}, {nom:'Bb', gp:75}];
  const xtraY22 = [{nom:'Aa', gp:9}, {nom:'Bb', gp:10}];
  egal(S.xtraEstArchive(xtraY21, 0), true, 'Club à 0 match → archive Y21');
  egal(S.xtraEstArchive(xtraY21, 10), true, 'GP max 82 pour un club à 10 matchs → archive');
  egal(S.xtraEstArchive(xtraY22, 10), false, 'GP max 10 pour un club à 10 matchs → saison courante');
  egal(S.xtraEstArchive(xtraY22, 82), false, 'Fin de saison : GP max ≈ matchs du club → saison courante');
  // repli effectif : sans TeamScoring, XtraStats devient la source de production
  const ETAT = S.ETAT;
  ok(!!ETAT, 'État global accessible pour la simulation du repli');
  if (ETAT){
    const avantY21 = ETAT.xtraEstY21, avantScoring = ETAT.scoring, avantXtra = ETAT.xtra;
    ETAT.xtraEstY21 = false;            // XtraStats jugé «saison courante»
    ETAT.scoring = {patineurs:[], gardiens:[]}; // TeamScoring indisponible
    ETAT.xtra = [{nom:'Connor Bedard', gp:12, goals:8, assists:9, pts:17, shots:40, pim:4, mp:250, hits:10}];
    const jBedard = S.SECOURS_ROSTER.find(x2=>x2.nom==='Connor Bedard');
    const prodRepli = S.productionDe(jBedard);
    ok(!!prodRepli && prodRepli._xtraSource===true, 'Production servie par XtraStats (drapeau _xtraSource)');
    egal(prodRepli?.pts, 17, 'Points lus depuis XtraStats en repli');
    egal(prodRepli?._reference, false, 'Pas traitée comme simple référence Y21');
    ETAT.xtraEstY21 = avantY21; ETAT.scoring = avantScoring; ETAT.xtra = avantXtra;
  }

  console.log('— Bouton Effacer la cache');
  const btnCache = doc.querySelector('#btnEffacerCache');
  ok(!!btnCache, 'Bouton présent dans l\'en-tête');
  W.localStorage.setItem('tml_cache_v1', '{"roster":{"t":1,"v":"x"}}');
  W.localStorage.setItem('tml_proxy_prefere_v1', '2');
  btnCache.click();
  egal(W.localStorage.getItem('tml_cache_v1'), null, 'Cache de données effacée');
  egal(W.localStorage.getItem('tml_proxy_prefere_v1'), null, 'Relais préféré réinitialisé');
  await new Promise(r=>setTimeout(r,100)); // laisser l'actualisation (hors ligne) se terminer proprement

  console.log('— Mode vérification Y21 (référence servie par l\'archive XtraStats téléchargée)');
  const btnY21 = doc.querySelector('#btnModeY21');
  ok(!!btnY21, 'Bouton de bascule présent');
  egal(S.ETAT.modeY21, false, 'Saison en cours par défaut à l\'ouverture');
  {
    const avantXtra = S.ETAT.xtra, avantEstY21 = S.ETAT.xtraEstY21;
    // archive Y21 fictive téléchargée : saison complète de Bedard
    S.ETAT.xtra = [{nom:'Connor Bedard', gp:82, goals:40, assists:55, pts:95, shots:250, pim:20, mp:1700, hits:60}];
    S.ETAT.xtraEstY21 = true;
    btnY21.click();
    egal(S.ETAT.modeY21, true, 'Bascule activée');
    ok(doc.querySelector('#bandeauY21').style.display !== 'none', 'Bandeau de vérification affiché');
    const prodY21 = S.productionDe(S.SECOURS_ROSTER.find(x2=>x2.nom==='Connor Bedard'));
    egal(prodY21?._modeY21, true, 'Production servie par l\'archive Y21 téléchargée');
    egal(prodY21?.pts, 95, 'Points Y21 de Bedard');
    const carteBedard = [...doc.querySelectorAll('#progGrille .joueur-carte')]
      .find(c=>c.querySelector('.jc-nom').textContent==='Connor Bedard');
    ok(!!carteBedard, 'Carte de Bedard rendue en mode Y21');
    ok(carteBedard.textContent.includes('Mode vérification Y21'), 'Note du mode Y21 sur la carte');
    ok(carteBedard.querySelectorAll('.badge-etat.memorable').length >= 2,
       'Bedard Mémorable en points et en % de tirs (95 PTS > 81 ; 16 %T > 15,5)');
    ok(!carteBedard.textContent.includes('proj.'), 'Aucune projection affichée (saison complète)');
    btnY21.click();
    egal(S.ETAT.modeY21, false, 'Retour à la saison en cours');
    ok(doc.querySelector('#bandeauY21').style.display === 'none', 'Bandeau retiré');
    S.ETAT.xtra = avantXtra; S.ETAT.xtraEstY21 = avantEstY21;
  }

  console.log('— Calculateur OV détaillé : moteur');
  ok(typeof S.ovDetaille === 'function', 'ovDetaille exposée');
  tableauEgal(S.OV_ORDRE, ['it','sp','st','en','du','di','sk','pa','pc','df','sc','ex','ld'],
    'Ordre des cotes IN SP ST EN DU DI SK PA PC DF OF EX LD');
  // 17 OV détaillés de référence produits par la fonction overall() du classeur Excel
  const refsOvd = [
    ['F',[68,85,69,77,79,75,83,71,74,56,75,49,37],76.37,'Lambert'],
    ['F',[77,71,82,79,79,77,74,78,74,73,78,77,64],80.81,'ErikssonEk'],
    ['F',[86,78,74,81,75,70,80,79,73,66,80,78,68],81.39,'Konecny'],
    ['F',[68,81,74,77,75,80,77,72,72,69,75,51,41],77.40,'Olausson'],
    ['F',[69,79,67,76,70,76,78,77,74,67,74,45,40],76.99,'Tuomaala'],
    ['F',[64,85,73,87,77,85,86,78,71,69,79,58,58],80.53,'Thomas'],
    ['F',[66,77,72,76,76,79,77,77,81,63,76,56,41],78.15,'Johnson'],
    ['F',[65,86,79,87,81,85,89,70,75,61,84,67,58],81.18,'Nylander'],
    ['F',[62,76,75,77,78,80,78,71,75,62,78,90,75],77.97,'Saad'],
    ['F',[82,70,94,84,98,79,70,72,69,65,88,60,69],81.96,'Legare'],
    ['D',[68,70,78,84,68,82,72,73,74,84,62,85,80],79.55,'Brodin'],
    ['D',[81,73,85,92,89,80,76,66,71,79,58,52,53],80.09,'Schneider'],
    ['D',[64,84,70,86,83,81,85,86,76,79,70,60,62],82.54,'Fox'],
    ['D',[73,74,84,94,78,89,81,70,70,80,57,99,78],81.14,'Myers'],
    ['D',[65,72,82,78,75,79,75,71,72,78,60,70,65],77.84,'Graves'],
    ['D',[80,70,91,88,86,76,85,75,70,82,67,69,57],83.67,'Fleury'],
    ['D',[68,74,76,76,74,80,76,71,72,78,61,80,75],77.83,'Schmidt']
  ];
  const versCotes = t => Object.fromEntries(S.OV_ORDRE.map((k,i)=>[k,t[i]]));
  refsOvd.forEach(([g,t,attendu,nom]) => {
    proche(S.ovDetaille(versCotes(t), g).valeur, attendu, 0.005,
      `Référence Excel : ${nom} → ${attendu}`);
  });
  egal(S.ovDetaille(versCotes([82,70,94,84,98,79,70,72,69,65,88,60,69]),'F').arrondi, 82,
    'Legare (référence Excel) : arrondi 82');
  // classement des défenseurs : offensif si PA + OF >= DF + ST
  ok(S.ovDetaille(versCotes([64,84,70,86,83,81,85,86,76,79,70,60,62]),'D').formule.includes('offensif'),
    'Fox (PA 86 + OF 70 = 156 ≥ DF 79 + ST 70 = 149) → formule offensive');
  ok(S.ovDetaille(versCotes([68,70,78,84,68,82,72,73,74,84,62,85,80]),'D').formule.includes('défensif'),
    'Brodin (PA 73 + OF 62 = 135 < DF 84 + ST 78 = 162) → formule défensive');
  // cohérence : l'OV des patineurs des données de secours provient de cette formule
  S.SECOURS_ROSTER.filter(j => j.po !== 'G').forEach(j => {
    const r = S.ovDetaille(j, j.po === 'D' ? 'D' : 'F');
    ok(r && r.arrondi === j.ov, `Arrondi de l'OV détaillé = OV affiché — ${j.nom} (${j.ov})`);
  });
  // ancre 50 partout et gardiens
  proche(S.ovDetaille(versCotes(Array(13).fill(50)),'F').arrondi, 55, 0,
    'Patineur 50 partout → OV 55');
  egal(S.ovDetaille(S.SECOURS_ROSTER.find(j=>j.nom==='Chris Gibson'),'F'), null,
    'Gardien (df et sc nuls) → null : formule non couverte');

  console.log('— Calculateur OV détaillé : interface');
  ok(!!doc.querySelector('nav button[data-vue="ovdetail"]'), 'Onglet OV détaillé présent');
  const selOvd = doc.getElementById('ovdJoueur');
  egal(selOvd.querySelectorAll('option').length, 23,
    'Sélecteur : 22 patineurs + saisie manuelle (gardiens exclus)');
  egal(doc.querySelectorAll('#ovdGrille input').length, 13, '13 champs de cotes');
  selOvd.value = 'Connor Bedard';
  selOvd.dispatchEvent(new W.Event('change'));
  egal(doc.getElementById('ovdGroupe').value, 'F', 'Bedard chargé comme attaquant');
  egal(doc.getElementById('ovd_sc').value, '84', 'Cote OF de Bedard chargée');
  egal(doc.getElementById('ovdArrondi').textContent, '80', 'OV arrondi de Bedard = 80');
  const bedardSecours = S.SECOURS_ROSTER.find(j=>j.nom==='Connor Bedard');
  const attenduBedard = S.ovDetaille(bedardSecours,'F').valeur.toFixed(2).replace('.', ',');
  egal(doc.getElementById('ovdValeur').textContent, attenduBedard, 'OV détaillé affiché avec deux décimales');
  // saisie manuelle : recopier les cotes de la capture Excel de Legare (référence de la ligue)
  const capLegare = versCotes([82,70,94,84,98,79,70,72,69,65,88,60,69]);
  S.OV_ORDRE.forEach(k => { doc.getElementById('ovd_'+k).value = capLegare[k]; });
  doc.getElementById('ovd_it').dispatchEvent(new W.Event('input'));
  egal(doc.getElementById('ovdValeur').textContent, '81,96', 'Saisie manuelle : Legare du classeur → 81,96');
  egal(doc.getElementById('ovdArrondi').textContent, '82', 'Saisie manuelle : arrondi 82');
  // bascule défenseur : la note reflète la formule retenue
  selOvd.value = 'Ryan Merkley';
  selOvd.dispatchEvent(new W.Event('change'));
  egal(doc.getElementById('ovdGroupe').value, 'D', 'Merkley chargé comme défenseur');
  ok(doc.getElementById('ovdNote').textContent.includes('offensif'), 'Note : formule offensive pour Merkley (PA 84 + OF 81 ≥ DF 53 + ST 66)');
  selOvd.value = 'Lian Bichsel';
  selOvd.dispatchEvent(new W.Event('change'));
  ok(doc.getElementById('ovdNote').textContent.includes('défensif'), 'Note : formule défensive pour Bichsel (PA 63 + OF 54 < DF 80 + ST 83)');
  // champ vidé → résultat neutre
  doc.getElementById('ovd_pa').value = '';
  doc.getElementById('ovd_pa').dispatchEvent(new W.Event('input'));
  egal(doc.getElementById('ovdValeur').textContent, '—', 'Cote manquante → aucun résultat');

  console.log('— Recherche dans l\'alignement');
  const champRecherche = doc.getElementById('rechercheAlign');
  ok(!!champRecherche, 'Champ de recherche présent');
  champRecherche.value = 'bédard'; // accent : la normalisation doit le trouver
  champRecherche.dispatchEvent(new W.Event('input'));
  egal(doc.querySelectorAll('#tableAlignement tbody tr').length, 1, 'Filtre «bédard» (accent normalisé) → 1 rangée');
  champRecherche.value = 'grinder';
  champRecherche.dispatchEvent(new W.Event('input'));
  egal(doc.querySelectorAll('#tableAlignement tbody tr').length, 2, 'Filtre par profil «grinder» → Crouse et Cotter');
  champRecherche.value = '';
  champRecherche.dispatchEvent(new W.Event('input'));
  egal(doc.querySelectorAll('#tableAlignement tbody tr').length, 25, 'Filtre effacé → 25 rangées');

  console.log('— Export CSV de l\'alignement');
  const csv = S.exporterCSV();
  const lignesCSV = csv.split('\n');
  egal(lignesCSV.length, 26, '26 lignes : en-tête + 25 joueurs');
  ok(lignesCSV[0].startsWith('Nom;No;PO;HD;Age;'), 'En-tête CSV (séparateur point-virgule)');
  const ligneHayton = lignesCSV.find(l=>l.startsWith('Barrett Hayton;'));
  ok(!!ligneHayton, 'Rangée de Hayton présente');
  ok(ligneHayton.includes(';7250000;3'), 'Salaire et contrat de Hayton exportés');
  ok(ligneHayton.includes(';Playmaker;'), 'Profil exporté');

  console.log('— Projection du plafond salarial');
  const proj = S.projectionPlafond(5, {});
  egal(proj.length, 5, 'Cinq saisons projetées');
  egal(proj[0].saison, 'Y22', 'La projection démarre à la saison Y22');
  egal(proj[0].masse, 83571666, 'Masse Y22 = masse salariale actuelle');
  egal(proj[0].engages, 25, '25 joueurs sous contrat en Y22');
  egal(proj[0].marge, 104000000 - 83571666, 'Marge Y22 sous le plafond de 104 M$');
  egal(proj[1].masse, 28371666, 'Masse Y23 = contrats de 2 ans et plus');
  egal(proj[1].engages, 10, '10 joueurs encore sous contrat en Y23');
  egal(proj[2].masse, 14500000, 'Masse Y24 = Hayton + Merkley (7,25 M chacun)');
  egal(proj[2].engages, 2, 'Deux contrats de 3 ans');
  egal(proj[3].masse, 0, 'Aucun contrat ne couvre la Y25');
  egal(proj[0].expirants.length, 15, '15 contrats expirent après la Y22');
  ok(proj[0].expirants.includes('Connor Bedard'), 'Bedard dans les contrats qui expirent après la Y22');
  tableauEgal(proj[2].expirants.sort(), ['Barrett Hayton','Ryan Merkley'], 'Hayton et Merkley expirent après la Y24');
  // rendu de la vue
  doc.querySelector('nav button[data-vue="plafond"]').click();
  egal(doc.querySelectorAll('#tablePlafond tbody tr').length, 5, 'Table de projection : 5 rangées');
  ok(doc.querySelector('#plafondSommaire').textContent.includes('Masse Y22'), 'Sommaire de la projection rendu');
  ok(doc.querySelector('#tablePlafond').textContent.includes('Connor Bedard'), 'Expirants listés dans la table');

  console.log('— Comparateur de joueurs');
  doc.querySelector('nav button[data-vue="comparateur"]').click();
  const selA = doc.getElementById('compA'), selB = doc.getElementById('compB');
  egal(selA.options.length, 25, 'Sélecteur A : 25 joueurs');
  egal(selB.options.length, 25, 'Sélecteur B : 25 joueurs');
  egal(selA.value, 'Chris Bigras', 'Joueur A par défaut = meilleur OV du club (Bigras, 88)');
  egal(selB.value, 'Travis Sanheim', 'Joueur B par défaut = deuxième OV du club (Sanheim, 84)');
  selA.value = 'Connor Bedard'; selA.dispatchEvent(new W.Event('change'));
  selB.value = 'Matvei Michkov'; selB.dispatchEvent(new W.Event('change'));
  const zone = doc.getElementById('compZone');
  ok(zone.textContent.includes('Connor Bedard') && zone.textContent.includes('Matvei Michkov'),
    'Les deux joueurs choisis sont affichés');
  egal(zone.querySelectorAll('.comp-barre').length, 28, '14 cotes × 2 barres (13 cotes + OV)');
  ok(zone.textContent.includes('Junior Elite') && zone.textContent.includes('Prospect Elite'),
    'Profils des deux joueurs affichés');
  ok(zone.querySelector('.comp-pied').textContent.includes('Statistiques évaluées'),
    'Statistiques évaluées par profil listées au pied');
  // le plus fort sur une cote est marqué : Bedard SC 84 = Michkov SC 84 → égalité, les deux gagnent
  // vérifions une cote asymétrique : PC 81 (Bedard) vs 82 (Michkov)
  {
    const lignes = [...zone.querySelectorAll('.comp-mid')].map(x=>x.textContent);
    ok(lignes.some(t=>t.includes('PC')), 'Ligne de la cote PC présente');
  }

  console.log('— Base de données de la ligue (32 équipes, fichiers FHL)');
  egal(S.LIGUE_EQUIPES.length, 32, '32 équipes dans la base de la ligue');
  ok(S.LIGUE_EQUIPES.includes('TORONTO') && S.LIGUE_EQUIPES.includes('ST.LOUIS'), 'TORONTO et ST.LOUIS présents');
  egal(Object.values(S.LIGUE).reduce((a,t)=>a+t.length,0), 821, '821 joueurs dans la ligue');
  egal(S.joueursEquipe('TORONTO').length, 25, 'Mon club : la formation vivante (ETAT.roster) fait foi');
  const sanjose = S.joueursEquipe('SANJOSE');
  ok(sanjose.every(j=>!/^backup/i.test(j.nom.replace(/[\s_]/g,''))), 'Les joueurs Backup_ sont exclus du décodage');
  const foxSJ = sanjose.find(j=>j.nom==='Adam Fox');
  ok(!!foxSJ, 'Adam Fox trouvé chez SANJOSE');
  egal(foxSJ.ov, 83, 'OV de Fox (SANJOSE) = 83 — recoupe l\'affichage ushl.ca');
  egal(foxSJ._profil.profil, 'DEliteQB', 'Profil calculé pour un joueur d\'une autre équipe');
  const kotkaSJ = sanjose.find(j=>j.nom==='Jesperi Kotkaniemi');
  egal(kotkaSJ.salaire, 7250000, 'Salaire de Kotkaniemi (SANJOSE) recoupe les données publiées');
  egal(kotkaSJ.ct, 3, 'Contrat de Kotkaniemi recoupé (3 ans)');
  const georgievSJ = sanjose.find(j=>j.nom==='Alexandar Georgiev');
  egal(georgievSJ.df, null, 'DF des gardiens décodé à null');
  egal(georgievSJ.ovEstime, true, 'OV des gardiens des autres équipes marqué estimé');
  egal(georgievSJ._instantane, true, 'Les joueurs de l\'instantané portent le drapeau _instantane');
  // rangées fictives : jamais dans les listes
  egal(S.estFictif('Backup_LW_Anaheim'), true, 'Backup_ = fictif');
  egal(S.estFictif('Rachat Dvorak'), true, 'Rachat = fictif');
  egal(S.estFictif('Retenue Hyman'), true, 'Retenue = fictif');
  egal(S.estFictif('Retenu Horvat'), true, 'Retenu (sans e) = fictif');
  egal(S.estFictif('Connor Bedard'), false, 'Un vrai joueur n\'est pas fictif');
  ok(S.joueursEquipe('ANAHEIM').every(j=>!S.estFictif(j.nom)),
    'Rachats, retenues et backups exclus des listes (ANAHEIM)');

  console.log('— Alignements des autres équipes téléchargés en direct (correction des cotes périmées)');
  ok(S.urlRosterEquipe('SANJOSE').includes('TeamRosters.php?team=SANJOSE'), 'URL de formation par équipe');
  ok(S.validerPageDe('SANJOSE')('bla SANJOSE 3-2-0 bla'), 'Validation : la fiche de l\'équipe demandée doit être dans la page');
  ok(!S.validerPageDe('SANJOSE')('bla TORONTO 3-2-0 bla'), 'Page d\'une autre équipe rejetée');
  ok(S.validerPageDe('ST.LOUIS')('… ST.LOUIS 1-0-0 …'), 'Le point de ST.LOUIS est échappé dans la validation');
  {
    // page TeamRosters fictive de SANJOSE : fiche + table de 12 joueurs dont Kotkaniemi RECOTÉ
    const entetes = '<tr><th>Nom</th><th>PO</th><th>HD</th><th>CD</th><th>IJ</th><th>IN</th><th>SP</th><th>ST</th><th>EN</th><th>DU</th><th>DI</th><th>SK</th><th>PA</th><th>PC</th><th>DF</th><th>OF</th><th>EX</th><th>LD</th><th>OV</th><th>Age</th><th>Salary</th><th>CT</th><th>HT</th><th>WT</th><th>Lien</th></tr>';
    const rangee = (nom, sp) => `<tr><td>${nom}</td><td>C</td><td>G</td><td>OK</td><td></td><td>70</td><td>${sp}</td><td>77</td><td>89</td><td>86</td><td>83</td><td>83</td><td>83</td><td>79</td><td>62</td><td>79</td><td>61</td><td>51</td><td>84</td><td>25</td><td>7 250 000 $</td><td>3</td><td>6 ' 2</td><td>198 lbs</td><td>Lien</td></tr>`;
    let corps = rangee('Jesperi Kotkaniemi', 90) + rangee('Rachat Untel', 50);
    for (let i=1; i<=11; i++) corps += rangee('Joueur Test'+i, 75);
    const page = '<html><body>SANJOSE 2-1-0 <table>' + entetes + corps + '</table></body></html>' + ' '.repeat(600);
    const fetchAvant = W.fetch;
    W.fetch = async () => ({ok:true, status:200, text: async () => page});
    const joueursDirect = await S.chargerEquipe('SANJOSE');
    W.fetch = fetchAvant;
    egal(joueursDirect.length, 12, '12 vrais joueurs extraits de la page en direct (rachat exclu)');
    const kotkaDirect = joueursDirect.find(j=>j.nom==='Jesperi Kotkaniemi');
    egal(kotkaDirect.sp, 90, 'Cote SP recotée lue depuis ushl.ca (90, plus l\'instantané à 83)');
    egal(kotkaDirect.ov, 84, 'OV recoté lu depuis la page');
    ok(!!kotkaDirect._profil, 'Profil recalculé sur les cotes en direct');
    // joueursEquipe sert désormais l'alignement en direct, sans drapeau _instantane
    const kotkaServi = S.joueursEquipe('SANJOSE').find(j=>j.nom==='Jesperi Kotkaniemi');
    egal(kotkaServi.sp, 90, 'joueursEquipe sert l\'alignement en direct dès qu\'il est téléchargé');
    ok(!kotkaServi._instantane, 'Plus de drapeau _instantane sur les cotes en direct');
    // le comparateur affiche la provenance en direct
    const selEqB0 = doc.getElementById('compEqB');
    selEqB0.value = 'SANJOSE'; selEqB0.dispatchEvent(new W.Event('change'));
    doc.getElementById('compB').value = 'Jesperi Kotkaniemi';
    doc.getElementById('compB').dispatchEvent(new W.Event('change'));
    ok(doc.getElementById('compZone').querySelector('.comp-pied').textContent.includes('en direct de ushl.ca'),
      'Provenance «en direct de ushl.ca» affichée au comparateur');
    // deuxième appel : servi de la mémoire, sans réseau
    W.fetch = () => { throw new Error('ne doit pas être appelé'); };
    const rejoue = await S.chargerEquipe('SANJOSE');
    W.fetch = fetchAvant;
    egal(rejoue.length, 12, 'Deuxième consultation servie de la mémoire (aucun réseau)');
    // retour à l'instantané pour la suite des tests
    S.ETAT.equipesLive.delete('SANJOSE');
    W.localStorage.removeItem('tml_cache_v1');
    selEqB0.value = 'TORONTO'; selEqB0.dispatchEvent(new W.Event('change'));
  }

  console.log('— Comparateur inter-équipes');
  const selEqA = doc.getElementById('compEqA'), selEqB = doc.getElementById('compEqB');
  egal(selEqA.options.length, 32, 'Sélecteur d\'équipe A : 32 équipes');
  egal(selEqA.value, 'TORONTO', 'Équipe A par défaut : mon club');
  ok(selEqA.textContent.includes('(mon club)'), 'Le club est identifié dans la liste');
  selEqB.value = 'SANJOSE'; selEqB.dispatchEvent(new W.Event('change'));
  egal(selB.options.length, sanjose.length, 'Joueurs B = alignement SANJOSE (backups exclus)');
  selB.value = 'Adam Fox'; selB.dispatchEvent(new W.Event('change'));
  ok(zone.textContent.includes('Connor Bedard') && zone.textContent.includes('Adam Fox'),
    'Comparaison Leafs vs SANJOSE rendue');
  ok(zone.textContent.includes('SANJOSE'), 'L\'équipe du joueur B est affichée');
  ok(zone.querySelector('.comp-pied').textContent.includes('fichiers de la ligue'),
    'Provenance des cotes hors club indiquée');
  // retour au club pour laisser l'état propre
  selEqB.value = 'TORONTO'; selEqB.dispatchEvent(new W.Event('change'));

  console.log('— Calculateur OV détaillé : toutes les équipes');
  const selOvdEq = doc.getElementById('ovdEquipe');
  egal(selOvdEq.options.length, 32, 'Sélecteur d\'équipe du calculateur : 32 équipes');
  egal(selOvdEq.value, 'TORONTO', 'Équipe par défaut : mon club');
  selOvdEq.value = 'SANJOSE'; selOvdEq.dispatchEvent(new W.Event('change'));
  const nbPatineursSJ = sanjose.filter(j=>j.po!=='G').length;
  egal(doc.getElementById('ovdJoueur').options.length, nbPatineursSJ + 1,
    'Joueurs proposés = patineurs SANJOSE + saisie manuelle');
  doc.getElementById('ovdJoueur').value = 'Adam Fox';
  doc.getElementById('ovdJoueur').dispatchEvent(new W.Event('change'));
  egal(doc.getElementById('ovdArrondi').textContent, '83', 'OV de Fox recalculé depuis ses cotes = 83');
  ok(doc.getElementById('ovdNote').textContent.includes('offensif'), 'Formule offensive retenue pour Fox');
  selOvdEq.value = 'TORONTO'; selOvdEq.dispatchEvent(new W.Event('change'));
  egal(doc.getElementById('ovdJoueur').options.length, 23, 'Retour au club : 22 patineurs + saisie manuelle');

  console.log('— Bâtisseur de trios');
  W.localStorage.removeItem('tml_trios_v1');
  doc.querySelector('nav button[data-vue="trios"]').click();
  egal(doc.querySelectorAll('#triosZone .trio-bloc').length, 8, '8 blocs : 4 trios, 3 paires, gardiens');
  egal(doc.querySelectorAll('#triosZone select[data-slot]').length, 20, '20 postes à combler');
  egal(doc.getElementById('triosEtat').textContent, '0/12 attaquants · 0/6 défenseurs · 0/2 gardiens',
    'Compteur à zéro au départ');
  S.autoTrios();
  const t = S.litTrios();
  egal(Object.keys(t).length, 20, 'Remplissage par OV : les 20 postes sont comblés');
  egal(t['t1.c'], 'Barrett Hayton', 'Trio 1, centre = meilleur C par OV (Hayton)');
  egal(t['t1.ag'], 'Filip Zadina', 'Trio 1, AG = meilleur ailier gauche (Zadina)');
  egal(t['t1.ad'], 'Tyson Jost', 'Trio 1, AD = meilleur ailier droit (Jost)');
  egal(t['p1.dg'], 'Chris Bigras', 'Paire 1 = meilleur défenseur (Bigras)');
  egal(t['g.g1'], 'Chris Gibson', 'Gardien partant = meilleur OV (Gibson)');
  egal(doc.getElementById('triosEtat').textContent, '12/12 attaquants · 6/6 défenseurs · 2/2 gardiens',
    'Alignement complet après remplissage');
  ok(doc.getElementById('triosZone').textContent.includes('OV moyen 82.0'),
    'OV moyen du trio 1 affiché ((83+82+81)/3 = 82.0)');
  egal(doc.getElementById('triosAlerte').textContent, '', 'Aucun doublon après remplissage automatique');
  // un doublon est signalé
  const selT4AD = doc.querySelector('#triosZone select[data-slot="t4.ad"]');
  selT4AD.value = 'Filip Zadina'; selT4AD.dispatchEvent(new W.Event('change'));
  ok(doc.getElementById('triosAlerte').textContent.includes('Filip Zadina'), 'Doublon signalé (Zadina utilisé deux fois)');
  egal(doc.querySelectorAll('#triosZone select.double').length, 2, 'Les deux postes en conflit sont marqués');
  // export texte
  const txt = S.texteTrios();
  ok(txt.startsWith('TORONTO — trios'), 'Export texte : en-tête du club');
  ok(txt.includes('Trio 1 : Filip Zadina (83) — Barrett Hayton (82) — Tyson Jost (81)'), 'Export texte : trio 1 lisible');
  ok(txt.includes('Gardiens : Chris Gibson (82) / Kevin Lankinen (79)'), 'Export texte : gardiens');
  // persistance
  ok(W.localStorage.getItem('tml_trios_v1').includes('Barrett Hayton'), 'Trios persistés dans le navigateur');
  S.ecritTrios({}); S.rendreTrios();
  egal(doc.getElementById('triosEtat').textContent, '0/12 attaquants · 0/6 défenseurs · 0/2 gardiens',
    'Vidage : compteur remis à zéro');

  console.log('— Actualisation automatique à l\'ouverture');
  {
    let appelsUshl = 0;
    const dom2 = new JSDOM(html, {
      runScripts: 'dangerously', url: 'https://example.org/', pretendToBeVisual: true,
      beforeParse(w){
        w.fetch = (url)=>{ if (String(url).includes('ushl.ca')) appelsUshl++; return new Promise(()=>{}); };
      }
    });
    await new Promise(r=>setTimeout(r, 500));
    ok(appelsUshl > 0, 'Sans le drapeau de test, la page lance l\'actualisation ushl.ca dès l\'ouverture');
    egal(S.ETAT.source.includes('données intégrées'), true,
      'Harnais de tests : pas d\'actualisation automatique, les données intégrées restent affichées');
    dom2.window.close();
  }

  console.log('— Onglet Ligue : dépistage des 32 équipes');
  doc.querySelector('nav button[data-vue="ligue"]').click();
  const tousLigue = S.joueursLigue();
  const attenduLigue = S.LIGUE_EQUIPES.reduce((a,e)=>a+S.joueursEquipe(e).length, 0);
  egal(tousLigue.length, attenduLigue, 'Tous les vrais joueurs de la ligue réunis (' + attenduLigue + ')');
  egal(doc.querySelectorAll('#tableLigue tbody tr').length, tousLigue.length, 'Table rendue au complet sans filtre');
  ok(doc.getElementById('ligueCompte').textContent.includes(String(tousLigue.length)), 'Compteur de joueurs affiché');
  egal(doc.getElementById('ligueEquipe').options.length, 33, 'Filtre d\'équipe : Toutes + 32');
  // tri par défaut : OV décroissant
  {
    const ovs = [...doc.querySelectorAll('#tableLigue tbody tr td:nth-child(5)')].slice(0,5)
      .map(td=>+td.textContent.replace('~',''));
    ok(ovs.every((v,i)=>i===0 || v<=ovs[i-1]), 'Tri par OV décroissant par défaut');
  }
  // filtres
  const fBase = {texte:'', equipe:'', po:'', ovMin:null, ageMax:null, expirants:false};
  egal(S.joueursLigueFiltres({...fBase, equipe:'TORONTO'}).length, 25, 'Filtre équipe TORONTO → 25 Leafs');
  ok(S.joueursLigueFiltres({...fBase, ovMin:85}).every(j=>j.ov>=85), 'Filtre OV min respecté');
  ok(S.joueursLigueFiltres({...fBase, po:'G'}).every(j=>j.po==='G'), 'Filtre gardiens');
  ok(S.joueursLigueFiltres({...fBase, po:'F'}).every(j=>j.po!=='D' && j.po!=='G'), 'Filtre attaquants (C, AG, AD)');
  ok(S.joueursLigueFiltres({...fBase, ageMax:21}).every(j=>j.age<=21), 'Filtre âge max');
  ok(S.joueursLigueFiltres({...fBase, expirants:true}).every(j=>(j.ct??0)<=1), 'Filtre contrats d\'un an ou échus');
  egal(S.joueursLigueFiltres({...fBase, texte:'bedard'}).length, 1, 'Recherche par nom');
  // interaction : le champ OV min filtre la table
  doc.getElementById('ligueOvMin').value = '85';
  doc.getElementById('ligueOvMin').dispatchEvent(new W.Event('input'));
  const nb85 = S.joueursLigueFiltres({...fBase, ovMin:85}).length;
  egal(doc.querySelectorAll('#tableLigue tbody tr').length, nb85, 'Champ OV min branché sur la table');
  ok(nb85 > 0 && nb85 < 60, 'Le filtre OV 85+ garde une élite (' + nb85 + ' joueurs)');
  doc.getElementById('ligueOvMin').value = '';
  doc.getElementById('ligueOvMin').dispatchEvent(new W.Event('input'));
  // tri par salaire au clic
  doc.querySelector('#tableLigue th[data-col="salaire"]').click();
  {
    const sals = [...doc.querySelectorAll('#tableLigue tbody tr td:nth-child(6)')].slice(0,3)
      .map(td=>S.parseArgent(td.textContent.replace(' $','')));
    ok(sals[0] >= sals[1] && sals[1] >= sals[2], 'Clic sur Salaire → tri décroissant');
  }

  console.log('— Analyseur d\'échange');
  doc.querySelector('nav button[data-vue="echange"]').click();
  egal(doc.getElementById('echSommaire').innerHTML, '', 'Échange vide : aucun sommaire');
  ok(doc.getElementById('echSortants').textContent.includes('Personne'), 'Listes vides annoncées');
  // Bigras (11 M, CT 1) part ; Adam Fox de SANJOSE (7,25 M, CT 1) arrive
  doc.getElementById('echSortant').value = 'Chris Bigras';
  doc.getElementById('echAjSortant').click();
  doc.getElementById('echEquipe').value = 'SANJOSE';
  doc.getElementById('echEquipe').dispatchEvent(new W.Event('change'));
  doc.getElementById('echEntrant').value = 'Adam Fox';
  doc.getElementById('echAjEntrant').click();
  egal(S.ECHANGE.sortants.length, 1, 'Un sortant enregistré');
  egal(S.ECHANGE.entrants.length, 1, 'Un entrant enregistré');
  ok(doc.getElementById('echSortants').textContent.includes('Chris Bigras'), 'Chip du sortant affichée');
  ok(doc.getElementById('echEntrants').textContent.includes('Adam Fox'), 'Chip de l\'entrant affichée');
  {
    const apres = S.projectionEchange(S.ECHANGE.sortants, S.ECHANGE.entrants, 3);
    egal(apres[0].masse, 83571666 - 11000000 + 7250000, 'Masse Y22 après : −Bigras (11 M) +Fox (7,25 M)');
    egal(apres[1].masse, 28371666 - 0 + 0, 'Y23 inchangée : les deux contrats expirent après Y22');
    ok(doc.getElementById('echSommaire').textContent.includes('Masse Y22 après'), 'Sommaire d\'impact rendu');
    ok(doc.getElementById('echSommaire').textContent.includes('OV moyen'), 'OV moyen avant/après affiché');
    egal(doc.querySelectorAll('#tableEchange tbody tr').length, 3, 'Projection sur trois saisons');
    const b0 = S.bilanClub([], []), b1 = S.bilanClub(S.ECHANGE.sortants, S.ECHANGE.entrants);
    egal(b1.n, 25, 'Effectif inchangé (1 pour 1)');
    ok(b1.ov < b0.ov, 'OV moyen en baisse (Bigras 88 → Fox 83)');
  }
  // un joueur ajouté disparaît des choix ; retrait par la chip
  ok(![...doc.getElementById('echSortant').options].some(o=>o.value==='Chris Bigras'),
    'Bigras retiré du sélecteur des sortants');
  doc.querySelector('#echSortants button[data-camp="s"]').click();
  egal(S.ECHANGE.sortants.length, 0, 'Retrait par la chip');
  doc.getElementById('echVider').click();
  egal(S.ECHANGE.entrants.length, 0, 'Vider l\'échange');
  egal(doc.getElementById('echSommaire').innerHTML, '', 'Sommaire retiré après vidage');

  console.log('— Bureau du DG (alertes en tête de l\'alignement)');
  doc.querySelector('nav button[data-vue="alignement"]').click();
  {
    let alertes = S.alertesDG();
    ok(alertes.some(a=>a.niveau==='info' && a.texte.includes('15 contrats')),
      'Alerte info : 15 contrats expirent à la fin de la saison');
    ok(!alertes.some(a=>a.texte.includes('échu')), 'Aucun contrat échu dans l\'alignement de départ');
    ok(doc.querySelectorAll('#alertesDG .alerte-ligne').length >= 1, 'Bandeau d\'alertes rendu');
    // contrat échu non prolongé → alerte rouge
    const jEchu = S.ETAT.roster.find(x=>!x.backup && x.po!=='G');
    const ctAv = jEchu.ct; jEchu.ct = 0;
    alertes = S.alertesDG();
    ok(alertes.some(a=>a.niveau==='rouge' && a.texte.includes(jEchu.nom)),
      'Contrat échu sans prolongation → alerte rouge nominative');
    jEchu.ct = ctAv;
    // gardien près de sa limite / au-delà
    const avLim = new Map(S.ETAT.limites), avSc = S.ETAT.scoring;
    S.ETAT.limites.set(S.normaliserNom('Chris Gibson'), 40);
    S.ETAT.scoring = {patineurs:[], gardiens:[{nom:'Chris Gibson', gp:36, w:20, avg:2.5, svpct:0.91}]};
    alertes = S.alertesDG();
    ok(alertes.some(a=>a.niveau==='jaune' && a.texte.includes('approche sa limite') && a.texte.includes('36/40')),
      'Gardien à 90 % de sa limite → alerte jaune');
    S.ETAT.scoring.gardiens[0].gp = 40;
    alertes = S.alertesDG();
    ok(alertes.some(a=>a.niveau==='rouge' && a.texte.includes('atteint sa limite')),
      'Gardien à sa limite → alerte rouge');
    // joueur sous les attentes (production catastrophique sur toute la saison du club)
    S.ETAT.scoring = {patineurs:[{nom:'Filip Zadina', gp:40, goals:1, assists:1, pts:2, shots:150, plusminus:-20, ppg:0, gwg:0}], gardiens:[]};
    S.ETAT.fiche = 'TORONTO 20-20-0';
    alertes = S.alertesDG();
    ok(alertes.some(a=>a.texte.includes('sous les attentes') && a.texte.includes('Filip Zadina')),
      'Production décevante → alerte «sous les attentes»');
    S.ETAT.limites.clear(); avLim.forEach((v,k)=>S.ETAT.limites.set(k,v));
    S.ETAT.scoring = avSc; S.ETAT.fiche = 'TORONTO 0-0-0';
    S.rendreAlertes();
  }

  console.log('— Suivi des recotes (Y21 → maintenant)');
  egal(Object.keys(S.COTES_Y21).length, 783, '783 joueurs recensés à la fin de la Y21');
  tableauEgal(S.cotesY21De('Jesperi Kotkaniemi'), [70,83,77,89,86,83,83,82,79,62,79,61,51],
    'Cotes Y21 de Kotkaniemi retrouvées (nom normalisé)');
  egal(S.cotesY21De('Joueur Inconnu'), null, 'Joueur absent de la Y21 → null');
  {
    const recSJ = S.recotesEquipe('SANJOSE');
    const kotka = recSJ.find(r=>r.j.nom==='Jesperi Kotkaniemi');
    ok(!!kotka && !kotka.absent, 'Ligne de recote de Kotkaniemi construite');
    egal(kotka.deltas.pa, 1, 'PA de Kotkaniemi : 82 → 83 = +1');
    egal(kotka.deltas.ld, 0, 'LD inchangé = 0');
    egal(kotka.somme, 1, 'Δ total de Kotkaniemi = +1');
    ok(recSJ.every(r=>r.absent || typeof r.somme==='number'), 'Δ total calculé pour chaque joueur recensé');
    const gardienSJ = recSJ.find(r=>r.j.po==='G' && !r.absent);
    ok(!!gardienSJ && gardienSJ.ovDelta===null, 'Gardien : pas de delta d\'OV (formule non couverte), cotes comparées quand même');
  }
  doc.querySelector('nav button[data-vue="recotes"]').click();
  egal(doc.getElementById('recEquipe').value, 'TORONTO', 'Équipe par défaut : mon club');
  egal(doc.querySelectorAll('#tableRecotes tbody tr').length, 25, '25 lignes pour les Leafs');
  ok(doc.querySelector('#tableRecotes thead').textContent.includes('OV Y21→Y22'), 'Colonne OV avant→après');
  doc.getElementById('recEquipe').value = 'SANJOSE';
  doc.getElementById('recEquipe').dispatchEvent(new W.Event('change'));
  ok(doc.querySelector('#tableRecotes tbody').textContent.includes('Jesperi Kotkaniemi'), 'Recotes de SANJOSE affichées');
  ok(doc.querySelectorAll('#tableRecotes td.rec-plus').length >= 1, 'Les hausses sont marquées en vert');
  doc.getElementById('recEquipe').value = 'TORONTO';
  doc.getElementById('recEquipe').dispatchEvent(new W.Event('change'));

  console.log(`\n${total - echecs}/${total} vérifications réussies`);
  process.exit(echecs ? 1 : 0);
})().catch(e => { console.error('ERREUR FATALE', e); process.exit(1); });
