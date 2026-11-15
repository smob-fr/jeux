// Kit — statistiques anonymes (PostHog, hébergement UE), extraites de Ça Roule.
// Aucune donnée personnelle : un identifiant aléatoire par appareil, pas de cookie, pas de script
// externe (simple envoi groupé vers l'API /batch/), pas de profil (`$process_person_profile: false`).
// Actives seulement si jeu.json › statistiques.posthog contient une clé publique `phc_…`, et si le
// joueur ne les a pas coupées (data.stats === false). Rien n'est envoyé depuis un navigateur piloté
// par des tests (navigator.webdriver), sauf si le test le demande (globalThis.KIT_STATS_TEST = true)
// et intercepte lui-même le réseau.
//
// Chaque événement porte : jeu (id), version, build, plateforme (app, web-installed, web), langue,
// taille d'écran. Événements communs : session_start, level_start, level_win, level_fail, level_quit
// (raison : home, restart, switch, closed…), et, envoyés par le kit lui-même : ad_reward,
// ad_interstitial, purchase, restore. Chaque jeu ajoute les siens avec Stats.track().
import { config } from "./config.js";
import { estNatif } from "./plateforme.js";

const HOTE = "https://eu.i.posthog.com";
let data = null, enregistrer = () => {}, build = "dev";
let queue = [], timer = null, A = null, branche = false;

const cle = () => config().statistiques?.posthog || "";
const hote = () => config().statistiques?.hote || HOTE;
const pilote = () => !!globalThis.navigator?.webdriver && !globalThis.KIT_STATS_TEST;
const autonome = () => { try { return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; } catch (e) { return false; } };
const attKey = () => `${config().id}.att`;
const stockage = () => { try { return globalThis.localStorage || null; } catch (e) { return null; } };

function base() {
  const n = globalThis.navigator || {}, s = globalThis.screen || {};
  return {
    distinct_id: data?.uid || "anonyme", $process_person_profile: false,
    jeu: config().id, version: config().version, build,
    platform: estNatif() ? "app" : autonome() ? "web-installed" : "web",
    lang: n.language, sw: s.width, sh: s.height,
  };
}
function send(beacon) {
  clearTimeout(timer); timer = null;
  if (!queue.length) return;
  const url = hote() + "/batch/";
  const body = JSON.stringify({ api_key: cle(), batch: queue.splice(0) });
  try {
    if (beacon && navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: "text/plain" }))) return;
    fetch(url, { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(() => {});
  } catch (e) { /* réseau indisponible : tant pis */ }
}
const garder = () => { try { if (A) stockage()?.setItem(attKey(), JSON.stringify(A)); else stockage()?.removeItem(attKey()); } catch (e) { /* ignoré */ } };
const duree = () => (A ? A.acc + (A.t0 ? Date.now() - A.t0 : 0) : 0);
function infos() {
  const o = { mode: A.mode, level: A.level, ms: duree() };
  for (const [k, v] of Object.entries(A)) if (!["mode", "level", "t0", "acc"].includes(k)) o[k] = v;
  return o;
}
function quitter(raison, beacon) {
  if (!A) return;
  Stats.track("level_quit", { ...infos(), reason: raison });
  A = null; garder();
  if (beacon) send(true);
}

export const Stats = {
  /** Vrai si le jeu a une clé PostHog (le réglage « Statistiques anonymes » n'a de sens que dans ce cas). */
  get disponible() { return /^phc_[A-Za-z0-9]+$/.test(cle()); },
  /** Vrai si les événements partent vraiment (clé, accord du joueur, pas un navigateur de test). */
  get actif() { return this.disponible && !!data && data.stats !== false && !pilote(); },

  /**
   * À appeler au démarrage, après la lecture de la sauvegarde.
   * data : objet de sauvegarde (on y range data.uid et data.stats), build : numéro de construction (facultatif).
   * Reprend une tentative de niveau restée ouverte (jeu fermé en pleine partie) : level_quit « closed ».
   */
  init({ data: d, enregistrer: e = () => {}, build: b } = {}) {
    data = d; enregistrer = e; if (b) build = b;
    if (!data.uid) { data.uid = "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); enregistrer(); }
    if (typeof data.stats !== "boolean") data.stats = true;
    try {
      const ancien = JSON.parse(stockage()?.getItem(attKey()) || "null");
      if (ancien) { A = ancien; A.t0 = 0; quitter("closed"); }
    } catch (err) { /* ignoré */ }
    if (!branche && globalThis.document) {
      branche = true;
      document.addEventListener("visibilitychange", () => {
        if (A) { if (document.hidden) { A.acc = duree(); A.t0 = 0; garder(); } else A.t0 = Date.now(); }
        if (document.hidden) send(true);
      });
      globalThis.addEventListener?.("pagehide", () => { if (A) { A.acc = duree(); A.t0 = 0; garder(); } send(true); });
    }
  },

  /** Le joueur coupe ou rallume les statistiques (réglage). */
  activer(v) {
    if (!data) return;
    if (!v) { this.track("setting_change", { stats: false }); send(); } // dernier envoi, puis plus rien
    data.stats = !!v; enregistrer();
    if (v) this.track("setting_change", { stats: true });
  },

  /** Un événement. Envoi groupé : toutes les 8 s, par 20, ou quand le jeu passe en arrière-plan. */
  track(event, props) {
    if (!this.actif) return;
    queue.push({ event, timestamp: new Date().toISOString(), properties: { ...base(), ...props } });
    if (queue.length >= 20) send(); else if (!timer) timer = setTimeout(send, 8000);
  },

  /* ---------- tentative de niveau (durée active, compteurs, abandons) ---------- */
  /** Début d'un niveau. extra : compteurs ou infos à joindre (ex. { opt: 9, hints: 0 }). */
  debut(mode, level, extra = {}) {
    if (A) quitter(A.mode === mode && A.level === level ? "restart" : "switch");
    A = { mode, level, t0: Date.now(), acc: 0, fails: 0, ...extra };
    garder();
    this.track("level_start", { mode, level, ...extra });
  },
  /** +1 sur un compteur de la tentative en cours (indices, chutes, annulations…). */
  compter(k) { if (A) { A[k] = (A[k] || 0) + 1; garder(); } },
  /** Niveau gagné. */
  gagne(props) { if (!A) return; this.track("level_win", { ...infos(), ...props }); A = null; garder(); },
  /** Niveau raté (la tentative continue : on peut réessayer, relancer…). */
  echec(props) { if (!A) return; A.fails++; garder(); this.track("level_fail", { ...infos(), ...props }); },
  /** Le joueur quitte le niveau sans le finir (raison : home, menu, pause…). */
  quitter(raison) { quitter(raison); },
  /** Mode de la tentative en cours, ou null. */
  get enCours() { return A ? A.mode : null; },

  /** Envoie tout de suite ce qui attend. */
  flush() { send(); },
  _reinitialiser() { data = null; queue = []; clearTimeout(timer); timer = null; A = null; build = "dev"; },
};
