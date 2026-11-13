/* ---------- Suivi des recotes (Y21 → maintenant) ----------
   Deux sources, la meilleure gagne :
   1. la FICHE du joueur sur ushl.ca (CareerStatsPlayer.php, section
      «Historique des attributs») — saison par saison, OV du site compris,
      gardiens inclus ; téléchargée à la demande ou pour toute l'équipe ;
   2. sinon, l'instantané de fin Y21 (USHL21.csv) comparé aux cotes
      actuelles — environ 140 joueurs de la ligue n'y figurent pas. */
function cotesY21De(nom){ return COTES_Y21[normaliserNom(nom)] || null; }
/* Base S21 de TOUTE la ligue, indexée par nom normalisé et construite une seule
   fois. Indexer par nom plutôt que par équipe est essentiel : un joueur échangé
   depuis la fin de S21 garde sa référence d'avant-recote même s'il portait alors
   un autre chandail. */
function baseS21(){
  if (!baseS21._map){
    const m = new Map();
    for (const code of Object.keys(LIGUE_S21))
      for (const j of decoderEquipe(code)) m.set(normaliserNom(j.nom), j);
    baseS21._map = m;
  }
  return baseS21._map;
}
/* Prépare la base S21 et l'état de fraîcheur pour recotesEquipe. */
function preparerRecotes(code){
  recotesEquipe._snapshot = baseS21();
  recotesEquipe._enDirect = cotesDuSite(code);
}
/* OV exact (valeur au centième) d'un tableau de 13 cotes, patineurs seulement. */
function ovExactDe(cotesArr, po){
  if (po === 'G') return null;
  try {
    const r = ovDetaille(Object.fromEntries(OV_ORDRE.map((k,i)=>[k, cotesArr[i]])), po==='D'?'D':'F');
    return r ? r.valeur : null;
  } catch (e){ return null; }
}
function recotesEquipe(code){
  preparerRecotes(code);
  return joueursEquipe(code).map(j=>{
    const fiche = ETAT.fiches.get(normaliserNom(j.nom));
    if (fiche && fiche.length){
      const tri = [...fiche].sort((a,b)=>b.saison-a.saison);
      const cur = tri[0], prev = tri[1] || null;
      if (!prev) return {j, absent:true, source:'site', noteAbsent:'une seule saison à sa fiche ushl.ca (recrue)'};
      const avant = OV_ORDRE.map(k=>prev.cotes[k]);
      const actuel = OV_ORDRE.map(k=>cur.cotes[k]);
      const deltas = {};
      let somme = 0;
      OV_ORDRE.forEach((k,i)=>{
        if (actuel[i]===null || avant[i]===null){ deltas[k] = null; return; }
        deltas[k] = actuel[i] - avant[i];
        somme += deltas[k];
      });
      const ovAvantExact = ovExactDe(avant, j.po), ovActuelExact = ovExactDe(actuel, j.po);
      return {j, avant, actuel, deltas, somme, source:'site',
              ovAvant: prev.ov, ovActuel: cur.ov,
              ovAvantExact, ovActuelExact,
              ovDeltaExact: (ovAvantExact!==null && ovActuelExact!==null) ? ovActuelExact - ovAvantExact : null,
              ovDelta: (prev.ov!==null && cur.ov!==null) ? cur.ov - prev.ov : null};
    }
    // base = instantané S21 des fichiers ; actuel = cotes du site (alignement
    // en direct, chargé automatiquement à l'ouverture pour le club et à la
    // sélection pour les autres équipes)
    const avType = recotesEquipe._snapshot.get(normaliserNom(j.nom));
    if (!avType) return {j, absent:true, source:'fichiers',
      noteAbsent:'absent des fichiers S21 de la ligue (recrue ou nouveau venu) — consulte sa fiche ushl.ca'};
    if (!recotesEquipe._enDirect) return {j, absent:true, source:'fichiers',
      noteAbsent:'équipe encore sur les fichiers S21 — actualise-la (ou clique sa fiche)'};
    const avant = OV_ORDRE.map(k=>avType[k]);
    const actuel = OV_ORDRE.map(k=>j[k]);
    const deltas = {};
    let somme = 0;
    OV_ORDRE.forEach((k,i)=>{
      if (actuel[i]===null || actuel[i]===undefined || avant[i]===null){ deltas[k] = null; return; }
      deltas[k] = actuel[i] - avant[i];
      somme += deltas[k];
    });
    let ovAvant = null;
    if (j.po !== 'G'){
      const r = ovDetaille(Object.fromEntries(OV_ORDRE.map((k,i)=>[k, avant[i]])), j.po==='D'?'D':'F');
      ovAvant = r ? r.arrondi : null;
    }
    const ovAvantExact = ovExactDe(avant, j.po), ovActuelExact = ovExactDe(actuel, j.po);
    return {j, avant, actuel, deltas, somme, source:'direct', ovAvant,
            ovActuel: j.ov ?? null,
            ovAvantExact, ovActuelExact,
            ovDeltaExact: (ovAvantExact!==null && ovActuelExact!==null) ? ovActuelExact - ovAvantExact : null,
            ovDelta: (ovAvant!==null && j.ov!==null && j.ov!==undefined) ? j.ov - ovAvant : null};
  });
}
function rendreRecotes(){
  const table = document.getElementById('tableRecotes');
  if (!table) return;
  const selEq = document.getElementById('recEquipe');
  if (!selEq.options.length){
    selEq.innerHTML = LIGUE_EQUIPES.map(e=>`<option value="${e}">${e}${e===CONFIG.equipe?' (mon club)':''}</option>`).join('');
    selEq.value = CONFIG.equipe;
  }
  const lignes = recotesEquipe(selEq.value);
  const rangDe = r => r.ovDeltaExact ?? r.ovDelta ?? (r.somme!==undefined ? r.somme/20 : -99);
  lignes.sort((a,b)=> rangDe(b) - rangDe(a));
  const cell = (d, av, ap) => {
    if (d===null || d===undefined) return '<td class="rec-zero">—</td>';
    const cls = d>0 ? 'rec-plus' : (d<0 ? 'rec-moins' : 'rec-zero');
    return `<td class="${cls}" title="${av} → ${ap}">${d>0?'+':''}${d||'·'}</td>`;
  };
  let html = '<thead><tr><th>Nom</th><th>PO</th><th>Âge</th><th>OV avant→après</th>'
    + OV_ORDRE.map(k=>`<th>${OVD_LIBELLES[k]}</th>`).join('') + '<th>Δ total</th><th>Fiche</th></tr></thead><tbody>';
  const btnFiche = r => r.source==='site'
    ? '<td class="rec-zero" title="Historique des attributs de sa fiche ushl.ca">✓ site</td>'
    : `<td><button class="btn-fiche" data-nom="${echap(r.j.nom)}" title="Télécharger l'historique des attributs de sa fiche ushl.ca (CareerStatsPlayer)">fiche</button></td>`;
  for (const r of lignes){
    html += `<tr><td>${echap(r.j.nom)}</td><td>${r.j.po}</td><td>${r.j.age}</td>`;
    if (r.absent){
      html += `<td class="rec-zero" colspan="${OV_ORDRE.length+2}" style="text-align:left">${r.noteAbsent}</td>${btnFiche(r)}</tr>`;
      continue;
    }
    if (r.ovAvantExact!==null && r.ovActuelExact!==null){
      // OV exact au centième, calculé sur les cotes de chaque saison
      const dE = r.ovActuelExact - r.ovAvantExact;
      const cls = dE>0.005?'rec-plus':(dE<-0.005?'rec-moins':'rec-zero');
      const fx = v => v.toFixed(2).replace('.', ',');
      const titre = (r.ovAvant!==null && r.ovActuel!==null)
        ? ` title="OV ${r.source==='site'?'affiché sur le site':'arrondi'} : ${r.ovAvant} → ${r.ovActuel}"` : '';
      html += `<td class="${cls}"${titre}>${fx(r.ovAvantExact)}→${fx(r.ovActuelExact)} (${dE>0?'+':''}${fx(dE)})</td>`;
    } else if (r.ovDelta!==null){
      const cls = r.ovDelta>0?'rec-plus':(r.ovDelta<0?'rec-moins':'rec-zero');
      html += `<td class="${cls}" title="${r.ovAvant} → ${r.ovActuel}">${r.ovAvant}→${r.ovActuel} (${r.ovDelta>0?'+':''}${r.ovDelta||'='})</td>`;
    } else {
      html += `<td class="rec-zero">${r.j.po==='G'?'gardien':'—'}</td>`;
    }
    OV_ORDRE.forEach((k,i)=>{ html += cell(r.deltas[k], r.avant[i], r.actuel[i]); });
    const clsS = r.somme>0?'rec-plus':(r.somme<0?'rec-moins':'rec-zero');
    html += `<td class="${clsS}"><strong>${r.somme>0?'+':''}${r.somme}</strong></td>${btnFiche(r)}</tr>`;
  }
  table.innerHTML = html + '</tbody>';
  table.querySelectorAll('button.btn-fiche').forEach(b=>{
    b.addEventListener('click', ()=>{
      b.disabled = true; b.textContent = '…';
      chargerFiche(b.dataset.nom)
        .then(()=>{ rendreRecotes(); flash('Fiche de ' + b.dataset.nom + ' chargée depuis ushl.ca'); })
        .catch(()=>{ b.disabled = false; b.textContent = 'fiche'; flash('Fiche introuvable — réessaie dans un instant'); });
    });
  });
  const nbSite = lignes.filter(r=>r.source==='site').length;
  document.getElementById('recNote').textContent =
    (nbSite ? `${nbSite} joueur${nbSite>1?'s':''} depuis les fiches du site · ` : '')
    + (cotesDuSite(selEq.value)
        ? `cotes actuelles : ${provenanceDe(joueursEquipeBrut(selEq.value)[0])}`
        : `équipe encore sur les fichiers de la ligue du ${DATE_S21} — actualise`);
}
/* ---------- Classement des recotes de la ligue ----------
   Pour chaque équipe dont les cotes viennent du site (session en direct ou
   relevé intégré) : gain moyen d'OV exact par patineur entre la base S21 des
   fichiers de la ligue et les cotes actuelles. Fiable parce que les deux côtés
   passent par la même formule d'OV et que le côté «après» vient du site. */
