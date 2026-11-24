// Un robot bat chacun des 5 boss : il faut que la porte de sortie apparaisse.
// Les robots trichent un peu sur les déplacements (Max est parfois replacé directement),
// mais le combat lui-même suit les vraies règles : coups, ombres, timing.
"use strict";

// Lance le niveau du boss `kind`, fait jouer `robot(t, R, f)` à chaque image, renvoie le résultat.
function combat(page, kind, robot, max = 9000) {
  return page.evaluate(([kind, robotSrc, max]) => {
    const t = __temple, T = 16;
    const robot = new Function("t", "R", "f", "T", "etat", robotSrc);
    const i = t.LEVELS.findIndex((d) => d.boss === kind);
    t.progress.tester = true; t.playFrom(i); t.game.mode = "play"; t.game.cardT = 99;
    const etat = {}, coups = [];
    let morts = 0, msg = "", f;
    for (f = 0; f < max; f++) {
      if (t.game.mode === "dead") { morts++; msg = t.room.say ? t.room.say.text : ""; while (t.game.mode === "dead") t.mesurePerf(1); continue; }
      const R = t.room;
      if (!R.door.hidden) break;
      Object.assign(t.input, { left: false, right: false, jump: false, fire: false });
      robot(t, R, f, T, etat);
      // boss assommé : son fragment de l'Œil flotte devant la porte, on va le chercher
      const fr = R.fragment;
      if (fr && !fr.pris && fr.t > 45) { const P = R.player; P.x = fr.x - P.w / 2; P.y = fr.y - P.h / 2; P.vy = 0; P.vine = null; }
      const h = R.boss.hits;
      t.mesurePerf(1);
      if (t.room.boss && t.room.boss.hits > h) coups.push(f);
    }
    return { porte: !t.room.door.hidden, images: f, coups, morts, msg, fragments: t.progress.fragments || 0 };
  }, [kind, robot.toString().replace(/^[^{]*{|}$/g, ""), max]);
}
const verdict = (r, mortsMax = 0) => ({
  ok: r.porte && r.morts <= mortsMax,
  detail: `${r.porte ? "porte ouverte" : "porte FERMÉE"} en ${r.images} images, fragments ${r.fragments.toString(2)}, coups ${r.coups.join("/") || "aucun"}, ${r.morts} mort(s)${r.morts ? " (« " + r.msg + " »)" : ""}`,
});

module.exports = [
  {
    nom: "Boss 1 — le Jaguar de pierre",
    async run(page) {
      return verdict(await combat(page, "jaguar", function (t, R, f, T, etat) {
        const P = R.player, B = R.boss;
        // quand il est sonné : sauter sur son dos ; quand il gratte et charge : rester perché au-dessus
        if (B.etat === "sonne" && !B.touche) { if (!etat.place) { P.x = B.x + B.w / 2 - 5; P.y = B.y - 40; P.vy = 0; P.vine = null; etat.place = true; } }
        else etat.place = false;
        if (B.etat === "gratte" || B.etat === "charge") { P.invuln = 0; P.x = 11 * T - 5; P.y = 9 * T; P.vy = 0; P.vine = null; }
        R.rocks.forEach((r) => (r.done = true));
      }, 4000));
    },
  },
  {
    nom: "Boss 2 — le Yéti grognon",
    async run(page) {
      return verdict(await combat(page, "yeti", function (t, R, f, T) {
        const P = R.player, B = R.boss;
        // se placer de l'autre côté de la prochaine grosse stalactite, sauter quand il retombe
        const gl = R.glacons.find((g) => g.etat === "pend");
        if (gl && B.etat !== "dort") {
          const gx = gl.x + gl.w / 2, cible = gx + (B.x + B.w / 2 > gx ? -1 : 1) * 52, cx = P.x + P.w / 2;
          if (Math.abs(cx - cible) > 4 && B.etat !== "saute" && B.etat !== "prepare") t.input[cx < cible ? "right" : "left"] = true;
          if (B.etat === "saute" && B.vy > 1.5 && P.grounded) { t.pressed.jump = true; t.input.jump = true; }
          if (!P.grounded && P.vy < 0) t.input.jump = true;
        }
        R.rocks.forEach((r) => (r.done = true)); R.boules.length = 0;
      }));
    },
  },
  {
    nom: "Boss 3 — la pieuvre géante (renvoyer ses mines)",
    async run(page) {
      return verdict(await combat(page, "pieuvre", function (t, R, f, T, etat) {
        const P = R.player, B = R.boss, tt = B.tent, inp = t.input;
        R.o2 = 1;   // le robot ne remonte pas respirer
        // s'écarter de l'ombre d'une tentacule
        if (tt && (tt.etat === "vise" || tt.etat === "frappe") && Math.abs(P.x + P.w / 2 - tt.x) < 30) { P.x = tt.x + (tt.x > 8 * T ? -44 : 30); P.vy = 0; return; }
        // attendre la mine à gauche de sa trajectoire, face à la pieuvre, et la renvoyer d'un coup
        const m = B.mines.find((q) => !q.renvoyee);
        if (!m) return;
        if (m.x < P.x + P.w + 30 && m.x > P.x) { P.face = 1; if (P.club <= 0) { inp.fire = true; t.pressed.fire = true; } }
        else if (m.x - P.x > 60) { P.x += Math.min(1.2, (m.x - 40) - P.x > 0 ? 1.2 : 0); P.y += Math.sign(m.y - P.y) * 0.8; P.vy = 0; P.face = 1; }
        else if (m.x <= P.x) { P.x = m.x - 26; P.y = m.y - 2; P.vy = 0; P.face = 1; }
      }));
    },
  },
  {
    nom: "Boss 4 — l'Oiseau-tonnerre",
    async run(page) {
      return verdict(await combat(page, "oiseau", function (t, R, f, T, etat) {
        const P = R.player, B = R.boss;
        etat.pos = etat.pos || 0; etat.att = etat.att || 0;
        // attendre à côté d'une cloche, s'écarter si l'ombre d'un éclair vise Max, sonner quand l'oiseau passe
        const c = B.cloches[B.hits % 3], gx = c.x + 6;
        const danger = R.foudres.find((q) => (q.warn || q.on) && Math.abs(q.x * T + 8 - (P.x + P.w / 2)) < 14);
        if (danger && etat.att <= 0) { etat.pos = etat.pos ? 0 : 1; etat.att = 60; }
        if (etat.att > 0) etat.att--;
        const tx = etat.pos ? gx + 10 : gx - 18;
        if (Math.abs(P.x - tx) > 2 && P.grounded) P.x += Math.sign(tx - P.x) * Math.min(1.8, Math.abs(tx - P.x));
        if (f === 0 || P.y > c.y + 2 * T || etat.cloche !== B.hits) { P.x = tx; P.y = c.y + T - P.h - 0.5; P.vy = 0; etat.cloche = B.hits; }
        P.face = etat.pos ? -1 : 1;
        if (B.etat === "vole" && !danger && Math.hypot(B.x + B.w / 2 - gx, B.y + B.h / 2 - (c.y + 6)) < 50) t.pressed.fire = true;
      }));
    },
  },
  {
    nom: "Boss 5 — combat final en 3 manches : Fouisseur, poursuite, duel contre Archibald",
    async run(page) {
      const r = await page.evaluate(() => {
        const t = __temple, T = 16;
        t.progress.tester = true; t.playFrom(t.LEVELS.length - 1); t.game.mode = "play"; t.game.cardT = 99;
        let morts = 0, msg = "", f = 0;
        const manches = [];
        const mort = () => { if (t.game.mode === "dead") { morts++; msg = t.room.say ? t.room.say.text : ""; while (t.game.mode === "dead") t.mesurePerf(1); return true; } return false; };
        // ---- manche 1 : TNT dans les cheminées quand le couvercle est ouvert
        for (; f < 9000 && (t.game.manche || 0) === 0; f++) {
          if (mort()) continue;
          if (t.game.mode === "card") { t.mesurePerf(1); continue; }
          const R = t.room, P = R.player, B = R.boss;
          Object.assign(t.input, { left: false, right: false, jump: false, fire: false });
          if (B.etat === "combat") {
            const c = B.chem.find((q) => !q.bouchee);
            const rocher = R.grelons.find((q) => Math.abs(q.x + 3 - (P.x + P.w / 2)) < 14);
            if (t.game.ammo.tnt <= 0 && !R.dynamites.some((d) => !d.dans)) {
              const it = R.pickups.find((q) => q.kind === "tnt" && !q.taken);
              if (it) { P.x = it.x - 1; P.y = 14 * T + 1; P.vy = 0; } else if (P.y < 12 * T) { P.x = 15 * T; P.y = 14 * T + 1; P.vy = 0; }
            } else if (c && c.ouvert && !R.dynamites.some((d) => !d.dans) && !rocher) {
              const surC = Math.abs(P.x + P.w / 2 - (c.x + 8)) < 6 && P.y + P.h <= c.y + 1;
              if (!surC) { P.x = c.x + 3; P.y = c.y - P.h - 0.5; P.vy = 0; } else t.pressed.tnt = true;
            } else if (c) { P.x = c.x + (c === B.chem[2] ? -24 : 26); P.y = 9 * T - P.h - 0.5; P.vy = 0; }
          }
          // esquiver les pierres en fusion (leur ombre les annonce)
          const pierre = R.grelons.find((q) => Math.abs(q.x + 3 - (P.x + P.w / 2)) < 14 && (q.warn > 0 || q.y < P.y));
          if (pierre) P.x += pierre.x > P.x ? -20 : 20;
          t.mesurePerf(1);
        }
        manches.push(f);
        // ---- manche 2 : la poursuite (le robot monte d'une case par seconde jusqu'à la porte)
        for (let k = 0; k < 600 && t.game.mode !== "play"; k++) t.mesurePerf(1);
        const R2 = t.room, lave = !!(R2.flood && R2.flood.kind === "lave"), foreuse = !!R2.def.poursuite;
        const d = R2.door; R2.player.x = d.x + 1; R2.player.y = d.y + 6; R2.player.vy = 0;
        for (let k = 0; k < 30 && (t.game.manche || 0) === 1; k++) t.mesurePerf(1);
        manches.push(f);
        // ---- manche 3 : le duel (le robot esquive en se replaçant, puis saute sur la cabine posée)
        for (let k = 0; k < 600 && t.game.mode !== "play"; k++) t.mesurePerf(1);
        let g = 0, porte = false;
        for (; g < 9000; g++) {
          if (mort()) continue;
          const R = t.room;
          if (!R || !R.boss || R.boss.kind !== "archibald" || t.game.mode === "win" || !R.door.hidden) { porte = porte || !!(R && R.door && !R.door.hidden) || t.game.mode === "win"; break; }
          const P = R.player, B = R.boss;
          if (B.oeil && !B.oeil.pris && B.oeil.t > 60) { P.x = B.oeil.x - 5; P.y = B.oeil.y - 7; P.vy = 0; }
          else if (B.etat === "surchauffe") { if (!B.robotPose) { B.robotPose = true; P.x = B.x + B.w / 2 - 5; P.y = B.y - P.h - 20; P.vy = 0; } }
          else if (B.etat !== "vaincu") {
            B.robotPose = false;
            // à l'abri : le robot triche, il se replace à un endroit sans danger (plates-formes ou sol)
            const sur = (x) => !B.proj.some((q) => ((q.type === "glacon" || q.type === "eclair") && Math.abs((q.type === "eclair" ? q.x * T + 8 : q.x + 4) - (x + 5)) < 24)
              || (q.type === "rocher" && Math.abs(q.x - (x + 5)) < 48) || (q.type === "mine" && Math.abs(q.x - x) < 48));
            if (!sur(P.x)) {
              const place = [[8, 10], [34, 10], [16, 15], [22, 15], [28, 15], [4, 15], [40, 15]].find(([x]) => sur(x * T));
              if (place) { P.x = place[0] * T; P.y = place[1] * T - P.h - 0.5; P.vy = 0; }
            }
          }
          t.mesurePerf(1);
        }
        return { manches, duel: g, porte, morts, msg, lave, foreuse, fragments: t.progress.fragments || 0, oeil: ((t.progress.fragments || 0) & 16) > 0 };
      });
      return { ok: r.porte && r.morts === 0 && r.lave && r.foreuse && r.oeil, detail: JSON.stringify(r) };
    },
  },
];
