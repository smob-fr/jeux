// Branchement sur le kit commun (window.Kit) : bannière seulement sur les menus hors partie (pas l'accueil),
// boutique (offres de jeu.json, achat simulé, « Sans pub », offre unique), vidéo récompensée,
// interstitielle à la fin d'un niveau selon les règles communes.
"use strict";

const banniere = (page) => page.evaluate(() => document.body.classList.contains("kit-banniere-simulee"));
const progres = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("temple-progres") || "{}"));
const visible = (page, id) => page.evaluate((i) => !document.getElementById(i).hidden, id);

module.exports = [
  {
    nom: "Kit : bannière sur les menus, jamais en partie ni en pause",
    async run(page) {
      const v = [];
      v.push(["kit configuré", await page.evaluate(() => window.Kit && Kit.config().id === "maxjade")]);
      v.push(["pas de bannière sur l'accueil (boutons dessinés sur l'illustration)", !(await banniere(page))]);
      await page.click("#btn-options"); v.push(["bannière dans les options", await banniere(page)]);
      await page.evaluate(() => { __temple.progress.tester = true; __temple.playFrom(0); });
      await page.waitForTimeout(300);
      const enJeu = await banniere(page);
      v.push(["pas de bannière en partie", !enJeu]);
      await page.keyboard.press("Escape"); await page.waitForTimeout(100);
      const pause = await visible(page, "ecran-pause");
      v.push(["pause ouverte", pause], ["pas de bannière en pause", !(await banniere(page))]);
      const rates = v.filter(([, ok]) => !ok).map(([l]) => l);
      return { ok: !rates.length, detail: rates.length ? "ÉCHEC : " + rates.join(", ") : "options : oui ; accueil, partie et pause : non" };
    },
  },
  {
    nom: "Kit : boutique (achat simulé d'amulettes, pack unique, « Sans pub »)",
    async run(page) {
      const v = [];
      await page.click("#btn-options"); await page.click("#ecran-options [data-boutique]");
      const offres = await page.$$eval("#offres-payantes [data-produit]", (b) => b.map((x) => x.textContent.trim()));
      v.push(["4 offres aux prix de la grille", offres.join("|") === "3,99 €|0,99 €|1,99 €|4,99 €"]);
      const avant = (await progres(page)).amulettes || 0;
      await page.click('[data-produit="maxjade_amulettes_10"]');
      v.push(["écran d'achat simulé", await visible(page, "ecran-achat")]);
      await page.click("#btn-achat-ok"); await page.waitForTimeout(100);
      v.push(["+10 amulettes", (await progres(page)).amulettes === avant + 10]);
      await page.click('[data-produit="maxjade_aventurier"]'); await page.click("#btn-achat-ok"); await page.waitForTimeout(100);
      const p = await progres(page);
      v.push(["pack aventurier : +25 et chapeau", p.amulettes === avant + 35 && p.chapeauOr === true && p.bought.maxjade_aventurier === true]);
      v.push(["offre unique retirée", !(await page.$('[data-produit="maxjade_aventurier"]'))]);
      await page.click('[data-produit="maxjade_noads"]'); await page.click("#btn-achat-non"); await page.waitForTimeout(100);
      v.push(["achat annulé : rien", (await progres(page)).noAds === false]);
      await page.click('[data-produit="maxjade_noads"]'); await page.click("#btn-achat-ok"); await page.waitForTimeout(100);
      v.push(["« Sans pub » enregistré", (await progres(page)).noAds === true]);
      v.push(["plus de bannière", !(await banniere(page))]);
      v.push(["bouton « Acheté »", (await page.textContent('[data-produit="maxjade_noads"]')).includes("Acheté")]);
      const rates = v.filter(([, ok]) => !ok).map(([l]) => l);
      return { ok: !rates.length, detail: (rates.length ? "ÉCHEC : " + rates.join(", ") + " — " : "") + "offres " + offres.join(", ") };
    },
  },
  {
    nom: "Kit : vidéo récompensée (+1 amulette) par l'écran de démonstration",
    async run(page) {
      await page.click("#btn-options"); await page.click("#ecran-options [data-boutique]");
      const avant = (await progres(page)).amulettes || 0;
      await page.click("#btn-video-amulette"); await page.click("#btn-pub-lancer");
      await page.waitForFunction(() => !document.getElementById("ecran-boutique").hidden, null, { timeout: 9000 });
      const apres = (await progres(page)).amulettes;
      return { ok: apres === avant + 1, detail: `amulettes ${avant} → ${apres}` };
    },
  },
  {
    nom: "Kit : interstitielle à la fin d'un niveau, seulement selon les règles (niveau 4+, 1 sur 3)",
    async run(page) {
      // fin de niveau simulée : récit affiché, puis « Suite »
      const finir = async (i) => {
        await page.evaluate((n) => { __temple.progress.tester = true; __temple.playFrom(n); __temple.game.mode = "recit"; document.getElementById("ecran-recit").hidden = false; }, i);
        await page.click("#btn-recit-suite");
        await page.waitForTimeout(150);
        const pub = await visible(page, "ecran-pub");
        if (pub) await page.waitForFunction(() => document.getElementById("ecran-pub").hidden, null, { timeout: 9000 });
        return pub;
      };
      const vues = [];
      for (const i of [0, 1, 2, 3, 4, 5, 6, 7]) vues.push(await finir(i));
      // niveaux 1 à 3 : jamais ; à partir du 4 : la 3e partie terminée ; puis 2 minutes de pause
      const attendu = [false, false, false, false, false, true, false, false];
      return { ok: JSON.stringify(vues) === JSON.stringify(attendu), detail: "pubs : " + vues.map((x) => (x ? "oui" : "non")).join(" ") };
    },
  },
];
