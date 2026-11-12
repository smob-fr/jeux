// Kit — fenêtres (modales) et écrans.
//
// fenetre(html, onAction) : affiche une fenêtre ; chaque bouton [data-act="…"] la ferme et appelle
// onAction(act, bouton). Les éléments #kit-fenetre et #kit-fenetre-boite sont créés au besoin.
//
// Ecrans : bascule entre des sections plein écran (classe kit-ecran) avec une transition, et applique
// la règle de la bannière : elle n'est montrée que sur les écrans déclarés dans `banniere`, et elle
// est masquée AVANT la transition vers un autre écran (jamais visible sur un écran de jeu).
import { Ads } from "./ads.js";
import { Sound } from "./sound.js";

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

function elementsFenetre() {
  let m = document.getElementById("kit-fenetre");
  if (!m) {
    m = document.createElement("div");
    m.id = "kit-fenetre";
    m.innerHTML = `<div id="kit-fenetre-boite" role="dialog" aria-modal="true"></div>`;
    document.body.appendChild(m);
  }
  return [m, document.getElementById("kit-fenetre-boite")];
}

/** Affiche une fenêtre. Les boutons [data-act] la ferment et appellent onAction(act, bouton). */
export function fenetre(html, onAction) {
  const [m, box] = elementsFenetre();
  box.innerHTML = html;
  m.classList.remove("closing");
  m.classList.add("open");
  box.onclick = (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    Sound.tap();
    m.classList.add("closing");
    setTimeout(() => {
      m.classList.remove("open", "closing");
      onAction && onAction(btn.dataset.act, btn);
    }, 220);
  };
  return box;
}

/** Comme fenetre(), mais résout l'action choisie. */
export function demander(html) {
  return new Promise((resolve) => fenetre(html, (act) => resolve(act)));
}

/** Petite fenêtre d'information avec un seul bouton. */
export function informer(titre, texte, bouton = "OK") {
  return demander(`<h2>${titre}</h2><p>${texte}</p><button class="kit-btn big" data-act="close">${bouton}</button>`);
}

export const Ecrans = {
  actuel: null,
  banniere: new Set(),

  /** banniere : identifiants des écrans où la bannière est permise (menus, carte), jamais un écran de jeu. */
  configurer({ initial, banniere = [] } = {}) {
    if (initial) this.actuel = initial;
    this.banniere = new Set(banniere);
  },

  /** Affiche l'écran `id`. `avant()` est appelé juste avant qu'il apparaisse (pour le remplir). */
  async afficher(id, avant) {
    const permise = this.banniere.has(id);
    if (!permise) Ads.hideBanner(); // avant la transition : jamais de bannière sur un écran de jeu
    if (id === this.actuel) {
      avant && avant();
      if (permise) Ads.showBanner();
      return;
    }
    const from = this.actuel ? document.getElementById(this.actuel) : null;
    const to = document.getElementById(id);
    this.actuel = id;
    from?.classList.add("leaving");
    await attendre(260);
    from?.classList.remove("active", "leaving");
    to.classList.add("active", "entering");
    // La bannière avant de remplir l'écran : sa hauteur compte dans la mise en page (défilement de la carte…).
    if (permise && this.actuel === id) Ads.showBanner();
    avant && avant();
    void to.offsetWidth;
    to.classList.remove("entering");
    await attendre(350);
  },
};
