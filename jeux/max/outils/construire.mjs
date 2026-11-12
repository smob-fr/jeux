#!/usr/bin/env node
// Construit Max et l'Œil de Jade :
// 1. installe le kit commun (format global) dans kit/, pour jouer et tester depuis la racine du jeu ;
// 2. copie le jeu et le kit dans www/, le dossier web de l'appli (webDir de Capacitor) et du site.
// Les niveaux (levels.js) sont générés à part : python3 outils/niveaux.py.
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
execFileSync(process.execPath, [join(RACINE, "../../kit/outils/installer.mjs"), RACINE, join(RACINE, "kit"), "--global"], { stdio: "inherit" });
const WWW = join(RACINE, "www");
rmSync(WWW, { recursive: true, force: true });
mkdirSync(WWW);
for (const f of ["index.html", "game.js", "levels.js", "mondes.js", "sw.js", "manifest.webmanifest", ".nojekyll", "icons", "images", "kit"]) {
  cpSync(join(RACINE, f), join(WWW, f), { recursive: true });
}
console.log("www/ prêt");
