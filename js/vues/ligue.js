/* ---------- Joueurs de la ligue ----------
   Une seule table pour le dépistage et les meneurs : les mêmes filtres
   (nom, équipe, position, profil, OV, âge, contrat) s'appliquent aux deux
   jeux de colonnes — «Cotes et contrats» ou «Statistiques». Cliquer un
   en-tête trie : en mode Statistiques, c'est le classement des meneurs de
   la catégorie. */
const LIGNES_LIGUE_MAX = 100;       // au-delà, un bouton affiche le reste
const ETAT_LIGUE = {
  mode: 'cotes',
  tout: false,
  tri: {cotes: {col:'ov', desc:true}, stats: {col:'pts', desc:true}, gardiens: {col:'w', desc:true}}
};
const COLONNES_LIGUE = {
  cotes: [['nom','Nom'],['equipe','Équipe'],['po','PO'],['age','Âge'],
    ['it','IT'],['sp','SP'],['st','ST'],['en','EN'],['du','DU'],['di','DI'],['sk','SK'],
    ['pa','PA'],['pc','PC'],['df','DF'],['sc','SC'],['ex','EX'],['ld','LD'],
    ['ov','OV'],['salaire','Salaire'],['ct','CT'],['profil','Profil']],
  stats: [['nom','Nom'],['equipe','Équipe'],['po','PO'],['ov','OV'],
    ['gp','PJ','Parties jouées'],['goals','B','Buts'],['assists','P','Passes'],['pts','PTS','Points'],
    ['plusminus','+/-','Différentiel'],['pim','PUN','Minutes de punition'],['ppg','BAN','Buts en avantage numérique'],
    ['gwg','BG','Buts gagnants'],['shots','T','Tirs au but'],['shotpct','%T','Pourcentage de tirs'],
    ['hits','MEÉ','Mises en échec'],['mp','MIN','Minutes jouées'],['mg','MIN/PJ','Minutes par match']],
  gardiens: [['nom','Nom'],['equipe','Équipe'],['ov','OV'],
    ['gp','PJ','Parties jouées'],['w','V','Victoires'],['l','D','Défaites'],['t','N','Nulles'],
    ['avg','MOY','Moyenne de buts alloués'],['svpct','%A',"Pourcentage d'arrêts"],['so','BL','Blanchissages'],
    ['sa','TR','Tirs reçus'],['ga','BC','Buts alloués'],['mp','MIN','Minutes jouées']]
};

function filtresLigue(){
  return {
    texte: normaliserNom(document.getElementById('ligueTexte').value),
    equipe: document.getElementById('ligueEquipe').value,
    po: document.getElementById('liguePo').value,
    profil: document.getElementById('ligueProfil').value,
    ovMin: nombre(document.getElementById('ligueOvMin').value),
    ageMax: nombre(document.getElementById('ligueAgeMax').value),
    expirants: document.getElementById('ligueExpirants').checked
  };
}
function joueursLigueFiltres(f){
  return joueursLigue().filter(j =>
    (!f.texte || normaliserNom(j.nom).includes(f.texte))
    && (!f.equipe || j.equipe === f.equipe)
    && (!f.po || (f.po === 'F' ? (j.po !== 'D' && j.po !== 'G') : j.po === f.po))
    && (!f.profil || j._profil.profil === f.profil)
    && (f.ovMin === null || j.ov >= f.ovMin)
    && (f.ageMax === null || j.age <= f.ageMax)
    && (!f.expirants || (j.ct ?? 0) <= 1));
}
/* OV détaillé (deux décimales) des patineurs, pour l'affichage et le tri ;
   les gardiens gardent l'OV du site. Calculé une fois par joueur. */
function ovTri(j){
  if (j._ovd === undefined){
    let v = null;
    if (j.po !== 'G'){
      try { v = ovDetaille(j, j.po==='D'?'D':'F')?.valeur ?? null; } catch(e){ v = null; }
    }
    j._ovd = v !== null ? v : j.ov;
  }
  return j._ovd;
}
/* Jeu de colonnes effectif : en mode Statistiques, le filtre «G» bascule sur
   les colonnes des gardiens ; sinon seuls les patineurs sont classés. */
