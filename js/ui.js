/* =====================================================================
   INTERFACE : outils communs, navigation, en-tête
   ===================================================================== */
const $ = s => document.querySelector(s);
function flash(msg){
  const f = $('#flash'); f.textContent = msg; f.classList.add('visible');
  clearTimeout(flash._minuterie);
  flash._minuterie = setTimeout(()=>f.classList.remove('visible'), 2600);
}

/* ---------- Tables triables ----------
   Comparaison commune : les valeurs absentes vont toujours à la fin, les
   textes se comparent en français, les nombres numériquement. */
function comparer(va, vb, desc){
  if (va === vb) return 0;
  if (va === null || va === undefined) return 1;
  if (vb === null || vb === undefined) return -1;
  const r = (typeof va === 'string') ? va.localeCompare(vb, 'fr') : va - vb;
  return desc ? -r : r;
}
/* En-tête <thead> d'une table triable. cols : [[clé, libellé, titre?], …] */
function enteteTriable(cols, tri){
  return '<thead><tr>' + cols.map(([c, l, titre]) => c === null
    ? `<th class="sans-tri">${l}</th>`
    : `<th data-col="${c}"${titre ? ` title="${titre}"` : ''} class="${tri.col===c?'tri-actif':''}" aria-sort="${tri.col===c?(tri.desc?'descending':'ascending'):'none'}">${l}${tri.col===c?(tri.desc?' ▾':' ▴'):''}</th>`
  ).join('') + '</tr></thead>';
}
/* Clic sur un en-tête : même colonne → inverse le sens ; autre colonne →
   décroissant d'abord (les meilleurs en haut), croissant pour les textes. */
function brancherTri(table, tri, rendre, colonnesTexte = ['nom','equipe','po','profil']){
  table.querySelectorAll('th[data-col]').forEach(th => th.addEventListener('click', () => {
    const c = th.dataset.col;
    if (tri.col === c) tri.desc = !tri.desc;
    else { tri.col = c; tri.desc = !colonnesTexte.includes(c); }
    rendre();
  }));
}
/* Boutons à choix unique (segments, filtres) : rend la valeur choisie. */
function brancherSegments(conteneur, attribut, surChoix){
  conteneur.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !conteneur.contains(b)) return;
    conteneur.querySelectorAll('button').forEach(x => x.classList.toggle('actif', x === b));
    surChoix(b.dataset[attribut]);
  });
}

/* ---------- Cellules communes ---------- */
const COTES_COLONNES = ['it','sp','st','en','du','di','sk','pa','pc','df','sc','ex','ld'];
function badgePosition(po){
  return `<span class="pos-badge ${po==='G'?'g':(po==='D'?'d':'')}">${po}</span>`;
}
function etiquetteProfil(j){
  return `<span class="profil-tag ${j.po==='G'?'g-tag':(j.po==='D'?'d-tag':'')}">${j._profil.profil}</span>`;
}
function cellulesCotes(j){
  return COTES_COLONNES.map(c => {
    const v = j[c];
    const cls = (v===null||v===undefined) ? '' : (v>=85?'cote-elite':(v>=78?'cote-forte':''));
    return `<td class="${cls}">${v ?? '—'}</td>`;
  }).join('');
}
/* Blessure ou suspension telle que codée par le simulateur (IN, DD, 1W, S2…). */
function libelleIndisponibilite(code){
  let m;
  if ((m = /^S(\d+)$/.exec(code))) return `Suspendu ${m[1]} match${m[1]>1?'s':''}`;
  if ((m = /^(\d+)W$/.exec(code))) return `Blessé — ${m[1]} semaine${m[1]>1?'s':''}`;
  if ((m = /^(\d+)M$/.exec(code))) return `Blessé — ${m[1]} mois`;
  if (code === 'DD') return 'Blessé — au jour le jour';
  if (code === 'IN') return 'Blessé';
  return 'Indisponible (' + code + ')';
}
function etiquetteEtat(j){
  if (j.ij) return `<span class="tag-etat ${/^S\d/.test(j.ij)?'suspendu':'blesse'}" title="${echap(libelleIndisponibilite(j.ij))}">${echap(j.ij)}</span>`;
  if (j.cd !== null && j.cd !== undefined && j.cd < 90) return `<span class="tag-etat fatigue" title="Condition physique : ${j.cd} %">${j.cd} %</span>`;
  return '';
}

/* ---------- Navigation ----------
   Sept sections ; trois d'entre elles regroupent des sous-vues. L'adresse
   (#ligue/joueurs) suit la navigation : un rechargement ou un lien revient
   au même endroit. */
