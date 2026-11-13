/* =====================================================================
   LECTURE DE USHL.CA : adresses, API JSON, pages sans API
   ---------------------------------------------------------------------
   Le site de la ligue expose une API JSON qui autorise les requêtes
   directes d'un navigateur (Access-Control-Allow-Origin: *) :
     api/?api=search  → tous les joueurs de la ligue (cotes, âge, contrat)
     api/?api=stats   → statistiques des patineurs ou des gardiens
   C'est la source principale : trois requêtes, moins d'une seconde, aucun
   relais. Deux pages n'ont pas d'équivalent dans l'API et restent lues en
   HTML : le classement officiel (Standings.php) et XtraStats (minutes).

   Ce fichier ne dépend de rien : il est chargé tel quel par la page et par
   scripts/releve.js (Node), qui produit le relevé intégré data/releve.js.
   ===================================================================== */

const BASE_SIM = 'https://ushl.ca/ushl/menu_sim/USHL-pro/jamesishot/';
const URLS_USHL = {
  api:        BASE_SIM + 'api/',
  classement: BASE_SIM + 'Standings.php',
  xtra:       'https://ushl.ca/ushl/menu_sim/USHL-pro/USHLxtrastats.html',
  matrices:   'https://ushl.ca/ushl/menu_ushl/la_ligue/reglements/MATRICES%20DES%20PROFILS.htm',
  formation:  code => BASE_SIM + 'TeamRosters.php?team=' + encodeURIComponent(code),
  fiche:      nom  => BASE_SIM + 'CareerStatsPlayer.php?csName=' + encodeURIComponent(nom)
};
/* Les trois lectures de l'API. `length=-1` : toutes les rangées d'un coup. */
const REQUETES_API = {
  joueurs:   URLS_USHL.api + '?api=search&action=find&start=0&length=-1',
  patineurs: URLS_USHL.api + '?api=stats&action=find&start=0&length=-1&seasonType=REG',
  gardiens:  URLS_USHL.api + '?api=stats&action=find&type=goalie&start=0&length=-1'
};

/* ---------- Utilitaires ---------- */
function normaliserNom(s){
  return (s||'').normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[_\s]+/g,' ').trim().toLowerCase();
}
/* Nombre tel qu'écrit par le site : espaces, «$», virgule décimale, «NA». */
function nombre(s){
  if (s===null || s===undefined) return null;
  const t = String(s).replace(/ /g,' ').replace(/[$\s]/g,'').replace(',','.');
  if (t==='' || t==='NA' || t==='N/A' || t==='-') return null;
  const n = Number(t);
  return isFinite(n) ? n : null;
}
/* Rangées fictives des alignements : joueurs Backup_ du simulateur et
   lignes comptables de rachats ou de salaires retenus. */
function estFictif(nom){
  return /^(backup|rachat|retenue?)/i.test(String(nom).replace(/[\s_]/g,''));
}

/* ---------- Formats compacts ----------
   Un joueur, une statistique ou une fiche = un tableau de valeurs dans
   l'ordre des clés ci-dessous. C'est le format du relevé intégré, de ce
   que le navigateur conserve et de la base S21. */
const CLES_JOUEUR = ['nom','po','hd','no','it','sp','st','en','du','di','sk','pa','pc','df','sc','ex','ld',
  'ov','age','salaire','ct','cd','ij'];
const CLES_PATINEUR = ['nom','equipe','pos','gp','goals','assists','pts','plusminus','pim','ppg','shg','gwg','hits','shots'];
const CLES_GARDIEN = ['nom','equipe','gp','mp','avg','w','l','t','so','sa','ga','svpct'];
const CLES_XTRA = ['nom','equipe','pos','gp','goals','assists','pts','shots','pim','mp','hits'];
const CLES_FICHE = ['equipe','conf','div','gp','w','l','t','otl','pts','gf','ga','l10','serie'];
const compacter = (cles, o) => cles.map(k => o[k] ?? null);
const decompacter = (cles, t) => Object.fromEntries(cles.map((k,i) => [k, t[i] ?? null]));

/* ---------- API → joueurs ----------
   L'API parle anglais (LW, RW, main R/L) ; l'application garde les codes
   de la page française du site (AG, AD, main D/G). */
