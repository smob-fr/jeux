#!/usr/bin/env node
// Tests de bout en bout de Mélo Pop, dans Chromium piloté par Playwright.
//
//   node tests/e2e.mjs            tous les tests
//   node tests/e2e.mjs boutique   seulement les tests dont le nom contient « boutique »
//
// Le script sert lui-même le dossier www/ (les modules ES ne marchent pas en file://), ouvre une page
// neuve par test, avec une sauvegarde préparée, et pilote le jeu comme un joueur (souris, doigt).
// Code de sortie : 0 si tout passe, 1 sinon.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); } catch {
  console.error("Playwright est introuvable. Une seule fois, à la racine du dépôt : npm install && npx playwright install chromium");
  process.exit(2);
}

const WWW = resolve(dirname(fileURLToPath(import.meta.url)), "..", "www"); // construit avec le kit par « npm run build »
const CLE = "melopop.v1";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".woff2": "font/woff2", ".svg": "image/svg+xml" };

function serveur() {
  return new Promise((ok) => {
    const s = http.createServer(async (req, res) => {
      let f = decodeURIComponent(req.url.split("?")[0]);
      if (f.endsWith("/")) f += "index.html";
      const p = join(WWW, f);
      if (!p.startsWith(WWW)) { res.writeHead(403); res.end(); return; }
      try {
        const d = await readFile(p);
        res.writeHead(200, { "Content-Type": TYPES[extname(p)] || "application/octet-stream" });
        res.end(d);
      } catch { res.writeHead(404); res.end(); }
    });
    s.listen(0, "127.0.0.1", () => ok(s));
  });
}

class Echec extends Error {}
const verifier = (cond, msg) => { if (!cond) throw new Echec(msg); };
/** Clic sur un élément visible (les boutons du jeu sont animés, donc jamais « stables » pour Playwright). */
async function clic(page, sel) { await page.waitForSelector(sel, { state: "visible" }); await page.click(sel, { force: true }); }

/* ---------- aides ---------- */
const lireSauvegarde = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}"), CLE);
const accueil = (page) => page.waitForSelector("#home.active", { timeout: 8000 });
const fenetre = (page) => page.waitForSelector("#kit-fenetre.open:not(.closing)");
async function bouton(page, act) {
  await fenetre(page);
  await clic(page, `#kit-fenetre-boite [data-act="${act}"]`);
  await page.waitForTimeout(300);
}
/** Fait glisser une note de la case a vers la case b, à la souris. */
async function glisser(page, a, b) {
  const box = await page.locator("#board").boundingBox();
  const cell = box.width / 8;
  const pos = ([r, c]) => [box.x + (c + 0.5) * cell, box.y + (r + 0.5) * cell];
  const [x1, y1] = pos(a), [x2, y2] = pos(b);
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move(x2, y2, { steps: 6 });
  await page.mouse.up();
}
/** Cherche un échange qui aligne 3 notes, d'après l'état du jeu exposé pour le débogage. */
function trouverCoup(page) {
  return page.evaluate(() => {
    const g = window.__melopop.state.grid.map((row) => row.map((t) => (t ? t.color : null)));
    const N = g.length;
    const at = (r, c) => (r >= 0 && r < N && c >= 0 && c < N ? g[r][c] : null);
    const aligne = (r, c) => {
      const k = at(r, c);
      if (k === null || k < 0) return false;
      let h = 1, v = 1;
      for (let i = c - 1; at(r, i) === k; i--) h++;
      for (let i = c + 1; at(r, i) === k; i++) h++;
      for (let i = r - 1; at(i, c) === k; i--) v++;
      for (let i = r + 1; at(i, c) === k; i++) v++;
      return h >= 3 || v >= 3;
    };
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++)
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          const r2 = r + dr, c2 = c + dc;
          if (r2 >= N || c2 >= N) continue;
          [g[r][c], g[r2][c2]] = [g[r2][c2], g[r][c]];
          const ok = aligne(r, c) || aligne(r2, c2);
          [g[r][c], g[r2][c2]] = [g[r2][c2], g[r][c]];
          if (ok) return [[r, c], [r2, c2]];
        }
    return null;
  });
}
/** Lance le niveau `index` depuis la carte, comme un joueur. */
async function jouerNiveau(page, index) {
  await clic(page, "#play");
  await page.waitForSelector("#map.active");
  await clic(page, `.node[data-level="${index}"]`);
  await bouton(page, "play");
  await page.waitForSelector("#game.active");
  // Présentation de l'objectif, puis le plateau devient jouable.
  await page.waitForFunction(() => !window.__melopop.state.busy && !window.__melopop.state.ended, null, { timeout: 8000 });
}
// Après un coup ou un bonus, les cascades (notes qui tombent, combinaisons en chaîne) durent de 1 à
// plus de 8 s selon le plateau, tiré au hasard : on leur laisse largement le temps de finir.
const FIN_CASCADES = 30000;
const DEJA_JOUE = { tutorialDone: true, boosterTutoDone: true, notif: false, intros: { collect: true, bomb: true, ice: true, star: true, combo: true, ice2: true } };

