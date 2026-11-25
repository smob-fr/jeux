#!/usr/bin/env node
// Vérifie tous les niveaux de l'aventure avec deux pingouins robots (outils/robots.cjs) :
// - le « bon » robot finit chaque niveau ;
// - le « débutant » finit tous les niveaux du premier monde ;
// - dans les deux premiers niveaux, le débutant retombe toujours dans la pente (aucun « Boum ») ;
// - à partir du 1-3, un pingouin qui ne fait rien se fait rattraper par la banquise ;
// - durée d'un niveau entre 12 et 75 s.
// Affiche un tableau (--detail pour chaque niveau). Code de sortie 1 si une règle n'est pas tenue.
import { createRequire } from "node:module";
const R = createRequire(import.meta.url)("./robots.cjs");
const { Pingo } = R;
const detail = process.argv.includes("--detail");
let erreurs = 0;
const faux = (msg) => { console.log("✗ " + msg); erreurs++; };
const f = (r) => `${r.etat === "gagne" ? "arrivé" : "plouf "} ${String(r.m).padStart(5)} m ${r.temps.toFixed(0).padStart(3)} s ★${r.etoiles} 🐟 ${r.score}/${r.total} parfait ${r.atter.parfait} boum ${r.atter.boum + r.atter.tete}`;
for (const M of Pingo.MONDES) {
  for (let i = 1; i <= Pingo.NIVEAUX_PAR_MONDE; i++) {
    const n = Pingo.niveau(M.id, i);
    const b = R.jouer({ niveau: n }, R.bon()), d = R.jouer({ niveau: n }, R.debutant()), r = R.jouer({ niveau: n }, R.rien());
    if (detail) console.log(`${n.id.padEnd(5)} ${String(n.long).padStart(4)} m │ bon ${f(b)} │ débutant ${f(d)} │ sans rien faire ${Math.round(100 * r.m / n.long)} %`);
    if ((M.id > 1 || i >= 3) && r.etat === "gagne") faux(`${n.id} : un pingouin qui ne fait rien arrive au bout`);
    if (b.etat !== "gagne") faux(`${n.id} : le bon robot n'arrive pas au bout (${b.m} m sur ${n.long})`);
    if (M.id === 1 && d.etat !== "gagne") faux(`${n.id} : le débutant n'arrive pas au bout (${d.m} m sur ${n.long})`);
    if (M.id === 1 && i <= 2 && d.atter.boum + d.atter.tete > 0) faux(`${n.id} : le débutant fait ${d.atter.boum} « Boum » (niveau d'apprentissage)`);
    if (b.temps < 12 || b.temps > 75) faux(`${n.id} : durée ${b.temps.toFixed(0)} s (hors de 12 à 75 s)`);
    if (n.total < 20) faux(`${n.id} : trop peu de poissons (${n.total})`);
  }
}
// Mode sans fin : départ facile, le débutant ne fait pas de « Boum » sur les 300 premiers mètres.
for (const graine of [1, 2, 3, 4, 5]) {
  let boum = 0;
  const g = Pingo.creerPartie({ graine, on: (t, x) => { if (t === "atterrissage" && (x.type === "boum" || x.type === "tete") && g.m < 300) boum++; } });
  const robot = R.debutant();
  while (g.etat === "jeu" && g.m < 320) for (let k = 0; k < 4; k++) { g.hold = robot(g); g.step(1 / 240); }
  if (boum) faux(`sans fin (graine ${graine}) : ${boum} « Boum » dans les 300 premiers mètres`);
}
console.log(erreurs ? `\n${erreurs} problème(s) dans les niveaux` : `✓ niveaux : ${Pingo.MONDES.length * Pingo.NIVEAUX_PAR_MONDE} niveaux vérifiés, départ du mode sans fin facile`);
process.exit(erreurs ? 1 : 0);