const POSITIONS_API = {LW:'AG', RW:'AD'};
const MAINS_API = {R:'D', L:'G'};
function joueurDepuisApi(r){
  const j = {
    nom: String(r.name||'').replace(/\s+/g,' ').trim(),
    po: POSITIONS_API[r.position] || r.position || '',
    hd: MAINS_API[r.hand] || '',
    no: nombre(r.number),
    it: nombre(r.it), sp: nombre(r.sp), st: nombre(r.st), en: nombre(r.en), du: nombre(r.du),
    di: nombre(r.di), sk: nombre(r.sk), pa: nombre(r.pa), pc: nombre(r.pc),
    df: nombre(r.df), sc: nombre(r.sc), ex: nombre(r.ex), ld: nombre(r.ld),
    ov: nombre(r.ov), age: nombre(r.age), salaire: nombre(r.salary), ct: nombre(r.ct),
    cd: r.condition === 'OK' ? null : nombre(r.condition),   // null = en pleine forme
    ij: r.injStatus || null                                  // blessure ou suspension
  };
  if (j.po === 'G'){ j.df = null; j.sc = null; }             // «NA» sur le site
  return j;
}
/* Réponse de api=search → {CODE: [joueurs du grand club]}.
   Le club-école et les espoirs (type Farm / Prospect) sont laissés de côté,
   comme sur la page Formation du site. */
function equipesDepuisApi(rangees){
  const equipes = {};
  for (const r of rangees || []){
    if (r.type !== 'Pro' || !r.team || !r.name) continue;
    const j = joueurDepuisApi(r);
    if (j.ov === null || j.age === null) continue;
    (equipes[r.team] ||= []).push(j);
  }
  return equipes;
}
function patineurDepuisApi(r){
  return {
    nom: String(r.name||'').replace(/\s+/g,' ').trim(), equipe: r.team, pos: r.position,
    gp: nombre(r.gamesPlayed), goals: nombre(r.goals), assists: nombre(r.assists), pts: nombre(r.points),
    plusminus: nombre(r.plusMinus), pim: nombre(r.pim), ppg: nombre(r.ppg), shg: nombre(r.shg),
    gwg: nombre(r.gwg), hits: nombre(r.hits), shots: nombre(r.shots)
  };
}
function gardienDepuisApi(r){
  return {
    nom: String(r.name||'').replace(/\s+/g,' ').trim(), equipe: r.team,
    gp: nombre(r.gamesPlayed), mp: nombre(r.minutes), avg: nombre(r.gaa),
    w: nombre(r.wins), l: nombre(r.losses), t: nombre(r.ties), so: nombre(r.shutouts),
    sa: nombre(r.savesAttempted), ga: nombre(r.goalsAgainst), svpct: nombre(r.savePct)
  };
}
const patineursDepuisApi = rangees => (rangees||[]).filter(r => r.name && r.team && !estFictif(r.name)).map(patineurDepuisApi);
const gardiensDepuisApi  = rangees => (rangees||[]).filter(r => r.name && r.team && !estFictif(r.name)).map(gardienDepuisApi);

/* ---------- Classement ----------
   Standings.php : deux tableaux d'association, puis quatre de section, chacun
   précédé de son titre. Lu par expressions régulières (pas de DOM en Node). */