function vueLigue(f){
  if (ETAT_LIGUE.mode === 'cotes') return 'cotes';
  return f.po === 'G' ? 'gardiens' : 'stats';
}
function peuplerFiltresLigue(){
  const selEq = document.getElementById('ligueEquipe');
  if (selEq.options.length <= 1){
    selEq.innerHTML = '<option value="">Toutes les équipes</option>' +
      LIGUE_EQUIPES.map(e=>`<option value="${e}">${e}${e===CONFIG.equipe?' (mon club)':''}</option>`).join('');
  }
  const selProfil = document.getElementById('ligueProfil');
  if (selProfil.options.length <= 1){
    const profils = [...new Set(joueursLigue().map(j=>j._profil.profil))].sort((a,b)=>a.localeCompare(b));
    selProfil.innerHTML = '<option value="">Tous les profils</option>' +
      profils.map(pr=>`<option value="${echap(pr)}">${echap(pr)}</option>`).join('');
  }
}
function rendreLigue(){
  const table = document.getElementById('tableLigue');
  if (!table) return;
  peuplerFiltresLigue();
  const f = filtresLigue();
  const vue = vueLigue(f);
  const tri = ETAT_LIGUE.tri[vue];
  let lignes = joueursLigueFiltres(f).map(j => ({j, p: null}));
  if (vue !== 'cotes'){
    lignes = lignes.filter(l => vue === 'gardiens' ? l.j.po === 'G' : l.j.po !== 'G');
    for (const l of lignes){
      l.p = productionDe(l.j, l.j.equipe);
      if (l.p && vue === 'stats') l.p.mg = (l.p.mp && l.p.gp) ? l.p.mp / l.p.gp : null;
    }
    lignes = lignes.filter(l => l.p && l.p.gp > 0);   // un classement de meneurs ne compte que ceux qui ont joué
  }
  const DU_JOUEUR = ['nom','equipe','po','age','salaire','ct', ...COTES_COLONNES];
  const valeur = (l, c) => c === 'profil' ? l.j._profil.profil
    : c === 'ov' ? ovTri(l.j)
    : DU_JOUEUR.includes(c) ? l.j[c] : l.p?.[c];
  lignes.sort((a,b) => comparer(valeur(a, tri.col), valeur(b, tri.col), tri.desc));

  const total = lignes.length;
  const visibles = ETAT_LIGUE.tout ? lignes : lignes.slice(0, LIGNES_LIGUE_MAX);
  const ovAff = j => j.po === 'G' ? `${j.ovEstime?'~':''}${j.ov}` : ovTri(j).toFixed(2).replace('.', ',');
  const nb = v => v ?? '—';
  const celluleOv = j => `<td class="${j.ov>=82?'cote-elite':(j.ov>=78?'cote-forte':'')}"><strong>${ovAff(j)}</strong></td>`;
  const tete = (j, rang) => `<td class="rang">${rang}</td><td>${badgePosition(j.po)}${echap(j.nom)}${etiquetteEtat(j)}</td>
    <td class="${j.equipe===CONFIG.equipe?'eq-club':''}">${j.equipe}</td>`;
  let html = enteteTriable(COLONNES_LIGUE[vue], tri).replace('<tr>', '<tr><th class="sans-tri rang">#</th>') + '<tbody>';
  visibles.forEach(({j, p}, i) => {
    const club = j.equipe === CONFIG.equipe ? ' class="rangee-club"' : '';
    if (vue === 'cotes'){
      html += `<tr${club}>${tete(j, i+1)}<td>${j.po}</td><td>${j.age}</td>${cellulesCotes(j)}${celluleOv(j)}
        <td>${fmtArgent(j.salaire)}</td><td>${nb(j.ct)}</td><td class="gauche">${etiquetteProfil(j)}</td></tr>`;
    } else if (vue === 'stats'){
      const fort = c => tri.col === c ? ` class="col-triee"` : '';
      html += `<tr${club}>${tete(j, i+1)}<td>${j.po}</td>${celluleOv(j)}
        <td${fort('gp')}>${nb(p.gp)}</td><td${fort('goals')}>${nb(p.goals)}</td><td${fort('assists')}>${nb(p.assists)}</td>
        <td${fort('pts')}>${nb(p.pts)}</td><td${fort('plusminus')}>${fmtStat('plusminus', p.plusminus)}</td>
        <td${fort('pim')}>${nb(p.pim)}</td><td${fort('ppg')}>${nb(p.ppg)}</td><td${fort('gwg')}>${nb(p.gwg)}</td>
        <td${fort('shots')}>${nb(p.shots)}</td><td${fort('shotpct')}>${p.shotpct!==null ? p.shotpct.toFixed(1) : '—'}</td>
        <td${fort('hits')}>${nb(p.hits)}</td><td${fort('mp')}>${nb(p.mp)}</td>
        <td${fort('mg')}>${p.mg!==null ? p.mg.toFixed(1) : '—'}</td></tr>`;
    } else {
      html += `<tr${club}>${tete(j, i+1)}${celluleOv(j)}
        <td>${nb(p.gp)}</td><td>${nb(p.w)}</td><td>${nb(p.l)}</td><td>${nb(p.t)}</td>
        <td>${p.avg!==null ? p.avg.toFixed(2) : '—'}</td><td>${p.svpct!==null ? p.svpct.toFixed(3).replace(/^0/, '') : '—'}</td>
        <td>${nb(p.so)}</td><td>${nb(p.sa)}</td><td>${nb(p.ga)}</td><td>${nb(p.mp)}</td></tr>`;
    }
  });
  if (!total){
    const nbCols = COLONNES_LIGUE[vue].length + 1;
    html += `<tr><td colspan="${nbCols}" class="vide">${vue === 'cotes' || ETAT.enSaison
      ? 'Aucun joueur ne correspond à ces filtres.'
      : 'Aucun match disputé pour le moment : les statistiques arrivent avec la saison.'}</td></tr>`;
  }
  table.innerHTML = html + '</tbody>';
  brancherTri(table, tri, rendreLigue);

  const s = total > 1 ? 's' : '';
  document.getElementById('ligueCompte').textContent = total + (vue === 'gardiens' ? ` gardien${s}` : vue === 'stats' ? ` patineur${s} ayant joué` : ` joueur${s}`)
    + (vue === 'stats' && !Object.keys(ETAT.minutes.parCle).length ? ' · minutes indisponibles' : '');
  const btnTout = document.getElementById('ligueTout');
  btnTout.hidden = total <= LIGNES_LIGUE_MAX;
  btnTout.textContent = ETAT_LIGUE.tout ? `Revenir aux ${LIGNES_LIGUE_MAX} premiers` : `Afficher les ${total}`;
}
