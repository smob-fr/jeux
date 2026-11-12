#!/usr/bin/env node
// Vérifie que chaque jeu de jeux/ suit les conventions communes (voir CLAUDE.md et docs/monetisation.md) :
// fichiers attendus, appId, identifiants AdMob, RevenueCat et catalogue de la boutique.
//
//   node outils/verifier-jeux.mjs            tous les jeux
//   node outils/verifier-jeux.mjs melopop    un seul jeu
//
// Code de sortie 1 s'il y a au moins une erreur. Les avertissements n'empêchent rien.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const JEUX = join(RACINE, "jeux");
const PRIX_SANS_PUB = "3,99 €";
const PRIX_LOTS = ["0,99 €", "1,99 €", "4,99 €"];
const TYPES = ["noads", "once", "consumable"];
const EDITEUR_TEST = "3940256099942544"; // identifiants de test de Google
const RE_APPLI = /^ca-app-pub-\d{16}~\d{10}$/;
const RE_BLOC = /^ca-app-pub-\d{16}\/\d{10}$/;

const lire = (f) => JSON.parse(readFileSync(f, "utf8"));

/** Vérifie un jeu. Renvoie { erreurs, avertissements, catalogue }. */
export function verifierJeu(dossier) {
  const nom = dossier.split("/").pop();
  const erreurs = [], avert = [];
  const err = (m) => erreurs.push(m), warn = (m) => avert.push(m);
  for (const f of ["CLAUDE.md", "jeu.json", "package.json", "capacitor.config.json"]) {
    if (!existsSync(join(dossier, f))) err(`fichier manquant : ${f}`);
  }
  if (erreurs.length) return { nom, erreurs, avertissements: avert, catalogue: [] };

  let jeu, cap, pkg;
  try { jeu = lire(join(dossier, "jeu.json")); } catch (e) { err(`jeu.json illisible : ${e.message}`); }
  try { cap = lire(join(dossier, "capacitor.config.json")); } catch (e) { err(`capacitor.config.json illisible : ${e.message}`); }
  try { pkg = lire(join(dossier, "package.json")); } catch (e) { err(`package.json illisible : ${e.message}`); }
  if (erreurs.length) return { nom, erreurs, avertissements: avert, catalogue: [] };

  const prototype = jeu.statut === "prototype";
  // Pour un prototype, les règles de monétisation ne sont que des avertissements.
  const monet = prototype ? warn : err;

  // Identité
  if (!/^[a-z][a-z0-9]*$/.test(jeu.id || "")) err(`jeu.json › id invalide (« ${jeu.id} ») : minuscules et chiffres seulement`);
  if (!jeu.nom) err("jeu.json › nom manquant");
  if (!jeu.version) err("jeu.json › version manquante");
  if (cap.appId !== `fr.smob.${jeu.id}`) err(`capacitor.config.json › appId vaut « ${cap.appId} », attendu « fr.smob.${jeu.id} »`);
  if (cap.appName !== jeu.nom) err(`capacitor.config.json › appName (« ${cap.appName} ») différent du nom du jeu (« ${jeu.nom} »)`);
  if (!cap.webDir) err("capacitor.config.json › webDir manquant");
  if (!pkg.scripts?.test) err("package.json › pas de script « test »");
  if (!pkg.scripts?.build) err("package.json › pas de script « build »");

  // AdMob
  const ad = jeu.admob;
  if (!ad) monet("jeu.json › admob manquant");
  else {
    if (typeof ad.test !== "boolean") err("jeu.json › admob.test doit valoir true ou false");
    for (const pf of ["android", "ios"]) {
      const ids = ad[pf];
      if (!ids) { monet(`jeu.json › admob.${pf} manquant`); continue; }
      if (!RE_APPLI.test(ids.appli || "")) monet(`jeu.json › admob.${pf}.appli invalide`);
      for (const b of ["banniere", "interstitielle", "recompensee"]) {
        if (!RE_BLOC.test(ids[b] || "")) monet(`jeu.json › admob.${pf}.${b} invalide`);
      }
      const deTest = Object.values(ids).some((v) => String(v).includes(EDITEUR_TEST));
      if (ad.test === false && deTest) err(`jeu.json › admob.test vaut false mais admob.${pf} contient des identifiants de test`);
    }
    if (ad.test) warn("pubs en mode test (admob.test = true) : à changer avant publication");
  }
  const inter = jeu.interstitielle || {};
  if (inter.toutesLes !== undefined && inter.toutesLes < 3) err("interstitielle.toutesLes < 3 : plus agressif que la règle commune");
  if (inter.delaiMin !== undefined && inter.delaiMin < 120) err("interstitielle.delaiMin < 120 s : plus agressif que la règle commune");
  if (inter.aPartirDuNiveau !== undefined && inter.aPartirDuNiveau < 4) err("interstitielle.aPartirDuNiveau < 4 : plus agressif que la règle commune");

  // RevenueCat
  const rc = jeu.revenuecat;
  if (!rc) monet("jeu.json › revenuecat manquant");
  else {
    if (rc.droitSansPub !== "no_ads") monet(`jeu.json › revenuecat.droitSansPub doit valoir « no_ads »`);
    if (rc.android && !/^goog_/.test(rc.android)) err("jeu.json › revenuecat.android doit commencer par goog_");
    if (rc.ios && !/^appl_/.test(rc.ios)) err("jeu.json › revenuecat.ios doit commencer par appl_");
    if (!rc.android || !rc.ios) {
      if (ad && ad.test === false) err("clés RevenueCat manquantes alors que les pubs sont en production");
      else warn("clés RevenueCat pas encore renseignées (achats simulés seulement)");
    }
  }

  // Catalogue
  const produits = Array.isArray(jeu.produits) ? jeu.produits : [];
  if (!produits.length) monet("jeu.json › produits : catalogue vide");
  const vus = new Set();
  for (const p of produits) {
    const ou = `produit « ${p.id} »`;
    if (vus.has(p.id)) err(`${ou} en double`);
    vus.add(p.id);
    if (!String(p.id || "").startsWith(`${jeu.id}_`)) err(`${ou} : l'identifiant doit commencer par « ${jeu.id}_ »`);
    if (!TYPES.includes(p.type)) err(`${ou} : type « ${p.type} » inconnu (${TYPES.join(", ")})`);
    if (!p.titre || !p.description) err(`${ou} : titre ou description manquant`);
    if (p.type === "noads") {
      if (p.id !== `${jeu.id}_noads`) err(`${ou} : le produit « Sans pub » doit s'appeler ${jeu.id}_noads`);
      if (p.prix !== PRIX_SANS_PUB) monet(`${ou} : « Sans pub » à ${p.prix}, attendu ${PRIX_SANS_PUB}`);
    } else {
      if (!PRIX_LOTS.includes(p.prix)) monet(`${ou} : prix ${p.prix} hors de la grille (${PRIX_LOTS.join(", ")})`);
      if (!p.contenu || typeof p.contenu !== "object") err(`${ou} : contenu manquant`);
    }
  }
  if (produits.length && !produits.some((p) => p.type === "noads")) monet("catalogue sans produit « Sans pub »");
  if (produits.length && !produits.some((p) => p.type !== "noads")) monet("catalogue sans lot de bonus");

  return { nom, jeu, erreurs, avertissements: avert, catalogue: produits };
}

