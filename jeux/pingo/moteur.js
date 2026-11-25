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
const BONUS_TURBO = 300;   // vitesse maximale en plus pendant le turbo
const SURVITESSE = 700;    // les bonus peuvent dépasser la vitesse maximale de 700 au plus…
const ESTOMPE = 0.6;       // … et cet excès s'estompe de 60 % par seconde au sol
const FROTTE = 0.25, FROTTE_VENTRE = 0.06;
const PAS_ENTREE = 0.05;    // le pingouin parfait décide d'appuyer ou non toutes les 0,05 s
const PAS_TRACE = 0.25;     // position du pingouin parfait gardée toutes les 0,25 s
const RETARD_FONTE = 300;   // la banquise est 300 px derrière la position (retardée) du pingouin parfait
const ETAT = ["time", "etat", "fishCount", "score", "flips", "turbo", "turboT", "turbos", "boums", "parfaits", "hautsVols"];
const SOUS_PAS = 1 / 240;   // pas de calcul des robots et du rejeu (comme le jeu : 4 sous-pas à 60 images/s)   // frottement de la neige par seconde, sans appuyer / en plongeant

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
   Le terrain est une suite de « motifs » qui partent d'un creux et finissent dans un creux :
   - bosse : une montée jusqu'à un sommet, puis une longue descente ;
   - tremplin : un grand sommet, puis 1 ou 2 petites bosses plus bas, puis une longue descente. Bien
     lancé, le pingouin survole les petites bosses et retombe dans la descente ; sinon, il les cogne.
   Un relief donne, pour une distance m (en mètres), le prochain motif : type, haut (hauteur du sommet),
   creux (profondeur du creux suivant), montee et descente (largeurs), bosses (nombre de petites bosses). */
const RELIEF_FACILE = { haut: [130, 165], creux: [110, 140], descente: [1650, 1850], montee: [900, 1050] };

/** Mode sans fin : facile au début (prendre le rythme), puis de plus en plus grand, avec des tremplins. */
function reliefSansFin(m, r) {
  if (m < 300) return { type: "bosse", haut: entre(r, RELIEF_FACILE.haut), creux: entre(r, RELIEF_FACILE.creux), descente: entre(r, RELIEF_FACILE.descente), montee: entre(r, RELIEF_FACILE.montee) };
  const k = Math.min(1, (m - 300) / 3000);       // 0 → 1 entre 300 m et 3 300 m
  const amp = 150 + k * 170 + r() * 70;
  return {
    type: r() < 0.15 + 0.25 * k ? "tremplin" : "bosse", bosses: r() < 0.3 + 0.5 * k ? 2 : 1,
    haut: amp, creux: amp * (0.7 + r() * 0.4),
    descente: lerp(1800, 1500, k) + r() * 300,
    montee: lerp(1000, 880, k) + r() * 150,
  };
}

/** Relief d'un niveau : des fourchettes fixes, et des tremplins selon la probabilité « tremplins ». */
function reliefNiveau(spec) {
  const R = spec.relief;
  return (m, r) => {
    if (m < 40 && !spec.essai) return { type: "bosse", haut: 140, creux: 120, descente: 1750, montee: 950 }; // départ toujours doux
    const t = r() < (R.tremplins || 0);
    return {
      type: t ? "tremplin" : "bosse", bosses: r() < (R.double || 0) ? 2 : 1,
      haut: entre(r, R.haut), creux: entre(r, R.creux),
      descente: entre(r, R.descente), montee: entre(r, R.montee),
    };
  };
}

