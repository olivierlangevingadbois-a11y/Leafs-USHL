/* =====================================================================
   MOTEUR : formats, parseurs des pages de la ligue, profils, attentes
   ===================================================================== */

/* ---------- Utilitaires ---------- */
/* Échappe un texte avant interpolation dans du HTML (les noms viennent de pages
   externes : défense en profondeur). */
function echap(s){
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function fmtArgent(n){
  if (n===null || n===undefined) return '—';
  return n.toLocaleString('fr-CA').replace(/,/g,' ') + ' $';
}
/* Format compact pour les champs de re-signature : 8 500 000 → «8,5 M», 900 000 → «900 k». */
function fmtArgentCourt(n){
  if (n===null || n===undefined) return '—';
  if (n >= 1000000){
    const m = n/1000000;
    return (Math.abs(m%1)<1e-9 ? String(m) : m.toFixed(1).replace('.',',')) + ' M';
  }
  return Math.round(n/1000) + ' k';
}
/* Interprète un montant saisi : «8,5 M», «8.5M», «900 k», «900000», «8 500 000». */
function parseArgent(txt){
  if (typeof txt !== 'string') return null;
  let s = txt.trim().toLowerCase().replace(/\$/g,'').replace(/\u00a0/g,' ');
  const mMatch = s.match(/^([\d.,\s]+)\s*m$/);
  const kMatch = s.match(/^([\d.,\s]+)\s*k$/);
  if (mMatch){ const v = parseFloat(mMatch[1].replace(/\s/g,'').replace(',','.')); return isFinite(v)?Math.round(v*1000000):null; }
  if (kMatch){ const v = parseFloat(kMatch[1].replace(/\s/g,'').replace(',','.')); return isFinite(v)?Math.round(v*1000):null; }
  const brut = parseFloat(s.replace(/\s/g,'').replace(',','.'));
  return isFinite(brut) ? Math.round(brut) : null;
}
function fmtStat(cle, v){
  if (v===null || v===undefined || !isFinite(v)) return '—';
  const def = STATS_DEF[cle] || {};
  if (def.decimales!==undefined) return v.toFixed(def.decimales);
  const r = Math.round(v*10)/10;
  const txt = (Math.abs(r % 1) < 1e-9) ? String(Math.round(r)) : r.toFixed(1);
  return (def.signe && v>0 ? '+' : '') + txt;
}

/* ---------- Parseur : page officielle des MATRICES DES PROFILS ----------
   La ligue republie ses attentes à chaque saison. Cette page est lue telle
   quelle : on repère toute table dont l'en-tête porte les six degrés de
   satisfaction, on rattache la table au profil et à la statistique nommés
   juste avant (ou dans la table), puis on convertit les rangées d'overall
   en rangées personnalisées qui remplacent les valeurs Y17. */
function normTxt(s){
  return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[\s\u00a0]+/g,' ').trim().toLowerCase();
}
/* Alias des profils → code de matrice. */
const ALIAS_MATRICES = (()=>{
  const a = {};
  const ajoute = (txt, cle)=>{ const n = normTxt(txt); if (n) a[n] = cle; };
  for (const [cle, nom] of Object.entries(NOMS_MATRICES)){ ajoute(nom, cle); ajoute(cle, cle); }
  // variantes rencontrées dans les règlements (tableaux 10-11-12) et sur le site
  const extra = {
    ELITE:['elite','joueur elite','attaquant elite','junior elite','prospect elite'],
    PLAYMAKER:['playmaker','fabricant de jeu','junior playmaker','prospect playmaker'],
    POWERFWD:['power forward','powerforward','attaquant de puissance','junior power forward','prospect power forward'],
    TWOWAY:['two-way forward','two way forward','twoway','attaquant a deux sens','junior two-way','prospect two-way forward'],
    SNIPER:['sniper','franc-tireur','junior sniper','prospect sniper'],
    GRINDER:['grinder','junior grinder','prospect grinder'],
    DEFFWD:['defensive forward','attaquant defensif','defensive','junior defensive','prospect defensive'],
    DEPTHFWD:['depth forward','attaquant de soutien','junior depth forward','prospect depth forward'],
    DELITEQB:['delite qb','deliteqb','d elite qb','defenseur elite qb','quart-arriere','junior deliteqb','prospect deliteqb'],
    DELITESD:['delite shutdown','delitesd','deliteshutdown','d elite shutdown','defenseur elite shutdown','junior deliteshutdown','prospect deliteshutdown'],
    DOFF:['doffensive','d offensive','defenseur offensif','junior doffensive','prospect doffensive'],
    DDEF:['ddefensive','d defensive','defenseur defensif','junior ddefensive','prospect ddefensive'],
    DDEPTH:['ddepth defense','ddepth','d depth','defenseur de soutien','dtwo-way','d two-way','junior dtwo-way','prospect dtwo-way'],
    STARTER:['starter goalie','gardien partant','partant','starter'],
    BACKUP:['backup goalie','gardien auxiliaire','auxiliaire','backup']
  };
  for (const [cle, liste] of Object.entries(extra)) for (const t of liste) ajoute(t, cle);
  return a;
})();
/* Alias des statistiques → clé interne, bâtis sur les titres officiels déjà
   transcrits dans MATRICES et sur les noms d'affichage. */