function classementRecotes(){
  const rangs = [];
  for (const eq of LIGUE_EQUIPES){
    if (!cotesDuSite(eq)) continue;
    const avantM = baseS21();
    let n = 0, tot = 0, top = null;
    for (const j of joueursEquipe(eq)){
      if (j.po === 'G') continue;
      const av = avantM.get(normaliserNom(j.nom));
      if (!av) continue;
      const oAv = ovExactDe(OV_ORDRE.map(k=>av[k]), j.po);
      const oAp = ovExactDe(OV_ORDRE.map(k=>j[k]), j.po);
      if (oAv === null || oAp === null) continue;
      const d = oAp - oAv;
      tot += d; n++;
      if (!top || d > top.d) top = {nom: j.nom, d};
    }
    if (n) rangs.push({eq, n, moy: tot/n, tot, top});
  }
  rangs.sort((a,b)=>b.moy - a.moy);
  return rangs;
}
function texteClassementRecotes(){
  const rangs = classementRecotes();
  const l = ['CLASSEMENT DES RECOTES — USHL Pro (S21 → cotes actuelles du site)',
    'Gain moyen d\'OV exact par patineur apparié (formule du calculateur des deux côtés).', ''];
  rangs.forEach((r,i)=>{
    l.push(`${String(i+1).padStart(2)}. ${r.eq.padEnd(11)} ${(r.moy>=0?'+':'')}${r.moy.toFixed(3)} d'OV moyen · total ${(r.tot>=0?'+':'')}${r.tot.toFixed(1)} sur ${r.n} patineurs · meilleur : ${r.top.nom} ${(r.top.d>=0?'+':'')}${r.top.d.toFixed(2)}`);
  });
  if (rangs.length < LIGUE_EQUIPES.length){
    l.push('', `(${rangs.length}/${LIGUE_EQUIPES.length} équipes — les autres n'ont pas encore de cotes du site)`);
  }
  return l.join('\n');
}
function rendreClassementRecotes(){
  const table = document.getElementById('tableRecClassement');
  if (!table) return;
  const rangs = classementRecotes();
  if (!rangs.length){ table.innerHTML = ''; return; }
  let html = `<thead><tr><th>Rang</th><th>Équipe</th><th>ΔOV moyen</th><th>ΔOV total</th><th>Patineurs</th>
    <th style="text-align:left">Meilleure progression</th></tr></thead><tbody>`;
  rangs.forEach((r,i)=>{
    const club = r.eq === CONFIG.equipe;
    html += `<tr${club?' style="background:rgba(77,159,255,.10)"':''}>
      <td>${i+1}</td><td class="${club?'eq-club':''}" style="text-align:left">${club?'<strong>':''}${r.eq}${club?'</strong>':''}</td>
      <td class="${r.moy>0?'rec-plus':(r.moy<0?'rec-moins':'rec-zero')}">${r.moy>=0?'+':''}${r.moy.toFixed(3)}</td>
      <td>${r.tot>=0?'+':''}${r.tot.toFixed(1)}</td><td>${r.n}</td>
      <td style="text-align:left">${echap(r.top.nom)} ${r.top.d>=0?'+':''}${r.top.d.toFixed(2)}</td></tr>`;
  });
  table.innerHTML = html + '</tbody>';
}

/* Télécharge les fiches ushl.ca de tous les joueurs de l'équipe affichée. */
async function telechargerFichesEquipe(){
  const btn = document.getElementById('btnRecFiches');
  btn.disabled = true;
  const code = document.getElementById('recEquipe').value;
  const manquants = joueursEquipe(code).filter(j=>!ETAT.fiches.has(normaliserNom(j.nom)));
  let faites = 0, lues = 0;
  await enParallele(manquants, 4, async j => {
    try { await chargerFiche(j.nom); lues++; } catch(e){ /* fiche injoignable : on continue */ }
    document.getElementById('recNote').textContent = `fiches ushl.ca : ${++faites}/${manquants.length}…`;
  });
  btn.disabled = false;
  rendreRecotes();
  flash(manquants.length && !lues
    ? 'Aucune fiche lue : les relais ne répondent pas, réessaie plus tard'
    : `Fiches de ${code} : ${lues} lue${lues>1?'s':''} sur ${manquants.length}`);
}