/* ---------- tests ---------- */
const TESTS = [
  {
    nom: "Premier lancement : le tutoriel guidé se joue jusqu'au bout",
    async run(page) {
      await accueil(page);
      verifier((await page.textContent("#play-label")).includes("Commencer"), "le bouton devrait dire « Commencer »");
      await clic(page, "#play");
      await page.waitForSelector("#game.active");
      // après chaque coup guidé, la bulle suivante n'arrive qu'à la fin des cascades (notes tombées au hasard)
      const suite = async () => { await page.waitForSelector("#kit-tuto-ok", { state: "visible", timeout: FIN_CASCADES }); await clic(page, "#kit-tuto-ok"); await page.waitForTimeout(250); };
      await suite(); await suite(); // objectif, coups
      await page.waitForSelector("#kit-tuto-main:not([hidden])", { state: "attached" });
      await glisser(page, [5, 2], [6, 2]);
      await suite(); // barre de score
      await glisser(page, [2, 6], [3, 6]);
      await suite(); // note rayée
      await glisser(page, [5, 5], [5, 6]);
      await suite(); await suite(); // objectifs, astuces
      await page.waitForFunction(() => document.getElementById("kit-tuto").hidden);
      const s = await lireSauvegarde(page);
      verifier(s.tutorialDone === true, "tutorialDone devrait être enregistré");
      const st = await page.evaluate(() => window.__melopop.state);
      verifier(st.score > 0, "le tutoriel devrait avoir rapporté des points");
      return `score ${st.score}, ${st.moves} coups restants`;
    },
  },
  {
    nom: "Bannière : sur la carte, jamais pendant la partie",
    save: DEJA_JOUE,
    async run(page) {
      await accueil(page);
      verifier(!(await page.evaluate(() => document.body.classList.contains("kit-banniere-simulee"))), "pas de bannière sur l'accueil");
      await clic(page, "#play");
      await page.waitForSelector("#map.active");
      await page.waitForTimeout(200);
      verifier(await page.evaluate(() => document.body.classList.contains("kit-banniere-simulee")), "la bannière devrait être affichée sur la carte");
      await clic(page, '.node[data-level="0"]');
      await bouton(page, "play");
      await page.waitForSelector("#game.active");
      verifier(!(await page.evaluate(() => document.body.classList.contains("kit-banniere-simulee"))), "la bannière ne doit pas être affichée pendant la partie");
      return "carte : oui, partie : non";
    },
  },
  {
    nom: "Partie : un coup joué, puis quitter coûte une vie",
    save: DEJA_JOUE,
    async run(page) {
      await accueil(page);
      await jouerNiveau(page, 0);
      const avant = await page.evaluate(() => window.__melopop.state.moves);
      const coup = await trouverCoup(page);
      verifier(coup, "aucun coup trouvé sur le plateau");
      await glisser(page, ...coup);
      await page.waitForFunction((n) => window.__melopop.state.moves === n - 1 && !window.__melopop.state.busy, avant, { timeout: FIN_CASCADES });
      const score = await page.evaluate(() => window.__melopop.state.score);
      verifier(score > 0, "le coup devrait rapporter des points");
      await clic(page, "#pause");
      await bouton(page, "quit");
      await page.waitForSelector("#map.active");
      const s = await lireSauvegarde(page);
      verifier(s.lives === 4, `il devrait rester 4 vies, pas ${s.lives}`);
      return `coup ${JSON.stringify(coup)}, score ${score}, vies ${s.lives}`;
    },
  },
  {
    nom: "Vies : 1 vie revient toutes les 20 minutes",
    save: { ...DEJA_JOUE, lives: 2, livesTs: Date.now() - 41 * 60e3 },
    async run(page) {
      await accueil(page);
      const n = (await page.textContent("#home .lives")).trim();
      verifier(n === "4", `4 vies attendues après 41 minutes, affiché : ${n}`);
      return `affiché : ${n} vies, prochaine dans ${(await page.textContent("#home .lives-timer")).trim()}`;
    },
  },
  {
    nom: "Plus de vies : une vidéo récompensée redonne une vie et lance le niveau",
    save: { ...DEJA_JOUE, lives: 0 },
    async run(page) {
      await accueil(page);
      await clic(page, "#play");
      await page.waitForSelector("#map.active");
      await clic(page, '.node[data-level="0"]');
      await bouton(page, "reward");
      await page.waitForSelector(".kit-pub");
      await page.waitForSelector(".kit-pub button:not([disabled])");
      await page.waitForFunction(() => document.querySelector(".kit-pub-compte")?.textContent === "✓", null, { timeout: 8000 });
      await clic(page, ".kit-pub button");
      await page.waitForSelector("#game.active");
      const s = await lireSauvegarde(page);
      verifier(s.lives === 1, `1 vie attendue, pas ${s.lives}`);
      return "vidéo vue, 1 vie, niveau lancé";
    },
  },
  {
    nom: "Cadeau du jour : une fois par jour",
    save: DEJA_JOUE,
    async run(page) {
      await accueil(page);
      verifier(await page.evaluate(() => document.getElementById("gift-btn").classList.contains("ready")), "le cadeau devrait être signalé prêt");
      await clic(page, "#gift-btn");
      await bouton(page, "open");
      await fenetre(page);
      const gain = await page.textContent("#kit-fenetre-boite h2");
      await bouton(page, "close");
      const s = await lireSauvegarde(page);
      const auj = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
      verifier(s.lastGift === auj, "la date du cadeau devrait être enregistrée");
      await clic(page, "#gift-btn");
      await fenetre(page);
      verifier((await page.textContent("#kit-fenetre-boite")).includes("déjà ouvert"), "le second cadeau devrait être refusé");
      return `gagné : ${gain.trim()}`;
    },
  },
  {
    nom: "Boutique : achat simulé d'un lot, puis de « Sans pub »",
    save: DEJA_JOUE,
    async run(page) {
      await accueil(page);
      await clic(page, "#home-shop");
      await page.waitForSelector("#shop.active");
      const prix = await page.$$eval("#shop-list .kit-acheter", (b) => b.map((x) => x.textContent.trim()));
      const avant = (await lireSauvegarde(page)).boosters?.hammer ?? 3;
      await clic(page, '[data-buy="melopop_pack_s"]');
      await clic(page, '.kit-pub [data-r="ok"]');
      await bouton(page, "close");
      const s1 = await lireSauvegarde(page);
      verifier(s1.boosters.hammer === avant + 2, `marteaux : ${avant} + 2 attendus, ${s1.boosters.hammer} obtenus`);
      await clic(page, '[data-buy="melopop_noads"]');
      await clic(page, '.kit-pub [data-r="ok"]');
      await bouton(page, "close");
      const s2 = await lireSauvegarde(page);
      verifier(s2.noAds === true, "noAds devrait être enregistré");
      verifier((await page.textContent('[data-buy="melopop_noads"]')).includes("Acheté"), "« Sans pub » devrait être marqué acheté");
      await clic(page, "#shop-back");
      await clic(page, "#play");
      await page.waitForSelector("#map.active");
      await page.waitForTimeout(200);
      verifier(!(await page.evaluate(() => document.body.classList.contains("kit-banniere-simulee"))), "plus de bannière après « Sans pub »");
      return `prix affichés : ${prix.join(", ")}`;
    },
  },
  {
    nom: "Réglages : couper les sons, puis effacer la progression",
    save: { ...DEJA_JOUE, unlocked: 7, stars: { 0: 3, 1: 2 } },
    async run(page) {
      await accueil(page);
      await clic(page, "#home-settings");
      await bouton(page, "sfx");
      verifier((await lireSauvegarde(page)).sound === false, "le réglage des sons devrait être enregistré");
      await bouton(page, "reset");
      await bouton(page, "yes");
      await accueil(page);
      const s = await lireSauvegarde(page);
      verifier(s.unlocked === 1 && Object.keys(s.stars).length === 0, "la progression devrait être effacée");
      verifier((await page.textContent("#play-label")).includes("Commencer"), "retour au début");
      return "sons coupés, progression effacée";
    },
  },
  {
    nom: "Bonus : le marteau est expliqué, puis casse une note sans coûter de coup",
    save: DEJA_JOUE,
    async run(page) {
      await accueil(page);
      await jouerNiveau(page, 0);
      const coups = await page.evaluate(() => window.__melopop.state.moves);
      await clic(page, '[data-booster="hammer"]');
      await bouton(page, "use");
      await page.waitForSelector('[data-booster="hammer"].armed');
      const box = await page.locator("#board").boundingBox();
      await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await page.waitForFunction(() => !window.__melopop.state.busy, null, { timeout: FIN_CASCADES });
      const s = await lireSauvegarde(page);
      verifier(s.boosters.hammer === 2, `2 marteaux attendus, ${s.boosters.hammer}`);
      verifier(s.boosterSeen.hammer === true, "le marteau devrait être marqué comme présenté");
      const apres = await page.evaluate(() => window.__melopop.state.moves);
      verifier(apres === coups, "un bonus ne doit pas coûter de coup");
      return `marteaux : 2, coups : ${apres}`;
    },
  },
  {
    nom: "Statistiques anonymes : session, niveau, abandon, puis désactivation dans les réglages",
    save: DEJA_JOUE,
    stats: true,
    async run(page) {
      await accueil(page);
      await jouerNiveau(page, 0);
      await clic(page, "#pause");
      await bouton(page, "quit");
      await page.waitForSelector("#map.active");
      await page.evaluate(() => window.__melopop.Stats.flush());
      await page.waitForTimeout(300);
      const ev = page.envois.flatMap((e) => e.batch);
      const noms = ev.map((e) => e.event);
      verifier(page.envois.every((e) => /^phc_/.test(e.api_key)), "clé PostHog de jeu.json attendue");
      for (const n of ["session_start", "level_start", "level_quit"]) verifier(noms.includes(n), `événement ${n} attendu (reçus : ${noms.join(", ")})`);
      const q = ev.find((e) => e.event === "level_quit").properties;
      verifier(q.jeu === "melopop" && q.level === 1 && q.reason === "pause" && q.ms > 0, "level_quit : jeu, niveau 1, raison « pause », durée");
      // le joueur coupe les statistiques
      await clic(page, "#map-settings");
      await bouton(page, "stats");
      verifier((await lireSauvegarde(page)).stats === false, "réglage enregistré");
      const avant = page.envois.length;
      await page.evaluate(() => { window.__melopop.Stats.track("essai"); window.__melopop.Stats.flush(); });
      await page.waitForTimeout(300);
      verifier(!page.envois.slice(avant).flatMap((e) => e.batch).some((e) => e.event === "essai"), "plus aucun envoi une fois coupées");
      return noms.join(", ");
    },
  },
  {
    nom: "Mobile : l'accueil tient dans l'écran d'un téléphone, au doigt",
    mobile: true,
    save: DEJA_JOUE,
    async run(page) {
      await accueil(page);
      const debord = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      verifier(!debord, "la page déborde en largeur");
      await page.tap("#play", { force: true });
      await page.waitForSelector("#map.active");
      return "ok";
    },
  },
];

