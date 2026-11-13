/* =====================================================================
   ÉTAT DE L'APPLICATION ET MODÈLE DE LA LIGUE
   ---------------------------------------------------------------------
   Une seule représentation de la ligue, quelle que soit sa provenance :
     direct    lue à l'instant sur ushl.ca (API)
     conserve  dernière lecture réussie, gardée dans ce navigateur
     releve    relevé intégré à la page (data/releve.js)
     s21       fichiers de fin de saison S21 — dernier recours, et base
               «avant» du suivi des recotes
   Les fonctions poser…() installent des données dans l'état ; elles servent
   aussi bien à l'ouverture (relevé, données conservées) qu'à l'arrivée du
   direct. Aucune ne touche au réseau ni à l'affichage.
   ===================================================================== */

/* Les 32 équipes : l'ordre des fichiers de la ligue, complété par toute équipe
   qui n'apparaîtrait que dans le relevé du site. */
const LIGUE_EQUIPES = [...new Set([
  ...Object.keys(LIGUE_S21).filter(e => LIGUE_S21[e].length),
  ...Object.keys(USHL_RELEVE.equipes)
])];

const ETAT = {
  ligue: {equipes: {}, date: null, origine: null},
  rosterBrut: [],          // formation du club telle que servie, AVANT transferts locaux
  roster: [],              // formation effective = rosterBrut + transferts locaux
  stats: {patineurs: [], gardiens: [], date: null, parCle: new Map(), parNom: new Map()},
  scoring: {patineurs: [], gardiens: []},   // statistiques du club (tranche de stats)
  enSaison: false,         // au moins un match disputé cette saison
  minutes: {parCle: {}, date: null},        // minutes jouées des patineurs (XtraStats)
  reference: null,         // avant le premier match : totaux de la saison précédente {liste, date, parCle}
  classementOfficiel: null,                 // Standings.php tel que lu {fiches, date}
  classement: {fiches: [], officiel: false, date: null},   // celui qui s'affiche (officiel ou calculé)
  fiche: CONFIG.equipe + ' 0-0-0',
  filtreProg: 'tous',
  rechercheAlign: '',
  limites: new Map(),      // limites d'utilisation des gardiens (gestiongardiens)
  fiches: new Map(),       // historiques d'attributs des fiches de joueurs (recotes)
  version: 0               // augmente à chaque changement de la ligue (caches dérivés)
};

/* ---------- Dates ---------- */
const MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
/* «2026-11-13T16:58:48Z» → «13 novembre 2026» (heure locale du navigateur). */
function dateLisible(iso){
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d)) return null;
  // une date sans heure (anciens instantanés) est un jour civil, pas minuit UTC
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)){
    const [a,m,j] = iso.split('-');
    return `${+j} ${MOIS[+m-1]} ${a}`;
  }
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}
function heureLisible(iso){
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d) || /^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return `${d.getHours()} h ${String(d.getMinutes()).padStart(2,'0')}`;
}
/* «il y a 12 min», «il y a 3 h», «il y a 2 jours». */
function ilYA(iso){
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  if (min < 48*60) return `il y a ${Math.floor(min/60)} h`;
  return `il y a ${Math.floor(min/1440)} jours`;
}

/* ---------- Ligue conservée dans ce navigateur ----------
   Chaque lecture réussie de ushl.ca est gardée ici (format compact) : c'est
   elle qui s'affiche à la prochaine ouverture, même hors ligne, si elle est
   plus récente que le relevé intégré. */
function litInstantane(){
  try { return JSON.parse(localStorage.getItem(CLES_LS.instantane) || 'null'); }
  catch { return null; }
}
function ecritInstantane(o){
  try { localStorage.setItem(CLES_LS.instantane, JSON.stringify(o)); }
  catch (e){ /* quota dépassé : le relevé intégré reste la référence */ }
}
function memoriserLigue(equipes, date){
  const compactes = {};
  for (const code of Object.keys(equipes)) compactes[code] = equipes[code].map(j => compacter(CLES_JOUEUR, j));
  ecritInstantane({date, equipes: compactes});
}
function dateInstantane(){ return dateLisible(litInstantane()?.date); }
function equipesInstantane(){
  const s = litInstantane();
  return s ? Object.keys(s.equipes) : [];
}

/* ---------- Décodage ---------- */
/* Prépare un joueur pour l'application : provenance et profil. */
function preparerJoueur(j, origine){
  if (j.po === 'G'){ j.df = null; j.sc = null; }   // les gardiens n'ont ni DF ni OF
  j._origine = origine;
  j._profil = determinerProfil(j);
  return j;
}
function decoderTableau(tab, origine){
  return (tab || []).map(t => preparerJoueur(decompacter(CLES_JOUEUR, t), origine))
    .filter(j => !estFictif(j.nom));
}
/* Base S21 INTÉGRÉE (fichiers de la ligue, état final de la saison) : la base
   de comparaison du suivi des recotes. L'OV des gardiens y est une estimation,
   les fichiers de la ligue ne publiant pas le leur. */
