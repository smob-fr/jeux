#!/usr/bin/env node
// Construit des niveaux « calculés » : le relief est posé au fur et à mesure en faisant jouer le pingouin
// parfait (recherche en faisceau, outils/robots.cjs). Suite de motifs :
//   - élan : petites bosses rapprochées pour prendre le rythme ;
//   - glisse : bosses normales pour enchaîner les glisses parfaites et prendre de la vitesse ;
//   - saut : une bosse de décollage ; on simule le vol du pingouin parfait, et on pose la bosse cible
//     exactement là où il retombe, sa descente inclinée comme la trajectoire (glisse parfaite). Entre les
//     deux, une vallée (et parfois une petite bosse) bien sous la trajectoire. Sans assez d'élan, on retombe
//     trop court, dans la vallée ou contre la montée de la bosse cible : on casse sa vitesse.
// Puis les poissons (arcs le long des vols, rangées au sol), le parcours parfait final et la marge.
// Écrit niveaux-construits.js. Usage : node outils/construire-niveaux.mjs [--verifier]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const R = require("./robots.cjs");
const { Pingo } = R;
const { SOUS_PAS, PAS_ENTREE, PX_PER_M } = Pingo;
const PAR_TRANCHE = Math.round(PAS_ENTREE / SOUS_PAS);
const FICHIER = fileURLToPath(new URL("../niveaux-construits.js", import.meta.url));

/** Plans des niveaux construits. Relief : [hauteur, montée, descente] ; saut : distance visée du vol. */
const PLANS = {
  test: {
    nom: "Niveau test : bosses calculées", long: 2600, vmax: 2100, marge: 4, graine: 7, ciel: 0,
    elan: { bosses: 4, relief: [200, 550, 700] },
    glisse: { relief: [170, 850, 1050] },
    // après l'élan : [glisses, saut], répété ; distance du vol de plus en plus grande
    // saut dès que le pingouin parfait va à plus de « vitesse » × vmax au creux ; sinon bosse de glisse
    rythme: { vitesse: 0.8, vol: [1600, 2600], decollage: 1.3, tolerance: 0.93 },
  },
};

const hSeg = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a.x) / (b.x - a.x))); return a.y + (b.y - a.y) * (1 - Math.cos(Math.PI * t)) / 2; };
function hPts(pts, x) {
  for (let i = 0; i < pts.length - 1; i++) if (pts[i + 1].x > x) return hSeg(pts[i], pts[i + 1], x);
  return pts[pts.length - 1].y;
}