const ALIAS_STATS = (()=>{
  const a = {};
  const ajoute = (txt, cle)=>{ const n = normTxt(txt); if (n && !a[n]) a[n] = cle; };
  for (const stats of Object.values(MATRICES))
    for (const [cle, def] of Object.entries(stats)) ajoute(def.titre, cle);
  for (const [cle, def] of Object.entries(STATS_DEF)){ ajoute(def.nom, cle); ajoute(def.court, cle); ajoute(cle, cle); }
  const extra = {
    pts:['points','points accumules','points accumulees','nombre points','nombre de points','p'],
    goals:['buts','but comptes','buts comptes','but accumules','buts accumules','nombre de buts','b','g'],
    assists:['passes','passes accumulees','aides','mentions d aide','a'],
    hits:['mises en echec','mises en echecs completees','mises en echec completees','mise en echec','mee'],
    shots:['tirs','tirs au but','tirs au but effectues','nombre tirs au but','nombre de tirs'],
    shotpct:['pctg','% de tirs','pourcentage de tirs','pourcentage de tir','efficacite'],
    gwg:['buts gagnants','but gagnant','buts gagants','bg','gw'],
    ppg:['nombre but en pp','buts en pp','but en avantage numerique','buts en avantage numerique','pp','ban'],
    pmrang:['rang +/- dans le club','rang differentiel','rang du differentiel','rang +/-'],
    hits20:['mises en echecs completees par tranche de 20 minutes','mee par 20 minutes','mee/20','mises en echec par 20 minutes'],
    shots20:['tirs au but par tranche de 20 minutes','tirs par 20 minutes','t/20'],
    mg:['minutes par match joues','minutes par matchs joues','minutes par match','min/m','minutes par partie'],
    mp:['minutes jouees','minutes','min'],
    hs:['head stand','headstand','hs'],
    qggp:['ratio nombre parties qualites par parties jouees','nombre de parties de qualite','departs de qualite','dq/m','parties de qualite'],
    ming:['parties jouees sur maximum de parties permises','parties sur maximum permis','mj/max'],
    psv:['statistiques de perseverance','perseverance','psv'],
    svpct:['pourcentage d arret cumule','pourcentage d arrets','% d arrets','sv%','%a'],
    plusminus:['differentiel','+/-']
  };
  for (const [cle, liste] of Object.entries(extra)) for (const t of liste) ajoute(t, cle);
  return a;
})();
function reconnaitre(texte, alias){
  const n = normTxt(texte);
  if (!n) return null;
  if (alias[n]) return alias[n];
  let trouve = null, meilleur = 0;
  for (const [cle, val] of Object.entries(alias)){
    if (cle.length > 3 && cle.length > meilleur && n.includes(cle)){ trouve = val; meilleur = cle.length; }
  }
  return trouve;
}
/* Nombre d'une cellule de matrice : gère «12,5», «85 %», «1 838», «-1». */
function nombreCellule(txt){
  const t = String(txt ?? '').replace(/[ \s%]/g,'').replace(',', '.');
  if (!t || /^(na|nd|-|—)$/i.test(t)) return null;
  const m = t.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}
