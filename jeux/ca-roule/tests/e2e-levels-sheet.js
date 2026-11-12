/* Fenêtre « Niveaux » (Casse-tête) et carte des villes (Course) : ouverture, choix d'un niveau, fermeture. */
const {chromium}=require('playwright');
const ok=(c,m)=>{if(!c){console.error('ÉCHEC : '+m);process.exitCode=1;}}; /* une vérification ratée fait échouer le test (code de sortie 1) */
(async()=>{
 const b=await chromium.launch();
 const p=await b.newPage({viewport:{width:390,height:780},hasTouch:true});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../dist/index.html')+'');await p.waitForTimeout(500);
 await p.tap('#home-pz');await p.waitForTimeout(400); // quitte l'accueil
 const vis=()=>p.evaluate(()=>!document.getElementById('levels').hidden);
 const map=()=>p.evaluate(()=>!document.getElementById('cmap').hidden);
 await p.tap('#btn-levels');const v1=await vis();console.log('1',v1);ok(v1,'fenêtre Niveaux non ouverte');
 await p.tap('#tab-pz');await p.waitForTimeout(100);
 console.log('pz grid kids',await p.evaluate(()=>document.getElementById('pz-grid').children.length));
 await p.tap('#pz-grid .lv:nth-child(1)');await p.waitForTimeout(400);
 const v2=!(await vis());console.log('2 closed',v2);ok(v2,'fenêtre non fermée après choix');
 await p.tap('#btn-levels');console.log('3',await vis());
 await p.tap('#levels-close');await p.tap('#btn-restart');await p.tap('#btn-levels');console.log('4',await vis());
 const v4=await vis();ok(v4,'fenêtre Niveaux non rouverte');await p.tap('#tab-run');await p.tap('#level-grid .lv:nth-child(1)');await p.waitForTimeout(300);
 await p.tap('#btn-levels');await p.waitForTimeout(300);const m5=await map(),f5=!(await vis());console.log('5 carte',m5,'fenêtre fermée',f5);ok(m5&&f5,'la carte des villes devrait remplacer la fenêtre');
 await p.tap('.cnode[data-n="1"]',{force:true});await p.waitForTimeout(300);const l6=!(await map());console.log('6 niveau lancé',l6);ok(l6,'niveau non lancé depuis la carte');
 console.log(errs);ok(!errs.length,'erreurs : '+errs);await b.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
