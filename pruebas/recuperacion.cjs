// Pruebas locales de conciliación. Firestore y almacenamiento local se simulan;
// el código de producción se extrae directamente de app.js, sin conectarse a la red.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
function extract(name){
 const m=new RegExp('^(?:async )?function '+name+'\\(','m').exec(source);if(!m)throw Error(name);
 const lineEnd=source.indexOf('\n',m.index),first=source.slice(m.index,lineEnd);
 const end=first.endsWith('}')?lineEnd:source.indexOf('\n}',lineEnd)+2;
 const code=source.slice(m.index,end);new Function(code);return code;
}
const names=['samePlanningTechnicalValue','normalizeIdentityText','escapeHtml','recoveryReagentKey','recoveryCoreMatches',
 'buildReagentRecoveryProposal','validateReagentRecoveryCurrent','buildReagentRecoveryWrite',
 'activityClosureEvidence','recoveryOperationCanArchive','chiefRecoverReagentsAndClosure'];
const clone=x=>structuredClone(x);
function fixture(){
 const existing={reagentId:'DQO',name:'Kit DQO',lot:'AG2A1229',mode:'COUNT',unit:'unidad',stockBefore:264,used:4,stockRemaining:260,usedInActivity:true,notUsed:false};
 const tnt={reagentId:'TNT',name:'TNT874',lot:'26015',mode:'COUNT',unit:'unidad',stockBefore:99,used:4,stockRemaining:95,usedInActivity:true,notUsed:false};
 const core={id:'PLAN-TEST',catalogId:'CAT-1',date:'2026-10-15',analystId:'A',analystName:'Analista',catalogName:'Recepción',
  actualStartedAt:'2026-10-15T13:23:05.493Z',actualSamples:5,sampleParameterCounts:{DQO:4,DBO5:2,Tensoactivos:4}};
 const remote={...core,status:'EN PROCESO',reagentResult:{completed:true,items:[existing],inventoryCommittedAt:'2026-10-15T20:12:23.054Z'},reagentConfig:[{...tnt,id:'TNT'}]};
 const local={...clone(remote),status:'REALIZADO',actualFinishedAt:'2026-10-15T21:10:53.894Z',completionCommittedAt:'2026-10-15T21:10:53.894Z',completionOperationId:'FINAL-PLAN-TEST',completionCommittedBy:'Analista'};
 local.reagentResult.items.push({...tnt,used:0,stockBefore:95,stockRemaining:95,usedInActivity:false,notUsed:true});
 const original={...clone(remote),reagentResult:{completed:true,items:[existing,tnt],inventoryCommittedAt:'2026-10-15T20:17:59.528Z'}};
 const outbox=[{id:'OUT-ORIGINAL',entity:'planning',type:'UPDATE',recordId:core.id,status:'CONFLICTO_LOCAL',createdAt:'2026-10-15T20:17:59.476Z',payload:original},
  {id:'OUT-OLD',entity:'planning',type:'UPDATE',recordId:core.id,status:'CONFLICTO_LOCAL',createdAt:'2026-10-15T20:39:03.114Z',payload:clone(local)},
  {id:'OUT-OTHER',entity:'planning',type:'UPDATE',recordId:'ANOTHER',status:'CONFLICTO_LOCAL',createdAt:'2026-10-14T20:00:00Z',payload:{id:'ANOTHER'}}];
 const catalogs=[1,2,3].map(i=>({id:'CAT-'+i,reagentConfig:[{id:'R-'+i,name:'TNT874',lot:'26015',mode:'COUNT',unit:'unidad',stockQuantity:99,stockAdjustedAt:'2026-10-15T20:16:18.060Z'}]}));
 return {remote,local,outbox,catalogs};
}
function contextFor(f){
 const cloud=new Map([['planning/'+f.remote.id,clone(f.remote)],...f.catalogs.map(c=>['catalog/'+c.id,clone(c)])]);
 const local=new Map([['planning',new Map([[f.local.id,clone(f.local)]])],['catalog',new Map(f.catalogs.map(c=>[c.id,clone(c)]))],
  ['outbox',new Map(f.outbox.map(o=>[o.id,clone(o)]))],['planComments',new Map()]]);
 const c=vm.createContext({console,structuredClone,Date,JSON,Map,Set,Number,String,Object,Array,Math,Error,Promise,navigator:{onLine:true},
  currentSessionUser:{role:'JEFE',name:'JEFE'},confirmedCloudClosureIds:new Set(),chiefReagentRecoveryBusy:new Set(),
  reagentMasterProfiles:[],alerts:[],confirms:[],writes:0,retryTransactions:false,
  alert:s=>c.alerts.push(s),confirm:s=>{c.confirms.push(s);return true},formatActualStamp:s=>new Date(s).toISOString(),nowISO:()=>new Date().toISOString(),
  getOne:async(name,id)=>clone(local.get(name)?.get(id)),getAll:async name=>[...(local.get(name)?.values()||[])].map(clone),
  put:async(name,obj)=>{if(!local.has(name))local.set(name,new Map());local.get(name).set(obj.id||obj.key,clone(obj))},
  saveOutboxAttempt:async obj=>{local.get('outbox').set(obj.id,clone(obj));return true},
  renderMyDay:async()=>{},refreshSyncUI:async()=>{},refreshNotificationBadge:async()=>{},
 });
 const sdk={doc:(_,entity,id)=>entity+'/'+id,getDocFromServer:async ref=>({exists:()=>cloud.has(ref),data:()=>clone(cloud.get(ref))}),
  runTransaction:async(_,fn)=>{
   const attempt=async()=>{const writes=[];let didWrite=false;
    await fn({get:async ref=>{if(didWrite)throw Error('Lectura después de escritura');return {exists:()=>cloud.has(ref),data:()=>clone(cloud.get(ref))}},
     set:(ref,data)=>{didWrite=true;writes.push([ref,clone(data)])}});return writes};
   if(c.retryTransactions)await attempt();
   for(const [ref,data] of await attempt()){cloud.set(ref,data);c.writes++}
  }};
 c.firebaseBridge={ready:true,authUser:{},busy:false,db:{},mods:sdk};
 vm.runInContext(names.map(extract).join('\n'),c);
 return {c,cloud,local};
}
async function run(f=fixture()){
 const tests=[],check=(ok,label)=>{assert.ok(ok,label);tests.push(label)};
 const {c}=contextFor(f);
 const proposal=c.buildReagentRecoveryProposal(f.local,f.remote,f.outbox,f.catalogs);
  c.fixture=clone(f);
  const conditionStart=source.indexOf('    const hasHeldConsumption=');
  const condition=source.slice(conditionStart,source.indexOf('    const joeClosureConflict=',conditionStart));
  const markupStart=source.indexOf('${hasHeldConsumption?');
  const markup=source.slice(markupStart,source.indexOf('\n',markupStart));
  function renderHeld(){return vm.runInContext('(()=>{const p=fixture.local,myDayOutbox=fixture.outbox,localClosurePending=true;'+condition+'return `'+markup+'`;})()',c)}
  check(renderHeld().includes('data-chief-recover-reagents='),'El botón JEFE aparece con la condición y el HTML reales de Mi Jornada');
  c.currentSessionUser.role='ANALISTA';
  check(!renderHeld().includes('data-chief-recover-reagents=')&&renderHeld().includes('misma computadora'),'El analista ve la instrucción de revisión y no recibe el botón administrativo');
  c.currentSessionUser.role='JEFE';
 const write=c.buildReagentRecoveryWrite(proposal,f.remote,f.catalogs,'JEFE','2026-10-15T22:00:00Z');
 check(write.planning.actualSamples===5&&write.planning.sampleParameterCounts.DQO===4&&write.planning.sampleParameterCounts.DBO5===2&&write.planning.sampleParameterCounts.Tensoactivos===4,'Se conservan las cinco muestras y los tres parámetros');
 check(write.planning.actualFinishedAt===f.local.actualFinishedAt,'Se conserva el cierre original de las 16:10');
 const tnt=write.planning.reagentResult.items.find(x=>x.name==='TNT874'&&x.lot==='26015');
 check(tnt.used===4&&tnt.stockBefore===99&&tnt.stockRemaining===95&&!tnt.notUsed,'Se restaura la evidencia original TNT874 99 − 4 = 95');
 check(write.catalogWrites.length===3&&write.catalogWrites.every(c=>c.reagentConfig.filter(x=>x.name==='TNT874'&&x.lot==='26015').every(r=>r.stockQuantity===95)),'Las tres fichas del lote comparten el saldo 95');
 check(write.planning.reagentResult.inventoryCommittedAt===proposal.sourceAt,'La fecha del consumo original se conserva para no convertirlo en un consumo nuevo');
 check(c.validateReagentRecoveryCurrent(proposal,write.planning,write.catalogWrites).already,'La repetición de la misma conciliación no aplica otro descuento');
 const catalogs95=clone(f.catalogs);catalogs95.forEach(c=>c.reagentConfig.forEach(r=>{if(r.name==='TNT874'&&r.lot==='26015')r.stockQuantity=95}));
 check(c.buildReagentRecoveryWrite(proposal,f.remote,catalogs95,'JEFE','now').catalogWrites.every(c=>c.reagentConfig.filter(r=>r.name==='TNT874'&&r.lot==='26015').every(r=>r.stockQuantity===95)),'Un saldo que ya es 95 permanece en 95');
 const wrong=clone(f.catalogs);wrong[0].reagentConfig.find(x=>x.name==='TNT874').stockQuantity=97;
 assert.throws(()=>c.buildReagentRecoveryWrite(proposal,f.remote,wrong,'JEFE','now'));tests.push('Un saldo actual diferente bloquea la conciliación completa');
 const adjusted=clone(f.catalogs);adjusted[0].reagentConfig.find(x=>x.name==='TNT874').stockAdjustedAt='2026-10-15T21:00:00Z';
 assert.throws(()=>c.buildReagentRecoveryWrite(proposal,f.remote,adjusted,'JEFE','now'));tests.push('Un ajuste de inventario posterior queda protegido');
 const changed=clone(f.remote);changed.sampleParameterCounts.DQO=7;
 assert.throws(()=>c.buildReagentRecoveryWrite(proposal,changed,f.catalogs,'JEFE','now'));tests.push('Cambios en muestras o parámetros bloquean el cierre');
 const usedChanged=clone(f.remote);usedChanged.reagentResult.items.find(x=>x.used===4).used=5;
 assert.throws(()=>c.buildReagentRecoveryProposal(f.local,usedChanged,f.outbox,f.catalogs));tests.push('No se reemplaza un consumo ya confirmado que tenga otra cantidad');
 const archive=f.outbox.filter(o=>c.recoveryOperationCanArchive(o,proposal,write.planning));
 check(archive.length>0&&archive.every(o=>o.recordId===f.local.id),'Solo las revisiones compatibles de esta actividad pueden archivarse');
 const sim=contextFor(f);sim.c.retryTransactions=true;
 await sim.c.chiefRecoverReagentsAndClosure(f.local.id);
 const saved=sim.cloud.get('planning/'+f.local.id);
 check(saved.status==='REALIZADO'&&!!saved.reagentRecovery,'La transacción confirma consumo y cierre con evidencia');
 check([...sim.cloud].filter(([k])=>k.startsWith('audit/')).length===1&&[...sim.cloud].filter(([k])=>k.startsWith('planComments/')).length===2,'Auditoría y dos avisos se confirman dentro de la misma transacción');
 const sent=sim.c.writes;
 await sim.c.chiefRecoverReagentsAndClosure(f.local.id);
 check(sim.c.writes===sent,'Repetir el botón después de confirmar no vuelve a escribir inventario');
 check([...sim.local.get('outbox').values()].filter(o=>o.recordId===f.local.id&&o.status==='ARCHIVADO_CONCILIACION_JEFE').length===archive.length,'Las revisiones archivadas conservan su payload original y referencia de conciliación');
 const denied=contextFor(f);denied.c.currentSessionUser.role='ANALISTA';await denied.c.chiefRecoverReagentsAndClosure(f.local.id);
 check(denied.c.writes===0,'La recuperación de inventario solo se ejecuta con la cuenta JEFE');
 const race=contextFor(f);race.c.confirm=()=>{const cat=race.cloud.get('catalog/'+f.catalogs[0].id);cat.reagentConfig.find(r=>r.name==='TNT874').stockQuantity=97;return true};
 await race.c.chiefRecoverReagentsAndClosure(f.local.id);
 check(race.c.writes===0&&race.cloud.get('planning/'+f.local.id).status==='EN PROCESO','Un cambio de saldo entre revisión y confirmación aborta todas las escrituras');
 return {passed:tests.length,archivable:archive.length,sourceOperationId:proposal.sourceOperationId,tests};
}
module.exports={run,fixture};
if(require.main===module)run().then(r=>{fs.writeFileSync(path.join(__dirname,'recuperacion-results.json'),JSON.stringify(r,null,2));console.log(JSON.stringify(r,null,2))}).catch(e=>{console.error(e);process.exit(1)});
