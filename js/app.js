/* =====================================================================
   DÉMARRAGE : rendu d'ensemble, branchements, ouverture
   (chargé en dernier : tout ce qu'il appelle est déjà défini)
   ===================================================================== */

/* Ce qui se rend à l'ouverture de chaque section ou sous-vue. */
Object.assign(RENDUS, {
  alignement: rendreAlignement,
  production: rendreProduction,
  plafond: rendrePlafond,
  progression: rendreProgression,
  trios: rendreTrios,
  classement: rendreClassement,
  joueurs: rendreLigue,
  recotes: () => { rendreRecotes(); rendreClassementRecotes(); },
  echange: rendreEchange,
  comparateur: () => { peuplerComparateur(); rendreComparateur(); },
  ovdetail: peuplerJoueursOvd,
  reglages: () => { rendreMatrice(); rendreEtatDonnees(); }
});
/* Après un changement de données : l'en-tête, le club (visible ou non — les
   alertes et le sommaire en dépendent) et la vue affichée. */
function toutRendre(){
  rendreEntete();
  rendreAlignement();
  rendreProduction();
  rendrePlafond();
  rendreProgression();
  rendreTrios();
  const {vue, sous} = vueCourante();
  for (const nom of [vue, sous]){
    if (nom && RENDUS[nom] && !['alignement','production','plafond','progression','trios'].includes(nom)) RENDUS[nom]();
  }
}

/* ---------- Club du DG : habillage et sélecteur ---------- */
function habillerClub(){
  const c = CONFIG.club;
  document.title = c.nom + ' — Poste du DG';
  $('#titreClub').textContent = c.nom.toUpperCase();
  $('#ecussonClub').textContent = c.emoji;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = c.couleur;
  const icone = document.querySelector('link[rel="icon"]');
  if (icone) icone.href = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    '<rect width="100" height="100" rx="18" fill="' + c.couleur + '"/>' +
    '<text x="50" y="68" font-size="56" text-anchor="middle">' + c.emoji + '</text></svg>');
  document.documentElement.style.setProperty('--club', c.couleur);
}
function rendreChoixClub(){
  $('#clubDG').innerHTML = Object.keys(CLUBS)
    .map(code=>`<option value="${code}"${code===CONFIG.equipe?' selected':''}>${echap(CLUBS[code].nom)} (${code})</option>`)
    .join('');
  $('#clubEtat').textContent = `Club actif : ${CONFIG.club.nom} — ${CONFIG.equipe}.`;
}
function changerDeClub(e){
  const code = e.target.value;
  if (!CLUBS[code] || code === CONFIG.equipe) return;
  if (!confirm(`Passer au poste de DG des ${CLUBS[code].nom} ? La page se recharge à ses couleurs.`)){
    e.target.value = CONFIG.equipe;
    return;
  }
  try { localStorage.setItem(CLE_CLUB, code); }
  catch (err){ alert("Ce navigateur refuse d'enregistrer le choix du club."); return; }
  location.reload();
}

/* ---------- Réglages : état et provenance des données ---------- */
function rendreEtatDonnees(){
  const {date, origine} = ETAT.ligue;
  const nb = joueursLigue().length;
  const quand = [dateLisible(date), heureLisible(date)].filter(Boolean).join(', ');
  const origines = {
    direct: `Ligue lue sur ushl.ca le <b>${quand}</b>`,
    conserve: `Dernière lecture de ushl.ca conservée dans ce navigateur : <b>${quand}</b>`,
    releve: `Relevé intégré à la page : <b>${quand}</b>`
  };
  const minutes = Object.keys(ETAT.minutes.parCle).length;
  $('#donneesEtat').innerHTML = `${origines[origine] || origines.releve} — ${LIGUE_EQUIPES.length} équipes, ${nb} joueurs.
    Classement ${ETAT.classement.officiel ? 'officiel' : 'calculé des décisions des gardiens'} ·
    minutes jouées de ${minutes} patineurs${ETAT.minutes.date ? ` (XtraStats du ${ETAT.minutes.date})` : ''} ·
    limites de ${ETAT.limites.size} gardiens.`;
}
function rendreSources(){
  const lien = (url, texte) => `<a href="${url}" target="_blank" rel="noopener">${texte}</a>`;
  $('#sourcesTexte').innerHTML =
    `À chaque ouverture, la page interroge directement l'${lien(URLS_USHL.api + '?api=search&action=find&length=5', 'API de ushl.ca')} :
     alignements, contrats et statistiques des 32 équipes en trois requêtes. Deux pages sans API passent par des relais publics —
     le ${lien(URLS_USHL.classement, 'classement officiel')} et ${lien(URLS_USHL.xtra, 'XtraStats')} (minutes jouées) ; si aucun relais ne répond,
     le relevé intégré du ${dateLisible(USHL_RELEVE.date)} les fournit. Limites des gardiens : ${lien(CONFIG.urlLimites, 'gestiongardiens')}.
     Profils : règlements USHL, tableaux 10-11-12 · Matrices : ${lien(URLS_USHL.matrices, 'MATRICES DES PROFILS')} (valeurs Y17 par défaut).`;
}

