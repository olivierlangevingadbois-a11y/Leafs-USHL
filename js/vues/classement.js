/* ---------- Classement de la ligue ----------
   Chaque page de ushl.ca affiche la fiche «ÉQUIPE V-D-N» de l'équipe
   consultée : on relève toutes les fiches présentes dans les pages en cache
   (formation, pointage, équipes consultées) et on les classe. */
function fichesConnues(){
  const cache = litCache();
  const textes = [];
  for (const k of ['roster','scoring']) if (cache[k]) textes.push(cache[k].v);
  for (const k of Object.keys(cache)) if (k.startsWith('equipe_')) textes.push(cache[k].v);
  const fiches = new Map();
  const mClub = ETAT.fiche.match(/(\d+)-(\d+)-(\d+)/);
  if (mClub) fiches.set(CONFIG.equipe, {w:+mClub[1], l:+mClub[2], t:+mClub[3]});
  for (const code of LIGUE_EQUIPES){
    if (fiches.has(code)) continue;
    const re = new RegExp(code.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\s+(\\d+)-(\\d+)-(\\d+)');
    for (const t of textes){
      const m = t.match(re);
      if (m){ fiches.set(code, {w:+m[1], l:+m[2], t:+m[3]}); break; }
    }
  }
  return fiches;
}
function rendreClassement(){
  const table = document.getElementById('tableClassement');
  if (!table) return;
  const fiches = fichesConnues();
  const lignes = [...fiches.entries()].map(([code, f])=>({
    code, ...f, pj: f.w+f.l+f.t, pts: 2*f.w + f.t
  })).sort((a,b)=> b.pts - a.pts || b.w - a.w || a.pj - b.pj);
  let html = '<thead><tr><th>Rang</th><th>Équipe</th><th>PJ</th><th>V</th><th>D</th><th>N</th><th>PTS</th></tr></thead><tbody>';
  lignes.forEach((l,i)=>{
    const club = l.code===CONFIG.equipe;
    html += `<tr${club?' style="background:rgba(77,159,255,.10)"':''}>
      <td>${i+1}</td><td class="${club?'eq-club':''}" style="text-align:left">${club?'<strong>':''}${l.code}${club?'</strong>':''}</td>
      <td>${l.pj}</td><td>${l.w}</td><td>${l.l}</td><td>${l.t}</td><td><strong>${l.pts}</strong></td></tr>`;
  });
  table.innerHTML = html + '</tbody>';
  document.getElementById('classEtat').textContent =
    `${fiches.size}/${LIGUE_EQUIPES.length} fiches connues` + (fiches.size<LIGUE_EQUIPES.length ? ' — consulte des équipes ou télécharge les fiches' : '');
}
/* Télécharge l'alignement à jour de chaque équipe (mis en cache 12 h) :
   remplit à la fois le classement, l'onglet Ligue, le comparateur, les
   recotes et l'échange avec les données du site. Séquentiel, avec
   progression. `etatId` désigne l'élément où afficher la progression. */
async function telechargerLigue(etatId, rafraichir){
  const boutons = [document.getElementById('btnFiches'), document.getElementById('btnLigueMaj')].filter(Boolean);
  boutons.forEach(b=>{ b.disabled = true; });
  const etat = document.getElementById(etatId);
  // le club du DG d'abord, relu du site : «toute la ligue» l'inclut
  if (etat) etat.textContent = `téléchargement de ${CONFIG.equipe}…`;
  try { await actualiserFormationClub(true); } catch(e){ /* formation conservée */ }
  const manquantes = LIGUE_EQUIPES.filter(c=>c!==CONFIG.equipe && !ETAT.equipesLive.has(c));
  let faites = 0;
  for (const code of manquantes){
    if (etat) etat.textContent = `téléchargement ${++faites}/${manquantes.length} (${code})…`;
    try { await chargerEquipe(code); } catch(e){ /* équipe injoignable : on continue */ }
    rafraichir();
  }
  boutons.forEach(b=>{ b.disabled = false; });
  toutRendre();   // l'alignement du club a pu changer
  rafraichir();
  const nb = equipesInstantane().length;
  flash(`Ligue actualisée : ${nb} équipe${nb>1?'s':''} enregistrée${nb>1?'s':''} au ${dateInstantane()} — ces chiffres deviennent la référence par défaut`);
}
function telechargerFiches(){ return telechargerLigue('classEtat', rendreClassement); }
