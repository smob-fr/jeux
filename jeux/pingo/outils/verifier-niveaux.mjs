#!/usr/bin/env node
// Vérifie les 30 niveaux de l'aventure (construits par outils/construire-niveaux.mjs). La banquise suit le
// parcours du pingouin parfait avec « marge » secondes de retard. Règles :
// - le parcours parfait arrive au bout, en 12 à 75 s, sans « Boum » au 1-1 ;
// - aucune pente trop raide (plus de 1,1, environ 48°) : pas de montée qui se casse brutalement ;
// - le « bon » robot (règles simples, ce que disent les bulles d'aide) arrive au bout des 5 premiers
//   niveaux, sans aucun « Boum » au 1-1 ;
// - à partir du 1-2, un pingouin qui ne fait rien se fait rattraper ;
// - au moins 20 poissons par niveau ;
// - sans fin : le débutant ne fait aucun « Boum » sur les 300 premiers mètres.
// Affiche un tableau avec --detail. Code de sortie 1 si une règle n'est pas tenue.
import { createRequire } from "node:module";
const R = createRequire(import.meta.url)("./robots.cjs");
const { Pingo } = R;
const detail = process.argv.includes("--detail");
let erreurs = 0;
const faux = (msg) => { console.log("✗ " + msg); erreurs++; };
const court = (r, n) => (r.etat === "gagne" ? "✓" : `✗ ${Math.round(100 * r.m / n.long)} %`).padEnd(7);
if (detail) console.log("niveau  long.  marge │ parfait                 │ sauts eau pente │ bon     débutant rien");
for (const M of Pingo.MONDES) {
  for (let i = 1; i <= Pingo.NIVEAUX_PAR_MONDE; i++) {
    const n = Pingo.niveau(M.id, i);
    if (!n) { faux(`${M.id}-${i} : pas construit (npm run construire)`); continue; }
    const pf = Pingo.rejouer(n);
    let pente = 0;
    const T = Pingo.creerPartie({ niveau: n, rejeu: true }).terrain;
    for (let x = 0; x < n.long * Pingo.PX_PER_M; x += 25) pente = Math.max(pente, Math.abs(T.pente(x)));
    const b = R.jouer({ niveau: n }, R.bon()), d = R.jouer({ niveau: n }, R.debutant()), r = R.jouer({ niveau: n }, R.rien());
    const total = n.poissonsFixes.reduce((s, [, , t]) => s + Pingo.POISSONS[t].valeur, 0);
    if (detail) console.log(`${n.id.padEnd(6)} ${String(n.long).padStart(5)} ${String(n.marge).padStart(4)} s │ ${pf.temps.toFixed(1).padStart(5)} s P${String(pf.parfaits).padEnd(2)} B${pf.boums} 🐟${String(total).padStart(4)} │ ${String(n.sauts ?? "?").padStart(4)} ${String(n.eaux.length).padStart(3)} ${pente.toFixed(2)} │ ${court(b, n)} ${court(d, n)}  ${court(r, n)}`);
    if (pf.etat !== "gagne") faux(`${n.id} : le parcours parfait n'arrive pas au bout`);
    if (pf.temps < 12 || pf.temps > 75) faux(`${n.id} : parcours parfait en ${pf.temps.toFixed(0)} s (hors de 12 à 75 s)`);
    if (n.id === "1-1" && pf.boums) faux(`1-1 : le parcours parfait fait des « Boum »`);
    if (pente > 1.1) faux(`${n.id} : pente trop raide (${pente.toFixed(2)})`);
    if (M.id === 1 && i <= 5 && b.etat !== "gagne") faux(`${n.id} : le bon robot n'arrive pas au bout (${b.m} m sur ${n.long})`);
    if (n.id === "1-1" && b.atter.boum + b.atter.tete > 0) faux(`1-1 : le bon robot fait ${b.atter.boum} « Boum »`);
    if ((M.id > 1 || i >= 2) && r.etat === "gagne") faux(`${n.id} : un pingouin qui ne fait rien arrive au bout`);
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
