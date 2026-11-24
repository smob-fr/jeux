// Fiches « Nouveauté » (monde 3) : la fiche s'affiche à l'arrivée du niveau, le jeu attend OK,
// puis elle n'est plus jamais montrée. Le 3-2 commence par un mur fissuré à ouvrir avec une mine.
"use strict";

module.exports = [
  {
    nom: "Fiches « Nouveauté » : la mine au 3-2, OK, puis plus jamais",
    fiches: true,
    async run(page) {
      const r = await page.evaluate(() => {
        const t = __temple, i = t.LEVELS.findIndex((l) => l.id === "aby-2");
        t.progress.tester = true; t.progress.nouveautes = {};
        t.playFrom(i);
        for (let k = 0; k < 90; k++) t.mesurePerf(1);
        const fiche = t.game.mode, nv = (t.game.nv || []).join(",");
        // un appui trop tôt ne ferme pas la fiche (on a le temps de la lire)
        t.pressed.jump = true; t.mesurePerf(1);
        const tot = t.game.mode;
        for (let k = 0; k < 60; k++) t.mesurePerf(1);
        t.pressed.fire = true; t.mesurePerf(1);
        const apres = t.game.mode, vue = !!t.progress.nouveautes.mine;
        // on recommence le niveau : pas de fiche
        t.playFrom(i);
        for (let k = 0; k < 90; k++) t.mesurePerf(1);
        const encore = t.game.mode;
        // le premier passage du 3-2 : une mine devant un mur fissuré
        const def = t.LEVELS[i], m = def.map, mine = m.findIndex((l) => l.includes("M"));
        const xm = mine >= 0 ? m[mine].indexOf("M") : -1, mur = m.some((l) => l.indexOf("B") > xm && l.indexOf("B") < xm + 12);
        return { fiche, nv, tot, apres, vue, encore, xm, mur, aby1: (t.LEVELS.find((l) => l.id === "aby-1").nouveau || []).join(",") };
      });
      const ok = r.fiche === "nouveau" && r.nv === "mine" && r.tot === "nouveau" && r.apres === "play" && r.vue && r.encore === "play" && r.xm > 0 && r.xm < 20 && r.mur && r.aby1 === "plongee,meduse";
      return { ok, detail: JSON.stringify(r) };
    },
  },
  {
    nom: "Abysses : un éboulement ne laisse pas de trou dans le plafond (Max coincé au 3-10)",
    async run(page) {
      const r = await page.evaluate(() => {
        const t = __temple, T = 16;
        t.progress.tester = true; t.playFrom(t.LEVELS.findIndex((l) => l.id === "aby-10")); t.game.mode = "play"; t.game.cardT = 99;
        for (let k = 0; k < 95; k++) t.mesurePerf(1);
        const R = t.room, P = R.player, e = R.def.eau;
        R.def.triggers.forEach((_, j) => R.fired.add(j)); R.enemies.forEach((q) => (q.alive = false)); P.invuln = 1e9;
        // une colonne de bulles avec de la roche juste au-dessus, puis un éboulement à cet endroit
        const b = R.bulles.find((q) => R.tiles[e - 1][q.x] === "#" && R.tiles[e][q.x] !== "#");
        const x = b.x;
        R.later.push({ t: 1, act: [["fall", x, e - 1, 1, 1, 1]] });
        P.x = x * T + 3; P.y = (e + 3) * T; P.vy = 0;
        for (let f = 0; f < 200; f++) { t.mesurePerf(1); R.o2 = 1; }
        const toit = R.tiles[e - 1][x];
        for (let f = 0; f < 300; f++) { t.input.right = true; t.mesurePerf(1); R.o2 = 1; }
        t.input.right = false;
        return { x, toit, fin: Math.round(P.x / T) };
      });
      return { ok: r.toit === "#" && r.fin > r.x + 4, detail: `plafond ${r.toit === "#" ? "intact" : "TROUÉ"}, Max de la colonne ${r.x} à ${r.fin}` };
    },
  },
];
module.exports.push({
  nom: "Boss : sa fiche au début du combat, revue après 3 chutes",
  fiches: true,
  async run(page) {
    const r = await page.evaluate(() => {
      const t = __temple, i = t.LEVELS.findIndex((l) => l.id === "aby-20");
      t.progress.tester = true; t.progress.nouveautes = {}; t.progress.intros = { 2: 1 };
      t.playFrom(i);
      for (let k = 0; k < 90; k++) t.mesurePerf(1);
      const fiche = t.game.mode + ":" + (t.game.nv || []).join();
      for (let k = 0; k < 50; k++) t.mesurePerf(1);
      t.pressed.jump = true; t.mesurePerf(1);
      const apres = t.game.mode;
      // trois chutes : la fiche revient
      const revue = [];
      for (let n = 0; n < 3; n++) {
        const R = t.room; R.player.invuln = 0; R.player.shield = 0;
        R.boss.mines.push({ x: R.player.x, y: R.player.y, w: 12, h: 12, vx: 0, vy: 0, t: 0, renvoyee: false });
        for (let k = 0; k < 400 && t.game.mode !== "nouveau" && (n < 2 ? t.room === R : true); k++) t.mesurePerf(1);
        revue.push(t.game.mode);
        if (t.game.mode === "dead" || t.game.mode === "relance") break;
      }
      return { fiche, apres, revue: revue.join(","), morts: t.room.deaths };
    });
    return { ok: r.fiche === "nouveau:boss_pieuvre" && r.apres === "play" && /nouveau/.test(r.revue), detail: JSON.stringify(r) };
  },
});
