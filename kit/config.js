// Kit — configuration du jeu (contenu de jeux/<nom>/jeu.json).
// Le jeu appelle configurer(jeu) une fois, au démarrage, avant d'initialiser les pubs ou la boutique.

let jeu = { id: "jeu", nom: "Jeu", version: "0", admob: { test: true }, revenuecat: {}, produits: [] };

export function configurer(cfg) {
  jeu = { ...jeu, ...cfg };
  return jeu;
}

/** La configuration courante (lecture seule par convention). */
export function config() {
  return jeu;
}
