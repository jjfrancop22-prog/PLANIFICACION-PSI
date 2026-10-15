const fs=require('fs'),path=require('path');
const vm=require('vm');
const memory=require('./test-idb.cjs');
const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
function extract(name){
 const match=new RegExp('^(?:async )?function '+name+'\\(', 'm').exec(source);
 if(!match)throw Error(name);
 const start=match.index,lineEnd=source.indexOf('\n',start),first=source.slice(start,lineEnd);
 const end=first.endsWith('}')?lineEnd:source.indexOf('\n}',lineEnd)+2;
 const code=source.slice(start,end);new Function(code);return code;
}
const names=['queue','saveOutboxAttempt','sameCloudFunctionalPayload','sameReagentConsumptionInput','commitReagentConsumption','completeActivityRecord','samePlanningTechnicalValue','planningOperationCoveredByCloud','verifyActivityCloudClosure','retryLocalActivityClosure','flushOutbox','ensureConfirmedClosureAlerts','submitFinishActivity','submitFinishActivityOnce'];
const context=vm.createContext({console,structuredClone,Date,Math,JSON,Set,Map,Promise,Error,Number,String,Object,Array,setTimeout,clearTimeout,navigator:{onLine:true},indexedDB:memory});
const page={addScriptTag:async({content})=>vm.runInContext(content,context),evaluate:async fn=>vm.runInContext('('+fn.toString()+')()',context)};
(async()=>{
 await page.addScriptTag({content:`
 var db,currentSessionUser={role:'ANALISTA',analystId:'A',name:'Analista'},firebaseBridge={ready:true,authUser:{},configured:true,mods:{},db:{},busy:false},PAGE_SESSION_ID='TEST';
 var FIREBASE_SYNC_STORES=['planning','planComments','catalog'];
 var inventoryWrites=0,propagations=0,alerts=[],renders=0,cloud={},outboxRetryNotBefore=0,redundantConflictLastCheck=0;
 var serial=0;function uid(prefix){return prefix+'-'+(++serial)}function nowISO(){return new Date().toISOString()}
 function sanitizeCloudObject(o){return JSON.parse(JSON.stringify(o))}function cloudPayloadFor(_,p){return sanitizeCloudObject(p)}function cloudCollectionFor(x){return x}
 function planStage(s){return ({'PROGRAMADO':0,'EN PROCESO':1,'REALIZADO':2,'CANCELADO':3})[s]??-1}
 function isProgressivePlanUpdate(a,b){return !!a&&planStage(b.status)>planStage(a.status)&&planStage(a.status)>=0}
 function normalizeIdentityText(s){return String(s).toUpperCase()}
 async function refreshSyncUI(){}function scheduleOutboxFlush(){}function setSyncState(){}function setSyncStateVisualOnly(){}function toast(){}
 function quotaPauseRemaining(){return 0}function clearFirebaseQuotaBackoff(){}function isFirebaseQuotaError(){return false}
 async function applyConfirmedReagentInventoryToCatalog(){inventoryWrites++}async function propagateLiveInventoryToOpenPlans(){propagations++}
 async function audit(){}async function renderMyDay(){renders++}async function renderAgenda(){}async function renderDailyLoad(){}async function renderAudit(){}async function renderManagementDashboard(){}
 function releaseActivityCompletion(){}async function showActivityCloudClosureResult(){}function formatActualStamp(s){return s}
 function assertOwnPlan(p){return p.analystId==='A'}function alert(s){alerts.push(s)}
 async function reconcileRedundantPlanningConflicts(){return 0}
 async function createActivityLifecycleAlert(p){return {id:'AUTO-FINAL-'+p.id,planId:p.id}}
 async function createTechnicalAlert(p){return {id:'AUTO-TECNICA-FINAL-'+p.id,planId:p.id}}
 function getAll(name){return new Promise((resolve,reject)=>{const r=db.transaction(name).objectStore(name).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
 function getOne(name,key){return new Promise((resolve,reject)=>{const r=db.transaction(name).objectStore(name).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
 function put(name,obj){return new Promise((resolve,reject)=>{const tx=db.transaction(name,'readwrite');tx.objectStore(name).put(obj);tx.oncomplete=()=>resolve(obj);tx.onerror=()=>reject(tx.error)})}
 firebaseBridge.mods={doc:(_,entity,id)=>entity+'/'+id,getDocFromServer:async ref=>({exists:()=>!!cloud[ref],data:()=>structuredClone(cloud[ref])}),
 runTransaction:async(_,fn)=>{const writes=[];await fn({get:async ref=>({exists:()=>!!cloud[ref],data:()=>structuredClone(cloud[ref])}),set:(ref,p)=>writes.push([ref,structuredClone(p)])});for(const [ref,p] of writes)cloud[ref]=p},
 setDoc:async(ref,p)=>{cloud[ref]=structuredClone(p)},deleteDoc:async ref=>{delete cloud[ref]}};
 `+names.map(extract).join('\n')});
 const result=await page.evaluate(async()=>{
  const tests=[];const check=(condition,label)=>{if(!condition)throw Error(label);tests.push(label)};
  db=await new Promise((resolve,reject)=>{const r=indexedDB.open('closure-regression',1);r.onupgradeneeded=()=>{for(const name of ['outbox','planning','catalog','planComments','config'])r.result.createObjectStore(name,{keyPath:name==='config'?'key':'id'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  const item={reagentId:'R',name:'Reactivo',lot:'L',mode:'COUNT',unit:'unidad',stockBefore:99,used:4,stockRemaining:95,usedInActivity:true,notUsed:false};
  let p={id:'P',analystId:'A',date:'2026-10-15',status:'EN PROCESO',actualStartedAt:'2026-10-15T13:23:00Z',actualSamples:5,sampleParameterCounts:{DQO:5},reagentResult:{completed:true,items:[item],inventoryCommittedAt:'saved',inventorySignature:'original'}};
  const saved=JSON.stringify(p.reagentResult);
  const raw={completed:true,items:[{...item,stockBefore:95,stockRemaining:91}],capturedAt:'later'};
  check((await commitReagentConsumption(p,raw)).unchanged,'COUNT: guardar y finalizar conserva 99 - 4 = 95');
  check(JSON.stringify(p.reagentResult)===saved&&inventoryWrites===0&&propagations===0,'COUNT: reintento no escribe inventario ni cambia evidencia');
  const changed=structuredClone(raw);changed.items[0].used=8;
  check(!(await commitReagentConsumption(p,changed)).ok&&inventoryWrites===0,'Cambio real de consumo queda bloqueado para conciliación');
  const weight={completed:true,items:[{reagentId:'W',mode:'WEIGHT',containers:[{containerId:'C',initialWeight:100,finalWeight:90,initialSource:'CATALOGO'}]}],inventoryCommittedAt:'saved'};
  const w={id:'W',reagentResult:weight},wRaw=structuredClone(weight);delete wRaw.inventoryCommittedAt;wRaw.items[0].containers[0].initialSource='HISTORICO';
  check((await commitReagentConsumption(w,wRaw)).unchanged&&inventoryWrites===0,'WEIGHT: cerrar conserva pesos registrados al cambiar la fuente del formulario');
  await queue('UPDATE','planning',p);const sent=(await getAll('outbox'))[0];
  const closed={...p,status:'REALIZADO',actualFinishedAt:'2026-10-15T21:10:00Z',completionCommittedAt:'2026-10-15T21:10:00Z',completionOperationId:'FINAL-P'};
  await queue('UPDATE','planning',closed);sent.status='SINCRONIZADO';
  check(!(await saveOutboxAttempt(sent)),'Respuesta tardía no confirma una revisión nueva');
  let open=(await getAll('outbox')).find(x=>x.recordId==='P');
  check(open.status==='PENDIENTE'&&open.payload.status==='REALIZADO','Cierre más reciente permanece en cola después del ACK antiguo');
  await Promise.all([queue('UPDATE','planning',closed),queue('UPDATE','planning',closed)]);
  check((await getAll('outbox')).filter(x=>x.recordId==='P'&&x.status==='PENDIENTE').length===1,'Escrituras simultáneas de cola mantienen una sola revisión abierta');
  cloud['planning/P']=structuredClone(p);await put('planning',closed);
  await flushOutbox(false);
  check(cloud['planning/P'].status==='REALIZADO'&&cloud['planning/P'].reagentResult.items[0].stockRemaining===95,'Transacción confirma cierre sobre evidencia técnica idéntica sin repetir consumo');
  check((await getAll('outbox')).some(x=>x.recordId==='AUTO-FINAL-P')&&(await getAll('outbox')).some(x=>x.recordId==='AUTO-TECNICA-FINAL-P'),'Cierre confirmado genera avisos determinísticos de cierre y datos técnicos');
  await flushOutbox(false);
  check(!!cloud['planComments/AUTO-FINAL-P'],'Aviso de cierre llega al servidor simulado');
  await queue('UPDATE','planning',p);await flushOutbox(false);
  check(cloud['planning/P'].status==='REALIZADO','Una copia antigua abierta no reabre el cierre');
  const other=structuredClone(closed);other.id='Q';other.reagentResult.items[0].used=9;other.actualFinishedAt='later';other.completionOperationId='FINAL-Q';
  cloud['planning/Q']={...structuredClone(p),id:'Q'};await put('planning',other);await queue('UPDATE','planning',other);await flushOutbox(false);
  check(cloud['planning/Q'].status==='EN PROCESO'&&(await getAll('outbox')).some(x=>x.recordId==='Q'&&x.status==='CONFLICTO_LOCAL'),'Consumos diferentes entre equipos no se sobrescriben ni se cierran');
  const conflictCount=(await getAll('outbox')).filter(x=>x.status==='CONFLICTO_LOCAL').length;
  await queue('UPDATE','planning',other);
  check((await getAll('outbox')).filter(x=>x.status==='CONFLICTO_LOCAL').length===conflictCount&&!(await getAll('outbox')).some(x=>x.recordId==='Q'&&x.status==='PENDIENTE'),'Un mismo conflicto repetido conserva evidencia sin aumentar la cola');
  check(inventoryWrites===0,'Todos los envíos y reintentos de cierres guardados dejan intacto el inventario');
  const beforeQueue=(await getAll('outbox')).length;await retryLocalActivityClosure('Q');
  check((await getAll('outbox')).length===beforeQueue&&alerts.at(-1).includes('Diferencia técnica'),'Recuperación de cierre existente informa campos diferentes y no escribe');
  const r={...structuredClone(closed),id:'REC',completionOperationId:'FINAL-REC'};await put('planning',r);cloud['planning/REC']={...structuredClone(p),id:'REC'};
  await retryLocalActivityClosure('REC');
  check(cloud['planning/REC'].status==='REALIZADO'&&alerts.at(-1).includes('Cierre confirmado'),'Recuperación confirma cierre pendiente cuando las evidencias coinciden');
  const replay={...structuredClone(closed),id:'COMP',completionOperationId:'FINAL-COMP'};await put('planning',replay);
  const writesBefore=inventoryWrites;await completeActivityRecord(replay,5,'',undefined,replay.reagentResult);
  check(inventoryWrites===writesBefore&&JSON.stringify(replay.reagentResult)===saved,'Completar actividad conserva el objeto de consumo confirmado');
  const dif={...structuredClone(closed),sampleParameterCounts:{DQO:6}};
  check(!planningOperationCoveredByCloud(dif,closed),'Conciliación no archiva diferencias en muestras por parámetro');
  const fresh={id:'NEW',analystId:'A',status:'EN PROCESO'};await put('catalog',{id:'CAT',reagentConfig:[{name:'Reactivo',lot:'L',stockQuantity:99}]});
  const first={completed:true,items:[{...item,stockBefore:264,stockRemaining:260}]};
  const countBefore=inventoryWrites;await commitReagentConsumption(fresh,first);
  check(fresh.reagentResult.items[0].stockBefore===99&&fresh.reagentResult.items[0].stockRemaining===95&&inventoryWrites===countBefore+1,'Primer guardado toma el saldo disponible y aplica un solo movimiento local');
  return tests;
 });
 const submission=await page.evaluate(async()=>{
  globalThis.technicalSubmissionLocks=new Set();globalThis.technicalSnapshot='';
  const field={value:'',disabled:false,close(){}};
  globalThis.$=selector=>selector==='#finishActivityPlanId'?{value:'SUBMIT'}:selector==='#finishTechnicalEditMode'?{value:'0'}:field;
  globalThis.planRequiresCalibration=()=>false;globalThis.planHasReagents=()=>true;
  globalThis.hydratePlanTechnicalRequirements=async p=>p;
  globalThis.requiresActualSamples=()=>true;globalThis.validSampleRegistration=()=>true;
  globalThis.collectReagentResult=()=>({ok:true,complete:true,result:{completed:true,items:[{mode:'COUNT',stockBefore:95,stockRemaining:91,used:4}]}});
  globalThis.assertDailyControlsBeforeDayClose=async()=>({ok:true});
  globalThis.claimActivityCompletion=async()=>({ok:true});
  const stored={id:'SUBMIT',analystId:'A',status:'EN PROCESO',actualSamples:5,reagentResult:{completed:true,items:[{mode:'COUNT',stockBefore:99,stockRemaining:95,used:4}],inventoryCommittedAt:'kept',inventorySignature:'kept'}};
  await put('planning',stored);
  let passed,calls=0;completeActivityRecord=async(p,n,c,cal,rr)=>{passed=rr;calls++};
  await Promise.all([submitFinishActivity({preventDefault(){}}),submitFinishActivity({preventDefault(){}})]);
  if(calls!==1||passed.inventoryCommittedAt!=='kept'||passed.items[0].stockRemaining!==95)throw Error('Submission regression');
  return ['Formulario de cierre pasa el consumo confirmado a la finalización','Doble clic en confirmar procesa un solo cierre'];
 });
 result.push(...submission);
 console.log(JSON.stringify({passed:result.length,tests:result},null,2));
 fs.writeFileSync(path.join(__dirname,'regression-results.json'),JSON.stringify({passed:result.length,tests:result},null,2));

})().catch(e=>{console.error(e);process.exit(1)});
