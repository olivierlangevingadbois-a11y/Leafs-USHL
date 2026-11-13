/* ---------- Navigation et initialisation ---------- */
function toutRendre(){
  rendreAlignement();
  rendreProduction();
  rendreProgression();
  peuplerComparateur();
  rendreComparateur();
  rendrePlafond();
  rendreTrios();
  rendreRecotes(); // les recotes du club se remplissent dès que le direct arrive
}
document.querySelectorAll('nav button[data-vue]').forEach(b=>{
  b.addEventListener('click', ()=>{
    document.querySelectorAll('nav button[data-vue]').forEach(x=>x.classList.remove('actif'));
    document.querySelectorAll('section.vue').forEach(x=>x.classList.remove('actif'));
    b.classList.add('actif');
    document.getElementById('vue-'+b.dataset.vue).classList.add('actif');
    if (b.dataset.vue==='progression') rendreProgression();
    if (b.dataset.vue==='trios') rendreTrios();
    if (b.dataset.vue==='comparateur'){ peuplerComparateur(); rendreComparateur(); }
    if (b.dataset.vue==='ligue') rendreLigue();
    if (b.dataset.vue==='meneurs') rendreMeneurs();
    if (b.dataset.vue==='classement') rendreClassement();
    if (b.dataset.vue==='echange') rendreEchange();
    if (b.dataset.vue==='recotes'){ rendreRecotes(); rendreClassementRecotes(); }
    if (b.dataset.vue==='plafond') rendrePlafond();
    if (b.dataset.vue==='ovdetail') peuplerJoueursOvd();
    if (b.dataset.vue==='reglages'){ rendreMatrice(); rendreEtatInstantane(); }
  });
});
document.getElementById('compA').addEventListener('change', rendreComparateur);
document.getElementById('compB').addEventListener('change', rendreComparateur);
document.getElementById('compEqA').addEventListener('change', ()=>{
  remplirJoueursComp(document.getElementById('compEqA').value, document.getElementById('compA'), 0);
  rendreComparateur();
  actualiserEquipe(document.getElementById('compEqA').value, ()=>{ peuplerComparateur(); rendreComparateur(); });
});
document.getElementById('compEqB').addEventListener('change', ()=>{
  remplirJoueursComp(document.getElementById('compEqB').value, document.getElementById('compB'), 0);
  rendreComparateur();
  actualiserEquipe(document.getElementById('compEqB').value, ()=>{ peuplerComparateur(); rendreComparateur(); });
});
document.getElementById('btnExportCSV').addEventListener('click', telechargerCSV);
document.getElementById('transfDe').addEventListener('change', ()=>{
  rendreTransferts();
  actualiserEquipe(document.getElementById('transfDe').value, rendreTransferts);
});
document.getElementById('btnTransferer').addEventListener('click', ()=>{
  const de = document.getElementById('transfDe').value;
  const vers = document.getElementById('transfVers').value;
  const nom = document.getElementById('transfJoueur').value;
  if (!nom){ flash('Choisis un joueur'); return; }
  if (de === vers){ flash('Choisis deux équipes différentes'); return; }
  const ts = litTransferts().filter(t=>t.nom!==nom); // un seul transfert actif par joueur
  ts.push({nom, de, vers, date: new Date().toISOString().slice(0,10)});
  ecritTransferts(ts);
  rafraichirRosterClub();
  toutRendre();
  rendreTransferts();
  flash(nom + ' transféré localement : ' + de + ' → ' + vers);
});
document.getElementById('btnTriosAuto').addEventListener('click', ()=>{ autoTrios(); flash('Trios remplis par OV'); });
document.getElementById('btnTriosVider').addEventListener('click', ()=>{
  if (confirm('Vider tous les trios ?')){ ecritTrios({}); rendreTrios(); flash('Trios vidés'); }
});
document.getElementById('btnTriosCopier').addEventListener('click', async ()=>{
  const txt = texteTrios();
  try { await navigator.clipboard.writeText(txt); flash('Trios copiés dans le presse-papiers'); }
  catch { window.prompt('Copie manuelle :', txt); }
});
document.getElementById('rechercheAlign').addEventListener('input', e=>{
  ETAT.rechercheAlign = e.target.value;
  rendreAlignement();
});
['ligueTexte','ligueOvMin','ligueAgeMax'].forEach(id=>
  document.getElementById(id).addEventListener('input', rendreLigue));
