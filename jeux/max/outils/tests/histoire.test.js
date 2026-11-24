// L'histoire : récit d'ouverture avant le premier niveau d'un monde, fragments de l'Œil sur la carte.
"use strict";

module.exports = [
  {
    nom: "Histoire : récit d'ouverture du monde 2, puis le niveau ; l'Œil sur la carte",
    fiches: true,
    async run(page) {
      const r = await page.evaluate(async () => {
        const t = __temple, nm = 20;
        t.progress.tester = true; t.progress.intros = {}; t.progress.nouveautes = {};
        t.progress.best = { 19: 0, 39: 2 };   // monde 1 et 2 finis (anciennes sauvegardes : fragments déduits)
        t.playFrom(nm);
        const ecran = !document.getElementById("ecran-intro").hidden, mode = t.game.mode;
        const titre = document.getElementById("intro-titre").textContent, frag = document.getElementById("intro-fragments").textContent;
        document.getElementById("btn-intro-suite").click();
        const apres = t.game.mode, niveau = t.room && t.room.def.id;
        // une deuxième fois : plus de récit
        t.playFrom(nm);
        const encore = t.game.mode;
        // la carte des mondes montre l'Œil avec ses fragments
        t.goHome && t.goHome();
        window.MondesUI.afficherCarte();
        const carte = document.getElementById("mondes-carte").innerHTML.includes("Œil de Jade : 2/5");
        return { ecran, mode, titre, frag, apres, niveau, encore, carte };
      });
      const ok = r.ecran && r.mode === "intro" && r.titre === "Le fragment de Glace" && r.frag.includes("2 sur 5") && r.apres === "card" && r.niveau === "him-1" && r.encore === "card" && r.carte;
      return { ok, detail: JSON.stringify(r) };
    },
  },
];
module.exports.push({
  nom: "1-19 (le sablier) : le sable reste à 5 cases au plus sous les pieds de Max",
  async run(page) {
    const r = await page.evaluate(() => {
      const t = __temple, T = 16;
      t.progress.tester = true; t.playFrom(t.LEVELS.findIndex((l) => l.id === "inca-19"));
      for (let k = 0; k < 90; k++) t.mesurePerf(1);   // la carte du niveau, puis le sable se met en route
      const R = t.room, P = R.player; P.invuln = 1e9;
      // Max monte d'un coup de 20 cases (comme s'il grimpait très vite) : le sable le rattrape à 5 cases
      const y = P.y - 20 * T, x = P.x;
      for (let k = 0; k < 240; k++) { P.x = x; P.y = y; P.vy = 0; t.mesurePerf(1); }
      P.x = x; P.y = y;
      const ecart = (R.flood.level - (P.y + P.h)) / T;
      return { colle: R.flood.colle, ecart: +ecart.toFixed(2) };
    });
    return { ok: r.colle === 5 && r.ecart <= 5.2 && r.ecart > 2, detail: `sable à ${r.ecart} cases sous Max (colle ${r.colle})` };
  },
});
