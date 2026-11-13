/* =====================================================================
   COUCHE RÉSEAU
   ---------------------------------------------------------------------
   1) L'API de ushl.ca, jointe directement : toute la ligue (alignements,
      statistiques des patineurs et des gardiens) en trois requêtes
      simultanées. C'est la voie principale — rapide, sans intermédiaire.
   2) Les pages sans API (classement officiel, XtraStats, fiche d'un joueur,
      matrices) n'autorisent pas les requêtes directes d'un navigateur : elles
      passent par des relais publics, tous sollicités en course — le premier
      qui répond gagne. Leur absence ne bloque jamais l'affichage : le relevé
      intégré fournit déjà ces données.
   Ce qui est lu est conservé sous forme compacte (quelques dizaines de ko),
   jamais en pages HTML brutes.
   ===================================================================== */
function litCache(){ try{ return JSON.parse(localStorage.getItem(CLES_LS.cache)) || {}; }catch(e){ return {}; } }
function ecritCache(c){ try{ localStorage.setItem(CLES_LS.cache, JSON.stringify(c)); }catch(e){ /* quota */ } }
function majCache(cle, valeur){ const c = litCache(); c[cle] = valeur; ecritCache(c); }

/* ---------- API de ushl.ca (requête directe) ---------- */
async function lireApi(url){
  const ctl = new AbortController();
  const echeance = setTimeout(() => ctl.abort(), CONFIG.delai.api);
  try {
    const rep = await fetch(url, {signal: ctl.signal, cache: 'no-store'});
    if (!rep.ok) throw new Error('HTTP ' + rep.status);
    const corps = await rep.json();
    if (!Array.isArray(corps?.data)) throw new Error('réponse inattendue');
    return corps.data;
  } catch (e){
    throw new Error(e.name === 'AbortError' ? 'délai dépassé' : e.message);
  } finally { clearTimeout(echeance); }
}

/* ---------- Relais (pages sans API) ----------
   Le relais qui a répondu la dernière fois part seul, avec quelques secondes
   d'avance ; s'il échoue ou tarde, les autres partent tous ensemble. La
   première réponse valide l'emporte et les requêtes restantes sont annulées. */
async function lireViaRelais(url, {valider} = {}){
  let prefere = NaN;
  try { prefere = Number(localStorage.getItem(CLES_LS.relais) ?? NaN); } catch (e){ /* stockage refusé */ }
  const ordre = [...CONFIG.relais.keys()].sort((a, b) => (b === prefere) - (a === prefere));
  const ctl = new AbortController();
  let lancerLesAutres;
  const depart = new Promise(r => { lancerLesAutres = r; });
  const avance = setTimeout(lancerLesAutres, ordre[0] === prefere ? CONFIG.delai.avanceRelaisPrefere : 0);
  const echeance = setTimeout(() => ctl.abort(), CONFIG.delai.relais);
  const tenter = async (i, rang) => {
    if (rang > 0) await depart;
    if (ctl.signal.aborted) throw new Error('inutile');   // un autre relais a déjà répondu
    try {
      const rep = await fetch(CONFIG.relais[i](url), {signal: ctl.signal});
      if (!rep.ok) throw new Error('HTTP ' + rep.status);
      const texte = await rep.text();
      if (valider ? !valider(texte) : texte.length < 500) throw new Error('réponse inattendue');
      return {i, texte};
    } catch (e){
      if (rang === 0) lancerLesAutres();
      throw e;
    }
  };
  try {
    const {i, texte} = await Promise.any(ordre.map(tenter));
    try { localStorage.setItem(CLES_LS.relais, String(i)); } catch (e){ /* stockage refusé */ }
    return texte;
  } catch (e){
    throw new Error('aucun relais ne répond');
  } finally {
    clearTimeout(avance); clearTimeout(echeance);
    lancerLesAutres(); ctl.abort();
  }
}

/* ---------- Limites d'utilisation des gardiens ----------
   JSON public du projet gestiongardiens (GitHub Pages : requête directe). */
async function chargerLimites(forcer){
  const c = litCache().limites;
  if (!forcer && c && (Date.now() - c.t) < CONFIG.ttl.limites){
    ETAT.limites = new Map(c.v.map(x=>[normaliserNom(x.nom), x.limite]));
    return ETAT.limites.size;
  }
  const rep = await fetch(CONFIG.urlLimites, {cache:'no-store'});
  if (!rep.ok) throw new Error('HTTP '+rep.status);
  const data = await rep.json();
  const liste = Array.isArray(data?.limites) ? data.limites : [];
  ETAT.limites = new Map(liste.map(x=>[normaliserNom(x.nom), x.limite]));
  majCache('limites', {t:Date.now(), v:liste});
  return ETAT.limites.size;
}

/* ---------- Fiche d'un joueur (historique des attributs) ----------
   Page CareerStatsPlayer.php, via les relais. Seul l'historique lu est
   conservé (12 h), pas la page. */