/* ---------------- Terrain : points interpolés en cosinus ---------------- */
function creerTerrain({ relief, rand, finX = null, poissons, fishes, vmax }) {
  const pts = [{ x: -1800, y: -60 }, { x: -900, y: 80 }, { x: 0, y: 150 }, { x: 1500, y: -110 }];
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
  // Hauteur du sol entre deux points (avant que le point suivant n'existe).
  const ySeg = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a.x) / (b.x - a.x))); return a.y + (b.y - a.y) * (1 - Math.cos(Math.PI * t)) / 2; };
  const P = poissons, fin = finX == null ? Infinity : finX - 250;
  const ajoute = (x, y, type) => { if (P && x > 400 && x < fin) fishes.push({ x, y, type, got: false, wob: rand() * 6 }); };
  const rangee = (a, b, x0, n) => { for (let k = 0; k < n; k++) { const x = x0 + k * 62; if (x < b.x - 30) ajoute(x, ySeg(a, b, x) + 22, "normal"); } };
  // Poissons d'une bosse : rangée au sol au début de la montée et dans la seconde moitié de la descente,
  // petit arc après le sommet, gros poissons tout là-haut.
  function semerBosse(T0, C, T1) {
    if (!P) return;
    if (rand() < P.sol * 0.7) rangee(T0, C, T0.x + (C.x - T0.x) * 0.08, 3 + Math.floor(rand() * 2));
    if (rand() < P.sol) rangee(C, T1, C.x + (T1.x - C.x) * (0.5 + rand() * 0.1), 4 + Math.floor(rand() * 3));
    if (rand() < P.air) { const x0 = C.x + 120 + rand() * 120, lift = 90 + rand() * 70; for (let k = 0; k < 3; k++) ajoute(x0 + k * 70, C.y + lift + (k === 1 ? 18 : 0), "normal"); }
    if (rand() < P.bleu) ajoute(C.x + 180 + rand() * 160, C.y + 210 + rand() * 90, "bleu");
    if (rand() < P.or) ajoute(C.x + 300 + rand() * 160, C.y + 400 + rand() * 120, "or");
  }
  // Poissons d'un tremplin : un arc le long du vol idéal au-dessus des petites bosses, un gros poisson au bout.
  function semerTremplin(T0, C, fin1, T1) {
    if (!P) return;
    if (rand() < P.sol * 0.7) rangee(T0, C, T0.x + (C.x - T0.x) * 0.08, 3 + Math.floor(rand() * 2));
    const vx = 0.85 * vmax, y0 = C.y + 70;
    let x = C.x + 140;
    for (let k = 0; x < fin1.x; k++, x += 120) {
      const t = (x - C.x) / vx, y = y0 - 0.5 * G * t * t;
      ajoute(x, y, k % 4 === 3 && rand() < P.bleu * 1.5 ? "bleu" : "normal");
    }
    if (rand() < P.or * 2) ajoute(C.x + (fin1.x - C.x) * 0.45, y0 + 260 + rand() * 120, "or");
    if (rand() < P.sol) rangee(fin1, T1, fin1.x + (T1.x - fin1.x) * 0.45, 4 + Math.floor(rand() * 2));
  }
  function etendre(toX) {
    while (pts[pts.length - 1].x < toX) {
      const T0 = pts[pts.length - 1];
      if (finX != null && T0.x >= finX - 2200) {
        if (fini) break;
        // Arrivée : une dernière glissade presque plate jusqu'à l'igloo, puis du plat.
        const p1 = { x: Math.max(T0.x + 600, finX - 300), y: -40 };
        pts.push(p1, { x: finX + 8000, y: -110 });
        fini = true;
        continue;
      }
      const m = Math.max(0, T0.x / PX_PER_M);
      const r = relief(m, rand);
      if (r.type === "tremplin") {
        // grand sommet, petites bosses plus bas, longue descente
        const C = { x: T0.x + r.montee * 1.25, y: r.haut * 1.5, sommet: true };
        pts.push(C);
        let y = C.y * 0.25 - 30, last = C;
        for (let k = 0; k < (r.bosses || 1); k++) {
          const creux = { x: last.x + (k ? 320 : 420), y: y };
          const bosse = { x: creux.x + 300, y: y + 85 };
          pts.push(creux, bosse);
          last = bosse; y -= 70;
        }
        const T1 = { x: last.x + r.descente * 1.1, y: -r.creux };
        pts.push(T1);
        semerTremplin(T0, C, last, T1);
      } else {
        const C = { x: T0.x + r.montee, y: r.haut, sommet: true };
        const T1 = { x: C.x + r.descente, y: -r.creux };
        pts.push(C, T1);
        semerBosse(T0, C, T1);
      }
    }
    if (pts.length > 600) { pts.splice(0, 200); cache = 0; }
  }
  return { pts, h, pente, courbure, etendre, get fini() { return fini; } };
}

