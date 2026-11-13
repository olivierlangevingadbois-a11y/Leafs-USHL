/* ---------- Bureau du DG : les urgences en tête de l'alignement ----------
   Rassemble ce qu'un DG doit voir sans fouiller : plafond, contrats échus,
   contrats qui expirent, joueurs sous les attentes et gardiens qui
   approchent leur limite de parties (punitions de la ligue à la clé). */
function alertesDG(){
  const alertes = [];
  const resign = litResignatures();
  const actifs = ETAT.roster.filter(j=>!j.backup);
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
    alertes.push({niveau:'info', texte:`<b>${expirants.length} contrat${expirants.length>1?'s':''}</b> expire${expirants.length>1?'nt':''} à la fin de la saison — planifie les re-signatures (onglet Plafond).`});
  }
  // gardiens : limite de parties (limites.json + parties jouées de la saison)
  for (const g of actifs.filter(j=>j.po==='G')){
    const lim = ETAT.limites.get(normaliserNom(g.nom));
    const prod = productionDe(g);
    if (!lim || !prod || !prod.gp || prod._reference || prod._modeY21) continue;
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

/* ---------- Bloc des transferts locaux (onglet Alignement) ---------- */
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
  document.getElementById('transfListe').innerHTML = litTransferts().map(t=>
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

/* ---------- Alignement ---------- */
let triAlign = {col:'ov', desc:true};
function rendreAlignement(){
  rendreAlertes();
  rendreTransferts();
  $('#ficheEquipe').textContent = ETAT.fiche;
  $('#sourceInfo').textContent = ETAT.source;
  const actifs = ETAT.roster.filter(j=>!j.backup);
  const resign = litResignatures();
  const {masse, cap} = calculerMasse(resign);
  const nbResignes = actifs.filter(j=>peutProlonger(j) && resign[normaliserNom(j.nom)]).length;
  const moyOV = actifs.length ? (actifs.reduce((s,j)=>s+j.ov,0)/actifs.length) : 0;
  const vedettes = actifs.filter(j=>j.ov>=80).length;
  const expirants = actifs.filter(j=>j.ct===1).length;
  const sansContrat = actifs.filter(j=>j.ct===0 && !resign[normaliserNom(j.nom)]).length; // ct=0 non prolongés, exclus du plafond
  $('#alignSommaire').innerHTML = `
    <div class="stat-carte ${masse>cap?'alerte':''}">
      <div class="lbl">Masse salariale</div>
      <div class="val">${fmtArgent(masse)}</div>
      <div class="det">plafond ${fmtArgent(cap)} · marge ${fmtArgent(cap-masse)}${sansContrat?` · ${sansContrat} contrat${sansContrat>1?'s':''} à 0 an exclu${sansContrat>1?'s':''}`:''}${nbResignes?` · ${nbResignes} prolongé${nbResignes>1?'s':''}`:''}</div>
    </div>
    <div class="stat-carte"><div class="lbl">Joueurs actifs</div><div class="val">${actifs.length}</div>
      <div class="det">${actifs.filter(j=>j.po!=='G'&&j.po!=='D').length} av · ${actifs.filter(j=>j.po==='D').length} déf · ${actifs.filter(j=>j.po==='G').length} gar</div></div>
    <div class="stat-carte orange"><div class="lbl">Vedettes (80+ OV)</div><div class="val">${vedettes}</div>
      <div class="det">OV moyen ${moyOV.toFixed(1)}</div></div>
    <div class="stat-carte"><div class="lbl">Contrats qui expirent</div><div class="val">${expirants}</div>
      <div class="det">CT = 1 an</div></div>`;

  const cols = [
    ['nom','Nom'],['no','No'],['po','PO'],['age','Âge'],['it','IT'],['sp','SP'],['st','ST'],['en','EN'],
    ['du','DU'],['di','DI'],['sk','SK'],['pa','PA'],['pc','PC'],['df','DF'],['sc','SC'],
    ['ex','EX'],['ld','LD'],['ov','OV'],['profil','Profil'],['salaire','Salaire'],['ct','CT'],
    ['resign','Re-signer']
  ];
  const filtre = normaliserNom(ETAT.rechercheAlign || '');
  const liste = [...ETAT.roster].filter(j => !filtre
      || normaliserNom(j.nom).includes(filtre)
      || normaliserNom(j.po).includes(filtre)
      || normaliserNom(j._profil.profil).includes(filtre)
    ).sort((a,b)=>{
    const c = triAlign.col;
    const va = c==='profil' ? a._profil.profil : a[c];
    const vb = c==='profil' ? b._profil.profil : b[c];
    if (va===vb) return 0;
    if (va===null||va===undefined) return 1;
    if (vb===null||vb===undefined) return -1;
    const r = (typeof va==='string') ? va.localeCompare(vb) : va-vb;
    return triAlign.desc ? -r : r;
  });
  let html = '<thead><tr>' + cols.map(([c,l])=>
    c==='resign'
      ? `<th class="col-resign">${l}</th>`
      : `<th data-col="${c}" class="${triAlign.col===c?'tri-actif':''}">${l}${triAlign.col===c?(triAlign.desc?' ▾':' ▴'):''}</th>`).join('') + '</tr></thead><tbody>';
  for (const j of liste){
    const p = j._profil;
    const badge = j.po==='G' ? 'g' : (j.po==='D' ? 'd' : '');
    const tag = j.po==='G' ? 'g-tag' : (j.po==='D' ? 'd-tag' : '');
    html += `<tr class="${j.backup?'backup':''}${peutProlonger(j) && resign[normaliserNom(j.nom)]?' resigne':''}">`;
    html += `<td><span class="pos-badge ${badge}">${j.po}</span>${echap(j.nom)}${j._transfert?`<span class="tag-transfert" title="Transfert local : arrivé de ${j._transfert} (pas encore traité par la ligue)">via ${j._transfert}</span>`:''}</td>`;
    html += `<td>${j.no??'—'}</td><td>${j.po}</td><td>${j.age}</td>`;
    for (const c of ['it','sp','st','en','du','di','sk','pa','pc','df','sc','ex','ld']){
      const v = j[c];
      const cls = v===null?'':(v>=85?'cote-elite':(v>=78?'cote-forte':''));
      html += `<td class="${cls}">${v===null?'—':v}</td>`;
    }
    const ovAff = j.ovEstime ? `<span title="OV estimé (formule des gardiens non publiée) — remplacé par la valeur réelle à la première actualisation ushl.ca">~${j.ov}</span>` : j.ov;
    html += `<td class="${j.ov>=82?'cote-elite':(j.ov>=78?'cote-forte':'')}"><strong>${ovAff}</strong></td>`;
    html += `<td style="text-align:left"><span class="profil-tag ${tag}">${p.profil}</span></td>`;
    const eligible = peutProlonger(j);
    const rSig = eligible ? resign[normaliserNom(j.nom)] : null; // prolongation valable pour les contrats échus seulement
    const salAff = rSig ? rSig.salaire : j.salaire;
    html += `<td>${fmtArgent(salAff)}${rSig?' <span class="resign-tag">prolongé</span>':''}</td>`;
    const dSig = rSig ? (rSig.duree || dureeMaxCharte(rSig.statut)) : null;
    html += `<td>${rSig ? dSig + ' an' + (dSig>1?'s':'') : (j.ct??'—')}</td>`;
    // Colonne Contrat : bouton seulement pour un contrat échu (0 an) — règle de la ligue
    if (!eligible){
      html += `<td class="col-resign">—</td>`;
    } else {
      html += `<td class="col-resign">`
        + `<button class="btn-prolong ${rSig?'actif':''}" data-nom="${j.nom.replace(/"/g,'&quot;')}">`
        + `${rSig?'✓ Prolongé':'Prolonger'}</button></td>`;
    }
    html += `</tr>`;
  }
  html += '</tbody>';
  const table = $('#tableAlignement');
  table.innerHTML = html;
  table.querySelectorAll('th[data-col]').forEach(th=>{
    th.addEventListener('click', ()=>{
      const c = th.dataset.col;
      if (triAlign.col===c) triAlign.desc = !triAlign.desc;
      else { triAlign.col = c; triAlign.desc = true; }
      rendreAlignement();
    });
  });
  attacherProlongations(table);
}

/* Le bouton de la colonne Contrat ouvre la fenêtre «Prolongation de contrat». */
function attacherProlongations(table){
  table.querySelectorAll('button.btn-prolong[data-nom]').forEach(b=>{
    b.addEventListener('click', ()=> ouvrirProlongation(b.dataset.nom));
  });
}

/* ---------- Fenêtre «Prolongation de contrat» ---------- */
const LIBELLES_STATUT = {RFA:'RFA (28 ans et -)', UFA:'UFA', UFAR2:'UFA Ronde 2', SANS:'Joueur sans contrat'};

function modalProlongation(){
  let el = document.getElementById('modalProlong');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'modalProlong';
  el.className = 'modal-fond';
  el.hidden = true;
  el.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="mpTitre">
      <div class="modal-tete">
        <h3 id="mpTitre">Prolongation de contrat</h3>
        <button class="modal-x" id="mpX" aria-label="Fermer">&times;</button>
      </div>
      <div class="modal-joueur">
        <span class="mj-nom" id="mpNom"></span>
        <span class="mj-meta" id="mpMeta"></span>
      </div>
      <div class="modal-grille">
        <label>Statut
          <select id="mpStatut">
            <option value="RFA">RFA</option>
            <option value="UFA">UFA</option>
            <option value="UFAR2">UFA Ronde 2</option>
            <option value="SANS">Sans contrat</option>
          </select>
        </label>
        <label>Durée
          <select id="mpDuree"></select>
        </label>
        <label class="large">Salaire annuel
          <input type="text" id="mpSalaire" inputmode="numeric">
        </label>
      </div>
      <div class="modal-min" id="mpMin"></div>
      <div class="modal-impact" id="mpImpact"></div>
      <div class="modal-actions">
        <button class="danger" id="mpRetirer">Retirer la prolongation</button>
        <button class="secondaire" id="mpAnnuler">Annuler</button>
        <button id="mpOk">Prolonger</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  el.addEventListener('click', e=>{ if (e.target === el) fermerProlongation(); });
  el.querySelector('#mpX').addEventListener('click', fermerProlongation);
  el.querySelector('#mpAnnuler').addEventListener('click', fermerProlongation);
  document.addEventListener('keydown', e=>{ if (e.key === 'Escape' && !el.hidden) fermerProlongation(); });
  return el;
}

function fermerProlongation(){
  const el = document.getElementById('modalProlong');
  if (el) el.hidden = true;
}

/* Remplit la liste des durées permises pour un statut (charte : RFA 7, UFA 4, R2 2, sans contrat 1). */
function remplirDurees(sel, statut, choisie){
  const max = dureeMaxCharte(statut);
  sel.innerHTML = '';
  for (let d = 1; d <= max; d++){
    const o = document.createElement('option');
    o.value = String(d);
    o.textContent = d + (d > 1 ? ' ans' : ' an');
    sel.appendChild(o);
  }
  sel.value = String(Math.min(choisie || 1, max));
}

function ouvrirProlongation(nom){
  const j = ETAT.roster.find(x => x.nom === nom);
  if (!j || !peutProlonger(j)) return; // seuls les contrats échus (0 an) se prolongent
  const el = modalProlongation();
  const cle = normaliserNom(j.nom);
  const dejaSigne = litResignatures()[cle] || null;

  const selStatut = el.querySelector('#mpStatut');
  const selDuree  = el.querySelector('#mpDuree');
  const inSal     = el.querySelector('#mpSalaire');
  const divMin    = el.querySelector('#mpMin');
  const divImpact = el.querySelector('#mpImpact');
  const btnRetirer= el.querySelector('#mpRetirer');
  const btnOk     = el.querySelector('#mpOk');

  el.querySelector('#mpNom').textContent = j.nom;
  el.querySelector('#mpMeta').textContent =
    `${j.po} · ${j.age} ans · OV ${j.ov} · ${j._profil.profil} · salaire actuel ${fmtArgent(j.salaire)} · CT ${j.ct ?? '—'}`;

  const statutInit = dejaSigne ? dejaSigne.statut : statutResignature(j);
  selStatut.value = statutInit;
  // durée proposée : celle déjà signée, sinon 3 ans pour un RFA (dernier palier
  // sans hausse d'échelon), sinon la durée max du statut
  const dureeInit = dejaSigne ? dejaSigne.duree : (statutInit === 'RFA' ? 3 : dureeMaxCharte(statutInit));
  remplirDurees(selDuree, statutInit, dureeInit);
  const minInit = salaireMinimum(j.ov, statutInit, j.age, +selDuree.value, j.po);
  inSal.value = fmtArgent(dejaSigne ? dejaSigne.salaire : minInit);
  // Tant que le DG n'a pas saisi de montant lui-même, le salaire SUIT le
  // minimum de la charte quand le statut ou la durée change (à la baisse
  // comme à la hausse). Une saisie manuelle est respectée (mais jamais
  // laissée sous le minimum).
  let salaireManuel = !!dejaSigne && dejaSigne.salaire > minInit;

  btnRetirer.style.display = dejaSigne ? '' : 'none';
  btnOk.textContent = dejaSigne ? 'Mettre à jour' : 'Prolonger';

  // Rafraîchit minimum, bornage du salaire et aperçu d'impact sur la masse.
  const rafraichir = (clamper)=>{
    const st = selStatut.value;
    const duree = +selDuree.value;
    const min = salaireMinimum(j.ov, st, j.age, duree, j.po);
    const ovEff = echelonEffectif(j.ov, st, duree, j.po);
    let noteEch = '';
    if (ovEff !== j.ov){
      const parts = [];
      if (st === 'RFA' && duree > 3) parts.push(`+${duree-3} : ${duree} ans de RFA (+1 par année après 3)`);
      if (j.po === 'G') parts.push('−1 : gardien (un échelon plus bas)');
      noteEch = ` · échelon <b>OV ${Math.max(CHARTE_OV_MIN, Math.min(ovEff, CHARTE_OV_MAX))}${ovEff>CHARTE_OV_MAX?'+':(ovEff<CHARTE_OV_MIN?'-':'')}</b> (${parts.join(' · ')})`;
    }
    if (ovEff > CHARTE_OV_MAX){
      noteEch += ` · règle du 87+ : <b>+${fmtArgentCourt((ovEff-CHARTE_OV_MAX)*SURCHARGE_OV87)}</b> (2,5 M par OV au-dessus de 87)`;
    }
    divMin.innerHTML = `Minimum de la charte (${LIBELLES_STATUT[st]}, OV ${j.ov}, ${j.age} ans) : <b>${fmtArgent(min)}</b>${noteEch}`;
    let sal = parseArgent(inSal.value);
    if (clamper || sal === null || sal < min){
      if (sal === null || sal < min) sal = min;
      inSal.value = fmtArgent(sal);
    }
    // aperçu : masse recalculée en incluant cette prolongation
    const simule = {...litResignatures()};
    simule[cle] = {statut: st, duree: +selDuree.value, salaire: sal};
    const {masse, cap} = calculerMasse(simule);
    const depasse = masse > cap;
    divImpact.classList.toggle('alerte', depasse);
    divImpact.innerHTML =
      `Masse projetée : <b>${fmtArgent(masse)}</b><br>`
      + `Plafond ${fmtArgent(cap)} · ${depasse ? 'dépassement de <b>'+fmtArgent(masse-cap)+'</b>' : 'marge <b>'+fmtArgent(cap-masse)+'</b>'}<br>`
      + `Contrat : ${selDuree.value} an${+selDuree.value>1?'s':''} × ${fmtArgent(sal)}`;
    return sal;
  };

  const suivreMinimum = ()=>{
    if (!salaireManuel){
      inSal.value = fmtArgent(salaireMinimum(j.ov, selStatut.value, j.age, +selDuree.value, j.po));
    }
    rafraichir(true);
  };
  selStatut.onchange = ()=>{ remplirDurees(selDuree, selStatut.value, +selDuree.value); suivreMinimum(); };
  selDuree.onchange  = suivreMinimum;           // le minimum dépend de la durée (règle RFA)
  inSal.oninput      = ()=>{ salaireManuel = true; };
  inSal.onchange     = ()=> rafraichir(true);
  inSal.onblur       = ()=> rafraichir(true);

  btnOk.onclick = ()=>{
    const sal = rafraichir(true);
    const r = litResignatures();
    r[cle] = {statut: selStatut.value, duree: +selDuree.value, salaire: sal};
    ecritResignatures(r);
    fermerProlongation();
    rendreAlignement();
  };
  btnRetirer.onclick = ()=>{
    const r = litResignatures();
    delete r[cle];
    ecritResignatures(r);
    fermerProlongation();
    rendreAlignement();
  };

  rafraichir(false);
  el.hidden = false;
  inSal.focus();
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
    if (j.backup) continue;
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
