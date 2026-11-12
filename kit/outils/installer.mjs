#!/usr/bin/env node
// Installe le kit dans le dossier web d'un jeu, avec la configuration de son jeu.json.
//
//   node kit/outils/installer.mjs <dossier du jeu> <destination>            modules ES
//   node kit/outils/installer.mjs <dossier du jeu> <destination> --global   un seul script classique
//
// Modules ES : copie kit/*.js et kit/styles/ dans <destination>, plus jeu.js (export default de jeu.json).
//   Le jeu fait : import JEU from "../kit/jeu.js"; import { configurer, … } from "../kit/index.js"; configurer(JEU);
// Global : écrit <destination>/kit.js (définit window.Kit, déjà configuré avec jeu.json) et
//   <destination>/kit.css, à inclure avec <script src> et <link>, ou à intégrer dans un fichier unique.
// Les copies installées sont générées : ne jamais les modifier, ni les versionner.
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const KIT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENTETE = "// Copie générée par kit/outils/installer.mjs : ne pas modifier (modifier kit/ puis reconstruire).\n";

/** Lit jeux/<nom>/jeu.json. */
export function lireJeu(dossierJeu) {
  return JSON.parse(readFileSync(join(dossierJeu, "jeu.json"), "utf8"));
}

/** Modules du kit (sans index.js), dans l'ordre de leurs dépendances. */
export function modulesOrdonnes() {
  const fichiers = readdirSync(KIT).filter((f) => f.endsWith(".js") && f !== "index.js");
  const deps = {};
  for (const f of fichiers) {
    const src = readFileSync(join(KIT, f), "utf8");
    deps[f] = [...src.matchAll(/^import\s.*from\s+"\.\/([\w-]+\.js)";?\s*$/gm)].map((m) => m[1]);
  }
  const ordre = [], vus = new Set(), enCours = new Set();
  const visiter = (f) => {
    if (vus.has(f)) return;
    if (enCours.has(f)) throw new Error(`Kit : dépendance circulaire autour de ${f}`);
    enCours.add(f);
    for (const d of deps[f]) {
      if (!deps[d]) throw new Error(`Kit : ${f} importe ${d}, introuvable`);
      visiter(d);
    }
    enCours.delete(f);
    vus.add(f);
    ordre.push(f);
  };
  fichiers.sort().forEach(visiter);
  return ordre;
}

/**
 * Construit le format global : { js, css }. Chaque module est enfermé dans sa propre fonction
 * (ses variables internes ne se mélangent pas), et ses exports sont passés aux modules suivants.
 */
export function construireGlobal(jeu) {
  const noms = [];
  const blocs = modulesOrdonnes().map((f) => {
    let src = readFileSync(join(KIT, f), "utf8");
    if (/^import\s*\{[^}]*$/m.test(src)) throw new Error(`Kit : ${f} contient un import sur plusieurs lignes (non pris en charge)`);
    src = src.replace(/^import\s*\{([^}]*)\}\s*from\s*"\.\/[\w-]+\.js";?\s*$/gm, (_, liste) => {
      if (/\bas\b/.test(liste)) throw new Error(`Kit : ${f} renomme un import (« as »), non pris en charge`);
      return "";
    });
    if (/^\s*import\s/m.test(src)) throw new Error(`Kit : ${f} contient un import non reconnu`);
    const exports = [];
    src = src.replace(/^export\s+(const|let|function|async function|class)\s+([A-Za-z_$][\w$]*)/gm, (_, mot, nom) => {
      exports.push(nom);
      return `${mot} ${nom}`;
    });
    if (/^export\s/m.test(src)) throw new Error(`Kit : ${f} contient un export non reconnu`);
    for (const n of exports) {
      if (noms.includes(n)) throw new Error(`Kit : « ${n} » est exporté par deux modules`);
      noms.push(n);
    }
    return `/* ---- ${f} ---- */\nconst { ${exports.join(", ")} } = (() => {\n${src}\nreturn { ${exports.join(", ")} };\n})();`;
  });
  const js = `${ENTETE}// Kit commun, format global : window.Kit. Jeu : ${jeu.nom} ${jeu.version}.
(function () {
"use strict";
${blocs.join("\n\n")}

configurer(${JSON.stringify(jeu)});
window.Kit = Object.freeze({ ${noms.join(", ")} });
})();
`;
  const css = readFileSync(join(KIT, "styles", "base.css"), "utf8");
  return { js, css, noms };
}

/** Copie le kit en modules ES dans `dest`, avec jeu.js. */
export function installerModules(jeu, dest) {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(join(dest, "styles"), { recursive: true });
  for (const f of readdirSync(KIT).filter((f) => f.endsWith(".js"))) {
    writeFileSync(join(dest, f), ENTETE + readFileSync(join(KIT, f), "utf8"));
  }
  cpSync(join(KIT, "styles"), join(dest, "styles"), { recursive: true });
  writeFileSync(join(dest, "jeu.js"), `${ENTETE}// Configuration du jeu, reprise de jeu.json.\nexport default ${JSON.stringify(jeu, null, 2)};\n`);
}

/** Écrit kit.js et kit.css (format global) dans `dest`. */
export function installerGlobal(jeu, dest) {
  const { js, css } = construireGlobal(jeu);
  mkdirSync(dest, { recursive: true });
  writeFileSync(join(dest, "kit.js"), js);
  writeFileSync(join(dest, "kit.css"), `/* Copie générée par kit/outils/installer.mjs : ne pas modifier. */\n${css}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const global = args.includes("--global");
  const [dossierJeu, dest] = args.filter((a) => !a.startsWith("--"));
  if (!dossierJeu || !dest) {
    console.error("Usage : node kit/outils/installer.mjs <dossier du jeu> <destination> [--global]");
    process.exit(2);
  }
  const jeu = lireJeu(resolve(dossierJeu));
  if (global) installerGlobal(jeu, resolve(dest));
  else installerModules(jeu, resolve(dest));
  console.log(`Kit installé pour ${jeu.nom} dans ${dest} (${global ? "script global" : "modules ES"})`);
}
