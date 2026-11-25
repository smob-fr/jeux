#!/usr/bin/env node
// Test de bout en bout de Pingo Glisse (Chromium piloté par Playwright) : accueil avec démonstration,
// mode sans fin (plonger fait avancer, la banquise rattrape un pingouin qui ne fait rien, record),
// pause, aventure (carte, niveau gagné, étoiles, niveau suivant débloqué, fiche « Nouveau ! », niveau
// perdu), reprise de l'ancien record, statistiques. Code de sortie 1 en cas d'échec.
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
const p = await b.newPage({ viewport: { width: 390, height: 780 }, hasTouch: true, reducedMotion: "reduce" });
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
// pas de police externe dans les tests (la page reste jouable sans elle)
await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
// un joueur de l'ancienne version : seulement le record, dans l'ancienne clé
await p.addInitScript(() => { if (!localStorage.getItem("pingo.v1")) localStorage.setItem("pingo.best", "123"); });
// statistiques : envoi autorisé pour ce test, mais intercepté (rien ne part vers PostHog)
const envois = [];
await p.addInitScript(() => { window.KIT_STATS_TEST = true; });
await p.route("https://eu.i.posthog.com/**", async (r) => { envois.push(JSON.parse(r.request().postData())); await r.fulfill({ status: 200, body: "{}" }); });
const evenements = async () => { await p.evaluate(() => Kit.Stats.flush()); await p.waitForTimeout(300); return envois.flatMap((e) => e.batch); };
const etat = () => p.evaluate(() => __pingo.state);
await p.goto(`http://127.0.0.1:${srv.address().port}/`);
await p.waitForTimeout(1500);

/* ---------- accueil ---------- */
const x0 = await p.evaluate(() => __pingo.p.x);
ok(x0 > 0 && (await etat()) === "menu" && (await p.isVisible("#accueil")), `accueil : le pingouin glisse tout seul derrière (x = ${Math.round(x0)})`);
ok((await p.textContent("#sansfin-info")).includes("123"), "ancien record (pingo.best) repris : « " + (await p.textContent("#sansfin-info")) + " »");

/* ---------- sans fin ---------- */
await p.click("#b-sansfin");
ok((await etat()) === "play" && (await p.isVisible("#hud")) && !(await p.isVisible("#goal-meter")), "« Sans fin » lance une partie, le bandeau est affiché (sans jauge d'igloo)");
const debut = await p.evaluate(() => __pingo.p.x);
for (let i = 0; i < 6; i++) { await p.mouse.move(200, 400); await p.mouse.down(); await p.waitForTimeout(350); await p.mouse.up(); await p.waitForTimeout(150); }
const apres = await p.evaluate(() => __pingo.p.x);
const m = parseInt((await p.textContent("#dist")).replace(/\D/g, ""), 10);
ok(apres - debut > 1000 && m > 0, `la partie avance : ${Math.round((apres - debut) / 20)} m en 3 s, ${m} m affichés`);
const poissons = await p.evaluate(() => __pingo.g.fishes.reduce((n, f) => ({ ...n, [f.type]: (n[f.type] || 0) + 1 }), {}));
ok((poissons.normal || 0) > 10, `poissons sur la glissade : ${JSON.stringify(poissons)}`);

// sans rien faire, la banquise qui fond finit par rattraper le pingouin
await p.waitForFunction(() => __pingo.state === "over", null, { timeout: 90000 });
await p.waitForSelector("#over:not([hidden])");
const best = await p.evaluate(() => __pingo.save.best);
let ev = await evenements();
const fin = ev.find((e) => e.event === "run_end");
ok(best >= 123 && fin && fin.properties.m > 0 && (await p.textContent("#again")) === "Rejouer", `fin de partie : écran « Plouf ! », record ${best} m (partie : ${fin ? fin.properties.m : "?"} m)`);
ok(["session_start", "run_start", "run_end"].every((n) => ev.some((e) => e.event === n)) && fin.properties.jeu === "pingo",
  `statistiques : session_start, run_start, run_end (${fin ? fin.properties.m + " m, " + fin.properties.score + " poissons" : "absent"})`);
await p.click("#again");
ok((await etat()) === "play", "« Rejouer » relance une partie");
await p.click("#b-pause");
ok((await etat()) === "pause" && (await p.isVisible("#pause")), "pause pendant la partie");
const xp = await p.evaluate(() => __pingo.p.x); await p.waitForTimeout(400);
ok(xp === (await p.evaluate(() => __pingo.p.x)), "en pause, le pingouin ne bouge plus");
await p.click("#b-reprendre");
ok((await etat()) === "play", "« Reprendre »");
await p.click("#b-pause"); await p.click("#b-quitter");
ok((await p.isVisible("#accueil")) && (await etat()) === "menu", "« Quitter » ramène à l'accueil");

