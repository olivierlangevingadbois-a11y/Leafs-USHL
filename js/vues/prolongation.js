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
