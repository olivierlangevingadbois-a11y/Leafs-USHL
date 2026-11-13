/* =====================================================================
   POSTE DU DG — USHL PRO (tableau de bord, un club au choix parmi les 32)
   Monofichier vanilla HTML/CSS/JS — aucune dépendance, aucun build.
   Sources en direct : TeamRosters.php, TeamScoring.php, USHLxtrastats.html
   ===================================================================== */
'use strict';

/* ------------------ LES 32 CLUBS DE LA USHL PRO ------------------
   Le tableau de bord n'appartient à aucun club en particulier : chaque DG
   choisit le sien dans les Réglages et l'application s'habille à ses couleurs.
   Le choix est conservé dans le navigateur, une installation par DG. */
const CLUBS = {
  'TORONTO':    {nom:'Maple Leafs de Toronto',    couleur:'#00205B', emoji:'🍁'},
  'BOSTON':     {nom:'Bruins de Boston',          couleur:'#FFB81C', emoji:'🐻'},
  'OTTAWA':     {nom:"Sénateurs d'Ottawa",        couleur:'#C8102E', emoji:'🏛️'},
  'NEWJERSEY':  {nom:'Devils du New Jersey',      couleur:'#CE1126', emoji:'😈'},
  'NYRANGERS':  {nom:'Rangers de New York',       couleur:'#0038A8', emoji:'🗽'},
  'ISLANDERS':  {nom:'Islanders de New York',     couleur:'#00539B', emoji:'🏝️'},
  'MONTREAL':   {nom:'Canadiens de Montréal',     couleur:'#AF1E2D', emoji:'⚜️'},
  'FLORIDE':    {nom:'Panthers de la Floride',    couleur:'#C8102E', emoji:'🐆'},
  'CAROLINA':   {nom:'Hurricanes de la Caroline', couleur:'#CC0000', emoji:'🌀'},
  'CHICAGO':    {nom:'Blackhawks de Chicago',     couleur:'#CF0A2C', emoji:'🪶'},
  'COLORADO':   {nom:'Avalanche du Colorado',     couleur:'#6F263D', emoji:'🏔️'},
  'VANCOUVER':  {nom:'Canucks de Vancouver',      couleur:'#00205B', emoji:'🐋'},
  'CALGARY':    {nom:'Flames de Calgary',         couleur:'#D2001C', emoji:'🔥'},
  'EDMONTON':   {nom:"Oilers d'Edmonton",         couleur:'#FF4C00', emoji:'🛢️'},
  'MINNESOTA':  {nom:'Wild du Minnesota',         couleur:'#154734', emoji:'🌲'},
  'LOSANGELES': {nom:'Kings de Los Angeles',      couleur:'#A2AAAD', emoji:'👑'},
  'SANJOSE':    {nom:'Sharks de San Jose',        couleur:'#006D75', emoji:'🦈'},
  'ANAHEIM':    {nom:"Ducks d'Anaheim",           couleur:'#F47A38', emoji:'🦆'},
  'DALLAS':     {nom:'Stars de Dallas',           couleur:'#006847', emoji:'⭐'},
  'UTAH':       {nom:"Mammoth de l'Utah",         couleur:'#71AFE5', emoji:'🦣'},
  'WINNIPEG':   {nom:'Jets de Winnipeg',          couleur:'#041E42', emoji:'✈️'},
  'VEGAS':      {nom:'Golden Knights de Vegas',   couleur:'#B4975A', emoji:'⚔️'},
  'SEATTLE':    {nom:'Kraken de Seattle',         couleur:'#99D9D9', emoji:'🐙'},
  'PITTSBURGH': {nom:'Penguins de Pittsburgh',    couleur:'#FCB514', emoji:'🐧'},
  'BUFFALO':    {nom:'Sabres de Buffalo',         couleur:'#003087', emoji:'🦬'},
  'ST.LOUIS':   {nom:'Blues de Saint-Louis',      couleur:'#002F87', emoji:'🎵'},
  'NASHVILLE':  {nom:'Predators de Nashville',    couleur:'#FFB81C', emoji:'🎸'},
  'WASHINGTON': {nom:'Capitals de Washington',    couleur:'#C8102E', emoji:'🦅'},
  'DETROIT':    {nom:'Red Wings de Detroit',      couleur:'#CE1126', emoji:'🛞'},
  'COLUMBUS':   {nom:'Blue Jackets de Columbus',  couleur:'#002654', emoji:'🐝'},
  'PHILLY':     {nom:'Flyers de Philadelphie',    couleur:'#F74902', emoji:'🟠'},
  'TAMPABAY':   {nom:'Lightning de Tampa Bay',    couleur:'#1B72D0', emoji:'⚡'}
};
const CLUB_DEFAUT = 'TORONTO';
const CLE_CLUB = 'tml_club_v1';
/* Club du DG assis devant l'écran (localStorage indisponible → club par défaut). */
function litClubChoisi(){
  try {
    const c = localStorage.getItem(CLE_CLUB);
    if (c && CLUBS[c]) return c;
  } catch (e){ /* stockage refusé : on reste sur le club par défaut */ }
  return CLUB_DEFAUT;
}
const CLUB_ACTIF = litClubChoisi();
const BASE_SIM = 'https://ushl.ca/ushl/menu_sim/USHL-pro/jamesishot/';

