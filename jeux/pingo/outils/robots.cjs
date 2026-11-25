// Pingouins robots pour vérifier les niveaux sans navigateur (outils/verifier-niveaux.mjs).
// Chaque robot décide à chaque pas s'il appuie ; il joue à 60 images/s, 4 sous-pas, comme le jeu.
const Pingo = require("../moteur.js");

/** Débutant : appuie dans les descentes (avec un temps de réaction), lâche dans les montées, jamais en l'air. */
function debutant() {
  let retard = 0;
  return (g) => {
    const p = g.p;
    if (!p.ground) return false;
    const veut = g.terrain.pente(p.x) < -0.03;
    retard = veut ? retard + 1 : 0;
    return retard > 12; // ~0,2 s de réaction
  };
}
/** Bon joueur : idem, et appuie en l'air pour retomber dans la pente quand il va dépasser le creux. */
function bon() {
  return (g) => {
    const p = g.p, T = g.terrain;
    if (p.ground) return T.pente(p.x) < -0.02;
    // en l'air : on plonge si le sol sous nous descend encore et qu'on redescend déjà
    return p.vy < 0 && T.pente(p.x + p.vx * 0.25) < -0.05 && p.y - T.h(p.x) < 260;
  };
}
/** Ne touche jamais l'écran. */
function rien() { return () => false; }
/** Joue une partie ; renvoie le bilan. maxS : durée maximale (s). */
function jouer(opts, robot, maxS = 240) {
  const atter = { parfait: 0, dur: 0, boum: 0, tete: 0 };
  const g = Pingo.creerPartie({ ...opts, on: (t, d) => { if (t === "atterrissage") atter[d.type]++; } });
  const dt = 1 / 60;
  let n = 0;
  while (g.etat === "jeu" && g.time < maxS) {
    for (let i = 0; i < 4 && g.etat === "jeu"; i++) { g.hold = robot(g); g.step(dt / 4); }
    n++;
  }
  return { etat: g.etat, m: g.m, temps: g.time, score: g.score, total: g.total, poissons: g.fishCount, atter, etoiles: g.etat === "gagne" ? Pingo.etoiles(g.score, g.total) : 0, hautsVols: g.hautsVols };
}
module.exports = { rien, debutant, bon, jouer, Pingo };