function decoderEquipe(code){
  const joueurs = decoderTableau(LIGUE_S21[code], 's21');
  for (const j of joueurs) if (j.po === 'G') j.ovEstime = true;
  return joueurs;
}

/* ---------- Installation des données ---------- */
/* equipes : {CODE: [joueurs]} — tableaux compacts ou objets. */
function poserLigue(equipes, {date, origine}){
  const decodees = {};
  for (const code of Object.keys(equipes)){
    const liste = equipes[code];
    decodees[code] = liste.length && Array.isArray(liste[0])
      ? decoderTableau(liste, origine)
      : liste.filter(j => !estFictif(j.nom)).map(j => preparerJoueur({...j}, origine));
  }
  ETAT.ligue = {equipes: decodees, date, origine};
  ETAT.version++;
  rafraichirRosterClub();
}
function indexerStats(){
  const parCle = new Map(), parNom = new Map();
  for (const type of ['patineurs', 'gardiens']){
    for (const s of ETAT.stats[type]){
      parCle.set(type[0] + cleJoueur(s.nom, s.equipe), s);
      const cle = type[0] + normaliserNom(s.nom), deja = parNom.get(cle);
      if (!deja || (s.gp || 0) > (deja.gp || 0)) parNom.set(cle, s);   // homonymes : le plus actif
    }
  }
  ETAT.stats.parCle = parCle; ETAT.stats.parNom = parNom;
}
function poserStats(patineurs, gardiens, {date} = {}){
  ETAT.stats = {patineurs, gardiens, date: date || null};
  indexerStats();
  ETAT.scoring = {
    patineurs: patineurs.filter(p => p.equipe === CONFIG.equipe),
    gardiens: gardiens.filter(g => g.equipe === CONFIG.equipe)
  };
  ETAT.enSaison = patineurs.some(p => p.gp > 0) || gardiens.some(g => g.gp > 0);
  ETAT.version++;
  majClassement();
}
/* XtraStats. En saison : les minutes jouées, seule donnée que l'API n'a pas.
   Avant le premier match, la page montre encore la saison précédente au
   complet : elle sert alors de référence, jamais de production courante. */
function poserXtra(liste, date){
  const archive = !ETAT.enSaison && liste.some(x => x.gp > 0);
  if (archive){
    ETAT.reference = {liste, date, parCle: new Map(liste.map(x => [normaliserNom(x.nom), x]))};
    ETAT.minutes = {parCle: {}, date: null};
  } else {
    ETAT.reference = null;
    ETAT.minutes = {parCle: minutesDepuisXtra(liste), date};
  }
}
function poserMinutes(parCle, date){
  ETAT.reference = null;
  ETAT.minutes = {parCle: parCle || {}, date: date || null};
}
/* Classement officiel (Standings.php) quand il est connu et à jour ; sinon
   fiches V-D-N calculées des décisions des gardiens. */
function poserClassement(fiches, {date} = {}){
  ETAT.classementOfficiel = {fiches: fiches || [], date: date || null};
  majClassement();
}
function majClassement(){
  const calcule = classementDepuisStats(ETAT.stats.patineurs, ETAT.stats.gardiens);
  const officiel = ETAT.classementOfficiel?.fiches || [];
  const parties = fs => fs.reduce((n, f) => n + f.w + f.l + f.t, 0);
  // le classement officiel retarde si les statistiques comptent plus de matchs que lui
  const officielAJour = officiel.length > 0 && officiel.length >= calcule.length && parties(officiel) >= parties(calcule);
  if (officielAJour){
    ETAT.classement = {fiches: officiel, officiel: true, date: ETAT.classementOfficiel.date};
  } else {
    const groupes = new Map(officiel.map(f => [f.equipe, f]));
    for (const f of calcule){ f.conf = groupes.get(f.equipe)?.conf ?? null; f.div = groupes.get(f.equipe)?.div ?? null; }
    ETAT.classement = {fiches: calcule, officiel: false, date: ETAT.stats.date};
  }
  const f = ficheEquipe(CONFIG.equipe);
  ETAT.fiche = CONFIG.equipe + ' ' + (f ? `${f.w}-${f.l}-${f.t}` : '0-0-0');
}
function ficheEquipe(code){ return ETAT.classement.fiches.find(f => f.equipe === code) || null; }
function matchsEquipe(){
  const f = ficheEquipe(CONFIG.equipe);
  return f ? f.w + f.l + f.t : 0;
}

