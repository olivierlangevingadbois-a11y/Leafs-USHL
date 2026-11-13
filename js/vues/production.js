/* ---------- Production du club ----------
   Statistiques de la saison (API de ushl.ca) et minutes jouées (XtraStats),
   patineurs puis gardiens. Avant le premier match de la saison, ce sont les
   totaux de la saison précédente qui s'affichent, à titre de repère. */
const triProd = {col:'pts', desc:true};
const COLONNES_PROD = [
  ['nom','Nom'],['gp','PJ','Parties jouées'],['goals','B','Buts'],['assists','P','Passes'],['pts','PTS','Points'],
  ['plusminus','+/-','Différentiel'],['pim','PUN','Minutes de punition'],['ppg','BAN','Buts en avantage numérique'],
  ['shg','BDN','Buts en désavantage numérique'],['gwg','BG','Buts gagnants'],['shots','T','Tirs au but'],
  ['shotpct','%T','Pourcentage de tirs'],['hits','MEÉ','Mises en échec'],['mp','MIN','Minutes jouées'],
  ['mg','MIN/PJ','Minutes par match']
];
function noteProduction(){
  if (ETAT.reference) return `Aucun match disputé cette saison : totaux de la saison précédente (XtraStats${ETAT.reference.date ? ' du ' + ETAT.reference.date : ''}), à titre de repère.`;
  if (!ETAT.enSaison) return 'Aucun match disputé pour le moment.';
  const minutes = Object.keys(ETAT.minutes.parCle).length
    ? `minutes jouées : XtraStats${ETAT.minutes.date ? ' du ' + ETAT.minutes.date : ''}`
    : 'minutes jouées indisponibles pour le moment';
  return `Statistiques de la saison, lues sur ushl.ca ${ilYA(ETAT.stats.date)} · ${minutes}.`;
}
function rendreProduction(){
  $('#prodSous').textContent = noteProduction();
  const lignes = ETAT.roster.map(j => ({j, p: productionDe(j)})).filter(l => l.p);
  const patineurs = lignes.filter(l => l.j.po !== 'G');
  for (const l of patineurs) l.p.mg = (l.p.mp && l.p.gp) ? l.p.mp / l.p.gp : null;
  const valeur = (l, c) => c === 'nom' ? l.j.nom : l.p[c];
  patineurs.sort((a,b) => comparer(valeur(a, triProd.col), valeur(b, triProd.col), triProd.desc));

  const nb = v => v ?? '—';
  let html = enteteTriable(COLONNES_PROD, triProd) + '<tbody>';
  for (const {j, p} of patineurs){
    html += `<tr><td>${badgePosition(j.po)}${echap(j.nom)}${etiquetteEtat(j)}</td>
      <td>${nb(p.gp)}</td><td>${nb(p.goals)}</td><td>${nb(p.assists)}</td>
      <td><strong>${nb(p.pts)}</strong></td><td>${fmtStat('plusminus', p.plusminus)}</td>
      <td>${nb(p.pim)}</td><td>${nb(p.ppg)}</td><td>${nb(p.shg)}</td><td>${nb(p.gwg)}</td><td>${nb(p.shots)}</td>
      <td>${p.shotpct!==null ? p.shotpct.toFixed(1) : '—'}</td>
      <td>${nb(p.hits)}</td><td>${nb(p.mp)}</td><td>${p.mg!==null ? p.mg.toFixed(1) : '—'}</td></tr>`;
  }
  if (patineurs.length){
    const somme = c => patineurs.reduce((s, l) => s + (l.p[c] || 0), 0);
    html += `<tr class="total"><td>Total des patineurs</td><td></td><td>${somme('goals')}</td><td>${somme('assists')}</td>
      <td><strong>${somme('pts')}</strong></td><td></td><td>${somme('pim')}</td><td>${somme('ppg')}</td><td>${somme('shg')}</td>
      <td>${somme('gwg')}</td><td>${somme('shots')}</td><td></td><td>${somme('hits')}</td><td></td><td></td></tr>`;
  }
  // gardiens : mêmes colonnes de tête, statistiques propres
  const gardiens = ETAT.roster.filter(j => j.po === 'G').map(j => ({j, p: productionDe(j)}));
  if (gardiens.length){
    html += `<tr class="sous-entete"><td>Gardiens</td><td>PJ</td><td title="Victoires">V</td><td title="Défaites">D</td>
      <td title="Nulles">N</td><td title="Moyenne de buts alloués">MOY</td><td title="Pourcentage d'arrêts">%A</td>
      <td title="Blanchissages">BL</td><td title="Tirs reçus">TR</td><td title="Buts alloués">BC</td>
      <td title="Minutes jouées">MIN</td><td colspan="4" class="gauche">Limite de parties</td></tr>`;
    for (const {j, p} of gardiens){
      const lim = ETAT.limites.get(normaliserNom(j.nom));
      const limite = lim ? `${p?.gp ?? 0} / ${lim}` + (p?.gp ? ` (${Math.round(p.gp/lim*100)} %)` : '') : '—';
      html += `<tr><td>${badgePosition('G')}${echap(j.nom)}${etiquetteEtat(j)}</td>
        <td>${nb(p?.gp)}</td><td>${nb(p?.w)}</td><td>${nb(p?.l)}</td><td>${nb(p?.t)}</td>
        <td>${p?.avg!==null && p?.avg!==undefined ? p.avg.toFixed(2) : '—'}</td>
        <td>${p?.svpct!==null && p?.svpct!==undefined ? p.svpct.toFixed(3).replace(/^0/, '') : '—'}</td>
        <td>${nb(p?.so)}</td><td>${nb(p?.sa)}</td><td>${nb(p?.ga)}</td><td>${nb(p?.mp)}</td>
        <td colspan="4" class="gauche">${limite}</td></tr>`;
    }
  }
  const table = $('#tableProduction');
  table.innerHTML = html + '</tbody>';
  brancherTri(table, triProd, rendreProduction);
}
