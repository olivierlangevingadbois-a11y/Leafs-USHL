/* =====================================================================
   COUCHE RÉSEAU : relais anti-CORS avec relais «collant» et cache local
   ===================================================================== */
function litCache(){ try{ return JSON.parse(localStorage.getItem(CLES_LS.cache))||{}; }catch(e){ return {}; } }
function ecritCache(c){ try{ localStorage.setItem(CLES_LS.cache, JSON.stringify(c)); }catch(e){ /* quota */ } }

async function chercherViaProxy(url, {timeout=15000}={}){
  const prefere = Number(localStorage.getItem(CLES_LS.proxy));
  const ordre = [...CONFIG.proxys.keys()];
  if (!isNaN(prefere) && ordre.includes(prefere)){
    ordre.splice(ordre.indexOf(prefere),1); ordre.unshift(prefere);
  }
  let derniereErreur = null;
  for (const i of ordre){
    const cible = CONFIG.proxys[i](url);
    try{
      const ctl = new AbortController();
      const t = setTimeout(()=>ctl.abort(), timeout);
      const rep = await fetch(cible, {signal:ctl.signal});
      clearTimeout(t);
      if (!rep.ok) throw new Error('HTTP '+rep.status);
      const texte = await rep.text();
      if (texte.length < 500) throw new Error('réponse trop courte');
      localStorage.setItem(CLES_LS.proxy, String(i));
      return texte;
    }catch(e){
      derniereErreur = e;
      await new Promise(r=>setTimeout(r, 400)); // espacement anti rate-limit
    }
  }
  throw derniereErreur || new Error('aucun relais disponible');
}

/* Le serveur de la ligue conserve une session par visiteur : la première
   requête vers une page d'équipe retombe parfois sur la DERNIÈRE équipe
   consultée (par soi ou par un autre usager du même relais anti-CORS).
   Chaque page reçue est donc validée : la fiche du club («ÉQUIPE W-L-T»)
   doit s'y trouver. Page d'une autre équipe → réessai (la session s'aligne
   dès la requête suivante), jamais de mise en cache d'une page invalide,
   et purge du cache s'il a déjà été pollué. */
function validerPageEquipe(texte){ return extraireFiche(texte) !== null; }

/* `forcer` contourne la cache : un clic sur «Actualiser» doit relire le site,
   sinon un échange ou une signature y reste invisible jusqu'à 12 h. */
async function chercherSource(cle, valider, forcer){
  const cache = litCache();
  const maintenant = Date.now();
  const c = cache[cle];
  if (!forcer && c && (maintenant - c.t) < CONFIG.ttl[cle]){
    if (!valider || valider(c.v)) return {texte:c.v, duCache:true, t:c.t};
    delete cache[cle]; ecritCache(cache); // cache pollué par une autre équipe
  }
  let texte = null, essais = 0;
  for (essais = 1; essais <= 3; essais++){
    const t = await chercherViaProxy(CONFIG.urls[cle]);
    if (!valider || valider(t)){ texte = t; break; }
    await new Promise(r=>setTimeout(r, 600)); // la session du serveur s'aligne au 2e essai
  }
  if (texte === null) throw new Error('le serveur de la ligue sert une autre équipe (session des relais) — réessaie dans un instant');
  cache[cle] = {t:maintenant, v:texte};
  ecritCache(cache);
  return {texte, duCache:false, essais, t:maintenant};
}
function ageCache(t){
  const min = Math.round((Date.now() - t) / 60000);
  return min < 60 ? min + ' min' : Math.floor(min / 60) + ' h';
}

/* Limites d'utilisation des gardiens : JSON public du projet gestiongardiens
   (GitHub Pages autorise les requêtes directes, pas besoin de relais). */
