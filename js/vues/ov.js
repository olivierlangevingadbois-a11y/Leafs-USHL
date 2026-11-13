/* ------------------ CALCULATEUR OV DÉTAILLÉ ------------------
   Pondérations calibrées par programme linéaire sur les rosters complets de la
   ligue (26 équipes, recote du 8 juillet 2026) et sur les 17 OV détaillés de
   référence produits par la fonction overall() du classeur Excel.
   Validation : 17/17 références au centième (±0,005), 697/697 arrondis de la
   ligue du 8 juillet. L'OV des patineurs des données de secours du club est
   d'ailleurs calculé par cette même formule à partir des cotes des fichiers
   FHL de la ligue. Les défenseurs utilisent deux pondérations :
   offensive lorsque PA + SC ≥ DF + ST, défensive sinon. Les gardiens ont une
   formule distincte (50 partout → 48, contre 55 chez les patineurs) qui n'est
   pas couverte ici. Ordre des cotes : IN SP ST EN DU DI SK PA PC DF OF EX LD. */
const OV_ORDRE = ['it','sp','st','en','du','di','sk','pa','pc','df','sc','ex','ld'];
const OV_POIDS = {
  F:     {w:[0.073423,0.072584,0.102613,0.043094,0.015318,0.014931,0.090409,0.147233,0.116690,0.102606,0.191218,0.014681,0.014822], cst:4.530845},
  D_OFF: {w:[0.071201,0.160040,0.065793,0.050580,-0.001963,-0.003945,0.095153,0.168552,0.122700,0.086797,0.158935,0.013673,0.018993], cst:4.177806},
  D_DEF: {w:[0.118770,0.077492,0.147627,0.043248,0.014035,0.015385,0.087341,0.118938,0.088093,0.193175,0.073577,0.015078,0.013870], cst:4.016048}
};
function ovDetaille(cotes, groupe){
  /* cotes : objet portant it, sp, st, en, du, di, sk, pa, pc, df, sc, ex, ld.
     groupe : 'F' (attaquant) ou 'D' (défenseur).
     Retourne {valeur, arrondi, formule} ou null si une cote est absente
     ou non numérique (cas des gardiens : df et sc à null). */
  if (OV_ORDRE.some(k => cotes[k] === null || cotes[k] === undefined || isNaN(cotes[k]))) return null;
  let jeu, formule;
  if (groupe === 'D'){
    const offensif = (cotes.pa + cotes.sc) >= (cotes.df + cotes.st);
    jeu = offensif ? OV_POIDS.D_OFF : OV_POIDS.D_DEF;
    formule = offensif ? 'défenseur offensif (PA + OF ≥ DF + ST)'
                       : 'défenseur défensif (PA + OF < DF + ST)';
  } else {
    jeu = OV_POIDS.F;
    formule = 'attaquant';
  }
  const valeur = OV_ORDRE.reduce((s,k,i) => s + jeu.w[i]*cotes[k], jeu.cst);
  return {valeur, arrondi: Math.round(valeur), formule};
}

const OVD_LIBELLES = {it:'IN', sp:'SP', st:'ST', en:'EN', du:'DU', di:'DI', sk:'SK',
                      pa:'PA', pc:'PC', df:'DF', sc:'OF', ex:'EX', ld:'LD'};
function peuplerJoueursOvd(){
  const sel = document.getElementById('ovdJoueur');
  const selEq = document.getElementById('ovdEquipe');
  if (!sel) return;
  if (!selEq.options.length){
    selEq.innerHTML = LIGUE_EQUIPES.map(e=>`<option value="${e}">${e}${e===CONFIG.equipe?' (mon club)':''}</option>`).join('');
    selEq.value = CONFIG.equipe;
  }
  const courant = sel.value;
  const patineurs = joueursEquipe(selEq.value).filter(j => j.po !== 'G');
  sel.innerHTML = '<option value="">— saisie manuelle —</option>' +
    patineurs.map(j => `<option value="${echap(j.nom)}">${echap(j.nom)} (${j.po} · OV ${j.ov})</option>`).join('');
  if (courant && patineurs.some(j => j.nom === courant)) sel.value = courant;
}
function chargerJoueurOvd(){
  const nom = document.getElementById('ovdJoueur').value;
  if (!nom) return;
  const j = joueursEquipe(document.getElementById('ovdEquipe').value).find(x => x.nom === nom);
  if (!j) return;
  document.getElementById('ovdGroupe').value = (j.po === 'D') ? 'D' : 'F';
  document.getElementById('ovdAge').value = j.age ?? 25;
  OV_ORDRE.forEach(k => { document.getElementById('ovd_' + k).value = j[k]; });
  calculerOvd();
}

