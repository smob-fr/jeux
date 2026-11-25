#!/usr/bin/env node
// Vérifie tous les niveaux de l'aventure avec les pingouins robots (outils/robots.cjs). La banquise suit
// le parcours du pingouin parfait (parcours.js) avec « marge » secondes de retard. Règles :
// - le parcours parfait arrive au bout, en 12 à 75 s ;
// - un joueur qui prévoit (outils/robots.cjs › PROFILS) arrive au bout : « moyen » (voit 0,6 s devant,
//   réagit en 0,2 s) dans le monde 1, « joueur » (0,8 s, 0,15 s) dans le monde 2, « expert » (1,2 s, 0,1 s)
//   dans le monde 3 ;
// - au 1-1, le bon robot (celui que suivent les bulles d'aide) arrive au bout sans aucun « Boum » ;
// - à partir du 1-3, un pingouin qui ne fait rien se fait rattraper ;
// - au moins 20 poissons par niveau ;
// - sans fin : le débutant ne fait aucun « Boum » sur les 300 premiers mètres.
// Affiche un tableau avec --detail. Code de sortie 1 si une règle n'est pas tenue.
import { createRequire } from "node:module";
const R = createRequire(import.meta.url)("./robots.cjs");
const { Pingo } = R;
const detail = process.argv.includes("--detail");
let erreurs = 0;
const faux = (msg) => { console.log("✗ " + msg); erreurs++; };
const court = (r, n) => (r.etat === "gagne" ? "✓" : `✗ ${Math.round(100 * r.m / n.long)} %`).padEnd(6);
const PROFIL = { 1: "moyen", 2: "joueur", 3: "expert" };
if (detail) console.log("niveau  long. marge │ parfait                   │ profil        │ bon     débutant rien   (bon, débutant : robots à règles simples, pour information)");
for (const M of Pingo.MONDES) {
  for (let i = 1; i <= Pingo.NIVEAUX_PAR_MONDE; i++) {
    const n = Pingo.niveau(M.id, i);
    if (!n.entrees) { faux(`${n.id} : pas de parcours parfait (npm run parcours)`); continue; }
    const pf = Pingo.rejouer(n);
    const ex = R.expert(n, R.PROFILS[PROFIL[M.id]]);
    const total = Pingo.creerPartie({ niveau: n, rejeu: true }).total;
    const d = R.jouer({ niveau: n }, R.debutant()), b = R.jouer({ niveau: n }, R.bon()), r = R.jouer({ niveau: n }, R.rien());
    if (detail) console.log(`${n.id.padEnd(6)} ${String(n.long).padStart(5)} ${String(n.marge).padStart(4)} s │ ${pf.temps.toFixed(1).padStart(5)} s P${String(pf.parfaits).padEnd(2)} B${String(pf.boums).padEnd(2)} 🐟${String(pf.score).padStart(3)}/${total} │ ${PROFIL[M.id].padEnd(6)} ${court(ex, n)} │ ${court(b, n)}  ${court(d, n)}   ${court(r, n)}`);
    if (pf.etat !== "gagne") faux(`${n.id} : le parcours parfait n'arrive pas au bout`);
    if (pf.temps < 12 || pf.temps > 75) faux(`${n.id} : parcours parfait en ${pf.temps.toFixed(0)} s (hors de 12 à 75 s)`);
    if (ex.etat !== "gagne") faux(`${n.id} : le joueur « ${PROFIL[M.id]} » n'arrive pas au bout (${ex.m} m sur ${n.long})`);
    if (M.id === 1 && i === 1 && (b.etat !== "gagne" || b.atter.boum + b.atter.tete > 0)) faux(`${n.id} : le bon robot n'y arrive pas sans « Boum » (${b.etat}, ${b.atter.boum} « Boum »)`);
    if ((M.id > 1 || i >= 3) && r.etat === "gagne") faux(`${n.id} : un pingouin qui ne fait rien arrive au bout`);
    if (total < 20) faux(`${n.id} : trop peu de poissons (${total})`);
  }
}
// Mode sans fin : départ facile, le débutant ne fait pas de « Boum » sur les 300 premiers mètres.
for (const graine of [1, 2, 3, 4, 5]) {
  let boum = 0;
  const g = Pingo.creerPartie({ graine, on: (t, x) => { if (t === "atterrissage" && (x.type === "boum" || x.type === "tete") && g.m < 300) boum++; } });
  const robot = R.debutant();
  while (g.etat === "jeu" && g.m < 320) { g.hold = robot(g); g.step(Pingo.SOUS_PAS); }
  if (boum) faux(`sans fin (graine ${graine}) : ${boum} « Boum » dans les 300 premiers mètres`);
}
console.log(erreurs ? `\n${erreurs} problème(s) dans les niveaux` : `✓ niveaux : ${Pingo.MONDES.length * Pingo.NIVEAUX_PAR_MONDE} niveaux vérifiés, départ du mode sans fin facile`);
process.exit(erreurs ? 1 : 0);