const DEGRES_CLES = ['memorable','excellente','satisfaisante','correcte','decevante','oublier'];
/* Analyse la page des matrices. Retourne {matrices, rapport}. */
function parseMatricesUshl(html, doc){
  const d = doc || new DOMParser().parseFromString(html, 'text/html');
  const matrices = {}, rapport = [];
  let profilCourant = null, statCourante = null;
  const pile = [d.body || d.documentElement].filter(Boolean);
  const noeuds = [];
  (function collecter(n){
    for (const enfant of Array.from(n.childNodes)){
      if (enfant.nodeType === 3){ noeuds.push({texte: enfant.textContent}); continue; }
      if (enfant.nodeType !== 1) continue;
      const nom = enfant.tagName.toLowerCase();
      if (nom === 'table'){ noeuds.push({table: enfant}); continue; } // pas de descente : traitée en bloc
      if (nom === 'script' || nom === 'style') continue;
      collecter(enfant);
    }
  })(pile[0]);

  for (const n of noeuds){
    if (n.texte !== undefined){
      const p = reconnaitre(n.texte, ALIAS_MATRICES);
      if (p) profilCourant = p;
      const s = reconnaitre(n.texte, ALIAS_STATS);
      if (s) statCourante = s;
      continue;
    }
    const lignes = Array.from(n.table.querySelectorAll('tr'));
    if (lignes.length < 2) continue;
    // en-tête : la rangée qui nomme les six degrés
    let iEntete = -1, colonnes = null;
    for (let i = 0; i < Math.min(lignes.length, 4); i++){
      const cel = Array.from(lignes[i].querySelectorAll('th,td')).map(c=>normTxt(c.textContent));
      const map = {};
      DEGRES_CLES.forEach((deg,di)=>{
        const j = cel.findIndex(t => t.includes(deg) || (deg==='oublier' && t.includes('a oublier')));
        if (j >= 0) map[di] = j;
      });
      if (Object.keys(map).length >= 5){ iEntete = i; colonnes = map; break; }
    }
    if (iEntete < 0) continue;
    // profil et statistique : contexte courant, ou texte des rangées de titre
    let profil = profilCourant, stat = statCourante;
    for (let i = 0; i < iEntete; i++){
      const t = lignes[i].textContent;
      profil = reconnaitre(t, ALIAS_MATRICES) || profil;
      stat = reconnaitre(t, ALIAS_STATS) || stat;
    }
    const bandes = [];
    for (let i = iEntete + 1; i < lignes.length; i++){
      const cel = Array.from(lignes[i].querySelectorAll('th,td')).map(c=>c.textContent);
      if (!cel.length) continue;
      // une rangée peut renommer la statistique (tableau multi-stats)
      const sLigne = reconnaitre(cel[0], ALIAS_STATS);
      const ovLigne = nombreCellule(cel[0]);
      if (ovLigne === null){ if (sLigne) stat = sLigne; continue; }
      const seuils = DEGRES_CLES.map((_,di)=> colonnes[di] === undefined ? null : nombreCellule(cel[colonnes[di]]));
      if (seuils.every(v=>v===null)) continue;
      bandes.push([Math.round(ovLigne), seuils]);
    }
    if (!profil || !stat || !bandes.length){
      rapport.push({profil, stat, rangees:0, ignore:true});
      continue;
    }
    // bandes d'overall → une rangée par OV (comme seuilsMatrice)
    matrices[profil] = matrices[profil] || {};
    const parOv = matrices[profil][stat] = etendreBandes(bandes);
    rapport.push({profil, stat, rangees: Object.keys(parOv).length, bandes: bandes.length});
  }
  return {matrices, rapport};
}
/* Étend des bandes d'overall [[ovMax, seuils], …] en une rangée par OV. */
function etendreBandes(bandes){
  const parOv = {};
  bandes.sort((a,b)=>a[0]-b[0]);
  let debut = OV_MIN;
  bandes.forEach(([ovMax, seuils], i)=>{
    const fin = (i === bandes.length - 1) ? OV_MAX : Math.min(ovMax, OV_MAX);
    for (let ov = Math.max(OV_MIN, Math.min(debut, OV_MAX)); ov <= fin; ov++) parOv[ov] = seuils.slice();
    debut = ovMax + 1;
  });
  return parOv;
}
/* Variante texte : la page copiée-collée depuis le navigateur arrive en
   lignes de colonnes séparées par des tabulations ou des espaces. */