/* ------------------ PROFIL ET PERMUTATIONS DE COTES ------------------
   Les cotes se déplacent par catégorie (règle de la ligue) : les points
   retirés à une cote reviennent à une autre cote DE LA MÊME CATÉGORIE. */
const CATEGORIES_COTES = {
  A: ['sp','st','en','du','sk'],
  B: ['pa','pc','df','sc'],
  C: ['it','di','ex','ld']
};
/* Profil d'un jeu de cotes : l'overall vient de la formule détaillée, la
   catégorie d'âge des règlements (junior ≤20, prospect ≤24, pro ensuite). */
function profilDeCotes(cotes, groupe, age){
  const r = ovDetaille(cotes, groupe);
  if (!r) return null;
  const j = Object.assign({}, cotes, {ov: r.arrondi, po: groupe === 'D' ? 'D' : 'C', age: age ?? 25});
  const p = determinerProfil(j);
  return {profil: p.profil, mat: p.mat, stats: p.stats, ov: r.arrondi, ovExact: r.valeur};
}
/* Vecteurs de transfert d'une catégorie : somme nulle, `cout` points déplacés.
   Chaque cote reste dans 1..99. */
function transfertsCategorie(cles, cout){
  const out = [];
  const deltas = new Array(cles.length).fill(0);
  (function poser(i, restePlus, resteMoins){
    if (i === cles.length){
      if (restePlus === 0 && resteMoins === 0) out.push(deltas.slice());
      return;
    }
    const max = Math.min(restePlus, cout), min = -Math.min(resteMoins, cout);
    for (let d = min; d <= max; d++){
      deltas[i] = d;
      poser(i + 1, restePlus - Math.max(0, d), resteMoins - Math.max(0, -d));
    }
    deltas[i] = 0;
  })(0, cout, cout);
  return out.filter(v => v.some(d => d !== 0));
}
/* Profils atteignables en déplaçant au plus `maxPoints` points dans UNE
   catégorie. Retourne une entrée par profil différent, la moins coûteuse. */
function permutationsProfil(cotes, groupe, age, maxPoints){
  const base = profilDeCotes(cotes, groupe, age);
  if (!base) return {base: null, options: []};
  const trouves = new Map();
  for (let cout = 1; cout <= (maxPoints || 3); cout++){
    for (const [cat, cles] of Object.entries(CATEGORIES_COTES)){
      for (const vec of transfertsCategorie(cles, cout)){
        const essai = Object.assign({}, cotes);
        let valide = true;
        cles.forEach((k, i)=>{
          const v = (cotes[k] ?? 0) + vec[i];
          if (v < 1 || v > 99) valide = false;
          essai[k] = v;
        });
        if (!valide) continue;
        const p = profilDeCotes(essai, groupe, age);
        if (!p || p.profil === base.profil) continue;
        const deja = trouves.get(p.profil);
        if (deja && deja.cout <= cout) continue;
        trouves.set(p.profil, {
          profil: p.profil, mat: p.mat, cout, categorie: cat,
          mouvement: cles.map((k,i)=>({cle:k, delta:vec[i]})).filter(m=>m.delta !== 0),
          ov: p.ov, ovExact: p.ovExact, dOv: p.ovExact - base.ovExact, cotes: essai
        });
      }
    }
  }
  const options = [...trouves.values()].sort((a,b)=> a.cout - b.cout || b.dOv - a.dOv);
  return {base, options};
}

