#!/usr/bin/env node
// Construit le site web de tous les jeux dans _site/ (publié sur GitHub Pages par .github/workflows/pages.yml) :
// pour chaque jeu, « npm run build », puis copie de son dossier web (webDir de capacitor.config.json)
// dans _site/<dossier>/, et une page d'accueil qui liste les jeux.
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { listerJeux } from "./verifier-jeux.mjs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = join(RACINE, "_site");
const echap = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

rmSync(SITE, { recursive: true, force: true });
mkdirSync(SITE, { recursive: true });
const cartes = [];
for (const n of listerJeux()) {
  const d = join(RACINE, "jeux", n);
  const jeu = JSON.parse(readFileSync(join(d, "jeu.json"), "utf8"));
  const cap = JSON.parse(readFileSync(join(d, "capacitor.config.json"), "utf8"));
  console.log(`━━ ${jeu.nom}`);
  const r = spawnSync("npm", ["run", "build", "--silent"], { cwd: d, stdio: "inherit" });
  if (r.status !== 0) { console.error(`Construction de ${n} en échec`); process.exit(1); }
  cpSync(join(d, cap.webDir), join(SITE, n), { recursive: true, dereference: true });
  cartes.push(`<li><a href="${n}/"><b>${echap(jeu.nom)}</b><span>${echap(jeu.description || "")}</span></a></li>`);
}
writeFileSync(join(SITE, ".nojekyll"), "");
writeFileSync(join(SITE, "index.html"), `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Jeux smob-fr</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; font: 16px/1.4 system-ui, sans-serif; background: #17122b; color: #f3eefc; }
  main { max-width: 560px; margin: 0 auto; padding: 32px 16px; }
  h1 { font-size: 28px; }
  ul { list-style: none; padding: 0; display: grid; gap: 12px; }
  a { display: grid; gap: 4px; padding: 16px; border-radius: 16px; background: #2a2148; color: inherit; text-decoration: none; }
  a span { opacity: .75; font-size: 14px; }
</style></head>
<body><main><h1>Jeux smob-fr</h1><p>Versions de test : les pubs et les achats sont simulés.</p>
<ul>${cartes.join("\n")}</ul></main></body></html>
`);
console.log(`\n_site/ prêt (${cartes.length} jeu(x))`);