export function listerJeux() {
  if (!existsSync(JEUX)) return [];
  return readdirSync(JEUX).filter((d) => statSync(join(JEUX, d)).isDirectory()).sort();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const demandes = process.argv.slice(2);
  const noms = demandes.length ? demandes : listerJeux();
  if (!noms.length) { console.log("Aucun jeu dans jeux/ pour l'instant."); process.exit(0); }
  let total = 0;
  for (const n of noms) {
    const d = join(JEUX, n);
    if (!existsSync(d)) { console.error(`✗ ${n} : dossier jeux/${n} introuvable`); total++; continue; }
    const r = verifierJeu(d);
    const etat = r.jeu?.statut === "prototype" ? " (prototype)" : "";
    console.log(`${r.erreurs.length ? "✗" : "✓"} ${n}${etat}`);
    for (const e of r.erreurs) console.log(`    erreur : ${e}`);
    for (const a of r.avertissements) console.log(`    attention : ${a}`);
    for (const p of r.catalogue) console.log(`    · ${p.id.padEnd(22)} ${p.type.padEnd(10)} ${String(p.prix).padStart(7)}  ${p.titre}`);
    total += r.erreurs.length;
  }
  console.log(total ? `\n${total} erreur(s)` : "\nConventions respectées.");
  process.exit(total ? 1 : 0);
}