/* ---------- Branchements ---------- */
function brancherClub(){
  $('#btnExportCSV').addEventListener('click', telechargerCSV);
  $('#rechercheAlign').addEventListener('input', e=>{
    ETAT.rechercheAlign = e.target.value;
    rendreAlignement();
  });
  $('#transfDe').addEventListener('change', rendreTransferts);
  $('#btnTransferer').addEventListener('click', ()=>{
    const de = $('#transfDe').value, vers = $('#transfVers').value, nom = $('#transfJoueur').value;
    if (!nom){ flash('Choisis un joueur'); return; }
    if (de === vers){ flash('Choisis deux équipes différentes'); return; }
    const ts = litTransferts().filter(t=>t.nom!==nom); // un seul transfert actif par joueur
    ts.push({nom, de, vers, date: new Date().toISOString().slice(0,10)});
    ecritTransferts(ts);
    rafraichirRosterClub();
    toutRendre();
    flash(nom + ' transféré localement : ' + de + ' → ' + vers);
  });
  $('#progFiltres').addEventListener('click', e=>{
    const b = e.target.closest('button'); if (!b) return;
    document.querySelectorAll('#progFiltres button').forEach(x=>x.classList.remove('actif'));
    b.classList.add('actif');
    ETAT.filtreProg = b.dataset.f;
    rendreProgression();
  });
}
function brancherTrios(){
  $('#btnTriosAuto').addEventListener('click', ()=>{ autoTrios(); flash('Trios remplis par OV'); });
  $('#btnTriosVider').addEventListener('click', ()=>{
    if (confirm('Vider tous les trios ?')){ ecritTrios({}); rendreTrios(); flash('Trios vidés'); }
  });
  $('#btnTriosCopier').addEventListener('click', async ()=>{
    const txt = texteTrios();
    try { await navigator.clipboard.writeText(txt); flash('Trios copiés dans le presse-papiers'); }
    catch { window.prompt('Copie manuelle :', txt); }
  });
}
function brancherLigue(){
  brancherSegments($('#classGroupes'), 'groupe', g => { groupeClassement = g; rendreClassement(); });
  brancherSegments($('#ligueMode'), 'mode', m => { ETAT_LIGUE.mode = m; rendreLigue(); });
  ['ligueTexte','ligueOvMin','ligueAgeMax'].forEach(id => document.getElementById(id).addEventListener('input', rendreLigue));
  ['ligueEquipe','liguePo','ligueProfil','ligueExpirants'].forEach(id => document.getElementById(id).addEventListener('change', rendreLigue));
  $('#ligueTout').addEventListener('click', ()=>{ ETAT_LIGUE.tout = !ETAT_LIGUE.tout; rendreLigue(); });
  $('#recEquipe').addEventListener('change', rendreRecotes);
  $('#btnRecFiches').addEventListener('click', telechargerFichesEquipe);
  $('#btnRecClassementTxt').addEventListener('click', ()=>{
    const blob = new Blob([texteClassementRecotes() + '\n'], {type:'text/plain;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'classement-recotes.txt';
    a.click();
    URL.revokeObjectURL(a.href);
    flash('Classement des recotes téléchargé');
  });
}
function brancherEchange(){
  $('#echAjSortant').addEventListener('click', ()=>{
    const j = joueursEquipe(CONFIG.equipe).find(x=>x.nom===$('#echSortant').value);
    if (j){ ECHANGE.sortants.push(j); rendreEchange(); }
  });
  $('#echAjEntrant').addEventListener('click', ()=>{
    const eq = $('#echEquipe').value;
    const j = joueursEquipe(eq).find(x=>x.nom===$('#echEntrant').value);
    if (j){ ECHANGE.entrants.push(Object.assign({_equipe: eq}, j)); rendreEchange(); }
  });
  $('#echEquipe').addEventListener('change', rendreEchange);
  $('#echVider').addEventListener('click', ()=>{
    for (const j of ECHANGE.sortants.concat(ECHANGE.entrants)) j._resigner = false;
    ECHANGE.sortants.length = 0; ECHANGE.entrants.length = 0; rendreEchange();
  });
}
function brancherComparateur(){
  $('#compA').addEventListener('change', rendreComparateur);
  $('#compB').addEventListener('change', rendreComparateur);
  for (const [eq, joueur] of [['compEqA','compA'], ['compEqB','compB']]){
    document.getElementById(eq).addEventListener('change', ()=>{
      remplirJoueursComp(document.getElementById(eq).value, document.getElementById(joueur), 0);
      rendreComparateur();
    });
  }
}
function brancherReglages(){
  $('#clubDG').addEventListener('change', changerDeClub);
  $('#btnMajReglages').addEventListener('click', ()=>actualiserTout({forcer:true}).then(rendreEtatDonnees));
  $('#btnViderCache').addEventListener('click', ()=>{
    if (!confirm('Effacer les données de ushl.ca conservées dans ce navigateur ? Les réglages, prolongations et trios ne sont pas touchés.')) return;
    localStorage.removeItem(CLES_LS.cache);
    localStorage.removeItem(CLES_LS.instantane);
    localStorage.removeItem(CLES_LS.relais);
    ETAT.fiches.clear();
    ETAT.classementOfficiel = null;
    restaurerDonnees();
    toutRendre();
    flash('Données conservées effacées — retour au relevé intégré');
  });
  $('#selMatrice').addEventListener('change', ()=>{ rendreSelectStat(); rendreMatrice(); });
  $('#selStat').addEventListener('change', rendreMatrice);
  $('#btnExportMat').addEventListener('click', ()=>{
    $('#zoneJson').value = JSON.stringify(chargerMatrices(), null, 2);
    flash('Matrices exportées dans la zone de texte');
  });
  /* Import : JSON de matrices, ou contenu de la page officielle collé
     (HTML ou tableau copié) — on essaie le JSON, puis le parseur de la ligue. */
  $('#btnImportMat').addEventListener('click', ()=>{
    const brut = $('#zoneJson').value.trim();
    if (!brut){ flash('Colle un JSON ou le contenu de la page des matrices'); return; }
    try{
      const m = JSON.parse(brut);
      if (typeof m !== 'object' || m===null) throw new Error('format inattendu');
      sauverMatrices(m); rendreMatrice(); rendreProgression();
      $('#etatMatrices').textContent = 'JSON importé';
      flash('Matrices importées');
      return;
    }catch(e){ /* pas du JSON : on tente la page de la ligue */ }
    try{
      const r = importerMatricesUshl(brut);
      rendreMatrice(); rendreProgression();
      $('#etatMatrices').textContent = `${r.profils} profils · ${r.stats} statistiques · ${r.rangees} rangées`;
      flash('Matrices de la ligue importées');
    }catch(e){ flash('Import impossible : '+e.message); }
  });
  /* Lecture de la page officielle des matrices (via les relais). */
  $('#btnMajMatrices').addEventListener('click', async ()=>{
    const btn = $('#btnMajMatrices'), etat = $('#etatMatrices');
    btn.disabled = true; etat.textContent = 'lecture de la page des matrices…';
    try{
      const texte = await lireViaRelais(URLS_USHL.matrices);
      const r = importerMatricesUshl(texte);
      rendreMatrice(); rendreProgression(); rendreAlertes();
      etat.textContent = `à jour : ${r.profils} profils · ${r.stats} statistiques · ${r.rangees} rangées`;
      flash('Matrices mises à jour depuis ushl.ca');
    }catch(e){
      etat.textContent = 'échec : ' + e.message + ' — copie la page dans la zone ci-dessous et clique «Importer»';
      flash('Mise à jour impossible : ' + e.message);
    }
    btn.disabled = false;
  });
  $('#btnViderMat').addEventListener('click', ()=>{
    if (confirm('Effacer toutes les rangées personnalisées et revenir aux matrices Y17 ?')){
      sauverMatrices({}); rendreMatrice(); rendreProgression(); flash('Retour aux matrices Y17');
    }
  });
  $('#btnViderOverrides').addEventListener('click', ()=>{
    if (confirm('Effacer toutes les cibles individuelles ?')){
      sauverOverrides({}); rendreProgression(); flash('Cibles individuelles effacées');
    }
  });
}

/* ---------- Ouverture ----------
   Le relevé intégré (ou la dernière lecture conservée, si elle est plus
   récente) s'affiche tout de suite ; ushl.ca le remplace dès qu'il répond. */
restaurerDonnees();
habillerClub();
brancherNavigation();
brancherClub();
brancherTrios();
brancherLigue();
brancherEchange();
brancherComparateur();
brancherReglages();
$('#btnMaj').addEventListener('click', ()=>actualiserTout({forcer:true}));
rendreChoixClub();
rendreSources();
rendreSelectMatrice();
rendreMatrice();
construireOvd();
toutRendre();
ouvrirDepuisAdresse();

/* exposition pour le harnais de tests (jsdom) */
window.__TML__ = {
  // configuration et règlements
  CONFIG, CLUBS, CLES_LS, MATRICES, STATS_PAR_MATRICE, NIVEAUX, PROFILS, STATS_DEF,
  // lecture de ushl.ca
  URLS_USHL, REQUETES_API, CLES_JOUEUR, CLES_PATINEUR, CLES_GARDIEN, CLES_FICHE, compacter, decompacter,
  normaliserNom, nombre, estFictif, equipesDepuisApi, patineursDepuisApi, gardiensDepuisApi,
  parseClassement, classementDepuisStats, parseXtra, parseXtraLigue, nettoyerLigneXtra, minutesDepuisXtra, cleJoueur,
  lireApi, lireViaRelais, actualiserTout, actualiserLigue, chargerFiche, chargerLimites, litCache, ecritCache,
  // état et modèle de la ligue
  ETAT, USHL_RELEVE, LIGUE_S21, DATE_S21, LIGUE_EQUIPES, COTES_Y21,
  restaurerDonnees, poserLigue, poserStats, poserXtra, poserMinutes, poserClassement, ficheEquipe, matchsEquipe,
  litInstantane, ecritInstantane, memoriserLigue, dateInstantane, equipesInstantane, decoderTableau, decoderEquipe,
  joueursEquipe, joueursEquipeBrut, joueursLigue, cotesDuSite, provenanceDe, sourceLisible, productionDe,
  litTransferts, ecritTransferts, appliquerTransferts, rafraichirRosterClub,
  // moteur
  echap, fmtArgentCourt, parseArgent, determinerProfil, evaluerStat, seuilsPour, seuilsMatrice, statutSelonSeuils,
  valeurStat, calculerPmRangs, modA, convertirJet, fourchetteRecote, modsEstime,
  parseFicheAttributs, parseMatricesUshl, importerMatricesUshl, normTxt, reconnaitre, nombreCellule,
  ALIAS_MATRICES, ALIAS_STATS, chargerMatrices, sauverMatrices,
  // contrats
  CHARTE_SALAIRE, SURCHARGE_OV87, PLAFOND, salaireMinimum, statutResignature, cleCharte, dureeMaxCharte,
  echelonEffectif, peutProlonger, litResignatures, ecritResignatures, calculerMasse,
  // vues
  ouvrirVue, vueCourante, toutRendre, rendreEntete, habillerClub, rendreChoixClub,
  alertesDG, rendreAlertes, rendreAlignement, rendreTransferts, exporterCSV, ouvrirProlongation, fermerProlongation,
  rendreProduction, projectionPlafond, rendrePlafond, rendreProgression,
  litTrios, ecritTrios, autoTrios, rendreTrios, texteTrios,
  classementTrie, rendreClassement, ETAT_LIGUE, joueursLigueFiltres, rendreLigue,
  cotesY21De, baseS21, recotesEquipe, rendreRecotes, classementRecotes, texteClassementRecotes, rendreClassementRecotes,
  telechargerFichesEquipe,
  ECHANGE, projectionEchange, bilanClub, rendreEchange, resignatureStandard, salaireSaisonEchange, ovExact,
  peuplerComparateur, rendreComparateur, percentileLigue, distributionsLigue,
  ovDetaille, OV_POIDS, OV_ORDRE, peuplerJoueursOvd, calculerOvd,
  CATEGORIES_COTES, profilDeCotes, permutationsProfil, transfertsCategorie
};

/* Actualisation automatique à l'ouverture (le harnais de tests la désactive :
   aucun réseau en test). */
if (!window.__TML_SANS_AUTO__){
  actualiserTout();
  /* PWA : la page s'installe et s'ouvre hors ligne. Uniquement en HTTPS. */
  if ('serviceWorker' in navigator && location.protocol === 'https:'){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
}
