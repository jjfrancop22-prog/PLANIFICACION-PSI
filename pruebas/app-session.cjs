// Run actual application functions in separate local stores against the Firestore emulator.
// DOM rendering is stubbed. This is an integration test, not a visual browser test.
const fs=require('fs'),path=require('path'),vm=require('vm');
const {runTransaction,doc,getDocFromServer,setDoc,deleteDoc}=require('firebase/firestore');
const indexedDB=require('./test-idb.cjs'),source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
function extract(name){const m=new RegExp('^(?:async )?function '+name+'\\(','m').exec(source);if(!m)throw Error(name);const nl=source.indexOf('\n',m.index);return source.slice(m.index,source.slice(m.index,nl).endsWith('}')?nl:source.indexOf('\n}',nl)+2)}
const functions=['queue','saveOutboxAttempt','persistPlanningChange','prepareStockRequest','recoveryReagentKey','sameStockRequest','stockRequestApplied','stockRequestPending','validNewStockRequest','protectLocalTechnicalEvidence','makeAtomicClosureEvents','activityClosureEvidence','technicalAlertReagentSummary','mergeCatalogLedgerSafe','sameCloudFunctionalPayload','sameReagentConsumptionInput','commitReagentConsumption','completeActivityRecord','samePlanningTechnicalValue','planningOperationCoveredByCloud','flushOutbox','ensureConfirmedClosureAlerts','buildStockSettlement','buildStockRowSettlement','sameReagentContainer','settleSharedStockRequests','startMyActivity','saveOperationalSamples'];
module.exports=async function session(cloudDb,user,fixtures){
 const clean=x=>JSON.parse(JSON.stringify(x));
 const sdk={doc,getDocFromServer,setDoc:async(ref,p,o)=>setDoc(ref,clean(p),o),deleteDoc,
  runTransaction:async(db,fn)=>runTransaction(db,async tx=>fn({get:ref=>tx.get(ref),set:(ref,p,o)=>o?tx.set(ref,clean(p),o):tx.set(ref,clean(p)),update:(ref,p)=>tx.update(ref,clean(p))}))};
 const c=vm.createContext({console,structuredClone,Date,Math,JSON,Set,Map,Promise,Error,Number,String,Object,Array,indexedDB,navigator:{onLine:true},
 setTimeout:(fn,ms)=>fn.toString().includes('settleSharedStockRequests')?0:setTimeout(fn,ms),clearTimeout,
 currentSessionUser:user,firebaseBridge:{ready:true,configured:true,authUser:{uid:user.uid},db:cloudDb,mods:sdk,busy:false},FIREBASE_SYNC_STORES:['planning','catalog','planComments']});
 vm.runInContext(`
 var db,PAGE_SESSION_ID='SIM-'+currentSessionUser.uid,serial=0,confirmedCloudClosureIds=new Set(),reagentSaveLocks=new Set(),sharedStockWorkerBusy=false,sharedStockRetryAt=new Map(),activityStartInFlight=new Set(),outboxRetryNotBefore=0;
 function nowISO(){return new Date().toISOString()}function uid(p){return p+'-'+currentSessionUser.uid+'-'+(++serial)}
 function dateToday(){return '2026-10-15'}function formatShortDate(d){return d}function formatActualStamp(d){return d}function normalizeIdentityText(s){return String(s||'').toUpperCase()}
 function planStage(s){return ({PROGRAMADO:0,'EN PROCESO':1,REALIZADO:2,CANCELADO:3})[s]??-1}function isProgressivePlanUpdate(a,b){return !!a&&planStage(b.status)>planStage(a.status)&&planStage(a.status)>=0}
 function assertOwnPlan(p){return p.analystId===currentSessionUser.analystId}function cloudCollectionFor(n){return n}
 function cloudPayloadFor(_,p){const x=JSON.parse(JSON.stringify(p));delete x.pendingClosure;return x}
 function toast(){}function setSyncState(){}function setSyncStateVisualOnly(){}async function refreshSyncUI(){}function scheduleOutboxFlush(){}
 function quotaPauseRemaining(){return 0}function isFirebaseQuotaError(){return false}function clearFirebaseQuotaBackoff(){}
 async function renderMyDay(){}async function renderAgenda(){}async function renderDailyLoad(){}async function renderAudit(){}async function renderManagementDashboard(){}async function audit(){}
 function releaseActivityCompletion(){}async function showActivityCloudClosureResult(){}async function createActivityLifecycleAlert(){return null}async function createTechnicalAlert(){return null}
 function requiresActualSamples(){return true}function sampleParametersForPlan(){return ['DQO']}
 const fields={'#operationalSamplesPlanId':{value:''},'#operationalSamplesCount':{value:'5'},'#operationalSamplesDialog':{close(){}}};
 const sampleFields=[{value:'4',dataset:{sampleParameter:'0'}}];function $(selector){return fields[selector]}const document={querySelectorAll:()=>sampleFields};
 function getAll(n){return new Promise((r,j)=>{const q=db.transaction(n).objectStore(n).getAll();q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)})}
 function getOne(n,k){return new Promise((r,j)=>{const q=db.transaction(n).objectStore(n).get(k);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)})}
 function put(n,p){return new Promise((r,j)=>{const tx=db.transaction(n,'readwrite');tx.objectStore(n).put(p);tx.oncomplete=()=>r(p);tx.onerror=()=>j(tx.error)})}
 function del(n,k){return new Promise(r=>{const tx=db.transaction(n,'readwrite');tx.objectStore(n).delete(k);tx.oncomplete=r})}
 `+functions.map(extract).join('\n'),c);
 c.db=await new Promise(resolve=>{const r=indexedDB.open('app-session-'+user.uid,1);r.onupgradeneeded=()=>{for(const n of ['planning','catalog','planComments','outbox','config','audit'])r.result.createObjectStore(n,{keyPath:n==='config'?'key':'id'})};r.onsuccess=()=>resolve(r.result)});
 for(const p of fixtures.plans)await c.put('planning',p);for(const cat of fixtures.catalogs)await c.put('catalog',cat);
 c.inputSamples=async(id,count)=>{c.planId=id;c.sampleCount=String(count);await vm.runInContext("fields['#operationalSamplesPlanId'].value=planId;sampleFields[0].value=sampleCount;saveOperationalSamples({preventDefault(){}})",c)};
 c.retryNow=()=>vm.runInContext('outboxRetryNotBefore=0;sharedStockRetryAt.clear()',c);
 return c;
};
