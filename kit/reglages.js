// Kit — fenêtre des réglages, commune à tous les jeux.
// Convention (CLAUDE.md) : effets sonores, musique, vibrations, rappels, comment jouer, revoir le
// tutoriel, restaurer mes achats, confidentialité et publicité (si exigé), effacer ma progression
// (avec confirmation), numéro de version.
//
// La sauvegarde garde data.sound, data.music, data.haptics (booléens) et data.notif
// (true, false, ou null tant que les rappels n'ont pas été proposés).
import { Ads } from "./ads.js";
import { Notify } from "./notify.js";
import { Sound } from "./sound.js";
import { config } from "./config.js";
import { ICONS } from "./icones.js";
import { fenetre } from "./fenetres.js";
import { Boutique } from "./boutique.js";

/** Applique les réglages enregistrés au moteur de son (au démarrage). */
export function appliquerReglages(data) {
  Sound.sfx = data.sound !== false;
  Sound.haptics = data.haptics !== false;
  Sound.music = data.music !== false;
}

function interrupteur(id, label, icon, on) {
  return `<button class="kit-interrupteur" data-act="${id}" aria-pressed="${on}"><span class="kit-int-icone">${ICONS[icon]}</span><span class="kit-int-label">${label}</span><span class="kit-switch"><span></span></span></button>`;
}

/**
 * ouvrirReglages({ data, enregistrer, enJeu, actions: { tutoriel, aide, effacer, fermer } })
 * enJeu : ouvert depuis la pause (sans « revoir le tutoriel », « restaurer », « effacer »).
 * actions.effacer() n'est appelé qu'après confirmation. actions.fermer() au bouton Fermer.
 */
export function ouvrirReglages(o) {
  const { data, enregistrer, enJeu = false, actions = {} } = o;
  const rouvrir = () => ouvrirReglages(o);
  fenetre(`<h2>Réglages</h2>
    <div class="kit-interrupteurs">
      ${interrupteur("sfx", "Effets sonores", "sound", Sound.sfx)}
      ${interrupteur("music", "Musique", "music", Sound.music)}
      ${interrupteur("haptics", "Vibrations", "vibrate", Sound.haptics)}
      ${Notify.supported ? interrupteur("notif", "Rappels", "bell", data.notif === true) : ""}
    </div>
    ${enJeu || !actions.tutoriel ? "" : `<button class="kit-btn" data-act="tuto">Revoir le tutoriel</button>`}
    ${enJeu ? "" : `<button class="kit-btn" data-act="restore">Restaurer mes achats</button>`}
    ${actions.aide ? `<button class="kit-btn" data-act="help">Comment jouer</button>` : ""}
    ${Ads.privacyOptionsRequired ? `<button class="kit-btn" data-act="privacy">Confidentialité et publicité</button>` : ""}
    ${enJeu || !actions.effacer ? "" : `<button class="kit-btn ghost danger" data-act="reset">Effacer ma progression</button>`}
    <button class="kit-btn big" data-act="close">Fermer</button>
    <p class="kit-version">${config().nom} ${config().version}</p>`, (act) => {
    if (act === "sfx") { Sound.sfx = !Sound.sfx; data.sound = Sound.sfx; enregistrer(); rouvrir(); }
    if (act === "music") { Sound.music = !Sound.music; data.music = Sound.music; enregistrer(); rouvrir(); }
    if (act === "haptics") { Sound.haptics = !Sound.haptics; data.haptics = Sound.haptics; enregistrer(); rouvrir(); }
    if (act === "notif") {
      (async () => {
        if (data.notif === true) data.notif = false;
        else data.notif = await Notify.request();
        enregistrer();
        if (!data.notif && (await Notify.permission()) === "denied") {
          fenetre(`<h2>Rappels bloqués</h2><p>Les notifications sont désactivées pour ${config().nom} dans les réglages de ton téléphone. Active-les là-bas, puis reviens ici.</p>
            <button class="kit-btn big" data-act="close">OK</button>`, rouvrir);
        } else rouvrir();
      })();
    }
    if (act === "tuto") actions.tutoriel();
    if (act === "restore") Boutique.restaurer();
    if (act === "help") actions.aide();
    if (act === "privacy") Ads.showPrivacyOptions();
    if (act === "reset") confirmerEffacement(actions.effacer);
    if (act === "close") actions.fermer?.();
  });
}

function confirmerEffacement(effacer) {
  fenetre(`<h2>Tout effacer ?</h2><p>Tes niveaux, étoiles et bonus seront perdus. Cette action est définitive.</p>
    <div class="kit-rang"><button class="kit-btn ghost" data-act="close">Annuler</button><button class="kit-btn danger-fill" data-act="yes">Effacer</button></div>`, (act) => {
    if (act === "yes") effacer();
  });
}

/**
 * Propose les rappels après une explication (convention : au bon moment, jamais au lancement).
 * Résout true si le joueur les a acceptés et que le système les autorise.
 */
export function proposerRappels(data, enregistrer, texte) {
  return new Promise((done) =>
    fenetre(`<div class="kit-fenetre-icone">${ICONS.bell}</div><h2>On te prévient ?</h2>
      <p>${texte || "Reçois un petit rappel quand tes <b>vies sont rechargées</b> et quand ton <b>cadeau du jour</b> t'attend. Jamais la nuit, promis."}</p>
      <button class="kit-btn big" data-act="yes">Oui, avec plaisir</button>
      <button class="kit-btn ghost" data-act="no">Plus tard</button>`, async (act) => {
      data.notif = act === "yes" ? await Notify.request() : false;
      enregistrer();
      done(data.notif);
    }));
}
