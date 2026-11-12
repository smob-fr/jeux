// Kit — publicités.
// • Dans l'appli native (Capacitor) : Google AdMob via @capacitor-community/admob, avec le formulaire
//   de consentement RGPD (UMP) de Google et la demande ATT sur iOS.
// • Dans un navigateur : publicités simulées, pour tester le parcours.
//
// Identifiants et réglages : jeu.json › admob et jeu.json › interstitielle (voir docs/monetisation.md).
// Règles communes (CLAUDE.md) : bannière jamais pendant le jeu, interstitielle plafonnée,
// vidéos récompensées toujours au choix du joueur.
import { config } from "./config.js";
import { estNatif, plateforme, plugin } from "./plateforme.js";

/** Règles de fréquence par défaut des interstitielles. Un jeu peut seulement les rendre plus douces. */
export const REGLES_INTERSTITIELLE = { toutesLes: 3, delaiMin: 120, aPartirDuNiveau: 4 };

let ready = false;
let canRequestAds = false;
let privacyRequired = false;
let gamesSinceAd = 0;
let lastAdAt = 0;
let removeAds = false;
let bannerWanted = false;

const regles = () => ({ ...REGLES_INTERSTITIELLE, ...(config().interstitielle || {}) });
const testing = () => config().admob?.test !== false;
const ids = () => {
  const a = config().admob || {};
  return a[plateforme()] || a.android || {};
};
const AdMob = () => plugin("AdMob");

async function preload() {
  if (!estNatif() || !canRequestAds) return;
  try { await AdMob().prepareInterstitial({ adId: ids().interstitielle, isTesting: testing() }); } catch (e) { /* réessayé plus tard */ }
  try { await AdMob().prepareRewardVideoAd({ adId: ids().recompensee, isTesting: testing() }); } catch (e) { /* idem */ }
}

/* ---------- Simulation navigateur ---------- */
function fakeAd({ title, seconds, closable }) {
  return new Promise((resolve) => {
    const el = document.createElement("div");
    el.className = "kit-pub";
    el.innerHTML = `<div class="kit-pub-boite"><small>Publicité (simulation)</small><h3>${title}</h3>
      <div class="kit-pub-compte">${seconds}</div><button class="kit-btn" disabled>Fermer</button></div>`;
    document.body.appendChild(el);
    const btn = el.querySelector("button");
    const count = el.querySelector(".kit-pub-compte");
    let s = seconds;
    const timer = setInterval(() => {
      s--;
      count.textContent = s > 0 ? s : "✓";
      if (s <= 0) { clearInterval(timer); btn.disabled = false; }
    }, 1000);
    if (closable) btn.disabled = false;
    btn.onclick = () => {
      clearInterval(timer);
      el.remove();
      resolve(s <= 0);
    };
  });
}
function fakeBanner(show) {
  let el = document.getElementById("kit-banniere-simulee");
  if (show && !el) {
    el = document.createElement("div");
    el.id = "kit-banniere-simulee";
    el.textContent = "Bannière publicitaire (simulation)";
    document.body.appendChild(el);
  }
  document.body.classList.toggle("kit-banniere-simulee", show);
}

