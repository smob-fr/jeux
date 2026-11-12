const {chromium}=require('playwright');
const E=require('../src/engine.js');const PZ=require('../data/puzzles.json');
const ok=(c,m)=>{if(!c){console.error('ÉCHEC : '+m);process.exitCode=1;}}; /* une vérification ratée fait échouer le test (code de sortie 1) */
(async()=>{
 const b=await chromium.launch();
 const p=await b.newPage({viewport:{width:390,height:780},hasTouch:true,isMobile:true});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{localStorage.setItem('caroule.v1',JSON.stringify({level:1,max:1,test:true,seen:{},mode:'puzzle',pz:{level:3,max:3,stars:{}}}))});
 await p.goto('file://'+require('path').resolve(__dirname,'../dist/index.html')+'');await p.waitForTimeout(500);
 await p.tap('#home-pz');await p.waitForTimeout(400); // quitte l'accueil
 const L=PZ[2];const cars=L.cars.map(c=>({h:!!c[0],fixed:c[1],len:c[3]}));
 const r=E.pzSolve(cars,L.cars.map(c=>c[2]),2e6);const s=r.path[0];
 const box=await p.evaluate(j=>{const n=document.querySelectorAll('.pcar')[j].getBoundingClientRect();return {x:n.x+n.width/2,y:n.y+n.height/2,cell:document.getElementById('board').getBoundingClientRect().width/6}},s.car);
 const d=(s.to-L.cars[s.car][2])*box.cell,h=cars[s.car].h;
 const cdp=await p.context().newCDPSession(p);
 const t=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
 await t('touchStart',box.x,box.y);
 for(let i=1;i<=8;i++){await t('touchMove',box.x+(h?d*i/8:0),box.y+(h?0:d*i/8));await p.waitForTimeout(16);}
 await t('touchEnd');await p.waitForTimeout(300);
 const mv=await p.textContent('#pz-n');console.log('moves',mv,errs);ok(mv.trim()==='1','un glissement au doigt doit compter 1 coup');ok(!errs.length,'erreurs : '+errs);
 await b.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
