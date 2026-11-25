// Pingo Glisse : moteur du jeu, sans affichage (collines, physique, poissons, banquise, niveaux).
// Utilisé par index.html (window.Pingo) et par les outils de vérification sous Node (module.exports).
// Unités : pixels du monde, 20 px = 1 m ; y vers le haut.
(function (racine) {
"use strict";

const PX_PER_M = 20;
const G = 1150;          // gravité
const DIVE = 2600;       // poussée supplémentaire quand on appuie
const MIN_SPEED = 230, MAX_SPEED = 2300;
const FISH_FOR_TURBO = 8;
const FROTTE = 0.25, FROTTE_VENTRE = 0.06;   // frottement de la neige par seconde, sans appuyer / en plongeant

/** Poissons : valeur (compte pour le turbo et les étoiles), rayon de ramassage, fonte repoussée. */
const POISSONS = {
  normal: { valeur: 1, rayon: 42, recul: 30 },
  bleu: { valeur: 3, rayon: 50, recul: 120 },
  or: { valeur: 5, rayon: 56, recul: 220 },
};

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
function aleatoire(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const entre = (r, [a, b]) => a + (b - a) * r();
const lerp = (a, b, t) => a + (b - a) * t;
const lerp2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

/* ---------------- Relief ----------------
   Un relief donne, pour une distance m (en mètres), les dimensions de la prochaine bosse :
   haut (hauteur du sommet), creux (profondeur du creux), descente et montee (largeurs).
   Une descente longue par rapport à la vitesse laisse le pingouin retomber dans la pente. */
const RELIEF_FACILE = { haut: [60, 80], creux: [50, 70], descente: [1200, 1350], montee: [600, 700] };

/** Mode sans fin : facile au début (prendre le rythme), puis de plus en plus grand et serré. */
function reliefSansFin(m, r) {
  if (m < 300) return { haut: entre(r, RELIEF_FACILE.haut), creux: entre(r, RELIEF_FACILE.creux), descente: entre(r, RELIEF_FACILE.descente), montee: entre(r, RELIEF_FACILE.montee) };
  const k = Math.min(1, (m - 300) / 3000);       // 0 → 1 entre 300 m et 3 300 m
  const amp = 100 + k * 180 + r() * 70;
  return {
    haut: amp, creux: amp * (0.7 + r() * 0.5),
    descente: lerp(900, 620, k) + r() * 300,
    montee: lerp(480, 420, k) + r() * 220,
    grosse: k > 0.2 && r() < 0.18,
  };
}

/** Relief d'un niveau : des fourchettes fixes, avec parfois une grosse bosse pour s'envoler. */
function reliefNiveau(spec) {
  const R = spec.relief;
  return (m, r) => {
    if (m < 40) return { haut: 70, creux: 60, descente: 1250, montee: 620 }; // départ toujours doux
    return {
      haut: entre(r, R.haut), creux: entre(r, R.creux),
      descente: entre(r, R.descente), montee: entre(r, R.montee),
      grosse: r() < (R.grosses || 0),
    };
  };
}

/* ---------------- Terrain : sommets et creux interpolés en cosinus ---------------- */
function creerTerrain({ relief, rand, finX = null, poissons, fishes }) {
  const pts = [{ x: -1600, y: -40 }, { x: -700, y: 60 }, { x: 0, y: 120 }];
  let cache = 0, fini = false;
  function seg(x) {
    let i = Math.min(cache, pts.length - 2);
    while (i > 0 && pts[i].x > x) i--;
    while (i < pts.length - 2 && pts[i + 1].x <= x) i++;
    cache = i;
    return i;
  }
  function h(x) {
    const i = seg(x), a = pts[i], b = pts[i + 1];
    const t = Math.min(1, Math.max(0, (x - a.x) / (b.x - a.x)));
    return a.y + (b.y - a.y) * (1 - Math.cos(Math.PI * t)) / 2;
  }
  function pente(x) {
    const i = seg(x), a = pts[i], b = pts[i + 1], w = b.x - a.x;
    const t = Math.min(1, Math.max(0, (x - a.x) / w));
    return (b.y - a.y) * Math.PI * Math.sin(Math.PI * t) / (2 * w);
  }
  function courbure(x) {
    const i = seg(x), a = pts[i], b = pts[i + 1], w = b.x - a.x;
    const t = Math.min(1, Math.max(0, (x - a.x) / w));
    return (b.y - a.y) * Math.PI * Math.PI * Math.cos(Math.PI * t) / (2 * w * w);
  }
  // Poissons d'un segment qui vient d'être créé (a → b).
  function semer(a, b) {
    if (!poissons || a.x < 300) return;
    const P = poissons, fin = finX == null ? Infinity : finX - 250;
    const ajoute = (x, y, type) => { if (x < fin) fishes.push({ x, y, type, got: false, wob: rand() * 6 }); };
    const ySol = (x) => {   // hauteur du sol, calculée sur ce segment
      const t = Math.min(1, Math.max(0, (x - a.x) / (b.x - a.x)));
      return a.y + (b.y - a.y) * (1 - Math.cos(Math.PI * t)) / 2;
    };
    const w = b.x - a.x;
    if (b.y < a.y) {
      // Descente : rangée de poissons au sol dans la seconde moitié (là où l'on a retouché la neige).
      if (rand() < P.sol) {
        const n = 4 + Math.floor(rand() * 3), x0 = a.x + w * (0.5 + rand() * 0.1);
        for (let k = 0; k < n; k++) { const x = x0 + k * 62; if (x < b.x - 30) ajoute(x, ySol(x) + 22, "normal"); }
      }
      // Petit arc en l'air juste après le sommet.
      if (rand() < P.air) {
        const x0 = a.x + 120 + rand() * 120, lift = 90 + rand() * 70;
        for (let k = 0; k < 3; k++) ajoute(x0 + k * 70, a.y + lift + (k === 1 ? 18 : 0), "normal");
      }
      // Gros poissons en hauteur : il faut arriver vite au sommet pour s'envoler jusqu'à eux.
      if (a.grosse ? rand() < 0.9 : rand() < P.bleu) ajoute(a.x + 180 + rand() * 160, a.y + 210 + rand() * 90, "bleu");
      if (rand() < (a.grosse ? P.or * 3 : P.or)) ajoute(a.x + 300 + rand() * 160, a.y + 400 + rand() * 120, "or");
    } else if (rand() < P.sol * 0.7) {
      // Montée : quelques poissons au sol au début, avant de décoller.
      const n = 3 + Math.floor(rand() * 2), x0 = a.x + w * 0.08;
      for (let k = 0; k < n; k++) { const x = x0 + k * 62; ajoute(x, ySol(x) + 22, "normal"); }
    }
  }
  function etendre(toX) {
    while (pts[pts.length - 1].x < toX) {
      const last = pts[pts.length - 1];
      if (finX != null && last.x >= finX - 1800) {
        if (fini) break;
        // Arrivée : une dernière glissade presque plate jusqu'à l'igloo, puis du plat.
        const p1 = { x: Math.max(last.x + 500, finX - 300), y: -40 };
        pts.push(p1, { x: finX + 8000, y: -110 });
        semer(last, p1);
        fini = true;
        continue;
      }
      const m = Math.max(0, last.x / PX_PER_M);
      const r = relief(m, rand);
      const sommet = pts.length % 2 === 0;   // les sommets et les creux alternent
      const k = r.grosse ? 1.7 : 1;
      const p = sommet
        ? { x: last.x + r.montee * (r.grosse ? 1.25 : 1), y: r.haut * k, grosse: !!r.grosse }
        : { x: last.x + r.descente * (last.grosse ? 1.35 : 1), y: -r.creux };
      pts.push(p);
      semer(last, p);
    }
    if (pts.length > 600) { pts.splice(0, 200); cache = 0; }
  }
  return { pts, h, pente, courbure, etendre, get fini() { return fini; } };
}

/* ---------------- Une partie ----------------
   creerPartie({ mode: "sansfin" | "niveau", niveau, graine, fonte: false (démonstration), on(type, données) })
   Événements : poisson, turbo, decollage, salto, atterrissage, hautVol, plouf, gagne. */
function creerPartie(opts = {}) {
  const niveau = opts.niveau || null;
  const graine = opts.graine != null ? opts.graine : (niveau ? niveau.graine : Math.floor(Math.random() * 1e9));
  const rand = aleatoire(graine);
  const on = opts.on || (() => {});
  const fishes = [];
  const finX = niveau ? niveau.long * PX_PER_M : null;
  const terrain = creerTerrain({
    relief: niveau ? reliefNiveau(niveau) : reliefSansFin, rand, finX, fishes,
    poissons: niveau ? niveau.poissons : { sol: 0.75, air: 0.45, bleu: 0.3, or: 0.08 },
  });
  const F = Object.assign({ v0: 400, acc: 10, max: 1500, ecart: 2500, debut: -1100 }, niveau && niveau.fonte);
  // Vitesse maximale : basse dans les premiers niveaux pour retomber dans la pente suivante.
  // Sans fin : 1 050 au départ, puis le maximum vers 1 550 m.
  const vmaxAt = niveau ? () => niveau.vmax || MAX_SPEED : (m) => (m < 300 ? 1050 : Math.min(MAX_SPEED, 1050 + (m - 300)));
  let VMAX = vmaxAt(0);
  terrain.etendre(finX != null ? finX + 2000 : 5000);
  const total = fishes.reduce((s, f) => s + POISSONS[f.type].valeur, 0);

  const p = { x: 0, y: terrain.h(0), vx: 380, vy: 0, ground: true, rot: 0, flip: 0, flipping: false, flipsAir: 0, air: 0, maxH: 0 };
  const g = {
    mode: niveau ? "niveau" : "sansfin", niveau, graine, terrain, fishes, p, finX, total,
    etat: "jeu",              // jeu → plouf (rattrapé) ou gagne (arrivé à l'igloo)
    fonte: opts.fonte !== false,
    meltX: F.debut, meltV: F.v0, time: 0,
    hold: false,
    fishCount: 0, score: 0, flips: 0, turbo: 0, turboT: 0, turbos: 0, boums: 0, parfaits: 0, hautsVols: 0,
    get m() { return Math.floor(Math.max(0, p.x) / PX_PER_M); },
    salto,
    step,
  };

  function salto() {
    if (g.etat !== "jeu" || p.ground || p.flipping || p.y - terrain.h(p.x) <= 45) return false;
    p.flipping = true; p.flip = 0;
    on("salto", {});
    return true;
  }

  function land() {
    const d = terrain.pente(p.x), len = Math.hypot(1, d), tx = 1 / len, ty = d / len;
    const v = Math.hypot(p.vx, p.vy) || 1;
    let s = p.vx * tx + p.vy * ty;
    const align = s / v;
    const haut = p.maxH;
    p.y = terrain.h(p.x); p.ground = true;
    let type;
    if (p.flipping) {                                    // retombé au milieu d'un salto
      s = Math.max(MIN_SPEED, s * 0.35);
      p.flipping = false; p.flip = 0;
      type = "tete"; g.boums++;
    } else if (align > 0.94 && ty < -0.05) {             // pile dans le sens de la descente
      s = s * 1.08 + 60;
      type = "parfait"; g.parfaits++;
    } else {
      s *= 0.55 + 0.45 * Math.max(0, align);            // atterrissage brutal : on perd de la vitesse
      type = align < 0.75 ? "boum" : "dur";
      if (type === "boum") g.boums++;
    }
    const saltos = p.flipsAir;
    if (saltos > 0) s += 160 * saltos;
    s = Math.min(VMAX, Math.max(MIN_SPEED, s));
    p.vx = s * tx; p.vy = s * ty; p.flipsAir = 0;
    on("atterrissage", { type, saltos, haut, x: p.x, y: p.y });
    if (type !== "tete" && haut > 420 && g.etat === "jeu") {   // grand saut réussi : bonus de turbo
      g.hautsVols++;
      on("hautVol", { haut });
      ajouterTurbo(2);
    }
  }

  function ajouterTurbo(n) {
    g.turbo += n;
    if (g.turbo >= FISH_FOR_TURBO) {
      g.turbos++; g.turbo = 0; g.turboT = 2.6; g.meltX -= 450;
      on("turbo", {});
    }
  }

  function step(dt) {
    g.time += dt;
    terrain.etendre(p.x + 5000);
    VMAX = vmaxAt(p.x / PX_PER_M);
    const enJeu = g.etat === "jeu";
    const hold = enJeu && g.hold;
    const gr = G + (hold && !p.flipping ? DIVE : 0);
    if (g.turboT > 0) g.turboT -= dt;

    if (p.ground) {
      const d = terrain.pente(p.x), len = Math.hypot(1, d), tx = 1 / len, ty = d / len;
      let s = p.vx * tx + p.vy * ty;
      s += -gr * ty * dt;                       // la pente accélère ou freine
      if (g.turboT > 0) s += 1500 * dt;
      // Frottement : à plat ventre (on appuie) on glisse mieux ; une fois arrivé, on freine fort.
      s *= 1 - (!enJeu ? 0.9 : hold ? FROTTE_VENTRE : FROTTE) * dt;
      s = Math.min(VMAX + (g.turboT > 0 ? 400 : 0), Math.max(enJeu ? MIN_SPEED : 0, s));
      p.vx = s * tx; p.vy = s * ty;
      // Décollage : au sommet d'une bosse, si la vitesse est trop forte pour suivre la courbe.
      const k = terrain.courbure(p.x) / Math.pow(1 + d * d, 1.5);
      const nx = p.x + p.vx * dt;
      if (k < 0 && s * s * -k > gr * tx && !hold) {
        p.ground = false; p.x = nx; p.y += p.vy * dt; p.flipsAir = 0; p.air = 0; p.maxH = 0;
        on("decollage", { vitesse: s });
      } else {
        p.x = nx; p.y = terrain.h(p.x);
      }
      p.rot = Math.atan(d);
    } else {
      p.vy -= gr * dt;
      if (g.turboT > 0) p.vx += 500 * dt;
      p.vx = Math.min(VMAX + (g.turboT > 0 ? 400 : 0), p.vx * (1 - 0.01 * dt));
      p.x += p.vx * dt; p.y += p.vy * dt; p.air += dt;
      p.maxH = Math.max(p.maxH, p.y - terrain.h(p.x));
      const target = Math.atan2(p.vy, p.vx) * 0.6;
      p.rot += (target - p.rot) * Math.min(1, dt * 5);
      if (p.flipping) {
        p.flip += dt * Math.PI * 2 / 0.55;
        if (p.flip >= Math.PI * 2) { p.flip = 0; p.flipping = false; p.flipsAir++; g.flips++; on("saltoReussi", { n: p.flipsAir }); }
      }
      if (p.y <= terrain.h(p.x)) land();
    }
    if (!enJeu) return;

    // La fonte avance de plus en plus vite, mais ne reste jamais trop loin.
    if (g.fonte) {
      g.meltV = Math.min(F.max, F.v0 + g.time * F.acc);
      g.meltX = Math.max(g.meltX + g.meltV * dt, p.x - F.ecart);
      if (g.meltX >= p.x - 12) { g.etat = "plouf"; on("plouf", {}); return; }
    } else if (p.x - g.meltX < 300) g.meltX = p.x - 1600;

    // Poissons
    for (const f of fishes) {
      if (f.got || Math.abs(f.x - p.x) > 80) continue;
      const P = POISSONS[f.type];
      if (Math.hypot(f.x - p.x, f.y - (p.y + 18)) < P.rayon) {
        f.got = true; g.fishCount++; g.score += P.valeur; g.meltX -= P.recul;
        on("poisson", { f, valeur: P.valeur });
        ajouterTurbo(P.valeur);
      }
    }
    if (!niveau && fishes.length > 300) {
      const garde = fishes.filter((f) => f.x > p.x - 1500);
      fishes.length = 0; fishes.push(...garde);
    }

    if (finX != null && p.x >= finX) { g.etat = "gagne"; on("gagne", {}); }
  }

  return g;
}

/* ---------------- Mondes et niveaux ----------------
   Chaque monde va du plus facile au plus difficile ; les valeurs sont interpolées entre le premier et
   le dernier niveau, sauf les premiers niveaux du premier monde, réglés à la main pour apprendre.
   Vitesse de la fonte : calibrée par outils/calibrer-niveaux.mjs (table CALIBRAGE plus bas). Pour chaque
   niveau, l'outil cherche la fourchette où un pingouin qui ne fait rien se fait rattraper mais où un
   débutant arrive au bout ; « difficulte » place le niveau dans cette fourchette (0 : bas, 1 : haut). */
const FONTE_NIVEAU = { v0: 300, acc: 150, debut: -1500, ecart: 3000 };
const MONDES = [
  {
    id: 1, nom: "La Banquise", ciel: 0,
    texte: "Prends le rythme : appuie dans les descentes, lâche avant les bosses.",
    de: { long: 1200, vmax: 1300, relief: { haut: [80, 115], creux: [70, 100], descente: [1100, 1300], montee: [550, 650], grosses: 0.05 },
      difficulte: 0.25, poissons: { sol: 0.9, air: 0.45, bleu: 0.3, or: 0.1 } },
    a: { long: 1800, vmax: 1600, relief: { haut: [100, 150], creux: [85, 130], descente: [1100, 1350], montee: [500, 650], grosses: 0.12 },
      difficulte: 0.5, poissons: { sol: 0.85, air: 0.5, bleu: 0.4, or: 0.12 } },
  },
  {
    id: 2, nom: "Le Fjord du Couchant", ciel: 1,
    texte: "Des bosses plus hautes : envole-toi vers les poissons bleus et dorés.",
    de: { long: 1500, vmax: 1600, relief: { haut: [110, 160], creux: [90, 140], descente: [1150, 1400], montee: [500, 650], grosses: 0.12 },
      difficulte: 0.4, poissons: { sol: 0.85, air: 0.5, bleu: 0.4, or: 0.12 } },
    a: { long: 2400, vmax: 2000, relief: { haut: [150, 230], creux: [120, 200], descente: [1000, 1300], montee: [450, 650], grosses: 0.2 },
      difficulte: 0.65, poissons: { sol: 0.8, air: 0.55, bleu: 0.45, or: 0.15 } },
  },
  {
    id: 3, nom: "La Nuit Polaire", ciel: 2,
    texte: "Sous l'aurore, la banquise fond vite : enchaîne les glisses parfaites.",
    de: { long: 2000, vmax: 1900, relief: { haut: [150, 220], creux: [120, 190], descente: [1100, 1400], montee: [450, 650], grosses: 0.18 },
      difficulte: 0.55, poissons: { sol: 0.8, air: 0.55, bleu: 0.45, or: 0.15 } },
    a: { long: 3000, vmax: 2300, relief: { haut: [190, 280], creux: [150, 250], descente: [950, 1250], montee: [420, 660], grosses: 0.25 },
      difficulte: 0.8, poissons: { sol: 0.75, air: 0.6, bleu: 0.5, or: 0.2 } },
  },
];
const NIVEAUX_PAR_MONDE = 10;

/** Niveaux réglés à la main au début du premier monde (vérifiés avec les robots d'outils/). */
const PREMIERS = [
  { long: 800, vmax: 1000, relief: { haut: [60, 80], creux: [50, 70], descente: [1200, 1350], montee: [600, 700] },
    fonte: { v0: 200, acc: 40, max: 850, ecart: 2500 }, poissons: { sol: 1, air: 0.3, bleu: 0, or: 0 }, aide: "rythme" },
  { long: 1000, vmax: 1100, relief: { haut: [65, 90], creux: [55, 80], descente: [1150, 1300], montee: [550, 680] },
    fonte: { v0: 250, acc: 60, max: 900, ecart: 2800 }, poissons: { sol: 0.95, air: 0.4, bleu: 0, or: 0 }, aide: "rythme" },
  { long: 1100, vmax: 1200, relief: { haut: [75, 105], creux: [65, 90], descente: [1100, 1300], montee: [500, 650], grosses: 0.1 },
    difficulte: 0.15, poissons: { sol: 0.9, air: 0.45, bleu: 0.5, or: 0 }, aide: "salto", nouveau: "bleu" },
];

function niveau(monde, i) {
  const M = MONDES[monde - 1];
  if (!M || i < 1 || i > NIVEAUX_PAR_MONDE) return null;
  let spec;
  if (monde === 1 && i <= PREMIERS.length) spec = JSON.parse(JSON.stringify(PREMIERS[i - 1]));
  else {
    const debut = monde === 1 ? PREMIERS.length + 1 : 1;
    const t = (i - debut) / (NIVEAUX_PAR_MONDE - debut);
    const A = M.de, B = M.a, R = {}, Po = {};
    for (const k of ["haut", "creux", "descente", "montee"]) R[k] = lerp2(A.relief[k], B.relief[k], t);
    R.grosses = lerp(A.relief.grosses, B.relief.grosses, t);
    for (const k of Object.keys(A.poissons)) Po[k] = lerp(A.poissons[k], B.poissons[k], t);
    spec = { long: Math.round(lerp(A.long, B.long, t) / 50) * 50, vmax: Math.round(lerp(A.vmax, B.vmax, t)), relief: R, poissons: Po,
      difficulte: Math.round(lerp(A.difficulte, B.difficulte, t) * 100) / 100 };
    if (monde === 1 && i === 4) spec.nouveau = "or";
  }
  spec.id = `${monde}-${i}`;
  spec.monde = monde; spec.numero = i;
  spec.graine = monde * 1000 + i * 37 + 11;
  spec.ciel = M.ciel;
  if (!spec.fonte) spec.fonte = { ...FONTE_NIVEAU, max: CALIBRAGE[spec.id] || 1000 };
  return spec;
}

// CALIBRAGE : début (table écrite par outils/calibrer-niveaux.mjs, ne pas modifier à la main)
const CALIBRAGE = {
  "1-3": 680, "1-4": 960, "1-5": 1050, "1-6": 960, "1-7": 860, "1-8": 1000, "1-9": 1170, "1-10": 1140,
  "2-1": 1050, "2-2": 1080, "2-3": 680, "2-4": 720, "2-5": 950, "2-6": 910, "2-7": 870, "2-8": 860,
  "2-9": 810, "2-10": 1040, "3-1": 860, "3-2": 940, "3-3": 900, "3-4": 910, "3-5": 990, "3-6": 790,
  "3-7": 990, "3-8": 1090, "3-9": 940, "3-10": 970,
};
// CALIBRAGE : fin

/** Étoiles d'un niveau terminé : 1 à l'arrivée, 2 avec 30 % des poissons (en valeur), 3 avec 60 %. */
const SEUILS = [0.3, 0.6];
function etoiles(score, total) {
  if (!total) return 3;
  return 1 + SEUILS.filter((s) => score >= Math.ceil(total * s)).length;
}

const Pingo = {
  PX_PER_M, G, DIVE, MIN_SPEED, MAX_SPEED, FISH_FOR_TURBO, POISSONS, MONDES, NIVEAUX_PAR_MONDE, SEUILS, FONTE_NIVEAU, CALIBRAGE,
  aleatoire, creerPartie, niveau, etoiles,
};
if (typeof module !== "undefined" && module.exports) module.exports = Pingo;
else racine.Pingo = Pingo;
})(typeof window !== "undefined" ? window : globalThis);
