#!/usr/bin/env node
// Calcule le parcours du pingouin parfait de chaque niveau (outils/robots.cjs › parfait) et l'écrit
// dans parcours.js : les appuis, un bit par tranche de 0,05 s. Le jeu les rejoue au début du niveau,
// et la banquise suit ce parcours avec « marge » secondes de retard.
// La marge de chaque niveau est aussi calculée : au moins celle prévue dans moteur.js, et au moins le plus
// grand retard (sur le parcours parfait) du joueur visé + 0,5 s : « moyen » dans le monde 1, « joueur »
// dans le monde 2, « expert » dans le monde 3 (outils/robots.cjs › PROFILS).
// À relancer après tout changement de la physique, du relief, des poissons ou des niveaux :
//   npm run parcours            tous les niveaux (~2 min)
//   npm run parcours -- 1-4 2-1 seulement ces niveaux (les autres sont gardés)
// Avec --verifier : ne calcule rien, vérifie que chaque parcours enregistré arrive encore au bout (npm test).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const R = require("./robots.cjs");
const { Pingo } = R;
const FICHIER = fileURLToPath(new URL("../parcours.js", import.meta.url));
const args = process.argv.slice(2);
const verifier = args.includes("--verifier");
const demandes = args.filter((a) => /^\d+-\d+$/.test(a));

const ids = [];
for (const M of Pingo.MONDES) for (let i = 1; i <= Pingo.NIVEAUX_PAR_MONDE; i++) ids.push(`${M.id}-${i}`);
const niv = (id, brut = false) => { const [m, i] = id.split("-").map(Number); return Pingo.niveau(m, i, { brut }); };

if (verifier) {
  let faux = 0;
  for (const id of ids) {
    const n = niv(id);
    if (!n.entrees) { console.log(`✗ ${id} : pas de parcours parfait (npm run parcours)`); faux++; continue; }
    const r = Pingo.rejouer(n);
    if (r.etat !== "gagne") { console.log(`✗ ${id} : le parcours parfait enregistré n'arrive plus au bout (npm run parcours)`); faux++; }
  }
  console.log(faux ? `${faux} parcours à recalculer` : `✓ parcours parfaits : ${ids.length} niveaux, tous arrivent au bout`);
  process.exit(faux ? 1 : 0);
}

const PROFIL = { 1: "moyen", 2: "joueur", 3: "expert" };
// Plus grand retard (s) d'un joueur sur le parcours parfait pendant le niveau (sans banquise).
function retardMax(n, trace) {
  const tAt = (x) => { for (let k = 1; k < trace.length; k++) if (trace[k] >= x) return (k - 1 + (x - trace[k - 1]) / Math.max(1, trace[k] - trace[k - 1])) * Pingo.PAS_TRACE; return trace.length * Pingo.PAS_TRACE; };
  const r = R.expert(n, { ...R.PROFILS[PROFIL[n.monde]], fonte: false, suivi: (g) => tAt(g.p.x) });
  return r.retardMax;
}
const anciens = existsSync(FICHIER) ? require(FICHIER) : {};
for (const k of Object.keys(anciens)) if (typeof anciens[k] !== "object") delete anciens[k];   // ancien format
const table = { ...anciens };
for (const id of demandes.length ? demandes : ids) {
  const n = niv(id, true);
  const t0 = Date.now();
  const r = R.parfait(n);
  const j = Pingo.rejouer(n, r.entrees);
  if (j.etat !== "gagne") { console.log(`✗ ${id} : le pingouin parfait n'arrive pas au bout`); process.exitCode = 1; continue; }
  const retard = retardMax(n, j.trace);
  const marge = Math.round(Math.max(n.marge, retard + 0.5) * 10) / 10;
  table[id] = { e: r.entrees, marge };
  console.log(`${id.padEnd(5)} ${j.temps.toFixed(1).padStart(5)} s, ${j.parfaits} glisses parfaites, ${j.boums} « Boum », retard du joueur « ${PROFIL[n.monde]} » ${retard.toFixed(1)} s → marge ${marge} s (prévue ${n.marge}) (calcul ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
const lignes = ids.filter((id) => table[id]).map((id) => `  "${id}": { marge: ${table[id].marge}, e: "${table[id].e}" },`);
writeFileSync(FICHIER, `// Parcours du pingouin parfait de chaque niveau : marge (s) et appuis (e) par tranche de 0,05 s, en hexadécimal.
// Fichier écrit par outils/parcours-parfaits.mjs (npm run parcours) : ne pas modifier à la main.
(function (racine) {
const PARCOURS = {
${lignes.join("\n")}
};
if (typeof module !== "undefined" && module.exports) module.exports = PARCOURS;
else racine.PINGO_PARCOURS = PARCOURS;
})(typeof window !== "undefined" ? window : globalThis);
`);
console.log(`parcours.js écrit (${lignes.length} niveaux)`);
