// Requires a local Firestore emulator. No production project is used.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,updateDoc,runTransaction,setLogLevel}=require('firebase/firestore');
setLogLevel('silent');
const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
function extract(name){const m=new RegExp('^(?:async )?function '+name+'\\(','m').exec(source),nl=source.indexOf('\n',m.index);return source.slice(m.index,source.slice(m.index,nl).endsWith('}')?nl:source.indexOf('\n}',nl)+2)}
const c=vm.createContext({JSON,Map,Set,Number,String,Object,Array,Math,Date,Error,normalizeIdentityText:s=>String(s||'').trim().toUpperCase()});
vm.runInContext(['recoveryReagentKey','sameReagentContainer','buildStockSettlement','buildStockRowSettlement'].map(extract).join('\n'),c);
(async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-erp-validation',firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync(path.join(__dirname,'../firestore.rules'),'utf8')}});
 const tests=[],passed=label=>tests.push(label),stamp='2026-10-15T22:00:00.000Z';
 const boss=env.authenticatedContext('boss').firestore(),analyst=env.authenticatedContext('analyst').firestore(),analystB=env.authenticatedContext('analystB').firestore();
 const reagent={id:'R',name:'TNT874',lot:'26015',mode:'COUNT',unit:'unidad',stockQuantity:99};
 const catalogs=[1,2,3].map(n=>({id:'C'+n,reagentConfig:[{...reagent,id:'R'+n}]}));
 function plan(id,used=4){const item={reagentId:'R',name:'TNT874',lot:'26015',mode:'COUNT',unit:'unidad',stockBefore:99,stockRemaining:99-used,used,usedInActivity:true,notUsed:false};
 return {id,analystId:id==='B'?'B':'A',status:'EN PROCESO',reagentResult:{completed:true,items:[item],schemaVersion:2,inventoryCommittedAt:null,stockRequest:{id:'STOCK-'+id,planId:id,requestedByUID:id==='B'?'analystB':'analyst',state:'PENDING',signature:JSON.stringify([item]),rows:[item],baseResult:null,createdAt:'2026-10-15T21:00:00.000Z'}}}}
 try{
 await env.clearFirestore();await env.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore();
  await setDoc(doc(db,'users','boss'),{status:'ACTIVO',role:'JEFE'});await setDoc(doc(db,'users','analystB'),{status:'ACTIVO',role:'ANALISTA',analystId:'B'});await setDoc(doc(db,'users','analyst'),{status:'ACTIVO',role:'ANALISTA',analystId:'A'});
  for(const cat of catalogs)await setDoc(doc(db,'catalog',cat.id),cat);
  for(const id of ['A','B','OTHER','FORGE','LEGACY'])await setDoc(doc(db,'planning',id),{id,analystId:['OTHER','B'].includes(id)?'B':'A',status:'EN PROCESO',reagentResult:null});
 });
 await assertSucceeds(getDoc(doc(boss,'users','boss')));await assertSucceeds(updateDoc(doc(boss,'catalog','C1'),{testMarker:true}));
 await assertFails(updateDoc(doc(analyst,'catalog','C1'),{name:'Forbidden'}));passed('Servidor rechaza edición administrativa de catálogo por ANALISTA');
 await assertFails(updateDoc(doc(analyst,'planning','A'),{analystId:'B'}));passed('Analista no puede reasignar su actividad a otra persona');
 await assertFails(updateDoc(doc(analyst,'planning','OTHER'),{note:'Forbidden'}));passed('Servidor rechaza cambios de otro analista');
 await assertFails(updateDoc(doc(analyst,'planning','LEGACY'),{reagentResult:{completed:true,items:[{used:4}],inventoryCommittedAt:stamp}}));passed('Un cliente anterior no puede inventar una confirmación de inventario');
 await assertSucceeds(setDoc(doc(analyst,'planning','A'),plan('A',4)));await assertSucceeds(setDoc(doc(analystB,'planning','B'),plan('B',3)));passed('Servidor acepta solicitudes pendientes del analista asignado');
 const forged=plan('FORGE');forged.reagentResult.stockRequest.state='APPLIED';forged.reagentResult.inventoryCommittedAt=stamp;
 await assertFails(setDoc(doc(analyst,'planning','FORGE'),forged));passed('Analista no puede marcar APPLIED sin constancia atómica');
 await assertFails(setDoc(doc(boss,'planning','FORGE'),forged));passed('JEFE tampoco puede confirmar schema 2 sin constancia atómica');
 const premature={...plan('A'),status:'REALIZADO',completionCommittedAt:stamp,actualFinishedAt:stamp};
 await assertFails(setDoc(doc(analyst,'planning','A'),premature));passed('Servidor rechaza cierre con inventario pendiente y sin avisos');
 async function settle(id){const own=id==='B'?analystB:analyst;return runTransaction(own,async tx=>{
  const ref=doc(own,'planning',id),p=(await tx.get(ref)).data();if(p.reagentResult.stockRequest.state==='APPLIED')return;const receiptRef=doc(own,'stockReceipts',p.reagentResult.stockRequest.id),receipt=await tx.get(receiptRef);
  if(receipt.exists())return;
  const cats=[];for(const cat of catalogs)cats.push((await tx.get(doc(own,'catalog',cat.id))).data());
  const w=c.buildStockRowSettlement(p,cats,'Analista',stamp,id==='B'?'analystB':'analyst');
  // Strip VM prototypes through JSON as the browser SDK receives ordinary values.
  const clean=x=>JSON.parse(JSON.stringify(x));
  w.receipt.actorUID=id==='B'?'analystB':'analyst';w.receipt.result=w.plan.reagentResult;
  tx.set(ref,clean(w.plan));tx.set(doc(own,'stockReceipts',w.receipt.id),clean(w.receipt));for(const cat of w.catalogs)tx.set(doc(own,'catalog',cat.id),clean(cat));
 })}
 const concurrent=await Promise.allSettled([settle('A'),settle('B')]);
 assert.ok(concurrent.some(x=>x.status==='fulfilled'));
 // The catalogue revision rule may reject an optimistic collision before SDK
 // retry. A subsequent worker pass reads the current revision and safely retries.
 await settle('A');await settle('B');
 for(const cat of catalogs)assert.equal((await getDoc(doc(boss,'catalog',cat.id))).data().reagentConfig[0].stockQuantity,92);
 passed('Dos usuarios ANALISTA confirman 4 + 3 sin JEFE y mantienen saldo 92 en tres fichas');
 await Promise.all([settle('A'),settle('A')]);assert.equal((await getDoc(doc(boss,'catalog','C1'))).data().reagentConfig[0].stockQuantity,92);passed('Repetir el mismo movimiento en el emulador no descuenta otra vez');
 const applied=(await getDoc(doc(analyst,'planning','A'))).data();const closed={...applied,status:'REALIZADO',actualFinishedAt:stamp,completionCommittedAt:stamp,completionOperationId:'FINAL-A'};
 await assertFails(setDoc(doc(analyst,'planning','A'),closed));passed('Incluso con saldo confirmado, cierre sin avisos se rechaza');
 await assertSucceeds(runTransaction(analyst,async tx=>{
  await tx.get(doc(analyst,'planning','A'));
  tx.set(doc(analyst,'planComments','AUTO-FINAL-A'),{id:'AUTO-FINAL-A',planId:'A',lifecycleStage:'FINALIZACION',closureEvidence:{finishedAt:stamp}});
  tx.set(doc(analyst,'planComments','AUTO-TECNICA-FINAL-A'),{id:'AUTO-TECNICA-FINAL-A',planId:'A'});
  tx.set(doc(analyst,'planning','A'),closed);
 }));passed('Cierre y dos avisos se aceptan juntos con el inventario confirmado');
 await assertFails(setDoc(doc(analyst,'planning','A'),applied));passed('Una copia abierta antigua no puede reabrir el cierre');
 await assertFails(setDoc(doc(boss,'catalog','C1'),catalogs[0]));passed('Una versión vieja de catálogo sin revisión no puede sobrescribir el inventario protegido');
 await assertFails(updateDoc(doc(analyst,'planComments','AUTO-FINAL-A'),{planId:'OTHER'}));passed('Analista no puede sobrescribir un aviso ya confirmado');
 // Full configured-size boundary: ten reagents, mixed count and weight, three aliases.
 const manyItems=Array.from({length:9},(_,i)=>({reagentId:'R'+i,name:'COUNT'+i,lot:'L',mode:'COUNT',unit:'unidad',stockBefore:99,stockRemaining:98,used:1,usedInActivity:true,notUsed:false}));
 manyItems.push({reagentId:'W',name:'WEIGHT',lot:'WL',mode:'WEIGHT',unit:'g',used:30,usedInActivity:true,notUsed:false,containers:[
  {containerId:'E1',label:'Frasco 1',containerType:'FRASCO',initialWeight:100,finalWeight:90,used:10,depleted:false},
  {containerId:'E2',label:'Frasco 2',containerType:'FRASCO',initialWeight:200,finalWeight:180,used:20,depleted:false}]});
 const manyCats=[1,2,3].map(i=>({id:'MANY'+i,reagentConfig:manyItems.map(r=>r.mode==='COUNT'?{id:r.reagentId,name:r.name,lot:r.lot,mode:r.mode,unit:r.unit,stockQuantity:99}:{id:'W',name:'WEIGHT',lot:'WL',mode:'WEIGHT',unit:'g',containers:[{id:'E1',label:'Frasco 1',initialWeight:100},{id:'E2',label:'Frasco 2',initialWeight:200}]})}));
 const many={...plan('MANY'),reagentResult:{completed:true,items:manyItems,schemaVersion:2,inventoryCommittedAt:null,stockRequest:{id:'STOCK-MANY',planId:'MANY',requestedByUID:'analyst',state:'PENDING',signature:JSON.stringify(manyItems),rows:manyItems,baseResult:null,createdAt:'2026-10-15T21:00:00.000Z'}}};
 await env.withSecurityRulesDisabled(async ctx=>{for(const cat of manyCats)await setDoc(doc(ctx.firestore(),'catalog',cat.id),cat);await setDoc(doc(ctx.firestore(),'planning','MANY'),{id:'MANY',analystId:'A',status:'EN PROCESO',reagentResult:null})});
 await setDoc(doc(analyst,'planning','MANY'),many);
 async function applyMany(actor,mutate){return runTransaction(actor,async tx=>{
  const p=(await tx.get(doc(actor,'planning','MANY'))).data(),cats=[];
  for(const cat of manyCats)cats.push((await tx.get(doc(actor,'catalog',cat.id))).data());
  const w=c.buildStockRowSettlement(p,cats,'Analista',stamp,actor===analyst?'analyst':'analystB');w.receipt.actorUID=actor===analyst?'analyst':'analystB';w.receipt.result=w.plan.reagentResult;
  if(mutate)mutate(w);
  const clean=x=>JSON.parse(JSON.stringify(x));tx.set(doc(actor,'planning','MANY'),clean(w.plan));tx.set(doc(actor,'stockReceipts',w.receipt.id),clean(w.receipt));
  for(const cat of w.catalogs)tx.set(doc(actor,'catalog',cat.id),clean(cat));
 })}
 await assertFails(applyMany(analystB));passed('Un segundo analista no puede consumir para la actividad del primero');
 await assertFails(applyMany(analyst,w=>{w.catalogs[0].reagentConfig[0].name='MODIFICADO'}));passed('El permiso de consumo no permite editar nombres ni lotes');
 await assertFails(applyMany(analyst,w=>{w.catalogs[0].reagentConfig[0].stockQuantity=1000}));passed('El permiso de consumo no permite aumentar stock ni inventar saldos');
 await assertFails(applyMany(analyst,w=>{w.catalogs[0].reagentConfig[9].containers[0].initialWeight=99}));passed('El peso final debe coincidir con la medición solicitada');
 for(let i=0;i<10;i++)await assertSucceeds(applyMany(analyst));
 const mixed=(await getDoc(doc(analyst,'catalog','MANY1'))).data();assert.equal(mixed.reagentConfig[0].stockQuantity,98);assert.equal(mixed.reagentConfig[9].containers[0].initialWeight,90);assert.equal(mixed.reagentConfig[9].containers[1].initialWeight,180);
 passed('Diez reactivos con pesos en dos envases y tres fichas se confirman por ANALISTA dentro del límite de reglas');
 await assertFails(updateDoc(doc(analyst,'stockReceipts','STOCK-MANY-0'),{actorUID:'boss'}));passed('La constancia de consumo es inmutable después de confirmar');
 // End-to-end application functions with two independent local databases.
 const makeSession=require('./app-session.cjs');
 const flowCats=[1,2,3].map(i=>({id:'FLOW-C'+i,reagentConfig:[{...reagent,id:'R'+i}]}));
 const flowPlans=['A','B'].map(id=>({id:'FLOW-'+id,analystId:id,analystName:'Analista '+id,catalogName:'Recepción',catalogId:'FLOW-C1',date:'2026-10-15',section:'RECEPCION_MUESTRAS',status:'PROGRAMADO',actualSamples:null,sampleParameterCounts:{},reagentResult:null}));
 await env.withSecurityRulesDisabled(async ctx=>{for(const cat of flowCats)await setDoc(doc(ctx.firestore(),'catalog',cat.id),cat);for(const p of flowPlans)await setDoc(doc(ctx.firestore(),'planning',p.id),p)});
 const sa=await makeSession(analyst,{uid:'analyst',role:'ANALISTA',analystId:'A',name:'Analista A'},{plans:[flowPlans[0]],catalogs:flowCats});
 const sb=await makeSession(analystB,{uid:'analystB',role:'ANALISTA',analystId:'B',name:'Analista B'},{plans:[flowPlans[1]],catalogs:flowCats});
 await Promise.all([sa.startMyActivity('FLOW-A'),sb.startMyActivity('FLOW-B')]);
 assert.equal((await getDoc(doc(analyst,'planning','FLOW-A'))).data().status,'EN PROCESO');assert.equal((await getDoc(doc(analystB,'planning','FLOW-B'))).data().status,'EN PROCESO');passed('Funciones reales de iniciar confirman dos actividades con usuarios y almacenes locales distintos');
 await Promise.all([sa.inputSamples('FLOW-A',4),sb.inputSamples('FLOW-B',3)]);
 await Promise.all([sa.flushOutbox(false),sb.flushOutbox(false)]);
 assert.equal((await getDoc(doc(analyst,'planning','FLOW-A'))).data().sampleParameterCounts.DQO,4);assert.equal((await getDoc(doc(analystB,'planning','FLOW-B'))).data().sampleParameterCounts.DQO,3);passed('Formulario real de muestras persiste total y parámetros de cada analista en Firebase');
 const raw=used=>({completed:true,items:[{reagentId:'R1',name:reagent.name,lot:reagent.lot,mode:'COUNT',unit:'unidad',stockBefore:99,stockRemaining:99-used,used,usedInActivity:true,notUsed:false}]});
 await sa.commitReagentConsumption(await sa.getOne('planning','FLOW-A'),raw(4));await sb.commitReagentConsumption(await sb.getOne('planning','FLOW-B'),raw(3));
 await Promise.all([sa.flushOutbox(false),sb.flushOutbox(false)]);
 const originalTransaction=sa.firebaseBridge.mods.runTransaction;let loseAck=true;
 sa.firebaseBridge.mods.runTransaction=async(...args)=>{const r=await originalTransaction(...args);if(loseAck){loseAck=false;const e=Error('Respuesta perdida después del commit');e.code='unavailable';throw e}return r};
 await Promise.all([sa.settleSharedStockRequests(),sb.settleSharedStockRequests()]);
 sa.retryNow();sb.retryNow();await Promise.all([sa.settleSharedStockRequests(),sb.settleSharedStockRequests()]);
 for(const cat of flowCats)assert.equal((await getDoc(doc(analyst,'catalog',cat.id))).data().reagentConfig[0].stockQuantity,92);
 assert.equal((await sa.getOne('planning','FLOW-A')).reagentResult.stockRequest.state,'APPLIED');assert.equal((await sb.getOne('planning','FLOW-B')).reagentResult.stockRequest.state,'APPLIED');passed('El proceso real de consumo confirma ambos analistas sin JEFE y recupera una respuesta perdida sin doble descuento');
 await Promise.all([sa.completeActivityRecord(await sa.getOne('planning','FLOW-A'),5),sb.completeActivityRecord(await sb.getOne('planning','FLOW-B'),5)]);
 const requested=(await sa.getOne('planning','FLOW-A')).pendingClosure.requestedAt;
 assert.equal((await sa.getOne('planning','FLOW-A')).status,'EN PROCESO');passed('El cierre local permanece pendiente hasta la confirmación del servidor');
 sa.retryNow();sb.retryNow();await Promise.all([sa.flushOutbox(false),sb.flushOutbox(false)]);
 for(const id of ['FLOW-A','FLOW-B']){assert.equal((await getDoc(doc(analyst,'planning',id))).data().status,'REALIZADO');assert.ok((await getDoc(doc(analyst,'planComments','AUTO-FINAL-'+id))).exists());assert.ok((await getDoc(doc(analyst,'planComments','AUTO-TECNICA-FINAL-'+id))).exists())}
 assert.equal((await getDoc(doc(analyst,'planning','FLOW-A'))).data().actualFinishedAt,requested);passed('Funciones reales completan ambos cierres con sus avisos y conservan la hora solicitada');
 await sa.completeActivityRecord(await sa.getOne('planning','FLOW-A'),5);sa.retryNow();await sa.flushOutbox(false);
 assert.equal((await getDoc(doc(analyst,'catalog','FLOW-C1'))).data().reagentConfig[0].stockQuantity,92);passed('Repetir finalizar mediante la aplicación no cambia el saldo compartido');
 const result={passed:tests.length,environment:'Firestore Emulator; dos usuarios ANALISTA independientes, sin sesión JEFE para consumir; sin producción',tests};fs.writeFileSync(path.join(__dirname,'firebase-reglas-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }catch(e){fs.writeFileSync(path.join(__dirname,'rules-debug.json'),await (await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-erp-validation:ruleCoverage')).text());throw e}finally{await env.cleanup()}
})().catch(e=>{console.error(e);process.exitCode=1});
