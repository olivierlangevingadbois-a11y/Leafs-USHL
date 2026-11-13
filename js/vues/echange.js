/* ---------- Analyseur d'échange ----------
   Brouillon en mémoire : sortants (du club) et entrants (de n'importe quelle
   équipe). L'impact réutilise la logique de la projection du plafond :
   contrat effectif = prolongation enregistrée pour un contrat échu, sinon
   salaire × CT. */
const ECHANGE = {sortants: [], entrants: []};
/* Bascule «re-signé» : on ne peut PAS re-signer un joueur encore sous
   contrat — la re-signature standard s'enchaîne donc À L'ÉCHÉANCE de son
   contrat actuel : ses années restantes comptent à son salaire réel, puis
   la valeur standard de la charte prend le relais (statut déduit de son âge
   AU MOMENT de la re-signature, 3 ans pour un RFA, durée max sinon). */
function resignatureStandard(j){
  const reste = j.ct || 0;
  const ageRe = (j.age || 0) + reste;
  const st = statutResignature({age: ageRe});
  const duree = st === 'RFA' ? 3 : dureeMaxCharte(st);
  return {st, duree, apres: reste, salaire: salaireMinimum(j.ov, st, ageRe, duree, j.po) || 0};
}
/* Salaire comptant au plafond pour la saison k (0 = Y22) d'un joueur de
   l'échange, contrat réel d'abord, re-signature standard ensuite si cochée. */
function salaireSaisonEchange(j, k){
  const reste = j.ct || 0;
  if (k < reste) return j.salaire || 0;
  if (j._resigner){
    const rs = resignatureStandard(j);
    if (k < reste + rs.duree) return rs.salaire;
  }
  return 0;
}
/* OV exact (deux décimales) d'un patineur, par la formule du calculateur.
   Les pondérations (OV_ORDRE, OV_POIDS) sont déclarées plus bas dans le
   fichier : au tout premier rendu de l'initialisation elles n'existent pas
   encore — on répond null et le rendu suivant complète. */
