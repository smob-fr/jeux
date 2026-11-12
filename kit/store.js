// Kit — achats intégrés.
// • Dans l'appli native : RevenueCat (@revenuecat/purchases-capacitor), qui gère Google Play et
//   l'App Store avec le même code.
// • Dans un navigateur : achats simulés, pour tester le parcours sans payer.
//
// Clés publiques et catalogue : jeu.json › revenuecat et jeu.json › produits (voir docs/monetisation.md).
// Un produit : { id, type: "noads" | "once" | "consumable", titre, prix, description, contenu, badge?, art? }.
// `prix` n'est qu'une valeur de repli : dans l'appli, c'est le prix du store (devise du joueur) qui s'affiche.
import { config } from "./config.js";
import { estNatif, plateforme, plugin } from "./plateforme.js";

let ready = false;
let storeProducts = {}; // id → produit renvoyé par le store
let onNoAds = () => {};

const droitSansPub = () => config().revenuecat?.droitSansPub || "no_ads";
function hasNoAds(customerInfo) {
  return !!customerInfo?.entitlements?.active?.[droitSansPub()];
}

/* ---------- Simulation navigateur : fausse fenêtre de paiement ---------- */
function fakePurchase(p) {
  return new Promise((resolve) => {
    const el = document.createElement("div");
    el.className = "kit-pub";
    el.innerHTML = `<div class="kit-pub-boite kit-paiement">
      <small>Paiement (simulation, aucun débit)</small>
      <h3>${p.titre}</h3><p>${p.description}</p><div class="kit-pub-compte">${p.prix}</div>
      <button class="kit-btn" data-r="ok">Confirmer l'achat</button>
      <button class="kit-btn ghost" data-r="no">Annuler</button></div>`;
    document.body.appendChild(el);
    el.onclick = (e) => {
      const b = e.target.closest("[data-r]");
      if (!b) return;
      el.remove();
      resolve(b.dataset.r === "ok");
    };
  });
}

export const Store = {
  get native() { return estNatif(); },

  /** Simulation utilisée dans le navigateur, remplaçable : paiement(produit) → Promise<boolean confirmé>. */
  simulateur: { paiement: fakePurchase },

  /** Le catalogue du jeu (jeu.json › produits). */
  get products() { return config().produits || []; },
  product(id) { return this.products.find((p) => p.id === id) || null; },

  /** Vrai quand les achats sont utilisables (toujours vrai dans le navigateur, en simulation). */
  get available() { return ready; },

  /** `noAdsCallback(true)` est appelé dès qu'on sait que le joueur a acheté « Sans pub ». */
  async init(noAdsCallback) {
    onNoAds = noAdsCallback || onNoAds;
    if (!estNatif()) { ready = true; return; }
    const apiKey = config().revenuecat?.[plateforme()];
    const Purchases = plugin("Purchases");
    if (!apiKey || !Purchases) { console.warn("Boutique : clé RevenueCat manquante"); return; }
    try {
      await Purchases.configure({ apiKey });
      ready = true;
      const { customerInfo } = await Purchases.getCustomerInfo();
      if (hasNoAds(customerInfo)) onNoAds(true);
      const { products } = await Purchases.getProducts({
        productIdentifiers: this.products.map((p) => p.id),
        type: "NON_SUBSCRIPTION",
      });
      for (const sp of products) storeProducts[sp.identifier] = sp;
    } catch (e) {
      console.warn("Boutique indisponible", e);
    }
  },

  priceOf(p) {
    return storeProducts[p.id]?.priceString || p.prix;
  },

  /**
   * Lance l'achat. Résout { ok: true } si payé, { ok: false, cancelled, error } sinon.
   * C'est à l'appelant d'accorder ce qui a été acheté (voir boutique.js).
   */
  async buy(p) {
    if (!ready) return { ok: false, error: "La boutique n'est pas disponible pour le moment." };
    if (!estNatif()) {
      const ok = await this.simulateur.paiement({ ...p, prix: this.priceOf(p) });
      if (ok && p.type === "noads") onNoAds(true);
      return { ok, cancelled: !ok };
    }
    const product = storeProducts[p.id];
    if (!product) return { ok: false, error: "Ce produit n'est pas disponible pour le moment." };
    try {
      const res = await plugin("Purchases").purchaseStoreProduct({ product });
      if (p.type === "noads" && hasNoAds(res.customerInfo)) onNoAds(true);
      return { ok: true };
    } catch (e) {
      const cancelled = e?.userCancelled || e?.code === "1" || e?.code === 1;
      return { ok: false, cancelled, error: cancelled ? null : "L'achat n'a pas abouti. Aucun montant n'a été débité." };
    }
  },

  /** Restaure « Sans pub » (obligatoire pour l'App Store, utile après un changement de téléphone). */
  async restore() {
    if (!estNatif()) return { ok: true, noAds: false };
    if (!ready) return { ok: false };
    try {
      const { customerInfo } = await plugin("Purchases").restorePurchases();
      const noAds = hasNoAds(customerInfo);
      if (noAds) onNoAds(true);
      return { ok: true, noAds };
    } catch (e) {
      return { ok: false };
    }
  },

  _reinitialiser() { ready = false; storeProducts = {}; onNoAds = () => {}; },
};
