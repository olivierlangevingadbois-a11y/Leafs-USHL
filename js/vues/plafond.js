/* ---------- Projection du plafond salarial ----------
   Pour chaque saison à venir : masse engagée par les contrats en cours
   (un contrat CT = N couvre les N prochaines saisons) et, pour les contrats
   échus, par la prolongation enregistrée (salaire × durée). Retourne des
   rangées {saison, engages, masse, marge, expirants} — pur et testable. */
function projectionPlafond(nbSaisons, resignMap){
  const r = resignMap || litResignatures();
  const contrats = ETAT.roster.filter(j=>!j.backup).map(j=>{
    const sig = (j.ct === 0) ? r[normaliserNom(j.nom)] : null;
    return sig ? {nom:j.nom, salaire:sig.salaire, annees:sig.duree || dureeMaxCharte(sig.statut), prolonge:true}
               : {nom:j.nom, salaire:j.salaire || 0, annees:j.ct || 0, prolonge:false};
  });
  const rangees = [];
  for (let k = 0; k < (nbSaisons || 5); k++){
    const couverts = contrats.filter(c=>c.annees > k);
    const masse = couverts.reduce((s,c)=>s+c.salaire, 0);
    rangees.push({
      saison: 'Y' + (22 + k),
      engages: couverts.length,
      masse,
      marge: PLAFOND - masse,
      expirants: contrats.filter(c=>c.annees === k+1).map(c=>c.nom)
    });
  }
  return rangees;
}
function rendrePlafond(){
  const rangees = projectionPlafond(5);
  const y0 = rangees[0];
  document.getElementById('plafondSommaire').innerHTML = `
    <div class="stat-carte ${y0.masse>PLAFOND?'alerte':''}">
      <div class="lbl">Masse ${y0.saison}</div><div class="val">${fmtArgent(y0.masse)}</div>
      <div class="det">marge ${fmtArgent(y0.marge)}</div></div>
    <div class="stat-carte"><div class="lbl">Sous contrat ${y0.saison}</div><div class="val">${y0.engages}</div>
      <div class="det">joueurs couverts par un contrat</div></div>
    <div class="stat-carte orange"><div class="lbl">Expirent après ${y0.saison}</div><div class="val">${y0.expirants.length}</div>
      <div class="det">à re-signer à la charte ou à remplacer</div></div>`;
  let html = `<thead><tr><th>Saison</th><th>Sous contrat</th><th>Masse engagée</th><th>Marge sous 104 M$</th>
    <th style="text-align:left">Contrats qui expirent à la fin de la saison</th></tr></thead><tbody>`;
  for (const rg of rangees){
    html += `<tr class="${rg.masse>PLAFOND?'depasse':''}">
      <td><strong>${rg.saison}</strong></td><td>${rg.engages}</td>
      <td>${fmtArgent(rg.masse)}</td><td>${fmtArgent(rg.marge)}</td>
      <td class="exp">${rg.expirants.length ? rg.expirants.map(echap).join(', ') : '—'}</td></tr>`;
  }
  document.getElementById('tablePlafond').innerHTML = html + '</tbody>';
}
