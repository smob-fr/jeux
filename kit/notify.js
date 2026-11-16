// Kit — notifications locales (programmées sur le téléphone, sans serveur).
// Convention (CLAUDE.md) : proposées après une explication, jamais entre 21 h et 9 h, reprogrammées
// quand le joueur quitte le jeu et annulées à son retour. Dans un navigateur, elles ne sont pas
// disponibles : Notify.supported vaut false et le réglage n'est pas affiché.
import { config } from "./config.js";
import { plugin } from "./plateforme.js";

export const HEURES_CALMES = [21, 9]; // jamais entre 21 h et 9 h
export const CANAL = "rappels";

/** Décale une date hors des heures calmes (au matin, 9 h 30). Modifie et renvoie la date. */
export function horsHeuresCalmes(d, [debut, fin] = HEURES_CALMES) {
  const h = d.getHours();
  if (h >= debut) { d.setDate(d.getDate() + 1); d.setHours(fin, 30, 0, 0); }
  else if (h < fin) d.setHours(fin, 30, 0, 0);
  return d;
}

/**
 * Rappels habituels d'un jeu à vies et cadeau du jour, prêts pour Notify.schedule :
 * vies rechargées (101), cadeau du jour à 18 h (102), retour après 3 jours (103).
 * etat = { livesFullAt (ms ou null), giftOpenedToday }, textes = remplacements { vies, cadeau, retour }.
 */
export function rappelsStandard(etat, textes = {}, maintenant = Date.now()) {
  const nom = config().nom;
  const T = {
    vies: { titre: "Tes vies sont rechargées ❤️", texte: `Reviens jouer à ${nom} !` },
    cadeau: { titre: "Ton cadeau du jour est prêt 🎁", texte: "Ouvre-le pour gagner un bonus gratuit." },
    retour: { titre: `${nom} t'attend`, texte: "Reviens terminer ton prochain niveau !" },
    ...textes,
  };
  const liste = [];
  if (etat.livesFullAt && etat.livesFullAt > maintenant + 60e3) {
    liste.push({ id: 101, ...T.vies, quand: new Date(etat.livesFullAt) });
  }
  const gift = new Date(maintenant);
  gift.setHours(18, 0, 0, 0);
  if (etat.giftOpenedToday || gift.getTime() < maintenant + 60e3) gift.setDate(gift.getDate() + 1);
  liste.push({ id: 102, ...T.cadeau, quand: gift });
  liste.push({ id: 103, ...T.retour, quand: new Date(maintenant + 3 * 864e5) });
  return liste;
}

const LN = () => plugin("LocalNotifications");

export const Notify = {
  get supported() { return !!LN(); },

  async permission() {
    if (!this.supported) return "unsupported";
    try { return (await LN().checkPermissions()).display; } catch (e) { return "denied"; }
  },

  /** Demande l'autorisation au système. Résout true si elle est accordée. */
  async request() {
    if (!this.supported) return false;
    try {
      const st = await LN().requestPermissions();
      if (st.display === "granted") {
        try {
          await LN().createChannel({ id: CANAL, name: "Rappels", description: `Rappels de ${config().nom}`, importance: 3 });
        } catch (e) { /* iOS : pas de canaux */ }
        return true;
      }
    } catch (e) { /* refusé */ }
    return false;
  },

  /** Annule tous les rappels en attente du jeu. */
  async cancelAll() {
    if (!this.supported) return;
    try {
      const { notifications } = await LN().getPending();
      if (notifications?.length) await LN().cancel({ notifications: notifications.map((n) => ({ id: n.id })) });
    } catch (e) { /* rien à annuler */ }
  },

  /**
   * Remplace les rappels en attente par `liste` : [{ id, titre, texte, quand: Date|ms, calme?: true, extra? }].
   * Les rappels passés (ou dans moins d'une minute) sont ignorés ; ceux qui tombent la nuit sont
   * décalés au matin, sauf `calme: false`. Résout la liste réellement programmée.
   */
  async schedule(liste, { enabled = true } = {}) {
    if (!this.supported) return [];
    await this.cancelAll();
    if (!enabled || (await this.permission()) !== "granted") return [];
    const now = Date.now();
    const notifications = [];
    for (const n of liste) {
      let at = new Date(n.quand);
      // un rappel déjà passé est ignoré AVANT le décalage des heures calmes : sinon, la nuit,
      // il serait repoussé au lendemain matin au lieu d'être oublié
      if (at.getTime() < now + 60e3) continue;
      if (n.calme !== false) at = horsHeuresCalmes(at);
      notifications.push({ id: n.id, title: n.titre, body: n.texte, channelId: CANAL, extra: n.extra,
        schedule: { at, allowWhileIdle: true } });
    }
    if (!notifications.length) return [];
    try { await LN().schedule({ notifications }); } catch (e) { console.warn("Notifications", e); return []; }
    return notifications;
  },
};
