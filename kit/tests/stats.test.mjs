// Tests du kit : statistiques anonymes (PostHog). Le réseau est remplacé par un faux fetch.
import { test, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { configurer } from "../config.js";
import { Stats } from "../stats.js";
import { Ads } from "../ads.js";
import { Store } from "../store.js";

const memoire = new Map();
globalThis.localStorage = { getItem: (k) => memoire.get(k) ?? null, setItem: (k, v) => memoire.set(k, String(v)), removeItem: (k) => memoire.delete(k) };
let envois;
globalThis.fetch = async (url, o) => { envois.push({ url, corps: JSON.parse(o.body) }); return { ok: true }; };
const tous = () => envois.flatMap((e) => e.corps.batch);
const evenements = () => tous().filter((e) => e.event !== "$pageview"); // les tests regardent leurs propres événements
const JEU = { id: "essai", nom: "Essai", version: "1.2", statistiques: { posthog: "phc_essai123" }, admob: { test: true }, produits: [{ id: "essai_lot", type: "consumable", titre: "Lot", prix: "0,99 €", description: "…" }] };

beforeEach(() => {
  memoire.clear(); envois = [];
  delete globalThis.Capacitor;
  configurer(JEU);
  Stats._reinitialiser();
});

test("sans clé PostHog : rien n'est envoyé, le réglage n'est pas proposé", () => {
  configurer({ ...JEU, statistiques: {} });
  const data = {};
  Stats.init({ data });
  assert.equal(Stats.disponible, false);
  Stats.track("x"); Stats.flush();
  assert.equal(envois.length, 0);
});

test("identifiant aléatoire créé une fois, propriétés communes sur chaque événement", () => {
  const data = {};
  let n = 0;
  Stats.init({ data, enregistrer: () => n++, build: "b42" });
  assert.match(data.uid, /^u[a-z0-9]+$/);
  assert.equal(data.stats, true);
  const uid = data.uid;
  Stats.init({ data });
  assert.equal(data.uid, uid, "l'identifiant ne change pas");
  Stats.track("session_start", { a: 1 }); Stats.flush();
  assert.equal(envois[0].url, "https://eu.i.posthog.com/batch/");
  assert.equal(envois[0].corps.api_key, "phc_essai123");
  const p = evenements()[0].properties;
  assert.deepEqual([p.distinct_id, p.jeu, p.version, p.build, p.platform, p.a, p.$process_person_profile], [uid, "essai", "1.2", "b42", "web", 1, false]);
});

test("le joueur peut couper les statistiques", () => {
  const data = {};
  Stats.init({ data });
  Stats.activer(false);
  assert.equal(data.stats, false);
  Stats.track("x"); Stats.flush();
  assert.deepEqual(evenements().map((e) => e.event), ["setting_change"], "seul le dernier événement « je coupe » part");
  envois = [];
  Stats.track("y"); Stats.flush();
  assert.equal(envois.length, 0);
});

test("navigateur piloté par des tests : rien n'est envoyé, sauf si le test le demande", () => {
  const avant = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { value: { webdriver: true }, configurable: true, writable: true });
  try {
    const data = {};
    Stats.init({ data });
    Stats.track("x"); Stats.flush();
    assert.equal(envois.length, 0);
    globalThis.KIT_STATS_TEST = true;
    Stats.track("y"); Stats.flush();
    assert.equal(envois.length, 1);
  } finally {
    if (avant) Object.defineProperty(globalThis, "navigator", avant); else delete globalThis.navigator;
    delete globalThis.KIT_STATS_TEST;
  }
});

test("tentative de niveau : début, compteurs, durée active, victoire", () => {
  mock.timers.enable({ apis: ["Date"], now: 1e12 });
  try {
    Stats.init({ data: {} });
    Stats.debut("run", 3, { opt: 9 });
    Stats.compter("hints"); Stats.compter("hints");
    mock.timers.tick(5000);
    Stats.echec({ why: "impasse" });
    Stats.gagne({ stars: 3 });
    Stats.flush();
    const [d, e, g] = evenements();
    assert.equal(d.event, "level_start");
    assert.deepEqual([d.properties.mode, d.properties.level, d.properties.opt], ["run", 3, 9]);
    assert.equal(e.event, "level_fail");
    assert.deepEqual([g.event, g.properties.ms, g.properties.hints, g.properties.fails, g.properties.stars], ["level_win", 5000, 2, 1, 3]);
    assert.equal(Stats.enCours, null);
  } finally { mock.timers.reset(); }
});

test("tentative : relancer, changer de niveau, quitter ; jeu fermé en pleine partie compté au lancement suivant", () => {
  Stats.init({ data: {} });
  Stats.debut("run", 1);
  Stats.debut("run", 1);
  Stats.debut("run", 2);
  Stats.quitter("home");
  Stats.debut("run", 5);
  Stats.flush();
  const raisons = evenements().filter((e) => e.event === "level_quit").map((e) => e.properties.reason);
  assert.deepEqual(raisons, ["restart", "switch", "home"]);
  assert.ok(memoire.get("essai.att"), "la tentative en cours est gardée");
  envois = [];
  Stats._reinitialiser();
  Stats.init({ data: {} });
  Stats.flush();
  const q = evenements()[0];
  assert.deepEqual([q.event, q.properties.reason, q.properties.level], ["level_quit", "closed", 5]);
});

test("le kit compte lui-même les pubs et les achats", async () => {
  Stats.init({ data: {} });
  Ads._reinitialiser(); Store._reinitialiser();
  Ads.simulateur = { pub: async () => true, banniere: () => {} };
  Store.simulateur = { paiement: async () => true };
  await Ads.init(); await Store.init();
  await Ads.rewarded("vie");
  for (let i = 0; i < 3; i++) await Ads.maybeInterstitial(10);
  await Store.buy(Store.product("essai_lot"));
  await Store.restore();
  Stats.flush();
  assert.deepEqual(evenements().map((e) => [e.event, e.properties.place ?? e.properties.product ?? e.properties.level ?? e.properties.ok]),
    [["ad_reward", "vie"], ["purchase", "essai_lot"], ["restore", true]],
    "pas d'interstitielle juste après une vidéo récompensée");
});

test("Web analytics : $pageview au lancement, $session_id (UUID v7) et adresse sur chaque événement", () => {
  globalThis.location = { href: "https://smob-fr.github.io/jeux/essai/", host: "smob-fr.github.io", pathname: "/jeux/essai/" };
  try {
    Stats.init({ data: {} });
    Stats.track("level_start", { level: 1 });
    Stats.flush();
    const [pv, ls] = tous();
    assert.equal(pv.event, "$pageview");
    assert.match(pv.properties.$session_id, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(ls.properties.$session_id, pv.properties.$session_id, "même session");
    assert.deepEqual([ls.properties.$pathname, ls.properties.$host, ls.properties.jeu], ["/jeux/essai/", "smob-fr.github.io", "essai"]);
    assert.equal(Stats.session, pv.properties.$session_id);
  } finally { delete globalThis.location; }
});

test("UUID v7 : horodaté (les sessions se trient dans le temps)", async () => {
  const { uuidv7 } = await import("../stats.js");
  const a = uuidv7(1700000000000), b = uuidv7(1700000000001);
  assert.equal(a.slice(0, 13), "018bcfe5-6800");
  assert.ok(a < b);
});