function ovExact(j){
  if (j.po === 'G') return null;
  try {
    const r = ovDetaille(j, j.po === 'D' ? 'D' : 'F');
    return r ? r.valeur.toFixed(2).replace('.', ',') : null;
  } catch (e){ return null; }
}
function projectionEchange(sortants, entrants, nbSaisons){
  const r = litResignatures();
  const exclus = new Set(sortants.map(j=>normaliserNom(j.nom)));
  const rangees = [];
  for (let k = 0; k < (nbSaisons || 3); k++){
    let masse = 0;
    for (const j of ETAT.roster){
      if (j.backup || exclus.has(normaliserNom(j.nom))) continue;
      const sig = (j.ct === 0) ? r[normaliserNom(j.nom)] : null;
      if (sig){
        if (k < (sig.duree || dureeMaxCharte(sig.statut))) masse += sig.salaire;
      } else {
        // un joueur du club basculé «re-signé» (dans les sortants du brouillon,
        // donc exclu ici — ou pas) compte sa chaîne contrat réel → charte
        masse += salaireSaisonEchange(j, k);
      }
    }
    for (const j of entrants) masse += salaireSaisonEchange(j, k);
    rangees.push({saison: 'Y' + (22 + k), masse, marge: PLAFOND - masse});
  }
  return rangees;
}
/* Moyennes du club (OV, âge) pour un état donné de l'échange. */
function bilanClub(sortants, entrants){
  const exclus = new Set(sortants.map(j=>normaliserNom(j.nom)));
  const joueurs = ETAT.roster.filter(j=>!j.backup && !exclus.has(normaliserNom(j.nom))).concat(entrants);
  const n = joueurs.length || 1;
  return {
    n: joueurs.length,
    ov: joueurs.reduce((s,j)=>s+(j.ov||0),0)/n,
    age: joueurs.reduce((s,j)=>s+(j.age||0),0)/n
  };
}
function chipEchange(j, camp){
  const exact = ovExact(j);
  const reel = `${fmtArgentCourt(j.salaire)} × ${j.ct ?? 0} an${(j.ct??0)>1?'s':''}`;
  let contratTexte = reel;
  if (j._resigner){
    const rs = resignatureStandard(j);
    const chaine = `<b>${rs.st} ${fmtArgentCourt(rs.salaire)} × ${rs.duree} an${rs.duree>1?'s':''}</b>`;
    contratTexte = rs.apres > 0 ? `${reel} puis ${chaine}` : chaine;
  }
  return `<span class="ech-chip${j._resigner?' resigner':''}">${echap(j.nom)} (${j.po})
    <span class="det">OV ${j.ovEstime?'~':''}${j.ov}${exact?` (${exact})`:''} · ${contratTexte}</span>
    <label class="ech-resign" title="À l'échéance de son contrat actuel, enchaîner une re-signature à la valeur standard de la charte (statut déduit de son âge à ce moment). Ses années restantes comptent à son salaire réel — on ne re-signe pas un joueur encore sous contrat.">
      <input type="checkbox" data-resign-camp="${camp}" data-nom="${echap(j.nom)}"${j._resigner?' checked':''}> re-signé ensuite</label>
    <button data-camp="${camp}" data-nom="${echap(j.nom)}" title="Retirer">×</button></span>`;
}
function rendreEchange(){
  const selS = document.getElementById('echSortant');
  if (!selS) return;
  const selEq = document.getElementById('echEquipe'), selE = document.getElementById('echEntrant');
  if (!selEq.options.length){
    selEq.innerHTML = LIGUE_EQUIPES.filter(e=>e!==CONFIG.equipe).map(e=>`<option value="${e}">${e}</option>`).join('');
  }
  const dansListe = (liste, nom) => liste.some(j=>j.nom===nom);
  selS.innerHTML = joueursEquipe(CONFIG.equipe).filter(j=>!dansListe(ECHANGE.sortants, j.nom))
    .map(j=>`<option value="${echap(j.nom)}">${echap(j.nom)} (${j.po} · OV ${j.ov} · ${fmtArgentCourt(j.salaire)})</option>`).join('');
  selE.innerHTML = joueursEquipe(selEq.value).filter(j=>!dansListe(ECHANGE.entrants, j.nom))
    .map(j=>`<option value="${echap(j.nom)}">${echap(j.nom)} (${j.po} · OV ${j.ovEstime?'~':''}${j.ov} · ${fmtArgentCourt(j.salaire)})</option>`).join('');
  document.getElementById('echSortants').innerHTML = ECHANGE.sortants.length
    ? ECHANGE.sortants.map(j=>chipEchange(j,'s')).join('') : '<span class="ech-vide">Personne pour l\'instant.</span>';
  document.getElementById('echEntrants').innerHTML = ECHANGE.entrants.length
    ? ECHANGE.entrants.map(j=>chipEchange(j,'e')).join('') : '<span class="ech-vide">Personne pour l\'instant.</span>';
  document.querySelectorAll('.ech-liste button[data-camp]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const liste = b.dataset.camp==='s' ? ECHANGE.sortants : ECHANGE.entrants;
      const i = liste.findIndex(j=>j.nom===b.dataset.nom);
      if (i>=0){ liste[i]._resigner = false; liste.splice(i,1); }
      rendreEchange();
    });
  });
  document.querySelectorAll('.ech-liste input[data-resign-camp]').forEach(chk=>{
    chk.addEventListener('change', ()=>{
      const liste = chk.dataset.resignCamp==='s' ? ECHANGE.sortants : ECHANGE.entrants;
      const j = liste.find(x=>x.nom===chk.dataset.nom);
      if (j){ j._resigner = chk.checked; rendreEchange(); }
    });
  });
  // impact
  const actif = ECHANGE.sortants.length || ECHANGE.entrants.length;
  const avant = projectionEchange([], [], 3);
  const apres = projectionEchange(ECHANGE.sortants, ECHANGE.entrants, 3);
  const bAvant = bilanClub([], []), bApres = bilanClub(ECHANGE.sortants, ECHANGE.entrants);
  const delta = apres[0].masse - avant[0].masse;
  // OV et âge échangés : total d'OV et moyenne d'âge qui partent vs arrivent
  const somme = (liste, cle) => liste.reduce((s,j)=>s+(j[cle]||0), 0);
  const moyenne = (liste, cle) => liste.length ? (somme(liste, cle)/liste.length).toFixed(1).replace('.',',') : '—';
  const ovOut = somme(ECHANGE.sortants,'ov'), ovIn = somme(ECHANGE.entrants,'ov');
  const dOv = ovIn - ovOut;
  const moyAgeOut = moyenne(ECHANGE.sortants,'age'), moyAgeIn = moyenne(ECHANGE.entrants,'age');
  const dAge = (ECHANGE.entrants.length ? somme(ECHANGE.entrants,'age')/ECHANGE.entrants.length : 0)
             - (ECHANGE.sortants.length ? somme(ECHANGE.sortants,'age')/ECHANGE.sortants.length : 0);
  document.getElementById('echSommaire').innerHTML = !actif ? '' : `
    <div class="stat-carte ${apres[0].masse>PLAFOND?'alerte':''}">
      <div class="lbl">Masse Y22 après l'échange</div>
      <div class="val">${fmtArgent(apres[0].masse)}</div>
      <div class="det">${delta>=0?'+':''}${fmtArgent(delta)} · marge ${fmtArgent(apres[0].marge)}</div></div>
    <div class="stat-carte"><div class="lbl">OV moyen du club</div>
      <div class="val">${bApres.ov.toFixed(1)}</div>
      <div class="det">avant : ${bAvant.ov.toFixed(1)} (${(bApres.ov-bAvant.ov)>=0?'+':''}${(bApres.ov-bAvant.ov).toFixed(2)})</div></div>
    <div class="stat-carte"><div class="lbl">Âge moyen</div>
      <div class="val">${bApres.age.toFixed(1)}</div>
      <div class="det">avant : ${bAvant.age.toFixed(1)}</div></div>
    <div class="stat-carte ${dOv>0?'':'orange'}"><div class="lbl">OV gagné / perdu</div>
      <div class="val">${dOv>0?'+':''}${dOv}</div>
      <div class="det">sortants ${ovOut} · entrants ${ovIn}</div></div>
    <div class="stat-carte"><div class="lbl">Âge gagné / perdu</div>
      <div class="val">${dAge>0?'+':''}${dAge.toFixed(1).replace('.',',')}</div>
      <div class="det">moy. sortants ${moyAgeOut} · entrants ${moyAgeIn}</div></div>
    <div class="stat-carte orange"><div class="lbl">Effectif</div>
      <div class="val">${bApres.n}</div>
      <div class="det">${ECHANGE.sortants.length} départ${ECHANGE.sortants.length>1?'s':''} · ${ECHANGE.entrants.length} arrivée${ECHANGE.entrants.length>1?'s':''}</div></div>`;
  let html = '';
  if (actif){
    html = `<thead><tr><th>Saison</th><th>Masse avant</th><th>Masse après</th><th>Écart</th><th>Marge après (104 M$)</th></tr></thead><tbody>`;
    for (let k=0;k<3;k++){
      const d = apres[k].masse - avant[k].masse;
      html += `<tr class="${apres[k].masse>PLAFOND?'depasse':''}"><td><strong>${apres[k].saison}</strong></td>
        <td>${fmtArgent(avant[k].masse)}</td><td>${fmtArgent(apres[k].masse)}</td>
        <td>${d>=0?'+':''}${fmtArgent(d)}</td><td>${fmtArgent(apres[k].marge)}</td></tr>`;
    }
    html += '</tbody>';
  }
  document.getElementById('tableEchange').innerHTML = html;
  document.getElementById('echTableWrap').style.display = actif ? '' : 'none';
}
