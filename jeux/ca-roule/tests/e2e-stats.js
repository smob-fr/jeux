/* Statistiques anonymes (Kit.Stats, PostHog) : on joue le niveau 1 de la Course et on vérifie les événements
   envoyés. Les requêtes vers PostHog sont interceptées par le test : rien ne part vraiment. */
const { chromium } = require('playwright');
const E = require('../src/engine.js');
const LV = require('../data/course.json');
const ok = (c, m) => { console.log((c ? '✓ ' : 'ÉCHEC : ') + m); if (!c) process.exitCode = 1; };
const toL = l => ({ W: l.W, H: l.H, gates: l.gates.map(([side, at, color]) => ({ side, at, color })), bars: (l.bars || []).map(([side, at]) => ({ side, at })), buttons: (l.buttons || []).map(([x, y, bar]) => ({ x, y, bar })), cars: l.cars.map(([h, line, pos, len, dir, color]) => ({ h: !!h, line, pos, len, dir, color })) });
const solution = n => { const L = toL(LV[n - 1]), A = E.crAnalyse(L); let s = 0; const seq = []; while (A.win[s] > 0) { const [i, t] = A.E[s].find(([, t]) => A.win[t] === A.win[s] - 1); seq.push(i); s = t; } return seq; };
(async () => {
  const fs = require('fs'), page = fs.readFileSync(require('path').resolve(__dirname, '../dist/index.html'));
  const srv = require('http').createServer((q, r) => { r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); r.end(page); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const envois = [];
  await p.route('https://eu.i.posthog.com/**', async r => { envois.push(JSON.parse(r.request().postData())); await r.fulfill({ status: 200, body: '{}' }); });
  await p.addInitScript(() => { window.KIT_STATS_TEST = true; });
  await p.goto('http://127.0.0.1:' + srv.address().port + '/'); await p.waitForTimeout(500);
  await p.tap('#home-run'); await p.waitForTimeout(500);
  await p.tap('.cnode[data-n="1"]', { force: true }); await p.waitForTimeout(400);
  for (const i of solution(1)) { await p.tap('.car[data-id="' + i + '"]'); await p.waitForTimeout(420); }
  await p.waitForTimeout(900);
  await p.evaluate(() => Kit.Stats.flush()); await p.waitForTimeout(300);
  const ev = envois.flatMap(e => e.batch);
  const noms = ev.map(e => e.event);
  console.log('événements :', noms.join(', '));
  ok(envois.length > 0 && envois.every(e => /^phc_/.test(e.api_key)), 'envoi groupé vers PostHog (UE) avec la clé de jeu.json');
  ok(noms.includes('session_start') && noms.includes('level_start') && noms.includes('level_win'), 'session_start, level_start et level_win envoyés');
  const w = ev.find(e => e.event === 'level_win');
  ok(w && w.properties.jeu === 'caroule' && w.properties.level === 1 && w.properties.mode === 'run' && w.properties.ms > 0 && 'bumps' in w.properties && w.properties.$process_person_profile === false,
    'level_win : jeu, mode, niveau, durée et compteurs (mêmes propriétés qu\'avant le kit)');
  ok(new Set(ev.map(e => e.properties.distinct_id)).size === 1 && /^u/.test(ev[0].properties.distinct_id), 'un seul identifiant anonyme');
  /* le joueur coupe les statistiques dans la pause : plus rien ne part */
  await p.tap('#win-next'); await p.waitForTimeout(500);
  await p.tap('#btn-menu'); await p.tap('#stats-switch'); await p.tap('#pause-resume');
  const avant = envois.length;
  await p.evaluate(() => { Kit.Stats.track('essai'); Kit.Stats.flush(); }); await p.waitForTimeout(300);
  const fin = envois.slice(avant).flatMap(e => e.batch).map(e => e.event);
  ok(!fin.includes('essai') && (await p.evaluate(() => JSON.parse(localStorage.getItem('caroule.v1')).stats)) === false, 'statistiques coupées : plus aucun envoi');
  ok(!errs.length, 'aucune erreur dans la page' + (errs.length ? ' : ' + errs : ''));
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exitCode = 1; });