['ligueEquipe','liguePo','ligueProfil','ligueExpirants'].forEach(id=>
  document.getElementById(id).addEventListener('change', rendreLigue));
document.getElementById('echAjSortant').addEventListener('click', ()=>{
  const j = joueursEquipe(CONFIG.equipe).find(x=>x.nom===document.getElementById('echSortant').value);
  if (j){ ECHANGE.sortants.push(j); rendreEchange(); }
});
document.getElementById('echAjEntrant').addEventListener('click', ()=>{
  const eq = document.getElementById('echEquipe').value;
  const j = joueursEquipe(eq).find(x=>x.nom===document.getElementById('echEntrant').value);
  if (j){ ECHANGE.entrants.push(Object.assign({_equipe: eq}, j)); rendreEchange(); }
});
document.getElementById('echEquipe').addEventListener('change', ()=>{
  rendreEchange();
  actualiserEquipe(document.getElementById('echEquipe').value, rendreEchange);
});
document.getElementById('echVider').addEventListener('click', ()=>{
  for (const j of ECHANGE.sortants.concat(ECHANGE.entrants)) j._resigner = false;
  ECHANGE.sortants.length = 0; ECHANGE.entrants.length = 0; rendreEchange();
});
document.getElementById('recEquipe').addEventListener('change', ()=>{
  rendreRecotes();
  actualiserEquipe(document.getElementById('recEquipe').value, rendreRecotes);
});
document.getElementById('btnRecFiches').addEventListener('click', telechargerFichesEquipe);
document.getElementById('btnRecClassement').addEventListener('click', ()=>
  telechargerLigue('recNote', ()=>{ rendreRecotes(); rendreClassementRecotes(); }));
