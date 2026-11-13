#!/usr/bin/env node
/* =====================================================================
   RELEVÉ DE USHL.CA → data/releve.js

   Lit la ligue au complet directement sur ushl.ca (API JSON + classement +
   XtraStats) et écrit le relevé intégré à la page : c'est ce qui s'affiche
   à l'ouverture, avant même que le navigateur ait joint le site, et hors
   ligne. Sans dépendance : Node 18 ou plus.

       npm run releve

   L'action GitHub .github/workflows/releve.yml le lance à heure fixe et
   enregistre le fichier s'il a changé. Si le site ne répond pas ou renvoie
   un relevé incomplet, rien n'est écrit : le relevé précédent demeure.
   ===================================================================== */
const fs = require('fs');
const path = require('path');
const U = require('../js/ushl.js');

const SORTIE = path.join(__dirname, '..', 'data', 'releve.js');
const DELAI_MS = 30000;

async function lire(url, essais = 3){
  let derniere;
  for (let i = 1; i <= essais; i++){
    try {
      const rep = await fetch(url, {signal: AbortSignal.timeout(DELAI_MS), headers: {'user-agent': 'releve-ushl'}});
      if (!rep.ok) throw new Error('HTTP ' + rep.status);
      return await rep.text();
    } catch (e){
      derniere = e;
      if (i < essais) await new Promise(r => setTimeout(r, 1500 * i));
    }
  }
  throw new Error(`${url} : ${derniere.message}`);
}
async function lireApi(url){
  const donnees = JSON.parse(await lire(url)).data;
  if (!Array.isArray(donnees)) throw new Error(`${url} : réponse sans tableau «data»`);
  return donnees;
}
/* Une page secondaire qui manque n'empêche pas le relevé. */
const facultatif = promesse => promesse.catch(e => { console.warn('  ⚠ ' + e.message); return null; });

function verifier({equipes, patineurs, gardiens}){
  const codes = Object.keys(equipes);
  const maigres = codes.filter(c => equipes[c].filter(j => !U.estFictif(j.nom)).length < 15);
  if (codes.length < 30) throw new Error(`${codes.length} équipes seulement dans la réponse de l'API`);
  if (maigres.length) throw new Error(`alignement incomplet : ${maigres.join(', ')}`);
  if (patineurs.length < 300) throw new Error(`${patineurs.length} patineurs seulement dans les statistiques`);
  if (gardiens.length < 30) throw new Error(`${gardiens.length} gardiens seulement dans les statistiques`);
}

/* Une rangée par ligne : les enregistrements automatiques restent lisibles
   dans l'historique (un échange = deux lignes qui changent). */
const lignes = (cles, liste) => liste.map(o => '  ' + JSON.stringify(U.compacter(cles, o))).join(',\n');
function ecrire(r){
  const equipes = Object.keys(r.equipes).map(code =>
    ` ${JSON.stringify(code)}: [\n${lignes(U.CLES_JOUEUR, r.equipes[code])}\n ]`).join(',\n');
  const minutes = Object.entries(r.minutes).map(([k, v]) => `  ${JSON.stringify(k)}: ${v}`).join(',\n');
  const texte = `/* Relevé de ushl.ca — produit par scripts/releve.js. Ne pas modifier à la main :
   «npm run releve» le régénère. Formats : voir les CLES_* de js/ushl.js. */
const USHL_RELEVE = {
date: ${JSON.stringify(r.date)},
equipes: {
${equipes}
},
patineurs: [
${lignes(U.CLES_PATINEUR, r.patineurs)}
],
gardiens: [
${lignes(U.CLES_GARDIEN, r.gardiens)}
],
classement: [
${lignes(U.CLES_FICHE, r.classement)}
],
classementOfficiel: ${r.classementOfficiel},
dateMinutes: ${JSON.stringify(r.dateMinutes)},
minutes: {
${minutes}
},
reference: [
${lignes(U.CLES_XTRA, r.reference)}
]
};
`;
  fs.mkdirSync(path.dirname(SORTIE), {recursive: true});
  fs.writeFileSync(SORTIE, texte);
}

(async () => {
  console.log('Relevé de ushl.ca…');
  const [joueurs, statsP, statsG, pageClassement, pageXtra] = await Promise.all([
    lireApi(U.REQUETES_API.joueurs),
    lireApi(U.REQUETES_API.patineurs),
    lireApi(U.REQUETES_API.gardiens),
    facultatif(lire(U.URLS_USHL.classement)),
    facultatif(lire(U.URLS_USHL.xtra))
  ]);
  const r = {
    date: new Date().toISOString(),
    equipes: U.equipesDepuisApi(joueurs),
    patineurs: U.patineursDepuisApi(statsP),
    gardiens: U.gardiensDepuisApi(statsG)
  };
  verifier(r);

  const officiel = pageClassement ? U.parseClassement(pageClassement) : [];
  r.classementOfficiel = officiel.length >= 30;
  r.classement = r.classementOfficiel ? officiel : U.classementDepuisStats(r.patineurs, r.gardiens);

  const xtra = pageXtra ? U.parseXtraLigue(pageXtra) : [];
  r.dateMinutes = pageXtra ? U.dateXtra(pageXtra) : null;
  // Avant le premier match, XtraStats montre encore la saison précédente :
  // ses totaux servent de référence, pas de minutes de la saison en cours.
  const archive = !r.patineurs.some(p => p.gp > 0) && xtra.some(x => x.gp > 0);
  r.minutes = archive ? {} : U.minutesDepuisXtra(xtra);
  r.reference = archive ? xtra : [];

  ecrire(r);
  const nbJoueurs = Object.values(r.equipes).reduce((n, e) => n + e.length, 0);
  console.log(`  ${Object.keys(r.equipes).length} équipes, ${nbJoueurs} joueurs`);
  console.log(`  ${r.patineurs.length} patineurs et ${r.gardiens.length} gardiens (statistiques)`);
  console.log(`  classement ${r.classementOfficiel ? 'officiel' : 'calculé des décisions des gardiens'} : ${r.classement.length} équipes`);
  console.log(archive
    ? `  saison pas commencée : ${r.reference.length} joueurs de référence (XtraStats du ${r.dateMinutes})`
    : `  minutes jouées : ${Object.keys(r.minutes).length} patineurs` + (r.dateMinutes ? ` (XtraStats du ${r.dateMinutes})` : ''));
  console.log('→ ' + path.relative(process.cwd(), SORTIE));
})().catch(e => {
  console.error('Relevé abandonné, fichier précédent conservé : ' + e.message);
  process.exit(1);
});
