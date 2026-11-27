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
// Plans : outils/plans-niveaux.mjs. Écrit niveaux-construits.js.
//   node outils/construire-niveaux.mjs              tous les niveaux (plusieurs minutes)
//   node outils/construire-niveaux.mjs 1-2 test     seulement ceux-là (les autres sont gardés)
//   node outils/construire-niveaux.mjs --verifier   rapide : chaque niveau existe, a été construit avec son
//                                                   plan actuel, et son parcours parfait arrive au bout
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const R = require("./robots.cjs");
const { Pingo } = R;
const { SOUS_PAS, PAS_ENTREE, PX_PER_M } = Pingo;
const PAR_TRANCHE = Math.round(PAS_ENTREE / SOUS_PAS);
const FICHIER = fileURLToPath(new URL("../niveaux-construits.js", import.meta.url));
import { plans } from "./plans-niveaux.mjs";
const PLANS = plans();
const signature = (plan) => JSON.stringify(plan);
const PENTE_MAX_DEFAUT = 1;   // pente maximale des montées, des descentes et des parois (45°), sauf plan.penteMax

const hSeg = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a.x) / (b.x - a.x))); return a.y + (b.y - a.y) * (1 - Math.cos(Math.PI * t)) / 2; };
function hPts(pts, x) {
  for (let i = 0; i < pts.length - 1; i++) if (pts[i + 1].x > x) return hSeg(pts[i], pts[i + 1], x);
  return pts[pts.length - 1].y;
}

