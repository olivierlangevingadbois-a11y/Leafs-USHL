/* ---------- Bâtisseur de trios ----------
   Quatre trios (AG-C-AD), trois paires de défenseurs, deux gardiens.
   Persisté dans ce navigateur (clé → nom). Un joueur peut être placé hors
   de sa position naturelle : le doublon, lui, est signalé. */
const TRIOS_BLOCS = [
  {cle:'t1', titre:'Trio 1',  type:'F', postes:[['ag','AG'],['c','C'],['ad','AD']]},
  {cle:'t2', titre:'Trio 2',  type:'F', postes:[['ag','AG'],['c','C'],['ad','AD']]},
  {cle:'t3', titre:'Trio 3',  type:'F', postes:[['ag','AG'],['c','C'],['ad','AD']]},
  {cle:'t4', titre:'Trio 4',  type:'F', postes:[['ag','AG'],['c','C'],['ad','AD']]},
  {cle:'p1', titre:'Paire 1', type:'D', postes:[['dg','D gauche'],['dd','D droit']]},
  {cle:'p2', titre:'Paire 2', type:'D', postes:[['dg','D gauche'],['dd','D droit']]},
  {cle:'p3', titre:'Paire 3', type:'D', postes:[['dg','D gauche'],['dd','D droit']]},
  {cle:'g',  titre:'Gardiens',type:'G', postes:[['g1','Partant'],['g2','Auxiliaire']]},
  /* unités spéciales : un joueur peut y figurer en plus de son trio,
     mais pas deux fois dans la même famille d'unités */
  {cle:'an1', titre:'Avantage numérique 1', type:'X', postes:[['j1','Joueur 1'],['j2','Joueur 2'],['j3','Joueur 3'],['j4','Joueur 4'],['j5','Joueur 5']]},
  {cle:'an2', titre:'Avantage numérique 2', type:'X', postes:[['j1','Joueur 1'],['j2','Joueur 2'],['j3','Joueur 3'],['j4','Joueur 4'],['j5','Joueur 5']]},
  {cle:'in1', titre:'Infériorité numérique 1', type:'X', postes:[['j1','Joueur 1'],['j2','Joueur 2'],['j3','Joueur 3'],['j4','Joueur 4']]},
  {cle:'in2', titre:'Infériorité numérique 2', type:'X', postes:[['j1','Joueur 1'],['j2','Joueur 2'],['j3','Joueur 3'],['j4','Joueur 4']]}
];
/* Famille d'un bloc : les doublons ne sont signalés qu'à l'intérieur d'une
   même famille (5 contre 5, avantage numérique, infériorité). Le 4e trio est
   sa propre famille : la ligue permet le DOUBLE SHIFT — un joueur des trios
   1 à 3 peut reprendre sa place sur le 4e sans que ce soit un conflit
   (deux fois sur le 4e trio lui-même, par contre, reste signalé). */
function familleBloc(cle){
  if (cle === 't4') return 't4';
  return cle.startsWith('an') ? 'an' : (cle.startsWith('in') ? 'in' : 'ev');
}
function litTrios(){
  try { return JSON.parse(localStorage.getItem(CLES_LS.trios) || '{}'); }
  catch { return {}; }
}
function ecritTrios(t){ localStorage.setItem(CLES_LS.trios, JSON.stringify(t)); }
function joueursTrios(type){
  const js = ETAT.roster.filter(j=>!j.backup);
  if (type==='D') return js.filter(j=>j.po==='D');
  if (type==='G') return js.filter(j=>j.po==='G');
  if (type==='X') return js.filter(j=>j.po!=='G'); // unités spéciales : tous les patineurs
  return js.filter(j=>j.po!=='D' && j.po!=='G');
}
function rendreTrios(){
  const zone = document.getElementById('triosZone');
  if (!zone) return;
  const trios = litTrios();
  const usage = {ev:{}, t4:{}, an:{}, in:{}};
  for (const [slot, n] of Object.entries(trios)){
    if (!n) continue;
    const fam = familleBloc(slot.split('.')[0]);
    usage[fam][n] = (usage[fam][n]||0)+1;
  }
  let html = '';
  const remplis = {F:0, D:0, G:0, X:0};
  for (const bloc of TRIOS_BLOCS){
    const dispo = joueursTrios(bloc.type);
    const fam = familleBloc(bloc.cle);
    const ovs = [];
    let corps = '';
    for (const [pcle, plabel] of bloc.postes){
      const id = bloc.cle + '.' + pcle;
      const val = trios[id] || '';
      const jSel = dispo.find(j=>j.nom===val);
      if (jSel){ ovs.push(jSel.ov); remplis[bloc.type]++; }
      corps += `<div class="trio-slot"><span class="poste">${plabel}</span>
        <select data-slot="${id}" class="${!jSel?'vide':''}${jSel&&usage[fam][val]>1?' double':''}">
          <option value="">—</option>
          ${dispo.map(j=>`<option value="${echap(j.nom)}"${j.nom===val?' selected':''}>${echap(j.nom)} (${j.po} · OV ${j.ovEstime?'~':''}${j.ov})</option>`).join('')}
        </select></div>`;
    }
    const moy = ovs.length===bloc.postes.length ? (ovs.reduce((a,b)=>a+b,0)/ovs.length).toFixed(1) : null;
    html += `<div class="trio-bloc"><h3>${bloc.titre}${moy?`<span class="ovmoy">OV moyen ${moy}</span>`:''}</h3>${corps}</div>`;
  }
  zone.innerHTML = html;
  zone.querySelectorAll('select[data-slot]').forEach(sel=>{
    sel.addEventListener('change', ()=>{
      const t = litTrios();
      if (sel.value) t[sel.dataset.slot] = sel.value;
      else delete t[sel.dataset.slot];
      ecritTrios(t);
      rendreTrios();
    });
  });
  const doubles = [...new Set([].concat(...Object.values(usage).map(u=>Object.entries(u).filter(([,n])=>n>1).map(([n])=>n))))];
  document.getElementById('triosAlerte').textContent =
    doubles.length ? '⚠ Joueur utilisé plus d\'une fois dans une même famille d\'unités : ' + doubles.join(', ') : '';
  document.getElementById('triosEtat').textContent =
    `${remplis.F}/12 attaquants · ${remplis.D}/6 défenseurs · ${remplis.G}/2 gardiens · ${remplis.X}/18 unités spéciales`;
}
/* Remplissage automatique par OV : chaque trio reçoit le meilleur disponible
   à sa position naturelle (sinon le meilleur attaquant restant) ; les paires
   prennent les défenseurs par OV, lancer gauche à gauche quand possible. */
