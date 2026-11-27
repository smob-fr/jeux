// Plans des niveaux construits par outils/construire-niveaux.mjs (aventure : 1-1 à 3-10, plus « test »).
// Chaque monde a un plan pour son premier niveau (de) et son dernier (a) ; les autres sont interpolés.
// Les premiers niveaux du monde 1 sont réglés à la main.
//   long (m), vmax (vitesse maximale), marge (retard de la banquise sur le parcours parfait, en s)
//   elan : bosses de départ (et de récupération après un saut) ; relief [hauteur, montée, descente]
//   glisse : bosses pour prendre de la vitesse ; relief [hauteur, montée, descente]
//   saut : vitesse (un saut dès que le pingouin parfait dépasse vitesse × vmax au creux), decollage (hauteur
//          de la bosse de décollage × hauteur des glisses), tolerance (vol calculé pour tolerance × vitesse
//          parfaite), eau (probabilité d'une crevasse remplie d'eau), recup (bosses d'élan après le saut),
//          vol [distance au début, à la fin du niveau]
//   poissons : probabilité d'un poisson bleu, d'un poisson doré au-dessus d'une bosse

const lerp = (a, b, t) => a + (b - a) * t;
function melanger(A, B, t) {
  if (Array.isArray(A)) return A.map((v, i) => melanger(v, B[i], t));
  if (typeof A === "object") { const o = {}; for (const k of Object.keys(A)) o[k] = melanger(A[k], B[k], t); return o; }
  return Math.round(lerp(A, B, t) * 100) / 100;
}

const PREMIERS = {
  // Début du jeu : bosses régulières et rondes (sinusoïde, montée = descente), chaque sommet un peu plus bas
  // que le précédent : on apprend le rythme (décoller dans la montée, piquer par-dessus le sommet suivant,
  // retomber dans sa descente). Réglage trouvé en faisant jouer le pingouin parfait (voir le plan « test »).
  "1-1": { long: 1500, vmax: 1600, marge: 10, variation: 0.03, regulier: { haut: 260, demi: 850, pente: 50 },
    elan: { bosses: 0, relief: [260, 850, 850] }, glisse: { relief: [260, 850, 850] },
    saut: { vitesse: 99, decollage: 1, tolerance: 1, eau: 0, recup: 0, vol: [0, 0] }, poissons: { bleu: 0, or: 0 } },
  "1-2": { long: 1800, vmax: 1650, marge: 9.5, variation: 0.03, regulier: { haut: 270, demi: 850, pente: 55 },
    elan: { bosses: 0, relief: [270, 850, 850] }, glisse: { relief: [270, 850, 850] },
    saut: { vitesse: 99, decollage: 1, tolerance: 1, eau: 0, recup: 0, vol: [0, 0] }, poissons: { bleu: 0, or: 0 } },
  "1-3": { long: 2000, vmax: 1700, marge: 9, variation: 0.03, regulier: { haut: 280, demi: 850, pente: 60 },
    elan: { bosses: 0, relief: [280, 850, 850] }, glisse: { relief: [280, 850, 850] },
    saut: { vitesse: 99, decollage: 1, tolerance: 1, eau: 0, recup: 0, vol: [0, 0] }, poissons: { bleu: 0.4, or: 0 } },
};
const MONDES = {
  1: {
    de: { long: 1300, vmax: 1600, marge: 9, elan: { bosses: 3, relief: [110, 780, 800] }, glisse: { relief: [130, 800, 850] },
      saut: { vitesse: 0.88, decollage: 1.25, tolerance: 0.88, eau: 0, recup: 2, vol: [1500, 2000] }, poissons: { bleu: 0.35, or: 0.1 } },
    a: { long: 1900, vmax: 1850, marge: 7, elan: { bosses: 2, relief: [130, 700, 750] }, glisse: { relief: [150, 800, 950] },
      saut: { vitesse: 0.84, decollage: 1.3, tolerance: 0.9, eau: 0, recup: 2, vol: [1600, 2300] }, poissons: { bleu: 0.4, or: 0.12 } },
  },
  2: {
    de: { long: 1800, vmax: 1900, marge: 6.5, elan: { bosses: 2, relief: [140, 650, 750] }, glisse: { relief: [160, 820, 1000] },
      saut: { vitesse: 0.82, decollage: 1.3, tolerance: 0.9, eau: 0.5, recup: 2, vol: [1600, 2300] }, poissons: { bleu: 0.4, or: 0.12 } },
    a: { long: 2500, vmax: 2100, marge: 5, elan: { bosses: 2, relief: [170, 600, 720] }, glisse: { relief: [170, 850, 1050] },
      saut: { vitesse: 0.8, decollage: 1.3, tolerance: 0.92, eau: 0.8, recup: 1, vol: [1700, 2500] }, poissons: { bleu: 0.45, or: 0.15 } },
  },
  3: {
    de: { long: 2200, vmax: 2100, marge: 5, elan: { bosses: 2, relief: [180, 600, 720] }, glisse: { relief: [170, 850, 1050] },
      saut: { vitesse: 0.8, decollage: 1.3, tolerance: 0.92, eau: 0.85, recup: 1, vol: [1700, 2500] }, poissons: { bleu: 0.45, or: 0.15 } },
    a: { long: 3000, vmax: 2300, marge: 4, elan: { bosses: 1, relief: [200, 550, 700] }, glisse: { relief: [200, 750, 1000] },
      saut: { vitesse: 0.78, decollage: 1.35, tolerance: 0.94, eau: 1, recup: 1, vol: [1800, 2600] }, poissons: { bleu: 0.5, or: 0.2 } },
  },
};
const CIEL = { 1: 0, 2: 1, 3: 2 };

/** Tous les plans : { "1-1": plan, …, "3-10": plan, test: plan }. */
export function plans() {
  const L = {};
  for (const m of [1, 2, 3]) {
    const debut = m === 1 ? 4 : 1;
    for (let i = 1; i <= 10; i++) {
      const id = `${m}-${i}`;
      let p = PREMIERS[id];
      if (!p) p = melanger(MONDES[m].de, MONDES[m].a, (i - debut) / (10 - debut));
      p = JSON.parse(JSON.stringify(p));
      p.long = Math.round(p.long / 50) * 50; p.marge = Math.round(p.marge * 10) / 10;
      p.elan.bosses = Math.round(p.elan.bosses); p.saut.recup = Math.round(p.saut.recup);
      L[id] = { ...p, ciel: CIEL[m], graine: m * 1000 + i * 37 + 11 };
    }
  }
  // niveau test du terrain d'essai : bosses régulières et rondes (28/11). Réglage trouvé en faisant jouer
  // le pingouin parfait sur des collines identiques : hauteur 280, demi-longueur 850 (une bosse tous les
  // 1 700), vitesse 1 700, chaque sommet 60 plus bas que le précédent : il vole d'une bosse à l'autre et
  // retombe en glisse parfaite à presque chaque bosse. ± 3 % de variation.
  L.test = { nom: "Niveau test : bosses régulières", long: 1600, vmax: 1700, marge: 8, graine: 7, ciel: 0, variation: 0.03,
    regulier: { haut: 280, demi: 850, pente: 60 },
    elan: { bosses: 0, relief: [280, 850, 850] }, glisse: { relief: [280, 850, 850] },
    saut: { vitesse: 99, decollage: 1, tolerance: 1, eau: 0, recup: 0, vol: [0, 0] }, poissons: { bleu: 0.25, or: 0.1 } };
  return L;
}