/* ---------- Ouverture : relevé intégré ou données conservées ----------
   Pour chaque jeu de données, la version la plus récente gagne. */
function plusRecent(a, b){ return !!a && (!b || Date.parse(a) > Date.parse(b)); }
function restaurerDonnees(){
  const cache = litCache();
  // 1) la ligue : relevé intégré, sauf si le navigateur en conserve une plus récente
  const snap = litInstantane();
  const conserveGagne = snap && snap.equipes && plusRecent(snap.date, USHL_RELEVE.date);
  const [premier, second] = conserveGagne
    ? [{...snap, origine: 'conserve'}, {...USHL_RELEVE, origine: 'releve'}]
    : [{...USHL_RELEVE, origine: 'releve'}, snap ? {...snap, origine: 'conserve'} : null];
  const equipes = {};
  for (const code of LIGUE_EQUIPES){
    const source = [premier, second].find(s => s && s.equipes[code] && s.equipes[code].length);
    equipes[code] = source ? decoderTableau(source.equipes[code], source.origine) : decoderEquipe(code);
  }
  ETAT.ligue = {equipes, date: premier.date, origine: premier.origine};
  ETAT.version++;
  rafraichirRosterClub();
  // 2) statistiques, classement, minutes
  const c = cache.stats;
  if (c && plusRecent(c.date, USHL_RELEVE.date)){
    poserStats(c.patineurs.map(t => decompacter(CLES_PATINEUR, t)), c.gardiens.map(t => decompacter(CLES_GARDIEN, t)), {date: c.date});
  } else {
    poserStats(USHL_RELEVE.patineurs.map(t => decompacter(CLES_PATINEUR, t)),
               USHL_RELEVE.gardiens.map(t => decompacter(CLES_GARDIEN, t)), {date: USHL_RELEVE.date});
  }
  const cl = cache.classement;
  if (cl && plusRecent(cl.date, USHL_RELEVE.date)) poserClassement(cl.fiches.map(t => decompacter(CLES_FICHE, t)), {date: cl.date});
  else if (USHL_RELEVE.classementOfficiel) poserClassement(USHL_RELEVE.classement.map(t => decompacter(CLES_FICHE, t)), {date: USHL_RELEVE.date});
  const mn = cache.minutes;
  if (mn && plusRecent(mn.date, USHL_RELEVE.date)) poserMinutes(mn.parCle, mn.dateXtra);
  else poserMinutes(USHL_RELEVE.minutes, USHL_RELEVE.dateMinutes);
  if (USHL_RELEVE.reference && USHL_RELEVE.reference.length && !ETAT.enSaison){
    poserXtra(USHL_RELEVE.reference.map(t => decompacter(CLES_XTRA, t)), USHL_RELEVE.dateMinutes);
  }
  if (cache.limites) ETAT.limites = new Map(cache.limites.v.map(x => [normaliserNom(x.nom), x.limite]));
}

/* ---------- Accès aux alignements ---------- */
function joueursEquipeBrut(code){
  return ETAT.ligue.equipes[code] || (ETAT.ligue.equipes[code] = decoderEquipe(code));
}
function joueursEquipe(code){
  if (code === CONFIG.equipe) return ETAT.roster;
  return appliquerTransferts(code, joueursEquipeBrut(code));
}
/* Vrai quand les cotes servies pour cette équipe viennent de ushl.ca — donc
   quand elles constituent un côté «après» valide face à la base S21. */
function cotesDuSite(code){
  const joueurs = ETAT.ligue.equipes[code];
  return !!(joueurs && joueurs.length && joueurs[0]._origine !== 's21');
}
/* Provenance lisible des cotes d'un joueur. */
function provenanceDe(j){
  const date = dateLisible(ETAT.ligue.date);
  switch (j._origine){
    case 'direct':   return `ushl.ca, lu ${ilYA(ETAT.ligue.date)}`;
    case 'conserve': return `dernière lecture de ushl.ca, le ${date}`;
    case 'releve':   return `relevé de ushl.ca du ${date}`;
    default:         return `fichiers de la ligue du ${DATE_S21} — périmé, à actualiser`;
  }
}
/* D'où viennent les chiffres affichés, pour l'en-tête. Une lecture du jour
   n'affiche que son heure. */
function sourceLisible(){
  const {date, origine} = ETAT.ligue;
  const duJour = dateLisible(date) === dateLisible(new Date().toISOString());
  const quand = (duJour ? [heureLisible(date)] : [dateLisible(date), heureLisible(date)]).filter(Boolean).join(', ');
  if (origine === 'direct') return `ushl.ca en direct · ${quand}`;
  if (origine === 'conserve') return `dernière lecture de ushl.ca · ${quand}`;
  return `relevé de ushl.ca · ${quand}`;
}
/* Tous les joueurs de la ligue, étiquetés de leur équipe (recalculé seulement
   quand la ligue ou les transferts changent). */
