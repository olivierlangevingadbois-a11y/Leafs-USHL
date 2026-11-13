/* Harnais de validation du Poste du DG (jsdom) */
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

/* La page est servie en plusieurs fichiers (css/, js/, data/) : le harnais les
   insère dans le HTML pour que jsdom les exécute sans réseau ni serveur. */
const RACINE = path.join(__dirname, '..');
const lireFichier = f => fs.readFileSync(path.join(RACINE, f), 'utf8');
/* data/releve.js change à chaque relevé de ushl.ca : les vérifications tournent
   sur un relevé figé (test/fixtures/releve.js, la ligue du 6 septembre 2026). */
const RELEVE_FIGE = 'test/fixtures/releve.js';
const html = lireFichier('index.html')
  .replace(/<script src="([^"]+)"><\/script>/g, (_, src) =>
    `<script>${lireFichier(src === 'data/releve.js' ? RELEVE_FIGE : src)}</script>`)
  .replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (_, href) => `<style>${lireFichier(href)}</style>`);

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

  /* Installe des statistiques comme si l'API de ushl.ca venait de répondre.
     Une rangée sans équipe est attribuée au club du DG. */
  const duClub = liste => (liste || []).map(r => ({equipe: S.CONFIG.equipe, ...r}));
  const poserStatsClub = (patineurs, gardiens) =>
    S.poserStats(duClub(patineurs), duClub(gardiens), {date: new Date().toISOString()});
  /* Remplace l'alignement d'une équipe en mémoire (simule ce qu'une lecture rapporterait). */
  const remplacerEquipe = (code, joueurs) => {
    S.ETAT.ligue.equipes[code] = joueurs;
    S.ETAT.version++;
    S.rafraichirRosterClub();
  };
  /* Retour à l'état du relevé figé : avant-saison, aucune statistique. */
  const viderStats = () => {
    S.ETAT.classementOfficiel = null;
    S.poserStats([], [], {});
    S.poserMinutes({}, null);
  };

  console.log('— Relevé intégré (ici : relevé figé de ushl.ca du 6 septembre 2026)');
  const SECOURS = S.joueursEquipeBrut('TORONTO');
  egal(SECOURS.length, 20, '20 joueurs dans la formation de secours');
  ok(!SECOURS.some(j=>S.estFictif(j.nom)), 'Aucun joueur Backup_ dans la formation TORONTO');
  egal(S.ETAT.ligue.origine, 'releve', 'À l\'ouverture, la ligue vient du relevé intégré');
  egal(S.sourceLisible(), 'relevé de ushl.ca · 6 septembre 2026, ' + new Date('2026-09-06T16:00:00Z').getHours() + ' h 00', 'Provenance affichée dans l\'en-tête');
  const hayton = SECOURS.find(j => j.nom === 'Barrett Hayton');
  egal(hayton.salaire, 9075000, 'Salaire Hayton relevé du site');
  egal(hayton.ct, 2, 'Contrat Hayton : 2 ans (site)');
  egal(hayton.no, 22, 'Numéro de chandail de Hayton');
  const bedard = SECOURS.find(j => j.nom === 'Connor Bedard');
  egal(bedard.age, 21, 'Bedard a 21 ans (catégorie prospect, âge du site)');
  egal(bedard.ct, 3, 'Bedard prolongé 3 ans (site du 6 septembre)');
  const barzal = SECOURS.find(j => j.nom === 'Mathew Barzal');
  egal(barzal.no, null, 'Numéro inconnu pour une arrivée récente (la page du site ne le publie pas)');
  egal(barzal.ct, 5, 'Barzal sous contrat 5 ans');
  const gibson = SECOURS.find(j => j.nom === 'Chris Gibson');
  egal(gibson.ov, 83, 'OV de Gibson relevé du site (83)');
  egal(gibson.ct, 1, 'Contrat de Gibson : 1 an (site)');
  egal(gibson.ovEstime, undefined, 'Plus de drapeau ovEstime : OV des gardiens du club relevé du site');
  ok(SECOURS.filter(j=>j.po!=='G').every(j=>!j.ovEstime), 'L\'OV des patineurs n\'est pas marqué estimé');
  egal(gibson.df, null, 'DF du gardien = null');
  egal(S.ETAT.enSaison, false, 'Relevé d\'avant-saison : aucun match disputé');
  egal(S.ETAT.reference, null, 'Aucun total de la saison précédente intégré — la référence vient de XtraStats');

  console.log('— Moteur de profils (tableaux 10-11-12) et matrices associées');
  const joueurDe = nom => SECOURS.find(j => j.nom === nom);
  const profilDe = nom => S.determinerProfil(joueurDe(nom));
  // profils couverts par la formation du club
  egal(profilDe('Barrett Hayton').profil, 'Playmaker', 'Hayton → Playmaker');
  tableauEgal(profilDe('Barrett Hayton').stats, ['assists','pts'], 'Stats Playmaker = A, P');
  egal(profilDe('Mathew Barzal').profil, 'Playmaker', 'Barzal → Playmaker');
  egal(profilDe('Vassili Zaitsev').profil, 'Sniper', 'Zaitsev → Sniper');
  tableauEgal(profilDe('Vassili Zaitsev').stats, ['goals','gwg','ppg','shots20'], 'Stats Sniper = B, GG, PP, T20');
  egal(profilDe('Connor Bedard').profil, 'Prospect Elite', 'Bedard (21 ans) → Prospect Elite');
  egal(profilDe('Connor Bedard').mat, 'ELITE', 'Prospect Elite → même matrice ELITE');
  tableauEgal(profilDe('Connor Bedard').stats, ['shotpct','gwg','ppg','pts','pmrang'],
    'Stats évaluées Elite = tableau 20 (PCTG, GWG, PP, P, +/-)');
  egal(profilDe('Matvei Michkov').profil, 'Prospect Elite', 'Michkov (22 ans) → Prospect Elite');
  egal(profilDe('Fabian Lysell').profil, 'Prospect Playmaker', 'Lysell → Prospect Playmaker');
  egal(profilDe('Rutger McGroarty').profil, 'Prospect Power Forward', 'McGroarty → Prospect Power Forward');
  egal(profilDe('Rutger McGroarty').mat, 'POWERFWD', 'Prospect Power Forward → matrice POWERFWD');
  egal(profilDe('Ryan Merkley').profil, 'DEliteQB', 'Merkley → DEliteQB');
  egal(profilDe('Quinn Hughes').profil, 'DEliteQB', 'Quinn Hughes → DEliteQB');
  egal(profilDe('Chris Bigras').profil, 'DEliteShutdown', 'Bigras → DEliteShutdown');
  egal(profilDe('Travis Sanheim').profil, 'DEliteShutdown', 'Sanheim → DEliteShutdown');
  egal(profilDe('Lian Bichsel').profil, 'Prospect DEliteShutdown', 'Bichsel (22 ans) → Prospect DEliteShutdown');
  egal(profilDe('Cam York').profil, 'DOffensive', 'York → DOffensive');
  egal(profilDe('Eamon Powell').profil, 'Prospect DOffensive', 'Powell (24 ans) → Prospect DOffensive');
  egal(profilDe('Chris Gibson').profil, 'Starter Goalie', 'Gibson (OV 83) → Starter Goalie');
  tableauEgal(profilDe('Chris Gibson').stats, ['hs','svpct','qggp','ming'], 'Stats Starter = HS, SV%, DQ/M, MIN');
  egal(profilDe('Kevin Lankinen').profil, 'Backup Goalie', 'Lankinen (OV 79) → Backup Goalie');
  tableauEgal(profilDe('Kevin Lankinen').stats, ['mp','qggp','psv'], 'Stats Backup = MP, DQ/M, Psv');
  // profils absents du club : couverts par des joueurs des autres équipes
  const ligueDe = (eq, nom) => S.joueursEquipe(eq).find(j => j.nom === nom);
  egal(S.determinerProfil(ligueDe('SANJOSE','Jesperi Kotkaniemi')).profil, 'Elite', 'Kotkaniemi → Elite');
  egal(S.determinerProfil(ligueDe('SANJOSE','Jesperi Kotkaniemi')).mat, 'ELITE', 'Elite → matrice ELITE');
  egal(S.determinerProfil(ligueDe('NEWJERSEY','Jakub Lauko')).profil, 'Grinder', 'Lauko → Grinder');
  egal(S.determinerProfil(ligueDe('BOSTON','Anthony Cirelli')).profil, 'Two-Way Forward', 'Cirelli → Two-Way Forward');
  egal(S.determinerProfil(ligueDe('NEWJERSEY','Matthew Tkachuk')).profil, 'Power Forward', 'Tkachuk → Power Forward');
  egal(S.determinerProfil(ligueDe('NEWJERSEY','Olen Zellweger')).profil, 'Prospect DEliteQB', 'Zellweger (23 ans) → Prospect DEliteQB');

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
    // dès que les statistiques fournissent des patineurs avec un différentiel, le rang se calcule seul
    const patineursRoster = SECOURS.filter(x9=>x9.po!=='G');
    const scoringFictif = patineursRoster.map((x9,i9)=>({
      nom:x9.nom, gp:10, goals:i9%4, assists:i9%5, pts:(i9%4)+(i9%5), shots:20+i9,
      pim:2, plusminus:(patineursRoster.length-1)/2 - i9, ppg:1, gwg:1
    }));
    poserStatsClub(scoringFictif);
    egal(ETAT2.enSaison, true, 'Des matchs joués : la saison est en cours');
    egal(ETAT2.scoring.patineurs.length, patineursRoster.length, 'Les statistiques du club sont la tranche TORONTO de celles de la ligue');
    const rangsAuto = S.calculerPmRangs(ETAT2.scoring.patineurs);
    egal(rangsAuto.size, patineursRoster.length, 'Tous les patineurs qualifiés sont classés automatiquement');
    const meilleur = patineursRoster[0];
    const rMeilleur = rangsAuto.get(S.normaliserNom(meilleur.nom));
    egal(rMeilleur?.rang, 1, 'Le meilleur différentiel du club obtient le 1er rang');
    proche(S.valeurStat(meilleur, {gp:10}, 'pmrang', {pmRangs:rangsAuto}), 1, 1e-9,
      'valeurStat lit la proportion de rang sans intervention');
    // un joueur évalué sur le rang +/- reçoit un statut réel dans l'interface re-rendue
    const jPm = ETAT2.roster.find(x9=>x9._profil?.stats?.includes('pmrang'));
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
    viderStats();
    W.document.querySelector('#progFiltres button[data-f="tous"]').click(); // retour à l'état initial
  }

  console.log('— Adresses de ushl.ca : l\'API d\'abord');
  {
    egal(S.CONFIG.equipe, 'TORONTO', 'Équipe configurée : TORONTO');
    ok(S.REQUETES_API.joueurs.includes('/jamesishot/api/?api=search') && S.REQUETES_API.joueurs.includes('length=-1'),
      'Tous les joueurs de la ligue en une requête à l\'API');
    ok(S.REQUETES_API.patineurs.includes('api=stats') && !S.REQUETES_API.patineurs.includes('goalie'), 'Statistiques des patineurs : API');
    ok(S.REQUETES_API.gardiens.includes('api=stats') && S.REQUETES_API.gardiens.includes('type=goalie'), 'Statistiques des gardiens : API');
    ok(Object.values(S.REQUETES_API).every(u => u.startsWith('https://ushl.ca/')), 'L\'API est jointe directement, sans relais');
    ok(S.URLS_USHL.fiche('Connor Bedard').endsWith('CareerStatsPlayer.php?csName=Connor%20Bedard'), 'Adresse de la fiche d\'un joueur');
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
  const jz = joueurDe('Connor Bedard'); // Prospect Elite → matrice ELITE, OV 82
  jz._profil = S.determinerProfil(jz);
  let s = S.seuilsPour(jz, 'pts', {}, {});
  tableauEgal(s.seuils, [97,86,74,63,37,-1], 'Seuils Y17 par défaut (OV 82)');
  egal(s.source, 'Y17', 'Source = Y17');
  const perso = {ELITE: {pts: {82: [100,90,80,70,40,-1]}}};
  s = S.seuilsPour(jz, 'pts', perso, {});
  tableauEgal(s.seuils, [100,90,80,70,40,-1], 'La rangée personnalisée remplace Y17');
  egal(s.source, 'personnalisée', 'Source = personnalisée');
  s = S.seuilsPour(jz, 'pts', {}, {[S.normaliserNom(jz.nom)]: {pts: 120}});
  egal(s.seuils[0], 120, 'La surcharge fixe le seuil Mémorable');
  egal(s.seuils[2], 74, 'Les autres degrés restent ceux de la matrice');

  console.log('— API de ushl.ca : joueurs (réponses réelles abrégées)');
  const apiJoueurs = [
    {type:'Pro', team:'TORONTO', number:'22', name:'Barrett Hayton', position:'C', hand:'L', condition:'OK', injStatus:'',
     it:'71', sp:'87', st:'81', en:'88', du:'82', di:'78', sk:'81', pa:'82', pc:'77', df:'60', sc:'77', ex:'65', ld:'43', ov:'81', age:'26', ct:'2', salary:'9075000'},
    {type:'Pro', team:'TORONTO', number:'70', name:'Vassili Zaitsev', position:'LW', hand:'L', condition:'94', injStatus:'1W',
     it:'70', sp:'86', st:'65', en:'92', du:'81', di:'87', sk:'84', pa:'78', pc:'79', df:'57', sc:'81', ex:'60', ld:'50', ov:'80', age:'25', ct:'3', salary:'5750000'},
    {type:'Pro', team:'TORONTO', number:'41', name:'Chris Gibson', position:'G', hand:'L', condition:'OK', injStatus:'',
     it:'83', sp:'91', st:'92', en:'89', du:'83', di:'78', sk:'90', pa:'63', pc:'86', df:'NA', sc:'NA', ex:'89', ld:'67', ov:'83', age:'34', ct:'1', salary:'8450000'},
    {type:'Pro', team:'BOSTON', number:'', name:'Rachat Schmidt', position:'D', hand:'L', condition:'OK', injStatus:'',
     it:'0', sp:'0', st:'0', en:'0', du:'0', di:'0', sk:'0', pa:'0', pc:'0', df:'0', sc:'0', ex:'0', ld:'0', ov:'60', age:'30', ct:'1', salary:'1000000'},
    {type:'Farm', team:'TORONTO', number:'10', name:'Joueur Ecole', position:'RW', hand:'R', condition:'OK', injStatus:'',
     it:'68', sp:'76', st:'74', en:'79', du:'77', di:'78', sk:'72', pa:'75', pc:'64', df:'68', sc:'72', ex:'48', ld:'37', ov:'75', age:'22', ct:'2', salary:'75000'},
    {type:'Prospect', team:'TORONTO', number:'', name:'', position:'N/A', hand:'N/A', condition:'', injStatus:'',
     it:0, sp:0, st:0, en:0, du:0, di:0, sk:0, pa:0, pc:0, df:0, sc:0, ex:0, ld:0, ov:0, age:null, ct:null, salary:null}
  ];
  const eqApi = S.equipesDepuisApi(apiJoueurs);
  egal(eqApi.TORONTO.length, 3, 'Seul le grand club est retenu (club-école et espoirs écartés)');
  const hApi = eqApi.TORONTO[0];
  egal(hApi.nom, 'Barrett Hayton', 'Nom du premier joueur');
  egal(hApi.salaire, 9075000, 'Salaire en dollars');
  egal(hApi.no, 22, 'Numéro de chandail fourni par l\'API');
  egal(hApi.hd, 'G', 'Main L → G (gaucher), comme sur la page française du site');
  egal(hApi.sc, 77, 'Cote SC lue');
  egal(hApi.cd, null, 'Condition «OK» → null');
  egal(eqApi.TORONTO[1].po, 'AG', 'Position LW → AG');
  egal(eqApi.TORONTO[1].ij, '1W', 'Blessure relevée (1W)');
  egal(eqApi.TORONTO[1].cd, 94, 'Condition physique relevée');
  egal(eqApi.TORONTO[2].df, null, 'DF du gardien = NA → null');
  egal(eqApi.TORONTO[2].sc, null, 'SC du gardien = NA → null');
  ok(eqApi.BOSTON.some(j=>S.estFictif(j.nom)), 'Une ligne comptable (rachat) arrive de l\'API…');
  S.poserLigue(eqApi, {date: '2026-11-13T12:00:00Z', origine: 'direct'});
  egal(S.joueursEquipe('BOSTON').length, 0, '… et disparaît à l\'installation dans l\'application');
  egal(S.joueursEquipe('TORONTO')[0]._profil.profil, 'Playmaker', 'Le profil est déterminé à l\'installation');
  egal(S.ETAT.ligue.origine, 'direct', 'Provenance : direct');
  S.restaurerDonnees();   // retour au relevé figé
  egal(S.joueursEquipeBrut('TORONTO').length, 20, 'Retour au relevé intégré');

  console.log('— API de ushl.ca : statistiques');
  const apiPatineurs = [
    {number:'98', team:'TORONTO', teamAbbr:' TOR', position:'LW', rookieStatus:false, name:'Connor Bedard', gamesPlayed:' 14', goals:' 6',
     assists:' 9', points:' 15', plusMinus:' -1', pim:' 8', ppg:' 1', shg:' 0', gwg:' 1', gtg:' 0', hits:' 23', shots:' 37', shotPct:' 16,2'},
    {number:'9', team:'TORONTO', teamAbbr:' TOR', position:'RW', rookieStatus:false, name:'Backup_RW', gamesPlayed:' 3', goals:' 0',
     assists:' 0', points:' 0', plusMinus:' 0', pim:' 0', ppg:' 0', shg:' 0', gwg:' 0', gtg:' 0', hits:' 0', shots:' 0', shotPct:' 0,0'}
  ];
  const apiGardiens = [
    {number:'32', team:'TORONTO', teamAbbr:' TOR', position:'G', name:'Kevin Lankinen', gamesPlayed:' 7', minutes:' 87', gaa:' 2,07',
     wins:' 1', losses:' 0', ties:' 0', shutouts:' 0', savesAttempted:' 47', goalsAgainst:' 3', savePct:' ,936', pim:' 0', assists:' 0'}
  ];
  const sp = S.patineursDepuisApi(apiPatineurs), sg = S.gardiensDepuisApi(apiGardiens);
  egal(sp.length, 1, 'Un patineur (le Backup_ du simulateur est écarté)');
  egal(sp[0].pts, 15, 'Points de Bedard');
  egal(sp[0].plusminus, -1, 'Différentiel de Bedard (négatif)');
  egal(sp[0].gwg, 1, 'Buts gagnants');
  egal(sp[0].hits, 23, 'Mises en échec');
  egal(sg[0].w, 1, 'Victoires de Lankinen');
  ok(Math.abs(sg[0].avg - 2.07) < 1e-9, 'Moyenne «2,07» (virgule décimale du site)');
  ok(Math.abs(sg[0].svpct - 0.936) < 1e-9, '% d\'arrêts «,936» → 0,936');
  egal(sg[0].mp, 87, 'Minutes du gardien');
  tableauEgal(S.decompacter(S.CLES_PATINEUR, S.compacter(S.CLES_PATINEUR, sp[0])), sp[0], 'Format compact : aller-retour sans perte');

  console.log('— Classement : page officielle, ou calcul depuis les statistiques');
  const rangee = (rang, code, c) => `<tr><td>${rang}</td><td></td><td class="text-left"><a style="display:block" href="TeamRosters.php?team=${code}">${code}</a></td>`
    + c.map(v=>`<td>${v}</td>`).join('') + '</tr>';
  const pageClassement = `<div class = "tableau-top">Eastern Association</div><table><tr><th></th><th></th><th>ÉQUIPE</th><th>GP</th></tr>`
    + rangee(1, 'BOSTON', [14,9,2,3,0,21,62,42,'+20',',750','7-1-2','W1'])
    + `<tr class="tableau-top"><td colspan="15"></td></tr>`
    + rangee(2, 'TORONTO', [14,4,9,1,0,9,51,55,'-4',',321','3-7-0','W1']) + `</table>`
    + `<div class = "tableau-top">Western Association</div><table>` + rangee(1, 'ST.LOUIS', [14,5,7,2,1,13,44,47,'-3',',464','3-5-2','L1']) + `</table>`
    + `<div class = "tableau-top">Atlantic Section</div><table>` + rangee(1, 'BOSTON', [14,9,2,3,0,21,62,42,'+20',',750','7-1-2','W1'])
    + rangee(2, 'TORONTO', [14,4,9,1,0,9,51,55,'-4',',321','3-7-0','W1']) + `</table>`
    + `<div class = "tableau-top">Central Section</div><table>` + rangee(1, 'ST.LOUIS', [14,5,7,2,1,13,44,47,'-3',',464','3-5-2','L1']) + `</table>`;
  const fichesOff = S.parseClassement(pageClassement);
  egal(fichesOff.length, 3, 'Une fiche par équipe (les tableaux d\'association et de section se recoupent)');
  const fTor = fichesOff.find(f=>f.equipe==='TORONTO');
  tableauEgal([fTor.gp, fTor.w, fTor.l, fTor.t, fTor.otl, fTor.pts, fTor.gf, fTor.ga], [14,4,9,1,0,9,51,55], 'Fiche de TORONTO lue');
  egal(fTor.conf, 'Eastern', 'Association relevée du titre du tableau');
  egal(fTor.div, 'Atlantic', 'Section relevée du titre du tableau');
  egal(fTor.l10, '3-7-0', 'Dix derniers matchs');
  egal(fTor.serie, 'W1', 'Série en cours');
  egal(fichesOff.find(f=>f.equipe==='ST.LOUIS').div, 'Central', 'Code d\'équipe avec un point (ST.LOUIS)');
  const fichesCalc = S.classementDepuisStats(
    [{nom:'A', equipe:'TORONTO', goals:3}, {nom:'B', equipe:'TORONTO', goals:2}, {nom:'C', equipe:'BOSTON', goals:4}],
    [{nom:'G1', equipe:'TORONTO', w:4, l:5, t:1, ga:20}, {nom:'G2', equipe:'TORONTO', w:0, l:4, t:0, ga:35}, {nom:'G3', equipe:'BOSTON', w:9, l:2, t:3, ga:42}]);
  const cTor = fichesCalc.find(f=>f.equipe==='TORONTO');
  tableauEgal([cTor.w, cTor.l, cTor.t, cTor.gp, cTor.pts], [4,9,1,14,9], 'Fiche calculée = somme des décisions des gardiens ; 2 pts par victoire, 1 par nulle');
  tableauEgal([cTor.gf, cTor.ga], [5,55], 'Buts pour (patineurs) et contre (gardiens)');
  egal(S.classementTrie(fichesCalc)[0].equipe, 'BOSTON', 'Classement trié aux points');

  console.log('— Parseur XtraStats (fixture texte)');
  const fixtureXtra = [
    '    Player                    Team            POS GP   G   A   P  Sh PiM   MP   H Sh/G',
    '    [Connor Bedard](https://x/#Connor Bedard) TORONTO         C   82  40  55  95 250  20 1700  60 3.05',
    '    [Alex Tuch](https://x/#Alex Tuch) ANAHEIM         RW  77  27  32  59 183  16 1503 243 2.38',
    '    [* Backup_RW](https://x/#Backup_RW) TORONTO         LW   3   0   0   0   0   0    0   0 0.00'
  ].join('\n');
  const x = S.parseXtra(fixtureXtra, 'TORONTO');
  egal(x.length, 1, 'Un patineur TORONTO extrait (Anaheim et le Backup_ exclus)');
  egal(x[0].hits, 60, 'MEÉ de Bedard depuis XtraStats');
  egal(x[0].mp, 1700, 'Minutes de Bedard depuis XtraStats');
  egal(S.minutesDepuisXtra(S.parseXtraLigue(fixtureXtra))[S.cleJoueur('Alex Tuch', 'ANAHEIM')], 1503, 'Minutes indexées par joueur et équipe');

  console.log('— Rendu de l\'interface');
  const doc = W.document;
  const rangees = doc.querySelectorAll('#tableAlignement tbody tr');
  egal(rangees.length, 20, '20 rangées dans la table d\'alignement');
  {
    const ligneGibson = [...rangees].find(r=>r.textContent.includes('Chris Gibson'));
    ok(ligneGibson && !ligneGibson.textContent.includes('~'), 'Plus de tilde : OV du gardien relevé du site (83)');
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
  ok(doc.querySelector('#sourcesTexte').textContent.includes('gestiongardiens'), 'Source des limites des gardiens documentée');
  ok(doc.querySelector('#sourcesTexte').textContent.includes('API de ushl.ca'), 'L\'API de ushl.ca est documentée comme source principale');
  const boutonDiff = doc.querySelector('#progFiltres button[data-f="difficulte"]');
  ok(!!boutonDiff, 'Filtre «En difficulté» présent');

  console.log('— Masse salariale (cohérence)');
  const actifs = SECOURS;
  const comptabilises = actifs.filter(x2 => x2.ct > 0);
  egal(comptabilises.length, 19, '19 joueurs sous contrat — seul Sanheim est échu (site du 6 septembre)');
  const masse = comptabilises.reduce((s2, x2) => s2 + x2.salaire, 0);
  egal(masse, 93950000, 'Masse salariale des 19 joueurs sous contrat = 93 950 000 $ (salaires du site)');
  ok(!doc.querySelector('#alignSommaire .carte-masse').classList.contains('alerte'), 'Sous le plafond de 104 M$ : aucune alerte');
  ok(doc.querySelector('#alignSommaire .carte-masse .det').textContent.replace(/\s/g,'').includes('104000000'), 'Plafond affiché = 104 000 000 $');

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
  // Format et parsing des montants
  egal(S.parseArgent('8,5 M'), 8500000, 'parseArgent «8,5 M» = 8 500 000');
  egal(S.parseArgent('900 k'), 900000, 'parseArgent «900 k» = 900 000');
  egal(S.parseArgent('7500000'), 7500000, 'parseArgent «7500000» = 7 500 000');
  egal(S.fmtArgentCourt(8500000), '8,5 M', 'fmtArgentCourt 8,5 M');
  egal(S.fmtArgentCourt(900000), '900 k', 'fmtArgentCourt 900 k');

  console.log('— Fenêtre «Prolongation de contrat» : éligibilité, ouverture, bornage, impact, retrait');
  W.localStorage.removeItem('tml_resignatures_v1:TORONTO');
  S.ouvrirVue('alignement');
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
  ok(doc.querySelector('#alignSommaire .carte-masse .det').textContent.includes('prolongé'), 'Mention «prolongé» dans le sommaire de masse');
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
  W.localStorage.removeItem('tml_resignatures_v1:TORONTO');

  console.log('— Divers');
  egal(S.matchsEquipe(), 0, 'Fiche 0-0-0 → 0 match d\'équipe');
  egal(S.echap('<b nom="a&b">'), '&lt;b nom=&quot;a&amp;b&quot;&gt;', 'echap neutralise le HTML');

  console.log('— Production d\'un joueur : statistiques de l\'API et minutes de XtraStats');
  {
    const jBedard = SECOURS.find(x2=>x2.nom==='Connor Bedard');
    const jGibson = SECOURS.find(x2=>x2.nom==='Chris Gibson');
    egal(S.productionDe(jBedard), null, 'Avant-saison, sans statistiques : aucune production');
    poserStatsClub(
      [{nom:'Connor Bedard', pos:'C', gp:12, goals:8, assists:9, pts:17, plusminus:3, pim:4, ppg:2, shg:0, gwg:1, hits:10, shots:40},
       {nom:'Mathew Barzal', equipe:'ISLANDERS', pos:'C', gp:12, goals:2, assists:10, pts:12, plusminus:1, pim:0, ppg:0, shg:0, gwg:0, hits:5, shots:20}],
      [{nom:'Chris Gibson', gp:9, mp:540, avg:2.31, w:6, l:2, t:1, so:1, sa:270, ga:21, svpct:0.922}]);
    let prod = S.productionDe(jBedard);
    egal(prod.pts, 17, 'Points lus des statistiques de la saison');
    egal(prod.gwg, 1, 'Buts gagnants fournis par l\'API');
    egal(prod.mp, null, 'Minutes jouées inconnues tant que XtraStats n\'est pas lu');
    egal(S.valeurStat(jBedard, prod, 'shots20', {}), null, 'Sans minutes, les tirs par 20 minutes restent à définir');
    proche(prod.shotpct, 20, 1e-9, '% de tirs dérivé (8 buts sur 40 tirs)');
    egal(prod._reference, false, 'Production de la saison en cours, pas un repère');
    S.poserXtra(S.parseXtraLigue('Connor Bedard  TORONTO  C  12  8  9  17  40  4  250  10 3.33'), '11/12/2026');
    prod = S.productionDe(jBedard);
    egal(prod.mp, 250, 'Minutes jouées ajoutées par XtraStats');
    proche(S.valeurStat(jBedard, prod, 'shots20', {}), 3.2, 1e-9, 'Tirs par 20 minutes : 40 tirs en 250 minutes');
    egal(S.ETAT.minutes.date, '11/12/2026', 'Date de la page XtraStats retenue');
    egal(S.ETAT.reference, null, 'En saison, XtraStats n\'est pas un repère de la saison précédente');
    const pg = S.productionDe(jGibson);
    tableauEgal([pg.gp, pg.w, pg.l, pg.t, pg.so, pg.mp], [9,6,2,1,1,540], 'Gardien : fiche, blanchissages et minutes de l\'API');
    egal(pg.hs, 1, 'Statistique HS du gardien = blanchissages');
    // un joueur fraîchement échangé garde ses statistiques, restées sous son ancien club
    const jBarzal = SECOURS.find(x2=>x2.nom==='Mathew Barzal');
    egal(S.productionDe(jBarzal)?.pts, 12, 'Joueur échangé : statistiques retrouvées par son nom');
    // les 32 équipes : la production d'un joueur d'un autre club se lit de la même façon
    egal(S.productionDe({nom:'Mathew Barzal', po:'C'}, 'ISLANDERS').assists, 10, 'Production d\'un joueur d\'une autre équipe');
    // fiche du club calculée des décisions de ses gardiens, faute de classement officiel
    egal(S.ETAT.fiche, 'TORONTO 6-2-1', 'Fiche du club = décisions de ses gardiens');
    egal(S.matchsEquipe(), 9, 'Matchs disputés par le club');
    S.rendreEntete();
    ok(doc.getElementById('rangEquipe').textContent.includes('13 pts'), 'Points au classement dans l\'en-tête');
    S.ouvrirVue('production');
    const lignesProd = [...doc.querySelectorAll('#tableProduction tbody tr')];
    ok(lignesProd[0].textContent.includes('Connor Bedard'), 'Table de production : meilleur pointeur en tête');
    ok(lignesProd.some(l=>l.classList.contains('total')), 'Rangée de total des patineurs');
    ok(lignesProd.some(l=>l.textContent.includes('Chris Gibson') && l.textContent.includes('2.31')), 'Gardiens à la suite, avec leur moyenne');
    doc.querySelector('#tableProduction th[data-col="hits"]').click();
    ok(doc.querySelector('#tableProduction th[data-col="hits"]').classList.contains('tri-actif'), 'Production triable par colonne');
    doc.querySelector('#tableProduction th[data-col="pts"]').click();
    viderStats();
    egal(S.ETAT.fiche, 'TORONTO 0-0-0', 'Retour à l\'avant-saison');
  }

  console.log('— Avant le premier match : la saison précédente sert de repère');
  {
    S.poserXtra([{nom:'Connor Bedard', equipe:'TORONTO', pos:'C', gp:82, goals:45, assists:55, pts:100, shots:260, pim:20, mp:1700, hits:60}], '7/1/2026');
    ok(!!S.ETAT.reference, 'Aucun match cette saison et XtraStats rempli : c\'est l\'archive de la saison précédente');
    const prodRef = S.productionDe(SECOURS.find(x2=>x2.nom==='Connor Bedard'));
    egal(prodRef?._reference, true, 'Production marquée comme repère');
    egal(prodRef?.pts, 100, 'Points de la saison précédente');
    egal(Object.keys(S.ETAT.minutes.parCle).length, 0, 'Ses minutes ne passent pas pour celles de la saison en cours');
    S.rendreProgression();
    const carteBedard = [...doc.querySelectorAll('#progGrille .joueur-carte')]
      .find(c=>c.querySelector('.jc-nom').textContent==='Connor Bedard');
    ok(carteBedard.textContent.includes('Repère : saison précédente'), 'Note de repère sur la carte');
    ok(carteBedard.querySelectorAll('.badge-etat.memorable').length >= 2,
       'Bedard Mémorable en points et en % de tirs (100 PTS > 97 ; 17,3 %T > 16 à OV 82)');
    ok(!S.alertesDG().some(a=>a.texte.includes('sous les attentes')), 'Un repère ne déclenche aucune alerte de rendement');
    // dès le premier match, la référence s'efface
    poserStatsClub([{nom:'Connor Bedard', pos:'C', gp:1, goals:1, assists:0, pts:1, plusminus:1, pim:0, ppg:0, shg:0, gwg:1, hits:2, shots:4}]);
    S.poserXtra([{nom:'Connor Bedard', equipe:'TORONTO', pos:'C', gp:1, goals:1, assists:0, pts:1, shots:4, pim:0, mp:19, hits:2}], '10/9/2026');
    egal(S.ETAT.reference, null, 'Saison commencée : plus de repère');
    egal(S.productionDe(SECOURS.find(x2=>x2.nom==='Connor Bedard')).mp, 19, 'XtraStats redevient la source des minutes');
    viderStats();
    S.rendreProgression();
  }

  console.log('— Données conservées dans le navigateur');
  {
    egal(W.localStorage.getItem('tml_cache_v1'), null, 'L\'ancienne cache de pages HTML brutes est purgée à l\'ouverture');
    const date = new Date(Date.now() - 3600*1000).toISOString();
    S.poserLigue({TORONTO: SECOURS.slice(0, 12)}, {date, origine: 'direct'});
    S.memoriserLigue({TORONTO: SECOURS.slice(0, 12)}, date);
    egal(S.litInstantane().equipes.TORONTO.length, 12, 'Une lecture de ushl.ca est conservée sous forme compacte');
    ok(Array.isArray(S.litInstantane().equipes.TORONTO[0]), 'Format compact : un tableau par joueur');
    S.restaurerDonnees();
    egal(S.ETAT.ligue.origine, 'conserve', 'Plus récente que le relevé intégré : c\'est elle qui s\'affiche à l\'ouverture');
    egal(S.joueursEquipeBrut('TORONTO').length, 12, 'Formation du club tirée de la lecture conservée');
    egal(S.joueursEquipeBrut('BOSTON')[0]._origine, 'releve', 'Une équipe absente de la lecture conservée vient du relevé intégré');
    ok(S.sourceLisible().startsWith('dernière lecture de ushl.ca'), 'L\'en-tête annonce une lecture conservée');
    W.localStorage.setItem('tml_proxy_prefere_v1', '2');
    W.confirm = () => true;
    S.ouvrirVue('reglages');
    ok(doc.getElementById('donneesEtat').textContent.includes('conservée dans ce navigateur'), 'Réglages : provenance des données affichée');
    doc.getElementById('btnViderCache').click();
    egal(W.localStorage.getItem(S.CLES_LS.instantane), null, 'Lecture conservée effacée');
    egal(W.localStorage.getItem(S.CLES_LS.cache), null, 'Cache de données effacée');
    egal(W.localStorage.getItem('tml_proxy_prefere_v1'), null, 'Relais préféré réinitialisé');
    egal(S.ETAT.ligue.origine, 'releve', 'Retour au relevé intégré');
    egal(S.joueursEquipeBrut('TORONTO').length, 20, 'Formation complète du relevé');
    S.ouvrirVue('alignement');
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
  // (les OV affichés sont relevés du site ; les 13 cotes des fichiers peuvent
  // retarder d'une recote — plus de test de cohérence arrondi = affiché)
  // ancre 50 partout et gardiens
  proche(S.ovDetaille(versCotes(Array(13).fill(50)),'F').arrondi, 55, 0,
    'Patineur 50 partout → OV 55');
  egal(S.ovDetaille(SECOURS.find(j=>j.nom==='Chris Gibson'),'F'), null,
    'Gardien (df et sc nuls) → null : formule non couverte');

  console.log('— Calculateur OV détaillé : interface');
  ok(!!doc.querySelector('.sous-nav button[data-sous="ovdetail"]'), 'Sous-vue OV détaillé présente (section Analyse)');
  const selOvd = doc.getElementById('ovdJoueur');
  egal(selOvd.querySelectorAll('option').length, 18,
    'Sélecteur : 17 patineurs + saisie manuelle (gardiens exclus)');
  egal(doc.querySelectorAll('#ovdGrille input').length, 13, '13 champs de cotes');
  selOvd.value = 'Connor Bedard';
  selOvd.dispatchEvent(new W.Event('change'));
  egal(doc.getElementById('ovdGroupe').value, 'F', 'Bedard chargé comme attaquant');
  egal(doc.getElementById('ovd_sc').value, '85', 'Cote OF de Bedard chargée');
  egal(doc.getElementById('ovdArrondi').textContent, '82', 'OV arrondi de Bedard = 82');
  const bedardSecours = SECOURS.find(j=>j.nom==='Connor Bedard');
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
  champRecherche.value = 'deliteqb';
  champRecherche.dispatchEvent(new W.Event('input'));
  egal(doc.querySelectorAll('#tableAlignement tbody tr').length, 2, 'Filtre par profil «deliteqb» → Hughes et Merkley');
  champRecherche.value = '';
  champRecherche.dispatchEvent(new W.Event('input'));
  egal(doc.querySelectorAll('#tableAlignement tbody tr').length, 20, 'Filtre effacé → 20 rangées');

  console.log('— Export CSV de l\'alignement');
  const csv = S.exporterCSV();
  const lignesCSV = csv.split('\n');
  egal(lignesCSV.length, 21, '21 lignes : en-tête + 20 joueurs');
  ok(lignesCSV[0].startsWith('Nom;No;PO;HD;Age;'), 'En-tête CSV (séparateur point-virgule)');
  const ligneHayton = lignesCSV.find(l=>l.startsWith('Barrett Hayton;'));
  ok(!!ligneHayton, 'Rangée de Hayton présente');
  ok(ligneHayton.includes(';9075000;2'), 'Salaire et contrat de Hayton exportés (valeurs du site)');
  ok(ligneHayton.includes(';Playmaker;'), 'Profil exporté');

  console.log('— Projection du plafond salarial');
  const proj = S.projectionPlafond(5, {});
  egal(proj.length, 5, 'Cinq saisons projetées');
  egal(proj[0].saison, 'Y22', 'La projection démarre à la saison Y22');
  egal(proj[0].masse, 93950000, 'Masse Y22 = masse salariale actuelle (site)');
  egal(proj[0].engages, 19, '19 joueurs sous contrat en Y22');
  egal(proj[0].marge, 104000000 - 93950000, 'Marge Y22 sous le plafond de 104 M$');
  egal(proj[1].masse, 52975000, 'Masse Y23 = les 10 contrats de 2 ans et plus');
  egal(proj[1].engages, 10, 'Dix joueurs encore sous contrat en Y23');
  egal(proj[2].masse, 32950000, 'Masse Y24 = les 6 contrats de 3 ans et plus');
  egal(proj[3].masse, 6250000, 'Y25 : seul Barzal (5 ans) est encore engagé');
  egal(proj[0].expirants.length, 9, '9 contrats expirent après la Y22');
  ok(proj[0].expirants.includes('Chris Gibson'), 'Gibson dans les contrats qui expirent après la Y22');
  tableauEgal(proj[1].expirants.sort(), ['Barrett Hayton','Gabriel Perreault','Michael Hrabal','Ryan Merkley'],
    'Hayton, Perreault, Hrabal et Merkley expirent après la Y23');
  // rendu de la vue
  S.ouvrirVue('plafond');
  egal(doc.querySelectorAll('#tablePlafond tbody tr').length, 5, 'Table de projection : 5 rangées');
  ok(doc.querySelector('#plafondSommaire').textContent.includes('Masse Y22'), 'Sommaire de la projection rendu');
  ok(doc.querySelector('#tablePlafond').textContent.includes('Chris Gibson'), 'Expirants listés dans la table');

  console.log('— Comparateur de joueurs');
  S.ouvrirVue('comparateur');
  const selA = doc.getElementById('compA'), selB = doc.getElementById('compB');
  egal(selA.options.length, 20, 'Sélecteur A : 20 joueurs');
  egal(selB.options.length, 20, 'Sélecteur B : 20 joueurs');
  egal(selA.value, 'Chris Bigras', 'Joueur A par défaut = meilleur OV du club (Bigras, 88)');
  egal(selB.value, 'Quinn Hughes', 'Joueur B par défaut = deuxième OV du club (Hughes, 84)');
  selA.value = 'Connor Bedard'; selA.dispatchEvent(new W.Event('change'));
  selB.value = 'Matvei Michkov'; selB.dispatchEvent(new W.Event('change'));
  const zone = doc.getElementById('compZone');
  ok(zone.textContent.includes('Connor Bedard') && zone.textContent.includes('Matvei Michkov'),
    'Les deux joueurs choisis sont affichés');
  egal(zone.querySelectorAll('.comp-barre').length, 28, '14 cotes × 2 barres (13 cotes + OV)');
  ok((zone.textContent.match(/Prospect Elite/g)||[]).length >= 2,
    'Profils des deux joueurs affichés (tous deux Prospect Elite)');
  ok(zone.querySelector('.comp-pied').textContent.includes('Statistiques évaluées'),
    'Statistiques évaluées par profil listées au pied');
  // le plus fort sur une cote est marqué : Bedard SC 84 = Michkov SC 84 → égalité, les deux gagnent
  // vérifions une cote asymétrique : PC 81 (Bedard) vs 82 (Michkov)
  {
    const lignes = [...zone.querySelectorAll('.comp-mid')].map(x=>x.textContent);
    ok(lignes.some(t=>t.includes('PC')), 'Ligne de la cote PC présente');
  }

  console.log('— Base de données de la ligue (relevé du site + base S21)');
  egal(S.LIGUE_EQUIPES.length, 32, '32 équipes dans la base de la ligue');
  ok(S.LIGUE_EQUIPES.includes('TORONTO') && S.LIGUE_EQUIPES.includes('ST.LOUIS'), 'TORONTO et ST.LOUIS présents');
  egal(Object.values(S.USHL_RELEVE.equipes).reduce((a,t)=>a+t.length,0), 609, '609 joueurs relevés sur le site le 6 septembre');
  egal(Object.keys(S.USHL_RELEVE.equipes).length, 32, 'Le relevé du site couvre les 32 équipes');
  egal(Object.values(S.LIGUE_S21).reduce((a,t)=>a+t.length,0), 821, '821 joueurs dans la base S21 des fichiers');
  egal(S.dateInstantane(), null, 'Aucune lecture conservée dans ce navigateur pour l\'instant');
  egal(S.DATE_S21, '10 juillet 2026', 'Date des fichiers de la ligue');
  ok(S.LIGUE_EQUIPES.every(e=>S.cotesDuSite(e)), 'Les 32 équipes servent des cotes venues du site');
  egal(S.joueursEquipe('TORONTO').length, 20, 'Mon club : la formation vivante (ETAT.roster) fait foi');
  const sanjose = S.joueursEquipe('SANJOSE');
  ok(sanjose.every(j=>!/^backup/i.test(j.nom.replace(/[\s_]/g,''))), 'Les joueurs Backup_ sont exclus du décodage');
  const foxSJ = sanjose.find(j=>j.nom==='Adam Fox');
  ok(!!foxSJ, 'Adam Fox trouvé chez SANJOSE');
  egal(foxSJ.ov, 82, 'OV de Fox (SANJOSE) = 82 — relevé du site');
  egal(foxSJ._profil.profil, 'DEliteQB', 'Profil calculé pour un joueur d\'une autre équipe');
  const kotkaSJ = sanjose.find(j=>j.nom==='Jesperi Kotkaniemi');
  egal(kotkaSJ.salaire, 9075000, 'Salaire de Kotkaniemi (SANJOSE) relevé du site');
  egal(kotkaSJ.ct, 2, 'Contrat de Kotkaniemi : 2 ans');
  const desrosiersSJ = sanjose.find(j=>j.nom==='Philippe Desrosiers');
  egal(desrosiersSJ.df, null, 'DF des gardiens décodé à null');
  egal(desrosiersSJ.ovEstime, undefined, 'OV du gardien relevé du site : pas une estimation');
  egal(desrosiersSJ._origine, 'releve', 'Les joueurs du relevé intégré portent leur provenance');
  ok(S.joueursEquipe('SANJOSE') === S.joueursEquipe('SANJOSE'), 'Une équipe est décodée une seule fois, pas à chaque consultation');
  ok(S.joueursLigue() === S.joueursLigue(), 'La liste de la ligue est mise en mémoire tant que rien ne change');
  egal(S.joueursLigue().length, 609, 'Les 609 joueurs de la ligue, étiquetés de leur équipe');
  // la base S21 reste consultable : c'est le côté «avant» des recotes
  const tampaS21 = S.decoderEquipe('TAMPABAY');
  ok(tampaS21.length > 0, 'La base S21 reste consultable équipe par équipe');
  ok(tampaS21.every(j=>j._origine === 's21'), 'Ses joueurs portent la provenance s21');
  const dansk = tampaS21.find(j=>j.po==='G');
  egal(dansk.ovEstime, true, 'OV des gardiens des fichiers S21 marqué estimé');
  ok(tampaS21.some(j=>j.nom==='Cam York'), 'Cam York était bien à TAMPABAY en S21');
  {
    const vus = new Map();
    let doublons = 0;
    for (const eq of S.LIGUE_EQUIPES)
      for (const j of S.joueursEquipe(eq)){
        const c = S.normaliserNom(j.nom);
        if (vus.has(c)) doublons++; else vus.set(c, eq);
      }
    egal(doublons, 0, 'Aucun joueur listé dans deux équipes à la fois');
  }
  egal(S.cotesDuSite('SANJOSE'), true, 'SANJOSE : cotes du site');
  egal(S.cotesDuSite('EQUIPE_INCONNUE'), false, 'Une équipe sans relevé ni fichiers : pas de cotes du site');
  egal(S.provenanceDe(foxSJ), 'relevé de ushl.ca du 6 septembre 2026', 'Provenance du relevé intégré');
  egal(S.provenanceDe(dansk), 'fichiers de la ligue du 10 juillet 2026 — périmé, à actualiser',
    'Provenance des fichiers S21');
  // rangées fictives : jamais dans les listes
  egal(S.estFictif('Backup_LW_Anaheim'), true, 'Backup_ = fictif');
  egal(S.estFictif('Rachat Dvorak'), true, 'Rachat = fictif');
  egal(S.estFictif('Retenue Hyman'), true, 'Retenue = fictif');
  egal(S.estFictif('Retenu Horvat'), true, 'Retenu (sans e) = fictif');
  egal(S.estFictif('Connor Bedard'), false, 'Un vrai joueur n\'est pas fictif');
  ok(S.joueursEquipe('ANAHEIM').every(j=>!S.estFictif(j.nom)),
    'Rachats, retenues et backups exclus des listes (ANAHEIM)');

  console.log('— Actualisation : toute la ligue en trois requêtes directes à l\'API');
  /* Réponses de l'API fabriquées à partir du relevé figé, dans le format du site. */
  const versApi = (equipes, retouche) => {
    const PO = {AG:'LW', AD:'RW'}, HD = {D:'R', G:'L'};
    const rangees = [];
    for (const code of Object.keys(equipes)){
      for (const t of equipes[code]){
        const j = S.decompacter(S.CLES_JOUEUR, t);
        const r = {type:'Pro', team:code, number:String(j.no ?? ''), name:j.nom, position:PO[j.po] || j.po, hand:HD[j.hd] || 'N/A',
          condition:'OK', injStatus:'', age:String(j.age), ct:String(j.ct), salary:String(j.salaire), ov:String(j.ov)};
        for (const c of ['it','sp','st','en','du','di','sk','pa','pc','df','sc','ex','ld']) r[c] = j[c] === null ? 'NA' : String(j[c]);
        if (retouche) retouche(r);
        rangees.push(r);
      }
    }
    return rangees;
  };
  /* Faux réseau : sert l'API de ushl.ca, refuse tout le reste (relais, limites). */
  const fauxReseau = (reponses, journal) => async url => {
    journal.push(String(url));
    const u = String(url);
    if (!u.startsWith(S.URLS_USHL.api)) throw new Error('hors ligne');
    const cle = u.includes('api=search') ? 'joueurs' : u.includes('type=goalie') ? 'gardiens' : 'patineurs';
    if (reponses[cle] === undefined) throw new Error('panne');
    return {ok:true, status:200, json: async () => ({data: reponses[cle]})};
  };
  const etatInitial = () => {
    W.localStorage.removeItem(S.CLES_LS.cache);
    W.localStorage.removeItem(S.CLES_LS.instantane);
    S.ETAT.classementOfficiel = null;
    S.restaurerDonnees();
    S.toutRendre();
  };
  {
    const fetchAvant = W.fetch;
    const journal = [];
    const joueursApi = versApi(S.USHL_RELEVE.equipes, r => {
      if (r.name === 'Jesperi Kotkaniemi'){ r.sp = '90'; r.ov = '84'; r.injStatus = 'DD'; }   // recoté depuis le relevé
    });
    joueursApi.push({type:'Pro', team:'SANJOSE', number:'', name:'Rachat Untel', position:'C', hand:'L', condition:'OK', injStatus:'',
      it:'0', sp:'0', st:'0', en:'0', du:'0', di:'0', sk:'0', pa:'0', pc:'0', df:'0', sc:'0', ex:'0', ld:'0', ov:'50', age:'30', ct:'1', salary:'500000'});
    W.fetch = fauxReseau({
      joueurs: joueursApi,
      patineurs: [{team:'TORONTO', position:'C', name:'Connor Bedard', gamesPlayed:' 3', goals:' 2', assists:' 1', points:' 3', plusMinus:' 1',
        pim:' 0', ppg:' 1', shg:' 0', gwg:' 1', hits:' 4', shots:' 9'}],
      gardiens: [{team:'TORONTO', position:'G', name:'Chris Gibson', gamesPlayed:' 3', minutes:' 180', gaa:' 2,00', wins:' 2', losses:' 1',
        ties:' 0', shutouts:' 0', savesAttempted:' 90', goalsAgainst:' 6', savePct:' ,933'}]
    }, journal);
    const rapport = await S.actualiserTout({forcer:true});
    const appelsApi = journal.filter(u=>u.startsWith(S.URLS_USHL.api));
    egal(appelsApi.length, 3, 'Trois requêtes à l\'API, pas une par équipe');
    ok(appelsApi.every(u=>u.startsWith('https://ushl.ca/')), 'L\'API est jointe directement (aucun relais)');
    egal(rapport.principal?.equipes, 32, 'Les 32 équipes lues d\'un coup');
    egal(rapport.erreur, null, 'Aucune erreur sur les données principales');
    ok(rapport.secondaires.some(x=>x.nom==='classement officiel' && !x.ok), 'Le classement officiel (relais) a échoué sans rien bloquer');
    egal(S.ETAT.ligue.origine, 'direct', 'La ligue affichée vient du direct');
    const kotkaDirect = S.joueursEquipe('SANJOSE').find(j=>j.nom==='Jesperi Kotkaniemi');
    egal(kotkaDirect.sp, 90, 'Cote SP recotée lue depuis ushl.ca (90, plus le relevé à 83)');
    egal(kotkaDirect.ov, 84, 'OV recoté lu depuis l\'API');
    egal(kotkaDirect.ij, 'DD', 'Blessure relevée');
    egal(kotkaDirect._origine, 'direct', 'Provenance : direct');
    ok(!S.joueursEquipe('SANJOSE').some(j=>S.estFictif(j.nom)), 'La ligne de rachat est écartée');
    egal(S.joueursEquipe('SANJOSE').length, sanjose.length, 'SANJOSE : même effectif, cotes du jour');
    egal(S.ETAT.fiche, 'TORONTO 2-1-0', 'Fiche du club calculée des décisions de ses gardiens');
    egal(S.productionDe(S.ETAT.roster.find(j=>j.nom==='Connor Bedard')).pts, 3, 'Statistiques de la saison installées');
    egal(doc.getElementById('etatDonnees').dataset.etat, 'direct', 'Pastille de l\'en-tête : direct');
    ok(doc.getElementById('sourceInfo').textContent.startsWith('ushl.ca en direct'), 'En-tête : «ushl.ca en direct»');
    ok(doc.getElementById('etatMaj').textContent.includes('classement officiel'), 'Note discrète : le classement officiel n\'a pas été relu');
    egal(doc.getElementById('btnMaj').disabled, false, 'Bouton Actualiser réactivé');
    // ce qui est lu est conservé, en format compact
    egal(S.equipesInstantane().length, 32, 'Les 32 équipes sont conservées dans le navigateur');
    ok(W.localStorage.getItem(S.CLES_LS.instantane).length < 120000, 'Lecture conservée : moins de 120 ko (plus de pages HTML brutes)');
    egal(S.litCache().stats.patineurs.length, 1, 'Statistiques conservées');
    // le comparateur affiche la provenance en direct
    S.ouvrirVue('comparateur');
    const selEqB0 = doc.getElementById('compEqB');
    selEqB0.value = 'SANJOSE'; selEqB0.dispatchEvent(new W.Event('change'));
    doc.getElementById('compB').value = 'Jesperi Kotkaniemi';
    doc.getElementById('compB').dispatchEvent(new W.Event('change'));
    ok(doc.getElementById('compZone').querySelector('.comp-pied').textContent.includes('ushl.ca, lu'),
      'Provenance du direct affichée au comparateur');
    // ouverture suivante, quelques minutes plus tard : rien n'est redemandé à l'API
    journal.length = 0;
    const rapport2 = await S.actualiserTout();
    egal(journal.filter(u=>u.startsWith(S.URLS_USHL.api)).length, 0, 'Lecture de moins de 5 minutes : l\'API n\'est pas rappelée');
    egal(rapport2.principal, 'récent', 'Rapport : données récentes');
    // le bouton, lui, relit toujours
    journal.length = 0;
    await S.actualiserTout({forcer:true});
    egal(journal.filter(u=>u.startsWith(S.URLS_USHL.api)).length, 3, 'Clic sur Actualiser : l\'API est relue');
    // site injoignable : on garde ce qu'on a et on le dit
    W.fetch = fauxReseau({}, journal);
    const rapport3 = await S.actualiserTout({forcer:true});
    ok(!!rapport3.erreur, 'Panne de l\'API signalée dans le rapport');
    egal(S.joueursEquipe('SANJOSE').find(j=>j.nom==='Jesperi Kotkaniemi').sp, 90, 'Les dernières données lues restent affichées');
    egal(doc.getElementById('etatDonnees').dataset.etat, 'erreur', 'Pastille de l\'en-tête : erreur');
    ok(doc.getElementById('etatMaj').textContent.includes('ushl.ca ne répond pas'), 'Message clair : ushl.ca ne répond pas');
    // réponse tronquée : jamais installée
    W.fetch = fauxReseau({joueurs: joueursApi.slice(0, 40), patineurs: [], gardiens: []}, journal);
    const rapport4 = await S.actualiserTout({forcer:true});
    ok(/incomplète/.test(rapport4.erreur || ''), 'Réponse incomplète de l\'API refusée');
    egal(S.joueursLigue().length, 609, 'La ligue en mémoire n\'est pas remplacée par une réponse tronquée');
    W.fetch = fetchAvant;
    selEqB0.value = 'TORONTO'; selEqB0.dispatchEvent(new W.Event('change'));
    etatInitial();
    egal(S.ETAT.ligue.origine, 'releve', 'Retour au relevé figé pour la suite');
  }

  console.log('— Relais : en course, le premier qui répond gagne');
  {
    const fetchAvant = W.fetch;
    const appels = [];
    const page = 'x'.repeat(600);
    // le 3e relais répond, les autres échouent
    W.fetch = async url => { appels.push(String(url)); if (String(url).includes('codetabs')) return {ok:true, status:200, text: async () => page}; throw new Error('panne'); };
    const texte = await S.lireViaRelais('https://ushl.ca/page');
    egal(texte, page, 'La page est rendue par le relais qui répond');
    egal(appels.length, S.CONFIG.relais.length, 'Sans relais préféré, tous partent ensemble');
    egal(W.localStorage.getItem(S.CLES_LS.relais), '2', 'Le relais gagnant est retenu');
    // la fois suivante, il part seul et suffit
    appels.length = 0;
    await S.lireViaRelais('https://ushl.ca/page');
    egal(appels.length, 1, 'Le relais retenu part seul et suffit');
    ok(appels[0].includes('codetabs'), 'C\'est bien le relais qui avait répondu');
    // s'il tombe, les autres prennent le relais sans attendre le délai
    appels.length = 0;
    W.fetch = async url => { appels.push(String(url)); if (String(url).includes('allorigins')) return {ok:true, status:200, text: async () => page}; throw new Error('panne'); };
    const debut = Date.now();
    await S.lireViaRelais('https://ushl.ca/page');
    ok(Date.now() - debut < 1000, 'Relais préféré en panne : les autres partent aussitôt');
    egal(W.localStorage.getItem(S.CLES_LS.relais), '0', 'Le nouveau gagnant est retenu');
    // une réponse invalide (page d'erreur du relais) ne passe pas
    W.fetch = async () => ({ok:true, status:200, text: async () => 'trop court'});
    let refuse = false;
    try { await S.lireViaRelais('https://ushl.ca/page'); } catch (e){ refuse = /aucun relais/.test(e.message); }
    ok(refuse, 'Aucune réponse valide : erreur claire');
    W.fetch = fetchAvant;
    W.localStorage.removeItem(S.CLES_LS.relais);
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
  ok(zone.querySelector('.comp-pied').textContent.includes('relevé de ushl.ca du 6 septembre 2026'),
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
  egal(doc.getElementById('ovdArrondi').textContent, '82', 'OV de Fox recalculé depuis ses cotes = 82');
  ok(doc.getElementById('ovdNote').textContent.includes('offensif'), 'Formule offensive retenue pour Fox');
  selOvdEq.value = 'TORONTO'; selOvdEq.dispatchEvent(new W.Event('change'));
  egal(doc.getElementById('ovdJoueur').options.length, 18, 'Retour au club : 17 patineurs + saisie manuelle');

  console.log('— Bâtisseur de trios');
  W.localStorage.removeItem('tml_trios_v1:TORONTO');
  S.ouvrirVue('trios');
  egal(doc.querySelectorAll('#triosZone .trio-bloc').length, 12, '12 blocs : 4 trios, 3 paires, gardiens, 2 AN, 2 IN');
  egal(doc.querySelectorAll('#triosZone select[data-slot]').length, 38, '38 postes à combler (20 + 18 unités spéciales)');
  egal(doc.getElementById('triosEtat').textContent, '0/12 attaquants · 0/6 défenseurs · 0/2 gardiens · 0/18 unités spéciales',
    'Compteur à zéro au départ');
  S.autoTrios();
  const t = S.litTrios();
  // le club ne compte que 10 attaquants : les deux ailes du 4e trio restent vides
  egal(Object.keys(t).length, 36, 'Remplissage par OV : 36 postes comblés (10 attaquants seulement au club)');
  egal(t['t1.c'], 'Connor Bedard', 'Trio 1, centre = meilleur C par OV (Bedard, 82)');
  egal(t['t1.ag'], 'Vassili Zaitsev', 'Trio 1, AG = meilleur ailier gauche (Zaitsev)');
  egal(t['t1.ad'], 'Matvei Michkov', 'Trio 1, AD = meilleur ailier droit (Michkov)');
  egal(t['t4.ag'], undefined, '4e trio : aile gauche vide, faute d\'ailiers au club');
  egal(t['p1.dg'], 'Chris Bigras', 'Paire 1 = meilleur défenseur (Bigras)');
  egal(t['g.g1'], 'Chris Gibson', 'Gardien partant = meilleur OV (Gibson)');
  egal(doc.getElementById('triosEtat').textContent, '10/12 attaquants · 6/6 défenseurs · 2/2 gardiens · 18/18 unités spéciales',
    'Compteur : défense, gardiens et unités spéciales complets, attaque incomplète');
  // unités spéciales : AN 1 mené par le meilleur tir (SC), IN 1 par le meilleur jeu défensif (DF)
  egal(t['an1.j1'], 'Connor Bedard', 'AN 1 : meilleur tir du club (Bedard, OF 85)');
  egal(t['in1.j1'], 'Chris Bigras', 'IN 1 : meilleur jeu défensif (Bigras, DF 87)');
  ok(Object.values(t).filter(n=>n==='Connor Bedard').length >= 2,
    'Un joueur peut être à la fois dans son trio et en avantage numérique');
  egal(doc.getElementById('triosAlerte').textContent, '',
    'Trio + unité spéciale : pas un doublon (familles distinctes)');
  ok(doc.getElementById('triosZone').textContent.includes('OV moyen 81.0'),
    'OV moyen du trio 1 affiché ((80+82+81)/3 = 81.0)');
  egal(doc.getElementById('triosAlerte').textContent, '', 'Aucun doublon après remplissage automatique');
  // un doublon est signalé dans les trios 1 à 3
  const selT3AD = doc.querySelector('#triosZone select[data-slot="t3.ad"]');
  selT3AD.value = 'Matvei Michkov'; selT3AD.dispatchEvent(new W.Event('change'));
  ok(doc.getElementById('triosAlerte').textContent.includes('Matvei Michkov'), 'Doublon signalé (Michkov sur les trios 1 et 3)');
  egal(doc.querySelectorAll('#triosZone select.double').length, 2, 'Les deux postes en conflit sont marqués');
  // ...mais le DOUBLE SHIFT sur le 4e trio est permis
  selT3AD.value = 'Gabriel Perreault'; selT3AD.dispatchEvent(new W.Event('change')); // répare le trio 3
  const selT4AD = doc.querySelector('#triosZone select[data-slot="t4.ad"]');
  selT4AD.value = 'Matvei Michkov'; selT4AD.dispatchEvent(new W.Event('change'));
  egal(doc.getElementById('triosAlerte').textContent, '',
    'Double shift : Michkov sur le trio 1 ET le 4e trio → aucune alerte');
  egal(doc.querySelectorAll('#triosZone select.double').length, 0, 'Aucun poste marqué en conflit');
  // deux fois sur le 4e trio lui-même, par contre, reste un conflit
  const selT4AG = doc.querySelector('#triosZone select[data-slot="t4.ag"]');
  selT4AG.value = 'Matvei Michkov'; selT4AG.dispatchEvent(new W.Event('change'));
  ok(doc.getElementById('triosAlerte').textContent.includes('Matvei Michkov'),
    'Michkov deux fois SUR le 4e trio → doublon signalé');
  selT4AG.value = ''; selT4AG.dispatchEvent(new W.Event('change'));
  // remettre le doublon inter-trios pour la suite du scénario (export, persistance)
  selT4AD.value = ''; selT4AD.dispatchEvent(new W.Event('change'));
  selT3AD.value = 'Matvei Michkov'; selT3AD.dispatchEvent(new W.Event('change'));
  // export texte
  const txt = S.texteTrios();
  ok(txt.startsWith('TORONTO — trios'), 'Export texte : en-tête du club');
  ok(txt.includes('Trio 1 : Vassili Zaitsev (80) — Connor Bedard (82) — Matvei Michkov (81)'), 'Export texte : trio 1 lisible');
  ok(txt.includes('Gardiens : Chris Gibson (83) / Kevin Lankinen (79)'), 'Export texte : gardiens');
  ok(txt.includes('AN 1 : Connor Bedard'), 'Export texte : avantage numérique');
  ok(/IN 2 : .+ — .+ — .+ — .+/.test(txt), 'Export texte : deuxième unité d\'infériorité complète');
  // persistance
  ok(W.localStorage.getItem('tml_trios_v1:TORONTO').includes('Barrett Hayton'), 'Trios persistés dans le navigateur');
  S.ecritTrios({}); S.rendreTrios();
  egal(doc.getElementById('triosEtat').textContent, '0/12 attaquants · 0/6 défenseurs · 0/2 gardiens · 0/18 unités spéciales',
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
    egal(S.ETAT.ligue.origine, 'releve',
      'Harnais de tests : pas d\'actualisation automatique, le relevé intégré reste affiché');
    dom2.window.close();
  }

  console.log('— Onglet Ligue : dépistage des 32 équipes');
  S.ouvrirVue('joueurs');
  const tousLigue = S.joueursLigue();
  const attenduLigue = S.LIGUE_EQUIPES.reduce((a,e)=>a+S.joueursEquipe(e).length, 0);
  egal(tousLigue.length, attenduLigue, 'Tous les vrais joueurs de la ligue réunis (' + attenduLigue + ')');
  egal(doc.querySelectorAll('#tableLigue tbody tr').length, 100, 'Sans filtre, les 100 premiers sont rendus (table légère)');
  ok(doc.getElementById('ligueCompte').textContent.includes(String(tousLigue.length)), 'Compteur de joueurs affiché');
  egal(doc.getElementById('ligueTout').hidden, false, 'Bouton pour afficher le reste');
  doc.getElementById('ligueTout').click();
  egal(doc.querySelectorAll('#tableLigue tbody tr').length, tousLigue.length, 'Un clic : la table au complet');
  doc.getElementById('ligueTout').click();
  egal(doc.querySelectorAll('#tableLigue tbody tr').length, 100, 'Deuxième clic : retour aux 100 premiers');
  egal(doc.getElementById('ligueEquipe').options.length, 33, 'Filtre d\'équipe : Toutes + 32');
  ok(!doc.getElementById('btnLigueMaj'), 'Plus de bouton «Actualiser toute la ligue» : l\'actualisation lit toujours les 32 équipes');
  // toutes les cotes affichées, OV exact à deux décimales
  ok(['IT','SP','ST','EN','DU','DI','SK','PA','PC','DF','SC','EX','LD'].every(h=>
    doc.querySelector('#tableLigue thead').textContent.includes(h)), 'Les 13 cotes ont leur colonne');
  {
    const rangBigras = [...doc.querySelectorAll('#tableLigue tbody tr')].find(r=>r.textContent.includes('Chris Bigras'));
    egal(rangBigras?.querySelector('td.rang').textContent, '1', 'Rang affiché en première colonne (Bigras, meilleur OV exact)');
    ok(!!rangBigras && rangBigras.textContent.includes('88,97'), 'OV exact de Bigras affiché (88,97 — cotes du site)');
    ok(rangBigras.textContent.includes('96'), 'Cote IT de Bigras affichée (96)');
  }
  // tri par défaut : OV (exact) décroissant — colonne 19 (après le rang)
  {
    const ovs = [...doc.querySelectorAll('#tableLigue tbody tr td:nth-child(19)')].slice(0,5)
      .map(td=>parseFloat(td.textContent.replace('~','').replace(',','.')));
    ok(ovs.every((v,i)=>i===0 || v<=ovs[i-1]), 'Tri par OV exact décroissant par défaut');
  }
  // filtres
  const fBase = {texte:'', equipe:'', po:'', ovMin:null, ageMax:null, expirants:false};
  egal(S.joueursLigueFiltres({...fBase, equipe:'TORONTO'}).length, 20, 'Filtre équipe TORONTO → 20 Leafs');
  ok(S.joueursLigueFiltres({...fBase, ovMin:85}).every(j=>j.ov>=85), 'Filtre OV min respecté');
  ok(S.joueursLigueFiltres({...fBase, po:'G'}).every(j=>j.po==='G'), 'Filtre gardiens');
  ok(S.joueursLigueFiltres({...fBase, po:'F'}).every(j=>j.po!=='D' && j.po!=='G'), 'Filtre attaquants (C, AG, AD)');
  ok(S.joueursLigueFiltres({...fBase, ageMax:21}).every(j=>j.age<=21), 'Filtre âge max');
  ok(S.joueursLigueFiltres({...fBase, expirants:true}).every(j=>(j.ct??0)<=1), 'Filtre contrats d\'un an ou échus');
  egal(S.joueursLigueFiltres({...fBase, texte:'bedard'}).length, 1, 'Recherche par nom');
  // recherche par profil
  {
    const selProfil = doc.getElementById('ligueProfil');
    ok(selProfil.options.length > 10, 'Sélecteur de profils peuplé (' + (selProfil.options.length-1) + ' profils de la ligue)');
    const parProfil = S.joueursLigueFiltres({...fBase, profil:'DEliteQB'});
    ok(parProfil.length > 0 && parProfil.every(j=>j._profil.profil==='DEliteQB'), 'Filtre profil DEliteQB');
    ok(parProfil.some(j=>j.nom==='Ryan Merkley'), 'Merkley dans les DEliteQB de la ligue');
    const grinders = S.joueursLigueFiltres({...fBase, profil:'Grinder', equipe:'TORONTO'});
    ok(grinders.every(j=>j.equipe==='TORONTO' && j._profil.profil==='Grinder'), 'Profil + équipe combinés');
    selProfil.value = 'Starter Goalie';
    selProfil.dispatchEvent(new W.Event('change'));
    ok([...doc.querySelectorAll('#tableLigue tbody tr')].every(r=>r.textContent.includes('Starter Goalie')),
      'Sélecteur branché : la table ne montre que des Starter Goalie');
    selProfil.value = '';
    selProfil.dispatchEvent(new W.Event('change'));
  }
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
    const sals = [...doc.querySelectorAll('#tableLigue tbody tr td:nth-child(20)')].slice(0,3)
      .map(td=>S.parseArgent(td.textContent.replace(' $','')));
    ok(sals[0] >= sals[1] && sals[1] >= sals[2], 'Clic sur Salaire → tri décroissant');
  }

  console.log('— Analyseur d\'échange');
  S.ouvrirVue('echange');
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
    egal(apres[0].masse, 93950000 - 13750000 + 8750000, 'Masse Y22 après : Bigras (13,75 M) part, Fox (8,75 M) arrive');
    egal(apres[1].masse, 52975000 + 8750000, 'Y23 : Bigras (CT 1) était déjà sorti, Fox (CT 3) s\'ajoute');
    ok(doc.getElementById('echSommaire').textContent.includes('Masse Y22 après'), 'Sommaire d\'impact rendu');
    ok(doc.getElementById('echSommaire').textContent.includes('OV moyen'), 'OV moyen avant/après affiché');
    egal(doc.querySelectorAll('#tableEchange tbody tr').length, 3, 'Projection sur trois saisons');
    const b0 = S.bilanClub([], []), b1 = S.bilanClub(S.ECHANGE.sortants, S.ECHANGE.entrants);
    egal(b1.n, 20, 'Effectif inchangé (1 pour 1)');
    ok(b1.ov < b0.ov, 'OV moyen en baisse (Bigras 89 → Fox 82)');
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
  S.ouvrirVue('alignement');
  {
    let alertes = S.alertesDG();
    ok(alertes.some(a=>a.niveau==='info' && a.texte.includes('9 contrats')),
      'Alerte info : 9 contrats expirent à la fin de la saison');
    ok(alertes.some(a=>a.niveau==='rouge' && a.texte.includes('1 contrat échu')),
      'Le seul contrat échu du site (Sanheim) est signalé en rouge');
    ok(doc.querySelectorAll('#alertesDG .alerte-ligne').length >= 1, 'Bandeau d\'alertes rendu');
    // contrat échu non prolongé → alerte rouge
    const jEchu = S.ETAT.roster.find(x=>x.po!=='G');
    const ctAv = jEchu.ct; jEchu.ct = 0;
    alertes = S.alertesDG();
    ok(alertes.some(a=>a.niveau==='rouge' && a.texte.includes(jEchu.nom)),
      'Contrat échu sans prolongation → alerte rouge nominative');
    jEchu.ct = ctAv;
    // gardien près de sa limite / au-delà
    const avLim = new Map(S.ETAT.limites);
    S.ETAT.limites.set(S.normaliserNom('Chris Gibson'), 40);
    poserStatsClub([], [{nom:'Chris Gibson', gp:36, w:20, l:14, t:2, avg:2.5, svpct:0.91}]);
    alertes = S.alertesDG();
    ok(alertes.some(a=>a.niveau==='jaune' && a.texte.includes('approche sa limite') && a.texte.includes('36/40')),
      'Gardien à 90 % de sa limite → alerte jaune');
    poserStatsClub([], [{nom:'Chris Gibson', gp:40, w:22, l:16, t:2, avg:2.5, svpct:0.91}]);
    alertes = S.alertesDG();
    ok(alertes.some(a=>a.niveau==='rouge' && a.texte.includes('atteint sa limite')),
      'Gardien à sa limite → alerte rouge');
    // joueur sous les attentes (production catastrophique sur toute la saison du club)
    poserStatsClub([{nom:'Matvei Michkov', pos:'RW', gp:40, goals:1, assists:1, pts:2, shots:150, plusminus:-20, ppg:0, gwg:0}]);
    alertes = S.alertesDG();
    ok(alertes.some(a=>a.texte.includes('sous les attentes') && a.texte.includes('Matvei Michkov')),
      'Production décevante → alerte «sous les attentes»');
    S.ETAT.limites.clear(); avLim.forEach((v,k)=>S.ETAT.limites.set(k,v));
    viderStats();
    S.rendreAlertes();
  }

  console.log('— Suivi des recotes (Y21 → maintenant)');
  egal(Object.keys(S.COTES_Y21).length, 783, '783 joueurs recensés à la fin de la Y21');
  tableauEgal(S.cotesY21De('Jesperi Kotkaniemi'), [70,83,77,89,86,83,83,82,79,62,79,61,51],
    'Cotes Y21 de Kotkaniemi retrouvées (nom normalisé)');
  egal(S.cotesY21De('Joueur Inconnu'), null, 'Joueur absent de la Y21 → null');
  {
    // le relevé du site est intégré : les recotes se calculent SANS téléchargement
    const recSJdirect = S.recotesEquipe('SANJOSE');
    ok(recSJdirect.some(r=>!r.absent), 'SANJOSE : recotes servies d\'emblée par le relevé intégré');
    // une équipe qui manquerait au relevé retomberait sur les fichiers S21 et
    // attendrait son actualisation : on la simule le temps de l'assertion
    {
      const garde = S.joueursEquipeBrut('TAMPABAY');
      remplacerEquipe('TAMPABAY', S.decoderEquipe('TAMPABAY'));
      egal(S.cotesDuSite('TAMPABAY'), false, 'Équipe servie par les fichiers S21 : pas de cotes du site');
      const recTB = S.recotesEquipe('TAMPABAY');
      ok(recTB.every(r=>r.absent), 'Équipe périmée : recotes en attente des cotes du site');
      ok(!S.classementRecotes().some(r=>r.eq==='TAMPABAY'),
        'Une équipe périmée n\'est pas classée — pas de faux chiffres');
      remplacerEquipe('TAMPABAY', garde);
      egal(S.cotesDuSite('TAMPABAY'), true, 'Relevé restauré');
    }
    // simulons l'alignement du site : on repart de la base S21, Kotkaniemi recoté +1 PA, +2 SC
    let recSJ;
    const releveSJ = S.joueursEquipeBrut('SANJOSE');
    const enDirectSJ = S.decoderEquipe('SANJOSE').map(j=>{
      const c = {...j, _origine: 'direct'};
      delete c.ovEstime;
      if (c.nom==='Jesperi Kotkaniemi'){ c.pa += 1; c.sc += 2; }
      return c;
    });
    remplacerEquipe('SANJOSE', enDirectSJ);
    recSJ = S.recotesEquipe('SANJOSE');
    const kotka = recSJ.find(r=>r.j.nom==='Jesperi Kotkaniemi');
    ok(!!kotka && !kotka.absent && kotka.source==='direct', 'Ligne de recote construite depuis les cotes du site');
    egal(kotka.deltas.pa, 1, 'PA de Kotkaniemi : +1 (S21 → site)');
    egal(kotka.deltas.sc, 2, 'SC de Kotkaniemi : +2');
    egal(kotka.deltas.ld, 0, 'LD inchangé = 0');
    egal(kotka.somme, 3, 'Δ total de Kotkaniemi = +3');
    ok(kotka.ovDeltaExact > 0, 'OV exact en hausse (PA et SC pèsent dans la formule)');
    const inchange = recSJ.find(r=>r.j.nom==='Adam Fox');
    egal(inchange.somme, 0, 'Joueur non recoté : Δ total 0');
    const gardienSJ = recSJ.find(r=>r.j.po==='G' && !r.absent);
    ok(!!gardienSJ && gardienSJ.ovDelta===null, 'Gardien : pas de delta d\'OV (formule non couverte), cotes comparées quand même');
    // classement des recotes : le relevé étant complet, les 32 équipes y sont
    const rangs = S.classementRecotes();
    egal(rangs.length, 32, 'Les 32 équipes classées sans le moindre téléchargement');
    ok(rangs.some(r=>r.eq==='SANJOSE'), 'SANJOSE (en direct) est classée');
    const rSJ = rangs.find(r=>r.eq==='SANJOSE');
    ok(rSJ.moy > 0 && rSJ.top.nom==='Jesperi Kotkaniemi', 'Gain moyen positif, meilleure progression = Kotkaniemi');
    const txt = S.texteClassementRecotes();
    ok(txt.includes('SANJOSE') && txt.includes('Kotkaniemi'), 'Export texte du classement');
    ok(!txt.includes('télécharge les manquantes'), 'Classement complet : aucune mention d\'équipe manquante');
    // rendu de la table de classement
    S.ouvrirVue('recotes');
    ok(doc.querySelectorAll('#tableRecClassement tbody tr').length >= 1, 'Table du classement rendue');
    ok(!doc.getElementById('btnRecClassement') && !!doc.getElementById('btnRecClassementTxt'),
      'Bouton «Télécharger en .txt» présent ; plus besoin de «Classer les 32 équipes»');
    remplacerEquipe('SANJOSE', releveSJ);
  }
  S.ouvrirVue('recotes');
  egal(doc.getElementById('recEquipe').value, 'TORONTO', 'Équipe par défaut : mon club');
  egal(doc.querySelectorAll('#tableRecotes tbody tr').length, 20, '20 lignes pour les Leafs');
  ok(doc.querySelector('#tableRecotes thead').textContent.includes('OV avant→après'), 'Colonne OV avant→après');
  // avec un alignement en direct simulé (Kotkaniemi +1 PA), la table se colore
  const releveSanJose = S.joueursEquipeBrut('SANJOSE');
  remplacerEquipe('SANJOSE', S.decoderEquipe('SANJOSE').map(j=>{
    const c = {...j, _origine: 'direct'};
    if (c.nom==='Jesperi Kotkaniemi') c.pa += 1;
    return c;
  }));
  doc.getElementById('recEquipe').value = 'SANJOSE';
  doc.getElementById('recEquipe').dispatchEvent(new W.Event('change'));
  ok(doc.querySelector('#tableRecotes tbody').textContent.includes('Jesperi Kotkaniemi'), 'Recotes de SANJOSE affichées');
  ok(doc.querySelectorAll('#tableRecotes td.rec-plus').length >= 1, 'Les hausses sont marquées en vert');
  {
    const rangKotka = [...doc.querySelectorAll('#tableRecotes tbody tr')].find(r=>r.textContent.includes('Kotkaniemi'));
    ok(/\d{2},\d{2}→\d{2},\d{2}/.test(rangKotka.textContent), 'OV exact affiché (S21 → cotes du site)');
  }
  remplacerEquipe('SANJOSE', releveSanJose);
  doc.getElementById('recEquipe').value = 'TORONTO';
  doc.getElementById('recEquipe').dispatchEvent(new W.Event('change'));

  console.log('— Recotes depuis la fiche ushl.ca du joueur (CareerStatsPlayer)');
  {
    // fixture calquée sur la fiche réelle d'Ivan Miroshnichenko (S22 et S21)
    const ficheHTML = `<html><body>
      <h2>Ivan Miroshnichenko</h2>
      <table><tr><th>S</th><th>P</th><th>TM</th><th>GP</th><th>G</th></tr>
        <tr><td>22</td><td>R</td><td>TOR</td><td>5</td><td>0</td></tr></table>
      <table><tr><th>S</th><th>IN</th><th>SP</th><th>ST</th><th>EN</th><th>DU</th><th>DI</th><th>SK</th><th>PA</th><th>PC</th><th>DF</th><th>OF</th><th>EX</th><th>LD</th><th>OV</th></tr>
        <tr><td>22</td><td>69</td><td>78</td><td>74</td><td>76</td><td>72</td><td>77</td><td>78</td><td>74</td><td>77</td><td>59</td><td>85</td><td>50</td><td>49</td><td>79</td></tr>
        <tr><td>21</td><td>69</td><td>75</td><td>73</td><td>73</td><td>70</td><td>75</td><td>75</td><td>72</td><td>74</td><td>59</td><td>83</td><td>47</td><td>43</td><td>77</td></tr>
      </table></body></html>` + ' '.repeat(600);
    const saisons = S.parseFicheAttributs(ficheHTML);
    egal(saisons.length, 2, 'Deux saisons dans l\'historique des attributs');
    egal(saisons[0].saison, 22, 'Saison 22 lue');
    egal(saisons[0].cotes.sp, 78, 'SP de la S22 (78)');
    egal(saisons[0].cotes.sc, 85, 'Colonne OF lue comme SC (85)');
    egal(saisons[0].ov, 79, 'OV du site lu (79)');
    egal(saisons[1].ov, 77, 'OV S21 du site (77)');
    ok(S.URLS_USHL.fiche('Ivan Miroshnichenko').includes('CareerStatsPlayer.php?csName=Ivan%20Miroshnichenko'),
      'URL de la fiche du joueur');
    // téléchargement (fetch simulé) puis intégration aux recotes
    const fetchAv = W.fetch;
    W.fetch = async () => ({ok:true, status:200, text: async () => ficheHTML});
    await S.chargerFiche('Ivan Miroshnichenko');
    W.fetch = fetchAv;
    ok(S.ETAT.fiches.has(S.normaliserNom('Ivan Miroshnichenko')), 'Fiche gardée en mémoire');
    const ficheConservee = S.litCache().fiches[S.normaliserNom('Ivan Miroshnichenko')];
    egal(ficheConservee.saisons.length, 2, 'Seul l\'historique lu est conservé (deux saisons), pas la page');
    const recTor = S.recotesEquipe('TORONTO');
    const miro = recTor.find(r=>r.j.nom==='Ivan Miroshnichenko');
    egal(miro.source, 'site', 'Recote de Miroshnichenko servie par sa fiche ushl.ca');
    egal(miro.deltas.sp, 3, 'SP : 75 → 78 = +3 (S21 → S22 du site)');
    egal(miro.deltas.ld, 6, 'LD : 43 → 49 = +6');
    egal(miro.ovDelta, 2, 'OV du site : 77 → 79 = +2');
    egal(miro.somme, 30, 'Δ total depuis la fiche (0+3+1+3+2+2+3+2+3+0+2+3+6)');
    // rendu : indicateur «✓ site» pour lui, bouton «fiche» pour les autres
    S.rendreRecotes();
    const rangMiro = [...doc.querySelectorAll('#tableRecotes tbody tr')].find(r=>r.textContent.includes('Miroshnichenko'));
    ok(rangMiro.textContent.includes('✓ site'), 'Indicateur «✓ site» sur sa ligne');
    ok(/\d{2},\d{2}→\d{2},\d{2} \(\+\d+,\d{2}\)/.test(rangMiro.textContent),
      'OV EXACT avant→après affiché (xx,xx→xx,xx (+x,xx))');
    // valeurs exactes recalculées sur les cotes de chaque saison de la fiche
    const avExact = S.ovDetaille(Object.fromEntries(S.OV_ORDRE.map((k,i)=>[k,[69,75,73,73,70,75,75,72,74,59,83,47,43][i]])),'F').valeur;
    const apExact = S.ovDetaille(Object.fromEntries(S.OV_ORDRE.map((k,i)=>[k,[69,78,74,76,72,77,78,74,77,59,85,50,49][i]])),'F').valeur;
    ok(rangMiro.textContent.includes(avExact.toFixed(2).replace('.',',')), 'OV exact S21 (' + avExact.toFixed(2) + ')');
    ok(rangMiro.textContent.includes(apExact.toFixed(2).replace('.',',')), 'OV exact S22 (' + apExact.toFixed(2) + ')');
    ok((rangMiro.querySelector('td[title*="site"]')||{}).title?.includes('77 → 79'),
      'Les OV affichés sur le site (77 → 79) restent au survol');
    ok(doc.querySelectorAll('#tableRecotes button.btn-fiche').length >= 15, 'Bouton «fiche» sur les autres lignes');
    ok(!!doc.getElementById('btnRecFiches'), 'Bouton «Compléter depuis les fiches du site» présent');
    ok(doc.getElementById('recNote').textContent.includes('1 joueur depuis les fiches'), 'Compteur de fiches dans la note');
    // deuxième appel : servi de la mémoire, aucun réseau
    W.fetch = () => { throw new Error('ne doit pas être appelé'); };
    await S.chargerFiche('Ivan Miroshnichenko');
    W.fetch = fetchAv;
    // nettoyage
    S.ETAT.fiches.delete(S.normaliserNom('Ivan Miroshnichenko'));
    W.localStorage.removeItem(S.CLES_LS.cache);
    W.localStorage.removeItem(S.CLES_LS.relais);
    S.rendreRecotes();
  }

  console.log('— Joueurs de la ligue, mode Statistiques : les meneurs dans la même table');
  {
    const fixtureLigue = [
      '    Player                    Team            POS GP   G   A   P  Sh PiM   MP   H Sh/G',
      '    [Connor Bedard](https://x/#a) TORONTO         C   40  25  30  55 150  10  800  30 3.75',
      '    [Jaden Schwartz](https://x/#b) SANJOSE        C   40  20  40  60 100   5  900  40 2.50',
      '    [Tom Wilson](https://x/#c) ANAHEIM            RW  40  10  10  20  90  80  700 150 2.25',
      '    [Adam Fox](https://x/#d) SANJOSE              D   40   5  35  40  80  10  950  50 2.00',
      '    [* Backup_RW](https://x/#e) TORONTO           LW   3   0   0   0   0   0    0   0 0.00',
      '    [Rachat Dvorak](https://x/#f) DALLAS          C   10   0   0   0   0   0    0   0 0.00'
    ].join('\n');
    const xl = S.parseXtraLigue(fixtureLigue);
    egal(xl.length, 4, 'Quatre vrais patineurs extraits (backup et rachat exclus)');
    egal(xl[0].equipe, 'TORONTO', 'Équipe capturée');
    egal(xl[3].pos, 'D', 'Position capturée');
    // statistiques de la saison (API) pour ces quatre joueurs et un gardien, minutes de XtraStats
    const eqDe = nom => S.joueursLigue().find(j=>j.nom===nom).equipe;
    S.poserStats(xl.map(x=>({...x, equipe: eqDe(x.nom), plusminus: 5, ppg: 2, shg: 0, gwg: 1})),
      [{nom:'Chris Gibson', equipe:'TORONTO', gp:30, mp:1800, avg:2.4, w:18, l:10, t:2, so:3, sa:900, ga:72, svpct:0.92}],
      {date: new Date().toISOString()});
    S.poserXtra(xl.map(x=>({...x, equipe: eqDe(x.nom)})), '11/12/2026');
    S.ouvrirVue('joueurs');
    doc.querySelector('#ligueMode button[data-mode="stats"]').click();
    egal(S.ETAT_LIGUE.mode, 'stats', 'Bascule «Statistiques» branchée');
    let rangs = [...doc.querySelectorAll('#tableLigue tbody tr')];
    egal(rangs.length, 4, 'Seuls les patineurs ayant joué sont classés');
    ok(rangs[0].textContent.includes('Jaden Schwartz'), 'Meneur aux points : Schwartz (60)');
    ok(doc.querySelector('#tableLigue thead').textContent.includes('MEÉ') && doc.querySelector('#tableLigue thead').textContent.includes('MIN'),
      'Colonnes de statistiques (MEÉ, MIN…) à la place des cotes');
    ok(rangs[0].textContent.includes('900'), 'Minutes jouées de XtraStats dans la même rangée');
    doc.querySelector('#tableLigue th[data-col="hits"]').click();
    ok(doc.querySelector('#tableLigue tbody tr').textContent.includes('Tom Wilson'),
      'Clic sur MEÉ : Wilson en tête (150)');
    doc.getElementById('liguePo').value = 'D';
    doc.getElementById('liguePo').dispatchEvent(new W.Event('change'));
    rangs = [...doc.querySelectorAll('#tableLigue tbody tr')];
    egal(rangs.length, 1, 'Filtre Défenseurs : Fox seulement');
    doc.getElementById('liguePo').value = '';
    doc.getElementById('ligueEquipe').value = 'TORONTO';
    doc.getElementById('ligueEquipe').dispatchEvent(new W.Event('change'));
    rangs = [...doc.querySelectorAll('#tableLigue tbody tr')];
    egal(rangs.length, 1, 'Filtre d\'équipe (mon club) : Bedard');
    ok(rangs[0].textContent.includes('Connor Bedard') && rangs[0].classList.contains('rangee-club'), 'Bedard listé et surligné');
    // gardiens : le filtre de position bascule sur leurs colonnes
    doc.getElementById('ligueEquipe').value = '';
    doc.getElementById('liguePo').value = 'G';
    doc.getElementById('liguePo').dispatchEvent(new W.Event('change'));
    rangs = [...doc.querySelectorAll('#tableLigue tbody tr')];
    egal(rangs.length, 1, 'Gardiens ayant joué : Gibson');
    ok(doc.querySelector('#tableLigue thead').textContent.includes('MOY') && rangs[0].textContent.includes('2.40'), 'Colonnes des gardiens (MOY, %A…)');
    // retour à l'état initial : mode Cotes, aucun filtre, aucune statistique
    doc.getElementById('liguePo').value = '';
    doc.querySelector('#tableLigue th[data-col="w"]')?.click();
    S.ETAT_LIGUE.tri.stats = {col:'pts', desc:true};
    viderStats();
    S.rendreLigue();
    ok(doc.querySelector('#tableLigue tbody').textContent.includes('Aucun match disputé'), 'Sans statistiques : message clair plutôt qu\'une table vide');
    doc.querySelector('#ligueMode button[data-mode="cotes"]').click();
    egal(doc.querySelectorAll('#tableLigue tbody tr').length, 100, 'Retour au mode Cotes et contrats');
  }

  console.log('— Percentiles de la ligue au comparateur');
  ok(S.percentileLigue('ov', 88, 'D') >= 95, 'OV 88 chez les défenseurs → 95ᵉ centile et plus');
  ok(S.percentileLigue('ov', 60, 'F') <= 5, 'OV 60 chez les attaquants → 5ᵉ centile et moins');
  egal(S.percentileLigue('ov', null, 'F'), null, 'Valeur absente → null');
  {
    const p1 = S.percentileLigue('sk', 85, 'F');
    ok(p1 !== null && p1 >= 0 && p1 <= 100, 'Percentile borné 0-100 (SK 85 attaquants : ' + p1 + ')');
  }
  S.ouvrirVue('comparateur');
  S.rendreComparateur();
  {
    const bulles = [...doc.querySelectorAll('#compZone .comp-val b[title]')];
    ok(bulles.length >= 20, 'Info-bulles de centile sur les valeurs (' + bulles.length + ')');
    ok(bulles.some(b=>b.title.includes('centile des')), 'Le libellé situe la cote dans la ligue');
    ok(doc.querySelectorAll('#compZone .cent-top').length >= 1, 'Le top 10 % est souligné (Bigras vs Sanheim)');
  }

  console.log('— Classement de la ligue : officiel quand il est à jour, calculé sinon');
  {
    S.ouvrirVue('classement');
    ok(doc.getElementById('classementZone').textContent.includes('Aucun match'), 'Avant-saison : aucun classement');
    // statistiques seules : fiches calculées des décisions des gardiens
    S.poserStats(
      [{nom:'A', equipe:'TORONTO', gp:8, goals:20}, {nom:'B', equipe:'SANJOSE', gp:8, goals:30}, {nom:'C', equipe:'ST.LOUIS', gp:8, goals:18}],
      [{nom:'G1', equipe:'TORONTO', gp:8, w:5, l:2, t:1, ga:18}, {nom:'G2', equipe:'SANJOSE', gp:8, w:7, l:1, t:0, ga:12},
       {nom:'G3', equipe:'ST.LOUIS', gp:8, w:3, l:3, t:2, ga:22}], {date: new Date().toISOString()});
    S.rendreClassement();
    let rangs = [...doc.querySelectorAll('#classementZone tbody tr')];
    egal(rangs.length, 3, 'Classement rendu');
    ok(rangs[0].textContent.includes('SANJOSE') && rangs[0].textContent.includes('14'), '1er : SANJOSE, 14 points (2×7)');
    ok(rangs[1].textContent.includes('TORONTO') && rangs[1].textContent.includes('11'), '2e : TORONTO, 11 points (2×5+1)');
    ok(rangs[1].classList.contains('rangee-club'), 'Le club du DG est surligné');
    ok(rangs[2].textContent.includes('ST.LOUIS') && rangs[2].textContent.includes('8'), '3e : ST.LOUIS, 8 points');
    ok(doc.getElementById('classEtat').textContent.includes('calculées'), 'Mention : fiches calculées');
    egal(doc.getElementById('classGroupes').hidden, true, 'Sans classement officiel, pas de regroupement par association');
    egal(S.ETAT.fiche, 'TORONTO 5-2-1', 'La fiche du club suit');
    // le classement officiel arrive (Standings.php) : il remplace le calcul
    const officiel = [
      {equipe:'SANJOSE', conf:'Western', div:'Pacific', gp:8, w:7, l:1, t:0, otl:1, pts:15, gf:30, ga:12, l10:'7-1-0', serie:'W4'},
      {equipe:'TORONTO', conf:'Eastern', div:'Atlantic', gp:8, w:5, l:2, t:1, otl:0, pts:11, gf:20, ga:18, l10:'5-2-1', serie:'L1'},
      {equipe:'ST.LOUIS', conf:'Western', div:'Central', gp:8, w:3, l:3, t:2, otl:0, pts:8, gf:18, ga:22, l10:'3-3-2', serie:'T1'}];
    S.poserClassement(officiel, {date: new Date().toISOString()});
    S.rendreClassement();
    egal(S.ETAT.classement.officiel, true, 'Classement officiel à jour : c\'est lui qui s\'affiche');
    rangs = [...doc.querySelectorAll('#classementZone tbody tr')];
    ok(rangs[0].textContent.includes('15') && rangs[0].textContent.includes('W4'), 'Points officiels (défaite en prolongation comprise) et série');
    ok(doc.getElementById('classEtat').textContent.includes('officiel'), 'Mention : classement officiel');
    egal(doc.getElementById('classGroupes').hidden, false, 'Regroupements offerts');
    doc.querySelector('#classGroupes button[data-groupe="conf"]').click();
    egal(doc.querySelectorAll('#classementZone table').length, 2, 'Par association : deux tableaux');
    ok(doc.getElementById('classementZone').textContent.includes('Eastern'), 'Titre de l\'association');
    doc.querySelector('#classGroupes button[data-groupe="div"]').click();
    egal(doc.querySelectorAll('#classementZone table').length, 3, 'Par section : un tableau par section');
    doc.querySelector('#classGroupes button[data-groupe="ligue"]').click();
    // les statistiques avancent d'un match : le classement officiel retarde, le calcul reprend la main
    S.poserStats(
      [{nom:'A', equipe:'TORONTO', gp:9, goals:23}, {nom:'B', equipe:'SANJOSE', gp:8, goals:30}, {nom:'C', equipe:'ST.LOUIS', gp:8, goals:18}],
      [{nom:'G1', equipe:'TORONTO', gp:9, w:6, l:2, t:1, ga:19}, {nom:'G2', equipe:'SANJOSE', gp:8, w:7, l:1, t:0, ga:12},
       {nom:'G3', equipe:'ST.LOUIS', gp:8, w:3, l:3, t:2, ga:22}], {date: new Date().toISOString()});
    egal(S.ETAT.classement.officiel, false, 'Classement officiel en retard d\'un match : fiches calculées');
    egal(S.ETAT.fiche, 'TORONTO 6-2-1', 'Fiche du club à jour malgré le classement officiel en retard');
    egal(S.ficheEquipe('TORONTO').conf, 'Eastern', 'Les associations connues restent attachées aux fiches calculées');
    ok(!doc.getElementById('btnFiches'), 'Plus de bouton «Télécharger les 32 fiches»');
    viderStats();
    S.rendreClassement();
  }

  console.log('— Noms des Meneurs : nettoyage des balises HTML et entités');
  {
    const fixtureHTML = [
      '    Player                    Team            POS GP   G   A   P  Sh PiM   MP   H Sh/G',
      '    <a href="stats.php?id=98">Connor Bedard</a> TORONTO         C   40  25  30  55 150  10  800  30 3.75',
      "    <A HREF='x.php'>Ryan O&#39;Rourke</A> ANAHEIM           D   40   2  10  12  40  30  700  90 1.00"
    ].join('\n');
    const xl = S.parseXtraLigue(fixtureHTML);
    egal(xl.length, 2, 'Lignes avec balises HTML analysées');
    egal(xl[0].nom, 'Connor Bedard', 'Nom extrait sans balises');
    egal(xl[1].nom, "Ryan O'Rourke", 'Entité &#39; décodée en apostrophe');
    egal(S.nettoyerLigneXtra('a &amp; b &nbsp;<b>c</b>'), 'a & b   c ', 'Nettoyage des entités et balises');
  }

  console.log('— Échange : bascule «re-signé» et OV exact');
  {
    // OV exact affiché
    const bigrasT = S.joueursEquipe('TORONTO').find(j=>j.nom==='Chris Bigras');
    egal(S.ovExact(bigrasT), '88,97', 'OV exact de Bigras (88,97 — cotes relevées du site)');
    egal(S.ovExact(S.joueursEquipe('TORONTO').find(j=>j.nom==='Chris Gibson')), null, 'Pas d\'OV exact pour un gardien');
    // la re-signature standard S'ENCHAÎNE après le contrat : on ne re-signe
    // pas un joueur encore sous contrat
    const sanheimT = S.joueursEquipe('TORONTO').find(j=>j.nom==='Travis Sanheim');
    const rsSanheim = S.resignatureStandard(sanheimT); // seul contrat échu du club : charte immédiate à 30 ans, OV 82
    tableauEgal([rsSanheim.st, rsSanheim.duree, rsSanheim.apres, rsSanheim.salaire],
      ['UFA', 4, 0, 7500000], 'Re-signature standard de Sanheim : échu → UFA 7,5 M × 4 dès maintenant');
    egal(S.salaireSaisonEchange({...sanheimT, _resigner:true}, 0), 7500000,
      'Saison Y22 : contrat échu → la charte s\'applique tout de suite');
    egal(S.salaireSaisonEchange({...sanheimT, _resigner:true}, 4), 0,
      'Saison Y26 : après les 4 ans de la re-signature, plus rien');
    egal(S.salaireSaisonEchange(sanheimT, 1), 0, 'Sans bascule : rien (contrat échu)');
    // la CHAÎNE contrat réel puis charte, avec un joueur encore sous contrat (Mesar, 900 k × 1 an)
    const mesarT = S.joueursEquipe('TORONTO').find(j=>j.nom==='Filip Mesar');
    const rsMesar = S.resignatureStandard(mesarT); // re-signé à 23 ans → RFA, OV 77 → 950 k
    tableauEgal([rsMesar.st, rsMesar.duree, rsMesar.apres, rsMesar.salaire],
      ['RFA', 3, 1, 950000], 'Mesar : après son année de contrat, RFA 950 k × 3');
    egal(S.salaireSaisonEchange({...mesarT, _resigner:true}, 0), 900000,
      'Saison Y22 : son contrat réel (900 k), PAS la charte — il est encore sous contrat');
    egal(S.salaireSaisonEchange({...mesarT, _resigner:true}, 1), 950000,
      'Saison Y23 : la re-signature standard prend le relais (950 k)');
    // le statut est déduit de l'âge AU MOMENT de la re-signature (28 ans + 1 an de contrat → UFA)
    egal(S.resignatureStandard({nom:'X', po:'C', ov:80, age:28, salaire:1000000, ct:1}).st, 'UFA',
      '28 ans avec 1 an de contrat → re-signé à 29 ans : UFA');
    // dans l'interface : ajouter Sanheim comme sortant, cocher la bascule
    S.ouvrirVue('echange');
    doc.getElementById('echSortant').value = 'Travis Sanheim';
    doc.getElementById('echAjSortant').click();
    ok(doc.getElementById('echSortants').textContent.includes('(' + S.ovExact(sanheimT) + ')'), 'OV exact sur la chip');
    ok(doc.getElementById('echSortants').textContent.includes('re-signé ensuite'), 'Bascule «re-signé ensuite» présente');
    const chk = doc.querySelector('#echSortants input[data-resign-camp="s"]');
    chk.checked = true; chk.dispatchEvent(new W.Event('change'));
    ok(doc.getElementById('echSortants').textContent.includes('UFA 7,5 M × 4 ans'),
      'Chip : contrat échu → re-signature standard immédiate (7,5 M × 4 ans)');
    // un sortant basculé alourdit la masse AVANT (le garder = le re-signer)
    const avantResig = S.projectionEchange([], [], 3);
    egal(avantResig[0].masse, 93950000 + 7500000, 'Avant : Y22 inclut déjà la re-signature de Sanheim si on le garde');
    egal(avantResig[1].masse, 52975000 + 7500000, 'Avant : Y23 aussi');
    // un entrant re-signé compte sa chaîne : contrat réel d'abord, charte ensuite
    doc.getElementById('echEquipe').value = 'SANJOSE';
    doc.getElementById('echEquipe').dispatchEvent(new W.Event('change'));
    doc.getElementById('echEntrant').value = 'Adam Fox';
    doc.getElementById('echAjEntrant').click();
    const chkE = doc.querySelector('#echEntrants input[data-resign-camp="e"]');
    chkE.checked = true; chkE.dispatchEvent(new W.Event('change'));
    ok(doc.getElementById('echEntrants').textContent.includes('8,8 M × 3 ans puis UFA 7,5 M × 4 ans'),
      'Chip de l\'entrant : contrat réel puis charte');
    // Fox : ct 3 à 8,75 M, re-signé à 31 ans → UFA OV 82 = 7,5 M × 4
    const apresResig = S.projectionEchange(S.ECHANGE.sortants, S.ECHANGE.entrants, 3);
    egal(apresResig[0].masse, 93950000 + 8750000,
      'Y22 : Fox compte à son contrat RÉEL (8,75 M), Sanheim parti (contrat échu, 0 au plafond)');
    egal(apresResig[1].masse, 52975000 + 8750000,
      'Y23 : Fox encore à son contrat réel, Sanheim exclu');
    // cartes OV et âge gagnés / perdus
    ok(doc.getElementById('echSommaire').textContent.includes('OV gagné / perdu'), 'Carte OV gagné/perdu');
    ok(doc.getElementById('echSommaire').textContent.includes('sortants 82 · entrants 82'), 'OV : 82 pour 82 → nul');
    ok(doc.getElementById('echSommaire').textContent.includes('Âge gagné / perdu'), 'Carte âge gagné/perdu');
    ok(doc.getElementById('echSommaire').textContent.includes('-2,0'), 'Âge : 30 ans part, 28 ans arrive → -2,0');
    doc.getElementById('echVider').click();
    egal(S.salaireSaisonEchange(sanheimT, 1), 0, 'Vider remet aussi la bascule à zéro (drapeau nettoyé)');
  }

  console.log('— Transferts locaux (échange pas encore traité par la ligue)');
  {
    W.localStorage.removeItem('tml_transferts_v1:TORONTO');
    S.ouvrirVue('alignement');
    ok(!!doc.getElementById('btnTransferer'), 'Bloc de transfert présent dans l\'alignement');
    // acquisition : Adam Fox arrive de SANJOSE
    doc.getElementById('transfDe').value = 'SANJOSE';
    doc.getElementById('transfDe').dispatchEvent(new W.Event('change'));
    doc.getElementById('transfJoueur').value = 'Adam Fox';
    doc.getElementById('transfVers').value = 'TORONTO';
    doc.getElementById('btnTransferer').click();
    egal(S.ETAT.roster.filter(j=>!j.backup).length, 21, 'Fox rejoint le club : 21 joueurs');
    const foxT = S.ETAT.roster.find(j=>j.nom==='Adam Fox');
    ok(!!foxT && foxT._transfert==='SANJOSE', 'Fox porte la provenance du transfert');
    ok(!S.joueursEquipe('SANJOSE').some(j=>j.nom==='Adam Fox'), 'Fox retiré de SANJOSE partout dans l\'application');
    ok(doc.querySelector('#tableAlignement tbody').textContent.includes('Adam Fox'), 'Fox dans la table d\'alignement');
    ok(doc.querySelector('#tableAlignement tbody').textContent.includes('via SANJOSE'), 'Badge «via SANJOSE» affiché');
    egal(S.calculerMasse({}).masse, 93950000 + 8750000, 'La masse du club inclut le salaire de Fox (8,75 M, CT 3)');
    ok(S.alertesDG().some(a=>a.texte.includes('transfert') && a.texte.includes('Adam Fox')),
      'Alerte du Bureau : transfert local actif, à retirer quand la ligue aura traité');
    ok(doc.getElementById('transfListe').textContent.includes('Adam Fox : SANJOSE → TORONTO'), 'Chip du transfert affichée');
    // départ : Bigras part vers SANJOSE (deux transferts cumulés)
    doc.getElementById('transfDe').value = 'TORONTO';
    doc.getElementById('transfDe').dispatchEvent(new W.Event('change'));
    doc.getElementById('transfJoueur').value = 'Chris Bigras';
    doc.getElementById('transfVers').value = 'SANJOSE';
    doc.getElementById('btnTransferer').click();
    egal(S.ETAT.roster.filter(j=>!j.backup).length, 20, 'Bigras parti : retour à 20 joueurs');
    ok(S.joueursEquipe('SANJOSE').some(j=>j.nom==='Chris Bigras'), 'Bigras apparaît chez SANJOSE');
    egal(S.litTransferts().length, 2, 'Deux transferts persistés dans le navigateur');
    // survit à une actualisation de la formation
    S.rafraichirRosterClub();
    ok(S.ETAT.roster.some(j=>j.nom==='Adam Fox') && !S.ETAT.roster.some(j=>j.nom==='Chris Bigras'),
      'Les transferts survivent au recalcul de la formation (actualisation)');
    // dépistage : la Ligue voit les joueurs dans leur nouvelle équipe
    ok(S.joueursLigue().find(j=>j.nom==='Adam Fox').equipe==='TORONTO', 'Onglet Ligue : Fox listé chez TORONTO');
    egal(S.joueursLigue().length, 609, 'Aucun joueur dupliqué dans la ligue'); // le relevé complet du site, rien d'autre
    // annulation par les chips
    let garde = 0;
    while (doc.querySelector('#transfListe button[data-transf]') && garde++ < 5){
      doc.querySelector('#transfListe button[data-transf]').click();
    }
    egal(S.litTransferts().length, 0, 'Transferts annulés par leurs chips');
    egal(S.ETAT.roster.filter(j=>!j.backup).length, 20, 'Formation redevenue normale');
    ok(S.ETAT.roster.some(j=>j.nom==='Chris Bigras'), 'Bigras de retour au club');
  }

  console.log('— Mise à jour des matrices depuis la page officielle de la ligue');
  {
    W.localStorage.removeItem('tml_matrices_v1');
    // reconnaissance des noms
    egal(S.reconnaitre('Profil : Elite', S.ALIAS_MATRICES), 'ELITE', 'Profil «Elite» reconnu');
    egal(S.reconnaitre('DElite Shutdown', S.ALIAS_MATRICES), 'DELITESD', 'Profil «DElite Shutdown» reconnu');
    egal(S.reconnaitre('Gardien partant', S.ALIAS_MATRICES), 'STARTER', 'Variante française du gardien partant reconnue');
    egal(S.reconnaitre('points accumulés', S.ALIAS_STATS), 'pts', 'Statistique «points accumulés» reconnue');
    egal(S.reconnaitre('mises en échecs complétées', S.ALIAS_STATS), 'hits', 'Statistique «mises en échec» reconnue');
    egal(S.reconnaitre('buts gagnants', S.ALIAS_STATS), 'gwg', 'Statistique «buts gagnants» reconnue');
    egal(S.nombreCellule('12,5'), 12.5, 'Nombre à virgule décimale');
    egal(S.nombreCellule('1 838'), 1838, 'Nombre avec espace de milliers');
    egal(S.nombreCellule('85 %'), 85, 'Pourcentage');
    egal(S.nombreCellule('—'), null, 'Cellule vide → null');
    // page fictive calquée sur MATRICES DES PROFILS (deux profils, trois stats)
    const page = `<html><body>
      <h1>MATRICES DES PROFILS</h1>
      <h2>Elite</h2>
      <h3>points</h3>
      <table>
        <tr><th>OV</th><th>Mémorable</th><th>Excellente</th><th>Satisfaisante</th><th>Correcte</th><th>Décevante</th><th>À oublier</th></tr>
        <tr><td>75</td><td>25</td><td>22</td><td>19</td><td>16</td><td>10</td><td>-1</td></tr>
        <tr><td>83</td><td>105</td><td>93</td><td>80</td><td>68</td><td>40</td><td>-1</td></tr>
        <tr><td>90</td><td>125</td><td>111</td><td>96</td><td>82</td><td>48</td><td>-1</td></tr>
      </table>
      <h3>buts gagnants</h3>
      <table>
        <tr><th>OV</th><th>Mémorable</th><th>Excellente</th><th>Satisfaisante</th><th>Correcte</th><th>Décevante</th><th>À oublier</th></tr>
        <tr><td>83</td><td>6</td><td>5</td><td>4</td><td>3</td><td>2</td><td>-6</td></tr>
        <tr><td>90</td><td>8</td><td>7</td><td>6</td><td>5</td><td>4</td><td>-4</td></tr>
      </table>
      <h2>Starter Goalie</h2>
      <h3>pourcentage d'arrêt cumulé</h3>
      <table>
        <tr><th>OV</th><th>Mémorable</th><th>Excellente</th><th>Satisfaisante</th><th>Correcte</th><th>Décevante</th><th>À oublier</th></tr>
        <tr><td>83</td><td>0,895</td><td>0,891</td><td>0,886</td><td>0,882</td><td>0,878</td><td>-1,000</td></tr>
        <tr><td>90</td><td>0,905</td><td>0,901</td><td>0,896</td><td>0,892</td><td>0,887</td><td>-1,000</td></tr>
      </table></body></html>`;
    const docM = new W.DOMParser().parseFromString(page, 'text/html');
    const {matrices, rapport} = S.parseMatricesUshl(null, docM);
    egal(Object.keys(matrices).length, 2, 'Deux profils reconnus dans la page');
    ok(!!matrices.ELITE && !!matrices.STARTER, 'Elite et Starter Goalie extraits');
    tableauEgal(Object.keys(matrices.ELITE).sort(), ['gwg','pts'], 'Deux statistiques pour Elite');
    // bandes d'overall étendues à chaque OV, comme les matrices Y17
    tableauEgal(matrices.ELITE.pts[75], [25,22,19,16,10,-1], 'Rangée OV 75 (bande 73-75)');
    tableauEgal(matrices.ELITE.pts[73], [25,22,19,16,10,-1], 'La bande couvre aussi l\'OV 73');
    tableauEgal(matrices.ELITE.pts[83], [105,93,80,68,40,-1], 'Rangée OV 83');
    tableauEgal(matrices.ELITE.pts[80], [105,93,80,68,40,-1], 'OV 80 tombe dans la bande 76-83');
    tableauEgal(matrices.ELITE.pts[90], [125,111,96,82,48,-1], 'Dernière bande jusqu\'à 90');
    tableauEgal(matrices.STARTER.svpct[90], [0.905,0.901,0.896,0.892,0.887,-1], 'Décimales à virgule du gardien');
    egal(rapport.filter(r=>!r.ignore).length, 3, 'Trois tables importées (rapport)');
    // import effectif : les nouveaux seuils remplacent Y17 dans l'évaluation
    const av = S.seuilsPour(S.ETAT.roster.find(j=>j._profil.mat==='ELITE') || {ov:83, nom:'x', _profil:{mat:'ELITE'}}, 'pts', {}, {});
    tableauEgal(av.seuils, [97,86,74,63,37,-1], 'Avant import : seuils Y17 (OV 83)');
    const res = S.importerMatricesUshl(page);
    egal(res.profils, 2, 'Import : deux profils');
    ok(res.rangees > 30, 'Import : toutes les rangées d\'overall (' + res.rangees + ')');
    const jTest = {nom:'Test Elite', ov:83, po:'C', _profil:{mat:'ELITE'}};
    const ap = S.seuilsPour(jTest, 'pts', S.chargerMatrices(), {});
    tableauEgal(ap.seuils, [105,93,80,68,40,-1], 'Après import : les seuils de la ligue s\'appliquent');
    egal(ap.source, 'personnalisée', 'Source = rangée personnalisée (remplace Y17)');
    // un Mémorable se juge maintenant sur le nouveau seuil
    egal(S.statutSelonSeuils(106, ap.seuils), 'memorable', '106 pts > 105 → Mémorable selon la nouvelle matrice');
    egal(S.statutSelonSeuils(98, ap.seuils), 'excellente', '98 pts (Mémorable sous Y17) → seulement Excellente maintenant');
    // interface
    S.ouvrirVue('reglages');
    ok(!!doc.getElementById('btnMajMatrices'), 'Bouton «Mettre à jour depuis ushl.ca» présent');
    ok(S.URLS_USHL.matrices.includes('MATRICES%20DES%20PROFILS'), 'URL de la page officielle configurée');
    // import par collage dans la zone de texte
    S.sauverMatrices({});
    doc.getElementById('zoneJson').value = page;
    doc.getElementById('btnImportMat').click();
    ok(Object.keys(S.chargerMatrices()).length === 2, 'Coller la page dans la zone et cliquer «Importer» fonctionne');
    ok(doc.getElementById('etatMatrices').textContent.includes('profils'), 'Compte-rendu affiché après import');
    // copier-coller du tableau en TEXTE (cas le plus courant depuis un navigateur)
    S.sauverMatrices({});
    const colle = [
      'MATRICES DES PROFILS',
      'Sniper',
      'but accumulés',
      'OV\tMémorable\tExcellente\tSatisfaisante\tCorrecte\tDécevante\tÀ oublier',
      '83\t46\t41\t35\t30\t16\t-1',
      '90\t55\t49\t42\t36\t19\t-1',
      'Grinder',
      'mises en échecs complétées par tranche de 20 minutes',
      'OV\tMémorable\tExcellente\tSatisfaisante\tCorrecte\tDécevante\tÀ oublier',
      '83\t3,05\t2,85\t2,65\t2,45\t2,25\t-1'
    ].join('\n');
    const rTxt = S.importerMatricesUshl(colle);
    egal(rTxt.profils, 2, 'Texte collé : deux profils importés');
    tableauEgal(S.chargerMatrices().SNIPER.goals[83], [46,41,35,30,16,-1], 'Sniper : buts, rangée OV 83 (texte)');
    tableauEgal(S.chargerMatrices().GRINDER.hits20[90], [3.05,2.85,2.65,2.45,2.25,-1],
      'Grinder : MEÉ/20 avec décimales à virgule, dernière bande étendue à 90');
    // le JSON reste accepté
    S.sauverMatrices({});
    doc.getElementById('zoneJson').value = JSON.stringify({ELITE:{pts:{83:[1,2,3,4,5,6]}}});
    doc.getElementById('btnImportMat').click();
    tableauEgal(S.chargerMatrices().ELITE.pts[83], [1,2,3,4,5,6], 'Import JSON toujours fonctionnel');
    S.sauverMatrices({});
    S.ouvrirVue('alignement');
  }

  console.log('— OV détaillé : profil et permutations de cotes');
  {
    // catégories de la ligue
    tableauEgal(S.CATEGORIES_COTES.A, ['sp','st','en','du','sk'], 'Catégorie A : SP ST EN DU SK');
    tableauEgal(S.CATEGORIES_COTES.B, ['pa','pc','df','sc'], 'Catégorie B : PA PC DF SC');
    tableauEgal(S.CATEGORIES_COTES.C, ['it','di','ex','ld'], 'Catégorie C : IT DI EX LD');
    // profil calculé sur des cotes libres
    const versCotes2 = t => Object.fromEntries(S.OV_ORDRE.map((k,i)=>[k,t[i]]));
    const zadina = versCotes2([63,89,76,92,80,84,91,78,78,55,87,69,59]);
    const pz = S.profilDeCotes(zadina, 'F', 27);
    egal(pz.profil, 'Elite', 'Zadina (27 ans) → Elite');
    egal(pz.mat, 'ELITE', 'Matrice ELITE');
    egal(pz.ov, 83, 'OV arrondi calculé par la formule détaillée (83 ; le site affiche 82 sur ses propres cotes)');
    // l'âge change la catégorie de profil
    egal(S.profilDeCotes(zadina, 'F', 20).profil, 'Junior Elite', 'Même cotes à 20 ans → Junior Elite');
    egal(S.profilDeCotes(zadina, 'F', 23).profil, 'Prospect Elite', 'À 23 ans → Prospect Elite');
    // vecteurs de transfert : somme nulle, coût respecté
    const vecs = S.transfertsCategorie(['pa','pc','df','sc'], 3);
    ok(vecs.length > 0, 'Transferts de 3 points générés (' + vecs.length + ')');
    ok(vecs.every(v=>v.reduce((a,b)=>a+b,0) === 0), 'Chaque transfert conserve la somme de la catégorie');
    ok(vecs.every(v=>v.filter(d=>d>0).reduce((a,b)=>a+b,0) === 3), 'Chaque transfert déplace exactement 3 points');
    ok(vecs.some(v=>JSON.stringify(v)===JSON.stringify([3,0,0,-3])), 'Le transfert PA +3 / SC −3 est envisagé');
    // permutations : un Two-Way Forward qui bascule vers un autre profil
    {
      // Sniper exige SP+SK ≥ 140 et SC ≥ 78 ; on part juste sous le seuil
      const presqueSniper = versCotes2([70,74,72,80,76,78,64,74,74,60,79,60,55]); // SP 74 + SK 64 = 138
      const base = S.profilDeCotes(presqueSniper, 'F', 27);
      const {options} = S.permutationsProfil(presqueSniper, 'F', 27, 3);
      ok(options.every(o=>o.profil !== base.profil), 'Aucune option ne répète le profil de départ');
      ok(options.every(o=>o.mouvement.reduce((s,m)=>s+m.delta,0) === 0),
        'Chaque suggestion conserve la somme de sa catégorie');
      ok(options.every(o=>{
        const cat = S.CATEGORIES_COTES[o.categorie];
        return o.mouvement.every(m=>cat.includes(m.cle));
      }), 'Chaque suggestion reste dans une seule catégorie');
      ok(options.every(o=>o.cout >= 1 && o.cout <= 3), 'Coût borné par le maximum demandé');
      const sniper = options.find(o=>o.profil === 'Sniper');
      ok(!!sniper, 'Le passage à Sniper est détecté');
      if (sniper){
        egal(sniper.categorie, 'A', 'Sniper s\'obtient dans la catégorie A (SP/SK)');
        ok(sniper.cout <= 2, 'Coût minimal trouvé (' + sniper.cout + ' pt) : SP + SK doivent atteindre 140');
        // vérification indépendante : les cotes proposées donnent bien ce profil
        egal(S.profilDeCotes(sniper.cotes, 'F', 27).profil, 'Sniper', 'Les cotes suggérées produisent bien Sniper');
      }
      // un budget plus large ne perd aucune option
      const large = S.permutationsProfil(presqueSniper, 'F', 27, 4);
      ok(large.options.length >= options.length, 'Un budget de 4 points offre au moins autant d\'options');
    }
    // bornes 1..99 respectées
    {
      const extreme = versCotes2([99,99,99,99,99,99,99,50,50,50,50,50,50]);
      const {options} = S.permutationsProfil(extreme, 'F', 27, 3);
      ok(options.every(o=>Object.values(o.cotes).every(v=>v>=1 && v<=99)), 'Aucune cote ne sort de 1..99');
    }
    // interface
    S.ouvrirVue('ovdetail');
    doc.getElementById('ovdEquipe').value = 'TORONTO';
    doc.getElementById('ovdEquipe').dispatchEvent(new W.Event('change'));
    doc.getElementById('ovdJoueur').value = 'Mathew Barzal';
    doc.getElementById('ovdJoueur').dispatchEvent(new W.Event('change'));
    egal(doc.getElementById('ovdAge').value, '29', 'L\'âge du joueur est chargé');
    egal(doc.getElementById('ovdProfil').textContent, 'Playmaker', 'Profil affiché dans le calculateur');
    ok(doc.getElementById('ovdProfilLib').textContent.includes('pro'), 'La catégorie d\'âge est indiquée');
    ok(doc.getElementById('ovdProfilLib').textContent.includes('PLAYMAKER'), 'La matrice est indiquée');
    ok(!!doc.getElementById('ovdPermut'), 'Zone des permutations présente');
    const texteP = doc.getElementById('ovdPermut').textContent;
    ok(texteP.length > 0, 'Les permutations sont calculées et rendues');
    ok(/catégorie [ABC]|stable/.test(texteP), 'Chaque suggestion nomme sa catégorie (ou déclare le profil stable)');
    // changer l'âge recalcule le profil sans toucher aux cotes
    doc.getElementById('ovdAge').value = '20';
    doc.getElementById('ovdAge').dispatchEvent(new W.Event('input'));
    egal(doc.getElementById('ovdProfil').textContent, 'Junior Elite', 'L\'âge modifie le profil affiché (mêmes cotes, autre grille)');
    ok(doc.getElementById('ovdProfilLib').textContent.includes('junior'), 'Catégorie junior indiquée');
    doc.getElementById('ovdAge').value = '27';
    doc.getElementById('ovdAge').dispatchEvent(new W.Event('input'));
    // le budget de points est réglable
    doc.getElementById('ovdPoints').value = '1';
    doc.getElementById('ovdPoints').dispatchEvent(new W.Event('input'));
    ok(!/\b[23] pts\b/.test(doc.getElementById('ovdPermut').textContent), 'Budget 1 point : aucune suggestion à 2 ou 3 points');
    doc.getElementById('ovdPoints').value = '3';
    doc.getElementById('ovdPoints').dispatchEvent(new W.Event('input'));
  }

  console.log('— Lecture conservée, base S21 et transferts locaux');
  {
    egal(S.dateInstantane(), null, 'Aucune lecture conservée au départ');
    tableauEgal(S.equipesInstantane(), [], 'Aucune équipe conservée au départ');
    // une lecture de ushl.ca, plus récente que le relevé intégré : Fox y est recoté
    S.memoriserLigue({SANJOSE: S.joueursEquipeBrut('SANJOSE').map(j => j.nom === 'Adam Fox' ? {...j, pa: 91, ov: 86} : j)}, new Date().toISOString());
    ok(!!S.dateInstantane(), 'Lecture datée après mémorisation (' + S.dateInstantane() + ')');
    tableauEgal(S.equipesInstantane(), ['SANJOSE'], 'SANJOSE conservée');
    S.restaurerDonnees();
    const fox = S.joueursEquipe('SANJOSE').find(j=>j.nom==='Adam Fox');
    egal(fox.pa, 91, 'La cote conservée remplace celle du relevé intégré');
    egal(fox.ov, 86, 'L\'OV conservé est servi par défaut');
    egal(fox._origine, 'conserve', 'Le joueur porte sa provenance');
    ok(S.provenanceDe(fox).startsWith('dernière lecture de ushl.ca'), 'Provenance lisible');
    // la base S21 reste intacte : c'est la base de comparaison des recotes
    const foxFichiers = S.decoderEquipe('SANJOSE').find(j=>j.nom==='Adam Fox');
    egal(foxFichiers.pa, 86, 'decoderEquipe sert toujours l\'état S21 des fichiers (base des recotes)');
    egal(foxFichiers._origine, 's21', 'Provenance : fichiers S21');
    // les gardiens gardent DF et OF à null dans les deux cas
    const gInt = S.decoderEquipe('SANJOSE').find(j=>j.po==='G');
    egal(gInt.df, null, 'Gardien de la base S21 : DF null');
    egal(gInt.ovEstime, true, 'Gardien de la base S21 : OV estimé');
    const gCons = S.joueursEquipe('SANJOSE').find(j=>j.po==='G');
    egal(gCons.df, null, 'Gardien de la lecture conservée : DF null');
    ok(!gCons.ovEstime, 'Gardien conservé : OV du site, pas une estimation');
    // les transferts locaux s'appliquent par-dessus
    S.ecritTransferts([{nom:'Adam Fox', de:'SANJOSE', vers:'TORONTO', date:'2026-08-01'}]);
    S.rafraichirRosterClub();
    ok(S.ETAT.roster.some(j=>j.nom==='Adam Fox' && j.pa===91),
      'Un joueur transféré arrive avec ses cotes conservées du site');
    ok(!S.joueursEquipe('SANJOSE').some(j=>j.nom==='Adam Fox'), 'Et quitte son ancienne équipe');
    ok(S.joueursLigue().some(j=>j.nom==='Adam Fox' && j.equipe==='TORONTO'), 'La liste de la ligue suit le transfert');
    S.ecritTransferts([]); S.rafraichirRosterClub();
    ok(S.joueursLigue().some(j=>j.nom==='Adam Fox' && j.equipe==='SANJOSE'), 'Transfert retiré : Fox retrouve SANJOSE');
    // oubli
    etatInitial();
    egal(S.joueursEquipe('SANJOSE').find(j=>j.nom==='Adam Fox').pa, 85,
      'Lecture oubliée → retour au relevé intégré (et non aux fichiers S21)');
    S.ouvrirVue('alignement');
  }

  console.log('— PWA (installation et hors ligne)');
  {
    const lire = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    const manifest = JSON.parse(lire('manifest.webmanifest'));
    egal(manifest.short_name, 'DG USHL', 'Manifest : nom court, neutre (l\'application sert les 32 clubs)');
    egal(manifest.theme_color, '#0e2f63', 'Manifest : couleur neutre — la page prend celle du club à l\'ouverture');
    ok(manifest.icons.length >= 1 && manifest.icons[0].src === 'icon.svg', 'Manifest : icône déclarée');
    ok(lire('icon.svg').includes('#0e2f63'), 'Icône neutre de la ligue');
    const sw = lire('sw.js');
    ok(sw.includes("addEventListener('fetch'") && sw.includes('caches'), 'Service worker : cache hors ligne');
    ok(html.includes('rel="manifest"'), 'La page déclare le manifest');
    const fichiersPage = [...lireFichier('index.html').matchAll(/(?:src|href)="((?:js|css|data)\/[^"]+)"/g)].map(m=>m[1]);
    ok(fichiersPage.length >= 20, 'La page charge ses fichiers séparés (' + fichiersPage.length + ')');
    tableauEgal(fichiersPage.filter(f=>!sw.includes(`'${f}'`)), [], 'Chaque fichier de la page est dans la cache hors ligne du service worker');
    ok(fichiersPage.every(f=>fs.existsSync(path.join(RACINE, f))), 'Aucun fichier référencé ne manque');
    ok(html.includes("location.protocol === 'https:'"), 'Enregistrement du service worker réservé au HTTPS');
  }

  console.log('— Le club du DG : les 32 postes servis par la même page');
  {
    // le club par défaut reste TORONTO, et la page en porte les couleurs
    tableauEgal(Object.keys(S.CLUBS).slice().sort(), S.LIGUE_EQUIPES.slice().sort(),
      'Un club décrit pour chacune des 32 équipes de la ligue, ni plus ni moins');
    ok(Object.values(S.CLUBS).every(c=>c.nom && /^#[0-9A-Fa-f]{6}$/.test(c.couleur) && c.emoji),
      'Chaque club a un nom, une couleur et un emblème');
    egal(S.CONFIG.equipe, 'TORONTO', 'Club par défaut : TORONTO');
    egal(doc.title, 'Maple Leafs de Toronto — Poste du DG', 'Titre de la page aux couleurs du club');
    egal(doc.getElementById('ecussonClub').textContent, '🍁', 'Emblème du club dans l\'en-tête');
    egal(doc.getElementById('titreClub').textContent, 'MAPLE LEAFS DE TORONTO', 'En-tête au nom du club');
    egal(doc.querySelector('meta[name="theme-color"]').content, '#00205B', 'Couleur de thème du club');
    egal(doc.documentElement.style.getPropertyValue('--club'), '#00205B', 'Variable CSS --club posée');
    ok(doc.querySelector('link[rel="icon"]').href.includes('%2300205B'), 'Favicon aux couleurs du club');
    // les clés propres au club portent son code : rien ne déborde d'un DG à l'autre
    egal(S.CLES_LS.trios, 'tml_trios_v1:TORONTO', 'Trios rangés sous le code du club');
    egal(S.CLES_LS.resign, 'tml_resignatures_v1:TORONTO', 'Prolongations rangées sous le code du club');
    egal(S.CLES_LS.transferts, 'tml_transferts_v1:TORONTO', 'Transferts rangés sous le code du club');
    egal(S.CLES_LS.instantane, 'tml_instantane_ligue_v1', 'L\'instantané de la ligue reste commun à tous');
    // sélecteur des Réglages
    S.ouvrirVue('reglages');
    const selClub = doc.getElementById('clubDG');
    egal(selClub.options.length, 32, 'Les 32 clubs proposés dans les Réglages');
    egal(selClub.value, 'TORONTO', 'Le club actif est sélectionné');
    ok(doc.getElementById('clubEtat').textContent.includes('Maple Leafs de Toronto'), 'État du club affiché');
    S.ouvrirVue('alignement');
  }

  // une deuxième page, ouverte par un autre DG dans son propre navigateur
  const ouvrirPour = async (avant) => {
    const d = new JSDOM(html, {
      runScripts:'dangerously', url:'https://example.org/', pretendToBeVisual:true,
      beforeParse(window){
        window.__TML_SANS_AUTO__ = true;
        window.fetch = () => Promise.reject(new Error('réseau désactivé en test'));
        avant(window);
      }
    });
    d.window.fetch = () => Promise.reject(new Error('réseau désactivé en test'));
    await new Promise(r => setTimeout(r, 300));
    return d;
  };

  console.log('— Un autre DG : les Islanders sur la même page');
  {
    const d = await ouvrirPour(w => w.localStorage.setItem('tml_club_v1', 'ISLANDERS'));
    const D = d.window.document, SI = d.window.__TML__;
    egal(SI.CONFIG.equipe, 'ISLANDERS', 'Le club conservé dans ce navigateur est repris à l\'ouverture');
    egal(D.title, 'Islanders de New York — Poste du DG', 'Titre au nom des Islanders');
    egal(D.getElementById('titreClub').textContent, 'ISLANDERS DE NEW YORK', 'En-tête au nom des Islanders');
    egal(D.querySelector('meta[name="theme-color"]').content, '#00539B', 'Couleurs des Islanders');
    // la formation servie est bien la sienne, tirée du relevé du site
    const effectif = SI.USHL_RELEVE.equipes.ISLANDERS.length;
    egal(SI.ETAT.roster.length, effectif, 'Formation de départ = son alignement du relevé du site');
    egal(D.querySelectorAll('#tableAlignement tbody tr').length, effectif, 'Sa formation est rendue dans la table');
    ok(SI.ETAT.roster.some(j=>j.nom==='Jack Hughes'), 'Jack Hughes est chez lui, pas chez les Leafs');
    ok(!SI.ETAT.roster.some(j=>j.nom==='Connor Bedard'), 'Aucun joueur des Leafs dans sa formation');
    egal(SI.ETAT.fiche, 'ISLANDERS 0-0-0', 'Fiche du club à son nom');
    egal(SI.ETAT.roster.filter(j=>j.po==='G').every(j=>j.df===null), true, 'Ses gardiens décodés sans DF ni OF');
    ok(SI.ETAT.roster.every(j=>!j.ovEstime), 'OV du site : aucune estimation pour son club');
    // tout le reste de l'application suit
    SI.ouvrirVue('recotes');
    egal(D.getElementById('recEquipe').value, 'ISLANDERS', 'Recotes : son club par défaut');
    SI.ouvrirVue('echange');
    ok(![...D.getElementById('echEquipe').options].some(o=>o.value==='ISLANDERS'),
      'Échange : on ne négocie pas avec soi-même');
    ok([...D.getElementById('echEquipe').options].some(o=>o.value==='TORONTO'),
      'Échange : TORONTO est un partenaire comme un autre');
    SI.ouvrirVue('trios');
    SI.autoTrios();
    const t = SI.litTrios();
    egal(t['g.g1'], 'Connor Hellebuyck', 'Ses trios se remplissent avec SES joueurs');
    egal(d.window.localStorage.getItem('tml_trios_v1:TORONTO'), null,
      'Ses trios n\'écrasent pas ceux d\'un DG de TORONTO');
    ok(!!d.window.localStorage.getItem('tml_trios_v1:ISLANDERS'), 'Ses trios sont rangés sous son code');
    // la ligue, elle, reste la même pour tout le monde
    egal(SI.joueursLigue().length, 609, 'Même ligue de 609 joueurs pour tous les DG');
    egal(SI.classementRecotes().length, 32, 'Même classement des recotes');
    d.window.close();
  }

  console.log('— Reprise des données enregistrées avant le choix du club');
  {
    const d = await ouvrirPour(w => {
      w.localStorage.setItem('tml_trios_v1', '{"t1.c":"Connor Bedard"}');
      w.localStorage.setItem('tml_transferts_v1', '[]');
    });
    const LS = d.window.localStorage;
    egal(LS.getItem('tml_trios_v1'), null, 'L\'ancienne clé sans club est retirée');
    egal(LS.getItem('tml_trios_v1:TORONTO'), '{"t1.c":"Connor Bedard"}',
      'Son contenu revient à TORONTO, le club d\'avant le choix');
    egal(LS.getItem('tml_transferts_v1:TORONTO'), '[]', 'Même reprise pour les transferts locaux');
    egal(d.window.__TML__.CONFIG.equipe, 'TORONTO', 'Sans choix enregistré, on reste sur TORONTO');
    d.window.close();
  }

  console.log('— Bouton Actualiser : le site est relu, lecture récente ou pas');
  {
    // ce navigateur a lu ushl.ca il y a deux minutes, AVANT un échange
    const ilYADeuxMinutes = new Date(Date.now() - 2*60*1000).toISOString();
    const avecVedette = nom => {
      const equipes = JSON.parse(JSON.stringify(S.USHL_RELEVE.equipes));
      equipes.TORONTO[0][0] = nom;
      return equipes;
    };
    const d = await ouvrirPour(w => {
      w.localStorage.setItem('tml_instantane_ligue_v1', JSON.stringify({date: ilYADeuxMinutes, equipes: avecVedette('Avant Echange')}));
      w.localStorage.setItem('tml_cache_v2', JSON.stringify({stats: {date: ilYADeuxMinutes, patineurs: [], gardiens: []}}));
    });
    const SD = d.window.__TML__, DD = d.window.document;
    let vedette = 'Apres Echange', appelsApi = 0;
    d.window.fetch = async url => {
      const u = String(url);
      if (!u.startsWith(SD.URLS_USHL.api)) throw new Error('hors ligne');
      appelsApi++;
      return {ok:true, status:200, json: async () => ({data: u.includes('api=search') ? versApi(avecVedette(vedette)) : []})};
    };
    const nomsClub = () => SD.ETAT.rosterBrut.map(j=>j.nom);
    egal(SD.ETAT.ligue.origine, 'conserve', 'À l\'ouverture : la lecture conservée, plus récente que le relevé intégré');
    await SD.actualiserTout();
    egal(appelsApi, 0, 'Lecture de moins de 5 minutes : l\'ouverture ne redemande rien au site');
    ok(nomsClub().includes('Avant Echange'), 'La formation conservée reste affichée');
    const btnMaj = DD.getElementById('btnMaj');
    btnMaj.click();
    egal(btnMaj.disabled, true, 'Bouton désactivé pendant la lecture');
    egal(DD.getElementById('etatDonnees').dataset.etat, 'lecture', 'Pastille : lecture en cours');
    for (let i = 0; i < 50 && btnMaj.disabled; i++) await new Promise(r => setTimeout(r, 100));
    egal(appelsApi, 3, 'Le bouton relit l\'API malgré la lecture récente');
    ok(nomsClub().includes('Apres Echange') && !nomsClub().includes('Avant Echange'), 'L\'échange apparaît');
    ok(DD.getElementById('tableAlignement').textContent.includes('Apres Echange'), 'La table de la formation montre le nouveau joueur');
    ok(SD.litInstantane().equipes.TORONTO.some(t=>t[0]==='Apres Echange'), 'La lecture conservée est remplacée');
    egal(Object.keys(SD.litInstantane().equipes).length, 32, 'Le club y est avec les 31 autres');
    // même bouton dans les Réglages
    vedette = 'Nouvelle Signature';
    SD.ouvrirVue('reglages');
    DD.getElementById('btnMajReglages').click();
    for (let i = 0; i < 50 && !nomsClub().includes('Nouvelle Signature'); i++) await new Promise(r => setTimeout(r, 100));
    ok(nomsClub().includes('Nouvelle Signature'), '«Actualiser maintenant» (Réglages) relit aussi le site');
    d.window.close();
  }

  console.log('— Navigation : sept sections, sous-vues et adresse');
  {
    const sections = [...doc.querySelectorAll('#navPrincipale button[data-vue]')].map(b=>b.dataset.vue);
    tableauEgal(sections, ['club','progression','trios','ligue','echange','analyse','reglages'], 'Sept sections (au lieu de quatorze onglets)');
    ok(!doc.querySelector('[data-vue="repechage"]') && !doc.getElementById('vue-repechage'), 'Le repêchage Y22 est retiré');
    S.ouvrirVue('ligue');
    tableauEgal([S.vueCourante().vue, S.vueCourante().sous], ['ligue', 'classement'], 'Ligue s\'ouvre sur sa dernière sous-vue (classement)');
    doc.querySelector('.sous-nav button[data-sous="joueurs"]').click();
    egal(S.vueCourante().sous, 'joueurs', 'Clic sur une sous-vue');
    egal(W.location.hash, '#ligue/joueurs', 'L\'adresse suit la navigation');
    ok(doc.getElementById('sous-joueurs').classList.contains('actif') && !doc.getElementById('sous-classement').classList.contains('actif'),
      'Une seule sous-vue visible à la fois');
    doc.querySelector('#navPrincipale button[data-vue="club"]').click();
    doc.querySelector('#navPrincipale button[data-vue="ligue"]').click();
    egal(S.vueCourante().sous, 'joueurs', 'Revenir à une section retrouve la sous-vue quittée');
    S.ouvrirVue('plafond');
    tableauEgal([S.vueCourante().vue, S.vueCourante().sous], ['club', 'plafond'], 'Ouvrir une sous-vue ouvre sa section');
    egal(doc.querySelector('#navPrincipale button.actif').dataset.vue, 'club', 'L\'onglet de la section est marqué actif');
    egal(S.ouvrirVue('inexistante'), false, 'Une vue inconnue est ignorée');
    // un lien direct ouvre la bonne vue
    const dLien = new JSDOM(html, {runScripts:'dangerously', url:'https://example.org/#analyse/ovdetail', pretendToBeVisual:true,
      beforeParse(w){ w.__TML_SANS_AUTO__ = true; w.fetch = () => Promise.reject(new Error('réseau désactivé en test')); }});
    await new Promise(r => setTimeout(r, 300));
    tableauEgal([dLien.window.__TML__.vueCourante().vue, dLien.window.__TML__.vueCourante().sous], ['analyse', 'ovdetail'],
      'Ouverture par l\'adresse #analyse/ovdetail');
    dLien.window.close();
    S.ouvrirVue('alignement');
  }

  console.log(`\n${total - echecs}/${total} vérifications réussies`);
  process.exit(echecs ? 1 : 0);
})().catch(e => { console.error('ERREUR FATALE', e); process.exit(1); });
