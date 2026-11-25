// Pingouins robots pour vérifier les niveaux sans navigateur (outils/verifier-niveaux.mjs,
// outils/parcours-parfaits.mjs). Ils jouent au pas de 1/240 s, comme le jeu (4 sous-pas à 60 images/s).
const Pingo = require("../moteur.js");
const { SOUS_PAS, PAS_ENTREE } = Pingo;
const PAR_TRANCHE = Math.round(PAS_ENTREE / SOUS_PAS);

/** Ne touche jamais l'écran. */
function rien() { return () => false; }
/** Débutant : appuie dans les descentes (avec un temps de réaction), lâche dans les montées, jamais en l'air. */
function debutant() {
  let retard = 0;
  return (g) => {
    const p = g.p;
    if (!p.ground) return false;
    const veut = g.terrain.pente(p.x) < -0.03;
    retard = veut ? retard + 1 : 0;
    return retard > 48; // ~0,2 s de réaction
  };
}
/** Bon joueur : idem, et appuie en l'air pour retomber dans la pente quand il va dépasser le creux. */
function bon() {
  return (g) => {
    const p = g.p, T = g.terrain;
    if (p.ground) return T.pente(p.x) < -0.02;
    return p.vy < 0 && T.pente(p.x + p.vx * 0.25) < -0.05 && p.y - T.h(p.x) < 260;
  };
}
/** Joue une partie avec un robot qui décide à chaque sous-pas ; renvoie le bilan. maxS : durée maximale (s). */
function jouer(opts, robot, maxS = 240) {
  const atter = { parfait: 0, dur: 0, boum: 0, tete: 0 };
  const g = Pingo.creerPartie({ ...opts, on: (t, d) => { if (t === "atterrissage") atter[d.type]++; } });
  while (g.etat === "jeu" && g.time < maxS) { g.hold = robot(g); g.step(SOUS_PAS); }
  return bilan(g, atter);
}
function bilan(g, atter) {
  return { etat: g.etat, m: g.m, temps: g.time, score: g.score, total: g.total, poissons: g.fishCount, atter,
    etoiles: g.etat === "gagne" ? Pingo.etoiles(g.score, g.total) : 0, hautsVols: g.hautsVols, avanceMin: g._avanceMin };
}
/** Joue un niveau (banquise comprise) en suivant une liste d'appuis par tranche de 0,05 s. */
function jouerEntrees(niveau, bits) {
  const atter = { parfait: 0, dur: 0, boum: 0, tete: 0 };
  const g = Pingo.creerPartie({ niveau, on: (t, d) => { if (t === "atterrissage") atter[d.type]++; } });
  for (let i = 0; g.etat === "jeu" && g.time < 240; i++) {
    g.hold = !!bits[i];
    for (let k = 0; k < PAR_TRANCHE && g.etat === "jeu"; k++) g.step(SOUS_PAS);
  }
  return bilan(g, atter);
}

let PENALITE_BOUM = 0, BONUS_PARFAIT = 0;
/* ---------------- Pingouin parfait : recherche en faisceau ----------------
   Toutes les 0,05 s, on garde les « largeur » meilleures situations, on essaie pour chacune « appuyer » et
   « lâcher » pendant la tranche suivante, et on recommence. La première situation qui atteint l'igloo
   donne le parcours le plus rapide trouvé. Poissons et turbo compris.
   Note d'une situation : distance + 0,6 × vitesse (gros malus dans l'eau).
   auSol (niveaux construits) : le pingouin parfait n'appuie jamais en l'air. Sinon, plonger en l'air, qui fait
   gagner de la vitesse tout de suite, écarte le vol qui atteint la bosse cible et il tombe à l'eau.
   prevoir : une situation en vol est notée d'après son atterrissage (fin du vol simulée sans appuyer). */