/* ---------------- Une partie ----------------
   creerPartie({ niveau, graine, fonte: false (démonstration), fantome, rejeu, on(type, données) })
   - fantome : partie de calcul (robots) : ni poissons, ni banquise, ni événements ;
   - rejeu : partie qui rejoue un parcours enregistré (pas de banquise, pas de calcul du fantôme).
   Événements : poisson, turbo, decollage, salto, saltoReussi, atterrissage, hautVol, plouf, gagne.

   Banquise d'un niveau : elle suit le parcours du pingouin parfait (niveau.entrees, rejoué au départ)
   avec niveau.marge secondes de retard. Pour arriver au bout, il faut donc rester à moins de « marge »
   secondes du parcours parfait. Les poissons et le turbo la font reculer.
   Sans fin (ou niveau sans parcours) : elle accélère avec le temps. */
function creerPartie(opts = {}) {
  const niveau = opts.niveau || null;
  const graine = opts.graine != null ? opts.graine : (niveau ? niveau.graine : Math.floor(Math.random() * 1e9));
  const rand = aleatoire(graine);
  const fantome = !!opts.fantome;
  const on = fantome ? () => {} : (opts.on || (() => {}));
  const fishes = [];
  const finX = niveau ? niveau.long * PX_PER_M : null;
  // Vitesse maximale : basse dans les premiers niveaux pour retomber dans la pente suivante.
  // Sans fin : 1 100 au départ, puis le maximum vers 1 500 m.
  // Terrain d'essai (opts.essai : relief et vmax choisis à la main, sans fin, sans banquise).
  const essai = opts.essai || null;
  const vmaxAt = essai ? () => essai.vmax : niveau ? () => niveau.vmax || MAX_SPEED : (m) => (m < 300 ? 1100 : Math.min(MAX_SPEED, 1100 + (m - 300)));
  let VMAX = vmaxAt(0);
  const terrain = creerTerrain({
    relief: essai ? reliefNiveau(essai) : niveau ? reliefNiveau(niveau) : reliefSansFin, rand, finX, fishes, vmax: niveau || essai ? VMAX : 1300,
    poissons: fantome ? null : niveau ? niveau.poissons : { sol: 0.75, air: 0.45, bleu: 0.3, or: 0.08 },
  });
  terrain.etendre(finX != null ? finX + 2000 : 5000);
  const total = fishes.reduce((s, f) => s + POISSONS[f.type].valeur, 0);
  // Parcours du pingouin parfait, rejoué une fois : position toutes les PAS_TRACE secondes.
  const parfait = niveau && niveau.entrees && !fantome && !opts.rejeu && opts.fonte !== false ? rejouer(niveau) : null;
  const trace = parfait && parfait.trace;
  const F = Object.assign({ v0: 400, acc: 10, max: 1500, ecart: 2500, debut: -1100 }, !trace && niveau ? { v0: 300, acc: 150, max: 1000, ecart: 3000, debut: -1500 } : null);

  const p = { x: 0, y: terrain.h(0), vx: 380, vy: 0, ground: true, rot: 0, flip: 0, flipping: false, flipsAir: 0, air: 0, maxH: 0 };
  const g = {
    mode: niveau ? "niveau" : essai ? "essai" : "sansfin", niveau, graine, terrain, fishes, p, finX, total, trace,
    tempsParfait: parfait ? parfait.temps : null,
    etat: "jeu",              // jeu → plouf (rattrapé) ou gagne (arrivé à l'igloo)
    fonte: opts.fonte !== false && !fantome && !opts.rejeu && !essai,
    meltX: trace ? -RETARD_FONTE : F.debut, meltV: F.v0, recul: 0, time: 0,
    hold: false,
    fishCount: 0, score: 0, flips: 0, turbo: 0, turboT: 0, turbos: 0, boums: 0, parfaits: 0, hautsVols: 0,
    get m() { return Math.floor(Math.max(0, p.x) / PX_PER_M); },
    /** Position du pingouin parfait au temps t (secondes). */
    fantomeX(t) {
      const T = trace, k = t / PAS_TRACE;
      if (!T || k <= 0) return 0;
      const i = Math.floor(k);
      if (i >= T.length - 1) { const n = T.length; return T[n - 1] + (T[n - 1] - T[n - 2]) / PAS_TRACE * (t - (n - 1) * PAS_TRACE); }
      return T[i] + (T[i + 1] - T[i]) * (k - i);
    },
    /** Avance (+) ou retard (−) sur le pingouin parfait, en secondes (niveaux seulement). */
    get avance() {
      if (!trace) return 0;
      let a = 0, b = g.time + 30;               // temps où le parfait était à la position du joueur
      for (let k = 0; k < 30; k++) { const m = (a + b) / 2; if (g.fantomeX(m) < p.x) a = m; else b = m; }
      return a - g.time;
    },
    /** État complet de la partie (sans la banquise), pour les robots qui essaient plusieurs suites. */
    sauver() {
      const e = { p: { ...p }, got: fishes.map((f) => f.got) };
      for (const k of ETAT) e[k] = g[k];
      return e;
    },
    restaurer(e) {
      Object.assign(p, e.p);
      for (let i = 0; i < fishes.length; i++) fishes[i].got = e.got[i];
      for (const k of ETAT) g[k] = e[k];
    },
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
      s = s * 1.12 + 100;
      type = "parfait"; g.parfaits++;
    } else {
      s *= 0.55 + 0.45 * Math.max(0, align);            // atterrissage brutal : on perd de la vitesse
      type = align < 0.75 ? "boum" : "dur";
      if (type === "boum") g.boums++;
    }
    const saltos = p.flipsAir;
    if (saltos > 0) s += 200 * saltos;
    // au-delà de la vitesse maximale (bonus) : jusqu'à SURVITESSE de plus, qui s'estompe ensuite
    s = Math.min(VMAX + (g.turboT > 0 ? BONUS_TURBO : 0) + SURVITESSE, Math.max(MIN_SPEED, s));
    p.vx = s * tx; p.vy = s * ty; p.flipsAir = 0;
    on("atterrissage", { type, saltos, haut, x: p.x, y: p.y });
    if (type !== "tete" && haut > 420 && g.etat === "jeu") {   // grand saut réussi : bonus de turbo
      g.hautsVols++;
      on("hautVol", { haut });
      ajouterTurbo(2);
    }
  }

  function reculer(n) { if (trace) g.recul += n; else g.meltX -= n; }

  function ajouterTurbo(n) {
    g.turbo += n;
    if (g.turbo >= FISH_FOR_TURBO) {
      g.turbos++; g.turbo = 0; g.turboT = 2.6; reculer(450);
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
      const avant = s;
      s += -gr * ty * dt;                       // la pente accélère ou freine
      if (g.turboT > 0) s += 1500 * dt;
      // Frottement : à plat ventre (on appuie) on glisse mieux ; une fois arrivé, on freine fort.
      s *= 1 - (!enJeu ? 0.9 : hold ? FROTTE_VENTRE : FROTTE) * dt;
      // Vitesse maximale souple : les pentes n'accélèrent pas au-delà, mais les bonus (glisse parfaite,
      // salto) la dépassent ; l'excès s'estompe peu à peu. Bien enchaîner fait donc aller plus vite.
      const lim = VMAX + (g.turboT > 0 ? BONUS_TURBO : 0);
      if (s > lim) { const b = Math.min(s, Math.max(avant, lim)); s = Math.max(lim, b - (b - lim) * ESTOMPE * dt); }
      s = Math.max(enJeu ? MIN_SPEED : 0, s);
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
      const lim = VMAX + (g.turboT > 0 ? BONUS_TURBO : 0);
      p.vx *= 1 - 0.01 * dt;
      if (p.vx > lim) p.vx -= (p.vx - lim) * ESTOMPE * 0.5 * dt;
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
    if (fantome) { if (finX != null && p.x >= finX) g.etat = "gagne"; return; }

    if (trace && g.fonte) {
      // Banquise d'un niveau : le pingouin parfait, avec « marge » secondes de retard.
      g.meltX = Math.max(g.fantomeX(g.time - niveau.marge) - RETARD_FONTE - g.recul, p.x - 3000);
      if (g.meltX >= p.x - 12) { g.etat = "plouf"; on("plouf", {}); return; }
    } else if (g.fonte) {
      // Sans fin : elle avance de plus en plus vite, mais ne reste jamais trop loin.
      g.meltV = Math.min(F.max, F.v0 + g.time * F.acc);
      g.meltX = Math.max(g.meltX + g.meltV * dt, p.x - F.ecart);
      if (g.meltX >= p.x - 12) { g.etat = "plouf"; on("plouf", {}); return; }
    } else if (p.x - g.meltX < 300) g.meltX = p.x - 1600;

    // Poissons
    for (const f of fishes) {
      if (f.got || Math.abs(f.x - p.x) > 80) continue;
      const P = POISSONS[f.type];
      if (Math.hypot(f.x - p.x, f.y - (p.y + 18)) < P.rayon) {
        f.got = true; g.fishCount++; g.score += P.valeur; reculer(P.recul);
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

/* ---------------- Parcours parfait ----------------
   niveau.entrees : appuis du pingouin parfait, un bit par tranche de 0,05 s, en hexadécimal (4 tranches
   par caractère). Calculés par outils/parcours-parfaits.mjs (fichier parcours.js) et rejoués ici. */
function decoder(hex) {
  const bits = [];
  for (const c of hex) { const v = parseInt(c, 16); for (let k = 3; k >= 0; k--) bits.push((v >> k) & 1); }
  return bits;
}
function encoder(bits) {
  let hex = "";
  for (let i = 0; i < bits.length; i += 4) { let v = 0; for (let k = 0; k < 4; k++) v = v * 2 + (bits[i + k] ? 1 : 0); hex += v.toString(16); }
  return hex;
}
/** Rejoue les appuis enregistrés : { trace (positions toutes les 0,25 s), temps, etat, boums, parfaits }. */
function rejouer(niveau, entrees = niveau.entrees) {
  const bits = decoder(entrees);
  const g = creerPartie({ niveau, rejeu: true });
  const parTranche = Math.round(PAS_ENTREE / SOUS_PAS), parTrace = Math.round(PAS_TRACE / SOUS_PAS);
  const trace = [0];
  let n = 0;
  for (let i = 0; g.etat === "jeu" && i < bits.length + 1200; i++) {
    g.hold = !!bits[i];                       // après la fin des appuis : on ne touche plus à rien
    for (let k = 0; k < parTranche && g.etat === "jeu"; k++) { g.step(SOUS_PAS); if (++n % parTrace === 0) trace.push(Math.round(g.p.x)); }
  }
  trace.push(Math.round(g.p.x + 300), Math.round(g.p.x + 600));   // un peu au-delà de l'arrivée
  return { trace, temps: g.time, etat: g.etat, boums: g.boums, parfaits: g.parfaits, score: g.score };
}

/* ---------------- Mondes et niveaux ----------------
   Chaque monde va du plus facile au plus difficile : les valeurs sont interpolées entre le premier (de)
   et le dernier niveau (a), sauf les premiers niveaux du premier monde, réglés à la main pour apprendre.
   relief : hauteurs, largeurs, probabilité d'un tremplin (tremplins) et d'un tremplin à 2 petites bosses
   (double). marge : retard de la banquise sur le pingouin parfait, en secondes (plus petit = plus dur). */
const MONDES = [
  {
    id: 1, nom: "La Banquise", ciel: 0,
    texte: "Prends le rythme : appuie dans les descentes, lâche avant les bosses.",
    de: { long: 1300, vmax: 1300, marge: 5, relief: { haut: [150, 200], creux: [120, 170], descente: [1700, 1950], montee: [950, 1100], tremplins: 0.3, double: 0 },
      poissons: { sol: 0.9, air: 0.45, bleu: 0.3, or: 0.1 } },
    a: { long: 1900, vmax: 1550, marge: 4, relief: { haut: [180, 240], creux: [150, 200], descente: [1750, 2000], montee: [1000, 1150], tremplins: 0.4, double: 0.4 },
      poissons: { sol: 0.85, air: 0.5, bleu: 0.4, or: 0.12 } },
  },
  {
    id: 2, nom: "Le Fjord du Couchant", ciel: 1,
    texte: "Des tremplins plus hauts : survole les bosses jusqu'aux poissons bleus et dorés.",
    de: { long: 1800, vmax: 1600, marge: 4, relief: { haut: [190, 250], creux: [150, 200], descente: [1850, 2100], montee: [1050, 1200], tremplins: 0.4, double: 0.4 },
      poissons: { sol: 0.85, air: 0.5, bleu: 0.4, or: 0.12 } },
    a: { long: 2600, vmax: 1900, marge: 3, relief: { haut: [220, 280], creux: [170, 230], descente: [2000, 2300], montee: [1150, 1300], tremplins: 0.5, double: 0.6 },
      poissons: { sol: 0.8, air: 0.55, bleu: 0.45, or: 0.15 } },
  },
  {
    id: 3, nom: "La Nuit Polaire", ciel: 2,
    texte: "Sous l'aurore, la banquise ne pardonne rien : il faut un parcours presque parfait.",
    de: { long: 2200, vmax: 1900, marge: 3, relief: { haut: [220, 280], creux: [170, 230], descente: [2000, 2300], montee: [1150, 1300], tremplins: 0.5, double: 0.6 },
      poissons: { sol: 0.8, air: 0.55, bleu: 0.45, or: 0.15 } },
    a: { long: 3200, vmax: 2200, marge: 2, relief: { haut: [240, 300], creux: [190, 250], descente: [2100, 2400], montee: [1250, 1400], tremplins: 0.6, double: 0.8 },
      poissons: { sol: 0.75, air: 0.6, bleu: 0.5, or: 0.2 } },
  },
];
const NIVEAUX_PAR_MONDE = 10;

/** Niveaux réglés à la main au début du premier monde (vérifiés avec les robots d'outils/). */
const PREMIERS = [
  { long: 900, vmax: 1100, marge: 7, relief: { haut: [130, 165], creux: [110, 140], descente: [1650, 1850], montee: [900, 1050] },
    poissons: { sol: 1, air: 0.3, bleu: 0, or: 0 }, aide: "rythme" },
  { long: 1100, vmax: 1200, marge: 6, relief: { haut: [140, 180], creux: [115, 150], descente: [1650, 1850], montee: [900, 1050] },
    poissons: { sol: 0.95, air: 0.4, bleu: 0, or: 0 }, aide: "rythme" },
  { long: 1200, vmax: 1250, marge: 5.5, relief: { haut: [150, 190], creux: [120, 160], descente: [1650, 1850], montee: [900, 1050], tremplins: 0.3 },
    poissons: { sol: 0.9, air: 0.45, bleu: 0.5, or: 0 }, aide: "salto", nouveau: "bleu" },
];

/** Appuis du pingouin parfait de chaque niveau (parcours.js, écrit par outils/parcours-parfaits.mjs). */
const PARCOURS = (typeof module !== "undefined" && module.exports)
  ? (() => { try { return require("./parcours.js"); } catch (e) { return {}; } })()
  : (racine.PINGO_PARCOURS || {});

/** Le niveau i du monde ; avec { brut: true }, sans le parcours parfait enregistré (outils). */
function niveau(monde, i, { brut = false } = {}) {
  const M = MONDES[monde - 1];
  if (!M || i < 1 || i > NIVEAUX_PAR_MONDE) return null;
  let spec;
  if (monde === 1 && i <= PREMIERS.length) spec = JSON.parse(JSON.stringify(PREMIERS[i - 1]));
  else {
    const debut = monde === 1 ? PREMIERS.length + 1 : 1;
    const t = (i - debut) / (NIVEAUX_PAR_MONDE - debut);
    const A = M.de, B = M.a, R = {}, Po = {};
    for (const k of ["haut", "creux", "descente", "montee"]) R[k] = lerp2(A.relief[k], B.relief[k], t);
    R.tremplins = lerp(A.relief.tremplins, B.relief.tremplins, t);
    R.double = lerp(A.relief.double, B.relief.double, t);
    for (const k of Object.keys(A.poissons)) Po[k] = lerp(A.poissons[k], B.poissons[k], t);
    spec = { long: Math.round(lerp(A.long, B.long, t) / 50) * 50, vmax: Math.round(lerp(A.vmax, B.vmax, t)), relief: R, poissons: Po,
      marge: Math.round(lerp(A.marge, B.marge, t) * 10) / 10 };
    if (monde === 1 && i === 4) spec.nouveau = "or";
  }
  spec.id = `${monde}-${i}`;
  spec.monde = monde; spec.numero = i;
  spec.graine = monde * 1000 + i * 37 + 11;
  spec.ciel = M.ciel;
  const P = !brut && PARCOURS[spec.id];
  if (P && P.e) { spec.entrees = P.e; spec.marge = P.marge; }
  return spec;
}

/* ---------------- Terrain d'essai ----------------
   Pour régler le relief en jouant : hauteur des bosses, longueur des montées et des descentes, vitesse
   maximale, part de tremplins. Chaque valeur varie de ± 10 % d'une bosse à l'autre. */
const ESSAIS = {
  actuel: { hauteur: 175, montee: 1000, descente: 1800, vmax: 1400, tremplins: 30 },
  rapproche: { hauteur: 200, montee: 550, descente: 700, vmax: 1500, tremplins: 0 },
  russes: { hauteur: 300, montee: 600, descente: 750, vmax: 1900, tremplins: 20 },
};
function creerEssai(r) {
  const f = (v) => [v * 0.9, v * 1.1];
  return {
    essai: true, vmax: r.vmax,
    relief: { haut: f(r.hauteur), creux: f(r.hauteur * 0.85), montee: f(r.montee), descente: f(r.descente), tremplins: r.tremplins / 100, double: 0.5 },
  };
}

/** Étoiles d'un niveau terminé : 1 à l'arrivée, 2 avec 30 % des poissons (en valeur), 3 avec 60 %. */
const SEUILS = [0.3, 0.6];
function etoiles(score, total) {
  if (!total) return 3;
  return 1 + SEUILS.filter((s) => score >= Math.ceil(total * s)).length;
}

const Pingo = {
  PX_PER_M, G, DIVE, MIN_SPEED, MAX_SPEED, FISH_FOR_TURBO, POISSONS, MONDES, NIVEAUX_PAR_MONDE, SEUILS,
  PAS_ENTREE, PAS_TRACE, SOUS_PAS,
  aleatoire, creerPartie, niveau, etoiles, rejouer, encoder, decoder, essai: creerEssai, ESSAIS,
};
if (typeof module !== "undefined" && module.exports) module.exports = Pingo;
else racine.Pingo = Pingo;
})(typeof window !== "undefined" ? window : globalThis);
