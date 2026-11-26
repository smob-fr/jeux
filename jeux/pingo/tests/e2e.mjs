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
const niv = await p.evaluate(() => ({ fin: __pingo.g.finX, long: Pingo.niveau(1, 1).long, total: __pingo.g.total, parfait: __pingo.g.tempsParfait }));
ok(niv.fin === niv.long * 20 && niv.total > 20 && niv.parfait > 5, `niveau 1-1 : ${niv.long} m, ${niv.total} poissons, parcours parfait en ${niv.parfait.toFixed(1)} s`);
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
await p.evaluate(() => { __pingo.g.time += 120; });   // très en retard sur le parcours parfait
await p.waitForSelector("#over:not([hidden])", { timeout: 5000 });
ok((await p.textContent("#again")) === "Réessayer" && (await p.textContent("#over-text")).includes("igloo"), "niveau perdu : « Plouf ! », distance jusqu'à l'igloo, « Réessayer »");
await p.click("#again");
ok((await etat()) === "play" && (await p.evaluate(() => __pingo.g.niveau.id)) === "1-3" && !(await p.isVisible("#nouveau")), "« Réessayer » relance le 1-3, sans redemander la fiche");
await p.click("#b-pause"); await p.click("#b-quitter"); await p.click("#b-carte-retour");

/* ---------- terrain d'essai ---------- */
await p.click("#b-essai");
ok(await p.isVisible("#essai"), "« Terrain d'essai » ouvre ses réglages");
await p.click('[data-essai="russes"]');
await p.fill("#r-hauteur", "350"); await p.dispatchEvent("#r-hauteur", "input");
ok((await p.textContent("#essai-valeurs")).includes("hauteur 350") && (await p.evaluate(() => __pingo.save.essai.vmax)) === 1900, "réglages : préréglage « Montagnes russes », hauteur 350 (enregistrés)");
await p.click("#b-essai-go");
const essai = await p.evaluate(() => ({ mode: __pingo.g.mode, fonte: __pingo.g.fonte, pts: __pingo.g.terrain.pts.slice(4, 8).map((q) => q.y) }));
ok((await etat()) === "play" && essai.mode === "essai" && !essai.fonte && !(await p.isVisible("#melt-meter")) && Math.max(...essai.pts) > 280, `terrain d'essai lancé, sans banquise, bosses hautes (${essai.pts.map(Math.round).join(", ")})`);
await p.waitForTimeout(800);
await p.click("#b-pause");
ok((await p.isVisible("#essai")) && (await p.isVisible("#b-essai-reprendre")) && (await p.textContent("#essai-bilan")).includes("Boum"), "pause : les réglages et le bilan (glisses parfaites, « Boum »)");
await p.click("#b-essai-go");
ok((await etat()) === "play", "« Relancer avec ces réglages »");
await p.click("#b-pause");
// constructeur de bosses : on monte le 1er sommet en le faisant glisser, puis on joue le tracé
const avantHaut = await p.evaluate(() => __pingo.save.editeur ? __pingo.save.editeur.bosses[0].haut : Pingo.EDITEUR.bosses[0].haut);
await p.locator("#editeur").scrollIntoViewIfNeeded();
const pos = await p.evaluate(() => { const c = document.getElementById("editeur"), r = c.getBoundingClientRect(), L = Pingo.pointsEditeur(__pingo.save.editeur || Pingo.EDITEUR).slice(2);
  const x0 = L[0].x - 150, x1 = L[L.length - 1].x + 150, kx = r.width / (x1 - x0), ky = r.height / 940, q = L.find((v) => v.role === "sommet" && v.i === 0);
  return { x: r.left + (q.x - x0) * kx, y: r.top + r.height - (q.y + 420) * ky, ky }; });
await p.mouse.move(pos.x, pos.y); await p.mouse.down(); await p.mouse.move(pos.x, pos.y - 25, { steps: 4 }); await p.mouse.up();
const apresHaut = await p.evaluate(() => __pingo.save.editeur.bosses[0].haut);
ok(apresHaut > avantHaut + 50 && (await p.textContent("#ed-valeurs")).includes(`h${apresHaut}`), `constructeur de bosses : 1er sommet monté de ${avantHaut} à ${apresHaut} en le faisant glisser`);
await p.click("#b-ed-jouer");
const ed = await p.evaluate(() => ({ id: __pingo.g.niveau.id, fonte: __pingo.g.fonte, y0: Math.round(__pingo.p.y), haut: __pingo.save.editeur.depart.haut }));
ok((await etat()) === "play" && ed.id === "editeur" && !ed.fonte && !(await p.isVisible("#melt-meter")) && ed.y0 === ed.haut, `« Jouer ces bosses » : partie sans banquise, départ en haut de la première bosse (y = ${ed.y0})`);
await p.waitForTimeout(600);
await p.click("#b-pause"); await p.click("#b-quitter");
ok((await p.isVisible("#essai")) && (await p.textContent("#essai-bilan")).includes("glisse"), "pause, « Réglages » : retour au constructeur avec le bilan");
await p.fill("#r-marge", "6"); await p.dispatchEvent("#r-marge", "input");
await p.click("#b-test");
const test = await p.evaluate(() => ({ id: __pingo.g.niveau.id, marge: __pingo.g.niveau.marge, construit: !!__pingo.g.niveau.points, parfait: __pingo.g.tempsParfait, poissons: __pingo.g.fishes.length }));
ok((await etat()) === "play" && test.id === "test" && test.marge === 6 && test.construit && test.parfait > 10 && test.poissons > 50, `niveau test (bosses calculées) : banquise à 6 s, parcours parfait en ${test.parfait.toFixed(1)} s, ${test.poissons} poissons`);
await p.evaluate(() => { __pingo.g.time += 120; });
await p.waitForSelector("#over:not([hidden])", { timeout: 5000 });
ok((await p.textContent("#over-menu")) === "Réglages" && !(await p.evaluate(() => "test" in __pingo.save.niveaux)), "niveau test perdu : retour « Réglages », rien d'enregistré dans l'aventure");
await p.click("#over-menu");
ok(await p.isVisible("#essai"), "retour aux réglages du terrain d'essai");
await p.click("#b-essai-accueil");
ok(await p.isVisible("#accueil"), "retour à l'accueil");

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
