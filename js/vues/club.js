/* ---------- Bureau du DG : les urgences en tête de l'alignement ----------
   Rassemble ce qu'un DG doit voir sans fouiller : plafond, contrats échus,
   contrats qui expirent, joueurs sous les attentes et gardiens qui
   approchent leur limite de parties (punitions de la ligue à la clé). */
function alertesDG(){
  const alertes = [];
  const resign = litResignatures();
  const actifs = ETAT.roster;
  const {masse, cap} = calculerMasse(resign);
  if (masse > cap){
    alertes.push({niveau:'rouge', texte:`<b>Plafond dépassé</b> de ${fmtArgent(masse-cap)} — la ligue ne validera pas l'alignement.`});
  } else if (cap - masse < 2000000){
    alertes.push({niveau:'jaune', texte:`<b>Marge mince sous le plafond</b> : ${fmtArgent(cap-masse)}.`});
  }
  const echus = actifs.filter(j=>j.ct===0 && !resign[normaliserNom(j.nom)]);
  if (echus.length){
    alertes.push({niveau:'rouge', texte:`<b>${echus.length} contrat${echus.length>1?'s':''} échu${echus.length>1?'s':''} sans prolongation</b> : ${echus.map(j=>echap(j.nom)).join(', ')} — règle la situation dans la colonne Re-signer.`});
  }
  const transferts = litTransferts();
  if (transferts.length){
    alertes.push({niveau:'info', texte:`<b>${transferts.length} transfert${transferts.length>1?'s':''} local${transferts.length>1?'aux':''} actif${transferts.length>1?'s':''}</b> (${transferts.map(t=>echap(t.nom)).join(', ')}) — retire-le${transferts.length>1?'s':''} quand la ligue aura traité l'échange.`});
  }
  const expirants = actifs.filter(j=>j.ct===1);
  if (expirants.length){
    alertes.push({niveau:'info', texte:`<b>${expirants.length} contrat${expirants.length>1?'s':''}</b> expire${expirants.length>1?'nt':''} à la fin de la saison — planifie les re-signatures (Mon club → Plafond).`});
  }
  // gardiens : limite de parties (limites.json + parties jouées de la saison)
  for (const g of actifs.filter(j=>j.po==='G')){
    const lim = ETAT.limites.get(normaliserNom(g.nom));
    const prod = productionDe(g);
    if (!lim || !prod || !prod.gp || prod._reference) continue;
    if (prod.gp >= lim){
      alertes.push({niveau:'rouge', texte:`<b>${echap(g.nom)} a atteint sa limite de parties</b> (${prod.gp}/${lim}) — chaque départ de plus expose le club aux sanctions.`});
    } else if (prod.gp / lim >= 0.85){
      alertes.push({niveau:'jaune', texte:`<b>${echap(g.nom)} approche sa limite</b> : ${prod.gp}/${lim} parties (${Math.round(prod.gp/lim*100)} %).`});
    }
  }
  // joueurs sous les attentes (au moins une statistique Décevante ou À oublier)
  if (ETAT.scoring.patineurs.length || ETAT.scoring.gardiens.length){
    const matrices = chargerMatrices(), overrides = chargerOverrides();
    const ctx = {pmRangs: calculerPmRangs(ETAT.scoring.patineurs), limites: ETAT.limites};
    const enDifficulte = [];
    for (const j of actifs){
      const prod = productionDe(j);
      if (!prod || prod._reference) continue;
      const mauvaises = (j._profil.stats||[]).some(cle=>{
        const ev = evaluerStat(cle, valeurStat(j, prod, cle, ctx), seuilsPour(j, cle, matrices, overrides).seuils);
        return ev.statut==='decevante' || ev.statut==='oublier';
      });
      if (mauvaises) enDifficulte.push(j.nom);
    }
    if (enDifficulte.length){
      const noms = enDifficulte.slice(0,4).map(echap).join(', ') + (enDifficulte.length>4 ? '…' : '');
      alertes.push({niveau:'jaune', texte:`<b>${enDifficulte.length} joueur${enDifficulte.length>1?'s':''} sous les attentes</b> (statut Décevante ou pire) : ${noms} — voir l'onglet Progression, filtre «En difficulté».`});
    }
  }
  return alertes;
}
function rendreAlertes(){
  const zone = document.getElementById('alertesDG');
  if (!zone) return;
  zone.innerHTML = alertesDG().map(a=>`<div class="alerte-ligne ${a.niveau}">${a.texte}</div>`).join('');
}