function calculerOvd(){
  const cotes = {};
  OV_ORDRE.forEach(k => { cotes[k] = parseFloat(document.getElementById('ovd_' + k).value); });
  const groupe = document.getElementById('ovdGroupe').value;
  const age = parseInt(document.getElementById('ovdAge').value, 10) || 25;
  const r = ovDetaille(cotes, groupe);
  const elV = document.getElementById('ovdValeur');
  const elA = document.getElementById('ovdArrondi');
  const elN = document.getElementById('ovdNote');
  const elP = document.getElementById('ovdProfil');
  const elPL = document.getElementById('ovdProfilLib');
  const elPerm = document.getElementById('ovdPermut');
  if (!r){
    elV.textContent = '—'; elA.textContent = '—'; elP.textContent = '—';
    elPL.textContent = 'Profil';
    elN.textContent = 'Complète les 13 cotes (valeurs numériques) pour obtenir l\'OV détaillé.';
    elPerm.innerHTML = '';
    return;
  }
  elV.textContent = r.valeur.toFixed(2).replace('.', ',');
  elA.textContent = String(r.arrondi);
  elN.textContent = 'Formule ' + r.formule + '. L\'OV affiché sur ushl.ca est l\'arrondi au plus proche de l\'OV détaillé.';
  const base = profilDeCotes(cotes, groupe, age);
  elP.textContent = base.profil;
  elPL.textContent = 'Profil · ' + (age <= 20 ? 'junior' : (age <= 24 ? 'prospect' : 'pro')) + ' · matrice ' + base.mat;
  // permutations
  const maxPts = Math.max(1, Math.min(6, parseInt(document.getElementById('ovdPoints').value, 10) || 3));
  const {options} = permutationsProfil(cotes, groupe, age, maxPts);
  if (!options.length){
    elPerm.innerHTML = `<p class="permut-vide">Aucun changement de profil en déplaçant jusqu'à ${maxPts} point${maxPts>1?'s':''} à l'intérieur d'une catégorie — le profil <strong>${echap(base.profil)}</strong> est stable.</p>`;
    return;
  }
  elPerm.innerHTML = '<div class="permut-liste">' + options.map(o=>{
    const move = o.mouvement.map(m=>
      `<span class="${m.delta<0?'moins':'plus'}">${OVD_LIBELLES[m.cle]} ${m.delta>0?'+':''}${m.delta}</span>`).join(' · ');
    const dov = o.dOv >= 0 ? '+' + o.dOv.toFixed(2).replace('.',',') : o.dOv.toFixed(2).replace('.',',');
    return `<div class="permut-carte">
      <div class="pc-tete"><span class="pc-profil">${echap(o.profil)}</span>
        <span class="pc-cout">${o.cout} pt${o.cout>1?'s':''} · catégorie ${o.categorie}</span></div>
      <div class="pc-move">${move}</div>
      <div class="pc-ov">OV ${o.ov} (${dov}) · matrice ${o.mat}</div>
    </div>`;
  }).join('') + '</div>';
}
function construireOvd(){
  const grille = document.getElementById('ovdGrille');
  if (!grille) return;
  grille.innerHTML = OV_ORDRE.map(k =>
    `<div class="ovd-cote"><span>${OVD_LIBELLES[k]}</span>
     <input type="number" min="1" max="99" step="1" id="ovd_${k}" value="75"></div>`).join('');
  OV_ORDRE.forEach(k => document.getElementById('ovd_' + k).addEventListener('input', calculerOvd));
  document.getElementById('ovdGroupe').addEventListener('change', calculerOvd);
  document.getElementById('ovdAge').addEventListener('input', calculerOvd);
  document.getElementById('ovdPoints').addEventListener('input', calculerOvd);
  document.getElementById('ovdJoueur').addEventListener('change', chargerJoueurOvd);
  document.getElementById('ovdEquipe').addEventListener('change', ()=>{
    document.getElementById('ovdJoueur').value = '';
    peuplerJoueursOvd();
  });
  peuplerJoueursOvd();
  calculerOvd();
}
