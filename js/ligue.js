/* Les 32 équipes : l'ordre des fichiers de la ligue, complété par toute équipe
   qui n'apparaîtrait que dans l'instantané du site. */
const LIGUE_EQUIPES = [...new Set([
  ...Object.keys(LIGUE_S21).filter(e => LIGUE_S21[e].length),
  ...Object.keys(LIGUE).filter(e => LIGUE[e].length)
])];
/* Équipes dont les chiffres datent encore des fichiers S21 : elles n'étaient
   pas chargées au moment de l'instantané et attendent une actualisation. */
const EQUIPES_PERIMEES = LIGUE_EQUIPES.filter(e => !(LIGUE[e] && LIGUE[e].length));

/* Rangées fictives des alignements : joueurs Backup_ du simulateur et
   lignes comptables de rachats ou de salaires retenus. */
function estFictif(nom){
  return /^(backup|rachat|retenue?)/i.test(String(nom).replace(/[\s_]/g,''));
}

/* ---------- Instantané de la ligue conservé dans ce navigateur ----------
   Le site ne peut pas être lu d'avance : c'est l'application, dans ton
   navigateur, qui télécharge les alignements. Ce qu'elle rapporte est
   CONSERVÉ ICI et devient la nouvelle référence par défaut — chiffres,
   contrats et surtout ÉQUIPE de chaque joueur, à la date du téléchargement.
   L'instantané des fichiers de la ligue (LIGUE, état S21) ne sert plus que
   de dernier recours et de base de comparaison pour les recotes. */
const CLES_JOUEUR = ['nom','po','hd','no','it','sp','st','en','du','di','sk','pa','pc','df','sc','ex','ld','ov','age','salaire','ct'];
function litInstantane(){
  try { return JSON.parse(localStorage.getItem(CLES_LS.instantane) || 'null'); }
  catch { return null; }
}
function ecritInstantane(o){
  try { localStorage.setItem(CLES_LS.instantane, JSON.stringify(o)); }
  catch (e){ /* quota dépassé : on garde l'instantané intégré */ }
}
/* Enregistre l'alignement d'une équipe (format compact, comme LIGUE). */
function memoriserEquipe(code, joueurs){
  const snap = litInstantane() || {date: null, equipes: {}};
  snap.equipes[code] = joueurs.map(j => CLES_JOUEUR.map(k => j[k] ?? null));
  snap.date = new Date().toISOString().slice(0,10);
  ecritInstantane(snap);
}
function dateInstantane(){
  const s = litInstantane();
  if (!s || !s.date) return null;
  const [a,m,j] = s.date.split('-');
  const mois = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  return `${+j} ${mois[+m-1]} ${a}`;
}
function equipesInstantane(){
  const s = litInstantane();
  return s ? Object.keys(s.equipes) : [];
}
/* Décode une équipe depuis un tableau compact (instantané intégré ou conservé). */
function decoderTableau(tab, marque, ovEstime){
  return (tab||[]).map(t=>{
    const j = Object.fromEntries(CLES_JOUEUR.map((k,i)=>[k,t[i]]));
    // les gardiens n'ont ni DF ni OF (0 dans les fichiers, NA sur le site)
    if (j.po==='G'){ j.df = null; j.sc = null; if (ovEstime) j.ovEstime = true; }
    if (marque) j[marque] = true;
    j._profil = determinerProfil(j);
    return j;
  }).filter(j=>!estFictif(j.nom));
}
/* Décode la base S21 INTÉGRÉE (fichiers de la ligue, état final de la saison)
   — même quand un alignement plus récent existe : c'est la base de comparaison
   du suivi des recotes. */
function decoderEquipe(code){
  // OV des gardiens estimé : les fichiers de la ligue ne publient pas le leur
  return decoderTableau(LIGUE_S21[code], '_fichiers', true);
}
/* Noms déjà placés par l'instantané du site : un joueur listé dans une équipe
   à jour ne doit pas réapparaître dans une équipe restée sur les fichiers S21
   (il a changé de club depuis). Construit une seule fois, à la demande. */
function nomsDejaPlaces(){
  if (!nomsDejaPlaces._set){
    const s = new Set();
    for (const code of Object.keys(LIGUE))
      for (const t of LIGUE[code]) s.add(normaliserNom(t[0]));
    nomsDejaPlaces._set = s;
  }
  return nomsDejaPlaces._set;
}
/* Repli sur les fichiers S21, purgé des joueurs qui jouent ailleurs aujourd'hui. */
function decoderEquipePerimee(code){
  const places = nomsDejaPlaces();
  return decoderEquipe(code).filter(j=>!places.has(normaliserNom(j.nom)));
}
/* Alignement de référence d'une équipe : direct de la session > instantané
   conservé dans ce navigateur > chiffres du site intégrés (LIGUE) > fichiers S21. */
function joueursEquipeBrut(code){
  if (code === CONFIG.equipe) return ETAT.rosterBrut.filter(j=>!estFictif(j.nom) && !j.backup);
  const direct = ETAT.equipesLive.get(code);
  if (direct) return direct;
  const snap = litInstantane();
  if (snap && snap.equipes[code]) return decoderTableau(snap.equipes[code], '_conserve');
  if (LIGUE[code] && LIGUE[code].length) return decoderTableau(LIGUE[code], '_instantane');
  return decoderEquipePerimee(code);
}
/* Vrai quand les cotes servies pour cette équipe viennent de ushl.ca (session
   en direct, instantané conservé ou instantané intégré du site) — donc quand
   elles constituent un côté «après» valide face à la base S21. */
function cotesDuSite(code){
  if (code === CONFIG.equipe) return ETAT.source.includes('ushl.ca') || !!LIGUE[code];
  if (ETAT.equipesLive.has(code)) return true;
  const snap = litInstantane();
  if (snap && snap.equipes[code]) return true;
  return !!(LIGUE[code] && LIGUE[code].length);
}
/* Provenance lisible des cotes d'un joueur d'une autre équipe. */
function provenanceDe(j){
  if (j._conserve) return `instantané conservé du ${dateInstantane()}`;
  if (j._instantane) return `chiffres du site du ${LIGUE_DATE}`;
  if (j._fichiers) return `fichiers de la ligue du ${DATE_S21} — périmé, à actualiser`;
  return 'cotes en direct de ushl.ca';
}
function joueursEquipe(code){
  if (code === CONFIG.equipe) return ETAT.roster.filter(j=>!estFictif(j.nom) && !j.backup);
  return appliquerTransferts(code, joueursEquipeBrut(code));
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
/* Recalcule la formation effective du club (rosterBrut + transferts). */
function rafraichirRosterClub(){
  ETAT.roster = appliquerTransferts(CONFIG.equipe, ETAT.rosterBrut.filter(j=>!estFictif(j.nom)));
  preparerRoster();
}