function construire(id, plan) {
  const rand = Pingo.aleatoire(plan.graine);
  const PENTE_MAX = plan.penteMax || PENTE_MAX_DEFAUT;
  const DEGAGEMENT = plan.saut.degagement ?? 90;   // le sommet de la bosse cible est au moins à ça sous le vol
  const CHUTE_MAX = plan.saut.chuteMax ?? 350;     // la cible n'est jamais plus bas que ça sous le décollage
  const va = plan.variation ?? 0.1;                         // variation d'une bosse à l'autre (± 10 %)
  const varie = (v) => v * (1 - va + 2 * va * rand());
  const finX = plan.long * PX_PER_M;
  // Partie de calcul (sans poissons, sans banquise) dont on fait grandir le terrain.
  // départ : en haut d'une petite bosse (le pingouin démarre en x = 0, sur son plateau), puis la descente
  // (plan.depart : la bosse de départ choisie à la main { haut, plateau, descente, creux })
  const [hD, , dD] = plan.elan.relief;
  const D = plan.depart || { haut: hD, plateau: 300, descente: dD, creux: hD * 0.85 };
  const spec = { id, long: plan.long, vmax: plan.vmax, poissonsFixes: [], eaux: [], graine: plan.graine,
    points: [[-1800, -40], [-900, Math.round(D.haut * 0.4)], [Math.round(-D.plateau / 2), Math.round(D.haut)], [Math.round(D.plateau / 2), Math.round(D.haut)],
      [Math.round(D.plateau / 2 + D.descente), Math.round(-D.creux)]] };
  const g = Pingo.creerPartie({ niveau: spec, rejeu: true });
  const pts = g.terrain.pts;
  // points arrondis dès la construction : le terrain enregistré (entiers) est exactement celui joué ici
  const rond = (q) => ({ ...q, x: Math.round(q.x), y: Math.round(q.y) });
  const pousser = (...l) => pts.push(...l.map(rond));
  const poissons = [], vols = [];
  const eaux = spec.eaux;   // même tableau que la partie de calcul : elle voit les crevasses au fur et à mesure
  // Une bosse : montée, sommet (avec un plateau de largeur « plateau » : sommet arrondi, pas pointu), descente.
  // (relief [hauteur, montée, descente, plateau, creux] ; creux : profondeur sous 0, par défaut 85 % de la hauteur ;
  //  fixe : valeurs exactes, sans variation, pour les bosses choisies à la main)
  const bosse = ([haut, montee, descente, plateau = 0, creux = haut * 0.85], { k = 1, fixe = false } = {}) => {
    const T0 = pts[pts.length - 1];
    const v = fixe ? (x) => x : varie;
    const C = { x: 0, y: v(haut) * k }, T1 = { x: 0, y: -v(creux) };
    // largeurs au moins celles d'une pente de PENTE_MAX (montée depuis un creux profond, par exemple)
    C.x = T0.x + Math.max(v(montee), (C.y - T0.y) * Math.PI / 2 / PENTE_MAX);
    const C2 = { x: C.x + plateau, y: C.y };
    T1.x = C2.x + Math.max(v(descente), (C.y - T1.y) * Math.PI / 2 / PENTE_MAX);
    if (plateau > 0) pousser(C, C2, T1); else pousser(C, T1);
    // rangée de poissons au sol dans la seconde moitié de la descente, gros poissons au-dessus du sommet
    for (let j = 0; j < 5; j++) { const x = C.x + (T1.x - C.x) * 0.55 + j * 62; if (x < T1.x - 30) poissons.push([Math.round(x), Math.round(hSeg(C, T1, x) + 22), "normal"]); }
    if (rand() < plan.poissons.bleu) poissons.push([Math.round(C.x + 200), Math.round(C.y + 230), "bleu"]);
    if (rand() < plan.poissons.or) poissons.push([Math.round(C.x + 320), Math.round(C.y + 430), "or"]);
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
  function poserCible(C, q, dist, avecEau) {
    // vol calculé pour un pingouin un peu moins rapide que le parfait (« tolerance » de sa vitesse) : entre les
    // deux, on retombe dans la longue descente de la bosse cible ; plus vite, on plonge en l'air pour redescendre
    const traj = [];
    q.p.vx *= plan.saut.tolerance; q.p.vy *= plan.saut.tolerance;
    q.hold = false;
    for (let k = 0; k < 240 * 5 && q.p.y > C.y - 1200; k++) { q.step(SOUS_PAS); if (k % 4 === 0) traj.push({ x: q.p.x, y: q.p.y, pente: q.p.vy / q.p.vx }); }
    const yTraj = (x) => { for (let i = 1; i < traj.length; i++) if (traj[i].x >= x) return traj[i - 1].y + (traj[i].y - traj[i - 1].y) * (x - traj[i - 1].x) / (traj[i].x - traj[i - 1].x); return -1e9; };
    // point d'atterrissage visé : là où le vol redescend franchement (pente d'au moins 0,65),
    // au moins à 60 % de la distance visée
    // (et jamais à plus de 350 px sous le sommet de décollage : pas de bosse cible au fond d'un trou)
    let L = traj.find((s) => s.x >= C.x + dist * 0.6 && (s.pente <= -0.65 || s.y < C.y - CHUTE_MAX));
    if (!L) L = traj.find((s) => s.pente <= -0.65 || s.y < C.y - CHUTE_MAX) || traj[traj.length - 1];
    // bosse cible : sa descente passe par L avec la pente de la trajectoire
    // Tolérance : le sommet de la bosse cible est au moins 90 px sous le vol parfait ; un vol un peu plus
    // lent (plus bas) passe encore au-dessus et retombe dans la descente.
    // (descente plus longue quand la tolérance est grande : le pingouin parfait, plus rapide, retombe plus loin)
    let w = varie(plan.glisse.relief[2]) * 1.3 / (plan.saut.tolerance * plan.saut.tolerance), tL = 0.45;
    for (let essai = 0; essai < 8; essai++) {
      // (le pied de la bosse cible ne descend pas sous -300 : la bosse suivante n'aura pas un mur à gravir)
      let delta = Math.min(900, Math.max(120, -L.pente * 2 * w / (Math.PI * Math.sin(Math.PI * tL))));
      delta = Math.max(120, Math.min(delta, (L.y + 300) / (1 - (1 - Math.cos(Math.PI * tL)) / 2)));
      delta = Math.min(delta, w * 2 * PENTE_MAX / Math.PI);       // descente de la bosse cible : pente ≤ PENTE_MAX
      const Cl = { x: L.x - tL * w, y: L.y + delta * (1 - Math.cos(Math.PI * tL)) / 2 };
      const Tl = { x: Cl.x + w, y: Cl.y - delta };
      // Crevasse remplie d'eau entre le décollage et la bosse cible, bien sous la trajectoire : qui ne
      // saute pas assez loin tombe à l'eau, perd sa vitesse et remonte lentement la bosse cible.
      const span = Cl.x - C.x;
      let minTraj = Infinity;
      for (let x = C.x + 200; x < Cl.x; x += 20) minTraj = Math.min(minTraj, yTraj(x));
      // (sans eau : un simple creux ; trop court, on cogne la montée de la bosse cible)
      // parois en pente douce : une paroi de hauteur Δ en cosinus a une pente maximale Δπ/(2·largeur) ≤ 1
      const bas = Math.min(C.y, Cl.y, minTraj) - (avecEau ? 300 : 200);
      const larg = (dy) => Math.max(350, Math.abs(dy) * Math.PI / 2 / PENTE_MAX);
      let x1 = C.x + larg(C.y - bas), x2 = Cl.x - larg(Cl.y - bas);
      let mid = [{ x: x1, y: bas }, { x: x2, y: bas }];
      if (x2 <= x1 + 100) {
        // creux court : un seul point bas, au milieu, pas plus profond que ce que permet une pente de PENTE_MAX
        const xm = (C.x + Cl.x) / 2, prof = (xm - C.x) * 2 * PENTE_MAX / Math.PI;
        mid = [{ x: xm, y: Math.max(bas, C.y - prof, Cl.y - prof) }];
      }
      if (mid[0].x <= C.x + 200 || mid[mid.length - 1].x >= Cl.x - 200) { tL = Math.max(0.25, tL - 0.04); w *= 1.08; continue; }
      const fond = Math.min(...mid.map((q) => q.y));
      const yEau = Math.min(fond + 230, minTraj - 160, C.y - 200, Cl.y - 200);
      // la trajectoire passe 35 px au-dessus de la vallée et de la montée de la bosse cible
      const essaiPts = [C, ...mid, Cl, Tl];
      let ok = true;
      for (let x = C.x + 150; x < Cl.x + (L.x - Cl.x) * 0.5; x += 20) if (hPts(essaiPts, x) > yTraj(x) - (x < Cl.x - 400 ? 35 : x < Cl.x + 60 ? DEGAGEMENT : 2)) { ok = false; if (process.env.DEBUG) console.log(`    essai ${essai} tL ${tL.toFixed(2)} : touche à ${Math.round(x - Cl.x)} du sommet cible (sol ${Math.round(hPts(essaiPts, x))}, vol ${Math.round(yTraj(x))}, pente L ${L.pente.toFixed(2)})`); break; }
      if (ok) {
        // l'eau couvre la crevasse là où le sol est sous sa surface
        let x0 = null, x1 = null;
        for (let x = C.x; x < Cl.x; x += 10) if (hPts(essaiPts, x) < yEau) { if (x0 === null) x0 = x; x1 = x; }
        return { mid, Cl, Tl, L, yTraj, eau: avecEau && x0 !== null ? [Math.round(x0), Math.round(x1), Math.round(yEau)] : null };
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
    const [haut, montee, , plateau = 0] = plan.glisse.relief;   // la bosse de décollage : une glisse plus haute
    const yC = varie(haut) * kDecollage;
    const xC = T0.x + Math.max(varie(montee) * 1.1, (yC - T0.y) * Math.PI / 2 / PENTE_MAX);
    const n0 = pts.length;
    if (plateau > 0) pousser({ x: xC - plateau / 2, y: yC });       // plateau du sommet de décollage
    const C = rond({ x: xC + (plateau > 0 ? plateau / 2 : 0), y: yC });
    pts.push(C, { x: C.x + 8000, y: -3000 });                       // terrain provisoire, très bas
    const avant = faisceau;
    let dec = decoller(C);
    if (!dec) { pts.length = n0; faisceau = avant; return false; }   // pas décollé : pas de saut ici
    const iC = pts.indexOf(C), nEaux = eaux.length, avecEau = rand() < plan.saut.eau;
    for (let iter = 0; iter < 4; iter++) {
      g.restaurer(dec.e);
      const cible = poserCible(C, g, dist, avecEau);
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
      // sans eau, le pingouin parfait peut préférer rester au sol : le saut reste un raccourci, on le garde
      if (propre || !d2 || (!avecEau && iter >= 1)) {
        vols.push({ C, L: cible.L, Cl: cible.Cl, ok: propre });
        // arc de poissons le long du vol idéal, un poisson bleu au milieu, parfois un doré au-dessus
        const { L, Cl, Tl, yTraj } = cible;
        for (let x = C.x + 160; x < L.x - 120; x += 130) poissons.push([Math.round(x), Math.round(yTraj(x) + 18), "normal"]);
        const xm = (C.x + L.x) / 2;
        if (rand() < plan.poissons.bleu * 2) poissons.push([Math.round(xm + 40), Math.round(yTraj(xm + 40) + 18), "bleu"]);
        if (rand() < plan.poissons.or * 3) poissons.push([Math.round(xm), Math.round(yTraj(xm) + 260), "or"]);
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
  for (const b of plan.fixes || []) bosse([b.haut, b.montee, b.descente, b.plateau, b.creux], { fixe: true });   // bosses choisies à la main
  for (let i = 0; i < plan.elan.bosses; i++) bosse(plan.elan.relief);
  let n = 0, glissesDeSuite = 0;
  while (pts[pts.length - 1].x < finX - 4500) {
    const T = pts[pts.length - 1];
    avancer((q) => q.p.x > T.x - 500);
    const q = meilleur(), v = Math.hypot(q.p.vx, q.p.vy);
    const avancement = T.x / finX;
    const dist = plan.saut.vol[0] + (plan.saut.vol[1] - plan.saut.vol[0]) * avancement;
    if (process.env.DEBUG) console.log(`  creux à ${Math.round(T.x)} : vitesse ${Math.round(v)} (saut au-delà de ${Math.round(plan.saut.vitesse * plan.vmax)})`);
    if (v < plan.saut.vitesse * plan.vmax) { bosse(plan.glisse.relief); glissesDeSuite++; continue; }
    const r = saut(dist, plan.saut.decollage);
    if (r === true) {
      n++; glissesDeSuite = 0;
      for (let i = 0; i < plan.saut.recup; i++) bosse(plan.elan.relief);   // de quoi reprendre de l'élan après un raté
    } else { bosse(plan.glisse.relief); glissesDeSuite++; }
  }
  // arrivée : glissade presque plate jusqu'à l'igloo
  const last = pts[pts.length - 1];
  pousser({ x: Math.max(last.x + 600, finX - 300), y: -40 }, { x: finX + 8000, y: -110 });

  const niveau = {
    id, nom: plan.nom, long: plan.long, vmax: plan.vmax, ciel: plan.ciel, graine: plan.graine, sig: signature(plan), sauts: n,
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

const args = process.argv.slice(2);
const anciens = existsSync(FICHIER) ? require(FICHIER) : {};
if (args.includes("--verifier")) {
  let faux = 0;
  for (const [id, plan] of Object.entries(PLANS)) {
    const N = anciens[id];
    if (!N) { console.log(`✗ ${id} : pas construit (npm run construire -- ${id})`); faux++; continue; }
    if (N.sig !== signature(plan)) { console.log(`✗ ${id} : son plan a changé (npm run construire -- ${id})`); faux++; continue; }
    const r = Pingo.rejouer({ ...N, entrees: N.e });
    if (r.etat !== "gagne") { console.log(`✗ ${id} : le parcours parfait n'arrive plus au bout (npm run construire -- ${id})`); faux++; }
  }
  console.log(faux ? `${faux} niveau(x) à reconstruire` : `✓ niveaux construits à jour (${Object.keys(PLANS).length}), parcours parfaits valides`);
  process.exit(faux ? 1 : 0);
}
const demandes = args.filter((a) => PLANS[a]);
const table = {};
for (const id of Object.keys(PLANS)) {
  if (demandes.length && !demandes.includes(id) && anciens[id]) { table[id] = anciens[id]; continue; }
  table[id] = construire(id, PLANS[id]);
}
const js = `// Niveaux construits par outils/construire-niveaux.mjs (npm run construire) : ne pas modifier à la main.
// points : relief [x, y] ; poissonsFixes : [x, y, type] ; eaux : crevasses [x début, x fin, niveau de l'eau] ;
// e : appuis du pingouin parfait ; marge : retard de la banquise (s) ; sig : plan utilisé.
(function (racine) {
const NIVEAUX = {
${Object.entries(table).map(([id, n]) => `${JSON.stringify(id)}: ${JSON.stringify(n)},`).join("\n")}
};
if (typeof module !== "undefined" && module.exports) module.exports = NIVEAUX;
else racine.PINGO_CONSTRUITS = NIVEAUX;
})(typeof window !== "undefined" ? window : globalThis);
`;
writeFileSync(FICHIER, js);
console.log(`niveaux-construits.js écrit (${Object.keys(table).length} niveaux)`);
