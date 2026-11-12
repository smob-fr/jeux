#!/usr/bin/env node
// Test de fumée du prototype Pingo Glisse (Chromium piloté par Playwright) :
// le menu tourne tout seul, une partie démarre, plonger fait avancer, la banquise finit par rattraper
// un pingouin qui ne fait rien, le record est enregistré. Code de sortie 1 en cas d'échec.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); } catch {
  console.error("Playwright est introuvable. Une seule fois, à la racine du dépôt : npm install && npx playwright install chromium");
  process.exit(2);
}
const PAGE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "www", "index.html");
const html = await readFile(PAGE);
const srv = http.createServer((q, r) => { r.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); r.end(html); });
await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
let echecs = 0;
const ok = (c, m) => { console.log(`${c ? "✓" : "✗"} ${m}`); if (!c) echecs++; };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 780 }, hasTouch: true });
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
// pas de police externe dans les tests (la page reste jouable sans elle)
await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
await p.goto(`http://127.0.0.1:${srv.address().port}/`);
await p.waitForTimeout(1500);
const x0 = await p.evaluate(() => __pingo.p.x);
ok(x0 > 0 && (await p.evaluate(() => __pingo.state)) === "menu", `menu : le pingouin glisse tout seul (x = ${Math.round(x0)})`);

await p.click("#play");
ok((await p.evaluate(() => __pingo.state)) === "play" && (await p.isVisible("#hud")), "« Glisser ! » lance une partie, le bandeau est affiché");
// plonger dans les descentes pendant 3 secondes
const debut = await p.evaluate(() => __pingo.p.x);
for (let i = 0; i < 6; i++) { await p.mouse.move(200, 400); await p.mouse.down(); await p.waitForTimeout(350); await p.mouse.up(); await p.waitForTimeout(150); }
const apres = await p.evaluate(() => __pingo.p.x);
const m = parseInt((await p.textContent("#dist")).replace(/\D/g, ""), 10);
ok(apres - debut > 1000 && m > 0, `la partie avance : ${Math.round((apres - debut) / 20)} m en 3 s, ${m} m affichés`);

// sans rien faire, la banquise qui fond finit par rattraper le pingouin
await p.waitForFunction(() => __pingo.state === "over", null, { timeout: 90000 });
await p.waitForSelector("#over:not([hidden])");
const record = await p.evaluate(() => +localStorage.getItem("pingo.best"));
ok(record > 0, `fin de partie : écran « Plouf ! » et record enregistré (${record} m)`);
await p.click("#again");
ok((await p.evaluate(() => __pingo.state)) === "play", "« Rejouer » relance une partie");
ok(!errs.length, "aucune erreur dans la page" + (errs.length ? " : " + errs.join(" | ") : ""));
await b.close(); srv.close();
console.log(echecs ? `\n${echecs} échec(s)` : "\nTout passe.");
process.exit(echecs ? 1 : 0);
