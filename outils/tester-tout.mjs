#!/usr/bin/env node
// Lance tous les tests du dépôt : tests du kit, conventions communes, puis « npm test » de chaque jeu.
//
//   node outils/tester-tout.mjs              tout
//   node outils/tester-tout.mjs melopop max  seulement ces jeux (le kit et les conventions sont toujours testés)
//
// Code de sortie 1 si une étape échoue.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { listerJeux } from "./verifier-jeux.mjs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const etapes = [];

function lancer(titre, cmd, args, cwd) {
  console.log(`\n━━ ${titre}`);
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  const ok = r.status === 0;
  etapes.push({ titre, ok, s: Math.round((Date.now() - t0) / 1000) });
  return ok;
}

const demandes = process.argv.slice(2);
const jeux = demandes.length ? demandes : listerJeux();

if (existsSync(join(RACINE, "kit", "tests"))) lancer("Kit", process.execPath, ["--test", "kit/tests/"], RACINE);
lancer("Conventions", process.execPath, ["outils/verifier-jeux.mjs", ...jeux], RACINE);
for (const n of jeux) {
  const d = join(RACINE, "jeux", n);
  if (!existsSync(join(d, "package.json"))) { etapes.push({ titre: n, ok: false, s: 0 }); continue; }
  const pkg = JSON.parse(readFileSync(join(d, "package.json"), "utf8"));
  if (!pkg.scripts?.test) { etapes.push({ titre: `${n} (pas de script test)`, ok: false, s: 0 }); continue; }
  lancer(`Jeu ${n}`, "npm", ["test", "--silent"], d);
}

console.log("\n━━ Bilan");
for (const e of etapes) console.log(`${e.ok ? "✓" : "✗"} ${e.titre} (${e.s} s)`);
const echecs = etapes.filter((e) => !e.ok).length;
console.log(echecs ? `\n${echecs} étape(s) en échec` : "\nTout passe.");
process.exit(echecs ? 1 : 0);
