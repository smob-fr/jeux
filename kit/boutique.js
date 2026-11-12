// Kit — boutique : liste des produits, achat, remerciement, restauration.
// Le catalogue vient de jeu.json (Store.products). Le jeu fournit :
//   accorder(produit)   ce que le jeu donne (bonus, vies…) ; « Sans pub » et « une seule fois » sont gérés ici
//   art(produit)        illustration HTML de la carte (selon produit.art)
//   inventaire()        HTML de la ligne d'inventaire en haut de la boutique (facultatif)
//   apres()             appelé après chaque achat (mettre l'interface à jour, facultatif)
//   effet()             petite fête après un achat (confettis, facultatif)
// La sauvegarde garde data.noAds (booléen) et data.bought ({ id: true } des offres uniques).
import { Ads } from "./ads.js";
import { Store } from "./store.js";
import { Sound } from "./sound.js";
import { config } from "./config.js";
import { fenetre, demander } from "./fenetres.js";

let opts = null;
let affichage = null; // { liste, inventaire } : éléments de la boutique affichée, pour la rafraîchir

export const Boutique = {
  /** Configure la boutique du jeu (à appeler au démarrage, avant Store.init). */
  configurer({ data, enregistrer, accorder = () => {}, art = () => "", inventaire = () => "", apres = () => {}, effet = () => {} }) {
    data.noAds = !!data.noAds;
    data.bought = data.bought || {};
    opts = { data, enregistrer, accorder, art, inventaire, apres, effet };
    Ads.setRemoveAds(data.noAds);
  },

  /** À passer à Store.init : enregistre « Sans pub » dès que le store le confirme. */
  surSansPub(v) {
    if (!v || !opts) return;
    if (!opts.data.noAds) { opts.data.noAds = true; opts.enregistrer(); }
    Ads.setRemoveAds(true);
    Boutique.rafraichir();
  },

  /** Produits à proposer (les offres uniques déjà achetées sont retirées). */
  produits() {
    return Store.products.filter((p) => !(p.type === "once" && opts.data.bought[p.id]));
  },

  /** Accorde un produit acheté. */
  accorder(p) {
    if (p.type === "noads") { opts.data.noAds = true; Ads.setRemoveAds(true); }
    if (p.type === "once") opts.data.bought[p.id] = true;
    opts.accorder(p);
    opts.enregistrer();
    opts.apres(p);
  },

  /** Achète un produit, l'accorde et affiche le résultat. Résout true si l'achat a réussi. */
  async acheter(p) {
    Sound.tap();
    const res = await Store.buy(p);
    if (!res.ok) {
      if (res.error) await demander(`<h2>Achat impossible</h2><p>${res.error}</p><button class="kit-btn big" data-act="close">OK</button>`);
      return false;
    }
    Boutique.accorder(p);
    Sound.gift();
    opts.effet(p);
    await demander(`<small class="kit-surtitre">Merci !</small>${opts.art(p)}<h2>${p.titre}</h2>
      <p>${p.type === "noads" ? `Les publicités sont supprimées. Merci de soutenir ${config().nom} !` : "C'est ajouté à ton inventaire."}</p>
      <button class="kit-btn big" data-act="close">Super !</button>`);
    Boutique.rafraichir();
    return true;
  },

  /** Restaure « Sans pub » (bouton des réglages, obligatoire pour Apple). */
  async restaurer() {
    const res = await Store.restore();
    const msg = !res.ok ? "La restauration n'a pas abouti. Vérifie ta connexion et réessaie."
      : res.noAds || opts.data.noAds ? "Ton achat « Sans pub » est bien actif sur cet appareil."
      : "Aucun achat à restaurer pour ce compte.";
    fenetre(`<h2>Restaurer mes achats</h2><p>${msg}</p><button class="kit-btn big" data-act="close">OK</button>`);
    Boutique.rafraichir();
  },

  /** Affiche les cartes des produits dans `liste` (et l'inventaire dans `inventaire`, facultatif). */
  afficher(liste, inventaire) {
    affichage = { liste, inventaire };
    if (inventaire) inventaire.innerHTML = opts.inventaire();
    liste.innerHTML = Boutique.produits().map((p) => {
      const owned = p.type === "noads" && opts.data.noAds;
      return `<article class="kit-carte-produit ${p.type === "noads" ? "vedette" : ""}">
        ${p.badge && !owned ? `<span class="kit-badge">${p.badge}</span>` : ""}
        <div class="kit-carte-art">${opts.art(p)}</div>
        <div class="kit-carte-texte"><h3>${p.titre}</h3><p>${p.description}</p></div>
        <button class="kit-btn big kit-acheter" data-buy="${p.id}" ${owned ? "disabled" : ""}>${owned ? "Acheté ✓" : Store.priceOf(p)}</button>
      </article>`;
    }).join("") + (Store.available ? "" : `<p class="kit-doux kit-note">La boutique n'est pas disponible pour le moment.</p>`);
    liste.querySelectorAll("[data-buy]").forEach((b) => (b.onclick = () => Boutique.acheter(Store.product(b.dataset.buy))));
  },

  /** Réaffiche la boutique si elle est à l'écran. */
  rafraichir() {
    if (affichage && affichage.liste.isConnected && affichage.liste.offsetParent !== null) Boutique.afficher(affichage.liste, affichage.inventaire);
  },
};
