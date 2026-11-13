/* ------------------ DONNÉES DE SECOURS ------------------
   Alignement TORONTO RELEVÉ SUR ushl.ca (TeamRosters) le 6 septembre 2026 :
   cotes, OV, âges, salaires et contrats du site, gardiens compris. Sert de
   base hors-ligne, de chiffres par défaut à l'ouverture et de fixture de
   tests. Le site fait toujours foi : l'actualisation au démarrage remplace ce
   bloc dès qu'elle aboutit. Le numéro de chandail n'est pas publié sur la page
   des alignements : il est reporté de main d'homme pour les joueurs déjà au
   club et vaut null pour les arrivées récentes. */
const DATE_SECOURS = '6 septembre 2026';
const SECOURS_ROSTER = [
 {nom:'Mathew Barzal', po:'C', hd:'D', no:null, it:69,sp:86,st:74,en:85,du:83,di:88,sk:93,pa:82,pc:80,df:60,sc:70,ex:80,ld:72, ov:81, age:29, salaire:6250000, ct:5},
 {nom:'Rutger McGroarty', po:'C', hd:'G', no:4, it:82,sp:75,st:81,en:78,du:85,di:71,sk:68,pa:71,pc:71,df:69,sc:77,ex:46,ld:49, ov:78, age:22, salaire:900000, ct:1},
 {nom:'Barrett Hayton', po:'C', hd:'G', no:22, it:71,sp:87,st:81,en:88,du:82,di:78,sk:81,pa:82,pc:77,df:60,sc:77,ex:65,ld:43, ov:81, age:26, salaire:9075000, ct:2},
 {nom:'Connor Bedard', po:'C', hd:'D', no:98, it:72,sp:77,st:71,en:83,du:78,di:80,sk:86,pa:80,pc:83,df:63,sc:85,ex:45,ld:49, ov:82, age:21, salaire:8750000, ct:3},
 {nom:'Fabian Lysell', po:'C', hd:'D', no:null, it:63,sp:86,st:70,en:76,du:71,di:76,sk:83,pa:78,pc:78,df:62,sc:70,ex:51,ld:47, ov:77, age:23, salaire:950000, ct:3},
 {nom:'Vassili Zaitsev', po:'AG', hd:'G', no:70, it:70,sp:86,st:65,en:92,du:81,di:87,sk:84,pa:77,pc:79,df:57,sc:81,ex:60,ld:50, ov:80, age:25, salaire:5750000, ct:3},
 {nom:'Filip Mesar', po:'AG', hd:'D', no:16, it:64,sp:82,st:67,en:74,du:73,di:77,sk:82,pa:77,pc:78,df:59,sc:73,ex:47,ld:47, ov:77, age:22, salaire:900000, ct:1},
 {nom:'Ivan Miroshnichenko', po:'AD', hd:'D', no:13, it:69,sp:78,st:74,en:76,du:72,di:77,sk:78,pa:74,pc:77,df:59,sc:85,ex:50,ld:49, ov:79, age:22, salaire:900000, ct:1},
 {nom:'Matvei Michkov', po:'AD', hd:'G', no:7, it:68,sp:76,st:64,en:84,du:67,di:74,sk:84,pa:83,pc:84,df:62,sc:85,ex:48,ld:46, ov:81, age:22, salaire:7500000, ct:3},
 {nom:'Gabriel Perreault', po:'AD', hd:'G', no:null, it:69,sp:75,st:64,en:72,du:71,di:77,sk:74,pa:76,pc:76,df:64,sc:75,ex:49,ld:37, ov:76, age:21, salaire:975000, ct:2},
 {nom:'Chris Bigras', po:'D', hd:'G', no:10, it:97,sp:79,st:87,en:99,du:93,di:96,sk:89,pa:78,pc:83,df:87,sc:52,ex:74,ld:93, ov:89, age:31, salaire:13750000, ct:1},
 {nom:'Quinn Hughes', po:'D', hd:'G', no:null, it:64,sp:82,st:70,en:89,du:85,di:79,sk:88,pa:85,pc:84,df:70,sc:72,ex:76,ld:78, ov:84, age:27, salaire:12200000, ct:1},
 {nom:'Lian Bichsel', po:'D', hd:'G', no:20, it:83,sp:75,st:85,en:79,du:80,di:63,sk:73,pa:63,pc:63,df:82,sc:54,ex:50,ld:37, ov:78, age:22, salaire:900000, ct:1},
 {nom:'Cam York', po:'D', hd:'G', no:null, it:62,sp:79,st:65,en:84,du:76,di:77,sk:79,pa:78,pc:81,df:68,sc:73,ex:57,ld:49, ov:79, age:25, salaire:3750000, ct:3},
 {nom:'Travis Sanheim', po:'D', hd:'G', no:6, it:86,sp:76,st:83,en:86,du:88,di:78,sk:85,pa:62,pc:74,df:82,sc:60,ex:74,ld:65, ov:82, age:30, salaire:7500000, ct:0},
 {nom:'Ryan Merkley', po:'D', hd:'D', no:42, it:55,sp:89,st:66,en:89,du:83,di:71,sk:89,pa:84,pc:78,df:52,sc:81,ex:63,ld:69, ov:82, age:26, salaire:9075000, ct:2},
 {nom:'Eamon Powell', po:'D', hd:'D', no:43, it:60,sp:80,st:64,en:82,du:72,di:79,sk:75,pa:73,pc:74,df:67,sc:67,ex:55,ld:44, ov:76, age:24, salaire:1875000, ct:1},
 {nom:'Chris Gibson', po:'G', hd:'G', no:41, it:83,sp:91,st:92,en:89,du:83,di:78,sk:90,pa:63,pc:86,df:null,sc:null,ex:89,ld:67, ov:83, age:34, salaire:8450000, ct:1},
 {nom:'Michael Hrabal', po:'G', hd:'G', no:null, it:78,sp:83,st:90,en:71,du:77,di:86,sk:81,pa:65,pc:82,df:null,sc:null,ex:54,ld:48, ov:76, age:21, salaire:900000, ct:2},
 {nom:'Kevin Lankinen', po:'G', hd:'G', no:32, it:84,sp:84,st:80,en:84,du:83,di:85,sk:88,pa:74,pc:80,df:null,sc:null,ex:64,ld:64, ov:79, age:31, salaire:1100000, ct:1}
];

/* Saison de référence Y21 : aucun total Y21 n'est intégré pour TORONTO (les
   compteurs des fichiers de la ligue sont remis à zéro au passage à la Y22).
   L'archive XtraStats téléchargée à l'actualisation sert de référence Y21. */
const SECOURS_Y21 = [];
