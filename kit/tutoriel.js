// Kit — briques du tutoriel guidé (convention : une main montre le geste, la zone à jouer est mise
// en lumière, une bulle explique, le joueur fait lui-même les premiers coups).
// Le déroulé (quelles étapes, quels coups) appartient au jeu ; le kit fournit l'affichage.
//
// Calque #kit-tuto créé au besoin, avec #kit-tuto-projecteur, #kit-tuto-main et #kit-tuto-bulle.
// Toutes les positions sont en pixels de la fenêtre (getBoundingClientRect()).
import { Sound } from "./sound.js";

const $ = (id) => document.getElementById(id);

function calque() {
  let c = $("kit-tuto");
  if (!c) {
    c = document.createElement("div");
    c.id = "kit-tuto";
    c.hidden = true;
    c.innerHTML = `<div id="kit-tuto-projecteur" hidden></div><div id="kit-tuto-main" hidden><span class="kit-doigt"></span></div><div id="kit-tuto-bulle" hidden></div>`;
    document.body.appendChild(c);
  }
  return c;
}

export const Tutoriel = {
  /** L'élément du calque, pour y ajouter des repères propres au jeu. */
  get calque() { return calque(); },

  /** Montre le calque du tutoriel (bloque les gestes, sauf sur la bulle). */
  ouvrir() { calque().hidden = false; },

  /** Cache tout. */
  fermer() {
    const c = calque();
    c.hidden = true;
    for (const id of ["kit-tuto-projecteur", "kit-tuto-main", "kit-tuto-bulle"]) $(id).hidden = true;
  },

  /** Met en lumière un rectangle { left, top, width, height } (null pour l'enlever). */
  projecteur(rect, rond = false) {
    calque();
    const s = $("kit-tuto-projecteur");
    if (!rect) { s.hidden = true; return; }
    s.hidden = false;
    const pad = 6;
    Object.assign(s.style, {
      left: rect.left - pad + "px", top: rect.top - pad + "px",
      width: rect.width + pad * 2 + "px", height: rect.height + pad * 2 + "px",
    });
    s.classList.toggle("rond", rond);
  },

  /** Main animée qui glisse de { x, y } vers { x, y } (même point : un appui). null pour la cacher. */
  main(de, vers = de) {
    calque();
    const h = $("kit-tuto-main");
    if (!de) { h.hidden = true; return; }
    h.hidden = false;
    h.style.left = de.x + "px"; h.style.top = de.y + "px";
    h.style.setProperty("--dx", vers.x - de.x + "px");
    h.style.setProperty("--dy", vers.y - de.y + "px");
  },

  /**
   * Bulle d'explication, placée au-dessus ou en dessous de `pres` (un rectangle).
   * Avec `bouton`, résout quand le joueur appuie dessus ; sinon résout tout de suite.
   */
  bulle(html, { pres, bouton } = {}) {
    calque();
    const bb = $("kit-tuto-bulle");
    bb.innerHTML = `<div class="kit-tuto-texte">${html}</div>${bouton ? `<button class="kit-btn big petit" id="kit-tuto-ok">${bouton}</button>` : ""}`;
    bb.hidden = false;
    const H = innerHeight;
    if (pres && pres.top > H * 0.45) { bb.style.top = ""; bb.style.bottom = H - pres.top + 18 + "px"; }
    else { bb.style.bottom = ""; bb.style.top = (pres ? pres.top + pres.height : H * 0.3) + 18 + "px"; }
    bb.classList.remove("in"); void bb.offsetWidth; bb.classList.add("in");
    if (!bouton) return Promise.resolve();
    return new Promise((res) => { $("kit-tuto-ok").onclick = () => { Sound.tap(); res(); }; });
  },

  /** Cache la bulle. */
  cacherBulle() { calque(); $("kit-tuto-bulle").hidden = true; },
};