const RENDUS = {};   // nom de vue ou de sous-vue → fonction de rendu, rempli par app.js
function vueDe(sous){
  const el = document.getElementById('sous-' + sous);
  return el ? el.closest('section.vue').id.slice(4) : null;
}
/* Ouvre une section, ou une sous-vue (sa section s'ouvre avec elle). */
function ouvrirVue(nom, {adresse = true} = {}){
  let vue = nom, sous = null;
  if (!document.getElementById('vue-' + nom)){
    vue = vueDe(nom); sous = nom;
    if (!vue) return false;
  }
  const section = document.getElementById('vue-' + vue);
  document.querySelectorAll('#navPrincipale button[data-vue]').forEach(b => {
    const actif = b.dataset.vue === vue;
    b.classList.toggle('actif', actif);
    if (actif) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  document.querySelectorAll('section.vue').forEach(s => s.classList.toggle('actif', s === section));
  const boutons = [...section.querySelectorAll('.sous-nav button[data-sous]')];
  if (boutons.length){
    sous = sous || (boutons.find(b => b.classList.contains('actif')) || boutons[0]).dataset.sous;
    boutons.forEach(b => {
      b.classList.toggle('actif', b.dataset.sous === sous);
      b.setAttribute('aria-selected', b.dataset.sous === sous);
    });
    section.querySelectorAll('.sous-vue').forEach(s => s.classList.toggle('actif', s.id === 'sous-' + sous));
  }
  (RENDUS[vue] || (() => {}))();
  if (sous) (RENDUS[sous] || (() => {}))();
  if (adresse){
    const cible = '#' + vue + (sous ? '/' + sous : '');
    if (location.hash !== cible) history.replaceState(null, '', cible);
  }
  return true;
}
function vueCourante(){
  const section = document.querySelector('section.vue.actif');
  const sous = section?.querySelector('.sous-vue.actif');
  return {vue: section ? section.id.slice(4) : null, sous: sous ? sous.id.slice(5) : null};
}
function ouvrirDepuisAdresse(){
  const [vue, sous] = location.hash.replace(/^#/, '').split('/');
  return (sous && vueDe(sous) === vue && ouvrirVue(sous, {adresse: false})) || (vue && ouvrirVue(vue, {adresse: false}));
}
function brancherNavigation(){
  $('#navPrincipale').addEventListener('click', e => {
    const b = e.target.closest('button[data-vue]');
    if (b) ouvrirVue(b.dataset.vue);
  });
  document.querySelectorAll('.sous-nav').forEach(nav => nav.addEventListener('click', e => {
    const b = e.target.closest('button[data-sous]');
    if (b) ouvrirVue(b.dataset.sous);
  }));
  window.addEventListener('hashchange', ouvrirDepuisAdresse);
}

/* ---------- En-tête : club, fiche, état des données ---------- */
function rendreEntete(){
  $('#ficheEquipe').textContent = ETAT.fiche;
  const f = ficheEquipe(CONFIG.equipe);
  const rang = f ? classementTrie(ETAT.classement.fiches).findIndex(x => x.equipe === CONFIG.equipe) + 1 : 0;
  $('#rangEquipe').textContent = f
    ? ` · ${f.pts} pts · ${rang}${rang===1?'er':'e'} de la ligue${f.serie ? ' · série ' + f.serie : ''}`
    : '';
  $('#sourceInfo').textContent = sourceLisible();
  $('#etatDonnees').dataset.etat = ETAT.ligue.origine === 'direct' ? 'direct' : 'releve';
}
/* Pendant une lecture : pastille animée et bouton inactif. */
function afficherEtatMaj(etat, texte){
  const btn = $('#btnMaj');
  if (btn) btn.disabled = etat === 'lecture';
  $('#etatDonnees').dataset.etat = etat;
  if (texte !== undefined) $('#sourceInfo').textContent = texte;
}
/* Compte rendu d'une actualisation. Les données principales décident de la
   pastille ; les pages relayées ne font l'objet que d'une note discrète. */
function afficherRapport(rapport, enCours){
  rendreEntete();
  const btn = $('#btnMaj');
  if (btn) btn.disabled = enCours;
  const detail = $('#etatMaj');
  const notes = [];
  if (rapport.erreur){
    $('#etatDonnees').dataset.etat = 'erreur';
    notes.push(`ushl.ca ne répond pas (${rapport.erreur}) — affichage du ${ETAT.ligue.origine === 'conserve' ? 'dernier état lu' : 'relevé intégré'}, ${ilYA(ETAT.ligue.date)}.`);
  }
  const ratees = rapport.secondaires.filter(s => !s.ok).map(s => s.nom);
  if (enCours && !ratees.length) notes.push('compléments en cours de lecture…');
  if (ratees.length) notes.push(`non relu cette fois : ${ratees.join(', ')} — les valeurs du relevé sont utilisées.`);
  detail.textContent = notes.join(' ');
  detail.hidden = !notes.length;
}
