/* ---------- Classement de la ligue ----------
   Classement officiel de ushl.ca (Standings.php) quand il est à jour ; sinon
   fiches V-D-N calculées des décisions des gardiens (2 points par victoire,
   1 par nulle). Regroupement au choix : ligue, associations ou sections. */
let groupeClassement = 'ligue';
function classementTrie(fiches){
  const diff = f => (f.gf ?? 0) - (f.ga ?? 0);
  return [...fiches].sort((a,b) => b.pts - a.pts || b.w - a.w || diff(b) - diff(a) || a.equipe.localeCompare(b.equipe));
}
function tableClassement(fiches, complet){
  let html = `<div class="table-wrap"><table class="classement"><thead><tr><th class="sans-tri">Rang</th><th class="sans-tri gauche">Équipe</th>
    <th class="sans-tri" title="Parties jouées">PJ</th><th class="sans-tri" title="Victoires">V</th><th class="sans-tri" title="Défaites">D</th>
    <th class="sans-tri" title="Nulles">N</th>${complet ? '<th class="sans-tri" title="Défaites en prolongation">DP</th>' : ''}
    <th class="sans-tri">PTS</th><th class="sans-tri" title="Buts pour">BP</th><th class="sans-tri" title="Buts contre">BC</th>
    <th class="sans-tri" title="Différentiel de buts">DIFF</th>${complet ? '<th class="sans-tri" title="Dix derniers matchs">10 D.</th><th class="sans-tri">Série</th>' : ''}</tr></thead><tbody>`;
  classementTrie(fiches).forEach((f, i) => {
    const club = f.equipe === CONFIG.equipe;
    const diff = (f.gf ?? 0) - (f.ga ?? 0);
    html += `<tr class="${club?'rangee-club':''}"><td>${i+1}</td>
      <td class="gauche ${club?'eq-club':''}" title="${echap(CLUBS[f.equipe]?.nom || f.equipe)}">${club?'<strong>':''}${f.equipe}${club?'</strong>':''}</td>
      <td>${f.gp}</td><td>${f.w}</td><td>${f.l}</td><td>${f.t}</td>${complet ? `<td>${f.otl ?? '—'}</td>` : ''}
      <td><strong>${f.pts}</strong></td><td>${f.gf ?? '—'}</td><td>${f.ga ?? '—'}</td>
      <td class="${diff>0?'positif':(diff<0?'negatif':'')}">${diff>0?'+':''}${diff}</td>
      ${complet ? `<td>${f.l10 ?? '—'}</td><td>${f.serie ?? '—'}</td>` : ''}</tr>`;
  });
  return html + '</tbody></table></div>';
}
function rendreClassement(){
  const zone = document.getElementById('classementZone');
  if (!zone) return;
  const {fiches, officiel, date} = ETAT.classement;
  const etat = document.getElementById('classEtat');
  if (!fiches.length){
    zone.innerHTML = '<p class="vide">Aucun match disputé pour le moment.</p>';
    etat.textContent = '';
    return;
  }
  const groupesConnus = fiches.some(f => f.conf);
  document.getElementById('classGroupes').hidden = !groupesConnus;
  const cle = groupesConnus ? groupeClassement : 'ligue';
  if (cle === 'ligue'){
    zone.innerHTML = tableClassement(fiches, officiel);
  } else {
    const groupes = [...new Set(fiches.map(f => f[cle]).filter(Boolean))];
    zone.innerHTML = '<div class="classement-groupes">' + groupes.map(g =>
      `<div><h3 class="titre-bloc">${echap(g)}</h3>${tableClassement(fiches.filter(f => f[cle] === g), officiel)}</div>`).join('') + '</div>';
  }
  etat.textContent = officiel
    ? `classement officiel de ushl.ca, lu ${ilYA(date)}`
    : 'fiches calculées des décisions des gardiens (classement officiel non relu) — 2 pts par victoire, 1 par nulle';
}