export const Ads = {
  get native() { return estNatif(); },

  /**
   * Simulation utilisée dans le navigateur. Remplaçable (tests, ou jeu qui veut son propre écran de pub) :
   * pub({ title, seconds, closable }) → Promise<boolean vue jusqu'au bout>, banniere(visible).
   */
  simulateur: { pub: fakeAd, banniere: fakeBanner },

  /** Vrai entre showBanner() et hideBanner() (utile aux tests et au débogage). */
  get bannerShown() { return bannerWanted; },

  async init() {
    if (!estNatif()) { ready = true; canRequestAds = true; return; }
    const A = AdMob();
    if (!A) { console.warn("AdMob : plugin absent"); return; }
    try {
      await A.initialize({ initializeForTesting: testing() });
      // Consentement RGPD (formulaire Google UMP, à configurer dans la console AdMob).
      let info = await A.requestConsentInfo();
      if (info.isConsentFormAvailable && info.status === "REQUIRED") {
        info = await A.showConsentForm();
      }
      canRequestAds = info.canRequestAds !== false;
      privacyRequired = info.privacyOptionsRequirementStatus === "REQUIRED";
      // iOS : App Tracking Transparency (le message vient de Info.plist, écrit par configure-admob.mjs).
      if (plateforme() === "ios") {
        try {
          const st = await A.trackingAuthorizationStatus();
          if (st.status === "notDetermined") await A.requestTrackingAuthorization();
        } catch (e) { /* iOS < 14 */ }
      }
      ready = true;
      preload();
      if (bannerWanted) this.showBanner();
    } catch (e) {
      console.warn("AdMob indisponible", e);
    }
  },

  /** Achat « Sans pub » : coupe bannières et interstitielles (les vidéos récompensées restent). */
  setRemoveAds(v) {
    removeAds = !!v;
    if (removeAds) this.hideBanner();
  },
  get removeAds() { return removeAds; },

  /** Faut-il afficher un bouton « Confidentialité et publicité » dans les réglages ? */
  get privacyOptionsRequired() { return privacyRequired; },

  async showPrivacyOptions() {
    if (estNatif()) { try { await AdMob().showPrivacyOptionsForm(); } catch (e) { console.warn(e); } }
  },

  /** Bannière en bas de l'écran. À n'appeler que sur un écran hors jeu (menus, carte). */
  async showBanner() {
    bannerWanted = true;
    if (removeAds || !ready) return;
    if (!estNatif()) { this.simulateur.banniere(true); return; }
    if (!canRequestAds) return;
    try {
      await AdMob().showBanner({
        adId: ids().banniere, adSize: "ADAPTIVE_BANNER", position: "BOTTOM_CENTER", margin: 0, isTesting: testing(),
      });
      if (bannerWanted && !removeAds) document.body.classList.add("kit-banniere");
      else await AdMob().hideBanner();
    } catch (e) { console.warn(e); }
  },

  async hideBanner() {
    bannerWanted = false;
    if (globalThis.document) document.body.classList.remove("kit-banniere");
    if (!estNatif()) { if (globalThis.document) this.simulateur.banniere(false); return; }
    try { await AdMob().hideBanner(); } catch (e) { /* pas de bannière */ }
  },

  /**
   * À appeler à la fin de chaque partie (gagnée ou perdue), quand le joueur quitte l'écran de fin.
   * N'affiche une pub que si les règles le permettent. Résout true si une pub a été montrée.
   */
  async maybeInterstitial(levelNumber) {
    const r = regles();
    if (removeAds || !ready || levelNumber < r.aPartirDuNiveau) return false;
    gamesSinceAd++;
    if (gamesSinceAd < r.toutesLes || Date.now() - lastAdAt < r.delaiMin * 1000) return false;
    gamesSinceAd = 0;
    lastAdAt = Date.now();
    if (!estNatif()) { await this.simulateur.pub({ title: "Pub interstitielle", seconds: 3, closable: false }); return true; }
    if (!canRequestAds) return false;
    try { await AdMob().showInterstitial(); } catch (e) { /* pas encore chargée */ }
    preload();
    return true;
  },

  /** Pub récompensée. Résout `true` si le joueur l'a regardée jusqu'au bout. */
  async rewarded() {
    if (!ready) return false;
    let ok = false;
    if (!estNatif()) ok = await this.simulateur.pub({ title: "Pub récompensée", seconds: 5, closable: true });
    else if (canRequestAds) {
      try { ok = !!(await AdMob().showRewardVideoAd()); } catch (e) { ok = false; }
      preload();
    }
    lastAdAt = Date.now(); // évite d'enchaîner avec une interstitielle
    return ok;
  },

  /** Remet les compteurs à zéro (tests). */
  _reinitialiser() { ready = false; canRequestAds = false; privacyRequired = false; gamesSinceAd = 0; lastAdAt = 0; removeAds = false; bannerWanted = false; },
};
