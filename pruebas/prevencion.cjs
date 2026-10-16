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
const names=['buildStockRowSettlement','buildStockSettlement','sameReagentContainer','settleSharedStockRequests','hydratePlanTechnicalRequirements','queue','saveOutboxAttempt','persistPlanningChange','prepareStockRequest','recoveryReagentKey','sameStockRequest','stockRequestApplied','stockRequestPending','validNewStockRequest','protectLocalTechnicalEvidence','makeAtomicClosureEvents','activityClosureEvidence','technicalAlertReagentSummary','mergeCatalogLedgerSafe','sameCloudFunctionalPayload','sameReagentConsumptionInput','commitReagentConsumption','completeActivityRecord','samePlanningTechnicalValue','planningOperationCoveredByCloud','verifyActivityCloudClosure','retryLocalActivityClosure','flushOutbox','ensureConfirmedClosureAlerts','closureNeedsCloudConfirmation','submitFinishActivity','submitFinishActivityOnce'];
const context=vm.createContext({console,structuredClone,Date,Math,JSON,Set,Map,Promise,Error,Number,String,Object,Array,setTimeout,clearTimeout,navigator:{onLine:true},indexedDB:memory});
const page={addScriptTag:async({content})=>vm.runInContext(content,context),evaluate:async fn=>vm.runInContext('('+fn.toString()+')()',context)};
(async()=>{
 await page.addScriptTag({content:`
 var db,currentSessionUser={role:'ANALISTA',analystId:'A',name:'Analista'},firebaseBridge={ready:true,authUser:{uid:'analyst'},configured:true,mods:{},db:{},busy:false},PAGE_SESSION_ID='TEST',confirmedCloudClosureIds=new Set(),reagentSaveLocks=new Set();
 var FIREBASE_SYNC_STORES=['planning','planComments','catalog'];
 var inventoryWrites=0,propagations=0,alerts=[],renders=0,cloud={},outboxRetryNotBefore=0,redundantConflictLastCheck=0;
 var sharedStockWorkerBusy=false,sharedStockRetryAt=new Map();function normalizeIdentityText(s){return String(s||'').trim().toUpperCase()}
 var serial=0;function uid(prefix){return prefix+'-'+(++serial)}function nowISO(){return new Date().toISOString()}
 function sanitizeCloudObject(o){return JSON.parse(JSON.stringify(o))}function cloudPayloadFor(_,p){const x=sanitizeCloudObject(p);delete x.pendingClosure;return x}function cloudCollectionFor(x){return x}
 function planStage(s){return ({'PROGRAMADO':0,'EN PROCESO':1,'REALIZADO':2,'CANCELADO':3})[s]??-1}
 function isProgressivePlanUpdate(a,b){return !!a&&planStage(b.status)>planStage(a.status)&&planStage(a.status)>=0}
 function normalizeIdentityText(s){return String(s).toUpperCase()}
 async function refreshSyncUI(){}function scheduleOutboxFlush(){}function setSyncState(){}function setSyncStateVisualOnly(){}function toast(){}
 async function del(name,id){const tx=db.transaction(name,'readwrite');tx.objectStore(name).delete(id);return new Promise(r=>tx.oncomplete=r)}
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
 var versions={},commits=0,retries=0,loseNextAck=false;
 firebaseBridge.mods={doc:(_,entity,id)=>entity+'/'+id,getDocFromServer:async ref=>({exists:()=>!!cloud[ref],data:()=>structuredClone(cloud[ref])}),
 runTransaction:async(_,fn)=>{for(let attempt=0;attempt<8;attempt++){
  const writes=[],reads=new Map();let writing=false;
  await fn({get:async ref=>{if(writing)throw Error('read after write');reads.set(ref,versions[ref]||0);return {exists:()=>!!cloud[ref],data:()=>structuredClone(cloud[ref])}},
   set:(ref,p)=>{writing=true;writes.push([ref,structuredClone(p)])}});
  if([...reads].some(([ref,v])=>(versions[ref]||0)!==v)){retries++;continue;}
  for(const [ref,p] of writes){cloud[ref]=p;versions[ref]=(versions[ref]||0)+1}commits++;
  if(loseNextAck){loseNextAck=false;throw Error('simulated lost response after COMMIT')}return;
 }throw Error('too many retries')},setDoc:async(ref,p)=>{cloud[ref]=structuredClone(p)},deleteDoc:async ref=>{delete cloud[ref]}};
  `+names.map(extract).join('\n')});
 const tests=await page.evaluate(async()=>{
  const tests=[],check=(ok,label)=>{if(!ok)throw Error(label);tests.push(label)},copy=x=>structuredClone(x);
  db=await new Promise(r=>{const req=indexedDB.open('prevention',1);req.onupgradeneeded=()=>{for(const name of ['outbox','planning','catalog','planComments','config','audit'])req.result.createObjectStore(name,{keyPath:name==='config'?'key':'id'})};req.onsuccess=()=>r(req.result)});
  const reagent={id:'R',name:'TNT874',lot:'26015',mode:'COUNT',unit:'unidad',stockQuantity:99};
  const item={reagentId:'R',name:'TNT874',lot:'26015',mode:'COUNT',unit:'unidad',stockBefore:99,stockRemaining:95,used:4,usedInActivity:true,notUsed:false};
  function plan(id,used=4){const p={id,analystId:'A',analystName:'Analista',status:'EN PROCESO',actualStartedAt:'2026-10-15T13:23:00Z'};p.reagentResult=prepareStockRequest(p,{completed:true,items:[{...item,used,stockRemaining:99-used}]}).result;return p}
  function seed(p){cloud['planning/'+p.id]=copy(p)}
  const cats=[1,2,3].map(n=>({id:'CAT'+n,reagentConfig:[{...reagent,id:'R'+n}]}));
  async function seedCats(){for(const c of cats){cloud['catalog/'+c.id]=copy(c);await put('catalog',c)}}
  async function apply(id){return firebaseBridge.mods.runTransaction({},async tx=>{
    const snap=await tx.get('planning/'+id),p=snap.data(),receipt=await tx.get('stockReceipts/'+p.reagentResult.stockRequest.id);
    if(receipt.exists())return;
    const current=[];for(const cat of cats)current.push((await tx.get('catalog/'+cat.id)).data());
    const write=buildStockSettlement(p,current,'JEFE',nowISO());tx.set('planning/'+id,write.plan);tx.set('stockReceipts/'+write.receipt.id,write.receipt);
    for(const c of write.catalogs)tx.set('catalog/'+c.id,c);
  })}
  await seedCats();seed(plan('A',4));seed(plan('B',3));
  await Promise.all([apply('A'),apply('B')]);
  check(cats.every(c=>cloud['catalog/'+c.id].reagentConfig[0].stockQuantity===92),'Dos operaciones concurrentes de 4 y 3 conservan 99 − 4 − 3 = 92 en las tres fichas');
  check(retries>0&&Object.keys(cloud).filter(x=>x.startsWith('stockReceipts/')).length===2,'El servidor simulado reintenta una colisión y conserva una constancia por operación');
  const count=Object.keys(cloud).filter(x=>x.startsWith('stockReceipts/')).length;
  await Promise.all([apply('A'),apply('A')]);
  check(cloud['catalog/CAT1'].reagentConfig[0].stockQuantity===92&&Object.keys(cloud).filter(x=>x.startsWith('stockReceipts/')).length===count,'Dos reintentos del mismo consumo no descuentan ni crean constancias adicionales');
  const applied=cloud['planning/A'];
  let failed=false;try{prepareStockRequest(applied,{completed:true,items:[{...item,used:0,notUsed:true,usedInActivity:false}]})}catch(e){failed=true}
  check(failed,'Desmarcar un consumo confirmado queda bloqueado conservando el registro original');
  const second={...item,reagentId:'OTHER',name:'Otro',lot:'OTRO',used:2,stockRemaining:97};
  const expanded=prepareStockRequest(applied,{completed:true,items:[...applied.reagentResult.items,second]});
  check(expanded.result.items[0].used===4&&expanded.result.stockRequest.rows.length===1&&expanded.result.stockRequest.rows[0].name==='Otro','Agregar un reactivo crea solo su movimiento y conserva el consumo anterior');
  const protectedCatalog=cloud['catalog/CAT1'],stale=copy(cats[0]);stale.name='Nombre actualizado';
  const merged=mergeCatalogLedgerSafe(protectedCatalog,stale);
  check(merged.name===stale.name&&merged.reagentConfig[0].stockQuantity===92&&merged.inventoryRevision===protectedCatalog.inventoryRevision+1,'Una edición de catálogo antigua conserva el saldo compartido y permite cambiar metadatos');
  check(protectLocalTechnicalEvidence(applied,{...applied,reagentResult:{items:[],completed:true}}),'Una respuesta remota incompleta no elimina evidencia positiva local');
  await seedCats();const low=plan('LOW',100);seed(low);let before=JSON.stringify(cloud);failed=false;try{await apply('LOW')}catch(e){failed=true}
  check(failed&&JSON.stringify(cloud)===before,'Saldo insuficiente aborta todas las escrituras y conserva la solicitud');
  const wItem={name:'Peso',lot:'P',unit:'g',mode:'WEIGHT',used:10,usedInActivity:true,notUsed:false,containers:[{containerId:'ENV',label:'Frasco',containerType:'FRASCO',initialWeight:100,finalWeight:90,used:10,depleted:false}]};
  const wp={id:'W',status:'EN PROCESO'};wp.reagentResult=prepareStockRequest(wp,{completed:true,items:[wItem]}).result;
  const wc=[{id:'WC',reagentConfig:[{name:'Peso',lot:'P',unit:'g',mode:'WEIGHT',containers:[{id:'ENV',label:'Frasco',initialWeight:100}]}]}];
  check(buildStockSettlement(wp,wc,'JEFE',nowISO()).catalogs[0].reagentConfig[0].containers[0].initialWeight===90,'Consumo por peso actualiza el envase al peso final registrado');
  wc[0].reagentConfig[0].containers[0].initialWeight=98;failed=false;try{buildStockSettlement(wp,wc,'JEFE',nowISO())}catch(e){failed=true}
  check(failed,'Un peso inicial modificado por otra operación exige revisión y conserva la medición');
  // A complete close can coalesce with its pending consumption while offline.
  const co=plan('CO');cloud={};versions={};await seedCats();seed({...co,reagentResult:null});await put('planning',co);
  navigator.onLine=false;await completeActivityRecord(co,5);
  let local=await getOne('planning','CO');
  check(local.status==='EN PROCESO'&&!!local.pendingClosure&&cloud['planning/CO'].status==='EN PROCESO','Sin conexión el cierre se guarda pendiente y ninguna computadora lo considera confirmado');
  const originalTime=local.pendingClosure.requestedAt;navigator.onLine=true;await flushOutbox(false);
  check(cloud['planning/CO'].reagentResult.stockRequest.state==='PENDING'&&cloud['planning/CO'].status==='EN PROCESO'&&!cloud['planComments/AUTO-FINAL-CO'],'Una cola coalescida publica primero el consumo sin cerrar ni notificar prematuramente');
  // No chief session: worker must not write inventory.
  const stockBefore=cloud['catalog/CAT1'].reagentConfig[0].stockQuantity;
  navigator.onLine=false;await settleSharedStockRequests();navigator.onLine=true;check(cloud['catalog/CAT1'].reagentConfig[0].stockQuantity===stockBefore,'Sin conexión el consumo se conserva pendiente sin modificar el saldo');
  currentSessionUser={role:'ANALISTA',analystId:'A',name:'Analista'};
  loseNextAck=true;await settleSharedStockRequests();
  check(cloud['catalog/CAT1'].reagentConfig[0].stockQuantity===95&&cloud['planning/CO'].reagentResult.stockRequest.state==='APPLIED','Perder la respuesta tras el commit conserva el movimiento aplicado una sola vez');
  sharedStockRetryAt.clear();await settleSharedStockRequests();
  check(cloud['catalog/CAT1'].reagentConfig[0].stockQuantity===95&&Object.keys(cloud).filter(k=>k.startsWith('stockReceipts/')).length===1,'El analista recupera una respuesta perdida mediante su constancia sin nuevo descuento');
  currentSessionUser={role:'ANALISTA',analystId:'A',name:'Analista'};outboxRetryNotBefore=0;loseNextAck=true;
  await flushOutbox(false);
  check(cloud['planning/CO'].status==='REALIZADO'&&cloud['planning/CO'].actualFinishedAt===originalTime,'Tras confirmar inventario el cierre conserva la hora original solicitada');
  check(!!cloud['planComments/AUTO-FINAL-CO']&&!!cloud['planComments/AUTO-TECNICA-FINAL-CO']&&(await getOne('planning','CO')).status==='REALIZADO','Cierre y dos avisos quedan confirmados en la misma transacción antes de mostrar REALIZADO');
  const final=copy(cloud['planning/CO']);await queue('UPDATE','planning',final);loseNextAck=true;outboxRetryNotBefore=0;await flushOutbox(false);
  check(Object.keys(cloud).filter(k=>k.startsWith('planComments/')).length===2&&cloud['catalog/CAT1'].reagentConfig[0].stockQuantity===95,'Reintentar el cierre con respuesta perdida no duplica avisos ni consumo');
  const eventOps=(await getAll('outbox')).filter(x=>x.entity==='planComments').length;
  await del('planComments','AUTO-FINAL-CO');await del('planComments','AUTO-TECNICA-FINAL-CO');
  await ensureConfirmedClosureAlerts(cloud['planning/CO']);
  check((await getAll('outbox')).filter(x=>x.entity==='planComments').length===eventOps&&(await getOne('planComments','AUTO-FINAL-CO')).committedWithPlanning,'Un snapshot de cierre anterior al snapshot de avisos recupera los existentes sin generar nuevas escrituras');
  let removed=copy(protectedCatalog);removed.reagentConfig=[];failed=false;try{mergeCatalogLedgerSafe(protectedCatalog,removed)}catch(e){failed=true}
  check(failed,'Una copia parcial no puede eliminar un lote que ya tiene movimientos confirmados');
  await queue('UPDATE','planning',{id:'FOREIGN',analystId:'B',status:'EN PROCESO'});outboxRetryNotBefore=0;await flushOutbox(false);
  check((await getAll('outbox')).find(x=>x.recordId==='FOREIGN').status==='BLOQUEADO_PERMISOS'&&!cloud['planning/FOREIGN'],'Una cola heredada de otro usuario conserva evidencia sin reintentar escrituras ajenas');
  // Stop after the first confirmed row, then resume from the server checkpoint.
  const mi={id:'MULTI',analystId:'A',status:'EN PROCESO'};
  const row2={...item,name:'SEGUNDO',lot:'L2',reagentId:'R2',used:3,stockRemaining:96};
  mi.reagentResult=prepareStockRequest(mi,{completed:true,items:[item,row2]}).result;
  const mc={id:'MULTI-CAT',reagentConfig:[{...reagent},{...reagent,id:'R2',name:'SEGUNDO',lot:'L2'}]};
  seed(mi);cloud['catalog/'+mc.id]=copy(mc);await put('catalog',mc);await put('planning',mi);
  // The worker uses all aliases; restore the current shared balance for this fixture.
  for(const cat of cats){cloud['catalog/'+cat.id]=copy(cat);await put('catalog',cat)}
  loseNextAck=true;await settleSharedStockRequests();
  check(cloud['planning/MULTI'].reagentResult.stockRequest.state==='PENDING'&&cloud['planning/MULTI'].reagentResult.stockRequest.appliedRows.length===1,'Una interrupción entre filas deja un punto de recuperación y no confirma el consumo completo');
  sharedStockRetryAt.clear();await settleSharedStockRequests();
  check(cloud['planning/MULTI'].reagentResult.stockRequest.state==='APPLIED'&&cloud['catalog/MULTI-CAT'].reagentConfig[0].stockQuantity===95&&cloud['catalog/MULTI-CAT'].reagentConfig[1].stockQuantity===96,'Al reabrir se aplica solo la fila restante: primera 99 − 4 = 95 y segunda 99 − 3 = 96');
  check(Object.keys(cloud).filter(k=>k.startsWith('stockReceipts/'+mi.reagentResult.stockRequest.id+'-')).length===2,'Una solicitud de dos filas conserva exactamente dos constancias sin duplicarlas');
  return tests;
 });
 const result={passed:tests.length,environment:'Node.js; IndexedDB serial y Firestore optimista simulados; sin conexión de producción',tests};
 fs.writeFileSync(path.join(__dirname,'prevencion-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
