/* Branchement sur le kit commun : bannière seulement sur l'accueil et la carte, boutique (achat simulé de 👍
   et de « Sans pub »), vidéo récompensée passant par Kit.Ads avec l'écran de pub de Ça Roule. */
const { chromium } = require('playwright');
const ok = (c, m) => { if (!c) { console.error('ÉCHEC : ' + m); process.exitCode = 1; } };
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  /* sauvegarde de départ, seulement au premier chargement (le navigateur est neuf) : le rechargement final garde les achats */
  await p.addInitScript(() => { if (!localStorage.getItem('caroule.v1')) localStorage.setItem('caroule.v1', JSON.stringify({ crv: 1, level: 1, max: 1, test: true, seen: {}, mode: 'run', boost: { n: 3, row: 0, got: {} } })); });
  /* servi en HTTP : en file://, le stockage local n'est pas garanti d'un chargement à l'autre */
  const fs = require('fs'), page = fs.readFileSync(require('path').resolve(__dirname, '../dist/index.html'));
  const srv = require('http').createServer((q, r) => { r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); r.end(page); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  await p.goto('http://127.0.0.1:' + srv.address().port + '/'); await p.waitForTimeout(600);
  const banniere = () => p.evaluate(() => document.body.classList.contains('kit-banniere-simulee'));
  const save = () => p.evaluate(() => JSON.parse(localStorage.getItem('caroule.v1')));

  ok(await p.evaluate(() => !!window.Kit && window.Kit.config().id === 'caroule'), 'kit absent ou mal configuré');
  ok(await banniere(), 'bannière attendue sur l\'accueil'); console.log('accueil : bannière', await banniere());
  ok(await p.evaluate(() => !document.getElementById('banner')), 'l\'ancienne bannière du plateau doit avoir disparu');
  await p.tap('#home-run'); await p.waitForTimeout(500);
  ok(await banniere(), 'bannière attendue sur la carte'); console.log('carte : bannière', await banniere());
  await p.tap('.cnode[data-n="1"]', { force: true }); await p.waitForTimeout(500);
  ok(!(await banniere()), 'jamais de bannière pendant le jeu'); console.log('partie : bannière', await banniere());

  /* boutique depuis la pause */
  await p.tap('#btn-menu'); await p.tap('#pause-shop'); await p.waitForTimeout(300);
  const cartes = await p.$$eval('#shop-list .kit-carte-produit h3', h => h.map(x => x.textContent));
  const prix = await p.$$eval('#shop-list .kit-acheter', h => h.map(x => x.textContent.trim()));
  console.log('boutique :', cartes.join(', '), '|', prix.join(', '));
  ok(cartes.length === 4 && prix.includes('3,99 €') && prix.includes('0,99 €'), 'catalogue de jeu.json attendu');
  await p.tap('[data-buy="caroule_pouces_s"]'); await p.tap('.kit-pub [data-r="ok"]');
  await p.waitForSelector('#kit-fenetre.open'); await p.tap('#kit-fenetre-boite [data-act="close"]'); await p.waitForTimeout(400);
  ok((await save()).boost.n === 13, '3 + 10 coups de pouce attendus'); console.log('après le lot : 👍', (await save()).boost.n);
  await p.tap('[data-buy="caroule_decouverte"]'); await p.tap('.kit-pub [data-r="ok"]');
  await p.waitForSelector('#kit-fenetre.open'); await p.tap('#kit-fenetre-boite [data-act="close"]'); await p.waitForTimeout(400);
  const s2 = await save();
  ok(s2.boost.n === 43 && s2.inv.fuel === 2 && s2.inv.reverse === 2 && s2.bought.caroule_decouverte, 'pack découverte mal accordé');
  ok(!(await p.$('[data-buy="caroule_decouverte"]')), 'une offre unique achetée ne doit plus être proposée');
  await p.tap('[data-buy="caroule_noads"]'); await p.tap('.kit-pub [data-r="ok"]');
  await p.waitForSelector('#kit-fenetre.open'); await p.tap('#kit-fenetre-boite [data-act="close"]'); await p.waitForTimeout(400);
  ok((await save()).noAds === true, '« Sans pub » non enregistré');
  await p.tap('#shop-close');

  /* vidéo récompensée (garage : +2 👍) : écran #ad de Ça Roule, piloté par le kit */
  await p.tap('#btn-menu'); await p.tap('#pause-garage'); await p.tap('#garage-boost'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => !document.getElementById('ad').hidden), 'écran de vidéo attendu');
  await p.waitForSelector('#ad-close.primary', { timeout: 8000 }); await p.tap('#ad-close'); await p.waitForTimeout(300);
  ok((await save()).boost.n === 45, 'vidéo vue : +2 👍 attendus'); console.log('après la vidéo : 👍', (await save()).boost.n);
  await p.tap('#garage-close');

  /* « Sans pub » : plus de bannière sur l'accueil, même après rechargement */
  await p.reload(); await p.waitForTimeout(600);
  ok(!(await banniere()), 'plus de bannière après « Sans pub »'); console.log('accueil après « Sans pub » : bannière', await banniere());
  console.log(errs); ok(!errs.length, 'erreurs : ' + errs);
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exitCode = 1; });