function noter(g, prevoir) {
  const base = () => g.p.x + 0.6 * Math.hypot(g.p.vx, g.p.vy) - (g.p.dansEau ? 6000 : 0);
  if (!prevoir || g.p.ground) return base();
  const e = g.sauver();
  g.hold = false;
  for (let k = 0; k < 600 && !g.p.ground && !g.p.dansEau && g.etat === "jeu"; k++) g.step(1 / 120);
  const n = base() - (g.boums > e.boums ? 800 : 0);
  g.restaurer(e);
  return n;
}
/** Avance un faisceau d'une tranche. Renvoie { faisceau, gagne } (gagne : la liste d'appuis gagnante). */
function etape(g, faisceau, { largeur = 150, prevoir = false, auSol = false } = {}) {
  const suivants = [], vus = new Set();
  for (const n of faisceau) {
    g.restaurer(n.e);
    const enVol = !g.p.ground;
    for (const appui of [0, 1]) {
      if (auSol && enVol && appui) continue;            // auSol : on n'appuie jamais en l'air
      g.restaurer(n.e); g.hold = !!appui;
      for (let k = 0; k < PAR_TRANCHE && g.etat === "jeu"; k++) g.step(SOUS_PAS);
      const bits = { a: appui, avant: n.bits };
      if (g.etat === "gagne") {
        const liste = []; for (let b = bits; b; b = b.avant) liste.push(b.a);
        return { faisceau, gagne: liste.reverse(), temps: g.time };
      }
      const p = g.p, cle = `${Math.round(p.x / 12)},${Math.round(p.y / 12)},${Math.round(p.vx / 25)},${Math.round(p.vy / 25)},${p.ground ? 1 : 0}`;
      if (vus.has(cle)) continue;
      vus.add(cle);
      const e = g.sauver();
      suivants.push({ e, bits, note: noter(g, prevoir) });
    }
  }
  suivants.sort((a, b) => b.note - a.note);
  return { faisceau: suivants.slice(0, largeur) };
}
function parfait(niveau, { largeur = 150, prevoir = false, auSol = !!niveau.points } = {}) {
  const g = Pingo.creerPartie({ niveau, rejeu: true });
  let faisceau = [{ e: g.sauver(), bits: null }];
  for (let tranche = 0; tranche < 200 / PAS_ENTREE; tranche++) {
    const r = etape(g, faisceau, { largeur, prevoir, auSol });
    if (r.gagne) return { bits: r.gagne, entrees: Pingo.encoder(r.gagne), etat: "gagne", temps: r.temps };
    faisceau = r.faisceau;
  }
  return { bits: [], entrees: "", etat: "jeu", temps: 200 };
}

/** Profils de joueurs qui prévoient : vue (s), retard de réaction (tranches de 0,05 s), largeur du faisceau. */
const PROFILS = { moyen: { vue: 0.6, retard: 4, largeur: 6 }, joueur: { vue: 0.8, retard: 3, largeur: 8 }, expert: { vue: 1.2, retard: 2, largeur: 12 } };

/* ---------------- Expert : un joueur qui prévoit ----------------
   Toutes les 0,05 s, il cherche (petit faisceau) la meilleure suite d'appuis sur « vue » secondes à partir
   de ce qu'il voit, et applique la première décision avec « retard » tranches de retard (réaction).
   Il refait son plan en continu : il corrige ses erreurs, mais ne voit pas loin. */
function expert(niveau, { vue = 1.2, largeur = 12, retard = 2, fonte = true, suivi = null } = {}) {
  const atter = { parfait: 0, dur: 0, boum: 0, tete: 0 };
  const reel = fonte ? Pingo.creerPartie({ niveau, on: (t, d) => { if (t === "atterrissage") atter[d.type]++; } }) : Pingo.creerPartie({ niveau, rejeu: true });
  const f = Pingo.creerPartie({ niveau, rejeu: true });
  const tranches = Math.round(vue / PAS_ENTREE), file = Array(retard).fill(0);
  let pire = 0;
  const avancer = (appui) => { f.hold = !!appui; for (let k = 0; k < PAR_TRANCHE && f.etat === "jeu"; k++) f.step(SOUS_PAS); };
  while (reel.etat === "jeu" && reel.time < 200) {
    const e = reel.sauver();
    // les décisions déjà prises (dans la file) s'appliquent d'abord
    f.restaurer(e);
    for (const a of file) avancer(a);
    let faisceau = [{ e: f.sauver(), premier: -1 }];
    for (let t = 0; t < tranches; t++) {
      const suivants = [];
      for (const n of faisceau) for (const appui of [0, 1]) {
        f.restaurer(n.e); avancer(appui);
        const p = f.p;
        suivants.push({ e: f.sauver(), premier: n.premier < 0 ? appui : n.premier, note: f.etat === "gagne" ? 1e9 - f.time : p.x + 0.6 * Math.hypot(p.vx, p.vy) });
      }
      suivants.sort((a, b) => b.note - a.note);
      faisceau = suivants.slice(0, largeur);
    }
    file.push(faisceau[0].premier);
    reel.hold = !!file.shift();
    for (let k = 0; k < PAR_TRANCHE && reel.etat === "jeu"; k++) reel.step(SOUS_PAS);
    if (suivi) pire = Math.max(pire, reel.time - suivi(reel));
  }
  return { ...bilan(reel, atter), retardMax: pire };
}
module.exports = { etape, rien, debutant, bon, jouer, jouerEntrees, parfait, expert, PROFILS, Pingo };
