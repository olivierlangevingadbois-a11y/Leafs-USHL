/* ---------- Progression ---------- */
const BADGES_NIVEAUX = {
  memorable:'<span class="badge-etat memorable">Mémorable</span>',
  excellente:'<span class="badge-etat excellente">Excellente</span>',
  satisfaisante:'<span class="badge-etat satisfaisante">Satisfaisante</span>',
  correcte:'<span class="badge-etat correcte">Correcte</span>',
  decevante:'<span class="badge-etat decevante">Décevante</span>',
  oublier:'<span class="badge-etat oublier">À oublier</span>',
  sousmemo:'<span class="badge-etat sousmemo">Sous le Mémorable</span>',
  indef:'<span class="badge-etat indef">à définir</span>'
};
function fmtMod(v){ return v===null||v===undefined ? '—' : (v>0?'+':'')+v; }
function rendreProgression(){
  const matrices = chargerMatrices();
  const overrides = chargerOverrides();
  const grille = $('#progGrille');
  const ctx = {
    pmRangs: calculerPmRangs(ETAT.scoring.patineurs),
    limites: ETAT.limites
  };
  let html = '';
  for (const j of ETAT.roster){
    const p = j._profil;
    const prod = productionDe(j);
    const grpF = j.po==='G'?'g':(j.po==='D'?'d':'av');
    const evals = p.stats.map(cle=>{
      const brute = valeurStat(j, prod, cle, ctx);
      const s = seuilsPour(j, cle, matrices, overrides);
      const ev = evaluerStat(cle, brute, s.seuils);
      return {cle, ev, source:s.source};
    });
    const nbMemo = evals.filter(e=>e.ev.statut==='memorable').length;
    const nbDiff = evals.filter(e=>e.ev.statut==='decevante'||e.ev.statut==='oublier').length;
    const f = ETAT.filtreProg;
    if (f==='av'&&grpF!=='av') continue;
    if (f==='d'&&grpF!=='d') continue;
    if (f==='g'&&grpF!=='g') continue;
    if (f==='memo'&&nbMemo===0) continue;
    if (f==='difficulte'&&nbDiff===0) continue;

    const mods = modsEstime(evals);
    const four = fourchetteRecote(j, mods);
    const tag = j.po==='G' ? 'g-tag' : (j.po==='D' ? 'd-tag' : '');
    html += `<div class="joueur-carte" data-grp="${grpF}">
      <div class="jc-tete">
        <span class="jc-nom">${echap(j.nom)}</span>
        <span class="profil-tag ${tag}">${p.profil}</span>
        <span class="jc-meta">${j.age} ans · OV ${j.ov}<br>${fmtArgent(j.salaire)} · ${j.ct} an${j.ct>1?'s':''}</span>
      </div>
      <div class="jc-mods">ModA ${fmtMod(modA(j))} · ModS estimé <b>${fmtMod(mods)}</b>${mods!==null?` · Recote probable des cotes-clés : <b>${fmtMod(four.min)}</b> à <b>${fmtMod(four.max)}</b>`:''}</div>
      <div class="jc-corps">`;
    for (const {cle, ev} of evals){
      const def = STATS_DEF[cle];
      const cleJoueur = normaliserNom(j.nom);
      const seuils = ev.seuils;
      const memoSeuil = seuils ? seuils[0] : null;
      // barre : échelle linéaire de Décevante (10 %) à Mémorable (90 %)
      let pctBarre = 0, jalons = '';
      if (seuils && ev.valeur!==null && isFinite(ev.valeur)
          && memoSeuil!==null && seuils[4]!==null && memoSeuil>seuils[4]){
        const dec = seuils[4], memo = memoSeuil;
        const pos = v => 10 + 80*Math.max(0, Math.min(1, (v-dec)/(memo-dec)));
        pctBarre = pos(ev.valeur);
        jalons = [1,2,3].map(i=> seuils[i]!==null?`<div class="jalon" style="left:${pos(seuils[i]).toFixed(1)}%" title="${NIVEAUX[i].nom} : ${fmtStat(cle,seuils[i])}"></div>`:'').join('')
               + `<div class="jalon memo" style="left:90%" title="Mémorable : ${fmtStat(cle,memo)}"></div>`;
      } else if (ev.valeur!==null && memoSeuil!==null && memoSeuil>0){
        pctBarre = Math.max(0, Math.min(100, ev.valeur/memoSeuil*90));
        jalons = `<div class="jalon memo" style="left:90%" title="Mémorable : ${fmtStat(cle,memoSeuil)}"></div>`;
      }
      let detailRang = '';
      if (cle==='pmrang'){
        const r = ctx.pmRangs.get(normaliserNom(j.nom));
        if (r) detailRang = ` <span class="att">(${r.rang}ᵉ/${r.total} · ${r.pm>0?'+':''}${r.pm})</span>`;
      }
      html += `<div class="stat-ligne">
        <div class="sl-tete">
          <span class="nom-stat">${def.nom}${BADGES_NIVEAUX[ev.statut]||''}</span>
          <span class="valeurs">
            ${ev.valeur!==null?fmtStat(cle,ev.valeur):'—'}${detailRang}
            <span class="att"> / Mémorable </span>
            <input class="att-input" type="number" step="any" data-joueur="${cleJoueur}" data-stat="${cle}"
              value="${memoSeuil!==null?memoSeuil:''}" placeholder="—" title="Seuil Mémorable ${def.nom} — modifiable (à dépasser strictement)">
          </span>
        </div>
        <div class="barre">
          ${jalons}
          <div class="rempli ${ev.statut==='memorable'?'memo':''}" style="width:${pctBarre.toFixed(1)}%"></div>
        </div>
      </div>`;
    }
    html += `</div>`;
    if (prod && prod._reference){
      html += `<div class="jc-note">Repère : saison précédente complète (aucun match encore disputé cette saison). Les barres reflètent ces totaux face aux seuils actuels.</div>`;
    } else if (prod && prod.mp === null && j.po !== 'G' && (j._profil.stats||[]).some(c=>['mp','mg','hits20','shots20'].includes(c))){
      html += `<div class="jc-note">Minutes jouées indisponibles pour le moment (page XtraStats) : les statistiques par 20 minutes ne peuvent pas être évaluées.</div>`;
    }
    if (!prod){
      html += `<div class="jc-note">Aucune production disponible pour ce joueur.</div>`;
    }
    html += `</div>`;
  }
  grille.innerHTML = html || '<p style="color:var(--txt-faint)">Aucun joueur ne correspond au filtre.</p>';
  grille.querySelectorAll('.att-input').forEach(inp=>{
    inp.addEventListener('change', ()=>{
      const o = chargerOverrides();
      const cleJ = inp.dataset.joueur, cleS = inp.dataset.stat;
      if (!o[cleJ]) o[cleJ] = {};
      if (inp.value==='') delete o[cleJ][cleS];
      else o[cleJ][cleS] = Number(inp.value);
      sauverOverrides(o);
      flash('Cible Mémorable enregistrée');
      rendreProgression();
    });
  });
}