/* ------------------ CONFIGURATION ------------------ */
const CONFIG = {
  equipe: CLUB_ACTIF,
  club: CLUBS[CLUB_ACTIF],
  urls: {
    roster:  BASE_SIM + 'TeamRosters.php?team=' + CLUB_ACTIF,
    scoring: BASE_SIM + 'TeamScoring.php?team=' + CLUB_ACTIF,
    xtra:    'https://ushl.ca/ushl/menu_sim/USHL-pro/USHLxtrastats.html',
    matrices:'https://ushl.ca/ushl/menu_ushl/la_ligue/reglements/MATRICES%20DES%20PROFILS.htm'
  },
  proxys: [
    u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
    u => 'https://corsproxy.io/?url=' + encodeURIComponent(u),
    u => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u),
    u => 'https://proxy.cors.sh/' + u,
    u => 'https://thingproxy.freeboard.io/fetch/' + u
  ],
  // limites d'utilisation des gardiens (projet gestiongardiens, généré depuis ushl.ca)
  urlLimites: 'https://merciermathieu5.github.io/gestiongardiens/limites.json',
  ttl: { roster: 12*3600*1000, scoring: 30*60*1000, xtra: 3600*1000, limites: 3600*1000 },
  matchsSaison: 82
};

/* Clés de stockage. Les matrices, la cache et l'instantané de la ligue valent
   pour toute la USHL ; les prolongations, les trios et les transferts locaux
   appartiennent à UN club et portent donc son code — un DG ne doit jamais
   hériter des unités spéciales ou des échanges d'un autre. */
const CLES_LS = {
  matrices: 'tml_matrices_v1',
  overrides: 'tml_attentes_joueurs_v1',
  proxy: 'tml_proxy_prefere_v1',
  cache: 'tml_cache_v1',
  instantane: 'tml_instantane_ligue_v1',
  club: CLE_CLUB,
  resign: 'tml_resignatures_v1:' + CLUB_ACTIF,
  trios: 'tml_trios_v1:' + CLUB_ACTIF,
  transferts: 'tml_transferts_v1:' + CLUB_ACTIF
};
/* Avant le choix du club, ces trois clés n'existaient qu'en une version, celle
   de TORONTO : on la lui attribue une fois pour toutes plutôt que de la perdre. */