function construire(id, plan) {
  const rand = Pingo.aleatoire(plan.graine);
  const varie = (v) => v * (0.9 + 0.2 * rand());
  const finX = plan.long * PX_PER_M;
  // Partie de calcul (sans poissons, sans banquise) dont on fait grandir le terrain.
  const spec = { id, long: plan.long, vmax: plan.vmax, points: [[-1800, -60], [-900, 80], [0, 150], [1500, -110]], poissonsFixes: [], eaux: [], graine: plan.graine };
  const g = Pingo.creerPartie({ niveau: spec, rejeu: true });
  const pts = g.terrain.pts;
  // points arrondis dès la construction : le terrain enregistré (entiers) est exactement celui joué ici
  const rond = (q) => ({ ...q, x: Math.round(q.x), y: Math.round(q.y) });
  const pousser = (...l) => pts.push(...l.map(rond));
  const poissons = [], vols = [];
  const eaux = spec.eaux;   // même tableau que la partie de calcul : elle voit les crevasses au fur et à mesure
  const bosse = ([haut, montee, descente], { k = 1 } = {}) => {
    const T0 = pts[pts.length - 1];
    const C = { x: T0.x + varie(montee), y: varie(haut) * k }, T1 = { x: C.x + varie(descente), y: -varie(haut * 0.85) };
    pousser(C, T1);
    // rangée de poissons au sol dans la seconde moitié de la descente
    for (let j = 0; j < 5; j++) { const x = C.x + (T1.x - C.x) * 0.55 + j * 62; if (x < T1.x - 30) poissons.push([Math.round(x), Math.round(hSeg(C, T1, x) + 22), "normal"]); }
  };

  // Faisceau : situations du pingouin parfait (même méthode que robots.parfait), avancé par morceaux.
  let faisceau = [{ e: g.sauver(), bits: null, note: 0 }];
  function avancer(arret) {
    for (let n = 0; n < 4000; n++) {
      const r = R.etape(g, faisceau, { auSol: true });
      if (r.gagne) { g.restaurer(faisceau[0].e); return true; }
      faisceau = r.faisceau;
      g.restaurer(faisceau[0].e);
      if (arret(g)) return true;
    }
    return false;
  }
  const meilleur = () => { g.restaurer(faisceau[0].e); return g; };

  // Pose la bosse cible (et la vallée) pour un vol qui part de la situation q (juste après le décollage).
  function poserCible(C, q, dist) {
    // vol calculé pour un pingouin un peu moins rapide que le parfait (« tolerance » de sa vitesse) : entre les
    // deux, on retombe dans la longue descente de la bosse cible ; plus vite, on plonge en l'air pour redescendre
    const traj = [];
    q.p.vx *= plan.rythme.tolerance; q.p.vy *= plan.rythme.tolerance;
    q.hold = false;
    for (let k = 0; k < 240 * 5 && q.p.y > C.y - 1200; k++) { q.step(SOUS_PAS); if (k % 4 === 0) traj.push({ x: q.p.x, y: q.p.y, pente: q.p.vy / q.p.vx }); }
    const yTraj = (x) => { for (let i = 1; i < traj.length; i++) if (traj[i].x >= x) return traj[i - 1].y + (traj[i].y - traj[i - 1].y) * (x - traj[i - 1].x) / (traj[i].x - traj[i - 1].x); return -1e9; };
    // point d'atterrissage visé : là où le vol redescend franchement (pente d'au moins 0,65),
    // au moins à 60 % de la distance visée
    let L = traj.find((s) => s.x >= C.x + dist * 0.6 && s.pente <= -0.65);
    if (!L) L = traj.find((s) => s.pente <= -0.65) || traj[traj.length - 1];
    // bosse cible : sa descente passe par L avec la pente de la trajectoire
    // Tolérance : le sommet de la bosse cible est au moins 90 px sous le vol parfait ; un vol un peu plus
    // lent (plus bas) passe encore au-dessus et retombe dans la descente.
    let w = varie(plan.glisse.relief[2]) * 1.3, tL = 0.45;
    for (let essai = 0; essai < 8; essai++) {
      const delta = Math.min(900, Math.max(120, -L.pente * 2 * w / (Math.PI * Math.sin(Math.PI * tL))));
      const Cl = { x: L.x - tL * w, y: L.y + delta * (1 - Math.cos(Math.PI * tL)) / 2 };
      const Tl = { x: Cl.x + w, y: Cl.y - delta };
      // Crevasse remplie d'eau entre le décollage et la bosse cible, bien sous la trajectoire : qui ne
      // saute pas assez loin tombe à l'eau, perd sa vitesse et remonte lentement la bosse cible.
      const span = Cl.x - C.x;
      let minTraj = Infinity;
      for (let x = C.x + 200; x < Cl.x; x += 20) minTraj = Math.min(minTraj, yTraj(x));
      const bas = Math.min(C.y, Cl.y, minTraj) - 520;
      const mid = [{ x: C.x + Math.max(380, span * 0.28), y: bas }, { x: Cl.x - Math.max(380, span * 0.22), y: bas }];
      const yEau = Math.min(bas + 230, minTraj - 160, C.y - 200, Cl.y - 200);
      // la trajectoire passe 35 px au-dessus de la vallée et de la montée de la bosse cible
      const essaiPts = [C, ...mid, Cl, Tl];
      let ok = true;
      for (let x = C.x + 150; x < Cl.x + (L.x - Cl.x) * 0.5; x += 20) if (hPts(essaiPts, x) > yTraj(x) - (x < Cl.x - 400 ? 35 : x < Cl.x + 60 ? 90 : 2)) { ok = false; if (process.env.DEBUG) console.log(`    essai ${essai} tL ${tL.toFixed(2)} : touche à ${Math.round(x - Cl.x)} du sommet cible (sol ${Math.round(hPts(essaiPts, x))}, vol ${Math.round(yTraj(x))}, pente L ${L.pente.toFixed(2)})`); break; }
      if (ok) {
        // l'eau couvre la crevasse là où le sol est sous sa surface
        let x0 = null, x1 = null;
        for (let x = C.x; x < Cl.x; x += 10) if (hPts(essaiPts, x) < yEau) { if (x0 === null) x0 = x; x1 = x; }
        return { mid, Cl, Tl, L, yTraj, eau: x0 !== null ? [Math.round(x0), Math.round(x1), Math.round(yEau)] : null };
      }
      tL = Math.max(0.25, tL - 0.04); w *= 1.08;
    }
    return null;
  }
  // Pingouin parfait jusqu'au décollage de C : sa situation en l'air juste après, ou null s'il ne décolle pas.
  function decoller(C) {
    avancer((q) => q.p.x > C.x + 40 || (!q.p.ground && q.p.x > C.x - 400));
    const q = meilleur();
    return q.p.ground ? null : { e: q.sauver(), boums: q.boums, parfaits: q.parfaits };
  }
  function saut(dist, kDecollage) {
    const T0 = pts[pts.length - 1];
    const [haut, montee] = plan.glisse.relief;
    const C = rond({ x: T0.x + varie(montee) * 1.1, y: varie(haut) * kDecollage });
    pts.push(C, { x: C.x + 8000, y: -3000 });                       // terrain provisoire, très bas
    const avant = faisceau;
    let dec = decoller(C);
    if (!dec) { pts.splice(pts.length - 2, 2); faisceau = avant; return false; }   // pas décollé : pas de saut ici
    const iC = pts.indexOf(C), nEaux = eaux.length;
    for (let iter = 0; iter < 4; iter++) {
      g.restaurer(dec.e);
      const cible = poserCible(C, g, dist);
      pts.splice(iC + 1);                                           // tout ce qui suit le sommet est refait
      if (!cible) { eaux.length = nEaux; pousser({ x: C.x + 900, y: -C.y * 0.6 }); faisceau = avant; return "bosse"; }
      pousser(...cible.mid, cible.Cl, cible.Tl);
      eaux.length = nEaux; if (cible.eau) eaux.push(cible.eau);
      // Vérification : le pingouin parfait, sur le vrai terrain, retombe-t-il proprement sur la cible ?
      faisceau = avant;
      const d2 = decoller(C);
      let enVol = false;
      avancer((q) => { if (q.p.x > cible.Cl.x - 100 && q.p.x < cible.Cl.x) enVol = !q.p.ground; return q.p.x > cible.L.x + 400; });
      const q = meilleur();
      const propre = d2 && enVol && q.boums === d2.boums && q.parfaits > d2.parfaits;
      if (propre || !d2) {
        vols.push({ C, L: cible.L, Cl: cible.Cl, ok: propre });
        // arc de poissons le long du vol idéal, un poisson bleu au milieu, parfois un doré au-dessus
        const { L, Cl, Tl, yTraj } = cible;
        for (let x = C.x + 160; x < L.x - 120; x += 130) poissons.push([Math.round(x), Math.round(yTraj(x) + 18), "normal"]);
        const xm = (C.x + L.x) / 2;
        poissons.push([Math.round(xm + 40), Math.round(yTraj(xm + 40) + 18), "bleu"]);
        if (rand() < 0.5) poissons.push([Math.round(xm), Math.round(yTraj(xm) + 260), "or"]);
        for (let j = 0; j < 4; j++) { const x = L.x + 150 + j * 62; poissons.push([Math.round(x), Math.round(hSeg(Cl, Tl, x) + 22), "normal"]); }
        faisceau = avant;
        return true;
      }
      dec = d2;        // il a décollé autrement : on recalcule la cible pour ce vol-là
      if (process.env.DEBUG) console.log(`  saut à ${Math.round(C.x)} : nouvel essai (${iter + 1})`);
    }
    faisceau = avant;
    vols.push({ C, ok: false });
    return true;
  }

  // Construction : élan, puis selon la vitesse du pingouin parfait au dernier creux :
  // lent → une bosse de glisse pour prendre de la vitesse ; rapide → un saut calculé.
  for (let i = 0; i < plan.elan.bosses; i++) bosse(plan.elan.relief);
  let n = 0, glissesDeSuite = 0;
  while (pts[pts.length - 1].x < finX - 4500) {
    const T = pts[pts.length - 1];
    avancer((q) => q.p.x > T.x - 500);
    const q = meilleur(), v = Math.hypot(q.p.vx, q.p.vy);
    const avancement = T.x / finX;
    const dist = plan.rythme.vol[0] + (plan.rythme.vol[1] - plan.rythme.vol[0]) * avancement;
    if (v < plan.rythme.vitesse * plan.vmax && glissesDeSuite < 3) { bosse(plan.glisse.relief); glissesDeSuite++; continue; }
    const r = saut(dist, plan.rythme.decollage);
    if (r === true) { n++; glissesDeSuite = 0; } else { bosse(plan.glisse.relief); glissesDeSuite++; }
  }
  // arrivée : glissade presque plate jusqu'à l'igloo
  const last = pts[pts.length - 1];
  pousser({ x: Math.max(last.x + 600, finX - 300), y: -40 }, { x: finX + 8000, y: -110 });

  const niveau = {
    id, nom: plan.nom, long: plan.long, vmax: plan.vmax, ciel: plan.ciel, graine: plan.graine,
    points: pts.map((q) => [Math.round(q.x), Math.round(q.y)]),
    poissonsFixes: poissons.filter(([x]) => x < finX - 250),
    eaux: eaux.slice(),
  };
  if (process.env.DEBUG) {     // contrôle : le faisceau d'une traite sur le terrain fini
    const g0 = Pingo.creerPartie({ niveau: { ...spec, points: pts.map((q) => [q.x, q.y]) }, rejeu: true });
    g.restaurer(g0.sauver()); faisceau = [{ e: g.sauver(), bits: null, note: 0 }];
    avancer((q) => q.etat !== "jeu" || q.p.x > finX);
    console.log("  faisceau continu (pendant la construction) :", meilleur().time.toFixed(2), "s");
  }
  // parcours parfait sur le niveau fini (poissons compris), puis marge pour le joueur « moyen »
  const pf = R.parfait({ ...niveau, monde: 0, numero: 0, poissons: {} });
  const j = Pingo.rejouer({ ...niveau }, pf.entrees);
  const tr = j.trace;
  const tAt = (x) => { for (let k = 1; k < tr.length; k++) if (tr[k] >= x) return (k - 1 + (x - tr[k - 1]) / Math.max(1, tr[k] - tr[k - 1])) * Pingo.PAS_TRACE; return tr.length * Pingo.PAS_TRACE; };
  const ex = R.expert({ ...niveau, entrees: pf.entrees, marge: 99 }, { ...R.PROFILS.moyen, fonte: false, suivi: (q) => tAt(q.p.x) });
  // atterrissages du parcours parfait sur les bosses cibles
  let surCible = 0;
  { const gg = Pingo.creerPartie({ niveau, rejeu: true, on: (t, d) => { if (t === "atterrissage" && d.type === "parfait" && vols.some((v) => v.Cl && d.x > v.Cl.x && d.x < v.L.x + 500)) surCible++; } });
    const bits = Pingo.decoder(pf.entrees);
    for (let i = 0; gg.etat === "jeu" && i < bits.length; i++) { gg.hold = !!bits[i]; for (let k = 0; k < PAR_TRANCHE; k++) gg.step(SOUS_PAS); } }
  niveau.marge = plan.marge;   // retard de la banquise sur le parcours parfait (le joueur moyen n'est qu'une indication)
  niveau.e = pf.entrees;
  console.log(`${id} : ${pts.length} points, ${n} sauts calculés, ${eaux.length} crevasses (${vols.filter((v) => v.ok).length} vérifiés à la construction, ${surCible} glisses parfaites sur les bosses cibles dans le parcours final), ${niveau.poissonsFixes.length} poissons ; parfait ${j.temps.toFixed(1)} s, ${j.parfaits} glisses parfaites, ${j.boums} « Boum » ; joueur moyen : retard max ${ex.retardMax.toFixed(1)} s ; marge ${niveau.marge} s`);
  return niveau;
}

const table = {};
for (const [id, plan] of Object.entries(PLANS)) table[id] = construire(id, plan);
const js = `// Niveaux construits par outils/construire-niveaux.mjs (npm run construire) : ne pas modifier à la main.
// points : relief [x, y] ; poissonsFixes : [x, y, type] ; e : appuis du pingouin parfait ; marge (s).
(function (racine) {
const NIVEAUX = ${JSON.stringify(table)};
if (typeof module !== "undefined" && module.exports) module.exports = NIVEAUX;
else racine.PINGO_CONSTRUITS = NIVEAUX;
})(typeof window !== "undefined" ? window : globalThis);
`;
if (process.argv.includes("--verifier")) {
  const ok = existsSync(FICHIER) && readFileSync(FICHIER, "utf8") === js;
  console.log(ok ? "✓ niveaux construits à jour" : "✗ niveaux-construits.js n'est plus à jour : npm run construire");
  process.exit(ok ? 0 : 1);
}
writeFileSync(FICHIER, js);
console.log(`niveaux-construits.js écrit (${Object.keys(table).length} niveau)`);