function joueursLigue(){
  const empreinte = ETAT.version + '|' + (localStorage.getItem(CLES_LS.transferts) || '');
  if (joueursLigue._empreinte !== empreinte){
    const tous = [];
    for (const eq of LIGUE_EQUIPES)
      for (const j of joueursEquipe(eq)) tous.push(Object.assign({equipe: eq}, j));
    joueursLigue._liste = tous; joueursLigue._empreinte = empreinte;
  }
  return joueursLigue._liste;
}

/* ---------- Transferts locaux ----------
   La base de données du site met parfois du temps à refléter un échange :
   un transfert local déplace un joueur d'une équipe à l'autre DANS
   L'APPLICATION SEULEMENT (persisté dans ce navigateur), le temps que
   l'administration de la ligue le traite. Il s'applique partout —
   alignement, masse, plafond, trios, ligue, recotes — et survit aux
   actualisations : retire-le quand le site est à jour. */
function litTransferts(){
  try { return JSON.parse(localStorage.getItem(CLES_LS.transferts) || '[]'); }
  catch { return []; }
}
function ecritTransferts(t){ localStorage.setItem(CLES_LS.transferts, JSON.stringify(t)); }
function appliquerTransferts(code, joueurs){
  const ts = litTransferts();
  if (!ts.length) return joueurs;
  const nn = normaliserNom;
  const out = joueurs.filter(j=>!ts.some(t=>t.de===code && nn(t.nom)===nn(j.nom)));
  for (const t of ts){
    if (t.vers !== code) continue;
    const src = joueursEquipeBrut(t.de).find(j=>nn(j.nom)===nn(t.nom));
    if (src && !out.some(j=>nn(j.nom)===nn(src.nom))){
      const c = Object.assign({}, src, {_transfert: t.de});
      c._profil = determinerProfil(c);
      out.push(c);
    }
  }
  return out;
}
/* Recalcule la formation effective du club (formation servie + transferts). */
function rafraichirRosterClub(){
  ETAT.rosterBrut = joueursEquipeBrut(CONFIG.equipe);
  ETAT.roster = appliquerTransferts(CONFIG.equipe, ETAT.rosterBrut);
}

/* ---------- Production d'un joueur ----------
   Statistiques de la saison (API) et minutes jouées (XtraStats) réunies.
   `equipe` : celle où le joueur est aligné ; un joueur fraîchement échangé
   est retrouvé par son nom si ses statistiques sont restées à l'ancien club.
   Avant le premier match de la saison, ce sont les totaux de la saison
   précédente qui sont rendus, marqués `_reference` (jamais évalués). */
function productionDe(j, equipe){
  const eq = equipe || j.equipe || CONFIG.equipe;
  const nom = normaliserNom(j.nom);
  if (ETAT.reference){
    const y = ETAT.reference.parCle.get(nom);
    if (!y) return null;
    return Object.assign(productionVide(), {
      gp: y.gp, goals: y.goals, assists: y.assists, pts: y.pts, shots: y.shots, pim: y.pim, mp: y.mp, hits: y.hits,
      shotpct: y.shots ? y.goals / y.shots * 100 : null, _reference: true
    });
  }
  const type = j.po === 'G' ? 'g' : 'p';
  const s = ETAT.stats.parCle.get(type + cleJoueur(j.nom, eq)) || ETAT.stats.parNom.get(type + nom);
  if (!s) return null;
  const out = Object.assign(productionVide(), {gp: s.gp});
  if (j.po === 'G'){
    Object.assign(out, {mp: s.mp, w: s.w, l: s.l, t: s.t, avg: s.avg, svpct: s.svpct, so: s.so, hs: s.so, sa: s.sa, ga: s.ga});
  } else {
    Object.assign(out, {goals: s.goals, assists: s.assists, pts: s.pts, plusminus: s.plusminus, pim: s.pim,
      ppg: s.ppg, shg: s.shg, gwg: s.gwg, hits: s.hits, shots: s.shots,
      mp: ETAT.minutes.parCle[cleJoueur(j.nom, s.equipe)] ?? null,
      shotpct: (s.goals !== null && s.shots) ? s.goals / s.shots * 100 : null});
  }
  return out;
}
function productionVide(){
  return {gp: null, goals: null, assists: null, pts: null, plusminus: null, pim: null, ppg: null, shg: null, gwg: null,
    hits: null, shots: null, shotpct: null, mp: null, w: null, l: null, t: null, avg: null, svpct: null,
    so: null, hs: null, qs: null, sa: null, ga: null, _reference: false};
}