(function migrerClesDuClub(){
  try {
    for (const base of ['tml_resignatures_v1','tml_trios_v1','tml_transferts_v1']){
      const v = localStorage.getItem(base);
      if (v === null) continue;
      if (localStorage.getItem(base + ':TORONTO') === null) localStorage.setItem(base + ':TORONTO', v);
      localStorage.removeItem(base);
    }
  } catch (e){ /* stockage refusé : rien à migrer */ }
})();

/* ------------------ DÉFINITION DES STATS ------------------ */
const STATS_DEF = {
  goals:     {nom:'Buts',        court:'B',    rythme:true },
  gwg:       {nom:'Buts gagnants', court:'GW', rythme:true },
  ppg:       {nom:'Buts en AN',  court:'PP',   rythme:true },
  assists:   {nom:'Passes',      court:'A',    rythme:true },
  pts:       {nom:'Points',      court:'PTS',  rythme:true },
  hits:      {nom:'Mises en échec', court:'MEÉ', rythme:true },
  shots:     {nom:'Tirs au but', court:'T',    rythme:true },
  shotpct:   {nom:'% de tirs (PCTG)', court:'%T', rythme:false, decimales:2 },
  pmrang:    {nom:'Rang +/- au club', court:'+/- rang', rythme:false, decimales:2 },
  hits20:    {nom:'MEÉ / 20 min', court:'MEÉ/20', rythme:false, decimales:2 },
  shots20:   {nom:'Tirs / 20 min', court:'T/20', rythme:false, decimales:2 },
  mg:        {nom:'Minutes / match', court:'MIN/M', rythme:false, decimales:1 },
  mp:        {nom:'Minutes jouées', court:'MIN', rythme:true },
  hs:        {nom:'HS (« head stand »)', court:'HS', rythme:true },
  qggp:      {nom:'DQ / match',  court:'DQ/M', rythme:false, decimales:2 },
  ming:      {nom:'Parties / max permis', court:'MJ/max', rythme:false, decimales:2 },
  psv:       {nom:'Psv (%A × 1000)', court:'Psv', rythme:false, decimales:0 },
  plusminus: {nom:'Différentiel',court:'+/-',  rythme:true, signe:true },
  w:         {nom:'Victoires',   court:'V',    rythme:true },
  avg:       {nom:'Moyenne (GAA)', court:'MOY', rythme:false, decimales:2, inverse:true },
  svpct:     {nom:'% d\'arrêts', court:'%A',   rythme:false, decimales:3 },
  qs:        {nom:'Départs de qualité', court:'DQ', rythme:true }
};

/* Statistiques évaluées par matrice de profil (règlements USHL, tableau 20). */
const STATS_PAR_MATRICE = {
  ELITE:    ['shotpct','gwg','ppg','pts','pmrang'],
  PLAYMAKER:['assists','pts'],
  POWERFWD: ['goals','ppg','hits','shots'],
  TWOWAY:   ['pts','pmrang'],
  SNIPER:   ['goals','gwg','ppg','shots20'],
  GRINDER:  ['hits20'],
  DEFFWD:   ['pmrang','mp'],
  DEPTHFWD: ['mp'],
  DELITEQB: ['ppg','shots','pts'],
  DELITESD: ['hits','pts'],
  DOFF:     ['shots20','pts','mg'],
  DDEF:     ['pmrang','hits20','mg'],
  DDEPTH:   ['mp'],
  STARTER:  ['hs','svpct','qggp','ming'],
  BACKUP:   ['mp','qggp','psv']
};
const NOMS_MATRICES = {
  ELITE:'Elite', PLAYMAKER:'Playmaker', POWERFWD:'Power Forward', TWOWAY:'Two-Way Forward',
  SNIPER:'Sniper', GRINDER:'Grinder', DEFFWD:'Defensive Forward', DEPTHFWD:'Depth Forward',
  DELITEQB:'DElite QB', DELITESD:'DElite Shutdown', DOFF:'DOffensive', DDEF:'DDefensive',
  DDEPTH:'DDepth Defense', STARTER:'Starter Goalie', BACKUP:'Backup Goalie'
};