async function chargerFiche(nom, forcer){
  const cle = normaliserNom(nom);
  if (!forcer && ETAT.fiches.has(cle)) return ETAT.fiches.get(cle);
  const fiches = litCache().fiches || {};
  let saisons = (!forcer && fiches[cle] && (Date.now() - fiches[cle].t) < CONFIG.ttl.fiche) ? fiches[cle].saisons : null;
  if (!saisons || !saisons.length){
    const texte = await lireViaRelais(URLS_USHL.fiche(nom), {valider: t => parseFicheAttributs(t).length > 0})
      .catch(() => { throw new Error('historique des attributs introuvable pour ' + nom); });
    saisons = parseFicheAttributs(texte);
    const c = litCache();
    (c.fiches ||= {})[cle] = {t: Date.now(), saisons};
    ecritCache(c);
  }
  ETAT.fiches.set(cle, saisons);
  return saisons;
}
/* Lance `tache` sur chaque élément, `max` à la fois. */
async function enParallele(elements, max, tache){
  const file = [...elements];
  await Promise.all(Array.from({length: Math.min(max, file.length)}, async () => {
    while (file.length) await tache(file.shift());
  }));
}

/* ---------- Actualisation ----------
   Rend le rapport {principal, secondaires} de ce qui a été lu. */
const pagesValides = {
  classement: t => parseClassement(t).length >= 30,
  xtra: t => /XtraStats/i.test(t) && parseXtraLigue(t).length >= 100
};
/* La ligue et ses statistiques : trois requêtes directes, simultanées. */
async function actualiserLigue(){
  const [joueurs, statsP, statsG] = await Promise.all([
    lireApi(REQUETES_API.joueurs), lireApi(REQUETES_API.patineurs), lireApi(REQUETES_API.gardiens)]);
  const equipes = equipesDepuisApi(joueurs);
  const codes = Object.keys(equipes);
  if (codes.length < 30 || codes.some(c => equipes[c].length < 10)) throw new Error('réponse incomplète de ushl.ca');
  const date = new Date().toISOString();
  const patineurs = patineursDepuisApi(statsP), gardiens = gardiensDepuisApi(statsG);
  poserLigue(equipes, {date, origine: 'direct'});
  poserStats(patineurs, gardiens, {date});
  memoriserLigue(equipes, date);
  majCache('stats', {date,
    patineurs: patineurs.map(p => compacter(CLES_PATINEUR, p)),
    gardiens: gardiens.map(g => compacter(CLES_GARDIEN, g))});
  return {joueurs: codes.reduce((n, c) => n + equipes[c].length, 0), equipes: codes.length};
}
async function actualiserClassement(){
  const fiches = parseClassement(await lireViaRelais(URLS_USHL.classement, {valider: pagesValides.classement}));
  const date = new Date().toISOString();
  poserClassement(fiches, {date});
  majCache('classement', {date, fiches: fiches.map(f => compacter(CLES_FICHE, f))});
}
async function actualiserXtra(){
  const texte = await lireViaRelais(URLS_USHL.xtra, {valider: pagesValides.xtra});
  poserXtra(parseXtraLigue(texte), dateXtra(texte));
  if (!ETAT.reference) majCache('minutes', {date: new Date().toISOString(), dateXtra: ETAT.minutes.date, parCle: ETAT.minutes.parCle});
}

let actualisationEnCours = null;
/* `forcer` : clic sur le bouton — tout est relu. À l'ouverture, ce qui vient
   d'être lu (5 min pour l'API, 3 h pour les pages relayées) n'est pas redemandé. */
function actualiserTout({forcer = false} = {}){
  if (!actualisationEnCours){
    actualisationEnCours = executerActualisation(forcer).finally(() => { actualisationEnCours = null; });
  }
  return actualisationEnCours;
}
async function executerActualisation(forcer){
  const cache = litCache();
  const frais = (iso, ttl) => !forcer && iso && (Date.now() - Date.parse(iso)) < ttl;
  const rapport = {principal: null, erreur: null, secondaires: []};
  afficherEtatMaj('lecture', 'Lecture de ushl.ca…');

  // Les pages relayées partent tout de suite, sans retenir l'affichage.
  const secondaires = [];
  const suivre = (nom, promesse) => secondaires.push(promesse.then(
    () => rapport.secondaires.push({nom, ok: true}),
    e => rapport.secondaires.push({nom, ok: false, raison: e.message})));
  if (!frais(cache.classement?.date, CONFIG.ttl.pages)) suivre('classement officiel', actualiserClassement());
  if (!frais(cache.minutes?.date, CONFIG.ttl.pages)) suivre('minutes jouées', actualiserXtra());
  suivre('limites des gardiens', chargerLimites(forcer));

  if (frais(cache.stats?.date, CONFIG.ttl.api) && ETAT.ligue.origine !== 'releve'){
    rapport.principal = 'récent';
  } else {
    try { rapport.principal = await actualiserLigue(); }
    catch (e){ rapport.erreur = e.message; }
  }
  toutRendre();
  afficherRapport(rapport, true);

  await Promise.all(secondaires);
  toutRendre();
  afficherRapport(rapport, false);
  return rapport;
}
