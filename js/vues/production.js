/* ---------- Production ---------- */
function rendreProduction(){
  const enCours = ETAT.scoring.patineurs.length > 0;
  const lignes = [];
  for (const j of ETAT.roster){
    if (j.backup) continue;
    const p = productionDe(j);
    lignes.push({j, p});
  }
  const avecDonnees = lignes.filter(l=>l.p);
  $('#prodSous').textContent = enCours
    ? 'Pointage de la saison actuelle (TeamScoring.php) enrichi de XtraStats (minutes, mises en échec)'
    : 'Aucun match Y22 pour le moment — la référence Y21 (archive XtraStats) s\'affiche après la première actualisation depuis ushl.ca';
  const totPts = avecDonnees.reduce((s,l)=>s+(l.p.pts||0),0);
  const totB = avecDonnees.reduce((s,l)=>s+(l.p.goals||0),0);
  const totH = avecDonnees.reduce((s,l)=>s+(l.p.hits||0),0);
  $('#prodSommaire').innerHTML = `
    <div class="stat-carte"><div class="lbl">${enCours?'Saison en cours':'Référence Y21'}</div>
      <div class="val">${ETAT.fiche}</div><div class="det">${enCours?'données en direct':'en attente des premiers matchs Y22'}</div></div>
    <div class="stat-carte"><div class="lbl">Buts</div><div class="val">${totB}</div></div>
    <div class="stat-carte"><div class="lbl">Points</div><div class="val">${totPts}</div></div>
    <div class="stat-carte orange"><div class="lbl">Mises en échec</div><div class="val">${totH}</div></div>`;

  let html = `<thead><tr><th>Nom</th><th>PJ</th><th>B</th><th>P</th><th>PTS</th><th>+/-</th>
    <th>BAN</th><th>BG</th><th>T</th><th>%T</th><th>MEÉ</th><th>MIN</th><th>MIN/PJ</th></tr></thead><tbody>`;
  avecDonnees.sort((a,b)=>(b.p.pts||0)-(a.p.pts||0));
  for (const {j,p} of avecDonnees){
    if (j.po==='G') continue;
    const badge = j.po==='D' ? 'd' : '';
    html += `<tr><td><span class="pos-badge ${badge}">${j.po}</span>${echap(j.nom)}</td>
      <td>${p.gp??'—'}</td><td>${p.goals??'—'}</td><td>${p.assists??'—'}</td>
      <td><strong>${p.pts??'—'}</strong></td><td>${fmtStat('plusminus',p.plusminus)}</td>
      <td>${p.ppg??'—'}</td><td>${p.gwg??'—'}</td><td>${p.shots??'—'}</td>
      <td>${p.shotpct!==null?p.shotpct.toFixed(1):'—'}</td>
      <td>${p.hits??'—'}</td><td>${p.mp??'—'}</td>
      <td>${(p.mp&&p.gp)?(p.mp/p.gp).toFixed(1):'—'}</td></tr>`;
  }
  // gardiens
  const gardiens = lignes.filter(l=>l.j.po==='G');
  if (gardiens.length){
    html += `<tr><td colspan="13" style="text-align:left;color:var(--txt-faint);background:var(--bleu-nuit);
      text-transform:uppercase;font-size:.65rem;letter-spacing:1px">Gardiens ${enCours?'(saison en cours)':'(matchs Y21)'}</td></tr>`;
    for (const {j,p} of gardiens){
      html += `<tr><td><span class="pos-badge g">G</span>${echap(j.nom)}</td>
        <td>${p?.gp??'—'}</td><td colspan="3">V ${p?.w??'—'} · MOY ${p?.avg!==null&&p?.avg!==undefined?p.avg:'—'} · %A ${p?.svpct??'—'}</td>
        <td colspan="8" style="text-align:left;color:var(--txt-faint)">DQ ${p?.qs??'—'} · MIN ${p?.mp??'—'}</td></tr>`;
    }
  }
  html += '</tbody>';
  $('#tableProduction').innerHTML = html;
}
