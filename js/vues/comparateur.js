/* ---------- Comparateur de joueurs ---------- */
const COTES_COMPARATEUR = [['it','IT — intensité'],['sp','SP — vitesse'],['st','ST — force'],
  ['en','EN — endurance'],['du','DU — robustesse'],['di','DI — discipline'],['sk','SK — coup de patin'],
  ['pa','PA — passes'],['pc','PC — contrôle'],['df','DF — jeu défensif'],['sc','SC — tir (OF)'],
  ['ex','EX — expérience'],['ld','LD — leadership'],['ov','OV — overall']];
function remplirJoueursComp(equipe, sel, rangDefaut){
  const joueurs = joueursEquipe(equipe);
  const avant = sel.value;
  sel.innerHTML = joueurs.map(j=>`<option value="${echap(j.nom)}">${echap(j.nom)} (${j.po} · OV ${j.ovEstime?'~':''}${j.ov})</option>`).join('');
  const tri = [...joueurs].sort((a,b)=>b.ov-a.ov);
  sel.value = joueurs.some(j=>j.nom===avant) ? avant : (tri[rangDefaut]?.nom ?? tri[0]?.nom);
}
function peuplerComparateur(){
  const selEqA = document.getElementById('compEqA'), selEqB = document.getElementById('compEqB');
  const selA = document.getElementById('compA'), selB = document.getElementById('compB');
  if (!selA) return;
  if (!selEqA.options.length){
    const opts = LIGUE_EQUIPES.map(e=>`<option value="${e}">${e}${e===CONFIG.equipe?' (mon club)':''}</option>`).join('');
    selEqA.innerHTML = opts; selEqB.innerHTML = opts;
    selEqA.value = CONFIG.equipe; selEqB.value = CONFIG.equipe;
  }
  remplirJoueursComp(selEqA.value, selA, 0);
  remplirJoueursComp(selEqB.value, selB, selEqB.value===selEqA.value ? 1 : 0);
}
function rendreComparateur(){
  const zone = document.getElementById('compZone');
  if (!zone) return;
  const eqA = document.getElementById('compEqA').value, eqB = document.getElementById('compEqB').value;
  const a = joueursEquipe(eqA).find(j=>j.nom===document.getElementById('compA').value);
  const b = joueursEquipe(eqB).find(j=>j.nom===document.getElementById('compB').value);
  if (!a || !b){ zone.innerHTML = ''; return; }
  a._equipe = eqA; b._equipe = eqB;
  const tete = (j, cote) => {
    const exact = ovExact(j);
    return `
    <div class="comp-tete ${cote}">
      <span class="nom">${echap(j.nom)}</span>
      <span class="comp-ov"${j.ovEstime?' title="OV estimé"':''}>${j.ovEstime?'~':''}${j.ov}${exact?` <small style="font-size:.85rem;color:var(--txt-dim)">(${exact})</small>`:''}</span>
      <span class="meta">${j._equipe} · ${j.po} · ${j.age} ans · ${j._profil.profil}</span>
      <span class="meta">${fmtArgent(j.salaire)} · CT ${j.ct ?? '—'} · ModA ${fmtMod(modA(j))}</span>
    </div>`;
  };
  let html = `<div class="comp-grille">${tete(a,'gauche')}<div class="comp-mid">·</div>${tete(b,'droite')}`;
  const centile = (j, cle) => {
    const p = percentileLigue(cle, j[cle], groupeDe(j));
    return p===null ? '' : ` title="${p}ᵉ centile des ${GROUPES_LIGUE[groupeDe(j)]}"${p>=90?' class="cent-top"':''}`;
  };
  for (const [cle, libelle] of COTES_COMPARATEUR){
    const va = a[cle], vb = b[cle];
    const gagneA = va!==null && (vb===null || va>=vb), gagneB = vb!==null && (va===null || vb>=va);
    const largeur = v => v===null ? 0 : Math.max(4, Math.min(100, (v-30)/(99-30)*100));
    html += `
      <div class="comp-val droite ${va!==null&&vb!==null&&va>vb?'gagne':''}">
        <div class="comp-barre gauche"><div class="r ${gagneA?'gagne':''}" style="width:${largeur(va).toFixed(1)}%"></div></div>
        <b${centile(a, cle)}>${va??'—'}</b>
      </div>
      <div class="comp-mid">${libelle}</div>
      <div class="comp-val ${va!==null&&vb!==null&&vb>va?'gagne':''}">
        <b${centile(b, cle)}>${vb??'—'}</b>
        <div class="comp-barre droite"><div class="r ${gagneB?'gagne':''}" style="width:${largeur(vb).toFixed(1)}%"></div></div>
      </div>`;
  }
  const statsDe = j => (j._profil.stats||[]).map(cle=>STATS_DEF[cle].nom).join(', ');
  const provenances = [...new Set([a, b].filter(j=>j._equipe !== CONFIG.equipe).map(j =>
    `${j._equipe} : ${provenanceDe(j)}`))];
  html += `<div class="comp-pied">
    Statistiques évaluées — ${echap(a.nom)} (${a._profil.profil}) : ${statsDe(a)}<br>
    Statistiques évaluées — ${echap(b.nom)} (${b._profil.profil}) : ${statsDe(b)}${
    provenances.length ? '<br>' + provenances.join(' · ') : ''}</div></div>`;
  zone.innerHTML = html;
}

/* ---------- Percentiles de la ligue ----------
   Situe une cote parmi tous les joueurs de la ligue à la même position
   (attaquants, défenseurs ou gardiens). Distributions mises en mémoire et
   recalculées quand des alignements en direct arrivent. */
let _distribsCache = null, _distribsStamp = '';
const COTES_CLES = ['it','sp','st','en','du','di','sk','pa','pc','df','sc','ex','ld'];
function distributionsLigue(){
  const stamp = ETAT.equipesLive.size + ':' + ETAT.roster.length;
  if (_distribsCache && _distribsStamp === stamp) return _distribsCache;
  const d = {F:{}, D:{}, G:{}};
  const cles = [...COTES_CLES, 'ov'];
  for (const j of joueursLigue()){
    const g = j.po==='D' ? 'D' : (j.po==='G' ? 'G' : 'F');
    for (const k of cles){
      const v = j[k];
      if (v===null || v===undefined) continue;
      (d[g][k] = d[g][k] || []).push(v);
    }
  }
  _distribsCache = d; _distribsStamp = stamp;
  return d;
}
function percentileLigue(cle, valeur, groupe){
  if (valeur===null || valeur===undefined) return null;
  const arr = distributionsLigue()[groupe]?.[cle];
  if (!arr || !arr.length) return null;
  let sous = 0, egaux = 0;
  for (const v of arr){ if (v < valeur) sous++; else if (v === valeur) egaux++; }
  return Math.round((sous + egaux/2) / arr.length * 100);
}
const GROUPES_LIGUE = {F:'attaquants de la ligue', D:'défenseurs de la ligue', G:'gardiens de la ligue'};
function groupeDe(j){ return j.po==='D' ? 'D' : (j.po==='G' ? 'G' : 'F'); }