document.getElementById('btnRecClassementTxt').addEventListener('click', ()=>{
  const blob = new Blob([texteClassementRecotes() + '\n'], {type:'text/plain;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'classement-recotes.txt';
  a.click();
  URL.revokeObjectURL(a.href);
  flash('Classement des recotes téléchargé');
});
['menCategorie','menPo','menLeafs'].forEach(id=>
  document.getElementById(id).addEventListener('change', rendreMeneurs));
document.getElementById('btnFiches').addEventListener('click', telechargerFiches);
document.getElementById('btnLigueMaj').addEventListener('click', ()=>telechargerLigue('ligueCompte', rendreLigue));
document.getElementById('progFiltres').addEventListener('click', e=>{
  const b = e.target.closest('button'); if (!b) return;
  document.querySelectorAll('#progFiltres button').forEach(x=>x.classList.remove('actif'));
  b.classList.add('actif');
  ETAT.filtreProg = b.dataset.f;
  rendreProgression();
});
$('#btnMaj').addEventListener('click', ()=>actualiserTout({forcer:true}));
$('#btnEffacerCache').addEventListener('click', ()=>{
  localStorage.removeItem(CLES_LS.cache);   // données mises en cache (formation, production, XtraStats, limites, équipes)
  localStorage.removeItem(CLES_LS.proxy);   // relais préféré : on repart de la chaîne complète
  ETAT.equipesLive.clear();                 // alignements des autres équipes : retour à l'instantané
  flash('Cache effacée — actualisation en direct…');
  actualiserTout();
});
$('#btnModeY21').addEventListener('click', ()=>{
  ETAT.modeY21 = !ETAT.modeY21;
  const b = $('#btnModeY21');
  b.classList.toggle('actif', ETAT.modeY21);
  b.textContent = ETAT.modeY21 ? 'Revenir à la saison en cours' : 'Vérifier avec la Y21';
  $('#bandeauY21').style.display = ETAT.modeY21 ? '' : 'none';
  toutRendre();
  flash(ETAT.modeY21 ? 'Mode vérification Y21 activé' : 'Retour à la saison en cours');
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
/* Téléchargement direct de la page officielle des matrices (via les relais). */
$('#btnMajMatrices').addEventListener('click', async ()=>{
  const btn = $('#btnMajMatrices'), etat = $('#etatMatrices');
  btn.disabled = true; etat.textContent = 'téléchargement de la page des matrices…';
  try{
    const texte = await chercherViaProxy(CONFIG.urls.matrices, {timeout:20000});
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
/* ---------- Club du DG : habillage et sélecteur ---------- */
function habillerClub(){
  const c = CONFIG.club;
  document.title = c.nom + ' — Tableau de bord du DG';
  const h1 = document.getElementById('titreClub');
  if (h1) h1.textContent = c.nom.toUpperCase();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = c.couleur;
  const icone = document.querySelector('link[rel="icon"]');
  if (icone) icone.href = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    '<rect width="100" height="100" rx="18" fill="' + c.couleur + '"/>' +
    '<text x="50" y="68" font-size="56" text-anchor="middle">' + c.emoji + '</text></svg>');
  document.documentElement.style.setProperty('--club', c.couleur);
  const sous = document.getElementById('alignSous');
  if (sous) sous.textContent = `Cotes, salaires et contrats — source : TeamRosters.php (${CONFIG.equipe})`;
}
function rendreChoixClub(){
  const sel = document.getElementById('clubDG');
  if (!sel) return;
  sel.innerHTML = Object.keys(CLUBS)
    .map(code=>`<option value="${code}"${code===CONFIG.equipe?' selected':''}>${echap(CLUBS[code].nom)} (${code})</option>`)
    .join('');
  const etat = document.getElementById('clubEtat');
  if (etat) etat.textContent = `Club actif : ${CONFIG.club.nom} — ${CONFIG.equipe}.`;
}
document.getElementById('clubDG')?.addEventListener('change', e=>{
  const code = e.target.value;
  if (!CLUBS[code] || code === CONFIG.equipe) return;
  if (!confirm(`Passer au poste de DG des ${CLUBS[code].nom} ? La page se recharge à ses couleurs.`)){
    e.target.value = CONFIG.equipe;
    return;
  }
  try { localStorage.setItem(CLE_CLUB, code); }
  catch (err){ alert("Ce navigateur refuse d'enregistrer le choix du club."); return; }
  location.reload();
});

function rendreEtatInstantane(){
  const el = document.getElementById('instantaneEtat');
  if (!el) return;
  const d = dateInstantane(), n = equipesInstantane().length;
  const nPer = EQUIPES_PERIMEES.length;
  const perimees = nPer
    ? ` ${nPer} équipe${nPer>1?'s sont restées':' est restée'} sur les fichiers de la ligue du ${DATE_S21} : ${EQUIPES_PERIMEES.join(', ')}.`
    : '';
  el.innerHTML = d
    ? `Instantané conservé du <b>${d}</b> — <b>${n}</b> équipe${n>1?'s':''} sur ${LIGUE_EQUIPES.length}. Ces chiffres servent de référence par défaut à l'ouverture, même hors ligne.`
    : `Aucun instantané conservé dans ce navigateur : l'application s'appuie sur le relevé du site du <b>${LIGUE_DATE}</b> intégré à la page (${LIGUE_EQUIPES.length - nPer} équipes).${perimees}`;
}
document.getElementById('btnMajLigueReglages').addEventListener('click', ()=>
  telechargerLigue('instantaneEtat', ()=>{ rendreEtatInstantane(); toutRendre(); }));
document.getElementById('btnExportInstantane').addEventListener('click', ()=>{
  const snap = litInstantane();
  if (!snap){ flash('Aucun instantané à exporter — actualise la ligue d\'abord'); return; }
  const lignes = Object.entries(snap.equipes).map(([code, tab]) =>
    ` '${code}': [` + tab.map(t=>'['+t.map(v=>typeof v==='string'?JSON.stringify(v):(v===null?'null':v)).join(',')+']').join(',') + ']');
  $('#zoneJson').value = `const LIGUE_DATE = '${dateInstantane()}';\nconst LIGUE = {\n` + lignes.join(',\n') + '\n};';
  flash('Instantané exporté dans la zone de texte ci-dessous');
});
document.getElementById('btnViderInstantane').addEventListener('click', ()=>{
  if (confirm('Oublier l\'instantané conservé et revenir aux fichiers intégrés ?')){
    localStorage.removeItem(CLES_LS.instantane);
    rendreEtatInstantane(); flash('Instantané oublié');
  }
});
$('#btnViderOverrides').addEventListener('click', ()=>{
  if (confirm('Effacer toutes les attentes individuelles ?')){
    sauverOverrides({}); rendreProgression(); flash('Attentes individuelles effacées');
  }
});
$('#btnViderCache').addEventListener('click', ()=>{
  localStorage.removeItem(CLES_LS.cache); flash('Cache vidé — prochaine actualisation en direct');
});
$('#sourcesTexte').innerHTML =
  `Formation : <a style="color:var(--bleu-vif)" href="${CONFIG.urls.roster}" target="_blank" rel="noopener">TeamRosters.php</a> ·
   Production : <a style="color:var(--bleu-vif)" href="${CONFIG.urls.scoring}" target="_blank" rel="noopener">TeamScoring.php</a> ·
   Minutes et mises en échec : <a style="color:var(--bleu-vif)" href="${CONFIG.urls.xtra}" target="_blank" rel="noopener">USHLxtrastats.html</a> ·
   Limites d'utilisation des gardiens : <a style="color:var(--bleu-vif)" href="${CONFIG.urlLimites}" target="_blank" rel="noopener">limites.json</a> (projet gestiongardiens) ·
   Profils : règlements USHL, tableaux 10-11-12 · Matrices : <a style="color:var(--bleu-vif)" href="${CONFIG.urls.matrices}" target="_blank" rel="noopener">MATRICES DES PROFILS</a> (page officielle, importable en un clic dans les Réglages) — valeurs Y17 d'«Attentes.docx» par défaut · Modificateurs : section 6.2.
   <br>Données de secours : alignement de ${CONFIG.equipe} relevé sur ushl.ca le ${dateFormationDeSecours()}, intégré à la page.
   L'OV des patineurs y est calculé par la formule du calculateur ; celui des gardiens vient du site (ou, à défaut,
   d'une <b>estimation</b> remplacée par la valeur réelle à la première actualisation).`;
$('#dateSecours').textContent = dateFormationDeSecours();

// Au démarrage, la formation du club repart du dernier instantané conservé
// (chiffres du jour de la dernière actualisation) plutôt que des données
// intégrées ; l'actualisation automatique la remplacera si le site répond.
{
  const snapClub = litInstantane();
  if (snapClub && snapClub.equipes[CONFIG.equipe] && snapClub.equipes[CONFIG.equipe].length >= 10){
    ETAT.rosterBrut = decoderTableau(snapClub.equipes[CONFIG.equipe]);
    ETAT.source = 'instantané conservé du ' + dateInstantane();
  }
}
habillerClub();         // titre, couleurs et icône du club choisi
rendreChoixClub();
rafraichirRosterClub(); // formation effective = instantané + transferts locaux
rendreSelectMatrice();
rendreMatrice();
toutRendre();
/* limites des gardiens : chargement silencieux au démarrage (cache 1 h) */
chargerLimites(false).then(()=>rendreProgression()).catch(()=>{});
/* Actualisation automatique à l'ouverture : les données intégrées s'affichent
   tout de suite, puis ushl.ca les remplace (le cache local — formation 12 h,
   production 30 min — évite de marteler les relais à chaque visite).
   Le harnais de tests désactive cet appel (aucun réseau en test). */
if (!window.__TML_SANS_AUTO__){
  setTimeout(actualiserTout, 50);
}
/* PWA : la page s'installe et s'ouvre hors ligne (réseau d'abord, cache en
   secours). Uniquement en HTTPS — rien à faire en local ou en test. */
if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.__TML_SANS_AUTO__){
  navigator.serviceWorker.register('sw.js').catch(()=>{});
}

construireOvd();

/* exposition pour le harnais de tests (jsdom) */
if (typeof window !== 'undefined'){
  window.__TML__ = {parseRoster, parseScoring, parseXtra, determinerProfil, evaluerStat,
    normaliserNom, seuilsPour, seuilsMatrice, statutSelonSeuils, valeurStat, calculerPmRangs,
    modA, convertirJet, fourchetteRecote, modsEstime, matchsEquipe, xtraEstArchive, productionDe, ETAT,
    extraireFiche, validerPageEquipe, CONFIG,
    CHARTE_SALAIRE, salaireMinimum, statutResignature, cleCharte, dureeMaxCharte,
    fmtArgentCourt, parseArgent, litResignatures, ecritResignatures,
    ouvrirProlongation, fermerProlongation, calculerMasse, PLAFOND, echelonEffectif, peutProlonger,
    MATRICES, STATS_PAR_MATRICE, NIVEAUX, SECOURS_ROSTER, SECOURS_Y21, PROFILS, STATS_DEF,
    ovDetaille, OV_POIDS, OV_ORDRE, peuplerJoueursOvd, calculerOvd,
    CATEGORIES_COTES, profilDeCotes, permutationsProfil, transfertsCategorie,
    echap, exporterCSV, projectionPlafond, rendreComparateur, peuplerComparateur, rendrePlafond,
    CLUBS, CLES_LS, habillerClub, rendreChoixClub, formationDeSecours, dateFormationDeSecours,
    LIGUE, LIGUE_S21, LIGUE_DATE, DATE_S21, LIGUE_EQUIPES, EQUIPES_PERIMEES, cotesDuSite, provenanceDe,
    joueursEquipe, litTrios, ecritTrios, autoTrios, rendreTrios, texteTrios, SURCHARGE_OV87,
    estFictif, chargerEquipe, actualiserEquipe, urlRosterEquipe, validerPageDe,
    chercherSource, actualiserTout, actualiserFormationClub, telechargerLigue,
    joueursLigue, joueursLigueFiltres, rendreLigue,
    ECHANGE, projectionEchange, bilanClub, rendreEchange, alertesDG, rendreAlertes,
    resignatureStandard, salaireSaisonEchange, ovExact, nettoyerLigneXtra,
    COTES_Y21, cotesY21De, baseS21, recotesEquipe, rendreRecotes, parseXtraLigue, rendreMeneurs,
    parseFicheAttributs, chargerFiche, urlFicheJoueur, telechargerFichesEquipe,
    parseMatricesUshl, importerMatricesUshl, normTxt, reconnaitre, nombreCellule,
    ALIAS_MATRICES, ALIAS_STATS, chargerMatrices, sauverMatrices,
    decoderEquipe, decoderEquipePerimee, classementRecotes, texteClassementRecotes, rendreClassementRecotes,
    litTransferts, ecritTransferts, appliquerTransferts, rafraichirRosterClub, joueursEquipeBrut, rendreTransferts,
    litInstantane, ecritInstantane, memoriserEquipe, dateInstantane, equipesInstantane, decoderTableau, CLES_JOUEUR,
    percentileLigue, distributionsLigue, fichesConnues, rendreClassement};
}