async function chargerLimites(forcer){
  const cache = litCache();
  const c = cache.limites;
  if (!forcer && c && (Date.now()-c.t) < CONFIG.ttl.limites){
    ETAT.limites = new Map(c.v.map(x=>[normaliserNom(x.nom), x.limite]));
    return ETAT.limites.size;
  }
  const rep = await fetch(CONFIG.urlLimites, {cache:'no-store'});
  if (!rep.ok) throw new Error('HTTP '+rep.status);
  const data = await rep.json();
  const liste = Array.isArray(data?.limites) ? data.limites : [];
  ETAT.limites = new Map(liste.map(x=>[normaliserNom(x.nom), x.limite]));
  cache.limites = {t:Date.now(), v:liste};
  ecritCache(cache);
  return ETAT.limites.size;
}

/* ---------- Alignements des autres équipes (en direct de ushl.ca) ----------
   L'instantané intégré (LIGUE) date des fichiers de la ligue et peut retarder
   d'une recote. Quand une autre équipe est consultée (comparateur, calculateur
   d'OV), son TeamRosters.php est téléchargé via les relais, validé (le serveur
   sert parfois la dernière équipe consultée), mis en cache (TTL de la
   formation, 12 h) et remplace l'instantané. Hors ligne, l'instantané reste. */
