/* ---------- Meneurs de la ligue (XtraStats) ---------- */
const MENEURS_CATS = {
  pts:'Points', goals:'Buts', assists:'Passes', hits:'Mises en échec',
  shots:'Tirs au but', mp:'Minutes jouées', pim:'Minutes de punition'
};
function rendreMeneurs(){
  const table = document.getElementById('tableMeneurs');
  if (!table) return;
  const cat = document.getElementById('menCategorie').value;
  const po = document.getElementById('menPo').value;
  const leafsSeul = document.getElementById('menLeafs').checked;
  const sous = document.getElementById('menSous');
  if (!ETAT.xtraLigue.length){
    table.innerHTML = '';
    sous.textContent = 'Aucune donnée pour le moment : clique «Actualiser depuis ushl.ca» (la page XtraStats fournit les classements de toute la ligue).';
    return;
  }
  sous.textContent = 'Classements des patineurs de toute la ligue (XtraStats'
    + (ETAT.xtraDate ? ' du ' + ETAT.xtraDate : '') + (ETAT.xtraEstY21 ? ' — archive de la saison Y21' : '')
    + '). Les joueurs de ' + CONFIG.equipe + ' sont surlignés.';
  let liste = ETAT.xtraLigue.filter(x=>x.gp>0);
  if (po==='F') liste = liste.filter(x=>x.pos!=='D' && x.pos!=='G');
  if (po==='D') liste = liste.filter(x=>x.pos==='D');
  if (leafsSeul) liste = liste.filter(x=>x.equipe===CONFIG.equipe);
  liste.sort((a,b)=>(b[cat]||0)-(a[cat]||0));
  liste = liste.slice(0, 50);
  let html = `<thead><tr><th>Rang</th><th>Nom</th><th>Équipe</th><th>PO</th><th>PJ</th>
    <th>${MENEURS_CATS[cat]}</th><th>B</th><th>P</th><th>PTS</th><th>MEÉ</th><th>MIN</th></tr></thead><tbody>`;
  liste.forEach((x,i)=>{
    const club = x.equipe===CONFIG.equipe;
    html += `<tr${club?' style="background:rgba(77,159,255,.10)"':''}>
      <td>${i+1}</td><td>${club?'<strong>':''}${echap(x.nom)}${club?'</strong>':''}</td>
      <td class="${club?'eq-club':''}">${x.equipe}</td><td>${x.pos}</td><td>${x.gp}</td>
      <td><strong>${x[cat] ?? '—'}</strong></td>
      <td>${x.goals}</td><td>${x.assists}</td><td>${x.pts}</td><td>${x.hits}</td><td>${x.mp}</td></tr>`;
  });
  table.innerHTML = html + '</tbody>';
}
