#!/usr/bin/env node
// Calibre la vitesse de la fonte de chaque niveau de l'aventure (à partir du 1-3) avec les robots :
//   Mi = la plus petite vitesse maximale de fonte à laquelle un pingouin qui ne fait rien est rattrapé ;
//   Md = la plus grande à laquelle le débutant et le bon robot arrivent tous les deux au bout ;
//   fonte = Mi + difficulte × (Md − Mi), arrondie à 10.
// Écrit la table CALIBRAGE dans moteur.js. À relancer après tout changement de la physique, du relief
// ou des niveaux : npm run calibrer. Avec --verifier : n'écrit rien, code de sortie 1 si la table n'est
// plus à jour (utilisé par npm test).
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const R = require("./robots.cjs");
const { Pingo } = R;
const FICHIER = fileURLToPath(new URL("../moteur.js", import.meta.url));
const verifier = process.argv.includes("--verifier");

const arrive = (spec, max, robot) => R.jouer({ niveau: { ...spec, fonte: { ...Pingo.FONTE_NIVEAU, max } } }, robot()).etat === "gagne";
// Recherche par dichotomie sur [400, 2600], au pas de 10 (on suppose que plus la fonte est rapide, plus c'est dur).
function chercher(test) {     // plus petite valeur pour laquelle test(v) est vrai
  let a = 400, b = 2600;
  if (!test(b)) return Infinity;
  if (test(a)) return a;
  while (b - a > 10) { const m = Math.round((a + b) / 20) * 10; if (test(m)) b = m; else a = m; }
  return b;
}
const table = {}, notes = [];
for (const M of Pingo.MONDES) for (let i = 1; i <= Pingo.NIVEAUX_PAR_MONDE; i++) {
  const spec = Pingo.niveau(M.id, i);
  if (spec.difficulte == null) continue;                 // niveau réglé à la main
  const Mi = chercher((v) => !arrive(spec, v, R.rien));
  const Md = chercher((v) => !(arrive(spec, v, R.debutant) && arrive(spec, v, R.bon))) - 10;
  let v;
  if (Md >= Mi) v = Math.round((Mi + spec.difficulte * (Md - Mi)) / 10) * 10;
  else { v = Md; notes.push(`${spec.id} : impossible de séparer (sans rien faire perdu à ${Mi}, débutant gagnant jusqu'à ${Md})`); }
  table[spec.id] = v;
  if (!verifier) console.log(`${spec.id.padEnd(5)} fourchette ${Mi}–${Md}, difficulté ${spec.difficulte} → fonte ${v}`);
}
const src = readFileSync(FICHIER, "utf8");
const debut = src.indexOf("const CALIBRAGE = "), fin = src.indexOf("// CALIBRAGE : fin");
const lignes = Object.entries(table).map(([k, v]) => `"${k}": ${v}`);
const bloc = "const CALIBRAGE = {\n" + lignes.reduce((acc, l, k) => acc + (k % 8 === 0 ? (k ? ",\n  " : "  ") : ", ") + l, "") + ",\n};\n";
const nouveau = src.slice(0, debut) + bloc + src.slice(fin);
for (const n of notes) console.log("! " + n);
if (verifier) {
  if (nouveau !== src) { console.log("✗ la table CALIBRAGE de moteur.js n'est plus à jour : lancer npm run calibrer"); process.exit(1); }
  console.log("✓ calibrage de la fonte à jour");
} else {
  writeFileSync(FICHIER, nouveau);
  console.log(`table CALIBRAGE écrite dans moteur.js (${lignes.length} niveaux)`);
}
