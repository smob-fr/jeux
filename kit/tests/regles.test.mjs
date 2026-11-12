// Tests du kit : sauvegarde, vies, bonus, cadeau du jour (logique pure, sans navigateur).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { creerSauvegarde } from "../sauvegarde.js";
import { creerVies, RECHARGE_MS } from "../vies.js";
import { creerInventaire } from "../bonus.js";
import { creerCadeau, aujourdhui } from "../cadeau.js";

// localStorage minimal
const memoire = new Map();
globalThis.localStorage = {
  getItem: (k) => (memoire.has(k) ? memoire.get(k) : null),
  setItem: (k, v) => memoire.set(k, String(v)),
  removeItem: (k) => memoire.delete(k),
};
beforeEach(() => memoire.clear());

test("sauvegarde : valeurs par défaut, lecture, enregistrement", () => {
  const s = creerSauvegarde({ cle: "t.v1", defauts: () => ({ niveau: 1, options: { son: true } }) });
  assert.equal(s.data.niveau, 1);
  s.data.niveau = 7;
  s.enregistrer();
  const s2 = creerSauvegarde({ cle: "t.v1", defauts: () => ({ niveau: 1, nouveau: "x" }) });
  assert.equal(s2.data.niveau, 7, "la progression est relue");
  assert.equal(s2.data.nouveau, "x", "un champ ajouté depuis prend sa valeur par défaut");
});

test("sauvegarde : une sauvegarde illisible repart des valeurs par défaut", () => {
  memoire.set("t.v1", "{pas du json");
  const s = creerSauvegarde({ cle: "t.v1", defauts: () => ({ niveau: 1 }) });
  assert.equal(s.data.niveau, 1);
  memoire.set("t.v1", "[1,2]");
  assert.equal(creerSauvegarde({ cle: "t.v1", defauts: () => ({ niveau: 1 }) }).data.niveau, 1);
});

test("sauvegarde : completer() et reinitialiser() gardent le même objet", () => {
  memoire.set("t.v1", JSON.stringify({ bonus: { a: 1 } }));
  const s = creerSauvegarde({ cle: "t.v1", defauts: () => ({ bonus: {} }), completer: (d) => { d.bonus = { a: 0, b: 2, ...d.bonus }; } });
  assert.deepEqual(s.data.bonus, { a: 1, b: 2 });
  const ref = s.data;
  s.reinitialiser();
  assert.equal(s.data, ref);
  assert.deepEqual(s.data.bonus, { a: 0, b: 2 });
  assert.deepEqual(JSON.parse(memoire.get("t.v1")), { bonus: { a: 0, b: 2 } });
});

test("vies : 1 vie toutes les 20 minutes, jusqu'à 5", () => {
  let t = 1e12;
  const data = { lives: 2, livesTs: t };
  const v = creerVies(data, { maintenant: () => t });
  t += 41 * 60e3;
  v.rafraichir();
  assert.equal(v.n, 4);
  assert.equal(v.prochaineDans(), "19:00");
  assert.equal(v.pleinesA(), data.livesTs + RECHARGE_MS);
  t += 10 * 3600e3;
  v.rafraichir();
  assert.equal(v.n, 5);
  assert.equal(v.pleinesA(), null);
});

test("vies : perdre une vie à plein redémarre la recharge, gagner ne dépasse pas le maximum", () => {
  let t = 1e12;
  const data = {};
  const v = creerVies(data, { maintenant: () => t });
  assert.equal(v.n, 5);
  t += 3600e3;
  v.perdre();
  assert.equal(v.n, 4);
  assert.equal(data.livesTs, t, "la recharge part du moment de la perte");
  v.gagner(3);
  assert.equal(v.n, 5);
  v.gagner(1, { depasser: true });
  assert.equal(v.n, 6, "le cadeau du jour peut dépasser le maximum de 1");
  v.gagner(1, { depasser: true });
  assert.equal(v.n, 6);
  data.lives = 0;
  v.remplir();
  assert.equal(v.n, 5);
});

test("bonus : départ, contenu d'un lot, utilisation", () => {
  const data = { boosters: { hammer: 1 } };
  let n = 0;
  const inv = creerInventaire(data, { depart: { hammer: 3, bomb: 2 }, enregistrer: () => n++ });
  assert.deepEqual(data.boosters, { hammer: 1, bomb: 2 }, "les anciennes sauvegardes gardent leurs quantités");
  inv.ajouterContenu({ hammer: 2, bomb: 1, lives: "full", inconnu: 9 });
  assert.deepEqual(data.boosters, { hammer: 3, bomb: 3 });
  assert.equal(inv.utiliser("hammer"), true);
  assert.equal(inv.n("hammer"), 2);
  data.boosters.bomb = 0;
  assert.equal(inv.utiliser("bomb"), false);
  assert.ok(n > 0, "chaque changement est enregistré");
});

test("bonus : gagnés en jouant (3 étoiles : +1, coffre tous les 5 niveaux : +2)", () => {
  const data = {};
  const inv = creerInventaire(data, { depart: { a: 0, b: 0 }, hasard: () => 0 });
  assert.deepEqual(inv.recompensesNiveau({ numero: 3, etoilesAvant: 0, etoiles: 2 }), []);
  assert.deepEqual(inv.recompensesNiveau({ numero: 3, etoilesAvant: 2, etoiles: 3 }), ["a"]);
  assert.deepEqual(inv.recompensesNiveau({ numero: 3, etoilesAvant: 3, etoiles: 3 }), [], "une seule fois");
  assert.equal(inv.recompensesNiveau({ numero: 5, etoilesAvant: 0, etoiles: 3 }).length, 3);
  assert.equal(inv.recompensesNiveau({ numero: 10, etoilesAvant: 1, etoiles: 2 }).length, 0, "coffre seulement la première fois");
  assert.equal(inv.n("a"), 4);
});

test("bonus : présentation au premier usage", () => {
  const data = {};
  const inv = creerInventaire(data, { depart: { a: 1 } });
  assert.equal(inv.dejaVu("a"), false);
  inv.marquerVu("a");
  assert.equal(inv.dejaVu("a"), true);
  assert.deepEqual(data.boosterSeen, { a: true });
});

test("cadeau du jour : un par jour, date locale", () => {
  let jour = "2026-11-12";
  const data = {};
  const c = creerCadeau(data, { tirages: [{ k: 1 }, { k: 2 }], hasard: () => 0.99, jour: () => jour });
  assert.equal(c.pret, true);
  assert.deepEqual(c.ouvrir(), { k: 2 });
  assert.equal(c.pret, false);
  assert.equal(c.ouvrir(), null);
  jour = "2026-11-13";
  assert.equal(c.pret, true);
  assert.equal(aujourdhui(new Date(2026, 0, 5, 23, 59)), "2026-01-05", "date locale, pas UTC");
});