/* ---------- Transferts locaux (repli sous la formation) ---------- */
function rendreTransferts(){
  const selDe = document.getElementById('transfDe');
  if (!selDe) return;
  const selVers = document.getElementById('transfVers');
  const opts = LIGUE_EQUIPES.map(e=>`<option value="${e}">${e}${e===CONFIG.equipe?' (mon club)':''}</option>`).join('');
  const deAv = selDe.value, versAv = selVers.value;
  if (!selDe.options.length){ selDe.innerHTML = opts; selVers.innerHTML = opts; }
  selDe.value = deAv || LIGUE_EQUIPES.find(e=>e!==CONFIG.equipe);
  selVers.value = versAv || CONFIG.equipe;
  const selJ = document.getElementById('transfJoueur');
  const jAv = selJ.value;
  const joueurs = joueursEquipe(selDe.value);
  selJ.innerHTML = joueurs.map(j=>`<option value="${echap(j.nom)}">${echap(j.nom)} (${j.po} · OV ${j.ovEstime?'~':''}${j.ov})</option>`).join('');
  if (joueurs.some(j=>j.nom===jAv)) selJ.value = jAv;
  const transferts = litTransferts();
  document.getElementById('transfCompte').textContent = transferts.length ? `(${transferts.length} actif${transferts.length>1?'s':''})` : '';
  if (transferts.length) document.getElementById('blocTransferts').open = true;
  document.getElementById('transfListe').innerHTML = transferts.map(t=>
    `<span class="transf-chip">${echap(t.nom)} : ${t.de} → ${t.vers}
      <button data-transf="${echap(t.nom)}" title="Annuler ce transfert local">×</button></span>`).join('');
  document.querySelectorAll('#transfListe button[data-transf]').forEach(b=>{
    b.addEventListener('click', ()=>{
      ecritTransferts(litTransferts().filter(t=>t.nom!==b.dataset.transf));
      rafraichirRosterClub();
      toutRendre();
      rendreTransferts();
      flash('Transfert local annulé');
    });
  });
}

/* ---------- Sommaire du club ----------
   Une seule rangée de cartes pour toute la section : fiche, masse, effectif. */
function rendreSommaireClub(){
  const actifs = ETAT.roster;
  const resign = litResignatures();
  const {masse, cap} = calculerMasse(resign);
  const nbResignes = actifs.filter(j=>peutProlonger(j) && resign[normaliserNom(j.nom)]).length;
  const moyOV = actifs.length ? (actifs.reduce((s,j)=>s+j.ov,0)/actifs.length) : 0;
  const expirants = actifs.filter(j=>j.ct===1).length;
  const sansContrat = actifs.filter(j=>j.ct===0 && !resign[normaliserNom(j.nom)]).length; // ct=0 non prolongés, exclus du plafond
  const f = ficheEquipe(CONFIG.equipe);
  const indisponibles = actifs.filter(j=>j.ij).length;
  const pluriel = n => n>1 ? 's' : '';
  $('#alignSommaire').innerHTML = `
    <div class="stat-carte">
      <div class="lbl">Fiche</div>
      <div class="val">${f ? `${f.w}-${f.l}-${f.t}` : '—'}</div>
      <div class="det">${f ? `${f.pts} pts en ${f.gp} matchs${f.gf!==null ? ` · ${f.gf} BP, ${f.ga} BC` : ''}` : 'aucun match disputé'}</div>
    </div>
    <div class="stat-carte carte-masse ${masse>cap?'alerte':''}">
      <div class="lbl">Masse salariale</div>
      <div class="val">${fmtArgent(masse)}</div>
      <div class="det">plafond ${fmtArgent(cap)} · marge ${fmtArgent(cap-masse)}${sansContrat?` · ${sansContrat} contrat${pluriel(sansContrat)} à 0 an exclu${pluriel(sansContrat)}`:''}${nbResignes?` · ${nbResignes} prolongé${pluriel(nbResignes)}`:''}</div>
    </div>
    <div class="stat-carte"><div class="lbl">Joueurs actifs</div><div class="val">${actifs.length}</div>
      <div class="det">${actifs.filter(j=>j.po!=='G'&&j.po!=='D').length} av · ${actifs.filter(j=>j.po==='D').length} déf · ${actifs.filter(j=>j.po==='G').length} gar${indisponibles?` · ${indisponibles} indisponible${pluriel(indisponibles)}`:''}</div></div>
    <div class="stat-carte orange"><div class="lbl">Vedettes (80+ OV)</div><div class="val">${actifs.filter(j=>j.ov>=80).length}</div>
      <div class="det">OV moyen ${moyOV.toFixed(1)}</div></div>
    <div class="stat-carte"><div class="lbl">Contrats qui expirent</div><div class="val">${expirants}</div>
      <div class="det">CT = 1 an</div></div>`;
}

