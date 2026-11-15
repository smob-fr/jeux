#!/usr/bin/env node
// Test de fumée du prototype Pingo Glisse (Chromium piloté par Playwright) :
// le menu tourne tout seul, une partie démarre, plonger fait avancer, la banquise finit par rattraper
// un pingouin qui ne fait rien, le record est enregistré. Code de sortie 1 en cas d'échec.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); } catch {
  console.error("Playwright est introuvable. Une seule fois, à la racine du dépôt : npm install && npx playwright install chromium");
  process.exit(2);
}
const WWW = resolve(dirname(fileURLToPath(import.meta.url)), "..", "www");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css" };
const srv = http.createServer(async (q, r) => {
  let f = q.url.split("?")[0]; if (f.endsWith("/")) f += "index.html";
  try { const d = await readFile(join(WWW, f)); r.writeHead(200, { "Content-Type": TYPES[extname(f)] || "application/octet-stream" }); r.end(d); }
  catch { r.writeHead(404); r.end(); }
});
await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
let echecs = 0;
const ok = (c, m) => { console.log(`${c ? "✓" : "✗"} ${m}`); if (!c) echecs++; };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 780 }, hasTouch: true });
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
// pas de police externe dans les tests (la page reste jouable sans elle)
await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
// statistiques : envoi autorisé pour ce test, mais intercepté (rien ne part vers PostHog)
const envois = [];
await p.addInitScript(() => { window.KIT_STATS_TEST = true; });
await p.route("https://eu.i.posthog.com/**", async (r) => { envois.push(JSON.parse(r.request().postData())); await r.fulfill({ status: 200, body: "{}" }); });
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
await p.evaluate(() => Kit.Stats.flush()); await p.waitForTimeout(300);
const ev = envois.flatMap((e) => e.batch), fin = ev.find((e) => e.event === "run_end");
ok(["session_start", "run_start", "run_end"].every((n) => ev.some((e) => e.event === n)) && fin.properties.jeu === "pingo" && fin.properties.m === record,
  `statistiques : session_start, run_start, run_end (${fin ? fin.properties.m + " m, " + fin.properties.fish + " poissons" : "absent"})`);
await p.click("#again");
ok((await p.evaluate(() => __pingo.state)) === "play", "« Rejouer » relance une partie");
 // le joueur coupe les statistiques sur l'écran de départ
await p.evaluate(() => { document.getElementById("start").hidden = false; });
await p.click("#stats-btn");
const avant = envois.length;
await p.evaluate(() => { Kit.Stats.track("essai"); Kit.Stats.flush(); }); await p.waitForTimeout(300);
ok((await p.textContent("#stats-btn")).includes("coupées") && !envois.slice(avant).flatMap((e) => e.batch).some((e) => e.event === "essai"), "statistiques coupées : plus aucun envoi");
ok(!errs.length, "aucune erreur dans la page" + (errs.length ? " : " + errs.join(" | ") : ""));
await b.close(); srv.close();
console.log(echecs ? `\n${echecs} échec(s)` : "\nTout passe.");
process.exit(echecs ? 1 : 0);