/* ---------- aventure ---------- */
await p.click("#b-aventure");
ok(await p.isVisible("#carte"), "« Aventure » ouvre la carte");
const libres = await p.$$eval(".niv:not(.verrou)", (l) => l.map((b) => b.dataset.niveau));
ok(libres.length === 1 && libres[0] === "1-1" && (await p.$$(".niv")).length === 30, `carte : 30 niveaux, seul le 1-1 est ouvert (${libres.join(", ")})`);
await p.click('[data-niveau="1-1"]');
ok((await etat()) === "play" && (await p.isVisible("#goal-meter")), "niveau 1-1 lancé, jauge de l'igloo affichée");
const niv = await p.evaluate(() => ({ fin: __pingo.g.finX, total: __pingo.g.total, aide: !!document }));
ok(niv.fin === 800 * 20 && niv.total > 20, `niveau 1-1 : 800 m, ${niv.total} poissons à ramasser`);
// on amène le pingouin juste avant le drapeau : il arrive à l'igloo
await p.evaluate(() => { const g = __pingo.g; g.meltX = g.finX - 2500; g.p.x = g.finX - 200; g.p.y = g.terrain.h(g.p.x); g.p.ground = true; g.score = Math.ceil(g.total * 0.65); });
await p.waitForFunction(() => __pingo.state === "win", null, { timeout: 10000 });
await p.waitForSelector("#win:not([hidden])");
const et = await p.$$eval("#win-stars .on", (l) => l.length);
const sauve = await p.evaluate(() => __pingo.save.niveaux["1-1"]);
ok(et === 3 && sauve === 3, `niveau gagné : écran « Bravo ! », ${et} étoiles affichées, ${sauve} enregistrées`);
ev = await evenements();
ok(ev.some((e) => e.event === "level_start" && e.properties.level === "1-1") && ev.some((e) => e.event === "level_win" && e.properties.level === "1-1" && e.properties.etoiles === 3), "statistiques : level_start et level_win (1-1, 3 étoiles)");
await p.click("#b-suivant");
ok((await etat()) === "play" && (await p.evaluate(() => __pingo.g.niveau.id)) === "1-2", "« Niveau suivant » lance le 1-2");
await p.click("#b-pause"); await p.click("#b-quitter");
ok(await p.isVisible("#carte"), "quitter un niveau ramène à la carte");
ok(!(await p.$eval('[data-niveau="1-2"]', (b) => b.disabled)) && (await p.$eval('[data-niveau="1-3"]', (b) => b.disabled)), "le 1-2 est débloqué, pas encore le 1-3");
ev = await evenements();
ok(ev.some((e) => e.event === "level_quit" && e.properties.level === "1-2"), "statistiques : level_quit en quittant le 1-2");

// le 1-3 présente le poisson bleu avec une fiche « Nouveau ! »
await p.evaluate(() => { __pingo.save.niveaux["1-2"] = 1; });
await p.click("#b-carte-retour"); await p.click("#b-aventure");
await p.click('[data-niveau="1-3"]');
ok((await p.isVisible("#nouveau")) && (await p.textContent("#nouveau-titre")).includes("bleu"), "1-3 : fiche « Nouveau ! » du poisson bleu");
await p.click("#b-nouveau-ok");
ok((await etat()) === "play" && (await p.evaluate(() => __pingo.g.fishes.some((f) => f.type === "bleu"))), "1-3 lancé, avec des poissons bleus");
// perdu : la banquise rattrape le pingouin
await p.evaluate(() => { const g = __pingo.g; g.meltX = g.p.x - 5; });
await p.waitForSelector("#over:not([hidden])", { timeout: 5000 });
ok((await p.textContent("#again")) === "Réessayer" && (await p.textContent("#over-text")).includes("igloo"), "niveau perdu : « Plouf ! », distance jusqu'à l'igloo, « Réessayer »");
await p.click("#again");
ok((await etat()) === "play" && (await p.evaluate(() => __pingo.g.niveau.id)) === "1-3" && !(await p.isVisible("#nouveau")), "« Réessayer » relance le 1-3, sans redemander la fiche");
await p.click("#b-pause"); await p.click("#b-quitter"); await p.click("#b-carte-retour");

/* ---------- réglages de l'accueil ---------- */
await p.click("#b-son");
ok((await p.textContent("#b-son")) === "Son : non" && (await p.evaluate(() => __pingo.save.son)) === false, "son coupé depuis l'accueil (enregistré)");
await p.click("#stats-btn");
const avant = envois.length;
await p.evaluate(() => { Kit.Stats.track("essai"); Kit.Stats.flush(); }); await p.waitForTimeout(300);
ok((await p.textContent("#stats-btn")).includes("coupées") && !envois.slice(avant).flatMap((e) => e.batch).some((e) => e.event === "essai"), "statistiques coupées : plus aucun envoi");

// la progression survit au rechargement
await p.reload(); await p.waitForTimeout(800);
const apresRechargement = await p.evaluate(() => ({ n: __pingo.save.niveaux["1-1"], son: __pingo.save.son, best: __pingo.save.best }));
ok(apresRechargement.n === 3 && apresRechargement.son === false && apresRechargement.best === best, "sauvegarde pingo.v1 relue après rechargement");
ok(!errs.length, "aucune erreur dans la page" + (errs.length ? " : " + errs.join(" | ") : ""));
await b.close(); srv.close();
console.log(echecs ? `\n${echecs} échec(s)` : "\nTout passe.");
process.exit(echecs ? 1 : 0);