function parseMatricesTexte(texte){
  const matrices = {}, rapport = {};
  let profil = null, stat = null;
  for (const ligne of String(texte).split(/\r?\n/)){
    const brut = ligne.trim();
    if (!brut) continue;
    const cellules = brut.split(/\t+| {2,}|\s*\|\s*/).map(c=>c.trim()).filter(c=>c!=='');
    const nombres = cellules.map(nombreCellule);
    // une rangée de données : overall + au moins cinq seuils
    if (cellules.length >= 6 && nombres[0] !== null && nombres.slice(1,6).every(v=>v!==null)){
      if (!profil || !stat) continue;
      const cle = profil + '|' + stat;
      (rapport[cle] = rapport[cle] || []).push([Math.round(nombres[0]), nombres.slice(1,7).map(v=>v===undefined?null:v)]);
      continue;
    }
    const p = reconnaitre(brut, ALIAS_MATRICES);
    if (p){ profil = p; const s0 = reconnaitre(brut, ALIAS_STATS); if (s0) stat = s0; continue; }
    const s = reconnaitre(brut, ALIAS_STATS);
    if (s) stat = s;
  }
  const detail = [];
  for (const [cle, bandes] of Object.entries(rapport)){
    const [mat, st] = cle.split('|');
    matrices[mat] = matrices[mat] || {};
    matrices[mat][st] = etendreBandes(bandes);
    detail.push({profil:mat, stat:st, rangees:Object.keys(matrices[mat][st]).length, bandes:bandes.length});
  }
  return {matrices, rapport: detail};
}

/* Fusionne les matrices importées avec les rangées personnalisées existantes.
   Accepte la page HTML de la ligue ou son copier-coller en texte. */
function importerMatricesUshl(html){
  let {matrices, rapport} = parseMatricesUshl(html);
  if (!Object.keys(matrices).length){
    ({matrices, rapport} = parseMatricesTexte(html));
  }
  const profils = Object.keys(matrices);
  if (!profils.length) throw new Error('aucune matrice reconnue dans la page');
  const actuel = chargerMatrices();
  for (const [mat, stats] of Object.entries(matrices)){
    actuel[mat] = actuel[mat] || {};
    for (const [stat, rangees] of Object.entries(stats)) actuel[mat][stat] = rangees;
  }
  sauverMatrices(actuel);
  const nbStats = rapport.filter(r=>!r.ignore).length;
  const nbRangees = rapport.reduce((s,r)=>s+(r.rangees||0),0);
  return {profils: profils.length, stats: nbStats, rangees: nbRangees, rapport};
}

/* ---------- Parseur : fiche d'un joueur (CareerStatsPlayer.php) ----------
   Section «Historique des attributs» : une rangée par saison —
   S IN SP ST EN DU DI SK PA PC DF OF EX LD OV. C'est la source la plus
   fiable pour le suivi des recotes (OV du site compris, gardiens inclus). */