function urlRosterEquipe(code){
  return 'https://ushl.ca/ushl/menu_sim/USHL-pro/jamesishot/TeamRosters.php?team=' + encodeURIComponent(code);
}
function validerPageDe(code){
  const re = new RegExp(code.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\s+\\d+-\\d+-\\d+');
  return texte => re.test(texte);
}
async function chargerEquipe(code, forcer){
  if (code === CONFIG.equipe) return joueursEquipe(code);
  if (!forcer && ETAT.equipesLive.has(code)) return ETAT.equipesLive.get(code);
  const valide = validerPageDe(code);
  const cache = litCache();
  const cleCache = 'equipe_' + code;
  const c = cache[cleCache];
  let texte = null;
  if (!forcer && c && (Date.now() - c.t) < CONFIG.ttl.roster && valide(c.v)){
    texte = c.v;
  } else {
    for (let essai = 1; essai <= 3 && texte === null; essai++){
      const t = await chercherViaProxy(urlRosterEquipe(code));
      if (valide(t)) texte = t;
      else await new Promise(r=>setTimeout(r, 600)); // la session des relais s'aligne au réessai
    }
    if (texte === null) throw new Error('le serveur de la ligue sert une autre équipe — réessaie dans un instant');
    cache[cleCache] = {t: Date.now(), v: texte};
    ecritCache(cache);
  }
  const joueurs = parseRoster(texte).filter(j=>!estFictif(j.nom));
  if (joueurs.length < 10) throw new Error('table de ' + code + ' introuvable');
  joueurs.forEach(j=>{ j._profil = determinerProfil(j); });
  ETAT.equipesLive.set(code, joueurs);
  memoriserEquipe(code, joueurs);   // devient la nouvelle référence par défaut
  return joueurs;
}
/* ---------- Fiche d'un joueur (historique des attributs, ushl.ca) ---------- */
function urlFicheJoueur(nom){
  return 'https://ushl.ca/ushl/menu_sim/USHL-pro/jamesishot/CareerStatsPlayer.php?csName=' + encodeURIComponent(nom);
}
async function chargerFiche(nom, forcer){
  const cle = normaliserNom(nom);
  if (!forcer && ETAT.fiches.has(cle)) return ETAT.fiches.get(cle);
  const cache = litCache();
  const cleCache = 'fiche_' + cle;
  const c = cache[cleCache];
  let saisons = null;
  if (!forcer && c && (Date.now() - c.t) < CONFIG.ttl.roster){
    saisons = parseFicheAttributs(c.v);
  }
  if (!saisons || !saisons.length){
    const texte = await chercherViaProxy(urlFicheJoueur(nom));
    saisons = parseFicheAttributs(texte);
    if (!saisons.length) throw new Error('historique des attributs introuvable pour ' + nom);
    cache[cleCache] = {t: Date.now(), v: texte};
    ecritCache(cache);
  }
  ETAT.fiches.set(cle, saisons);
  return saisons;
}

/* Déclenche le téléchargement d'une équipe puis re-rend la vue demandeuse.
   Silencieux en cas d'échec : l'instantané intégré demeure affiché. */
function actualiserEquipe(code, rafraichir){
  if (code === CONFIG.equipe || ETAT.equipesLive.has(code)) return;
  chargerEquipe(code).then(()=>{
    rafraichir();
    flash('Cotes de ' + code + ' actualisées depuis ushl.ca');
  }).catch(()=>{});
}

/* XtraStats : archive de la saison précédente ou saison en cours ?
   Si le club n'a disputé aucun match, c'est forcément l'archive (Y21).
   Sinon, on compare le maximum de parties jouées des patineurs du club
   dans XtraStats au nombre de matchs de l'équipe : s'il le dépasse
   nettement, la page est encore l'archive de la saison complète. */
function xtraEstArchive(xtra, matchsEq){
  if (!matchsEq || matchsEq <= 0) return true;
  const maxGP = Math.max(0, ...xtra.map(p => p.gp || 0));
  return maxGP > matchsEq + 2;
}

function extraireFiche(html){
  const m = html.match(new RegExp(CONFIG.equipe + '\\s+(\\d+)-(\\d+)-(\\d+)'));
  return m ? `${CONFIG.equipe} ${m[1]}-${m[2]}-${m[3]}` : null;
}

/* Formation du club (TeamRosters.php). Rend la ligne du rapport. */
async function actualiserFormationClub(forcer){
  const {texte, essais, duCache, t} = await chercherSource('roster', validerPageEquipe, forcer);
  const joueurs = parseRoster(texte);
  if (joueurs.length < 10) return 'formation : table introuvable, données locales conservées';
  ETAT.rosterBrut = joueurs; rafraichirRosterClub();
  memoriserEquipe(CONFIG.equipe, joueurs);   // le club aussi : chiffres du jour conservés
  const f = extraireFiche(texte); if (f) ETAT.fiche = f;
  ETAT.source = 'ushl.ca — ' + new Date(t).toLocaleString('fr-CA');
  return 'formation ✓ ('+joueurs.length+' joueurs'
    + (duCache ? ', cache de '+ageCache(t) : '')
    + ((essais||1)>1 ? ', bonne équipe obtenue après réessai' : '') + ')';
}

/* `forcer` : clic sur le bouton (tout est relu du site). À l'ouverture, la
   cache évite de marteler les relais. */
async function actualiserTout({forcer=false}={}){
  const btn = document.getElementById('btnMaj');
  const etat = document.getElementById('etatMaj');
  btn.disabled = true;
  const rapport = [];
  // 1) Formation
  etat.textContent = 'formation…';
  try{ rapport.push(await actualiserFormationClub(forcer)); }
  catch(e){ rapport.push('formation ✗ ('+e.message+')'); }
  // 2) Pointage
  etat.textContent = 'production…';
  try{
    const {texte, essais} = await chercherSource('scoring', validerPageEquipe, forcer);
    const s = parseScoring(texte);
    if ((essais||1) > 1) rapport.push('production : bonne équipe obtenue après réessai');
    if (s.patineurs.length || s.gardiens.length){
      ETAT.scoring = s;
      rapport.push('production ✓ ('+s.patineurs.length+' patineurs)');
    } else {
      const f = extraireFiche(texte);
      if (f) ETAT.fiche = f;
      rapport.push('production : aucun match disputé pour le moment');
    }
  }catch(e){ rapport.push('production ✗ ('+e.message+')'); }
  // 3) XtraStats
  etat.textContent = 'XtraStats…';
  try{
    const {texte} = await chercherSource('xtra', null, forcer);
    const x = parseXtra(texte, CONFIG.equipe);
    ETAT.xtraLigue = parseXtraLigue(texte);
    if (x.length >= 5){
      ETAT.xtra = x;
      const mDate = texte.match(/As of\s+([0-9\/]+)/i);
      ETAT.xtraDate = mDate ? mDate[1] : null;
      ETAT.xtraEstY21 = xtraEstArchive(x, matchsEquipe());
      if (!ETAT.xtraEstY21 && !ETAT.scoring.patineurs.length){
        rapport.push('XtraStats ✓ ('+x.length+' patineurs — sert de production, TeamScoring indisponible)');
      } else {
        rapport.push('XtraStats ✓ ('+x.length+' patineurs'+(ETAT.xtraEstY21?', archive Y21':'')+')');
      }
    } else rapport.push('XtraStats : rien trouvé pour '+CONFIG.equipe);
  }catch(e){ rapport.push('XtraStats ✗ ('+e.message+')'); }
  // 4) Limites d'utilisation des gardiens (GitHub Pages : requête directe permise)
  etat.textContent = 'limites gardiens…';
  try{
    const n = await chargerLimites(true);
    rapport.push(n>0 ? 'limites gardiens ✓ ('+n+')' : 'limites gardiens : fichier vide');
  }catch(e){ rapport.push('limites gardiens ✗ ('+e.message+')'); }

  etat.textContent = rapport.join(' · ');
  btn.disabled = false;
  toutRendre();
}

/* =====================================================================
   FUSION DES DONNÉES PAR JOUEUR
   ===================================================================== */
function indexParNom(liste){
  const m = new Map();
  for (const x of liste) m.set(normaliserNom(x.nom), x);
  return m;
}
/* production consolidée d'un joueur : scoring courant + xtra (MEÉ, MIN) */
function productionDe(j){
  const cle = normaliserNom(j.nom);
  if (ETAT.modeY21){
    // Mode vérification : totaux complets de la Y21, aucune projection.
    // Source : données intégrées, sinon l'archive XtraStats téléchargée à l'actualisation.
    const sourceY21 = SECOURS_Y21.length ? SECOURS_Y21 : (ETAT.xtraEstY21 ? ETAT.xtra : []);
    const y = indexParNom(sourceY21).get(cle) || null;
    if (!y) return null;
    const out = {
      gp: y.gp ?? null, goals: y.goals ?? null, assists: y.assists ?? null, pts: y.pts ?? null,
      shots: y.shots ?? null, pim: y.pim ?? null, mp: y.mp ?? null, hits: y.hits ?? null,
      plusminus: null, ppg: null, gwg: null, w: null, avg: null, svpct: null, qs: null, hs: null,
      _reference: false, _xtraSource: false, _modeY21: true
    };
    out.shotpct = (out.goals!==null && out.shots) ? (out.goals/out.shots*100) : null;
    return out;
  }
  const sc = indexParNom(j.po==='G' ? ETAT.scoring.gardiens : ETAT.scoring.patineurs).get(cle) || null;
  const xt = indexParNom(ETAT.xtra).get(cle) || null;
  const saisonCourante = !!sc;
  const base = sc || (ETAT.xtraEstY21 ? null : xt);
  const ref = (!saisonCourante && ETAT.xtraEstY21) ? xt : null; // Y21 comme référence
  const src = base || ref;
  if (!src) return null;
  const xtraCommeSource = !sc && base === xt;
  const out = {
    gp: src.gp ?? null,
    goals: src.goals ?? null, assists: src.assists ?? null, pts: src.pts ?? null,
    plusminus: (sc && sc.plusminus!==undefined) ? sc.plusminus : null,
    ppg: sc?.ppg ?? null, gwg: sc?.gwg ?? null,
    shots: src.shots ?? null, pim: src.pim ?? null,
    mp: (sc?.mp ?? xt?.mp) ?? null,
    hits: (xt?.hits ?? sc?.hits) ?? null,
    w: sc?.w ?? null, avg: sc?.avg ?? null, svpct: sc?.svpct ?? null, qs: sc?.qs ?? null,
    hs: sc?.hs ?? sc?.so ?? null,
    _reference: !saisonCourante && !!ref,
    _xtraSource: xtraCommeSource
  };
  if (out.svpct!==null && out.svpct!==undefined && out.svpct>1) out.svpct = out.svpct/100; // «90.5» → 0.905
  out.shotpct = (out.goals!==null && out.shots) ? (out.goals/out.shots*100) : null;
  return out;
}
