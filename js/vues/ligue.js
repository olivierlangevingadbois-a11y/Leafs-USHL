/* ---------- Joueurs de la ligue (dépistage) ---------- */
function joueursLigue(){
  const tous = [];
  for (const eq of LIGUE_EQUIPES){
    for (const j of joueursEquipe(eq)) tous.push(Object.assign({equipe: eq}, j));
  }
  return tous;
}
let triLigue = {col:'ov', desc:true};
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
function rendreLigue(){
  const table = document.getElementById('tableLigue');
  if (!table) return;
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
  const liste = joueursLigueFiltres(filtresLigue());
  // OV détaillé (deux décimales) pour l'affichage ET le tri des patineurs ;
  // les gardiens gardent leur OV (estimé ou en direct)
  for (const j of liste){
    if (j._ovd === undefined){
      let v = null;
      if (j.po !== 'G'){
        try { v = ovDetaille(j, j.po==='D'?'D':'F')?.valeur ?? null; } catch(e){ v = null; }
      }
      j._ovd = v !== null ? v : j.ov;
    }
  }
  const c = triLigue.col;
  liste.sort((a,b)=>{
    const va = c==='profil' ? a._profil.profil : (c==='ov' ? a._ovd : a[c]);
    const vb = c==='profil' ? b._profil.profil : (c==='ov' ? b._ovd : b[c]);
    if (va===vb) return 0;
    if (va===null||va===undefined) return 1;
    if (vb===null||vb===undefined) return -1;
    const r = (typeof va==='string') ? va.localeCompare(vb) : va - vb;
    return triLigue.desc ? -r : r;
  });
  document.getElementById('ligueCompte').textContent = liste.length + ' joueur' + (liste.length>1?'s':'');
  const cols = [['nom','Nom'],['equipe','Équipe'],['po','PO'],['age','Âge'],
                ['it','IT'],['sp','SP'],['st','ST'],['en','EN'],['du','DU'],['di','DI'],['sk','SK'],
                ['pa','PA'],['pc','PC'],['df','DF'],['sc','SC'],['ex','EX'],['ld','LD'],
                ['ov','OV'],['salaire','Salaire'],['ct','CT'],['profil','Profil']];
  let html = '<thead><tr>' + cols.map(([cl,l])=>
    `<th data-col="${cl}" class="${triLigue.col===cl?'tri-actif':''}">${l}${triLigue.col===cl?(triLigue.desc?' ▾':' ▴'):''}</th>`).join('') + '</tr></thead><tbody>';
  for (const j of liste){
    const badge = j.po==='G' ? 'g' : (j.po==='D' ? 'd' : '');
    const tag = j.po==='G' ? 'g-tag' : (j.po==='D' ? 'd-tag' : '');
    html += `<tr><td><span class="pos-badge ${badge}">${j.po}</span>${echap(j.nom)}</td>
      <td class="${j.equipe===CONFIG.equipe?'eq-club':''}">${j.equipe}</td>
      <td>${j.po}</td><td>${j.age}</td>`;
    for (const cle of ['it','sp','st','en','du','di','sk','pa','pc','df','sc','ex','ld']){
      const v = j[cle];
      const cls = (v===null||v===undefined) ? '' : (v>=85?'cote-elite':(v>=78?'cote-forte':''));
      html += `<td class="${cls}">${v ?? '—'}</td>`;
    }
    const ovAff = (j.po==='G')
      ? `${j.ovEstime?'~':''}${j.ov}`
      : j._ovd.toFixed(2).replace('.', ',');
    html += `<td class="${j.ov>=82?'cote-elite':(j.ov>=78?'cote-forte':'')}"><strong>${ovAff}</strong></td>
      <td>${fmtArgent(j.salaire)}</td><td>${j.ct ?? '—'}</td>
      <td style="text-align:left"><span class="profil-tag ${tag}">${j._profil.profil}</span></td></tr>`;
  }
  table.innerHTML = html + '</tbody>';
  table.querySelectorAll('th[data-col]').forEach(th=>{
    th.addEventListener('click', ()=>{
      const cl = th.dataset.col;
      if (triLigue.col===cl) triLigue.desc = !triLigue.desc;
      else triLigue = {col:cl, desc:true};
      rendreLigue();
    });
  });
}