function parseFicheAttributs(html, doc){
  const d = doc || new DOMParser().parseFromString(html, 'text/html');
  const correspondance = [['it','IN'],['sp','SP'],['st','ST'],['en','EN'],['du','DU'],['di','DI'],
    ['sk','SK'],['pa','PA'],['pc','PC'],['df','DF'],['sc','OF'],['ex','EX'],['ld','LD']];
  for (const table of Array.from(d.querySelectorAll('table'))){
    const lignes = Array.from(table.querySelectorAll('tr'));
    if (lignes.length < 2) continue;
    const entetes = Array.from(lignes[0].querySelectorAll('th,td')).map(c=>c.textContent.trim().toUpperCase());
    if (entetes[0] !== 'S' || !entetes.includes('OV') || !entetes.includes('IN') || !entetes.includes('OF')) continue;
    const idx = {}; entetes.forEach((h,i)=>{ idx[h] = i; });
    const saisons = [];
    for (let i=1; i<lignes.length; i++){
      const cel = Array.from(lignes[i].querySelectorAll('td,th')).map(c=>c.textContent.trim());
      const s = nombre(cel[0]);
      if (s === null) continue;
      const cotes = {};
      for (const [k,h] of correspondance) cotes[k] = nombre(cel[idx[h]]);
      saisons.push({saison: s, cotes, ov: nombre(cel[idx.OV])});
    }
    if (saisons.length) return saisons;
  }
  return [];
}

/* ---------- Profils ---------- */
function categorieAge(age){
  if (age<=20) return 'junior';
  if (age<=24) return 'prospect';
  return 'pro';
}
function groupePosition(po){
  if (po==='G') return 'gardiens';
  if (po==='D') return 'defenseurs';
  return 'avants';
}
function determinerProfil(j){
  const grp = groupePosition(j.po);
  // Règle 6.2.5 : au PRO, les gardiens sont Starter ou Backup selon l'overall, peu importe l'âge.
  const cat = grp==='gardiens' ? 'pro' : categorieAge(j.age);
  const liste = PROFILS[cat][grp];
  const c = j;
  for (const p of liste){
    try { if (p.cond(c)) return {categorie:cat, groupe:grp, profil:p.id, mat:p.mat, stats:STATS_PAR_MATRICE[p.mat]}; }
    catch(e){ /* cotes manquantes (gardiens) */ }
  }
  const dernier = liste[liste.length-1];
  return {categorie:cat, groupe:grp, profil:dernier.id, mat:dernier.mat, stats:STATS_PAR_MATRICE[dernier.mat]};
}

/* ---------- Attentes ---------- */
function chargerMatrices(){
  try { return JSON.parse(localStorage.getItem(CLES_LS.matrices)) || {}; }
  catch(e){ return {}; }
}
function sauverMatrices(m){ localStorage.setItem(CLES_LS.matrices, JSON.stringify(m)); }
function chargerOverrides(){
  try { return JSON.parse(localStorage.getItem(CLES_LS.overrides)) || {}; }
  catch(e){ return {}; }
}
function sauverOverrides(o){ localStorage.setItem(CLES_LS.overrides, JSON.stringify(o)); }

/* Seuils applicables à un joueur pour une statistique :
   rangée personnalisée (Réglages) > matrice Y17 ; la surcharge individuelle
   sur la carte du joueur remplace le seuil Mémorable seulement. */
function seuilsPour(j, statCle, matricesPerso, overrides){
  const matCle = j._profil.mat;
  const o = Math.max(OV_MIN, Math.min(OV_MAX, j.ov));
  let seuils = null, source = null;
  const perso = matricesPerso?.[matCle]?.[statCle]?.[o];
  if (Array.isArray(perso) && perso.length===6){
    seuils = perso.map(x=> (x===null||x===''||x===undefined) ? null : Number(x));
    source = 'personnalisée';
  } else {
    const d = seuilsMatrice(matCle, statCle, j.ov);
    if (d){ seuils = d.slice(); source = 'Y17'; }
  }
  const ov = overrides?.[normaliserNom(j.nom)]?.[statCle];
  if (ov!==undefined && ov!==null && ov!==''){
    if (!seuils) seuils = [null,null,null,null,null,null];
    seuils[0] = Number(ov);
    source = source ? source + ' + Mémorable individuel' : 'Mémorable individuel';
  }
  return seuils ? {seuils, source} : {seuils:null, source:null};
}