function parseClassement(html){
  const fiches = new Map();
  const re = /(\w[\w .'-]*?)\s+(Association|Section)\s*<|<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let groupe = null, m;
  while ((m = re.exec(html))){
    if (m[2]){ groupe = {type: m[2] === 'Association' ? 'conf' : 'div', nom: m[1].trim()}; continue; }
    const code = (m[3].match(/TeamRosters\.php\?team=([^"'&]+)/) || [])[1];
    if (!code || !groupe) continue;
    const c = [...m[3].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x => x[1].replace(/<[^>]*>/g,'').trim());
    if (c.length < 15) continue;
    const f = fiches.get(code) || {equipe: decodeURIComponent(code), conf: null, div: null};
    f[groupe.type] = groupe.nom;
    Object.assign(f, {gp: nombre(c[3]), w: nombre(c[4]), l: nombre(c[5]), t: nombre(c[6]), otl: nombre(c[7]),
      pts: nombre(c[8]), gf: nombre(c[9]), ga: nombre(c[10]), l10: c[13] || null, serie: c[14] || null});
    fiches.set(code, f);
  }
  return [...fiches.values()].filter(f => f.gp !== null && f.pts !== null);
}
/* Sans la page du classement : les décisions des gardiens d'une équipe
   donnent sa fiche V-D-N (vérifié sur les 32 clubs), 2 points par victoire,
   1 par nulle. Les buts pour sont ceux des patineurs. */
function classementDepuisStats(patineurs, gardiens){
  const fiches = new Map();
  const de = code => fiches.get(code) || fiches.set(code, {equipe: code, conf: null, div: null,
    gp: 0, w: 0, l: 0, t: 0, otl: null, pts: 0, gf: 0, ga: 0, l10: null, serie: null, calcule: true}).get(code);
  for (const g of gardiens || []){
    const f = de(g.equipe);
    f.w += g.w || 0; f.l += g.l || 0; f.t += g.t || 0; f.ga += g.ga || 0;
  }
  for (const p of patineurs || []) de(p.equipe).gf += p.goals || 0;
  for (const f of fiches.values()){ f.gp = f.w + f.l + f.t; f.pts = 2*f.w + f.t; }
  return [...fiches.values()].filter(f => f.gp > 0);
}

/* ---------- XtraStats (texte préformaté) ----------
   Colonnes fixes : Player Team POS GP G A P Sh PiM MP H ...
   Seule source des MINUTES JOUÉES des patineurs. Selon le relais, les noms
   arrivent entourés de balises HTML ou de liens markdown : on nettoie. */
function nettoyerLigneXtra(l){
  return l
    .replace(/<[^>]*>/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/&amp;/g, '&').replace(/&#0?39;|&apos;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ');
}
/* Les codes d'équipe sont en majuscules (points compris : ST.LOUIS). */
const RE_LIGNE_XTRA = /^\s*\*?\s*(.+?)\s+([A-Z][A-Z._-]{2,})\s+(C|LW|RW|D|G)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/;
function parseXtraLigue(texte){
  const resultat = [];
  for (const l of String(texte).split(/\r?\n/)){
    const m = nettoyerLigneXtra(l).match(RE_LIGNE_XTRA);
    if (!m || estFictif(m[1])) continue;
    resultat.push({
      nom: m[1].replace(/\s+/g,' ').trim(), equipe: m[2], pos: m[3],
      gp: +m[4], goals: +m[5], assists: +m[6], pts: +m[7],
      shots: +m[8], pim: +m[9], mp: +m[10], hits: +m[11]
    });
  }
  return resultat;
}
const parseXtra = (texte, equipe) => parseXtraLigue(texte).filter(x => x.equipe === equipe);
/* Date de production de la page («As of 11/12/2026 02:57:15»). */
function dateXtra(texte){
  const m = String(texte).match(/As of\s+([0-9\/]+)/i);
  return m ? m[1] : null;
}
/* Clé d'un joueur dans une équipe : deux homonymes ne se mélangent pas. */
const cleJoueur = (nom, equipe) => normaliserNom(nom) + '|' + equipe;
/* XtraStats réduit à ce que l'API ne donne pas : {clé: minutes jouées}. */
function minutesDepuisXtra(liste){
  const minutes = {};
  for (const x of liste) if (x.pos !== 'G') minutes[cleJoueur(x.nom, x.equipe)] = x.mp;
  return minutes;
}

if (typeof module !== 'undefined' && module.exports){
  module.exports = {BASE_SIM, URLS_USHL, REQUETES_API, normaliserNom, nombre, estFictif,
    CLES_JOUEUR, CLES_PATINEUR, CLES_GARDIEN, CLES_XTRA, CLES_FICHE, compacter, decompacter,
    joueurDepuisApi, equipesDepuisApi, patineursDepuisApi, gardiensDepuisApi,
    parseClassement, classementDepuisStats, nettoyerLigneXtra, parseXtraLigue, parseXtra, dateXtra,
    cleJoueur, minutesDepuisXtra};
}
