// Tests du kit : règles des publicités, boutique, notifications (navigateur simulé ou appli simulée).
import { test, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { configurer } from "../config.js";
import { Ads, REGLES_INTERSTITIELLE } from "../ads.js";
import { Store } from "../store.js";
import { Notify, horsHeuresCalmes, rappelsStandard } from "../notify.js";

const JEU = {
  id: "essai", nom: "Essai", version: "1.0",
  admob: { test: true, android: { appli: "a", banniere: "b", interstitielle: "i", recompensee: "r" } },
  revenuecat: { android: "", ios: "", droitSansPub: "no_ads" },
  produits: [
    { id: "essai_noads", type: "noads", titre: "Sans pub", prix: "3,99 €", description: "…" },
    { id: "essai_lot", type: "consumable", titre: "Lot", prix: "0,99 €", description: "…", contenu: { a: 1 } },
  ],
};

let pubs;
beforeEach(() => {
  delete globalThis.Capacitor;
  configurer(JEU);
  Ads._reinitialiser();
  Store._reinitialiser();
  pubs = [];
  Ads.simulateur = { pub: async (o) => { pubs.push(o.title); return true; }, banniere: () => {} };
});

test("interstitielle : pas avant le niveau 4, puis une partie sur 3", async () => {
  await Ads.init();
  for (let n = 1; n <= 3; n++) assert.equal(await Ads.maybeInterstitial(n), false);
  assert.equal(await Ads.maybeInterstitial(4), false);
  assert.equal(await Ads.maybeInterstitial(4), false);
  assert.equal(await Ads.maybeInterstitial(4), true, "3e partie terminée");
  assert.deepEqual(pubs, ["Pub interstitielle"]);
});

test("interstitielle : jamais deux en moins de 2 minutes, ni juste après une vidéo récompensée", async () => {
  mock.timers.enable({ apis: ["Date"], now: 1e12 });
  try {
    await Ads.init();
    for (let i = 0; i < 3; i++) await Ads.maybeInterstitial(10);
    assert.equal(pubs.length, 1);
    for (let i = 0; i < 6; i++) await Ads.maybeInterstitial(10);
    assert.equal(pubs.length, 1, "délai de 2 minutes");
    mock.timers.tick(REGLES_INTERSTITIELLE.delaiMin * 1000);
    await Ads.maybeInterstitial(10);
    assert.equal(pubs.length, 2, "après 2 minutes, la partie suivante peut en avoir une");
    mock.timers.tick(10 * 60e3);
    assert.equal(await Ads.rewarded(), true);
    for (let i = 0; i < 3; i++) await Ads.maybeInterstitial(10);
    assert.deepEqual(pubs, ["Pub interstitielle", "Pub interstitielle", "Pub récompensée"], "pas d'interstitielle juste après la vidéo");
  } finally { mock.timers.reset(); }
});

test("interstitielle : jeu.json peut adoucir les règles", async () => {
  configurer({ ...JEU, interstitielle: { toutesLes: 5, aPartirDuNiveau: 10 } });
  await Ads.init();
  for (let i = 0; i < 6; i++) await Ads.maybeInterstitial(9);
  assert.equal(pubs.length, 0);
  for (let i = 0; i < 4; i++) await Ads.maybeInterstitial(10);
  assert.equal(pubs.length, 0);
  await Ads.maybeInterstitial(10);
  assert.equal(pubs.length, 1);
});

test("« Sans pub » coupe bannière et interstitielles, pas les vidéos récompensées", async () => {
  const bannieres = [];
  Ads.simulateur.banniere = (v) => bannieres.push(v);
  await Ads.init();
  Ads.setRemoveAds(true);
  await Ads.showBanner();
  for (let i = 0; i < 6; i++) await Ads.maybeInterstitial(10);
  assert.equal(pubs.length, 0);
  assert.ok(!bannieres.includes(true));
  assert.equal(await Ads.rewarded(), true);
});

test("boutique : catalogue de jeu.json, achat simulé, « Sans pub » signalé", async () => {
  let sansPub = false;
  Store.simulateur = { paiement: async (p) => p.id !== "refuse" };
  await Store.init((v) => (sansPub = v));
  assert.equal(Store.available, true);
  assert.deepEqual(Store.products.map((p) => p.id), ["essai_noads", "essai_lot"]);
  assert.equal(Store.priceOf(Store.product("essai_lot")), "0,99 €");
  assert.deepEqual(await Store.buy(Store.product("essai_lot")), { ok: true, cancelled: false });
  assert.equal(sansPub, false);
  await Store.buy(Store.product("essai_noads"));
  assert.equal(sansPub, true);
});

test("boutique (appli) : clés RevenueCat de jeu.json, prix du store, restauration", async () => {
  const appels = [];
  const Purchases = {
    configure: async (o) => appels.push(["configure", o.apiKey]),
    getCustomerInfo: async () => ({ customerInfo: { entitlements: { active: {} } } }),
    getProducts: async ({ productIdentifiers }) => ({ products: productIdentifiers.map((id) => ({ identifier: id, priceString: "1,09 €" })) }),
    purchaseStoreProduct: async () => ({ customerInfo: { entitlements: { active: { no_ads: {} } } } }),
    restorePurchases: async () => ({ customerInfo: { entitlements: { active: { no_ads: {} } } } }),
  };
  globalThis.Capacitor = { isNativePlatform: () => true, getPlatform: () => "android", Plugins: { Purchases } };
  configurer({ ...JEU, revenuecat: { android: "goog_cle", ios: "appl_cle", droitSansPub: "no_ads" } });
  let sansPub = false;
  await Store.init((v) => (sansPub = v));
  assert.deepEqual(appels[0], ["configure", "goog_cle"]);
  assert.equal(Store.priceOf(Store.product("essai_lot")), "1,09 €");
  assert.deepEqual(await Store.buy(Store.product("essai_noads")), { ok: true });
  assert.equal(sansPub, true);
  assert.deepEqual(await Store.restore(), { ok: true, noAds: true });
});

test("notifications : jamais entre 21 h et 9 h", () => {
  assert.equal(horsHeuresCalmes(new Date(2026, 10, 12, 22, 15)).getTime(), new Date(2026, 10, 13, 9, 30).getTime());
  assert.equal(horsHeuresCalmes(new Date(2026, 10, 12, 3, 0)).getTime(), new Date(2026, 10, 12, 9, 30).getTime());
  assert.equal(horsHeuresCalmes(new Date(2026, 10, 12, 18, 0)).getTime(), new Date(2026, 10, 12, 18, 0).getTime());
});

test("notifications : rappels habituels (vies, cadeau à 18 h, retour après 3 jours)", () => {
  const maintenant = new Date(2026, 10, 12, 10, 0).getTime();
  const l = rappelsStandard({ livesFullAt: maintenant + 3600e3, giftOpenedToday: false }, {}, maintenant);
  assert.deepEqual(l.map((n) => n.id), [101, 102, 103]);
  assert.equal(l[1].quand.getHours(), 18);
  assert.equal(l[1].quand.getDate(), 12);
  assert.match(l[2].titre, /Essai/);
  const l2 = rappelsStandard({ livesFullAt: null, giftOpenedToday: true }, { cadeau: { titre: "T", texte: "X" } }, maintenant);
  assert.deepEqual(l2.map((n) => n.id), [102, 103]);
  assert.equal(l2[0].quand.getDate(), 13, "cadeau déjà ouvert : rappel le lendemain");
  assert.equal(l2[0].titre, "T");
});

test("notifications (appli) : programmées hors heures calmes, passées ignorées, annulées au retour", async () => {
  const prevues = [];
  const LocalNotifications = {
    checkPermissions: async () => ({ display: "granted" }),
    getPending: async () => ({ notifications: prevues.map((n) => ({ id: n.id })) }),
    cancel: async ({ notifications }) => { for (const { id } of notifications) prevues.splice(prevues.findIndex((n) => n.id === id), 1); },
    schedule: async ({ notifications }) => prevues.push(...notifications),
  };
  globalThis.Capacitor = { isNativePlatform: () => true, getPlatform: () => "android", Plugins: { LocalNotifications } };
  assert.equal(Notify.supported, true);
  const nuit = new Date(Date.now() + 2 * 864e5); nuit.setHours(23, 0, 0, 0);
  const res = await Notify.schedule([
    { id: 1, titre: "a", texte: "b", quand: nuit },
    { id: 2, titre: "a", texte: "b", quand: Date.now() - 1000 },
  ]);
  assert.deepEqual(res.map((n) => n.id), [1]);
  assert.equal(prevues[0].schedule.at.getHours(), 9);
  assert.equal(prevues[0].channelId, "rappels");
  await Notify.cancelAll();
  assert.equal(prevues.length, 0);
  await Notify.schedule([{ id: 3, titre: "a", texte: "b", quand: nuit }], { enabled: false });
  assert.equal(prevues.length, 0, "rappels désactivés : rien n'est programmé");
});

test("notifications (navigateur) : non disponibles, sans erreur", async () => {
  assert.equal(Notify.supported, false);
  assert.equal(await Notify.permission(), "unsupported");
  assert.deepEqual(await Notify.schedule([{ id: 1, quand: Date.now() + 864e5 }]), []);
});