/* Statut selon les seuils : un niveau est acquis si la valeur DÉPASSE
   STRICTEMENT son seuil (tableau 18 et règle maison sur le Mémorable). */
function statutSelonSeuils(v, seuils){
  if (v===null || v===undefined || !isFinite(v)) return 'indef';
  if (!seuils) return 'indef';
  const [memo, exc, sat, corr, dec] = seuils;
  if (memo!==null && v > memo) return 'memorable';
  if ([exc,sat,corr,dec].every(x=>x===null)) return 'sousmemo'; // seule la cible Mémorable est connue
  if (exc !==null && v > exc ) return 'excellente';
  if (sat !==null && v > sat ) return 'satisfaisante';
  if (corr!==null && v > corr) return 'correcte';
  if (dec !==null && v > dec ) return 'decevante';
  return 'oublier';
}

/* Évaluation d'une stat : les totaux courants sont évalués tels quels.
   Aucune projection sur la saison — le facteur karma de la ligue rend
   toute extrapolation trompeuse. */
function evaluerStat(statCle, valeur, seuils){
  const statut = statutSelonSeuils(valeur, seuils);
  const mods = MODS_PAR_STATUT[statut] ?? null;
  return {valeur, seuils, statut, mods};
}

/* Valeur (dérivée au besoin) d'une statistique évaluée. ctx : {pmRangs, limites, matchsEquipe} */
function valeurStat(j, prod, statCle, ctx){
  if (!prod) return null;
  const ok = v => (v===null||v===undefined) ? null : v;
  switch (statCle){
    case 'shotpct': return (ok(prod.goals)!==null && prod.shots) ? prod.goals/prod.shots*100 : null;
    case 'hits20':  return (ok(prod.hits)!==null && prod.mp)     ? prod.hits /(prod.mp/20)   : null;
    case 'shots20': return (ok(prod.shots)!==null && prod.mp)    ? prod.shots/(prod.mp/20)   : null;
    case 'mg':      return (ok(prod.mp)!==null && prod.gp)       ? prod.mp/prod.gp           : null;
    case 'qggp':    return (ok(prod.qs)!==null && prod.gp)       ? prod.qs/prod.gp           : null;
    case 'psv':     return (ok(prod.svpct)!==null)               ? prod.svpct*1000           : null;
    case 'pmrang': { const r = ctx?.pmRangs?.get(normaliserNom(j.nom)); return r ? r.prop : null; }
    case 'ming': {
      const lim = ctx?.limites?.get(normaliserNom(j.nom));
      if (!lim || ok(prod.gp)===null) return null;
      return prod.gp / lim;
    }
    default: return ok(prod[statCle]);
  }
}

/* Rang du différentiel dans le club (tableau 20 : «son rang est déterminé puis
   converti en pourcentage»). Calculé automatiquement dès que la production de la
   saison fournit les +/- des patineurs du club (GP > 0).
   Retourne nom → {prop (1 = meilleur, 0 = dernier), rang, total, pm}. */
function calculerPmRangs(patineurs){
  const ps = (patineurs||[]).filter(p=>p.gp>0 && p.plusminus!==undefined && p.plusminus!==null);
  const tri = [...ps].sort((a,b)=>b.plusminus-a.plusminus);
  const n = tri.length, map = new Map();
  tri.forEach((p,i)=>{
    map.set(normaliserNom(p.nom), {prop: n>1 ? (n-1-i)/(n-1) : 1, rang: i+1, total: n, pm: p.plusminus});
  });
  return map;
}

/* ModS estimé : moyenne des modificateurs des statistiques évaluées (tableau 18). */
function modsEstime(evals){
  const avec = evals.filter(e=>e.ev && e.ev.mods!==null && e.ev.mods!==undefined);
  if (!avec.length) return null;
  return Math.round(avec.reduce((a,e)=>a+e.ev.mods,0)/avec.length);
}