/* ---------- lanceur ---------- */
const filtres = process.argv.slice(2).map((a) => a.toLowerCase());
const choisis = TESTS.filter((t) => !filtres.length || filtres.some((f) => t.nom.toLowerCase().includes(f)));
const srv = await serveur();
const url = `http://127.0.0.1:${srv.address().port}/`;
const navigateur = await chromium.launch();
let echecs = 0;
const t00 = Date.now();
for (const t of choisis) {
  const ctx = await navigateur.newContext(t.mobile
    ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }
    : { viewport: { width: 430, height: 900 } });
  if (t.save) await ctx.addInitScript(([k, v]) => { if (!sessionStorage.getItem("prepare")) { localStorage.setItem(k, v); sessionStorage.setItem("prepare", "1"); } }, [CLE, JSON.stringify(t.save)]);
  const page = await ctx.newPage();
  // Statistiques : envoi autorisé pour ce test, mais intercepté (rien ne part vers PostHog).
  page.envois = [];
  if (t.stats) {
    await ctx.addInitScript(() => { window.KIT_STATS_TEST = true; });
    await page.route("https://eu.i.posthog.com/**", async (r) => { page.envois.push(JSON.parse(r.request().postData())); await r.fulfill({ status: 200, body: "{}" }); });
  }
  const erreurs = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") erreurs.push(m.text()); });
  const t0 = Date.now();
  try {
    await page.goto(url);
    const r = await t.run(page);
    verifier(!erreurs.length, "erreurs dans la page : " + erreurs.join(" | "));
    console.log(`✓ ${t.nom} (${((Date.now() - t0) / 1000).toFixed(1)} s)${r ? "\n    " + r : ""}`);
  } catch (e) {
    echecs++;
    console.log(`✗ ${t.nom}\n    ${e instanceof Echec ? e.message : e.stack}${erreurs.length ? "\n    page : " + erreurs.join(" | ") : ""}`);
  }
  await ctx.close();
}
await navigateur.close();
srv.close();
console.log(`\n${choisis.length - echecs}/${choisis.length} tests réussis en ${Math.round((Date.now() - t00) / 1000)} s`);
process.exit(echecs ? 1 : 0);