/* ---------- Formation ---------- */
const triAlign = {col:'ov', desc:true};
function rendreAlignement(){
  rendreAlertes();
  rendreSommaireClub();
  rendreTransferts();
  const resign = litResignatures();
  const cols = [
    ['nom','Nom'],['no','No'],['po','PO'],['age','Âge'],['it','IT'],['sp','SP'],['st','ST'],['en','EN'],
    ['du','DU'],['di','DI'],['sk','SK'],['pa','PA'],['pc','PC'],['df','DF'],['sc','SC'],
    ['ex','EX'],['ld','LD'],['ov','OV'],['profil','Profil'],['salaire','Salaire'],['ct','CT']
  ];
  const filtre = normaliserNom(ETAT.rechercheAlign || '');
  const valeur = (j, c) => c==='profil' ? j._profil.profil : j[c];
  const liste = ETAT.roster.filter(j => !filtre
      || normaliserNom(j.nom).includes(filtre)
      || normaliserNom(j.po).includes(filtre)
      || normaliserNom(j._profil.profil).includes(filtre)
    ).sort((a,b)=>comparer(valeur(a, triAlign.col), valeur(b, triAlign.col), triAlign.desc));
  let html = enteteTriable(cols, triAlign).replace('</tr></thead>', '<th class="col-resign sans-tri">Re-signer</th></tr></thead>') + '<tbody>';
  for (const j of liste){
    const eligible = peutProlonger(j);
    const rSig = eligible ? resign[normaliserNom(j.nom)] : null; // prolongation valable pour les contrats échus seulement
    const dSig = rSig ? (rSig.duree || dureeMaxCharte(rSig.statut)) : null;
    html += `<tr class="${rSig?'resigne':''}">`
      + `<td>${badgePosition(j.po)}${echap(j.nom)}${etiquetteEtat(j)}${j._transfert?`<span class="tag-transfert" title="Transfert local : arrivé de ${j._transfert} (pas encore traité par la ligue)">via ${j._transfert}</span>`:''}</td>`
      + `<td>${j.no??'—'}</td><td>${j.po}</td><td>${j.age}</td>`
      + cellulesCotes(j)
      + `<td class="${j.ov>=82?'cote-elite':(j.ov>=78?'cote-forte':'')}"><strong>${j.ovEstime?'~':''}${j.ov}</strong></td>`
      + `<td class="gauche">${etiquetteProfil(j)}</td>`
      + `<td>${fmtArgent(rSig ? rSig.salaire : j.salaire)}${rSig?' <span class="resign-tag">prolongé</span>':''}</td>`
      + `<td>${rSig ? dSig + ' an' + (dSig>1?'s':'') : (j.ct??'—')}</td>`
      // le bouton n'existe que pour un contrat échu (0 an) — règle de la ligue
      + (eligible
          ? `<td class="col-resign"><button class="btn-prolong ${rSig?'actif':''}" data-nom="${echap(j.nom)}">${rSig?'✓ Prolongé':'Prolonger'}</button></td>`
          : `<td class="col-resign">—</td>`)
      + `</tr>`;
  }
  const table = $('#tableAlignement');
  table.innerHTML = html + '</tbody>';
  brancherTri(table, triAlign, rendreAlignement);
  attacherProlongations(table);
}

/* Le bouton de la colonne Re-signer ouvre la fenêtre «Prolongation de contrat». */
function attacherProlongations(table){
  table.querySelectorAll('button.btn-prolong[data-nom]').forEach(b=>{
    b.addEventListener('click', ()=> ouvrirProlongation(b.dataset.nom));
  });
}

/* ---------- Export CSV de l'alignement ----------
   Séparateur point-virgule et BOM UTF-8 : s'ouvre proprement dans Excel
   configuré en français. Retourne la chaîne (testable), le bouton la télécharge. */
function exporterCSV(){
  const entetes = ['Nom','No','PO','HD','Age','IT','SP','ST','EN','DU','DI','SK','PA','PC','DF','SC','EX','LD','OV','Profil','Salaire','CT'];
  const champ = v => {
    const t = (v===null||v===undefined) ? '' : String(v);
    return /[;"\n]/.test(t) ? '"'+t.replace(/"/g,'""')+'"' : t;
  };
  const lignes = [entetes.join(';')];
  for (const j of ETAT.roster){
    lignes.push([j.nom, j.no, j.po, j.hd, j.age, j.it, j.sp, j.st, j.en, j.du, j.di, j.sk,
      j.pa, j.pc, j.df, j.sc, j.ex, j.ld, j.ov, j._profil.profil, j.salaire, j.ct]
      .map(champ).join(';'));
  }
  return lignes.join('\n');
}
function telechargerCSV(){
  const blob = new Blob(['﻿' + exporterCSV()], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = CONFIG.equipe.toLowerCase() + '-alignement.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  flash('Alignement exporté en CSV');
}
