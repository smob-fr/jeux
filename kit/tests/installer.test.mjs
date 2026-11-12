// Tests de kit/outils/installer.mjs : format modules ES et format global (window.Kit).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import { construireGlobal, installerModules, modulesOrdonnes, KIT } from "../outils/installer.mjs";

const JEU = { id: "essai", nom: "Essai", version: "1.0", admob: { test: true }, produits: [] };
const exportsIndex = () => [...readFileSync(join(KIT, "index.js"), "utf8").matchAll(/export \{([^}]*)\}/g)]
  .flatMap((m) => m[1].split(",").map((s) => s.trim()).filter(Boolean)).sort();

test("ordre des modules : chaque module vient après ceux qu'il importe", () => {
  const ordre = modulesOrdonnes();
  assert.ok(ordre.indexOf("config.js") < ordre.indexOf("ads.js"));
  assert.ok(ordre.indexOf("ads.js") < ordre.indexOf("fenetres.js"));
  assert.ok(ordre.indexOf("boutique.js") < ordre.indexOf("reglages.js"));
  assert.ok(!ordre.includes("index.js"));
});

test("format global : un script valide qui expose exactement les noms de kit/index.js, déjà configuré", () => {
  const { js, css, noms } = construireGlobal(JEU);
  assert.deepEqual([...noms].sort(), exportsIndex(), "kit/index.js et le format global exposent les mêmes noms");
  const fenetre = {};
  vm.runInNewContext(js, { window: fenetre, console, setTimeout, clearTimeout, setInterval, clearInterval });
  assert.equal(typeof fenetre.Kit.Ads.maybeInterstitial, "function");
  assert.equal(fenetre.Kit.config().nom, "Essai");
  assert.ok(Object.isFrozen(fenetre.Kit));
  assert.match(css, /\.kit-btn/);
});

test("format modules : tous les fichiers du kit, la feuille de style et jeu.js", async () => {
  const dest = mkdtempSync(join(tmpdir(), "kit-"));
  try {
    installerModules(JEU, dest);
    const fichiers = readdirSync(dest);
    for (const f of readdirSync(KIT).filter((f) => f.endsWith(".js"))) assert.ok(fichiers.includes(f), f);
    assert.ok(readdirSync(join(dest, "styles")).includes("base.css"));
    const jeu = (await import(join(dest, "jeu.js"))).default;
    assert.deepEqual(jeu, JEU);
    const kit = await import(join(dest, "index.js"));
    assert.deepEqual(Object.keys(kit).sort(), exportsIndex());
  } finally { rmSync(dest, { recursive: true, force: true }); }
});
