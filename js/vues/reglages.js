/* ---------- Réglages : éditeur de matrices (rangées OV 73-90 × six degrés) ---------- */
function rendreSelectMatrice(){
  const sel = $('#selMatrice');
  sel.innerHTML = Object.keys(MATRICES).map(k=>`<option value="${k}">${NOMS_MATRICES[k]||k}</option>`).join('');
  rendreSelectStat();
}
function rendreSelectStat(){
  const matCle = $('#selMatrice').value;
  const sel = $('#selStat');
  const stats = Object.keys(MATRICES[matCle]||{});
  sel.innerHTML = stats.map(s=>`<option value="${s}">${STATS_DEF[s].nom} — «${MATRICES[matCle][s].titre}»</option>`).join('');
}
function rendreMatrice(){
  const matCle = $('#selMatrice').value;
  const statCle = $('#selStat').value;
  const table = $('#tableMatrice');
  const def = MATRICES?.[matCle]?.[statCle];
  if (!def){ table.innerHTML = ''; return; }
  const perso = chargerMatrices();
  let html = '<thead><tr><th>Overall</th>' + NIVEAUX.map(n=>`<th>${n.nom}</th>`).join('') + '</tr></thead><tbody>';
  const ovFin = def.rangs[def.rangs.length-1][0];
  for (let ov=OV_MIN; ov<=ovFin; ov++){
    const p = perso?.[matCle]?.[statCle]?.[ov];
    const base = Array.isArray(p) && p.length===6 ? p : seuilsMatrice(matCle, statCle, ov);
    const modif = Array.isArray(p) && p.length===6;
    html += `<tr><td${modif?' style="color:var(--accent-vif)" title="rangée personnalisée"':''}>${ov}</td>`;
    for (let i=0;i<6;i++){
      const v = base ? base[i] : null;
      html += `<td><input type="number" step="any" data-mat="${matCle}" data-stat="${statCle}" data-ov="${ov}" data-niv="${i}" value="${v??''}"></td>`;
    }
    html += '</tr>';
  }
  html += '</tbody>';
  table.innerHTML = html;
  table.querySelectorAll('input').forEach(inp=>{
    inp.addEventListener('change', ()=>{
      const m = chargerMatrices();
      const {mat, stat, ov, niv} = inp.dataset;
      const o = Number(ov), i = Number(niv);
      m[mat] = m[mat]||{}; m[mat][stat] = m[mat][stat]||{};
      const base = (Array.isArray(m[mat][stat][o]) && m[mat][stat][o].length===6)
        ? m[mat][stat][o] : (seuilsMatrice(mat, stat, o) || [null,null,null,null,null,null]).slice();
      base[i] = inp.value==='' ? null : Number(inp.value);
      m[mat][stat][o] = base;
      sauverMatrices(m);
      flash('Rangée personnalisée enregistrée (remplace la valeur Y17)');
      rendreMatrice();
      rendreProgression();
    });
  });
}
