/* ---------- Charte salariale des re-signatures (CHARTE OFFICIELLE Y22, cap 104 M) ----------
   Salaires MINIMUMS en dollars, indexés sur l'OV (74- à 87+). Quatre chartes selon
   le statut, avec sous-colonnes d'âge pour les UFA. Valeurs transcrites de la charte
   fournie (exprimées en milliers dans le document : 700 $ = 700 000 $).
   - RFA (6.4.1)          : 28 ans et -, durée 1 à 7 ans, une seule colonne
   - UFA (6.4.2)          : durée 1 à 4 ans, colonnes «34-» et «35+»
   - UFA Ronde 2 (6.4.3)  : durée 1 à 2 ans, colonnes «34-» et «35+»
   - Sans contrat (6.4.4) : durée 1 an, colonnes «34-» et «35+»
   Index de ligne : 0→OV 74 et moins, 1→75, … 12→OV 87 et plus (clamp aux bornes). */
const CHARTE_OV_MIN = 74, CHARTE_OV_MAX = 87;
const CHARTE_SALAIRE = {
  //                 OV:  74-    75     76     77     78     79     80     81     82      83      84      85      86      87+
  RFA:              [  700,  775,  825,  950, 2250, 3750, 5750, 7500, 8750, 10500, 12250, 13750, 15500, 17500],
  UFA_34:           [  900,  950, 1150, 1500, 2250, 3500, 5000, 6250, 7500,  8750, 10250, 12000, 13500, 15500],
  UFA_35:           [  900,  900, 1000, 1100, 1750, 2250, 3250, 4250, 5000,  6000,  7250,  8750, 10000, 11500],
  UFAR2_34:         [  900,  900,  950, 1150, 1500, 2500, 3500, 5000, 6250,  7500,  8750, 10250, 12000, 13500],
  UFAR2_35:         [  900,  900,  900, 1000, 1100, 1750, 2250, 3250, 4250,  5000,  6000,  7250,  8750, 10000],
  SANS_34:          [  900,  900,  900,  950, 1150, 1500, 2500, 3500, 5000,  6250,  7500,  8750, 10250, 12000],
  SANS_35:          [  900,  900,  900, 1000, 1000, 1100, 1750, 2250, 3250,  4250,  5000,  6000,  7250,  9000]
};

/* Statut de re-signature déduit de l'âge (règle simple retenue) :
   28 ans et moins → RFA ; 29 ans et plus → UFA. Les variantes Ronde 2 et Sans
   contrat existent dans la charte et peuvent être choisies manuellement. */
function statutResignature(j){ return j.age <= 28 ? 'RFA' : 'UFA'; }

/* Clé de charte à partir du statut et de l'âge (tranche 34- / 35+ pour les UFA). */
function cleCharte(statut, age){
  if (statut === 'RFA') return 'RFA';
  const tranche = age >= 35 ? '35' : '34';
  if (statut === 'UFA')   return 'UFA_' + tranche;
  if (statut === 'UFAR2') return 'UFAR2_' + tranche;
  if (statut === 'SANS')  return 'SANS_' + tranche;
  return 'UFA_' + tranche;
}

/* Échelon OV effectif :
   - règle RFA : le DG peut donner 1 à 7 saisons, mais chaque année au-delà de 3
     monte l'échelon de 1 (4 ans → OV+1, … 7 ans → OV+4);
   - règle des gardiens : un gardien signe UN ÉCHELON PLUS BAS que son OV (−1),
     peu importe le statut. Les deux règles se cumulent. */
function echelonEffectif(ov, statut, duree, po){
  const bonusRFA = (statut === 'RFA' && (duree || 1) > 3) ? (duree - 3) : 0;
  const malusGardien = (po === 'G') ? -1 : 0;
  return Math.round(ov) + bonusRFA + malusGardien;
}

/* Règle du sommet de la charte : la charte plafonne à l'échelon OV 87. Un
   joueur au-delà exige 2 500 000 $ DE PLUS par OV au-dessus de 87 (ex. : un
   OV 89 demande la valeur 87+ de sa colonne, plus 5 000 000 $). */
const SURCHARGE_OV87 = 2500000;

/* Salaire minimum de la charte pour un OV, un statut, un âge, une durée et une
   position (en dollars). La durée n'influence que les RFA; la position ne joue
   que pour les gardiens (échelon −1) ; au-delà de l'échelon 87 s'ajoute la
   surcharge de 2,5 M par OV. */
function salaireMinimum(ov, statut, age, duree, po){
  const cle = cleCharte(statut, age);
  const table = CHARTE_SALAIRE[cle];
  if (!table) return null;
  const ovEff = echelonEffectif(ov, statut, duree, po);
  const i = Math.max(0, Math.min(CHARTE_OV_MAX - CHARTE_OV_MIN, ovEff - CHARTE_OV_MIN));
  const surcharge = Math.max(0, ovEff - CHARTE_OV_MAX) * SURCHARGE_OV87;
  return table[i] * 1000 + surcharge;
}

/* Éligibilité : seuls les joueurs dont le contrat est échu (0 an) se prolongent.
   Les joueurs déjà sous contrat ne sont pas prolongeables. */
function peutProlonger(j){ return j.ct === 0; }

/* Durée maximale permise par la charte selon le statut. */
function dureeMaxCharte(statut){
  return statut==='RFA' ? 7 : statut==='UFA' ? 4 : statut==='UFAR2' ? 2 : 1;
}

/* État des re-signatures (persisté). Clé = nom normalisé du joueur →
   {statut, salaire}. Le joueur re-signé est réintégré au calcul de la masse. */
function litResignatures(){
  try { return JSON.parse(localStorage.getItem(CLES_LS.resign) || '{}'); }
  catch { return {}; }
}
function ecritResignatures(o){ localStorage.setItem(CLES_LS.resign, JSON.stringify(o)); }

/* Plafond salarial de la ligue (Y22). */
const PLAFOND = 104000000;

/* Masse salariale pour un état de prolongations donné.
   Exclut les backups et les joueurs sans contrat actif (0 an) NON prolongés.
   Un joueur prolongé compte au plafond avec son salaire de prolongation. */
function calculerMasse(resignMap){
  const r = resignMap || litResignatures();
  const actifs = ETAT.roster;
  let masse = 0;
  for (const j of actifs){
    const sig = (j.ct === 0) ? r[normaliserNom(j.nom)] : null; // prolongation valable pour les contrats échus seulement
    if (sig) masse += sig.salaire;
    else if (j.ct > 0) masse += (j.salaire || 0);
  }
  return {masse, cap: PLAFOND};
}