function autoTrios(){
  const t = {};
  const pool = type => joueursTrios(type).slice().sort((a,b)=>b.ov-a.ov);
  const restants = pool('F');
  const prend = pref => {
    let i = restants.findIndex(j=>j.po===pref);
    if (i < 0) i = 0;
    return restants.length ? restants.splice(i,1)[0] : null;
  };
  for (let l=1; l<=4; l++){
    for (const [pcle, pref] of [['c','C'],['ag','AG'],['ad','AD']]){
      const j = prend(pref);
      if (j) t[`t${l}.${pcle}`] = j.nom;
    }
  }
  const ds = pool('D');
  for (let p=1; p<=3 && ds.length; p++){
    const deux = ds.splice(0,2);
    deux.sort((a,b)=>(a.hd==='G'?0:1)-(b.hd==='G'?0:1));
    if (deux[0]) t[`p${p}.dg`] = deux[0].nom;
    if (deux[1]) t[`p${p}.dd`] = deux[1].nom;
  }
  const gs = pool('G');
  if (gs[0]) t['g.g1'] = gs[0].nom;
  if (gs[1]) t['g.g2'] = gs[1].nom;
  // unités spéciales : l'avantage numérique par le tir (SC), l'infériorité par le jeu défensif (DF)
  const patineurs = joueursTrios('X');
  const parSc = [...patineurs].sort((a,b)=>(b.sc??0)-(a.sc??0));
  const parDf = [...patineurs].sort((a,b)=>(b.df??0)-(a.df??0));
  for (let u=1; u<=2; u++){
    for (let s=1; s<=5; s++){
      const j = parSc[(u-1)*5 + (s-1)];
      if (j) t[`an${u}.j${s}`] = j.nom;
    }
    for (let s=1; s<=4; s++){
      const j = parDf[(u-1)*4 + (s-1)];
      if (j) t[`in${u}.j${s}`] = j.nom;
    }
  }
  ecritTrios(t);
  rendreTrios();
}
function texteTrios(){
  const t = litTrios();
  const nomOv = n => { const j = ETAT.roster.find(x=>x.nom===n); return j ? `${n} (${j.ov})` : n; };
  const slot = id => t[id] ? nomOv(t[id]) : '—';
  const l = [CONFIG.equipe + ' — trios'];
  for (let i=1; i<=4; i++) l.push(`Trio ${i} : ${slot('t'+i+'.ag')} — ${slot('t'+i+'.c')} — ${slot('t'+i+'.ad')}`);
  for (let i=1; i<=3; i++) l.push(`Paire ${i} : ${slot('p'+i+'.dg')} — ${slot('p'+i+'.dd')}`);
  l.push(`Gardiens : ${slot('g.g1')} / ${slot('g.g2')}`);
  for (let i=1; i<=2; i++) l.push(`AN ${i} : ${[1,2,3,4,5].map(s=>slot(`an${i}.j${s}`)).join(' — ')}`);
  for (let i=1; i<=2; i++) l.push(`IN ${i} : ${[1,2,3,4].map(s=>slot(`in${i}.j${s}`)).join(' — ')}`);
  return l.join('\n');
}
