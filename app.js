const APP_VERSION='V1.0.5.6.33.25.10.11-RECONCILIACION-CACHE-MULTIPC';
const PAGE_SESSION_ID=`SES-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const DB_NAME='ERP_PLANIFICACION_NEXTGEN_CLEAN';
const DB_VERSION=9;
const SECTIONS=[
  {id:'ACTIVIDADES_LABORATORIO',label:'Actividad de Laboratorio',prefix:'AL',hint:'Mantenimiento, calibración, verificación, limpieza, preparación, control y otras actividades internas.',family:'Tipo de actividad',suggest:['MANTENIMIENTO','CALIBRACIÓN','VERIFICACIÓN','LIMPIEZA','PREPARACIÓN','CONTROL','OTRO']},
  {id:'SOPORTE_CALIDAD',label:'Soporte de Calidad',prefix:'SC',hint:'Actividades de calidad, revisión, auditoría, documentación, SGC y soporte técnico.',family:'Tipo / proceso',suggest:[]},
  {id:'OPERACIONES',label:'Operaciones',prefix:'OP',hint:'Actividades operativas que consumen jornada del personal y deben ser planificadas.',family:'Tipo / proceso',suggest:[]},
  {id:'ENSAYOS_ANALITICOS',label:'Ensayos Analíticos',prefix:'EA',hint:'Técnica → ensayo/parámetro → duración fija o reglas según cantidad de muestras.',family:'Técnica',suggest:['UV-VISIBLES','GRAVIMETRÍA','VOLUMETRÍA','ELECTROMETRÍA','INFRARROJO']},
  {id:'RECEPCION_MUESTRAS',label:'Recepción de Muestras',prefix:'RM',hint:'Actividades relacionadas con recepción, revisión e ingreso de muestras.',family:'Tipo / proceso',suggest:[]},
  {id:'MICROBIOLOGIA',label:'Microbiología',prefix:'MB',hint:'Bloques microbiológicos compuestos: actividad principal → duración total → desglose de subactividades.',family:'Técnica / grupo',suggest:[]},
  {id:'AASS',label:'AASS',prefix:'AA',hint:'Bloques de Absorción Atómica compuestos: actividad principal → duración total → desglose de subactividades.',family:'Técnica / grupo',suggest:[]}
];
let db,currentSection='ACTIVIDADES_LABORATORIO',editingRules=[],editingSteps=[];
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function nowISO(){return new Date().toISOString()}
function bindOptional(selector,event,handler){
  const el=$(selector);
  if(el)el.addEventListener(event,handler);
}

function uid(prefix='ID'){return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`}
function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]))}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2300)}
function sectionMeta(id){return SECTIONS.find(s=>s.id===id)||SECTIONS[0]}
function fmtDate(v){try{return new Intl.DateTimeFormat('es-EC',{dateStyle:'short',timeStyle:'short'}).format(new Date(v))}catch{return v}}
function minutesText(m){const n=Number(m||0);if(!n)return '—';const h=Math.floor(n/60),min=n%60;return h&&min?`${h} h ${min} min`:h?`${h} h`:`${min} min`}
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=e=>{const d=e.target.result;if(!d.objectStoreNames.contains('catalog')){const s=d.createObjectStore('catalog',{keyPath:'id'});s.createIndex('section','section');s.createIndex('status','status')}if(!d.objectStoreNames.contains('timeRules')){const s=d.createObjectStore('timeRules',{keyPath:'id'});s.createIndex('catalogId','catalogId')}if(!d.objectStoreNames.contains('compositeSteps')){const s=d.createObjectStore('compositeSteps',{keyPath:'id'});s.createIndex('catalogId','catalogId')}if(!d.objectStoreNames.contains('analysts')){const s=d.createObjectStore('analysts',{keyPath:'id'});s.createIndex('status','status')}if(!d.objectStoreNames.contains('audit')){const s=d.createObjectStore('audit',{keyPath:'id'});s.createIndex('createdAt','createdAt')}if(!d.objectStoreNames.contains('outbox'))d.createObjectStore('outbox',{keyPath:'id'});if(!d.objectStoreNames.contains('config'))d.createObjectStore('config',{keyPath:'key'});if(!d.objectStoreNames.contains('planning')){const s=d.createObjectStore('planning',{keyPath:'id'});s.createIndex('date','date');s.createIndex('analystId','analystId');s.createIndex('status','status')}if(!d.objectStoreNames.contains('planComments')){const s=d.createObjectStore('planComments',{keyPath:'id'});s.createIndex('planId','planId');s.createIndex('analystId','analystId');s.createIndex('createdAt','createdAt')}if(!d.objectStoreNames.contains('dailySamples')){const s=d.createObjectStore('dailySamples',{keyPath:'id'});s.createIndex('date','date');s.createIndex('section','section');s.createIndex('status','status')}if(!d.objectStoreNames.contains('users')){const s=d.createObjectStore('users',{keyPath:'id'});s.createIndex('role','role');s.createIndex('analystId','analystId');s.createIndex('status','status')}if(!d.objectStoreNames.contains('controlChartDefs')){const s=d.createObjectStore('controlChartDefs',{keyPath:'id'});s.createIndex('section','section');s.createIndex('status','status')}if(!d.objectStoreNames.contains('controlChartRecords')){const s=d.createObjectStore('controlChartRecords',{keyPath:'id'});s.createIndex('chartId','chartId');s.createIndex('analystId','analystId');s.createIndex('createdAt','createdAt')}};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function store(name,mode='readonly'){return db.transaction(name,mode).objectStore(name)}
function getAll(name){return new Promise((resolve,reject)=>{const r=store(name).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function getOne(name,key){return new Promise((resolve,reject)=>{const r=store(name).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function put(name,obj){return new Promise((resolve,reject)=>{const r=store(name,'readwrite').put(obj);r.onsuccess=()=>resolve(obj);r.onerror=()=>reject(r.error)})}
function del(name,key){return new Promise((resolve,reject)=>{const r=store(name,'readwrite').delete(key);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error)})}
function clearStore(name){return new Promise((resolve,reject)=>{const r=store(name,'readwrite').clear();r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error)})}
async function actor(){return currentSessionUser?.name||(await getOne('config','defaultUser'))?.value||'USUARIO LOCAL'}
async function audit(action,module,recordId,detail){await put('audit',{id:uid('AUD'),createdAt:nowISO(),action,module,recordId,detail,user:await actor()})}
async function queue(type,entity,payload){
  const recordId=payload?.id||null;
  // 6.33.24.2: una misma carta/registro mantiene UN solo cambio abierto en Outbox.
  // Editar varias veces antes de que Firestore confirme ya no genera PENDIENTE 1, 2, 3...
  // ni deja revisiones antiguas capaces de pisar la última edición.
  if(recordId && type!=='DELETE'){
    const open=(await getAll('outbox')).filter(x=>
      x.entity===entity && x.recordId===recordId &&
      (x.status==='PENDIENTE'||x.status==='ERROR') && x.type!=='DELETE'
    ).sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
    if(open.length){
      const keep=open[0];
      keep.type=open.some(x=>x.type==='CREATE')?'CREATE':type;
      keep.payload=payload;keep.status='PENDIENTE';keep.attempts=0;keep.lastError=null;
      keep.updatedAt=nowISO();keep.sessionId=PAGE_SESSION_ID;
      await put('outbox',keep);
      for(const stale of open.slice(1)){stale.status='SUPERSEDIDO';stale.lastError=null;stale.syncedAt=nowISO();await put('outbox',stale)}
      firebaseBridge.flushRequested=true;await refreshSyncUI();scheduleOutboxFlush(80);return;
    }
  }
  await put('outbox',{
    id:uid('OUT'),createdAt:nowISO(),type,entity,payload,recordId,sessionId:PAGE_SESSION_ID,
    status:'PENDIENTE',attempts:0,lastError:null
  });
  firebaseBridge.flushRequested=true;
  await refreshSyncUI();
  scheduleOutboxFlush(80);
}
function scheduleOutboxFlush(delay=250){
  if(firebaseBridge.flushTimer)clearTimeout(firebaseBridge.flushTimer);
  firebaseBridge.flushTimer=setTimeout(async()=>{
    firebaseBridge.flushTimer=null;
    try{await flushOutbox(false)}catch(e){console.warn('Reintento Outbox',e)}
  },delay);
}
function nextCode(section,all){const m=sectionMeta(section),count=all.filter(x=>x.section===section).length+1;return `CAT-${m.prefix}-${String(count).padStart(5,'0')}`}
function dateToday(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function timeToMinutes(t){if(!t||!t.includes(':'))return 0;const [h,m]=t.split(':').map(Number);return h*60+m}
function minutesToTime(m){m=((Number(m)||0)%1440+1440)%1440;return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`}

const FIREBASE_SYNC_STORES=['catalog','timeRules','compositeSteps','analysts','planning','planComments','controlChartDefs','controlChartRecords'];
// 6.33.4: Cartas usan colecciones propias; el núcleo estable conserva sus colecciones originales.
function cloudCollectionFor(storeName){return storeName}
function cloudPayloadFor(storeName,payload){return sanitizeCloudObject(payload||{})}
// 6.33.25.2: ACK funcional para Cartas. Firestore puede devolver una marca temporal
// distinta aunque el contenido técnico ya esté confirmado. Esas marcas no deben
// mantener un falso PENDIENTE ni provocar SINCRONIZADO -> PARCIAL sin cambios reales.
function sameCloudFunctionalPayload(payload={},cloud={}){
  const ignored=new Set(['_cloudUpdatedAt','_erpEntity','readBy','updatedAt','createdAt','syncedAt']);
  const norm=v=>{
    if(Array.isArray(v))return v.map(norm);
    if(v&&typeof v==='object'){const o={};Object.keys(v).sort().forEach(k=>{if(!ignored.has(k)&&v[k]!==undefined)o[k]=norm(v[k])});return o;}
    return v??null;
  };
  return Object.keys(payload||{}).filter(k=>!ignored.has(k)&&payload[k]!==undefined).every(k=>
    JSON.stringify(norm(payload[k]))===JSON.stringify(norm(cloud[k]))
  );
}
let chartAckReconcileBusy=false;
async function reconcileConfirmedChartOutbox(){
  if(chartAckReconcileBusy||firebaseBridge.busy||!firebaseBridge.ready||!firebaseBridge.authUser)return 0;
  const open=(await getAll('outbox')).filter(x=>(x.entity==='controlChartDefs'||x.entity==='controlChartRecords')&&(x.status==='PENDIENTE'||x.status==='ERROR')&&x.type!=='DELETE');
  if(!open.length)return 0;
  chartAckReconcileBusy=true;let ack=0;
  try{
    const {doc,getDoc}=firebaseBridge.mods;
    for(const item of open){
      try{
        const payload=cloudPayloadFor(item.entity,item.payload||{}),id=payload.id||item.recordId||item.id;
        const snap=await getDoc(doc(firebaseBridge.db,cloudCollectionFor(item.entity),id));
        if(snap.exists()&&sameCloudFunctionalPayload(payload,snap.data()||{})){
          item.status='SINCRONIZADO';item.syncedAt=nowISO();item.lastError=null;
          await put('outbox',item);ack++;
        }
      }catch(e){console.warn('ACK preventivo de Carta no disponible',item.entity,item.recordId,e)}
    }
    if(ack){firebaseBridge.lastError=null;firebaseBridge.lastSyncAt=nowISO();}
    return ack;
  }finally{chartAckReconcileBusy=false;}
}
function cloudDocBelongsToStore(storeName,data={}){return true}
const firebaseBridge={
  configured:false,ready:false,busy:false,db:null,mods:null,unsubs:[],lastError:null,lastSyncAt:null,
  app:null,auth:null,authMods:null,authReady:false,authUser:null,authUnsub:null,flushTimer:null,flushRequested:false
}

function monthStartISO(dateStr=dateToday()){
  const d=new Date(`${dateStr}T12:00:00`);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
}
;
function firebaseConfigValid(){
  const cfg=window.FIREBASE_CONFIG||{};
  return !!(cfg.apiKey&&cfg.projectId&&cfg.appId);
}
function setSyncState(state,detail=''){
  const dot=$('#syncDot'),label=$('#syncLabel'),desc=$('#syncDetail');
  if(dot)dot.className=`sync-dot ${state.toLowerCase()}`;
  if(label)label.textContent=state;
  if(desc)desc.textContent=detail||'';
  // 10.7: no lanzar refresh asíncrono desde aquí. Ese patrón podía terminar
  // después de la confirmación real y dejar visualmente "SINCRONIZANDO".
}
async function refreshSyncUI(){
  if(firebaseBridge.ready&&firebaseBridge.authUser&&!firebaseBridge.busy)await reconcileConfirmedChartOutbox();
  const all=await getAll('outbox');
  const pending=all.filter(x=>x.status==='PENDIENTE');
  const errors=all.filter(x=>x.status==='ERROR');
  const open=pending.length+errors.length;
  if($('#syncPendingCount'))$('#syncPendingCount').textContent=String(open);
  if($('#syncLastAt'))$('#syncLastAt').textContent=firebaseBridge.lastSyncAt?fmtDate(firebaseBridge.lastSyncAt):'—';
  if($('#syncLastError'))$('#syncLastError').textContent=firebaseBridge.lastError||errors[0]?.lastError||'—';
  if($('#syncSettingsState'))$('#syncSettingsState').textContent=firebaseBridge.ready?'Conectado a Firestore':firebaseBridge.configured?'Inicializando / error':'Firebase no configurado';
  if($('#syncConfigBadge')){
    $('#syncConfigBadge').textContent=firebaseBridge.ready?'CONECTADO':'LOCAL';
    $('#syncConfigBadge').className=`sync-config-badge ${firebaseBridge.ready?'connected':''}`;
  }
  // 6.33.5: separar el estado del núcleo ERP de los pendientes exclusivos de Cartas.
  // Un permiso faltante de Cartas no debe hacer creer que todo Firebase dejó de funcionar.
  if(firebaseBridge.ready&&firebaseBridge.authUser&&!firebaseBridge.busy){
    const chartOpen=[...pending,...errors].filter(x=>x.entity==='controlChartDefs'||x.entity==='controlChartRecords');
    const coreOpen=[...pending,...errors].filter(x=>x.entity!=='controlChartDefs'&&x.entity!=='controlChartRecords');
    if(coreOpen.length){
      const coreErrors=coreOpen.filter(x=>x.status==='ERROR');
      setSyncStateVisualOnly(coreErrors.length?'ERROR':'PENDIENTE',`${coreOpen.length} cambio(s) del ERP sin confirmar`);
    }else if(chartOpen.length){
      const permission=chartOpen.some(x=>/permission|insufficient/i.test(String(x.lastError||'')));
      setSyncStateVisualOnly('PARCIAL',permission?`ERP conectado · Cartas pendientes: ${chartOpen.length} (permisos Firebase)`:`ERP conectado · Cartas pendientes: ${chartOpen.length}`);
    }else{
      // 10.7: estado terminal determinista. Si Firestore está conectado y Outbox=0,
      // la UI jamás puede quedarse pegada en "Confirmando cambios…".
      setSyncStateVisualOnly('SINCRONIZADO','Sin cambios pendientes');
    }
  }
}
function setSyncStateVisualOnly(state,detail=''){
  const dot=$('#syncDot'),label=$('#syncLabel'),desc=$('#syncDetail');
  if(dot)dot.className=`sync-dot ${state.toLowerCase()}`;
  if(label)label.textContent=state;
  if(desc)desc.textContent=detail||'';
}
async function initFirebaseBridge(){
  firebaseBridge.configured=firebaseConfigValid();
  refreshAuthUI();
  if(!firebaseBridge.configured){
    setSyncState('LOCAL','Firebase no configurado');
    return false;
  }
  setSyncState('CONECTANDO','Inicializando Firebase…');
  try{
    const [appMod,fsMod,authMod]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js'),
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js')
    ]);
    const app=appMod.initializeApp(window.FIREBASE_CONFIG);
    firebaseBridge.app=app;
    firebaseBridge.db=fsMod.getFirestore(app);
    // V1.0.5.6.7: sesión deliberadamente NO persistente.
    // Cada apertura/recarga exige correo + contraseña y clic en Ingresar.
    // Evita que Firebase restaure automáticamente una sesión anterior.
    firebaseBridge.auth=authMod.initializeAuth(app,{persistence:authMod.inMemoryPersistence});
    firebaseBridge.mods=fsMod;
    firebaseBridge.authMods=authMod;
    firebaseBridge.ready=true;
    firebaseBridge.authReady=true;
    firebaseBridge.lastError=null;
    if(firebaseBridge.authUnsub)firebaseBridge.authUnsub();
    firebaseBridge.authUnsub=authMod.onAuthStateChanged(firebaseBridge.auth,handleFirebaseAuthState);
    setSyncState('SINCRONIZADO','Firebase conectado · esperando sesión');
    const agc=$('#authGateConnection');if(agc)agc.textContent='Firebase conectado · verificando sesión…';
    refreshAuthUI();
    return true;
  }catch(err){
    firebaseBridge.ready=false;firebaseBridge.authReady=false;
    firebaseBridge.lastError=String(err?.message||err);
    setSyncState('ERROR','No se pudo conectar a Firebase');
    showAuthGate('No se pudo conectar a Firebase');
    refreshAuthUI();
    return false;
  }
}

function sanitizeCloudObject(obj){
  return JSON.parse(JSON.stringify(obj,(k,v)=>v===undefined?null:v));
}

function normalizeIdentityText(v=''){
  return String(v||'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .trim().toLowerCase().replace(/\s+/g,' ');
}
async function resolveAnalystLink(profile){
  if(!profile||profile.role!=='ANALISTA')return profile;
  const analysts=await getAll('analysts');
  if(profile.analystId&&analysts.some(a=>a.id===profile.analystId))return profile;

  const targetName=normalizeIdentityText(profile.name);
  const targetEmail=normalizeIdentityText(profile.email);
  let analyst=analysts.find(a=>normalizeIdentityText(a.name)===targetName);

  if(!analyst&&targetEmail){
    analyst=analysts.find(a=>normalizeIdentityText(a.email||'')===targetEmail);
  }
  if(analyst){
    profile={...profile,analystId:analyst.id,analystName:analyst.name};
    await put('users',profile);
  }
  return profile;
}
async function reconcilePlanningAgainstCloud(cloudIds){
  // Firestore es la fuente compartida de verdad para la planificación.
  // Un equipo que estuvo cerrado durante una eliminación no recibe necesariamente
  // un evento `removed` al volver: su primer snapshot solo contiene los documentos
  // que aún existen. Por eso reconciliamos también las AUSENCIAS del snapshot.
  const ids=cloudIds instanceof Set?cloudIds:new Set(cloudIds||[]);
  const outbox=await getAll('outbox');
  const protectedIds=new Set(outbox.filter(x=>
    x.entity==='planning' &&
    (x.status==='PENDIENTE'||x.status==='ERROR') &&
    x.type!=='DELETE'
  ).map(x=>x.payload?.id||x.recordId).filter(Boolean));

  const local=await getAll('planning');
  let removed=0;
  for(const plan of local){
    if(!plan?.id||ids.has(plan.id)||protectedIds.has(plan.id))continue;
    await markPlanningDeleted(plan.id);
    await del('planning',plan.id);
    removed++;
  }
  return removed;
}
async function reconcilePreviousSessionPlanningOutbox(cloudDocs){
  // 10.11 · Al abrir una PC, Firestore manda. Una Outbox heredada de una sesión
  // anterior no puede resucitar una planificación borrada/modificada en otra PC.
  // No se borra evidencia: queda como CONFLICTO_LOCAL para trazabilidad.
  const cloudMap=new Map(cloudDocs.map(d=>[d.id,d.data()||{}]));
  const open=(await getAll('outbox')).filter(x=>x.entity==='planning' &&
    (x.status==='PENDIENTE'||x.status==='ERROR') && x.sessionId!==PAGE_SESSION_ID);
  let quarantined=0, acknowledged=0;
  for(const item of open){
    const payload=cloudPayloadFor('planning',item.payload||{});
    const id=payload.id||item.recordId;
    if(!id)continue;
    const cloud=cloudMap.get(id);
    if(item.type==='DELETE'){
      if(!cloud){item.status='SINCRONIZADO';item.syncedAt=nowISO();item.lastError=null;await put('outbox',item);acknowledged++;}
      continue;
    }
    if(cloud && sameCloudFunctionalPayload(payload,cloud)){
      item.status='SINCRONIZADO';item.syncedAt=nowISO();item.lastError=null;await put('outbox',item);acknowledged++;continue;
    }
    // Si la nube ya no tiene el registro, o contiene otra revisión, se conserva
    // la nube como estado canónico y se impide que el caché antiguo la sobrescriba.
    item.status='CONFLICTO_LOCAL';item.syncedAt=nowISO();
    item.lastError=cloud?'Revisión local antigua; Firestore conserva una revisión diferente':'Planificación local antigua ausente en Firestore';
    await put('outbox',item);quarantined++;
  }
  return {quarantined,acknowledged};
}
async function pullFirebaseStore(storeName){
  if(!firebaseBridge.ready||!FIREBASE_SYNC_STORES.includes(storeName))return 0;
  const {collection,getDocs}=firebaseBridge.mods;
  const physical=cloudCollectionFor(storeName);
  const snap=await getDocs(collection(firebaseBridge.db,physical));
  if(storeName==='planning')await reconcilePreviousSessionPlanningOutbox(snap.docs);
  let count=0;
  for(const d of snap.docs){
    const data=d.data();
    if(!cloudDocBelongsToStore(storeName,data))continue;
    await applyCloudRecord(storeName,d.id,data);
    count++;
  }
  if(storeName==='planning'){
    await reconcilePlanningAgainstCloud(new Set(snap.docs.map(d=>d.id)));
  }
  return count;
}
async function getInitialMigrationState(){
  if(firebaseBridge.ready&&firebaseBridge.authUser){
    try{
      const {doc,getDoc}=firebaseBridge.mods;
      const snap=await getDoc(doc(firebaseBridge.db,'config','initialMigration'));
      if(snap.exists()){
        const state=snap.data();
        if(state?.completed){
          await put('config',{key:'initialMigrationCompleted',value:true});
          await put('config',{key:'initialMigrationCloudState',value:state});
        }
        return state;
      }
    }catch(err){
      console.warn('No se pudo leer estado de migración desde Firestore',err);
    }
  }

  // Contingencia local solo si nube no está disponible.
  const local=(await getOne('config','initialMigrationCloudState'))?.value;
  if(local)return local;

  const done=(await getOne('config','initialMigrationCompleted'))?.value;
  return done?{completed:true,source:'local-cache'}:null;
}
async function refreshMigrationUI(){
  const state=await getInitialMigrationState();
  const el=$('#migrationState');
  const source=$('#migrationSourceLabel');

  if(el){
    el.textContent=state?.completed
      ? `COMPLETADA${state.completedAt?' · '+fmtDate(state.completedAt):''}`
      : 'PENDIENTE';
  }

  if(source){
    source.textContent=state?.completed
      ? 'Firestore · migración global completada'
      : 'Esta PC · IndexedDB';
  }

  const btn=$('#btnInitialMigration');
  if(btn){
    btn.disabled=!!state?.completed
      || currentSessionUser?.role!=='JEFE'
      || !firebaseBridge.authUser;
    btn.classList.toggle('hidden',!!state?.completed);
  }
}
async function initialControlledMigration(){
  if(currentSessionUser?.role!=='JEFE')return toast('Solo el JEFE puede ejecutar la migración inicial');
  if(!firebaseBridge.authUser)return toast('Inicie sesión con Firebase como JEFE');
  if(!firebaseBridge.ready)return toast('Firebase no está conectado');

  const existing=await getInitialMigrationState();
  if(existing?.completed)return toast('La migración inicial ya fue completada');

  const counts={};
  let total=0;
  for(const storeName of FIREBASE_SYNC_STORES){
    const rows=await getAll(storeName);
    counts[storeName]=rows.length;
    total+=rows.length;
  }

  const detail=Object.entries(counts).map(([k,v])=>`${k}: ${v}`).join('\n');
  if(!confirm(
    `MIGRACIÓN INICIAL CONTROLADA\n\n`+
    `Se subirán ${total} registros desde ESTA computadora a Firestore.\n\n`+
    `${detail}\n\n`+
    `No se borrará IndexedDB ni se eliminarán datos locales.\n\n¿Continuar?`
  ))return;

  const btn=$('#btnInitialMigration');
  if(btn){btn.disabled=true;btn.textContent='Migrando…'}
  setSyncState('SINCRONIZANDO','Migración inicial controlada…');

  try{
    const {doc,setDoc,writeBatch}=firebaseBridge.mods;
    let batch=writeBatch(firebaseBridge.db);
    let ops=0,uploaded=0;

    async function commitBatch(){
      if(!ops)return;
      await batch.commit();
      batch=writeBatch(firebaseBridge.db);
      ops=0;
    }

    for(const storeName of FIREBASE_SYNC_STORES){
      const rows=await getAll(storeName);
      for(const row of rows){
        if(!row?.id)continue;
        const payload=cloudPayloadFor(storeName,{...row,_cloudUpdatedAt:nowISO()});
        batch.set(doc(firebaseBridge.db,cloudCollectionFor(storeName),row.id),payload,{merge:true});
        ops++;
        uploaded++;
        if(ops>=400)await commitBatch();
      }
    }
    await commitBatch();

    const migrationDoc={
      completed:true,
      completedAt:nowISO(),
      completedByUid:firebaseBridge.authUser.uid,
      completedByEmail:firebaseBridge.authUser.email||'',
      appVersion:APP_VERSION,
      sourceDb:DB_NAME,
      counts,
      uploaded
    };
    await setDoc(doc(firebaseBridge.db,'config','initialMigration'),migrationDoc,{merge:true});

    firebaseBridge.lastSyncAt=nowISO();
    await put('config',{key:'lastCloudSyncAt',value:firebaseBridge.lastSyncAt});
    await put('config',{key:'initialMigrationCompleted',value:true});
    await audit('MIGRACION_INICIAL_FIREBASE','SISTEMA','FIREBASE',`${uploaded} registros subidos a Firestore`);

    startRealtimeSync();
    await refreshMigrationUI();
    setSyncState('SINCRONIZADO',`${uploaded} registros migrados`);
    toast(`Migración completada · ${uploaded} registros`);
  }catch(err){
    firebaseBridge.lastError=String(err?.message||err);
    setSyncState('ERROR','Falló la migración inicial');
    toast('No se pudo completar la migración');
    console.error('Migración inicial Firebase',err);
  }finally{
    if(btn)btn.textContent='↑ Migración inicial controlada';
    await refreshMigrationUI();
  }
}
async function flushOutbox(showToast=true){
  if(firebaseBridge.busy){
    firebaseBridge.flushRequested=true;
    scheduleOutboxFlush(350);
    return false;
  }
  if(firebaseBridge.configured&&firebaseBridge.authReady&&!firebaseBridge.authUser){
    if(showToast)toast('Inicie sesión para sincronizar');
    return false;
  }
  if(!firebaseBridge.ready){
    if(showToast)toast('Firebase aún no está configurado');
    await refreshSyncUI();
    return false;
  }

  firebaseBridge.busy=true;
  firebaseBridge.flushRequested=false;
  setSyncState('SINCRONIZANDO','Confirmando cambios en Firestore…');
  let sent=0;
  let failed=0;

  try{
    const {doc,setDoc,deleteDoc,getDoc}=firebaseBridge.mods;
    const items=(await getAll('outbox'))
      .filter(x=>x.status==='PENDIENTE'||x.status==='ERROR')
      .sort((a,b)=>a.createdAt.localeCompare(b.createdAt));

    for(const item of items){
      try{
        if(!FIREBASE_SYNC_STORES.includes(item.entity)){
          item.status='OMITIDO';
          item.lastError=`Entidad no sincronizable: ${item.entity}`;
          await put('outbox',item);
          continue;
        }

        const payload=cloudPayloadFor(item.entity,item.payload||{});
        const id=payload.id||item.recordId||item.id;
        const ref=doc(firebaseBridge.db,cloudCollectionFor(item.entity),id);

        if(item.type==='DELETE'){
          // 6.33.21.1: las definiciones de Cartas de Control no se eliminan físicamente.
          // Versiones antiguas pudieron dejar DELETEs pendientes por una deduplicación agresiva.
          // Se neutralizan y, si existe copia local, se restaura en Firestore.
          if(item.entity==='controlChartDefs'){
            const localDef=await getOne('controlChartDefs',id);
            if(localDef){
              const cloudStamp=nowISO();
              await setDoc(ref,{...cloudPayloadFor('controlChartDefs',localDef),_cloudUpdatedAt:cloudStamp},{merge:true});
            }
          }else{
            // deleteDoc resuelto = confirmación del backend; la verificación por lectura
            // queda reservada únicamente para la ruta de error/reconciliación.
            await deleteDoc(ref);
          }
        }else{
          const cloudStamp=nowISO();
          // 10.7: en Firestore Web, la Promise de setDoc se resuelve cuando el backend
          // confirma la escritura. Una segunda lectura getDoc duplicaba la latencia y
          // mantenía innecesariamente el indicador en "Confirmando".
          await setDoc(ref,{...payload,_cloudUpdatedAt:cloudStamp},{merge:true});
        }

        item.status='SINCRONIZADO';
        item.syncedAt=nowISO();
        item.lastError=null;
        item.attempts=Number(item.attempts||0)+1;
        await put('outbox',item);
        sent++;
      }catch(err){
        // Algunos Chrome/PWA pueden perder la respuesta de confirmación aunque
        // Firestore sí haya aplicado la escritura. Antes de pintar ERROR, leer
        // el documento y comprobar el resultado real para evitar falsos rojos.
        let confirmedDespiteClientError=false;
        try{
          const payload=cloudPayloadFor(item.entity,item.payload||{});
          const id=payload.id||item.recordId||item.id;
          const ref=doc(firebaseBridge.db,cloudCollectionFor(item.entity),id);
          const check=await getDoc(ref);
          if(item.type==='DELETE'){
            confirmedDespiteClientError=!check.exists();
          }else if(check.exists()){
            const cloud=check.data()||{};
            confirmedDespiteClientError=sameCloudFunctionalPayload(payload,cloud);
          }
        }catch(verifyErr){
          console.warn('No se pudo verificar el cambio tras error del cliente',verifyErr);
        }
        item.attempts=Number(item.attempts||0)+1;
        if(confirmedDespiteClientError){
          item.status='SINCRONIZADO';
          item.syncedAt=nowISO();
          item.lastError=null;
          await put('outbox',item);
          sent++;
          console.info('Outbox confirmado por lectura cloud tras error transitorio',item.entity,item.recordId||item.payload?.id);
        }else{
          item.status='ERROR';
          item.lastError=String(err?.message||err);
          await put('outbox',item);
          failed++;
          // No abortar el lote completo: continuar con otros registros.
          console.error('Outbox item falló',item.entity,item.recordId||item.payload?.id,err);
        }
      }
    }

    const open=(await getAll('outbox')).filter(x=>x.status==='PENDIENTE'||x.status==='ERROR');
    if(open.length){
      firebaseBridge.lastError=open[0]?.lastError||`${open.length} cambio(s) pendientes`;
      setSyncStateVisualOnly(failed?'ERROR':'PENDIENTE',`${open.length} cambio(s) sin confirmar`);
      firebaseBridge.flushRequested=true;
      scheduleOutboxFlush(2500);
      if(showToast)toast(`${open.length} cambio(s) siguen pendientes`);
      return false;
    }

    firebaseBridge.lastSyncAt=nowISO();
    firebaseBridge.lastError=null;
    await put('config',{key:'lastCloudSyncAt',value:firebaseBridge.lastSyncAt});
    setSyncState('SINCRONIZADO',sent?`${sent} cambio(s) confirmados en Firestore`:'Sin cambios pendientes');
    if(showToast)toast(sent?`${sent} cambio(s) confirmados`:'Todo está sincronizado');
    return true;
  }finally{
    firebaseBridge.busy=false;
    await refreshSyncUI();
    try{await renderControlChartEngine()}catch(e){console.warn('Estado visual de Cartas pendiente',e)}
    if(firebaseBridge.flushRequested)scheduleOutboxFlush(400);
  }
}
function shouldAcceptCloud(local,remote){
  if(!local)return true;
  const lt=String(local.updatedAt||local.createdAt||'');
  const rt=String(remote.updatedAt||remote.createdAt||remote._cloudUpdatedAt||'');
  return rt>lt;
}
async function applyCloudRecord(storeName,id,data){
  if(!FIREBASE_SYNC_STORES.includes(storeName))return;
  const clean={...data,id:data.id||id};delete clean._cloudUpdatedAt;delete clean._erpEntity;
  // Si este equipo ya eliminó una planificación, una lectura atrasada de Firestore
  // no puede resucitarla mientras se confirma el DELETE remoto.
  if(storeName==='planning' && await isPlanningDeleted(clean.id)){
    await del('planning',clean.id);
    return;
  }
  const local=await getOne(storeName,clean.id);
  // 6.33.24.2: protección LOCAL-FIRST mientras existe una escritura abierta.
  // Un snapshot de Firestore puede llegar entre put(local) y setDoc(cloud). Esa copia
  // remota anterior NO debe restaurar el nombre viejo ni hacer desaparecer una carta nueva.
  if(local){
    const openItems=(await getAll('outbox')).filter(x=>
      x.entity===storeName && x.recordId===clean.id &&
      (x.status==='PENDIENTE'||x.status==='ERROR') && x.type!=='DELETE'
    );
    if(openItems.length){
      // 6.33.24.4: el listener realtime también actúa como ACK de Firestore.
      // Si la nube ya contiene exactamente la revisión que está en Outbox, el cambio
      // se confirma aquí mismo. Evita el falso ciclo SINCRONIZADO -> PARCIAL 1/2 ->
      // SINCRONIZADO que aparecía segundos después sin que el usuario hiciera nada.
      const same=(payload,cloud)=>sameCloudFunctionalPayload(payload,cloud);
      let acknowledged=false;
      for(const item of openItems){
        const payload=cloudPayloadFor(storeName,item.payload||{});
        if(same(payload,clean)){
          item.status='SINCRONIZADO';item.syncedAt=nowISO();item.lastError=null;
          item.attempts=Number(item.attempts||0);await put('outbox',item);acknowledged=true;
        }
      }
      const stillOpen=(await getAll('outbox')).some(x=>x.entity===storeName&&x.recordId===clean.id&&(x.status==='PENDIENTE'||x.status==='ERROR')&&x.type!=='DELETE');
      if(stillOpen)return;
      if(acknowledged){firebaseBridge.lastError=null;firebaseBridge.lastSyncAt=nowISO();}
    }
  }
  if(shouldAcceptCloud(local,clean))await put(storeName,clean);
}
async function pullFirebaseData(showToast=true){
  if(firebaseBridge.configured&&firebaseBridge.authReady&&!firebaseBridge.authUser){
    if(showToast)toast('Inicie sesión para actualizar desde nube');return
  }
  if(!firebaseBridge.ready){if(showToast)toast('Firebase aún no está configurado');return}
  setSyncState('SINCRONIZANDO','Actualizando datos desde nube…');
  try{
    let count=0;
    for(const storeName of FIREBASE_SYNC_STORES){
      count+=await pullFirebaseStore(storeName);
    }
    firebaseBridge.lastSyncAt=nowISO();firebaseBridge.lastError=null;
    await put('config',{key:'lastCloudSyncAt',value:firebaseBridge.lastSyncAt});
    setSyncState('SINCRONIZADO',`${count} registro(s) revisados`);
    await refreshAll();
    if(showToast)toast('Datos actualizados desde Firebase');
  }catch(err){
    firebaseBridge.lastError=String(err?.message||err);setSyncState('ERROR','Error al leer Firestore');
    if(showToast)toast('No se pudo actualizar desde Firebase');
  }
}
function stopRealtimeSync(){
  firebaseBridge.unsubs.forEach(fn=>{try{fn()}catch{}});
  firebaseBridge.unsubs=[];
}
function startRealtimeSync(){
  stopRealtimeSync();
  if(!firebaseBridge.ready)return;
  const {collection,onSnapshot}=firebaseBridge.mods;
  FIREBASE_SYNC_STORES.forEach(storeName=>{
    let listenerReady=false;
    const physical=cloudCollectionFor(storeName);
    const unsub=onSnapshot(collection(firebaseBridge.db,physical),async snap=>{
      let changed=false, incomingComments=[];
      for(const ch of snap.docChanges()){
        const chData=ch.doc.data()||{};
        if(!cloudDocBelongsToStore(storeName,chData))continue;
        if(ch.type==='removed'){
          // 6.33.21.1: una definición de carta nunca desaparece por sincronización.
          // En este ERP las cartas se DESACTIVAN; no existe borrado físico desde la UI.
          // Esto protege frente a clientes antiguos que todavía intenten borrar por deduplicación.
          if(storeName==='controlChartDefs'){
            const localDef=await getOne('controlChartDefs',ch.doc.id);
            if(localDef&&currentSessionUser?.role==='JEFE'){
              const already=(await getAll('outbox')).some(x=>x.entity==='controlChartDefs'&&x.recordId===localDef.id&&(x.status==='PENDIENTE'||x.status==='ERROR'));
              if(!already)await queue('UPDATE','controlChartDefs',{...localDef,updatedAt:localDef.updatedAt||nowISO()});
            }
            changed=true;
            continue;
          }
          const pending=(await getAll('outbox')).some(x=>
            x.entity===storeName &&
            (x.payload?.id||x.id)===ch.doc.id &&
            (x.status==='PENDIENTE'||x.status==='ERROR')
          );
          if(!pending)await del(storeName,ch.doc.id);
          changed=true;
          continue;
        }
        await applyCloudRecord(storeName,ch.doc.id,chData);changed=true;
        if(storeName==='planComments'&&listenerReady&&ch.type==='added')incomingComments.push({...ch.doc.data(),id:ch.doc.id});
      }
      // En planning no basta con procesar docChanges(): si este equipo estuvo
      // desconectado cuando otro eliminó una actividad, el snapshot inicial no trae
      // un `removed` para ese registro viejo local. Comparamos la lista completa de
      // IDs que existen AHORA en Firestore y retiramos cualquier planificación local
      // huérfana (salvo cambios locales todavía pendientes de subir).
      if(storeName==='planning'){
        const pruned=await reconcilePlanningAgainstCloud(new Set(snap.docs.map(d=>d.id)));
        if(pruned)changed=true;
      }
      if(changed){
        firebaseBridge.lastSyncAt=nowISO();
        const open=(await getAll('outbox')).filter(x=>x.status==='PENDIENTE'||x.status==='ERROR');
        if(open.length)await refreshSyncUI();
        else setSyncState('SINCRONIZADO','Cambios recibidos en tiempo real');
        await reconcileVisibleInterface(storeName);
        if(storeName==='planComments'){
          await refreshNotificationBadge();
          const newest=incomingComments.filter(c=>communicationVisibleComment(c)&&!isOwnCommunication(c)).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))[0];
          if(newest){await showCommunicationPopup(newest);await showSystemControlCompletionNotification(newest);}
        }
      }
      listenerReady=true;
    },err=>{
      firebaseBridge.lastError=`${storeName}: ${String(err?.message||err)}`;
      console.error('Listener Firestore',storeName,err);
      if(storeName==='controlChartDefs'||storeName==='controlChartRecords'){
        setSyncStateVisualOnly('PARCIAL',`ERP conectado · Cartas sin permiso en Firestore`);
        refreshSyncUI();
      }else{
        setSyncState('ERROR',`Escucha interrumpida · ${storeName}`);
      }
    });
    firebaseBridge.unsubs.push(unsub);
  });
}
// 6.33.25.10.6 · Reconciliación multi-PC.
// Firestore sigue siendo la fuente compartida; IndexedDB conserva la base local.
// Un cambio remoto actualiza también la vista actualmente visible, sin crear escrituras nuevas.
let interfaceReconcileBusy=false;
let interfaceReconcileQueued=false;
let lastInterfaceReconcileAt=0;
// 10.8 · Estabilidad de interfaz: una sincronización en segundo plano jamás debe
// desmontar un formulario que el usuario está usando. Firestore actualiza IndexedDB
// en tiempo real; la vista se repinta solo cuando corresponde y no existe un borrador activo.
function plannerHasActiveDraft(){
  const view=$('#view-planificador');
  if(!view?.classList.contains('active'))return false;
  const ae=document.activeElement;
  if(ae&&view.contains(ae)&&/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(ae.tagName))return true;
  return !!(
    ($('#planCatalog')?.value||'') || ($('#planActivitySearch')?.value||'').trim() ||
    ($('#planAnalyst')?.value||'') || ($('#planNotes')?.value||'').trim() ||
    ($('#planSamples')?.value||'')
  );
}
function remoteChangeRelevantToView(view,reason){
  if(['RESUME','MANUAL','QUEUED'].includes(reason))return true;
  const map={
    'planificador':new Set(['planning','catalog','analysts','timeRules']),
    'mi-jornada':new Set(['planning','planComments','controlChartDefs','controlChartRecords']),
    'seguimiento-diario':new Set(['planning','planComments']),
    'gestion':new Set(['planning','planComments']),
    'cartas-control':new Set(['controlChartDefs','controlChartRecords']),
    'catalogo':new Set(['catalog']),
    'analistas':new Set(['analysts']),
    'trazabilidad':new Set(['audit']),
    'inicio':new Set(['planning','catalog','analysts','planComments'])
  };
  return !map[view]||map[view].has(reason);
}
async function reconcileVisibleInterface(reason='REMOTE'){
  if(interfaceReconcileBusy){interfaceReconcileQueued=true;return;}
  interfaceReconcileBusy=true;
  try{
    const active=document.querySelector('.nav-item.active')?.dataset.view||'';
    // La campana sí puede actualizarse sin tocar el formulario activo.
    await refreshNotificationBadge();
    if(!remoteChangeRelevantToView(active,reason))return;
    if(active==='planificador'&&plannerHasActiveDraft()){
      // Los datos ya están reconciliados en IndexedDB. Se difiere únicamente el repintado
      // para no cerrar selects, borrar búsquedas ni reiniciar una planificación en curso.
      return;
    }
    if(active==='inicio')await renderDashboard();
    else if(active==='mi-jornada')await renderMyDay();
    else if(active==='planificador')await refreshPlanner();
    else if(active==='seguimiento-diario')await renderDailyMonitor();
    else if(active==='gestion')await renderManagementDashboard();
    else if(active==='cartas-control')await renderControlChartsManagement();
    else if(active==='catalogo')await renderCatalog();
    else if(active==='analistas')await renderAnalysts();
    else if(active==='trazabilidad')await renderAudit();
    else if(active==='inteligencia')await analyzeData(true);
    else if(active==='configuracion')await renderControlChartEngine();
    lastInterfaceReconcileAt=Date.now();
    const open=(await getAll('outbox')).filter(x=>x.status==='PENDIENTE'||x.status==='ERROR');
    if(firebaseBridge.ready&&firebaseBridge.authUser&&!open.length){
      setSyncStateVisualOnly('SINCRONIZADO','Firestore + interfaz actualizados');
    }
  }catch(e){
    console.warn('Reconciliación visual multi-PC',reason,e);
  }finally{
    interfaceReconcileBusy=false;
    if(interfaceReconcileQueued){interfaceReconcileQueued=false;setTimeout(()=>reconcileVisibleInterface('QUEUED'),60);}
  }
}
async function reconcileAfterResume(force=false){
  if(!firebaseBridge.ready||!firebaseBridge.authUser)return;
  // Al volver de minimizado/foco, primero resolver Outbox/nube y después repintar.
  await resumeCloudSession(force);
  await reconcileVisibleInterface('RESUME');
}

async function manualSync(){
  if(!firebaseBridge.ready){
    const ok=await initFirebaseBridge();
    if(!ok)return;
  }
  await flushOutbox(false);
  await pullFirebaseData(false);
  toast('Sincronización completada');
}

const WORK_START=8*60, LUNCH_START=12*60, LUNCH_END=13*60, WORK_END=17*60;
const OPERATIONAL_ANALYST_NAMES=['Joe Franco','Lizbeth Prieto','Maria elena','Nidia Sanchez'];
function isOperationalAnalyst(a){
  return !!a && OPERATIONAL_ANALYST_NAMES.some(n=>n.toLowerCase()===String(a.name||'').trim().toLowerCase());
}
function addWorkingMinutes(start,duration){
  let t=Number(start)||0, remaining=Number(duration)||0;
  if(t<WORK_START)t=WORK_START;
  if(t>=LUNCH_START&&t<LUNCH_END)t=LUNCH_END;
  while(remaining>0){
    if(t>=LUNCH_START&&t<LUNCH_END){t=LUNCH_END;continue}
    const boundary=t<LUNCH_START?LUNCH_START:WORK_END;
    const available=Math.max(0,boundary-t);
    if(remaining<=available){t+=remaining;remaining=0;break}
    remaining-=available;t=boundary;
    if(t===LUNCH_START)t=LUNCH_END;
    else if(t>=WORK_END){t+=remaining;remaining=0}
  }
  return t;
}
function workingSegments(start,duration){
  let t=Number(start)||0, rem=Number(duration)||0, seg=[];
  if(t<WORK_START)t=WORK_START;
  if(t>=LUNCH_START&&t<LUNCH_END)t=LUNCH_END;
  while(rem>0){
    if(t>=LUNCH_START&&t<LUNCH_END){t=LUNCH_END;continue}
    const boundary=t<LUNCH_START?LUNCH_START:WORK_END;
    const take=Math.min(rem,Math.max(0,boundary-t));
    if(take>0){seg.push([t,t+take]);t+=take;rem-=take}
    if(t===LUNCH_START)t=LUNCH_END;
    else if(t>=WORK_END&&rem>0){seg.push([t,t+rem]);rem=0}
  }
  return seg;
}
function workOverlap(startA,durA,startB,durB){
  return workingSegments(startA,durA).some(a=>workingSegments(startB,durB).some(b=>a[0]<b[1]&&b[0]<a[1]));
}
async function planCatalogDuration(item,samples){if(!item)return {minutes:0,detail:'Seleccione una actividad'};if(item.timeMode==='FIXED'||item.timeMode==='COMPOSITE')return {minutes:Number(item.baseMinutes||0),detail:item.timeMode==='COMPOSITE'?'Bloque compuesto':'Tiempo fijo'};if(item.timeMode==='BY_SAMPLES'){const n=Number(samples||0);if(!n)return {minutes:0,detail:'Ingrese el número de muestras'};const rr=(await getAll('timeRules')).filter(r=>r.catalogId===item.id).sort((a,b)=>Number(a.minSamples)-Number(b.minSamples));const r=rr.find(x=>n>=Number(x.minSamples)&&n<=Number(x.maxSamples));return r?{minutes:Number(r.minutes||0),detail:`${n} muestras · rango ${r.minSamples}-${r.maxSamples}`}:{minutes:0,detail:`No existe regla para ${n} muestras`}}return {minutes:0,detail:'Sin tiempo configurado'}}
async function renderPlanSelectors(){
  const cat=(await getAll('catalog')).filter(x=>x.status==='ACTIVO');
  const sec=$('#planSection');if(!sec)return;
  const previous=sec.value;
  sec.innerHTML=SECTIONS.map(s=>`<option value="${s.id}">${s.label}</option>`).join('');
  if(previous&&SECTIONS.some(s=>s.id===previous))sec.value=previous;
  const section=sec.value||SECTIONS[0].id;
  const search=($('#planActivitySearch')?.value||'').trim().toLowerCase();
  let items=cat.filter(x=>x.section===section);
  if(search){
    items=items.filter(x=>`${x.name||''} ${x.family||''} ${x.code||''}`.toLowerCase().includes(search))
      .sort((a,b)=>{
        const an=(a.name||'').toLowerCase(),bn=(b.name||'').toLowerCase();
        const ap=an.startsWith(search)?0:1,bp=bn.startsWith(search)?0:1;
        return ap-bp||an.localeCompare(bn,'es');
      });
  }else items=items.sort((a,b)=>a.name.localeCompare(b.name,'es'));
  const sel=$('#planCatalog'),prev=sel.value;
  sel.innerHTML='<option value="">Seleccione...</option>'+items.map(x=>`<option value="${x.id}">${escapeHtml(x.name)}${x.family?` · ${escapeHtml(x.family)}`:''}</option>`).join('');
  if(prev&&items.some(x=>x.id===prev))sel.value=prev;
  if($('#planActivitySearchInfo')){
    $('#planActivitySearchInfo').textContent=search?`${items.length} resultado(s) en ${sectionMeta(section).label}`:`${items.length} actividad(es) disponibles`;
  }
  await renderAnalystOptions();
  await updatePlanPreview();
}
async function renderAnalystOptions(){if(!$('#planAnalyst'))return;const section=$('#planSection').value;const ana=(await getAll('analysts')).filter(a=>a.status==='ACTIVO'&&(a.competencies||[]).includes(section)).sort((a,b)=>a.name.localeCompare(b.name,'es'));const cur=$('#planAnalyst').value;$('#planAnalyst').innerHTML='<option value="">Seleccione o use sugerencia inteligente</option>'+ana.map(a=>`<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');if(ana.some(a=>a.id===cur))$('#planAnalyst').value=cur}


const ACTUAL_SAMPLE_SECTIONS=['RECEPCION_MUESTRAS','MICROBIOLOGIA','AASS'];
function requiresActualSamples(section){return ACTUAL_SAMPLE_SECTIONS.includes(section)}

let historicalDurationOverride=null;
let historicalOverrideCatalogId=null;

function realWorkMinutesBetween(startIso,endIso){
  if(!startIso||!endIso)return 0;
  const a=new Date(startIso),b=new Date(endIso);
  if(!(b>a))return 0;
  let total=Math.round((b-a)/60000);
  if(a.toDateString()===b.toDateString()){
    const as=a.getHours()*60+a.getMinutes(),bs=b.getHours()*60+b.getMinutes();
    const lunchOverlap=Math.max(0,Math.min(bs,LUNCH_END)-Math.max(as,LUNCH_START));
    total-=lunchOverlap;
  }
  return Math.max(0,total);
}
function roundTo5(n){return Math.max(5,Math.round(Number(n||0)/5)*5)}
async function historicalProfile(item,samples){
  if(!item)return null;
  const all=(await getAll('planning')).filter(p=>p.catalogId===item.id&&p.status==='REALIZADO'&&p.actualStartedAt&&p.actualFinishedAt);
  let rows=all.map(p=>({...p,realMinutes:realWorkMinutesBetween(p.actualStartedAt,p.actualFinishedAt)})).filter(p=>p.realMinutes>0);
  const sampleN=Number(samples||0);
  if(item.timeMode==='BY_SAMPLES'&&sampleN>0){
    const close=rows.filter(p=>(p.actualSamples||p.samples)&&Math.abs(Number(p.actualSamples||p.samples)-sampleN)<=Math.max(2,Math.ceil(sampleN*.35)));
    if(close.length>=2)rows=close;
  }
  rows=rows.sort((a,b)=>String(b.actualFinishedAt).localeCompare(String(a.actualFinishedAt))).slice(0,20);
  if(!rows.length)return {count:0,rows:[],confidence:'SIN DATOS'};
  const vals=rows.map(r=>r.realMinutes).sort((a,b)=>a-b);
  const avg=Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
  const median=vals.length%2?vals[(vals.length-1)/2]:Math.round((vals[vals.length/2-1]+vals[vals.length/2])/2);
  const recommended=roundTo5((avg+median)/2);
  const byAnalyst={};
  rows.forEach(r=>{const k=r.analystId;if(!byAnalyst[k])byAnalyst[k]={id:k,name:r.analystName,count:0,total:0};byAnalyst[k].count++;byAnalyst[k].total+=r.realMinutes});
  const analystStats=Object.values(byAnalyst).map(x=>({...x,avg:Math.round(x.total/x.count)})).sort((a,b)=>b.count-a.count||a.avg-b.avg);
  const confidence=rows.length>=8?'ALTA':rows.length>=4?'MEDIA':rows.length>=2?'BAJA':'MUY BAJA';
  return {count:rows.length,avg,median,recommended,confidence,analystStats,rows};
}
async function renderHistoricalIntelligence(){
  if(!$('#historicalAI'))return;
  const item=(await getAll('catalog')).find(x=>x.id===$('#planCatalog').value);
  if(!item){$('#historicalAI').classList.add('hidden');return}
  const configured=(await planCatalogDuration(item,$('#planSamples').value)).minutes;
  const hp=await historicalProfile(item,$('#planSamples').value);
  $('#historicalAI').classList.remove('hidden');
  if(!hp||!hp.count){
    $('#historicalAI').innerHTML=`<div class="hist-ai-head"><b>✦ Aprendizaje histórico</b><span>Sin ejecuciones reales suficientes todavía.</span></div><p>Cuando los analistas finalicen esta actividad, el sistema aprenderá sus tiempos reales y experiencia por parámetro.</p>`;
    return;
  }
  const diff=hp.recommended-configured;
  const exp=hp.analystStats.slice(0,3).map(x=>`<span><b>${escapeHtml(x.name)}</b> · ${x.count} ejecución(es) · prom. ${minutesText(x.avg)}</span>`).join('');
  $('#historicalAI').innerHTML=`<div class="hist-ai-head"><div><b>✦ Propuesta basada en histórico</b><span>Confianza ${hp.confidence} · ${hp.count} ejecución(es) comparable(s)</span></div><button class="btn secondary compact" id="btnUseHistoricalTime">Usar ${minutesText(hp.recommended)}</button></div>
    <div class="hist-ai-grid"><div><small>Tiempo catálogo</small><strong>${minutesText(configured)}</strong></div><div><small>Promedio real</small><strong>${minutesText(hp.avg)}</strong></div><div><small>Mediana real</small><strong>${minutesText(hp.median)}</strong></div><div><small>IA recomienda</small><strong>${minutesText(hp.recommended)}</strong></div></div>
    <div class="hist-ai-note">${diff===0?'El histórico confirma el tiempo configurado.':diff>0?`Históricamente esta actividad tarda aproximadamente ${minutesText(diff)} más que el catálogo.`:`Históricamente termina aproximadamente ${minutesText(Math.abs(diff))} antes que el catálogo.`}</div>
    <div class="hist-experience"><b>Experiencia observada</b>${exp||'<span>Sin detalle por analista.</span>'}</div>`;
  const btn=$('#btnUseHistoricalTime');
  if(btn)btn.onclick=async()=>{historicalDurationOverride=hp.recommended;historicalOverrideCatalogId=item.id;toast(`Tiempo histórico aplicado: ${minutesText(hp.recommended)}`);await updatePlanPreview();await suggestAnalyst()};
}
async function effectivePlanDuration(item,samples){
  const base=await planCatalogDuration(item,samples);
  if(item&&historicalOverrideCatalogId===item.id&&historicalDurationOverride)return {...base,minutes:historicalDurationOverride,source:'HISTORICO'};
  return {...base,source:'CATALOGO'};
}

async function updatePlanPreview(){if(!$('#planCatalog'))return;const id=$('#planCatalog').value,item=(await getAll('catalog')).find(x=>x.id===id);$('#planSamplesLabel').classList.toggle('hidden',!item||item.timeMode!=='BY_SAMPLES');const dur=await effectivePlanDuration(item,$('#planSamples').value);$('#planDuration').value=dur.minutes?`${minutesText(dur.minutes)}${dur.source==='HISTORICO'?' · histórico':''}`:dur.detail;const start=timeToMinutes($('#planStart').value);$('#planEnd').value=dur.minutes?minutesToTime(addWorkingMinutes(start,dur.minutes)):'';const steps=item?(await getAll('compositeSteps')).filter(s=>s.catalogId===item.id).sort((a,b)=>a.order-b.order):[];$('#planBreakdown').classList.toggle('hidden',!steps.length);$('#planBreakdown').innerHTML=steps.length?`<b>Desglose del bloque · ${minutesText(dur.minutes)}</b>${steps.map(s=>`<span>${escapeHtml(s.name)} · ${minutesText(s.minutes)}</span>`).join('')}`:'';await renderHistoricalIntelligence();await renderDailyLoad();await renderAgenda()}
async function planningForDate(date){return (await visiblePlanningRows()).filter(p=>p.date===date&&p.status!=='CANCELADO')}
function overlaps(aStart,aEnd,bStart,bEnd){return aStart<bEnd&&bStart<aEnd}
function analystBusySegments(plans,analystId){
  const segs=[];
  plans.filter(p=>p.analystId===analystId).forEach(p=>{
    workingSegments(timeToMinutes(p.startTime),Number(p.durationMinutes||0)).forEach(x=>segs.push(x));
  });
  return segs.sort((a,b)=>a[0]-b[0]);
}
function findBestWorkSlot(plans,analystId,duration){
  const busy=analystBusySegments(plans,analystId);

  // Regla V1.0.5.6.6: priorizar el primer minuto laboral libre en orden cronológico.
  // Una actividad puede continuar después del almuerzo sin "saltar" a las 13:00
  // solo porque no cabe completa antes de las 12:00. Ejemplo: si ya existe 08:00–11:00
  // y la siguiente dura 3 h, se propone 11:00–15:00 (trabaja 11–12 y 13–15).
  for(let start=WORK_START;start<WORK_END;start+=5){
    if(start>=LUNCH_START&&start<LUNCH_END)continue;
    const end=addWorkingMinutes(start,duration);
    if(end>WORK_END)break;
    const candidate=workingSegments(start,duration);
    if(!busy.some(([bs,be])=>candidate.some(([ss,se])=>ss<be&&bs<se)))
      return {start,end};
  }
  return null;
}
async function suggestScheduleForAnalyst(analystId){
  const item=(await getAll('catalog')).find(x=>x.id===$('#planCatalog').value);
  const date=$('#planDate').value;
  const dur=(await effectivePlanDuration(item,$('#planSamples').value)).minutes;
  if(!item||!date||!analystId||!dur)return null;
  const plans=await planningForDate(date);
  return findBestWorkSlot(plans,analystId,dur);
}
async function scoreAnalysts(){
  const cat=(await getAll('catalog')).find(x=>x.id===$('#planCatalog').value),date=$('#planDate').value,
  dur=(await effectivePlanDuration(cat,$('#planSamples').value)).minutes;
  if(!cat||!date||!dur)return {error:'Complete fecha, actividad y cantidad de muestras si aplica.'};
  const plans=await planningForDate(date),
  anas=(await getAll('analysts')).filter(a=>a.status==='ACTIVO'&&isOperationalAnalyst(a)&&(a.competencies||[]).includes(cat.section));
  if(!anas.length)return {error:'No hay analistas activos con competencia para esta sección.'};
  const hp=await historicalProfile(cat,$('#planSamples').value);
  const ranked=anas.map(a=>{
    const own=plans.filter(p=>p.analystId===a.id),load=own.reduce((t,p)=>t+Number(p.durationMinutes||0),0),
    capacity=Number(a.dailyHours||8)*60,remaining=capacity-load,overload=Math.max(0,load+dur-capacity),
    slot=findBestWorkSlot(plans,a.id,dur),hist=hp?.analystStats?.find(x=>x.id===a.id),experience=hist?.count||0,histAvg=hist?.avg||0;
    let score=(slot?150:0)-overload/2-(load/capacity)*25+Math.min(30,experience*6)+(histAvg&&hp?.recommended?Math.max(-10,10-Math.abs(histAvg-hp.recommended)/6):0);
    return {a,load,capacity,remaining,overload,slot,score,experience,histAvg};
  }).sort((x,y)=>y.score-x.score);
  return {ranked,dur,cat,date,hp};
}
async function suggestAnalyst(){
  const box=$('#recommendationBox'),r=await scoreAnalysts();
  if(r.error){box.className='recommendation-box error';box.innerHTML=`<b>No se puede recomendar todavía</b><span>${escapeHtml(r.error)}</span>`;return}
  const best=r.ranked.find(x=>x.slot&&!x.overload)||r.ranked.find(x=>x.slot)||r.ranked[0];
  $('#planAnalyst').value=best.a.id;
  if(best.slot){
    $('#planStart').value=minutesToTime(best.slot.start);
    $('#planEnd').value=minutesToTime(best.slot.end);
  }
  box.className=`recommendation-box ${best.slot&&!best.overload?'good':'warning'}`;
  box.innerHTML=best.slot
   ?`<b>Horario inteligente: ${escapeHtml(best.a.name)} · ${minutesToTime(best.slot.start)}–${minutesToTime(best.slot.end)}</b><span>Primer horario laboral disponible para ${minutesText(r.dur)} · carga actual ${minutesText(best.load)} / ${best.a.dailyHours||8} h · ${best.experience?`${best.experience} ejecución(es) históricas de este parámetro · `:''}carga final ${minutesText(best.load+r.dur)}.</span><div class="smart-rank">${r.ranked.slice(0,3).map((x,i)=>`<small>${i+1}. ${escapeHtml(x.a.name)} · ${x.slot?`${minutesToTime(x.slot.start)}–${minutesToTime(x.slot.end)}`:'sin espacio suficiente hoy'} · ${minutesText(x.load)} cargadas${x.experience?` · ${x.experience} experiencia(s)`:''}</small>`).join('')}</div>`
   :`<b>No hay espacio suficiente hoy</b><span>${escapeHtml(best.a.name)} no dispone de un bloque laboral de ${minutesText(r.dur)} entre 08:00–17:00. Seleccione otro analista o fecha.</span>`;
  await updatePlanPreview();
}
async function autoScheduleSelectedAnalyst(){
  const analystId=$('#planAnalyst').value,box=$('#recommendationBox');
  if(!analystId)return;
  const a=(await getAll('analysts')).find(x=>x.id===analystId);
  const item=(await getAll('catalog')).find(x=>x.id===$('#planCatalog').value);
  const date=$('#planDate').value;
  const dur=(await effectivePlanDuration(item,$('#planSamples').value)).minutes;
  if(!a||!item||!date||!dur)return;

  const plans=await planningForDate(date);
  const own=plans.filter(p=>p.analystId===analystId);

  // Regla principal: analista sin planificación = jornada comienza 08:00.
  if(own.length===0){
    const start=WORK_START,end=addWorkingMinutes(start,dur);
    $('#planStart').value=minutesToTime(start);
    $('#planEnd').value=minutesToTime(end);
    if(end<=WORK_END){
      box.className='recommendation-box good';
      box.innerHTML=`<b>Jornada disponible: ${escapeHtml(a.name)} · 08:00–${minutesToTime(end)}</b><span>No tiene actividades planificadas en esta fecha. El sistema inicia automáticamente a las 08:00 y respeta el almuerzo 12:00–13:00.</span>`;
    }else{
      box.className='recommendation-box warning';
      box.innerHTML=`<b>${escapeHtml(a.name)} está libre, pero la actividad excede la jornada</b><span>Se inicia la referencia en 08:00, pero ${minutesText(dur)} no caben completamente antes de las 17:00.</span>`;
    }
    await updatePlanPreview();
    return;
  }

  const slot=findBestWorkSlot(plans,analystId,dur);
  if(slot){
    $('#planStart').value=minutesToTime(slot.start);
    $('#planEnd').value=minutesToTime(slot.end);
    box.className='recommendation-box good';
    box.innerHTML=`<b>Continuación inteligente: ${escapeHtml(a.name)} · ${minutesToTime(slot.start)}–${minutesToTime(slot.end)}</b><span>Se tomó el primer horario laboral libre en orden cronológico. Si el bloque cruza 12:00–13:00, continúa después del almuerzo sin dejar horas laborables vacías.</span>`;
    await updatePlanPreview();
  }else{
    // Nunca conservar la hora de otro analista.
    $('#planStart').value='08:00';
    $('#planEnd').value='';
    box.className='recommendation-box warning';
    box.innerHTML=`<b>Sin espacio suficiente para ${escapeHtml(a.name)}</b><span>No existe un bloque laboral disponible hoy para ${minutesText(dur)}. La hora heredada del analista anterior fue descartada.</span>`;
  }
}
async function smartPlannerRecalculate(){
  await updatePlanPreview();
  if($('#planAnalyst')?.value) await autoScheduleSelectedAnalyst();
  else {
    const box=$('#recommendationBox');
    if(box){box.className='recommendation-box';box.innerHTML='<b>Asistente inteligente</b><span>Seleccione un analista o use “Sugerir analista” para encontrar automáticamente el mejor horario.</span>'}
  }
}
const planSaveLocks=new Set();
const activityCompletionLocks=new Set();

async function savePlan(){
  if(planSaveLocks.has('planner'))return toast('Guardado ya en proceso · espere la confirmación');
  planSaveLocks.add('planner');
  const saveBtn=$('#btnSavePlan');if(saveBtn)saveBtn.disabled=true;
  try{
  const item=(await getAll('catalog')).find(x=>x.id===$('#planCatalog').value),date=$('#planDate').value,
  analyst=(await getAll('analysts')).find(a=>a.id===$('#planAnalyst').value),dur=(await effectivePlanDuration(item,$('#planSamples').value)).minutes;
  let start=$('#planStart').value;
  if(!item||!date||!analyst||!start||!dur)return toast('Complete actividad, fecha, horario y analista');
  if(!(analyst.competencies||[]).includes(item.section))return toast('El analista no tiene competencia para esta sección');
  const plans=await planningForDate(date);
  let startMin=timeToMinutes(start);
  let conflict=plans.find(p=>p.analystId===analyst.id&&workOverlap(startMin,dur,timeToMinutes(p.startTime),Number(p.durationMinutes||0)));
  if(conflict){
    const slot=findBestWorkSlot(plans,analyst.id,dur);
    if(slot){
      startMin=slot.start;start=minutesToTime(slot.start);
      $('#planStart').value=start;$('#planEnd').value=minutesToTime(slot.end);
      const box=$('#recommendationBox');
      box.className='recommendation-box good';
      box.innerHTML=`<b>Horario corregido automáticamente: ${escapeHtml(analyst.name)} · ${minutesToTime(slot.start)}–${minutesToTime(slot.end)}</b><span>Se evitó el cruce con ${escapeHtml(conflict.catalogName)} (${conflict.startTime}–${conflict.endTime}) y se tomó el siguiente hueco laboral disponible.</span>`;
      conflict=null;
    }else if(!confirm(`Existe un cruce con ${conflict.catalogName} (${conflict.startTime}-${conflict.endTime}) y no hay otro bloque disponible hoy. ¿Guardar de todas formas?`))return;
  }
  const end=minutesToTime(addWorkingMinutes(startMin,dur));
  const load=plans.filter(p=>p.analystId===analyst.id).reduce((t,p)=>t+Number(p.durationMinutes||0),0),capacity=Number(analyst.dailyHours||8)*60;
  if(load+dur>capacity&&!confirm(`La asignación supera la jornada de ${analyst.dailyHours||8} h. ¿Guardar de todas formas?`))return;
  // 10.10: anti-duplicado funcional. Un doble clic/reintento no puede crear dos actividades idénticas.
  const duplicate=plans.find(x=>x.status!=='CANCELADO'&&x.analystId===analyst.id&&x.catalogId===item.id&&x.date===date&&x.startTime===start&&Number(x.durationMinutes||0)===Number(dur));
  if(duplicate)return toast(`Actividad ya registrada: ${duplicate.catalogName} · ${duplicate.startTime}–${duplicate.endTime}`);
  const rec={id:uid('PLAN'),code:`PLA-${date.replaceAll('-','')}-${String((await getAll('planning')).length+1).padStart(4,'0')}`,date,catalogId:item.id,catalogCode:item.code,catalogName:item.name,section:item.section,family:item.family||'',timeMode:item.timeMode,samples:item.timeMode==='BY_SAMPLES'?Number($('#planSamples').value||0):null,actualSamples:null,durationMinutes:dur,startTime:start,endTime:end,analystId:analyst.id,analystCode:analyst.code,analystName:analyst.name,status:'PROGRAMADO',calibrationConfig:item.calibrationConfig?.enabled?JSON.parse(JSON.stringify(item.calibrationConfig)):null,calibrationResult:null,reagentConfig:item.reagentConfig?.length?JSON.parse(JSON.stringify(item.reagentConfig)):[],reagentResult:null,notes:$('#planNotes').value.trim(),createdAt:nowISO(),updatedAt:nowISO()};
  await put('planning',rec);
  await queue('CREATE','planning',rec);
  await audit('PLANIFICAR','PLANIFICADOR',rec.code,`${rec.catalogName} · ${rec.analystName} · ${rec.date} ${rec.startTime}-${rec.endTime}`);
  $('#planNotes').value='';
  await refreshPlanner();
  await renderAudit();
  if(firebaseBridge.ready&&firebaseBridge.authUser){
    const ok=await flushOutbox(false);
    toast(ok?`Actividad guardada y confirmada · ${rec.startTime}–${rec.endTime}`:`Actividad guardada localmente · sincronización pendiente`);
  }else{
    toast(`Actividad guardada localmente · ${rec.startTime}–${rec.endTime}`);
  }
  }finally{planSaveLocks.delete('planner');if(saveBtn)saveBtn.disabled=false;}
}

async function renderExecutivePlanner(){
  if(!$('#executivePlannerSummary')||!$('#plannerTimeline'))return;
  const date=$('#planDate').value;
  const [plans,analysts]=await Promise.all([planningForDate(date),getAll('analysts')]);
  const active=analysts.filter(a=>a.status==='ACTIVO'&&isOperationalAnalyst(a));
  const activeIds=new Set(active.map(a=>a.id));
  const valid=plans.filter(p=>p.status!=='CANCELADO'&&activeIds.has(p.analystId));
  const total=valid.reduce((t,p)=>t+Number(p.durationMinutes||0),0);
  const capacity=active.reduce((t,a)=>t+Number(a.dailyHours||8)*60,0);
  const utilization=capacity?Math.round(total/capacity*100):0;
  const conflicts=plannerConflictCount(valid);
  const full=active.filter(a=>{
    const load=valid.filter(p=>p.analystId===a.id).reduce((t,p)=>t+Number(p.durationMinutes||0),0);
    return load>=Number(a.dailyHours||8)*60;
  }).length;
  const free=active.filter(a=>!valid.some(p=>p.analystId===a.id)).length;
  const recs=bossAIRecommendations?.length||0;

  $('#executivePlannerSummary').innerHTML=`
    <article><span>Fecha</span><strong>${escapeHtml(date||'—')}</strong></article>
    <article><span>Analistas operativos</span><strong>${active.length}</strong></article>
    <article><span>Carga total</span><strong>${minutesText(total)}</strong></article>
    <article><span>Ocupación</span><strong>${utilization}%</strong></article>
    <article><span>Al 100%</span><strong>${full}</strong></article>
    <article class="${conflicts?'has-alert':''}"><span>Cruces</span><strong>${conflicts}</strong></article>
    <article><span>Libres</span><strong>${free}</strong></article>
    <article><span>Recomendaciones IA</span><strong>${recs}</strong></article>`;

  const start=WORK_START,end=WORK_END,totalSpan=end-start;
  const hourMarks=[8,9,10,11,12,13,14,15,16,17];

  const rows=active.map((a,rowIndex)=>{
    const own=valid.filter(p=>p.analystId===a.id).sort((x,y)=>x.startTime.localeCompare(y.startTime));
    const load=own.reduce((t,p)=>t+Number(p.durationMinutes||0),0);
    const pct=Math.round(load/(Number(a.dailyHours||8)*60)*100);

    const blocks=own.map((p,pIndex)=>{
      const segs=workingSegments(timeToMinutes(p.startTime),Number(p.durationMinutes||0));
      return segs.map((seg,i)=>{
        const st=Math.max(start,seg[0]),en=Math.min(end,seg[1]);
        if(en<=st)return '';
        const left=((st-start)/totalSpan)*100;
        const width=Math.max(.7,((en-st)/totalSpan)*100);
        const isContinuation=segs.length>1&&i>0;
        return `<button type="button"
          class="timeline-block analyst-${rowIndex%4} ${isContinuation?'continued':''}"
          style="left:${left}%;width:${width}%"
          title="${escapeHtml(p.catalogName)} · tramo ${minutesToTime(st)}-${minutesToTime(en)} · total ${p.startTime}-${p.endTime}">
          <span>${isContinuation?'↳ ':''}${escapeHtml(p.catalogName)}</span>
          <small>${minutesToTime(st)}–${minutesToTime(en)}</small>
        </button>`;
      }).join('');
    }).join('');

    const occupiedSegments=own.flatMap(p=>workingSegments(timeToMinutes(p.startTime),Number(p.durationMinutes||0)));
    const freeLabels=[];
    const windows=[[WORK_START,LUNCH_START],[LUNCH_END,WORK_END]];
    for(const [ws,we] of windows){
      let cursor=ws;
      const segs=occupiedSegments.filter(([a,b])=>b>ws&&a<we).sort((x,y)=>x[0]-y[0]);
      for(const [bs,be] of segs){
        const ss=Math.max(ws,bs),ee=Math.min(we,be);
        if(ss>cursor)freeLabels.push([cursor,ss]);
        cursor=Math.max(cursor,ee);
      }
      if(cursor<we)freeLabels.push([cursor,we]);
    }

    const freeBlocks=freeLabels.filter(([a,b])=>b-a>=30).map(([fs,fe])=>{
      const left=((fs-start)/totalSpan)*100,width=((fe-fs)/totalSpan)*100;
      return `<div class="timeline-free-label" style="left:${left}%;width:${width}%"><span>Libre</span><small>${minutesToTime(fs)}–${minutesToTime(fe)}</small></div>`;
    }).join('');

    const scheduleLabel=own.length
      ? own.map(p=>{
          const segs=workingSegments(timeToMinutes(p.startTime),Number(p.durationMinutes||0));
          return segs.map(([ss,ee])=>`${minutesToTime(ss)}–${minutesToTime(ee)}`).join(' / ');
        }).join(' · ')
      : '08:00–12:00 / 13:00–17:00 libre';

    return `<div class="timeline-row executive-row-${rowIndex%2}">
      <div class="timeline-person">
        <b>${escapeHtml(a.name)}</b>
        <span>${minutesText(load)} / ${a.dailyHours||8} h · ${pct}%</span>
        <small>${escapeHtml(scheduleLabel)}</small>
      </div>
      <div class="timeline-track">
        <div class="lunch-zone" style="left:${((LUNCH_START-start)/totalSpan)*100}%;width:${((LUNCH_END-LUNCH_START)/totalSpan)*100}%">
          <span>ALMUERZO</span><small>12:00–13:00</small>
        </div>
        ${freeBlocks}
        ${blocks}
      </div>
    </div>`;
  }).join('');

  $('#plannerTimeline').innerHTML=`
    <div class="timeline-hours">
      <div></div>
      <div>${hourMarks.map(h=>`<span style="left:${((h*60-start)/totalSpan)*100}%">${String(h).padStart(2,'0')}:00</span>`).join('')}</div>
    </div>
    ${rows||'<div class="empty-mini">Sin analistas operativos activos.</div>'}`;
}
async function renderDailyLoad(){if(!$('#loadCards'))return;const date=$('#planDate').value,plans=date?await planningForDate(date):[],anas=(await getAll('analysts')).filter(a=>a.status==='ACTIVO'&&isOperationalAnalyst(a)).sort((a,b)=>a.name.localeCompare(b.name,'es'));$('#loadCards').innerHTML=anas.map(a=>{const mins=plans.filter(p=>p.analystId===a.id).reduce((t,p)=>t+Number(p.durationMinutes||0),0),cap=Number(a.dailyHours||8)*60,pct=Math.round(mins/Math.max(1,cap)*100);return `<div class="load-card ${pct>100?'over':''}"><div class="load-head"><b>${escapeHtml(a.name)}</b><span>${minutesText(mins)} / ${a.dailyHours||8} h</span></div><small>${pct}% de jornada planificada</small><div class="load-bar"><i style="width:${Math.min(100,pct)}%"></i></div></div>`}).join('')||'<div class="empty"><p>Sin analistas activos.</p></div>'}

// V1.0.5.6.22 · reglas inteligentes de cobertura mínima de la jornada.
const CORE_SAMPLE_SECTIONS=new Set(['RECEPCION_MUESTRAS','MICROBIOLOGIA','AASS']);
function normalizePlannerRuleText(v=''){return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()}
function findProgrammingCatalog(catalog){
  const active=catalog.filter(x=>x.status==='ACTIVO');
  // Actividad solicitada por Calidad: "Programación de HT e ingresos de datos de ensayos".
  // Primero se fija por código conocido y luego por texto para conservar compatibilidad
  // si el catálogo fue migrado o el nombre fue corregido posteriormente.
  return active.find(x=>String(x.code||'').toUpperCase()==='CAT-AL-00056')||
    active.find(x=>{
      const t=normalizePlannerRuleText(`${x.name||''} ${x.family||''} ${x.description||''}`);
      return t.includes('PROGRAMACION')&&(
        t.includes('HT')||
        (t.includes('INGRES')&&t.includes('DATOS')&&t.includes('ENSAY'))
      );
    });
}
function isFullDaySingleActivity(own,capMinutes){
  return own.some(p=>Number(p.durationMinutes||0)>=capMinutes);
}
function plannerRuleLoad(plans,analystId){return plans.filter(p=>p.analystId===analystId&&p.status!=='CANCELADO').reduce((t,p)=>t+Number(p.durationMinutes||0),0)}
async function prepareMandatoryPlan(section,catalogId,analystId){
  if(!$('#planSection')||!$('#planCatalog'))return;
  $('#planSection').value=section;
  if($('#planActivitySearch'))$('#planActivitySearch').value='';
  await renderPlanSelectors();
  if(catalogId&&[...$('#planCatalog').options].some(o=>o.value===catalogId))$('#planCatalog').value=catalogId;
  await renderAnalystOptions();
  if(analystId&&[...$('#planAnalyst').options].some(o=>o.value===analystId))$('#planAnalyst').value=analystId;
  await smartPlannerRecalculate();
  if(analystId)await autoScheduleSelectedAnalyst();
  document.querySelector('.planner-grid')?.scrollIntoView({behavior:'smooth',block:'start'});
}
async function renderMandatoryPlanningAlerts(){
  const host=$('#smartMandatoryAlerts');if(!host)return;
  const date=$('#planDate')?.value;if(!date){host.innerHTML='';return}
  const [plans,analysts,catalog]=await Promise.all([planningForDate(date),getAll('analysts'),getAll('catalog')]);
  const active=analysts.filter(a=>a.status==='ACTIVO'&&isOperationalAnalyst(a));
  const alerts=[];

  // REGLA 1: cada día debe existir al menos un bloque completo de Recepción de Muestras (5 h).
  const receptionPlans=plans.filter(p=>p.status!=='CANCELADO'&&p.section==='RECEPCION_MUESTRAS');
  if(!receptionPlans.length){
    const receptionCatalog=catalog.filter(x=>x.status==='ACTIVO'&&x.section==='RECEPCION_MUESTRAS').sort((a,b)=>Number(b.baseMinutes||0)-Number(a.baseMinutes||0))[0]||null;
    const eligible=active.filter(a=>(a.competencies||[]).includes('RECEPCION_MUESTRAS')).map(a=>({a,slot:findBestWorkSlot(plans,a.id,300),load:plannerRuleLoad(plans,a.id)})).filter(x=>x.slot).sort((a,b)=>a.load-b.load||a.slot.start-b.slot.start);
    if(!eligible.length){
      alerts.push({level:'danger',icon:'!',title:'PROGRAMAR RECEPCIÓN · SIN BLOQUE DE 5 HORAS DISPONIBLE',text:'No existe Recepción de Muestras planificada y ningún analista competente conserva un bloque laboral completo de 5 h. La jornada necesita corrección inmediata o mover otra actividad para liberar espacio.',meta:'Cobertura obligatoria · 5 h'});
    }else{
      const best=eligible[0],only=eligible.length===1;
      alerts.push({level:only?'warning':'warning',icon:'⌛',title:only?'PROGRAMAR RECEPCIÓN · ÚLTIMA OPCIÓN DISPONIBLE':'PROGRAMAR RECEPCIÓN DE MUESTRAS',text:`Aún no existe el bloque obligatorio de 5 h. ${only?'Solo queda una opción':'Hay '+eligible.length+' opciones'} con espacio completo: ${best.a.name} ${minutesToTime(best.slot.start)}–${minutesToTime(best.slot.end)}.`,meta:'Cobertura obligatoria · 5 h',action:{section:'RECEPCION_MUESTRAS',catalogId:receptionCatalog?.id||'',analystId:best.a.id,label:'Preparar Recepción'}});
    }
  }

  // REGLA 2: si un analista no tiene Microbiología / Recepción / AASS,
  // debe quedar visible la actividad de Programación de HT e ingreso de datos.
  // Excepción: una sola actividad ocupa toda su jornada (p. ej. Vacaciones 8 h),
  // porque ese día el analista no realizará ensayos ni requiere esta reserva.
  const programmingCatalog=findProgrammingCatalog(catalog);
  for(const a of active){
    const own=plans.filter(p=>p.analystId===a.id&&p.status!=='CANCELADO');
    if(own.some(p=>CORE_SAMPLE_SECTIONS.has(p.section)))continue;

    const cap=Number(a.dailyHours||8)*60;
    if(isFullDaySingleActivity(own,cap))continue;

    const alreadyProgramming=own.some(p=>programmingCatalog&&p.catalogId===programmingCatalog.id)||own.some(p=>{
      const t=normalizePlannerRuleText(`${p.catalogName||''} ${p.activityName||''} ${p.name||''}`);
      return t.includes('PROGRAMACION')&&(t.includes('HT')||(t.includes('INGRES')&&t.includes('DATOS')&&t.includes('ENSAY')));
    });
    if(alreadyProgramming)continue;

    const load=plannerRuleLoad(plans,a.id),free=Math.max(0,cap-load);
    const duration=Math.max(30,Number(programmingCatalog?.baseMinutes||60));
    const slot=findBestWorkSlot(plans,a.id,duration);

    if(!programmingCatalog){
      alerts.push({level:'danger',icon:'!',title:`PROGRAMAR HT / INGRESO DE DATOS · ${a.name}`,text:`${a.name} no tiene Microbiología, Recepción de Muestras ni AASS. No se encontró activa en el catálogo la actividad “Programación de HT e ingresos de datos de ensayos” (CAT-AL-00056).`,meta:'Cobertura de analista · actividad requerida'});
    }else if(!slot||free<duration){
      alerts.push({level:'danger',icon:'!',title:`SIN ESPACIO PARA PROGRAMACIÓN · ${a.name}`,text:`${a.name} no tiene Microbiología, Recepción de Muestras ni AASS y tampoco tiene programada “${programmingCatalog.name}”. La jornada no conserva un bloque libre de ${minutesText(duration)}; mueva o ajuste otra actividad.`,meta:`Carga actual ${minutesText(load)} / ${minutesText(cap)}`});
    }else{
      alerts.push({level:'warning',icon:'⌛',title:`PROGRAMAR HT / INGRESO DE DATOS · ${a.name}`,text:`${a.name} no está asignado a Microbiología, Recepción de Muestras ni AASS. Programe “${programmingCatalog.name}” en el bloque disponible ${minutesToTime(slot.start)}–${minutesToTime(slot.end)}.`,meta:`Cobertura de analista · ${minutesText(duration)}`,action:{section:programmingCatalog.section,catalogId:programmingCatalog.id,analystId:a.id,label:'Programar actividad'}});
    }
  }

  if(!alerts.length){
    host.innerHTML=`<div class="smart-rule-alert good"><div class="smart-rule-icon">✓</div><div class="smart-rule-copy"><small>Control automático</small><b>Cobertura mínima de jornada correcta</b><span>La planificación actual cumple la cobertura de Recepción de Muestras y Programación de HT / ingreso de datos.</span></div></div>`;
    return;
  }
  host.innerHTML=alerts.map((x,i)=>`<div class="smart-rule-alert ${x.level}"><div class="smart-rule-icon">${x.icon}</div><div class="smart-rule-copy"><small>${escapeHtml(x.meta||'Alerta inteligente')}</small><b>${escapeHtml(x.title)}</b><span>${escapeHtml(x.text)}</span></div>${x.action?`<div class="smart-rule-actions"><button type="button" class="btn primary compact" data-smart-rule="${i}">${escapeHtml(x.action.label)}</button></div>`:''}</div>`).join('');
  $$('[data-smart-rule]').forEach(b=>b.onclick=()=>{const x=alerts[Number(b.dataset.smartRule)];if(x?.action)prepareMandatoryPlan(x.action.section,x.action.catalogId,x.action.analystId)});
}

async function planComments(planId){return (await getAll('planComments')).filter(c=>c.planId===planId).sort((a,b)=>a.createdAt.localeCompare(b.createdAt))}
async function addAnalystComment(planId){
  const input=document.querySelector(`[data-comment-input="${planId}"]`),text=(input?.value||'').trim();if(!text)return toast('Escriba un comentario');
  const p=await getOne('planning',planId);if(!p)return toast('Planificación no encontrada');
  const rec={id:uid('COM'),planId,analystId:p.analystId,analystName:p.analystName,authorType:'ANALISTA',authorName:p.analystName,text,createdAt:nowISO(),threadStatus:'OPEN',readBy:[]};
  await put('planComments',rec);await queue('CREATE','planComments',rec);await audit('COMENTAR','MI JORNADA',p.code,`${p.analystName}: ${text}`);input.value='';toast('Comentario registrado');await renderMyDay();await renderAgenda();await renderAudit();
}

function technicalAlertActorIsAnalyst(plan){
  // V1.0.5.6.19: la alerta técnica es un evento del sistema dirigido al JEFE.
  // Se genera tanto si registra el analista desde su sesión como si el JEFE
  // realiza una prueba/corrección desde Mi Jornada. Así la campana puede
  // verificarse sin depender del rol con el que se capturaron los datos.
  if(!currentSessionUser||!plan)return false;
  if(currentSessionUser.role==='ANALISTA'){
    const sid=currentSessionUser.analystId||'';
    return !sid||sid===plan.analystId;
  }
  return currentSessionUser.role==='JEFE';
}
function technicalAlertReagentSummary(result){
  const used=(result?.items||[]).filter(x=>x.usedInActivity&&!x.notUsed);
  if(!used.length)return {text:'Sin consumo informado en este guardado.',depleted:[],used:[],details:[]};
  const depleted=used.filter(x=>x.depleted===true||(Array.isArray(x.containers)&&x.containers.some(e=>e.depleted===true)));
  const details=used.map(x=>{
    const amount=Number(x.consumptionValue??x.used);
    const unit=x.consumptionUnit||x.unit||'';
    const qty=Number.isFinite(amount)?`${Number(amount.toFixed(4))} ${unit}`.trim():'consumo registrado';
    const finalParts=[];
    if(Array.isArray(x.containers)&&x.containers.length){
      x.containers.filter(e=>e.usedInActivity!==false).forEach(e=>{
        const fw=Number(e.finalWeight);
        if(Number.isFinite(fw))finalParts.push(`${e.label||e.containerType||'envase'}: ${Number(fw.toFixed(4))} g`);
      });
    }else{
      const fw=Number(x.finalWeight??x.after);
      if(Number.isFinite(fw))finalParts.push(`${Number(fw.toFixed(4))} g`);
      const sr=Number(x.stockRemaining);
      if(Number.isFinite(sr))finalParts.push(`stock final ${Number(sr.toFixed(4))} ${unit}`.trim());
    }
    return `${x.name}${x.lot?` · lote ${x.lot}`:''}: consumo ${qty}${finalParts.length?` · PESO / SALDO FINAL ${finalParts.join(' | ')}`:''}`;
  });
  return {text:details.join(' || '),depleted,used,details};
}
function technicalAlertCurveSummary(plan,result){
  const r=result||plan?.calibrationResult||{};
  const cfg=plan?.calibrationConfig||{};
  const points=r.points?.length||cfg.points?.length||0;
  const reps=Number(r.replicates||cfg.replicates||3);
  const r2=Number(r.regression?.r2);
  const slope=Number(r.regression?.slope);
  const intercept=Number(r.regression?.intercept);
  const pointDetails=(r.points||[]).slice(0,8).map((pt,i)=>{
    const c=pt.concentration??cfg.points?.[i]?.concentration??'';
    const avg=Number(pt.mean??pt.average);
    return `${c!==''?c:`P${i+1}`}${Number.isFinite(avg)?`→${avg.toFixed(4)}`:''}`;
  });
  const stats=[];
  if(Number.isFinite(r2))stats.push(`R² ${r2.toFixed(6)}`);
  if(Number.isFinite(slope))stats.push(`pendiente ${slope.toFixed(6)}`);
  if(Number.isFinite(intercept))stats.push(`intercepto ${intercept.toFixed(6)}`);
  return {points,reps,stats,pointDetails,completed:!!r.completed};
}
async function createTechnicalAlert(plan,kind,payload={}){
  if(!plan||!technicalAlertActorIsAnalyst(plan))return null;
  let text='',priority='INFO',action='CONOCIMIENTO';
  const stage=payload.stage==='FINAL'?'FINAL':'PARCIAL';
  const stageLabel=stage==='FINAL'?'AL FINALIZAR':'GUARDADO PARCIAL';
  if(kind==='CURVA'){
    const r=payload.result||plan.calibrationResult||{};
    const sm=technicalAlertCurveSummary(plan,r);
    const stats=sm.stats.length?` · ${sm.stats.join(' · ')}`:'';
    const points=sm.pointDetails.length?` · Valores: ${sm.pointDetails.join(' | ')}`:'';
    text=`📈 CURVA · ${stageLabel} · ${sm.completed?'Completa':'Guardada'}: ${sm.points} punto(s) × ${sm.reps} réplica(s)${stats}${points}.`;
  }else if(kind==='REACTIVOS'){
    const r=payload.result||plan.reagentResult||{};
    const summary=technicalAlertReagentSummary(r);
    if(!summary.used.length)return null;
    if(summary.depleted.length){priority='ALTA';action='REVISAR_BAJA';}
    text=`🧪 INVENTARIO / CONSUMO · ${stageLabel} · ${summary.text}.${summary.depleted.length?` ⚠️ Posible baja/agotamiento: ${summary.depleted.map(x=>`${x.name}${x.lot?` · lote ${x.lot}`:''}`).join(', ')}. REVISAR INVENTARIO.`:' Para conocimiento; revisar inventario cuando corresponda.'}`;
  }else if(kind==='CIERRE_TECNICO'){
    const parts=[];
    if(plan.calibrationResult?.completed){
      const sm=technicalAlertCurveSummary(plan,plan.calibrationResult);
      parts.push(`ESTÁNDARES / CURVA: ${sm.points} punto(s) × ${sm.reps} réplica(s)${sm.stats.length?` · ${sm.stats.join(' · ')}`:''}${sm.pointDetails.length?` · Valores ${sm.pointDetails.join(' | ')}`:''}`);
    }
    if(plan.reagentResult?.completed){
      const sm=technicalAlertReagentSummary(plan.reagentResult);
      if(sm.used.length)parts.push(`INVENTARIO: ${sm.text}`);
      if(sm.depleted.length){priority='ALTA';action='REVISAR_BAJA';parts.push(`⚠️ REVISAR BAJA: ${sm.depleted.map(x=>`${x.name}${x.lot?` · lote ${x.lot}`:''}`).join(', ')}`);}
    }
    if(!parts.length)return null;
    text=`🧪 DATOS TÉCNICOS CONFIRMADOS · ${parts.join(' || ')}.`;
  }else return null;
  const actorName=currentSessionUser?.name||plan.analystName||'Usuario';
  const actorRole=currentSessionUser?.role||'USUARIO';
  text=`${text} Registrado por: ${actorName}${actorRole==='JEFE'?' (prueba/corrección del jefe)':''}`;
  // 10.10: los avisos automáticos de cierre usan ID determinístico. Si una reconexión
  // o un segundo cliente intenta repetir el mismo cierre, Firestore/IndexedDB actualizan
  // el mismo documento en lugar de crear otra notificación.
  const safePlanId=String(plan.id||'PLAN').replace(/[^a-zA-Z0-9_-]/g,'_');
  const deterministicId=(kind==='CIERRE_TECNICO'&&stage==='FINAL')?`AUTO-TECNICA-FINAL-${safePlanId}`:uid('COM');
  const existingDeterministic=(kind==='CIERRE_TECNICO'&&stage==='FINAL')?await getOne('planComments',deterministicId):null;
  if(existingDeterministic)return existingDeterministic;
  const rec={id:deterministicId,planId:plan.id,analystId:plan.analystId,analystName:plan.analystName,authorType:'SISTEMA',authorName:'Alerta técnica',text,createdAt:nowISO(),threadStatus:'OPEN',readBy:[],notificationType:'TECNICA',technicalKind:kind,technicalStage:stage,technicalPayload:(kind==='REACTIVOS'||kind==='CIERRE_TECNICO')?{reagents:(payload.result||plan.reagentResult||{}).items||[]}:null,priority,actionRequired:action,autoGenerated:true,recipientRole:'JEFE',createdByRole:actorRole,createdByName:actorName};
  await put('planComments',rec);await queue('CREATE','planComments',rec);
  return rec;
}

async function createActivityLifecycleAlert(plan,stage){
  if(!plan||!technicalAlertActorIsAnalyst(plan))return null;
  const isStart=stage==='INGRESO';
  const safeId=String(plan.id||uid('PLAN')).replace(/[^a-zA-Z0-9_-]/g,'_');
  const id=`AUTO-${isStart?'INGRESO':'FINAL'}-${safeId}`;
  const existing=await getOne('planComments',id);
  if(existing)return existing; // id determinístico: evita avisos duplicados por doble clic/sincronización.
  const actorName=currentSessionUser?.name||plan.analystName||'Usuario';
  let text='';
  if(isStart){
    text=`▶️ INGRESO DE ACTIVIDAD · ${plan.catalogName} · ${plan.analystName} inició a las ${formatActualStamp(plan.actualStartedAt||nowISO())}.`;
  }else{
    const parts=[];
    if(plan.actualSamples!==null&&plan.actualSamples!==undefined)parts.push(`${plan.actualSamples} muestra(s)`);
    text=`✅ FINALIZACIÓN DE ACTIVIDAD · ${plan.catalogName} · ${plan.analystName} finalizó a las ${formatActualStamp(plan.actualFinishedAt||nowISO())}${parts.length?` · ${parts.join(' · ')}`:''}.`;
  }
  const rec={id,planId:plan.id,analystId:plan.analystId,analystName:plan.analystName,authorType:'SISTEMA',authorName:'Alerta de actividad',text,createdAt:nowISO(),threadStatus:'OPEN',readBy:[],notificationType:'ACTIVIDAD',lifecycleStage:isStart?'INGRESO':'FINALIZACION',priority:'INFO',actionRequired:'CONOCIMIENTO',autoGenerated:true,recipientRole:'JEFE',createdByRole:currentSessionUser?.role||'USUARIO',createdByName:actorName};
  await put('planComments',rec);await queue('CREATE','planComments',rec);
  return rec;
}

function setFinishTechnicalReadOnly(readonly){
  const dialog=$('#finishActivityDialog');if(!dialog)return;
  dialog.querySelectorAll('#finishCalibrationBlock input,#finishCalibrationBlock select,#finishCalibrationBlock textarea,#finishReagentBlock input,#finishReagentBlock select,#finishReagentBlock textarea,#finishActivityComment,#finishActualSamples').forEach(el=>{el.disabled=!!readonly});
  $('#btnSaveCalibrationDraft')?.classList.toggle('hidden',!!readonly);
  $('#btnSaveReagentDraft')?.classList.toggle('hidden',!!readonly);
  dialog.classList.toggle('technical-readonly',!!readonly);
}
async function unlockCompletedTechnicalEdit(){
  const p=await getOne('planning',$('#finishActivityPlanId')?.value);if(!p||p.status!=='REALIZADO')return;
  const password=prompt('Ingrese la contraseña para editar una actividad finalizada:');
  if(password===null)return;
  if(password!=='2026')return toast('Contraseña incorrecta');
  $('#finishTechnicalEditMode').value='1';
  setFinishTechnicalReadOnly(false);
  const title=$('#finishActivityTitle');if(title)title.textContent='Editar actividad finalizada';
  $('#finishActivityHelp').textContent='Edición técnica autorizada. El estado REALIZADO y los tiempos originales no cambian.';
  const submit=$('#finishSubmitBtn');if(submit){submit.classList.remove('hidden');submit.textContent='Guardar edición técnica'}
  $('#btnUnlockTechnicalEdit')?.classList.add('hidden');
  toast('Edición habilitada');
}

function communicationUserKey(){
  if(!currentSessionUser)return '';
  return currentSessionUser.role==='ANALISTA'?`ANALISTA:${currentSessionUser.analystId||currentSessionUser.id||currentSessionUser.name}`:`JEFE:${currentSessionUser.id||currentSessionUser.email||currentSessionUser.name}`;
}
function communicationVisibleComment(c){
  if(!currentSessionUser)return false;
  if(c?.recipientRole==='JEFE')return currentSessionUser.role==='JEFE';
  return currentSessionUser.role==='JEFE'||(currentSessionUser.role==='ANALISTA'&&c.analystId===currentSessionUser.analystId);
}
async function communicationThreads(){
  const comments=(await getAll('planComments')).filter(communicationVisibleComment);
  const plans=await getAll('planning'), map=new Map();
  comments.forEach(c=>{if(!map.has(c.planId))map.set(c.planId,[]);map.get(c.planId).push(c)});
  return [...map.entries()].map(([planId,items])=>{items.sort((a,b)=>a.createdAt.localeCompare(b.createdAt));const p=plans.find(x=>x.id===planId);return {planId,p,items,last:items[items.length-1],closed:items.some(x=>x.threadStatus==='CLOSED')&&items[items.length-1]?.threadStatus==='CLOSED'}}).sort((a,b)=>(b.last?.createdAt||'').localeCompare(a.last?.createdAt||''));
}

function isOwnCommunication(c){
  return (currentSessionUser?.role==='JEFE'&&c.authorType==='JEFE')||(currentSessionUser?.role==='ANALISTA'&&c.authorType==='ANALISTA');
}
function communicationUnread(c,key=communicationUserKey()){
  return !isOwnCommunication(c)&&!(c.readBy||[]).includes(key);
}
let communicationPopupTimer=null;
function isLegacyIndividualControlAlert(c){
  // Desde 6.33.25.9 las cartas individuales conservan su trazabilidad técnica,
  // pero no forman asuntos ni incrementan la campana. Solo se muestra el resumen diario.
  return c?.notificationType==='CARTA_CONTROL' && String(c?.id||'').startsWith('AUTO-CC-') && !String(c?.id||'').startsWith('AUTO-CC-RESUMEN-');
}
function communicationDisplayableComment(c){return c?.notificationType!=='SISTEMA'&&!isLegacyIndividualControlAlert(c);}
function communicationCategory(c){
  if(c?.notificationType==='ACTIVIDAD')return 'ACTIVIDAD';
  if(c?.notificationType==='TECNICA')return 'TECNICA';
  if(c?.notificationType==='CARTA_CONTROL')return 'CONTROL';
  return 'CONVERSACION';
}
function communicationCategoryMeta(c){
  const type=communicationCategory(c);
  if(type==='ACTIVIDAD'){
    const end=c?.lifecycleStage==='FINALIZACION';
    return {type,label:end?'CIERRE DE ACTIVIDAD':'APERTURA DE ACTIVIDAD',icon:end?'✅':'▶️',className:'activity'};
  }
  if(type==='TECNICA')return {type,label:'DATOS TÉCNICOS',icon:'🧪',className:'technical'};
  if(type==='CONTROL')return {type,label:'CIERRE DE CONTROLES DIARIOS',icon:'📈',className:'control'};
  return {type,label:'MENSAJE / COMENTARIO',icon:'💬',className:'conversation'};
}
// 6.33.25.10.4 · Avisos nativos del sistema para el cierre consolidado de cartas.
// No genera ruido por cartas individuales, aperturas, cierres de actividad ni datos técnicos.
function isDailyControlCompletionSummary(c){
  return c?.notificationType==='CARTA_CONTROL' && String(c?.id||'').startsWith('AUTO-CC-RESUMEN-');
}
async function ensureSystemNotificationPermission(fromUserGesture=false){
  if(!('Notification' in window))return 'unsupported';
  if(Notification.permission==='granted'||Notification.permission==='denied')return Notification.permission;
  if(!fromUserGesture)return Notification.permission;
  try{return await Notification.requestPermission()}catch(e){console.warn('Permiso de notificaciones',e);return 'default'}
}
async function showSystemControlCompletionNotification(comment){
  if(!isDailyControlCompletionSummary(comment)||!communicationVisibleComment(comment)||isOwnCommunication(comment))return false;
  if(!('Notification' in window)||Notification.permission!=='granted')return false;
  // Si el JEFE está mirando activamente el ERP se conserva el popup interno; el aviso
  // del sistema se reserva para pestaña oculta, otra ventana o aplicación minimizada.
  if(document.visibilityState==='visible'&&document.hasFocus())return false;
  const title=(comment.controlSummary?.bad||0)>0?'⚠️ Controles diarios · requiere revisión':'✅ Controles diarios completados';
  const body=`${comment.analystName||'Analista'} · ${comment.controlSummary?.done||''}/${comment.controlSummary?.total||''} cartas${comment.controlSummary?.bad?` · ${comment.controlSummary.bad} requiere revisión`:' · sin desviaciones'}`;
  const options={body,tag:String(comment.id||'control-diario'),renotify:false,icon:'./icons/icon-192.png',badge:'./icons/icon-192.png',data:{type:'OPEN_COMMUNICATIONS',commentId:comment.id,planId:comment.planId}};
  try{
    const reg=await navigator.serviceWorker?.ready;
    if(reg?.showNotification){await reg.showNotification(title,options);return true}
    new Notification(title,options);return true;
  }catch(e){console.warn('Aviso del sistema no disponible',e);return false}
}
async function showCommunicationPopup(comment){
  if(!comment||!communicationVisibleComment(comment)||isOwnCommunication(comment))return;
  const p=await getOne('planning',comment.planId),meta=communicationCategoryMeta(comment);
  let el=$('#communicationPopup');
  if(!el){el=document.createElement('div');el.id='communicationPopup';el.className='communication-popup';document.body.appendChild(el)}
  el.className=`communication-popup ${meta.className}`;
  const analyst=p?.analystName||comment.analystName||'Analista';
  el.innerHTML=`<button type="button" class="communication-popup-main"><span class="popup-icon">${meta.icon}</span><span class="popup-copy"><span class="popup-kicker">${escapeHtml(meta.label)}</span><b>${escapeHtml(p?.catalogName||'Actividad')}</b><small>${escapeHtml(analyst)} · ${escapeHtml(comment.text||'')}</small></span><em>Ver</em></button><button type="button" class="communication-popup-close" aria-label="Cerrar">×</button>`;
  requestAnimationFrame(()=>el.classList.add('show'));
  el.querySelector('.communication-popup-main').onclick=async()=>{el.classList.remove('show');await openCommunications();};
  el.querySelector('.communication-popup-close').onclick=()=>el.classList.remove('show');
  clearTimeout(communicationPopupTimer);communicationPopupTimer=setTimeout(()=>el.classList.remove('show'),10000);
}
async function refreshNotificationBadge(){
  if(!$('#notificationBadge'))return;
  const key=communicationUserKey();if(!key){$('#notificationBadge').classList.add('hidden');return}
  const threads=await communicationThreads();let n=0;
  threads.forEach(t=>{const visible=t.items.filter(communicationDisplayableComment);if(visible.some(c=>communicationUnread(c,key))||(!t.closed&&communicationPriority({...t,items:visible}).rank>=4))n++});
  $('#notificationBadge').textContent=String(n);$('#notificationBadge').classList.toggle('hidden',n===0);$('#btnNotifications')?.classList.toggle('has-unread',n>0);
}
async function syncCommentReadReceipt(commentId,keys){
  // Las confirmaciones de lectura son metadatos de la campana, no cambios operativos.
  // Se envían por un canal silencioso para que abrir el Centro de Comunicaciones
  // nunca deje el ERP en estado SINCRONIZANDO ni bloquee la Outbox principal.
  if(!firebaseBridge.ready||!firebaseBridge.authUser||!commentId)return false;
  const list=[...new Set((Array.isArray(keys)?keys:[keys]).filter(Boolean))];
  if(!list.length)return true;
  try{
    const {doc,setDoc,arrayUnion}=firebaseBridge.mods;
    await setDoc(doc(firebaseBridge.db,'planComments',commentId),{readBy:arrayUnion(...list)},{merge:true});
    return true;
  }catch(err){
    console.warn('Lectura de comunicación pendiente (canal silencioso)',commentId,err);
    return false;
  }
}
async function retireLegacyCommentReadOutbox(){
  // V1.0.5.6.15 guardaba cada lectura como UPDATE en la Outbox. Al abrir varias
  // conversaciones podían acumularse escrituras y el indicador quedaba largo rato
  // en SINCRONIZANDO. Se retiran únicamente esos UPDATE de lectura heredados.
  const items=(await getAll('outbox')).filter(x=>
    x.entity==='planComments'&&x.type==='UPDATE'&&
    (x.status==='PENDIENTE'||x.status==='ERROR')
  );
  for(const item of items){
    const payload=item.payload||{};
    item.status='OMITIDO';
    item.lastError='Migrado a confirmación de lectura silenciosa';
    item.syncedAt=nowISO();
    await put('outbox',item);
    if(payload.id&&(payload.readBy||[]).length){
      // No bloquear inicio de sesión: Firestore lo confirma en segundo plano.
      syncCommentReadReceipt(payload.id,payload.readBy);
    }
  }
  if(items.length)await refreshSyncUI();
  return items.length;
}
async function markThreadRead(planId){
  const key=communicationUserKey();if(!key)return 0;
  const cs=(await getAll('planComments')).filter(c=>c.planId===planId&&communicationVisibleComment(c));
  let changed=0;
  for(const c of cs){
    // Solo marcar mensajes realmente nuevos del otro participante. Los mensajes
    // propios no necesitan una segunda confirmación de lectura.
    if(communicationUnread(c,key)){
      c.readBy=[...new Set([...(c.readBy||[]),key])];
      await put('planComments',c);
      changed++;
      syncCommentReadReceipt(c.id,key);
    }
  }
  return changed;
}
let selectedCommunicationPlanId='';
function communicationPriority(t){
  const visible=t.items.filter(communicationDisplayableComment);
  const last=visible[visible.length-1]||t.last||{};
  const unread=visible.some(c=>communicationUnread(c));
  const action=visible.some(c=>c.actionRequired&&c.actionRequired!=='CONOCIMIENTO');
  const technical=visible.some(c=>communicationCategory(c)==='TECNICA');
  if(!t.closed&&(action||String(last.priority||'').toUpperCase()==='ALTA'))return {rank:4,label:'REQUIERE ACCIÓN',icon:'🔴',cls:'critical'};
  if(!t.closed&&unread)return {rank:3,label:'NUEVO',icon:'🟠',cls:'new'};
  if(!t.closed)return {rank:2,label:technical?'REVISAR DATOS':'EN SEGUIMIENTO',icon:'🔵',cls:'follow'};
  return {rank:1,label:'COMPLETADO',icon:'🟢',cls:'done'};
}
function communicationInventoryRows(comment){
  const rows=[];
  const items=comment?.technicalPayload?.reagents;
  if(Array.isArray(items)&&items.length){
    for(const x of items.filter(x=>x&&x.usedInActivity&&!x.notUsed)){
      const consumption=Number(x.consumptionValue??x.used), unit=x.consumptionUnit||x.unit||'';
      const final=Number(x.stockRemaining??x.finalWeight??x.after);
      const initial=(Number.isFinite(final)&&Number.isFinite(consumption))?final+consumption:null;
      rows.push({name:x.name||'Reactivo / insumo',lot:x.lot||'—',initial:Number.isFinite(initial)?initial:null,consumption:Number.isFinite(consumption)?consumption:null,final:Number.isFinite(final)?final:null,unit,depleted:!!x.depleted});
    }
    if(rows.length)return rows;
  }
  const text=String(comment?.text||'');
  // Compatibilidad con avisos históricos ya guardados en Firestore.
  const re=/([^|·]+?)(?:\s*·\s*lote\s+([^:·|]+))?:\s*consumo\s+([\d.,]+)\s*([^·|]*?)(?:\s*·\s*PESO\s*\/\s*SALDO\s*FINAL\s+(?:stock final\s+)?([\d.,]+)\s*([^.|]*))?(?=\s*\|\||\.|$)/gi;
  let m;
  while((m=re.exec(text))){
    const consumption=Number(String(m[3]).replace(',','.')), final=m[5]?Number(String(m[5]).replace(',','.')):null, unit=(m[4]||m[6]||'').trim();
    rows.push({name:m[1].replace(/.*INVENTARIO:\s*/i,'').trim(),lot:(m[2]||'—').trim(),initial:Number.isFinite(final)?final+consumption:null,consumption,final:Number.isFinite(final)?final:null,unit,depleted:/agotamiento|revisar baja/i.test(m[0])});
  }
  return rows;
}
function communicationInventoryCard(comment){
  const rows=communicationInventoryRows(comment);if(!rows.length)return '';
  const body=rows.map(r=>`<tr><td><b>${escapeHtml(r.name)}</b>${r.lot&&r.lot!=='—'?`<small>Lote ${escapeHtml(r.lot)}</small>`:''}</td><td>${r.initial==null?'—':escapeHtml(String(Number(r.initial.toFixed(4))))}</td><td class="comm-consumption">− ${r.consumption==null?'—':escapeHtml(String(Number(r.consumption.toFixed(4))))}</td><td class="comm-final">${r.final==null?'—':escapeHtml(String(Number(r.final.toFixed(4))))}</td><td>${escapeHtml(r.unit||'—')}</td><td>${r.depleted?'<span class="comm-stock-alert">REVISAR</span>':'<span class="comm-stock-ok">REGISTRADO</span>'}</td></tr>`).join('');
  const remaining=rows.filter(r=>r.final!=null).map(r=>`${r.name}: ${Number(r.final.toFixed(4))} ${r.unit||''}`.trim());
  return `<div class="comm-inventory-card"><div class="comm-inventory-head"><b>📦 Movimiento de inventario</b><small>${remaining.length?`Saldo resultante · ${escapeHtml(remaining.join(' · '))}`:'Consumo registrado con trazabilidad'}</small></div><div class="comm-inventory-scroll"><table><thead><tr><th>Reactivo / insumo</th><th>Inicial</th><th>Consumo</th><th>Final</th><th>Unidad</th><th>Estado</th></tr></thead><tbody>${body}</tbody></table></div><div class="comm-ai-note"><b>IA · Seguimiento:</b> ${rows.some(r=>r.depleted)?'Hay un insumo que requiere revisión de inventario o reposición.':'Movimiento coherente registrado; el saldo final queda disponible para seguimiento.'}</div></div>`;
}
function communicationTechnicalSummary(text=''){
  const clean=String(text).replace(/^🧪\s*DATOS TÉCNICOS CONFIRMADOS\s*·?\s*/i,'');
  const picks=[];
  for(const rx of [/R²\s*[-:=]?\s*[\d.,]+/i,/\d+\s*punto\(s\)\s*x\s*\d+\s*réplica\(s\)/i,/PESO\s*\/\s*SALDO\s*FINAL[^|]*/i,/VOLUMEN\s*FINAL[^|]*/i,/INVENTARIO:[^|]*/i]){const m=clean.match(rx);if(m&&!picks.includes(m[0]))picks.push(m[0].trim())}
  return picks.slice(0,3).join(' · ')||clean.slice(0,145)+(clean.length>145?'…':'');
}
function communicationCounts(t,key){
  const items=t.items.filter(communicationDisplayableComment);
  return {events:items.length,messages:items.filter(c=>communicationCategory(c)==='CONVERSACION').length,technical:items.filter(c=>communicationCategory(c)==='TECNICA').length,unread:items.filter(c=>communicationUnread(c,key)).length};
}
async function renderCommunications(){
  if(!$('#communicationsList'))return;
  const filter=$('#commStatusFilter')?.value||'OPEN', typeFilter=$('#commTypeFilter')?.value||'ALL', search=normalizeIdentityText($('#commSearch')?.value||''), key=communicationUserKey();
  let all=(await communicationThreads()).map(t=>({...t,items:t.items.filter(communicationDisplayableComment)})).filter(t=>t.items.length);
  all.forEach(t=>t.priority=communicationPriority(t));
  all.sort((a,b)=>b.priority.rank-a.priority.rank||(b.last?.createdAt||'').localeCompare(a.last?.createdAt||''));
  const needs=all.filter(t=>!t.closed&&t.priority.rank>=3).length, open=all.filter(t=>!t.closed).length, technical=all.filter(t=>!t.closed&&t.items.some(c=>communicationCategory(c)==='TECNICA')).length, closed=all.filter(t=>t.closed).length;
  if($('#commSummary'))$('#commSummary').innerHTML=`<button type="button" data-comm-filter="UNREAD" class="comm-kpi ${needs?'hot':''}"><b>${needs}</b><span>Requieren atención</span></button><button type="button" data-comm-filter="OPEN" class="comm-kpi"><b>${open}</b><span>En seguimiento</span></button><button type="button" data-comm-type="TECNICA" class="comm-kpi"><b>${technical}</b><span>Datos técnicos</span></button><button type="button" data-comm-filter="CLOSED" class="comm-kpi"><b>${closed}</b><span>Completados</span></button>`;
  let ts=all;
  if(filter==='UNREAD')ts=ts.filter(t=>!t.closed&&(t.priority.rank>=3||t.items.some(c=>communicationUnread(c,key))));
  if(filter==='OPEN')ts=ts.filter(t=>!t.closed); if(filter==='CLOSED')ts=ts.filter(t=>t.closed);
  if(typeFilter!=='ALL')ts=ts.filter(t=>t.items.some(c=>communicationCategory(c)===typeFilter));
  if(search)ts=ts.filter(t=>{const p=t.p||{},hay=[p.catalogName,p.analystName,p.date,p.code,...t.items.flatMap(c=>[c.text,c.authorName,c.analystName])].filter(Boolean).join(' ');return normalizeIdentityText(hay).includes(search)});
  if(!selectedCommunicationPlanId||!ts.some(t=>t.planId===selectedCommunicationPlanId))selectedCommunicationPlanId=ts[0]?.planId||'';
  const selected=ts.find(t=>t.planId===selectedCommunicationPlanId);
  const cards=ts.map(t=>{const p=t.p||{},c=communicationCounts(t,key),pr=t.priority,last=t.items[t.items.length-1],meta=communicationCategoryMeta(last);return `<button type="button" class="comm-inbox-card ${t.planId===selectedCommunicationPlanId?'selected':''} ${c.unread?'unread':''}" data-comm-select="${t.planId}"><span class="comm-priority ${pr.cls}">${pr.icon} ${pr.label}</span><b>${escapeHtml(p.catalogName||'Actividad')}</b><small>${escapeHtml(p.analystName||t.items[0]?.analystName||'Analista')} · ${escapeHtml(p.date||'')}</small><span class="comm-preview">${meta.icon} ${escapeHtml(communicationCategory(last)==='TECNICA'?communicationTechnicalSummary(last.text):String(last.text||'').slice(0,110))}</span><span class="comm-card-counts"><em>${c.events} eventos</em>${c.messages?`<em>💬 ${c.messages}</em>`:''}${c.technical?`<em>🧪 ${c.technical}</em>`:''}${c.unread?`<strong>${c.unread} nuevo${c.unread>1?'s':''}</strong>`:''}</span></button>`}).join('');
  let detail=`<div class="comm-empty"><span>🔔</span><b>Sin asuntos en este filtro</b><small>Pruebe otra categoría o revise los asuntos completados.</small></div>`;
  if(selected){const p=selected.p||{},c=communicationCounts(selected,key),pr=selected.priority;const timeline=selected.items.map((x,i)=>{const m=communicationCategoryMeta(x),tech=communicationCategory(x)==='TECNICA';return `<div class="comm-timeline-item ${m.className} ${communicationUnread(x,key)?'new':''}"><span class="comm-timeline-dot">${m.icon}</span><div><div class="comm-message-meta"><span class="comm-type-pill ${m.className}">${escapeHtml(m.label)}</span><small>${fmtDate(x.createdAt)}</small></div><b>${escapeHtml(x.authorName||x.author||'Sistema')}</b>${tech?`${communicationInventoryCard(x)||`<div class="comm-tech-summary">${escapeHtml(communicationTechnicalSummary(x.text))}</div>`}<details><summary>Ver trazabilidad técnica completa</summary><div class="comm-full-text">${escapeHtml(x.text)}</div></details>`:`<div class="comm-full-text">${escapeHtml(x.text)}</div>`}</div></div>`}).join('');detail=`<section class="comm-detail"><header><div><span class="comm-priority ${pr.cls}">${pr.icon} ${pr.label}</span><h3>${escapeHtml(p.catalogName||'Actividad')}</h3><p>${escapeHtml(p.analystName||selected.items[0]?.analystName||'Analista')} · ${escapeHtml(p.date||'')} ${p.startTime?`· ${p.startTime}`:''}</p></div><div class="comm-detail-stats"><span>${c.events}<small>eventos</small></span><span>${c.messages}<small>mensajes</small></span><span>${c.technical}<small>técnicos</small></span></div></header><div class="comm-timeline">${timeline}</div><footer class="comm-reply"><input data-comm-reply="${selected.planId}" placeholder="Escribir comentario o respuesta..."/><button class="btn primary compact" data-comm-send="${selected.planId}">Responder</button>${currentSessionUser.role==='JEFE'?`<button class="btn secondary compact" data-comm-close="${selected.planId}">${selected.closed?'Reabrir':'✓ Marcar atendido'}</button>`:''}</footer></section>`;}
  $('#communicationsList').innerHTML=`<div class="comm-pro-layout"><aside class="comm-inbox">${cards||'<div class="comm-inbox-empty">Sin asuntos</div>'}</aside><main class="comm-detail-wrap">${detail}</main></div>`;
  $$('[data-comm-select]').forEach(b=>b.onclick=async()=>{selectedCommunicationPlanId=b.dataset.commSelect;await markThreadRead(selectedCommunicationPlanId);await renderCommunications()});
  $$('[data-comm-send]').forEach(b=>b.onclick=()=>replyCommunication(b.dataset.commSend)); $$('[data-comm-close]').forEach(b=>b.onclick=()=>toggleCommunicationClosed(b.dataset.commClose));
  $$('[data-comm-filter]').forEach(b=>b.onclick=()=>{$('#commStatusFilter').value=b.dataset.commFilter;renderCommunications()}); $$('[data-comm-type]').forEach(b=>b.onclick=()=>{$('#commTypeFilter').value=b.dataset.commType;renderCommunications()});
  if(selected)await markThreadRead(selected.planId); await refreshNotificationBadge();
}
async function openCommunications(){await renderCommunications();$('#notificationsDialog').showModal()}
async function replyCommunication(planId){
  const input=document.querySelector(`[data-comm-reply="${planId}"]`),text=(input?.value||'').trim();if(!text)return toast('Escriba una respuesta');const p=await getOne('planning',planId);if(!p)return toast('Actividad no encontrada');
  const type=currentSessionUser.role==='JEFE'?'JEFE':'ANALISTA',name=currentSessionUser.name||p.analystName||'Usuario';const rec={id:uid('COM'),planId,analystId:p.analystId,analystName:p.analystName,authorType:type,authorName:name,text,createdAt:nowISO(),threadStatus:'OPEN',readBy:[communicationUserKey()]};
  await put('planComments',rec);await queue('CREATE','planComments',rec);await audit('RESPONDER','COMUNICACIONES',p.code,`${name}: ${text}`);input.value='';await renderCommunications();await renderMyDay();await refreshNotificationBadge();toast('Respuesta enviada');
}
async function toggleCommunicationClosed(planId){
  const ts=await communicationThreads(),t=ts.find(x=>x.planId===planId);if(!t)return;const p=t.p||await getOne('planning',planId);const closing=!t.closed;const rec={id:uid('COM'),planId,analystId:p?.analystId,analystName:p?.analystName,authorType:'JEFE',authorName:currentSessionUser.name||'Administración',text:closing?'Asunto marcado como atendido.':'Asunto reabierto.',createdAt:nowISO(),threadStatus:closing?'CLOSED':'OPEN',readBy:[communicationUserKey()],notificationType:'SISTEMA',recipientRole:'JEFE',autoGenerated:true};await put('planComments',rec);await queue('CREATE','planComments',rec);await audit(closing?'ATENDER':'REABRIR','COMUNICACIONES',p?.code||planId,rec.text);if(closing&&($('#commStatusFilter')?.value||'OPEN')!=='CLOSED')selectedCommunicationPlanId='';await renderCommunications();await refreshNotificationBadge();toast(closing?'Asunto atendido · salió de pendientes y conserva trazabilidad':'Asunto reabierto');
}

async function changeAnalystPlanStatus(planId,status){
  const p=await getOne('planning',planId);if(!p)return;p.status=status;p.updatedAt=nowISO();await put('planning',p);await queue('UPDATE','planning',p);await audit('ESTADO_ANALISTA','MI JORNADA',p.code,`${p.analystName} → ${status}`);toast(`Estado: ${status}`);await renderMyDay();await renderAgenda();await renderDailyLoad();await renderAudit();
}
async function renderMyDayAnalysts(){if(!$('#myDayAnalyst'))return;const list=(await getAll('analysts')).filter(a=>a.status==='ACTIVO'&&isOperationalAnalyst(a)).sort((a,b)=>a.name.localeCompare(b.name,'es'));const cur=$('#myDayAnalyst').value;$('#myDayAnalyst').innerHTML='<option value="">Seleccione analista...</option>'+list.map(a=>`<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');if(list.some(a=>a.id===cur))$('#myDayAnalyst').value=cur}

function currentTimeHHMM(){
  const d=new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function formatActualStamp(iso){
  if(!iso)return '';
  const d=new Date(iso);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function assertOwnPlan(p){
  return currentSessionUser?.role!=='ANALISTA'||p?.analystId===currentSessionUser?.analystId;
}
async function startMyActivity(planId){
  const _guardPlan=await getOne('planning',planId);if(!_guardPlan||!assertOwnPlan(_guardPlan))return toast('No puede modificar actividades de otro analista');
  let p=await getOne('planning',planId);if(!p)return;
  if(p.date>dateToday())return toast(`Actividad programada para ${formatShortDate(p.date)}. Se habilitará el día correspondiente.`);
  if(p.status==='REALIZADO')return toast('La actividad ya está finalizada');
  p=await hydratePlanTechnicalRequirements(p);
  p.status='EN PROCESO';p.actualStartedAt=p.actualStartedAt||nowISO();p.updatedAt=nowISO();
  await put('planning',p);await queue('UPDATE','planning',p);
  await audit('INICIAR_ACTIVIDAD','MI JORNADA',p.code,`${p.analystName} inició ${p.catalogName} a las ${formatActualStamp(p.actualStartedAt)}`);
  await createActivityLifecycleAlert(p,'INGRESO');
  toast(`Actividad iniciada · ${formatActualStamp(p.actualStartedAt)} · jefe notificado`);
  await renderMyDay();await renderAgenda();await renderDailyLoad();await renderAudit();
}


function technicalRequirementBadge(p){
  const parts=[];
  if(planRequiresCalibration(p))parts.push('CURVA');
  if(planHasReagents(p))parts.push('REACTIVOS');
  return parts.length?`<span class="technical-required-badge">REQUERIDO: ${parts.join(' + ')}</span>`:'';
}
function planRequiresCalibration(p){
  return !!(p?.calibrationConfig?.enabled && Array.isArray(p.calibrationConfig.points) && p.calibrationConfig.points.length);
}
function mean(values){return values.reduce((a,b)=>a+b,0)/values.length}
function sampleSd(values){
  if(values.length<2)return 0;
  const m=mean(values);
  return Math.sqrt(values.reduce((a,v)=>a+(v-m)**2,0)/(values.length-1));
}
function linearRegression(points){
  if(points.length<2)return null;
  const n=points.length,sx=points.reduce((a,p)=>a+p.x,0),sy=points.reduce((a,p)=>a+p.y,0);
  const sxx=points.reduce((a,p)=>a+p.x*p.x,0),sxy=points.reduce((a,p)=>a+p.x*p.y,0);
  const den=n*sxx-sx*sx;if(Math.abs(den)<1e-15)return null;
  const slope=(n*sxy-sx*sy)/den,intercept=(sy-slope*sx)/n;
  const ym=sy/n,ssTot=points.reduce((a,p)=>a+(p.y-ym)**2,0),ssRes=points.reduce((a,p)=>a+(p.y-(slope*p.x+intercept))**2,0);
  return {slope,intercept,r2:ssTot===0?1:1-ssRes/ssTot};
}
function existingCalibrationReadings(p){
  const result=p?.calibrationResult;
  if(!result?.points)return [];
  return result.points.map(x=>({readings:Array.isArray(x.readings)?x.readings:[]}));
}
function renderFinishCalibration(p){
  const block=$('#finishCalibrationBlock');if(!block)return;
  if(!planRequiresCalibration(p)){block.classList.add('hidden');$('#finishCalibrationRows').innerHTML='';return}
  block.classList.remove('hidden');
  const unit=p.calibrationConfig.unit||'';
  const reps=Math.max(1,Number(p.calibrationConfig.replicates||3));
  $('#finishCalibrationUnit').textContent=`Concentración en ${unit||'unidad configurada'} · ingrese ${reps} lectura${reps===1?'':'s'} por punto.`;
  if($('#finishCalibrationReplicateBadge'))$('#finishCalibrationReplicateBadge').textContent=`${reps} RÉPLICA${reps===1?'':'S'}`;
  if($('#finishCalibrationHead'))$('#finishCalibrationHead').innerHTML=`<tr><th>Punto</th><th>Concentración</th>${Array.from({length:reps},(_,j)=>`<th>Abs. ${j+1}</th>`).join('')}<th>Promedio</th><th>CV %</th></tr>`;
  const old=existingCalibrationReadings(p);
  $('#finishCalibrationRows').innerHTML=p.calibrationConfig.points.map((pt,i)=>{
    const rr=old[i]?.readings||[];
    return `<tr>
      <td>P${i+1}</td><td><b>${pt.concentration}</b> ${escapeHtml(unit)}</td>
      ${Array.from({length:reps},(_,j)=>`<td><input type="number" step="any" inputmode="decimal" data-cal-reading="${i}-${j}" value="${rr[j]??''}" placeholder="0.000"></td>`).join('')}
      <td data-cal-mean="${i}">—</td><td data-cal-cv="${i}">—</td>
    </tr>`;
  }).join('');
  $$('[data-cal-reading]').forEach(el=>el.addEventListener('input',updateCalibrationCalculations));
  updateCalibrationCalculations();
}
function collectCalibrationResult(p,requireComplete=true){
  if(!planRequiresCalibration(p))return {ok:true,result:null};
  const points=[];
  const reps=Math.max(1,Number(p.calibrationConfig.replicates||3));
  for(let i=0;i<p.calibrationConfig.points.length;i++){
    const readings=[];
    for(let j=0;j<reps;j++){
      const raw=$(`[data-cal-reading="${i}-${j}"]`)?.value;
      if(raw===''||raw===undefined){if(requireComplete)return {ok:false,text:`Complete las ${reps} lectura${reps===1?'':'s'} del punto P${i+1}.`};else continue}
      const n=Number(String(raw).replace(',','.'));
      if(!Number.isFinite(n))return {ok:false,text:`La absorbancia P${i+1}.${j+1} no es válida.`};
      readings.push(n);
    }
    if(readings.length===reps){
      const avg=mean(readings),sd=sampleSd(readings),cv=avg===0?null:Math.abs(sd/avg*100);
      points.push({order:i+1,concentration:Number(p.calibrationConfig.points[i].concentration),readings,mean:avg,sd,cv});
    }else{
      points.push({order:i+1,concentration:Number(p.calibrationConfig.points[i].concentration),readings});
    }
  }
  const complete=points.every(x=>x.readings.length===reps);
  const reg=complete?linearRegression(points.map(x=>({x:x.concentration,y:x.mean}))):null;
  return {ok:true,result:{unit:p.calibrationConfig.unit||'',replicates:reps,points,regression:reg,completed:complete,capturedAt:nowISO()}};
}
function updateCalibrationCalculations(){
  const planId=$('#finishActivityPlanId')?.value;if(!planId)return;
  getOne('planning',planId).then(p=>{
    if(!p||!planRequiresCalibration(p))return;
    for(let i=0;i<p.calibrationConfig.points.length;i++){
      const reps=Math.max(1,Number(p.calibrationConfig.replicates||3));
      const vals=Array.from({length:reps},(_,j)=>{const raw=$(`[data-cal-reading="${i}-${j}"]`)?.value;return raw===''||raw===undefined?NaN:Number(raw)}).filter(Number.isFinite);
      const m=$(`[data-cal-mean="${i}"]`),cv=$(`[data-cal-cv="${i}"]`);
      if(vals.length===reps){
        const avg=mean(vals),sd=sampleSd(vals),cvv=avg===0?null:Math.abs(sd/avg*100);
        if(m)m.textContent=avg.toFixed(4);
        if(cv)cv.textContent=cvv===null?'—':cvv.toFixed(2);
      }else{if(m)m.textContent='—';if(cv)cv.textContent='—'}
    }
    const collected=collectCalibrationResult(p,false),res=collected.result,box=$('#finishCalibrationSummary'),val=$('#finishCalibrationValidation');
    if(res?.completed&&res.regression){
      box.innerHTML=`<span>Pendiente <strong>${res.regression.slope.toFixed(6)}</strong></span><span>Intercepto <strong>${res.regression.intercept.toFixed(6)}</strong></span><span>R² <strong>${res.regression.r2.toFixed(6)}</strong></span>`;
      val.textContent='Curva completa: todas las lecturas están registradas.';
      val.className='inline-alert ok';
    }else{
      box.innerHTML='';
      val.textContent='Complete las tres absorbancias de todos los puntos antes de finalizar.';
      val.className='inline-alert info';
    }
  });
}
async function saveCalibrationDraft(){
  const p=await getOne('planning',$('#finishActivityPlanId').value);if(!p||!planRequiresCalibration(p))return;
  const c=collectCalibrationResult(p,false);if(!c.ok)return toast(c.text);
  p.calibrationResult=c.result;p.updatedAt=nowISO();
  await put('planning',p);await queue('UPDATE','planning',p);
  await audit('GUARDAR_CURVA_PARCIAL','MI JORNADA',p.code,`${p.analystName} guardó avance de curva de ${p.catalogName}`);
  toast('Lecturas guardadas sin finalizar · sin generar notificación');
}


function reagentContainerCycleKey(reagent,container){return `${normalizeIdentityText(reagent?.name||'')}|${normalizeIdentityText(reagent?.lot||container?.lot||'')}|${normalizeIdentityText(container?.label||'ENVASE')}|${normalizeIdentityText(container?.containerType||'FRASCO')}`}
function sameReagentContainer(reagent,container,item,env){
  if(normalizeIdentityText(reagent?.name||'')!==normalizeIdentityText(item?.name||''))return false;
  const wantedLot=normalizeIdentityText(reagent?.lot||container?.lot||''),usedLot=normalizeIdentityText(item?.lot||env?.lot||'');
  if(wantedLot!==usedLot)return false;
  // Primero conservar la identidad exacta si el ID del envase sigue vigente.
  if(container?.id&&env&&(env.containerId===container.id||env.id===container.id))return true;
  // Si el catálogo fue regrabado y cambió el ID, recuperar por lote + etiqueta + tipo.
  return normalizeIdentityText(container?.label||'ENVASE')===normalizeIdentityText(env?.label||'ENVASE') &&
    normalizeIdentityText(container?.containerType||'FRASCO')===normalizeIdentityText(env?.containerType||'FRASCO');
}
async function latestConfirmedContainerRecord(reagent,container,excludePlanId=null){
  const plans=await visiblePlanningRows();let best=null;
  for(const p of plans){
    if(p.id===excludePlanId||p.status!=='REALIZADO'||!p.reagentResult?.items?.length)continue;
    for(const item of p.reagentResult.items){
      if(item.mode!=='WEIGHT'||!Array.isArray(item.containers))continue;
      for(const env of item.containers){
        if(!sameReagentContainer(reagent,container,item,env))continue;
        const stamp=Date.parse(p.actualFinishedAt||p.updatedAt||p.createdAt||0)||0;
        if(!best||stamp>best.stamp)best={plan:p,item,container:env,stamp};
      }
    }
  }
  return best;
}
async function resolveContainerCurrentWeight(plan,reagent,container){
  const latest=await latestConfirmedContainerRecord(reagent,container,plan.id);
  if(latest){const f=Number(latest.container.finalWeight);if(Number.isFinite(f)){const dep=latest.container.depleted===true||f<=Number(latest.container.tareWeight)+0.000001;return dep?{weight:null,source:'AGOTADO',depleted:true}:{weight:f,source:'HISTORICO',depleted:false}}}
  const configured=Number(container.initialWeight);return Number.isFinite(configured)?{weight:configured,source:'CATALOGO',depleted:false}:null;
}
function reagentCycleKey(r){
  return `${normalizeIdentityText(r?.name||'')}|${normalizeIdentityText(r?.lot||'')}|${normalizeIdentityText(r?.unit||'')}`;
}
async function resolvePreviousReagentWeight(plan,reagent){
  const latest=await latestConfirmedReagentRecord(reagent,plan.id);
  if(latest){const f=Number(latest.item.finalWeight??latest.item.after);if(Number.isFinite(f)){if(reagentIsDepleted(latest.item))return {weight:null,source:'AGOTADO',depleted:true};return {weight:f,source:'HISTORICO',depleted:false}}}
  const configured=Number(reagent.initialWeight);return Number.isFinite(configured)?{weight:configured,source:'CATALOGO',depleted:false}:null;
}
async function renderFinishReagents(p){
  const block=$('#finishReagentBlock');if(!block)return;
  if(!planHasReagents(p)){block.classList.add('hidden');$('#finishReagentRows').innerHTML='';return}
  block.classList.remove('hidden');
  const oldMap=new Map((p.reagentResult?.items||[]).map(x=>[x.reagentId,x]));
  const parts=[];
  const lotCounts=new Map();
  for(const cfg of p.reagentConfig){const k=normalizeIdentityText(cfg.name||'');lotCounts.set(k,(lotCounts.get(k)||0)+1)}
  for(let i=0;i<p.reagentConfig.length;i++){
    const r=p.reagentConfig[i],old=oldMap.get(r.id)||{};
    if(r.mode==='WEIGHT'){
      const containers=Array.isArray(r.containers)&&r.containers.length?r.containers:[{id:'LEGACY',label:'Envase 1',containerType:'FRASCO',tareWeight:r.tareWeight,initialWeight:r.initialWeight}];
      const oldContainers=new Map((old.containers||[]).map(e=>[e.containerId||e.id,e]));
      const envCards=[];
      for(let j=0;j<containers.length;j++){
        const env=containers[j],oldEnv=oldContainers.get(env.id)||{},current=await resolveContainerCurrentWeight(p,r,env);
        // En una actividad nueva siempre manda el inventario confirmado más reciente.
        // Solo se conserva un peso anterior del mismo plan cuando existe un borrador real de esa actividad.
        const hasOwnDraft=oldEnv.usedInActivity===true||Number.isFinite(Number(oldEnv.finalWeight));
        const initial=hasOwnDraft&&Number.isFinite(Number(oldEnv.initialWeight))?Number(oldEnv.initialWeight):(current?.weight??null),checked=oldEnv.usedInActivity===true;
        // Un envase agotado ya no vuelve a ofrecerse en operaciones posteriores.
        if(current?.depleted&&!hasOwnDraft)continue;
        envCards.push(`<div class="reagent-container-use ${current?.depleted?'depleted':''}">
          <div class="container-use-head"><label class="container-use-check"><input type="checkbox" data-use-container="${r.id}|${env.id}" ${checked?'checked':''}> Usar en esta actividad</label><span class="badge">${escapeHtml(env.containerType||'FRASCO')} · ${escapeHtml(env.label||`Frasco ${j+1}`)} · Lote ${escapeHtml(env.lot||r.lot||'—')}</span></div>
          ${current?.depleted?`<div class="reagent-replacement-alert"><b>Envase agotado</b><span>Ingrese el peso inicial del nuevo ${env.containerType==='SOBRE'?'sobre':'frasco'}.</span></div>`:''}
          <div class="reagent-inputs">
            ${current?.depleted?`<label>Nuevo peso inicial (g)<input type="number" step="any" min="${Number(env.tareWeight||0)}" data-env-new-initial="${r.id}|${env.id}"></label><input type="hidden" data-env-initial="${r.id}|${env.id}" data-env-source="REPOSICION" value="">`:`<label>Peso inicial (g)<div class="reag-initial-control"><input readonly data-env-initial="${r.id}|${env.id}" data-env-source="${current?.source||'CATALOGO'}" value="${initial??''}"><button type="button" class="btn secondary mini-btn" data-correct-env-initial="${r.id}|${env.id}">Corregir</button></div></label>`}
            <label>Peso final (g)<input type="number" step="any" min="0" data-env-final="${r.id}|${env.id}" value="${oldEnv.finalWeight??''}" ${checked?'':'disabled'}></label>
            <label>Consumo calculado<input readonly data-env-used="${r.id}|${env.id}" value="${oldEnv.consumptionValue??''}"></label>
          </div><div class="reagent-used-result" data-env-result="${r.id}|${env.id}">Consumo: <strong>—</strong></div>
        </div>`);
      }
      if(!envCards.length)continue;
      parts.push(`<div class="reagent-capture-card"><div class="reagent-capture-head"><div><b>${escapeHtml(r.name)} · Lote ${escapeHtml(r.lot||'—')}</b><small>${r.physicalState==='LIQUID'?`LÍQUIDO · densidad ${Number(r.density).toFixed(4)} g/mL`:'SÓLIDO'} · ${envCards.length} envase(s) disponible(s)${(lotCounts.get(normalizeIdentityText(r.name||''))||0)>1?' · El analista puede usar este lote o cualquiera de los otros lotes activos del mismo reactivo.':''}</small></div><span class="badge">R${i+1}</span></div><div class="multi-container-list">${envCards.join('')}</div></div>`);
    }else{
      const latest=await latestConfirmedReagentRecord(r,p.id);
      const hasOwnDraft=old.usedInActivity===true||Number(old.used)>0;
      const currentStock=Number.isFinite(Number(latest?.item?.stockRemaining))?Number(latest.item.stockRemaining):Number(r.stockQuantity||0);
      const stock=hasOwnDraft&&Number.isFinite(Number(old.stockBefore))?Number(old.stockBefore):currentStock;
      if(stock<=0&&!hasOwnDraft)continue;
      const checked=old.usedInActivity===true||Number(old.used)>0;
      parts.push(`<div class="reagent-capture-card"><div class="reagent-capture-head"><div><b>${escapeHtml(r.name)} · Lote ${escapeHtml(r.lot||'—')}</b><small>${reagentModeLabel(r.mode)} · ${escapeHtml(r.unit||'unidad')}${(lotCounts.get(normalizeIdentityText(r.name||''))||0)>1?' · Lote seleccionable por el analista':''}</small></div><span class="badge">Stock ${stock} ${escapeHtml(r.unit||'unidad')}</span></div><div class="reagent-container-use"><div class="container-use-head"><label class="container-use-check"><input type="checkbox" data-use-countable="${r.id}" ${checked?'checked':''}> Usar en esta actividad</label><span class="badge">Lote ${escapeHtml(r.lot||'—')}</span></div><div class="reagent-inputs"><label>Stock disponible<input readonly data-reag-stock-before="${r.id}" value="${stock}"></label><label>Cantidad utilizada (${escapeHtml(r.unit||'unidad')})<input type="number" step="any" min="0" max="${stock}" data-reag-count="${r.id}" value="${checked?(old.used??''):''}" ${checked?'':'disabled'}></label></div><div class="reagent-used-result" data-reag-result="${r.id}">${checked?`Consumo: <strong>${old.used??'—'} ${escapeHtml(r.unit||'unidad')}</strong>`:'<strong>NO UTILIZADO</strong> en esta actividad.'}</div></div></div>`);
    }
  }
  $('#finishReagentRows').innerHTML=parts.length?parts.join(''):'<div class="inline-alert info"><b>Sin inventario disponible.</b> Los reactivos/envases agotados se retiraron automáticamente de esta actividad.</div>';
  $$('[data-use-container]').forEach(ch=>ch.onchange=()=>{const f=$(`[data-env-final="${ch.dataset.useContainer}"]`);if(f)f.disabled=!ch.checked;updateReagentCalculations(p)});
  $$('[data-use-countable]').forEach(ch=>ch.onchange=()=>{const f=$(`[data-reag-count="${ch.dataset.useCountable}"]`);if(f){f.disabled=!ch.checked;if(!ch.checked)f.value='';}updateReagentCalculations(p)});
  $$('[data-env-new-initial]').forEach(el=>el.oninput=()=>{const x=$(`[data-env-initial="${el.dataset.envNewInitial}"]`);if(x)x.value=el.value;updateReagentCalculations(p)});
  $$('[data-correct-env-initial]').forEach(btn=>btn.onclick=()=>{const input=$(`[data-env-initial="${btn.dataset.correctEnvInitial}"]`);if(!input)return;if(input.readOnly){input.readOnly=false;input.dataset.envSource='CORREGIDO_MANUAL';input.classList.add('manual-correction');btn.textContent='Aplicar';input.focus();input.select()}else{input.readOnly=true;btn.textContent='Corregir';updateReagentCalculations(p)}});
  $$('[data-env-final], [data-reag-count]').forEach(el=>el.addEventListener('input',()=>updateReagentCalculations(p)));
  updateReagentCalculations(p);
}

function updateReagentCalculations(p){
  if(!planHasReagents(p))return;
  for(const r of p.reagentConfig){
    if(r.mode==='WEIGHT'){
      const containers=Array.isArray(r.containers)&&r.containers.length?r.containers:[{id:'LEGACY',label:'Envase 1',tareWeight:r.tareWeight,initialWeight:r.initialWeight}];
      for(const env of containers){
        const key=`${r.id}|${env.id}`,selected=$(`[data-use-container="${key}"]`)?.checked,result=$(`[data-env-result="${key}"]`),target=$(`[data-env-used="${key}"]`);
        if(!selected){if(result)result.innerHTML='<strong>NO UTILIZADO</strong> en esta actividad.';if(target)target.value='';continue}
        const initial=Number($(`[data-env-initial="${key}"]`)?.value),finalWeight=Number($(`[data-env-final="${key}"]`)?.value);
        if(!Number.isFinite(initial)||!Number.isFinite(finalWeight)){if(result)result.innerHTML='Consumo: <strong>—</strong>';continue}
        const used=initial-finalWeight,density=Number(r.density),volumeMl=r.physicalState==='LIQUID'&&density>0?used/density:null;
        if(target)target.value=used<0?'':(r.physicalState==='LIQUID'?volumeMl.toFixed(3):used.toFixed(3));
        if(result)result.innerHTML=used<0?'<strong>ERROR: peso final mayor al inicial</strong>':r.physicalState==='LIQUID'?`Consumo: <strong>${used.toFixed(3)} g / ${volumeMl.toFixed(3)} mL</strong>`:`Consumo: <strong>${used.toFixed(3)} g</strong>`;
      }
    }else{
      const selected=$(`[data-use-countable="${r.id}"]`)?.checked,result=$(`[data-reag-result="${r.id}"]`),raw=$(`[data-reag-count="${r.id}"]`)?.value,n=raw===''?null:Number(raw);
      if(!selected){if(result)result.innerHTML='<strong>NO UTILIZADO</strong> en esta actividad.';continue}
      const stock=Number($(`[data-reag-stock-before="${r.id}"]`)?.value);if(result)result.innerHTML=n===null||!Number.isFinite(n)?'Consumo: <strong>—</strong>':n>stock?'<strong>ERROR: consumo mayor al stock</strong>':`Consumo: <strong>${n} ${escapeHtml(r.unit||'unidad')}</strong> · Stock final: <strong>${(stock-n).toFixed(2)} ${escapeHtml(r.unit||'unidad')}</strong>`;
    }
  }
  const check=collectReagentResult(p,false),v=$('#finishReagentValidation');if(!v)return;
  if(check.complete){v.textContent='Registro listo. Solo se exigirá consumo para los reactivos o envases que marque como utilizados; los demás quedarán como NO UTILIZADOS.';v.className='inline-alert ok'}else{v.textContent='Complete únicamente los datos de los reactivos o envases que haya marcado como utilizados.';v.className='inline-alert info'}
}

function collectReagentResult(p,requireComplete=true){
  if(!planHasReagents(p))return {ok:true,complete:true,result:null};
  const items=[];let complete=true;
  for(const r of p.reagentConfig){
    if(r.mode==='WEIGHT'){
      const containers=Array.isArray(r.containers)&&r.containers.length?r.containers:[{id:'LEGACY',label:'Envase 1',containerType:'FRASCO',tareWeight:r.tareWeight,initialWeight:r.initialWeight}],usedContainers=[];
      for(const env of containers){
        const key=`${r.id}|${env.id}`,selected=$(`[data-use-container="${key}"]`)?.checked;if(!selected)continue;
        const ri=$(`[data-env-initial="${key}"]`)?.value,rf=$(`[data-env-final="${key}"]`)?.value;
        if(ri===''||rf===''){complete=false;if(requireComplete)return {ok:false,text:`Complete los pesos de ${r.name} · ${env.label}.`};continue}
        const initialWeight=Number(ri),finalWeight=Number(rf),tareWeight=Number(env.tareWeight||0);
        if(!Number.isFinite(initialWeight)||!Number.isFinite(finalWeight)||initialWeight<=tareWeight||finalWeight<0||finalWeight>initialWeight)return {ok:false,text:`Revise los pesos de ${r.name} · ${env.label}.`};
        const used=initialWeight-finalWeight,density=r.physicalState==='LIQUID'?Number(r.density):null,volumeUsedMl=r.physicalState==='LIQUID'&&density>0?used/density:null,netRemainingG=Math.max(0,finalWeight-tareWeight),netRemainingMl=r.physicalState==='LIQUID'&&density>0?netRemainingG/density:null,depleted=netRemainingG<=0.000001,source=$(`[data-env-initial="${key}"]`)?.dataset?.envSource||'HISTORICO';
        usedContainers.push({containerId:env.id,label:env.label,lot:env.lot||r.lot||'',containerType:env.containerType||'FRASCO',usedInActivity:true,tareWeight,initialWeight,finalWeight,used,volumeUsedMl,netRemainingG,netRemainingMl,depleted,initialSource:source,initialWeightCorrected:source==='CORREGIDO_MANUAL'});
      }
      if(!usedContainers.length){
        items.push({reagentId:r.id,name:r.name,lot:r.lot||'',mode:r.mode,unit:'g',physicalState:r.physicalState||'SOLID',density:r.physicalState==='LIQUID'?Number(r.density):null,containers:[],used:0,volumeUsedMl:r.physicalState==='LIQUID'?0:null,consumptionValue:0,consumptionUnit:r.physicalState==='LIQUID'?'mL':'g',usedInActivity:false,notUsed:true,depleted:false});
        continue;
      }
      const totalMass=usedContainers.reduce((a,e)=>a+(e.used||0),0),totalMl=r.physicalState==='LIQUID'?usedContainers.reduce((a,e)=>a+(e.volumeUsedMl||0),0):null;
      items.push({reagentId:r.id,name:r.name,lot:r.lot||'',mode:r.mode,unit:'g',physicalState:r.physicalState||'SOLID',density:r.physicalState==='LIQUID'?Number(r.density):null,containers:usedContainers,used:totalMass,volumeUsedMl:totalMl,consumptionValue:r.physicalState==='LIQUID'?totalMl:totalMass,consumptionUnit:r.physicalState==='LIQUID'?'mL':'g',usedInActivity:true,notUsed:false,depleted:usedContainers.every(e=>e.depleted)});
    }else{
      const selected=$(`[data-use-countable="${r.id}"]`)?.checked;
      const stockBefore=Number($(`[data-reag-stock-before="${r.id}"]`)?.value||r.stockQuantity||0);
      if(!selected){items.push({reagentId:r.id,name:r.name,lot:r.lot||'',mode:r.mode,unit:r.unit||'unidad',stockBefore,used:0,stockRemaining:stockBefore,usedInActivity:false,notUsed:true});continue}
      const raw=$(`[data-reag-count="${r.id}"]`)?.value;
      if(raw===''){complete=false;if(requireComplete)return {ok:false,text:`Ingrese la cantidad utilizada de ${r.name} · lote ${r.lot||'—'}, o desmarque “Usar en esta actividad”.`};continue}
      const used=Number(raw);if(!Number.isFinite(used)||used<=0||!Number.isFinite(stockBefore)||used>stockBefore)return {ok:false,text:`Revise la cantidad utilizada de ${r.name}; debe ser mayor que 0 y no puede superar el stock disponible.`};
      items.push({reagentId:r.id,name:r.name,lot:r.lot||'',mode:r.mode,unit:r.unit||'unidad',stockBefore,used,stockRemaining:stockBefore-used,usedInActivity:true,notUsed:false});
    }
  }
  return {ok:true,complete,result:{items,completed:complete,capturedAt:nowISO()}};
}

async function saveReagentDraft(){
  const p=await getOne('planning',$('#finishActivityPlanId').value);if(!p||!planHasReagents(p))return;
  const rr=collectReagentResult(p,false);if(!rr.ok)return toast(rr.text);
  p.reagentResult=rr.result;p.updatedAt=nowISO();await put('planning',p);await queue('UPDATE','planning',p);
  await audit('GUARDAR_CONSUMO_REACTIVOS_PARCIAL','MI JORNADA',p.code,`${p.analystName} guardó consumos parciales de ${p.catalogName}`);
  toast('Consumos guardados sin finalizar · sin generar notificación');
}


async function getTechnicalRequirementsForPlan(p){
  if(!p)return {curve:false,reagents:false,catalog:null};
  const catalog=await getAll('catalog');
  let item=catalog.find(x=>x.id===p.catalogId);
  if(!item)item=catalog.find(x=>x.section===p.section&&normalizeIdentityText(x.name)===normalizeIdentityText(p.catalogName));
  return {
    curve:planRequiresCalibration(p)||!!(item?.calibrationConfig?.enabled&&item.calibrationConfig?.points?.length),
    reagents:planHasReagents(p)||!!item?.reagentConfig?.length,
    catalog:item||null
  };
}
function technicalRequirementMenuHtml(p,req){
  if(!req.curve&&!req.reagents)return '';
  const doneCurve=!req.curve||!!p.calibrationResult?.completed;
  const doneReagents=!req.reagents||!!p.reagentResult?.completed;
  const allDone=doneCurve&&doneReagents;
  const rows=[];
  if(req.curve)rows.push(`<div class="tech-req-item ${doneCurve?'done':''}"><span class="tech-req-icon">${doneCurve?'✓':'1'}</span><span><b>Curva de calibración</b><small>${doneCurve?'Datos registrados':'Registrar absorbancia 1, 2 y 3 por cada punto'}</small></span></div>`);
  if(req.reagents)rows.push(`<div class="tech-req-item ${doneReagents?'done':''}"><span class="tech-req-icon">${doneReagents?'✓':'2'}</span><span><b>Reactivos / materiales</b><small>${doneReagents?'Consumos registrados':'Registrar peso final o cantidad utilizada'}</small></span></div>`);
  const button=p.status==='REALIZADO'
    ?`<button type="button" class="btn secondary tech-req-action" data-edit-technical="${p.id}">Ver datos técnicos</button>`
    :`<button type="button" class="btn secondary tech-req-action" data-open-technical="${p.id}">${allDone?'Revisar datos técnicos':'Registrar datos técnicos'}</button>`;
  return `<div class="tech-req-menu"><div class="tech-req-head"><div><b>Requisitos para finalizar</b><small>${allDone?'Datos técnicos completos':'Complete estos datos antes de finalizar la actividad'}</small></div><span class="tech-req-status ${allDone?'done':''}">${allDone?'COMPLETO':'PENDIENTE'}</span></div><div class="tech-req-items">${rows.join('')}</div>${button}</div>`;
}


function mergeReagentConfigFromCatalog(oldCfg=[],newCfg=[]){const m=new Map((oldCfg||[]).map(x=>[x.id,x]));return (newCfg||[]).map((x,i)=>({...m.get(x.id),...JSON.parse(JSON.stringify(x)),order:x.order??i+1}))}
function reagentIsDepleted(item){if(!item||item.mode!=='WEIGHT')return false;if(item.depleted===true)return true;const f=Number(item.finalWeight??item.after),t=Number(item.tareWeight);return Number.isFinite(f)&&Number.isFinite(t)&&f<=t+0.000001}
async function latestConfirmedReagentRecord(reagent,excludePlanId=null){const key=reagentCycleKey(reagent),plans=await visiblePlanningRows();let best=null;for(const p of plans){if(p.id===excludePlanId||p.status!=='REALIZADO'||!p.reagentResult?.items?.length)continue;for(const item of p.reagentResult.items){if(reagentCycleKey(item)!==key)continue;const stamp=Date.parse(p.actualFinishedAt||p.updatedAt||p.createdAt||0)||0;if(!best||stamp>best.stamp)best={plan:p,item,stamp}}}return best}
async function hydratePlanTechnicalRequirements(p){
  if(!p)return p;let changed=false;
  const catalog=await getAll('catalog');let item=catalog.find(x=>x.id===p.catalogId);
  if(!item)item=catalog.find(x=>x.section===p.section&&normalizeIdentityText(x.name)===normalizeIdentityText(p.catalogName));
  if(!item)return p;
  if(item.calibrationConfig?.enabled&&item.calibrationConfig?.points?.length&&!planRequiresCalibration(p)){p.calibrationConfig=JSON.parse(JSON.stringify(item.calibrationConfig));p.calibrationResult=p.calibrationResult||null;changed=true}
  if(item.reagentConfig?.length && p.status!=='REALIZADO'){
    const oldCfg=p.reagentConfig||[], merged=mergeReagentConfigFromCatalog(oldCfg,item.reagentConfig);
    if(JSON.stringify(merged)!==JSON.stringify(oldCfg)){
      const capturedIds=new Set((p.reagentResult?.items||[]).map(x=>x?.reagentId).filter(Boolean));
      const addedPending=merged.some(r=>r?.id&&!capturedIds.has(r.id));
      p.reagentConfig=merged;
      // Si el catálogo agregó un reactivo/lote después de que el analista había
      // completado el formulario anterior, el registro vuelve a PENDIENTE para
      // que el nuevo insumo se vea y pueda marcarse USADO o NO UTILIZADO.
      if(addedPending&&p.reagentResult?.completed)p.reagentResult={...p.reagentResult,completed:false,catalogExpandedAt:nowISO()};
      changed=true;
    }
    p.reagentResult=p.reagentResult||null;
  }
  if(changed){p.updatedAt=nowISO();await put('planning',p);await queue('UPDATE','planning',p)}
  return p;
}

async function openTechnicalData(planId){
  let p=await getOne('planning',planId);if(!p)return;
  if(!assertOwnPlan(p)&&currentSessionUser?.role!=='JEFE')return toast('No tiene permiso para consultar esta actividad');
  p=await hydratePlanTechnicalRequirements(p);
  if(!planRequiresCalibration(p)&&!planHasReagents(p))return toast('Esta actividad no tiene datos técnicos configurados');

  const isDone=p.status==='REALIZADO';
  $('#finishActivityPlanId').value=p.id;
  $('#finishTechnicalEditMode').value=isDone?'3':'2';
  const title=$('#finishActivityTitle');if(title)title.textContent=isDone?'Actividad finalizada · consulta':'Registro técnico';
  $('#finishActivitySummary').innerHTML=`<b>${escapeHtml(p.catalogName)}</b><span>${isDone?'Actividad REALIZADA · solo visualización':'Registro técnico previo a finalizar'}</span>`;
  $('#finishSamplesLabel').classList.add('hidden');
  $('#finishActualSamples').required=false;
  $('#finishActualSamples').value=p.actualSamples??'';
  $('#finishActivityComment').value='';
  $('#finishActivityHelp').textContent=isDone
    ?'Consulta en modo solo lectura. Para corregir datos técnicos use “Editar con contraseña”. El estado REALIZADO y los tiempos originales no cambian.'
    :'Puede guardar avances cuantas veces necesite. Guardar sin finalizar NO genera notificaciones.';
  renderFinishCalibration(p);
  await renderFinishReagents(p);
  const submit=$('#finishSubmitBtn'),unlock=$('#btnUnlockTechnicalEdit');
  if(isDone){
    setFinishTechnicalReadOnly(true);
    if(submit)submit.classList.add('hidden');
    if(unlock)unlock.classList.remove('hidden');
  }else{
    setFinishTechnicalReadOnly(false);
    if(submit){submit.classList.remove('hidden');submit.textContent='Guardar datos técnicos'}
    if(unlock)unlock.classList.add('hidden');
  }
  $('#finishActivityDialog').showModal();
}

async function editCompletedTechnicalData(planId){return openTechnicalData(planId)}
async function finishMyActivity(planId){
  const _guardPlan=await getOne('planning',planId);if(!_guardPlan||!assertOwnPlan(_guardPlan))return toast('No puede modificar actividades de otro analista');
  let p=await getOne('planning',planId);if(!p)return;
  // Releer la ficha técnica vigente justo antes de abrir la finalización.
  // Esto permite que un reactivo/lote agregado por el jefe después de planificar
  // aparezca aunque la actividad ya esté iniciada o el modal se hubiera abierto antes.
  p=await hydratePlanTechnicalRequirements(p);
  if(p.status==='REALIZADO')return toast('La actividad ya está finalizada');
  if(!p.actualStartedAt)return toast('Primero debe iniciar la actividad');

  const needsSamples=requiresActualSamples(p.section),needsCurve=planRequiresCalibration(p),needsReagents=planHasReagents(p);
  if(needsSamples||needsCurve||needsReagents){
    $('#finishActivityPlanId').value=p.id;
    $('#finishTechnicalEditMode').value='0';
    const _finishSubmit=$('#finishSubmitBtn');if(_finishSubmit){_finishSubmit.classList.remove('hidden');_finishSubmit.textContent='✓ Confirmar finalización'}
    $('#btnUnlockTechnicalEdit')?.classList.add('hidden');
    setFinishTechnicalReadOnly(false);
    const _finishTitle=$('#finishActivityTitle');if(_finishTitle)_finishTitle.textContent='Finalizar actividad';
    $('#finishActivitySummary').innerHTML=`<b>${escapeHtml(p.catalogName)}</b><span>${escapeHtml(sectionMeta(p.section).label)} · ${p.startTime}–${p.endTime} · ${minutesText(p.durationMinutes)}</span>`;
    $('#finishSamplesLabel').classList.toggle('hidden',!needsSamples);
    $('#finishActualSamples').required=needsSamples;
    $('#finishActualSamples').value=needsSamples?(p.actualSamples??''):'';
    $('#finishActivityComment').value='';
    $('#finishActivityHelp').textContent=(needsCurve&&needsReagents)?'Antes de finalizar debe completar la curva de calibración y registrar los reactivos/materiales utilizados.':needsCurve?'Complete las lecturas requeridas de la curva antes de finalizar.':needsReagents?'Registre el consumo real de los reactivos/materiales antes de finalizar.':'Para cerrar esta actividad registre cuántas muestras procesó realmente.';
    renderFinishCalibration(p);await renderFinishReagents(p);
    $('#finishActivityDialog').showModal();
    setTimeout(()=>needsCurve?document.querySelector('[data-cal-reading]')?.focus():needsReagents?document.querySelector('[data-reag-count], [data-reag-final]')?.focus():$('#finishActualSamples').focus(),50);
    return;
  }
  await completeActivityRecord(p,null,'');
}
async function applyConfirmedReagentInventoryToCatalog(p){
  if(!p?.reagentResult?.items?.length)return;
  // INVENTARIO GLOBAL VIVO: nombre + lote es una sola existencia aunque el reactivo
  // esté configurado en varias actividades. Al cerrar un consumo se actualizan TODAS
  // las fichas que apuntan al mismo lote para impedir que reaparezca un stock antiguo.
  const catalogs=await getAll('catalog');
  const usedItems=(p.reagentResult.items||[]).filter(x=>x&&x.usedInActivity!==false&&!x.notUsed);
  if(!usedItems.length)return;
  const itemByIdentity=new Map(usedItems.map(item=>[`${normalizeIdentityText(item.name||'')}|${normalizeIdentityText(item.lot||'')}`,item]));
  for(const catalog of catalogs){
    if(!Array.isArray(catalog.reagentConfig)||!catalog.reagentConfig.length)continue;
    let changed=false;
    catalog.reagentConfig=catalog.reagentConfig.map(r=>{
      const key=`${normalizeIdentityText(r.name||'')}|${normalizeIdentityText(r.lot||'')}`;
      const item=itemByIdentity.get(key);if(!item)return r;
      const next=JSON.parse(JSON.stringify(r));
      if(next.mode==='COUNT'&&item.mode==='COUNT'&&Number.isFinite(Number(item.stockRemaining))){
        next.stockQuantity=Math.max(0,Number(item.stockRemaining));
        next.inventoryStatus=next.stockQuantity<=0?'AGOTADO':'ACTIVO';
        changed=true;
      }
      if(next.mode==='WEIGHT'&&item.mode==='WEIGHT'&&Array.isArray(next.containers)&&Array.isArray(item.containers)){
        next.containers=next.containers.map(env=>{
          const hit=item.containers.find(x=>(x.containerId||x.id)===env.id)||item.containers.find(x=>normalizeIdentityText(x.label||'')===normalizeIdentityText(env.label||'')&&normalizeIdentityText(x.containerType||'FRASCO')===normalizeIdentityText(env.containerType||'FRASCO'));
          if(!hit)return env;
          const final=Number(hit.finalWeight);changed=true;
          return {...env,initialWeight:Number.isFinite(final)?final:env.initialWeight,status:hit.depleted?'AGOTADO':'ACTIVO'};
        });
        next.inventoryStatus=next.containers.some(x=>x.status!=='AGOTADO')?'ACTIVO':'AGOTADO';
      }
      return next;
    });
    if(changed){catalog.updatedAt=nowISO();await put('catalog',catalog);await queue('UPDATE','catalog',catalog)}
  }
  reagentMasterProfiles=[];
}


async function propagateLiveInventoryToOpenPlans(){
  const catalogs=await getAll('catalog'), plans=await visiblePlanningRows();
  const byId=new Map(catalogs.map(c=>[c.id,c])); let changed=0;
  for(const p of plans){
    if(['REALIZADO','CANCELADO'].includes(p.status))continue;
    const c=byId.get(p.catalogId); if(!c?.reagentConfig?.length)continue;
    const next=mergeOpenPlanReagentConfig(p,c.reagentConfig).filter(r=>{
      if(r.mode==='COUNT')return r.inventoryStatus!=='AGOTADO'&&Number(r.stockQuantity||0)>0;
      if(r.mode==='WEIGHT')return r.inventoryStatus!=='AGOTADO'&&(r.containers||[]).some(e=>e.status!=='AGOTADO');
      return true;
    });
    if(JSON.stringify(next)!==JSON.stringify(p.reagentConfig||[])){
      p.reagentConfig=next;p.inventorySyncedAt=nowISO();p.updatedAt=nowISO();
      await put('planning',p);await queue('UPDATE','planning',p);changed++;
    }
  }
  return changed;
}
async function reconcileInventoryFromConfirmedHistory(){
  const catalogs=await getAll('catalog'); let touched=0;
  for(const c of catalogs){
    if(!Array.isArray(c.reagentConfig))continue; let changed=false;
    for(const r of c.reagentConfig){
      if(r.mode==='COUNT'){
        const latest=await latestConfirmedReagentRecord(r);
        const sr=Number(latest?.item?.stockRemaining);
        if(Number.isFinite(sr)&&Number(r.stockQuantity)!==Math.max(0,sr)){
          r.stockQuantity=Math.max(0,sr);r.inventoryStatus=r.stockQuantity<=0?'AGOTADO':'ACTIVO';changed=true;
        }
      }else if(r.mode==='WEIGHT'&&Array.isArray(r.containers)){
        for(const env of r.containers){
          const latest=await latestConfirmedContainerRecord(r,env);
          if(!latest)continue; const f=Number(latest.container.finalWeight);
          const depleted=latest.container.depleted===true||(Number.isFinite(f)&&f<=Number(env.tareWeight)+0.000001);
          if(Number.isFinite(f)&&Number(env.initialWeight)!==f){env.initialWeight=f;changed=true}
          const st=depleted?'AGOTADO':'ACTIVO';if(env.status!==st){env.status=st;changed=true}
        }
        const st=r.containers.some(e=>e.status!=='AGOTADO')?'ACTIVO':'AGOTADO';if(r.inventoryStatus!==st){r.inventoryStatus=st;changed=true}
      }
    }
    if(changed){c.updatedAt=nowISO();await put('catalog',c);await queue('UPDATE','catalog',c);touched++}
  }
  if(touched)await propagateLiveInventoryToOpenPlans();
  reagentMasterProfiles=[];return touched;
}
async function validateReagentResultAgainstLiveInventory(result){
  if(!result?.items?.length)return {ok:true};
  await reconcileInventoryFromConfirmedHistory();
  const catalogs=await getAll('catalog');
  const all=catalogs.flatMap(c=>c.reagentConfig||[]);
  for(const item of result.items.filter(x=>x?.usedInActivity!==false&&!x?.notUsed)){
    const live=all.find(r=>normalizeIdentityText(r.name||'')===normalizeIdentityText(item.name||'')&&normalizeIdentityText(r.lot||'')===normalizeIdentityText(item.lot||''));
    if(!live)continue;
    if(item.mode==='COUNT'){
      const stock=Number(live.stockQuantity||0), used=Number(item.used||0);
      if(live.inventoryStatus==='AGOTADO'||stock<=0)return {ok:false,text:`${item.name} · lote ${item.lot||'—'} ya está AGOTADO. El inventario fue actualizado; vuelva a abrir la actividad.`};
      if(used>stock)return {ok:false,text:`Stock actualizado de ${item.name} · lote ${item.lot||'—'}: ${stock} ${live.unit||item.unit||'unidad'}. El consumo ingresado (${used}) ya no está disponible.`};
      item.stockBefore=stock;item.stockRemaining=Math.max(0,stock-used);
    }
  }
  return {ok:true};
}
async function claimActivityCompletion(plan){
  if(!plan?.id)return {ok:false,reason:'Actividad inválida'};
  if(activityCompletionLocks.has(plan.id))return {ok:false,reason:'La finalización ya está en proceso'};
  activityCompletionLocks.add(plan.id);
  // Cuando Firebase está configurado, el cierre que mueve inventario exige una
  // transacción cloud. Esto evita que dos PCs descuenten el mismo plan a la vez.
  if(firebaseBridge.configured){
    if(!firebaseBridge.ready||!firebaseBridge.authUser){activityCompletionLocks.delete(plan.id);return {ok:false,reason:'Sin conexión confirmada con Firebase. Los datos pueden guardarse, pero para finalizar y descontar inventario se requiere conexión para evitar duplicidades.'};}
    try{
      const {doc,runTransaction}=firebaseBridge.mods;
      const ref=doc(firebaseBridge.db,'planning',plan.id);
      const owner=`${currentSessionUser?.email||currentSessionUser?.name||'usuario'}|${nowISO()}`;
      const result=await runTransaction(firebaseBridge.db,async tx=>{
        const snap=await tx.get(ref);const cloud=snap.exists()?snap.data():null;
        if(cloud?.status==='REALIZADO'||cloud?.completionCommittedAt)return {claimed:false,cloud};
        tx.set(ref,{completionClaim:owner,completionClaimedAt:nowISO(),updatedAt:nowISO()},{merge:true});
        return {claimed:true,owner};
      });
      if(!result.claimed){activityCompletionLocks.delete(plan.id);return {ok:false,reason:'Esta actividad ya fue finalizada desde otra sesión/equipo. Se actualizarán los datos desde Firebase.'};}
      plan.completionClaim=result.owner;plan.completionClaimedAt=nowISO();
      return {ok:true};
    }catch(err){activityCompletionLocks.delete(plan.id);return {ok:false,reason:`No se pudo obtener el bloqueo anti-duplicado en Firebase: ${String(err?.message||err)}`};}
  }
  return {ok:true};
}
function releaseActivityCompletion(planId){if(planId)activityCompletionLocks.delete(planId)}

async function completeActivityRecord(p,actualSamples=null,finalComment='',calibrationResult=undefined,reagentResult=undefined){
  p.status='REALIZADO';p.actualFinishedAt=nowISO();p.completionCommittedAt=p.actualFinishedAt;p.completionCommittedBy=currentSessionUser?.email||currentSessionUser?.name||'Usuario';p.updatedAt=nowISO();
  if(actualSamples!==null)p.actualSamples=Math.max(0,Number(actualSamples));if(calibrationResult!==undefined)p.calibrationResult=calibrationResult;if(reagentResult!==undefined)p.reagentResult=reagentResult;
  await put('planning',p);await queue('UPDATE','planning',p);
  // Confirmar el saldo como inventario vivo: el siguiente uso parte del peso/stock final real.
  await applyConfirmedReagentInventoryToCatalog(p);
  if(finalComment){
    const comment={id:uid('COM'),planId:p.id,analystId:p.analystId,authorName:p.analystName,text:finalComment,createdAt:nowISO()};
    await put('planComments',comment);await queue('CREATE','planComments',comment);
  }
  const sampleDetail=p.actualSamples!==null&&p.actualSamples!==undefined?` · ${p.actualSamples} muestras analizadas`:'';const curveDetail=p.calibrationResult?.completed?` · curva ${p.calibrationResult.points.length} puntos × ${Number(p.calibrationResult.replicates||p.calibrationConfig?.replicates||3)} · R² ${p.calibrationResult.regression?.r2?.toFixed(6)??'—'}`:'';const reagentDetail=p.reagentResult?.completed?` · ${p.reagentResult.items.length} consumo(s) de reactivos registrados`:'';
  await audit('FINALIZAR_ACTIVIDAD','MI JORNADA',p.code,`${p.analystName} finalizó ${p.catalogName} a las ${formatActualStamp(p.actualFinishedAt)}${sampleDetail}${curveDetail}${reagentDetail}`);
  // Avisos organizados: el cierre de actividad queda separado de los datos técnicos.
  await createActivityLifecycleAlert(p,'FINALIZACION');
  // Solo al CONFIRMAR FINALIZACIÓN: nunca en “guardar sin finalizar”. Agrupa curva/estándares y reactivos en un único aviso técnico.
  if(p.calibrationResult?.completed||p.reagentResult?.completed)await createTechnicalAlert(p,'CIERRE_TECNICO',{stage:'FINAL'});
  toast(`Actividad finalizada${sampleDetail} · notificaciones organizadas enviadas`);
  await renderMyDay();await renderAgenda();await renderDailyLoad();await renderAudit();await renderManagementDashboard();
  releaseActivityCompletion(p.id);
}
async function submitFinishActivity(e){
  e.preventDefault();
  let p=await getOne('planning',$('#finishActivityPlanId').value);if(!p)return;
  p=await hydratePlanTechnicalRequirements(p);
  const mode=$('#finishTechnicalEditMode')?.value||'0';

  let calibrationResult=undefined;
  if(planRequiresCalibration(p)){
    const curve=collectCalibrationResult(p,true);
    if(!curve.ok)return toast(curve.text);
    if(!curve.result?.completed)return toast('Complete todos los puntos de la curva');
    calibrationResult=curve.result;
  }
  let reagentResult=undefined;
  if(planHasReagents(p)){
    const rr=collectReagentResult(p,true);
    if(!rr.ok)return toast(rr.text);
    if(!rr.complete)return toast('Complete todos los consumos de reactivos');
    reagentResult=rr.result;
    const liveCheck=await validateReagentResultAgainstLiveInventory(reagentResult);
    if(!liveCheck.ok){await renderFinishReagents(p);return toast(liveCheck.text)}
  }
  const comment=$('#finishActivityComment').value.trim();

  if(mode==='3')return toast('Actividad finalizada en modo solo lectura');

  if(mode==='1'||mode==='2'){
    if(calibrationResult!==undefined)p.calibrationResult=calibrationResult;
    if(reagentResult!==undefined)p.reagentResult=reagentResult;
    p.technicalEditedAt=nowISO();
    p.technicalEditedBy=currentSessionUser?.name||currentSessionUser?.email||'Usuario';
    p.updatedAt=nowISO();
    await put('planning',p);await queue('UPDATE','planning',p);
    if(comment){
      const rec={id:uid('COM'),planId:p.id,text:`${mode==='1'?'[EDICIÓN TÉCNICA POST-CIERRE]':'[REGISTRO TÉCNICO]'} ${comment}`,author:p.technicalEditedBy,authorName:p.technicalEditedBy,createdAt:nowISO()};
      await put('planComments',rec);await queue('CREATE','planComments',rec);
    }
    await audit(mode==='1'?'EDITAR_DATOS_TECNICOS_POST_CIERRE':'GUARDAR_DATOS_TECNICOS_PREVIOS','MI JORNADA',p.code,`${p.technicalEditedBy} guardó datos técnicos de ${p.catalogName}`);
    const _corrected=(p.reagentResult?.items||[]).filter(x=>x.initialWeightCorrected);
    if(_corrected.length)await audit('CORREGIR_PESO_INICIAL_REACTIVO','MI JORNADA',p.code,`${p.technicalEditedBy} corrigió peso inicial de: ${_corrected.map(x=>`${x.name} (${x.initialWeight} g)`).join(', ')}`);
    $('#finishActivityDialog').close();$('#finishTechnicalEditMode').value='0';
    toast(mode==='1'?'Datos técnicos actualizados · sin nueva notificación':'Datos técnicos guardados · sin notificar · ahora puede finalizar cuando corresponda');
    await renderMyDay();return;
  }

  if(p.status==='REALIZADO'){ $('#finishActivityDialog').close(); return toast('La actividad ya está finalizada') }
  const samples=Number($('#finishActualSamples').value);
  if(requiresActualSamples(p.section)&&(!Number.isFinite(samples)||samples<0))return toast('Ingrese el número de muestras analizadas');
  const dailyGate=await assertDailyControlsBeforeDayClose(p);
  if(!dailyGate.ok){alert(dailyGate.message);await renderMyDay();return toast('Complete las cartas de control obligatorias antes de cerrar la jornada');}
  const claim=await claimActivityCompletion(p);
  if(!claim.ok){toast(claim.reason);if(firebaseBridge.ready&&firebaseBridge.authUser)await pullFirebaseData(false);return;}
  const submitBtn=$('#finishSubmitBtn');if(submitBtn)submitBtn.disabled=true;
  $('#finishActivityDialog').close();
  try{await completeActivityRecord(p,requiresActualSamples(p.section)?samples:null,comment,calibrationResult,reagentResult);}
  catch(err){releaseActivityCompletion(p.id);throw err;}
  finally{if(submitBtn)submitBtn.disabled=false;}
}

async function renderRecentMyActivities(analystId){
  if(!$('#myDayRecent'))return;
  if(!analystId){$('#myDayRecent').innerHTML='';return}
  const recent=(await getAll('planning'))
    .filter(p=>p.analystId===analystId&&p.status==='REALIZADO')
    .sort((a,b)=>String(b.actualFinishedAt||b.updatedAt||b.date).localeCompare(String(a.actualFinishedAt||a.updatedAt||a.date)))
    .slice(0,5);
  $('#myDayRecent').innerHTML=recent.length
    ?`<div class="recent-head"><div><h3>Últimas 5 actividades realizadas</h3><p>Solo se muestran las más recientes; el histórico completo permanece en trazabilidad.</p></div></div>
      <div class="recent-list">${recent.map(p=>`<div class="recent-item"><div><b>${escapeHtml(p.catalogName)}</b><span>${escapeHtml(p.date)} · ${escapeHtml(sectionMeta(p.section).label)}</span></div><div><strong>${p.startTime}–${p.endTime}</strong><span>${minutesText(p.durationMinutes)}</span></div></div>`).join('')}</div>`
    :`<div class="recent-head"><div><h3>Últimas actividades</h3><p>Aún no hay actividades finalizadas para este analista.</p></div></div>`;
}


async function flexibleDayPlans(date,analystId){
  return (await getAll('planning'))
    .filter(p=>p.date===date&&p.analystId===analystId&&p.status!=='CANCELADO')
    .sort((a,b)=>(Number(a.analystOrder??9999)-Number(b.analystOrder??9999))||a.startTime.localeCompare(b.startTime));
}
async function reflowAnalystDay(date,analystId,orderedIds,reason='REORDENAR'){
  const all=await flexibleDayPlans(date,analystId);
  const locked=all.filter(p=>p.status!=='PROGRAMADO');
  const pending=orderedIds.map(id=>all.find(p=>p.id===id)).filter(Boolean)
    .concat(all.filter(p=>p.status==='PROGRAMADO'&&!orderedIds.includes(p.id)));
  const virtual=locked.map(p=>({...p}));
  let order=1,changes=[];
  for(const p of pending){
    if(!p.originalStartTime){p.originalStartTime=p.startTime;p.originalEndTime=p.endTime}
    const slot=findBestWorkSlot(virtual,analystId,Number(p.durationMinutes||0));
    if(!slot)throw new Error(`No existe espacio laboral suficiente para ${p.catalogName}`);
    const old=`${p.startTime}-${p.endTime}`;
    p.startTime=minutesToTime(slot.start);p.endTime=minutesToTime(slot.end);p.analystOrder=order++;p.updatedAt=nowISO();
    await put('planning',p);await queue('UPDATE','planning',p);virtual.push({...p});
    if(old!==`${p.startTime}-${p.endTime}`)changes.push(`${p.catalogName}: ${old} → ${p.startTime}-${p.endTime}`);
  }
  await audit(reason,'MI JORNADA',analystId,changes.length?changes.join(' · '):'Cambio de prioridad sin modificación horaria');
  toast('Jornada reorganizada automáticamente');
  await renderMyDay();await renderAgenda();await renderDailyLoad();await renderAudit();
}
async function moveMyActivity(planId,direction){
  const p=await getOne('planning',planId);if(!p||p.status!=='PROGRAMADO')return;
  const list=(await flexibleDayPlans(p.date,p.analystId)).filter(x=>x.status==='PROGRAMADO');
  const idx=list.findIndex(x=>x.id===planId),to=idx+direction;
  if(idx<0||to<0||to>=list.length)return;
  [list[idx],list[to]]=[list[to],list[idx]];
  try{await reflowAnalystDay(p.date,p.analystId,list.map(x=>x.id),'REORDENAR_ANALISTA')}catch(e){toast(e.message)}
}
async function prioritizeMyActivity(planId){
  const _guardPlan=await getOne('planning',planId);if(!_guardPlan||!assertOwnPlan(_guardPlan))return toast('No puede modificar actividades de otro analista');
  const p=await getOne('planning',planId);if(!p||p.status!=='PROGRAMADO')return;
  const list=(await flexibleDayPlans(p.date,p.analystId)).filter(x=>x.status==='PROGRAMADO');
  const ids=[planId,...list.filter(x=>x.id!==planId).map(x=>x.id)];
  try{await reflowAnalystDay(p.date,p.analystId,ids,'PRIORIZAR_ANALISTA')}catch(e){toast(e.message)}
}
async function restoreBossSchedule(date,analystId){
  if(currentSessionUser?.role==='ANALISTA'&&analystId!==currentSessionUser?.analystId)return toast('Acceso restringido');
  const list=await flexibleDayPlans(date,analystId);let changed=0;
  for(const p of list){
    if(p.status==='PROGRAMADO'&&p.originalStartTime){
      p.startTime=p.originalStartTime;p.endTime=p.originalEndTime;p.analystOrder=null;p.updatedAt=nowISO();
      await put('planning',p);await queue('UPDATE','planning',p);changed++;
    }
  }
  if(changed){await audit('RESTAURAR_PLAN_JEFE','MI JORNADA',analystId,`${changed} actividad(es) restauradas al horario original`);toast('Planificación original restaurada')}
  await renderMyDay();await renderAgenda();await renderDailyLoad();await renderAudit();
}


function parseLocalDate(dateStr){
  const [y,m,d]=String(dateStr||'').split('-').map(Number);
  return y&&m&&d?new Date(y,m-1,d):new Date();
}
function formatShortDate(dateStr){
  const d=parseLocalDate(dateStr);
  return d.toLocaleDateString('es-EC',{day:'2-digit',month:'2-digit',year:'numeric'});
}
function formatMonthTitle(dateStr){
  const x=parseLocalDate(dateStr);
  const t=x.toLocaleDateString('es-EC',{month:'long',year:'numeric'});
  return t.charAt(0).toUpperCase()+t.slice(1);
}
function addDaysISO(dateStr,days){
  const d=parseLocalDate(dateStr);d.setDate(d.getDate()+days);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
async function renderUpcomingAgenda(analystId,selectedDate){
  const box=$('#myDayRecent');if(!box)return;
  if(!analystId){box.innerHTML='';box.classList.add('hidden');return}
  const all=(await visiblePlanningRows()).filter(p=>p.analystId===analystId&&p.status!=='CANCELADO');
  const base=selectedDate||dateToday(), monthDate=parseLocalDate(base), y=monthDate.getFullYear(),m=monthDate.getMonth();
  const first=new Date(y,m,1),last=new Date(y,m+1,0),startPad=(first.getDay()+6)%7;
  const byDate=new Map();all.forEach(p=>{if(!byDate.has(p.date))byDate.set(p.date,[]);byDate.get(p.date).push(p)});
  let cells='';
  for(let i=0;i<startPad;i++)cells+='<div class="future-cal-day muted"></div>';
  for(let day=1;day<=last.getDate();day++){
    const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`, items=byDate.get(ds)||[];
    const future=ds>=dateToday(), selected=ds===base, today=ds===dateToday();
    const dots=items.length?`<span class="future-cal-count">${items.length}</span>`:'';
    cells+=`<button type="button" class="future-cal-day ${items.length?'has-plan':''} ${selected?'selected':''} ${today?'today':''} ${!future?'past':''}" data-agenda-date="${ds}"><b>${day}</b>${dots}</button>`;
  }
  const futurePlans=all.filter(p=>p.date>dateToday()&&p.status==='PROGRAMADO').sort((a,b)=>a.date.localeCompare(b.date)||a.startTime.localeCompare(b.startTime)).slice(0,8);
  box.classList.remove('hidden');
  box.innerHTML=`<div class="future-agenda-head"><div><span class="eyebrow">AGENDA FUTURA</span><h3>Próximas actividades</h3><p>Las actividades del mes quedan visibles desde ahora. El analista puede consultarlas, pero solo iniciarlas el día programado.</p></div><div class="future-agenda-legend"><span><i></i> Día con actividad</span><span class="today-mark">HOY</span></div></div>
    <div class="future-agenda-grid">
      <div class="future-calendar"><div class="future-calendar-title"><b>${escapeHtml(formatMonthTitle(base))}</b><div><button type="button" class="icon-btn compact-cal" data-agenda-month="-1">‹</button><button type="button" class="icon-btn compact-cal" data-agenda-month="1">›</button></div></div><div class="future-weekdays">${['L','M','X','J','V','S','D'].map(x=>`<span>${x}</span>`).join('')}</div><div class="future-calendar-days">${cells}</div></div>
      <div class="future-next-list"><div class="future-next-title"><b>Siguientes asignaciones</b><span>${futurePlans.length?'Próximas programadas':'Sin actividades futuras'}</span></div>${futurePlans.length?futurePlans.map(p=>`<button type="button" class="future-plan-row" data-agenda-date="${p.date}"><div class="future-plan-date"><b>${parseLocalDate(p.date).getDate()}</b><span>${parseLocalDate(p.date).toLocaleDateString('es-EC',{month:'short'}).replace('.','')}</span></div><div><b>${escapeHtml(p.catalogName)}</b><span>${p.startTime}–${p.endTime} · ${escapeHtml(sectionMeta(p.section).label)}</span>${p.notes?`<small>⚑ ${escapeHtml(p.notes)}</small>`:''}</div><span class="future-state">PROGRAMADO</span></button>`).join(''):'<div class="empty-state compact"><b>Agenda despejada</b><span>Cuando el jefe planifique días posteriores aparecerán aquí automáticamente.</span></div>'}</div>
    </div>`;
  $$('[data-agenda-date]').forEach(el=>el.onclick=async()=>{$('#myDayDate').value=el.dataset.agendaDate;await renderMyDay();});
  $$('[data-agenda-month]').forEach(el=>el.onclick=async()=>{const d=parseLocalDate(base);d.setMonth(d.getMonth()+Number(el.dataset.agendaMonth));$('#myDayDate').value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;await renderMyDay();});
}


async function controlChartsAvailableForAssignment(date,analystId){
  if(!date||!analystId)return [];
  const [defs,plans,steps]=await Promise.all([getAll('controlChartDefs'),visiblePlanningRows(),getAll('compositeSteps')]);
  const assigned=plans.filter(p=>p.date===date&&p.analystId===analystId&&p.status!=='CANCELADO');
  return defs.filter(d=>{if(d.status!=='ACTIVO')return false;if(isMetalsChart(d))return assigned.some(p=>p.section==='AASS');if(d.linkMode==='TRANSVERSAL'){
    const sections=new Set(d.applicableSections||[]),methods=(d.applicableMethods||[]).map(x=>typeof x==='string'?{name:x}:{...x});
    return assigned.some(p=>{const areaMatch=sections.has(p.section);const pName=normalizeIdentityText(p.catalogName||'');const methodMatch=methods.some(m=>(!m.section||m.section===p.section)&&normalizeIdentityText(m.name||m.methodName||'')===pName)||steps.some(st=>st.catalogId===p.catalogId&&methods.some(m=>(!m.section||m.section===p.section)&&normalizeIdentityText(m.name||m.methodName||'')===normalizeIdentityText(st.name||'')));
      // 6.33.19.1: las áreas NO deben activar por sí solas una carta transversal con métodos específicos.
      // Balanza EI-227 sí es transversal global por área; una carta configurada solo por áreas también conserva esa lógica.
      const globalByArea=isBalanceChart(d)||methods.length===0;
      return methodMatch||(globalByArea&&areaMatch);});
  }return assigned.some(p=>{if(p.section!==d.section)return false;if(d.section==='RECEPCION_MUESTRAS')return true;const method=normalizeIdentityText(d.methodName||'');if(!method)return true;if(normalizeIdentityText(p.catalogName||'')===method)return true;return steps.some(st=>st.catalogId===p.catalogId&&normalizeIdentityText(st.name||'')===method);});}).sort((a,b)=>String(a.section).localeCompare(String(b.section))||String(a.name).localeCompare(String(b.name),'es'));
}
function isExecutableDailyControlChart(d){return !!d&&(isMicrobiologyFreezerChart(d)||isMicrobiologyIncubator364Chart(d)||isMicrobiologyIncubatorChart(d)||isMicrobiologyEnvironmentChart(d)||isMicrobiologyPHChart(d)||isBalanceEnvironmentChart(d)||isMetalsChart(d)||isOven314Chart(d)||isThermal105Chart(d)||isThermal150Chart(d)||isThermalDQOChart(d)||isDigestorChart(d)||isFridge344Chart(d)||isFridgeChart(d)||isBalanceChart(d)||isDistillerChart(d)||isIncubatorChart(d)||isDBO5Chart(d)||isPHChart(d)||isConductivityChart(d));}
function isSharedDailyEquipmentControl(d){return !!d&&isExecutableDailyControlChart(d);} // 6.33.20.3: todo control diario ejecutable es único por fecha+carta/equipo para todos los analistas vinculados.
async function dailyControlStatus(date,analystId){const defs=(await controlChartsAvailableForAssignment(date,analystId)).filter(isExecutableDailyControlChart),rows=await getAll('controlChartRecords'),completed=new Map();for(const d of defs){const shared=isSharedDailyEquipmentControl(d);const hit=rows.filter(r=>r.chartId===d.id&&String(r.measuredAt||'').slice(0,10)===date&&(shared||r.analystId===analystId)).sort((a,b)=>String(a.createdAt||a.measuredAt).localeCompare(String(b.createdAt||b.measuredAt)))[0];if(hit)completed.set(d.id,hit)}const pending=defs.filter(d=>!completed.has(d.id));return {defs,completed,pending,total:defs.length,done:defs.length-pending.length}}
function chartTechnicalResult(rec){return rec?.overallResult||rec?.environmentalResult||'COMPLETADA'}
function returnToMyDayAfterControl(rec){
  // 6.33.25.10.2: al guardar una carta, cerrar su formulario y volver al origen Mi Jornada.
  setTimeout(async()=>{
    try{
      document.querySelectorAll('dialog[open]').forEach(d=>{if(d.id!=='finishActivityDialog'&&d.id!=='controlChartDefDialog'){try{d.close()}catch(_){d.removeAttribute('open')}}});
      if($('#myDayDate')&&rec?.measuredAt)$('#myDayDate').value=String(rec.measuredAt).slice(0,10);
      if($('#myDayAnalyst')&&rec?.analystId)$('#myDayAnalyst').value=rec.analystId;
      switchView('mi-jornada');
      await renderMyDay();
    }catch(e){console.warn('Retorno a Mi Jornada pendiente',e)}
  },120);
}
async function createControlChartCompletionAlert(rec,chartDef){
  if(rec)returnToMyDayAfterControl(rec);
  if(!rec||!chartDef)return;
  const date=String(rec.measuredAt||'').slice(0,10),safeAnalyst=String(rec.analystId||'A').replace(/[^a-zA-Z0-9_-]/g,'_');
  // 6.33.25.9: NO crear notificaciones por cada carta. La trazabilidad permanece en
  // controlChartRecords. La campana recibe una sola comunicación al completar el conjunto diario.
  const st=await dailyControlStatus(date,rec.analystId);
  if(!(st.total&&st.done===st.total)){if(typeof refreshNotificationBadge==='function')await refreshNotificationBadge();return;}
  const sid=`AUTO-CC-RESUMEN-${date}-${safeAnalyst}`;
  if(await getOne('planComments',sid))return;
  const defsById=new Map(st.defs.map(d=>[d.id,d]));
  const details=[];let badCount=0;
  for(const [chartId,row] of st.completed.entries()){
    const def=defsById.get(chartId),result=chartTechnicalResult(row),bad=result==='NO CUMPLE'||row.statisticalState==='FUERA DE CONTROL';
    if(bad)badCount++;
    details.push(`${bad?'⚠️':'✓'} ${def?.name||chartId}: ${result}${row.statisticalState?` · ${row.statisticalState}`:''}`);
  }
  const okCount=Math.max(0,st.done-badCount),priority=badCount?'ALTA':'INFO';
  const text=`${badCount?'⚠️':'✅'} CONTROLES DIARIOS COMPLETADOS · ${rec.analystName||'Analista'} · ${date} · ${st.done}/${st.total} cartas · ${okCount} CUMPLE${badCount?` · ${badCount} REQUIERE REVISIÓN`:' · SIN DESVIACIONES'}${details.length?' | '+details.join(' | '):''}`;
  const summary={id:sid,planId:`CCDAY-${date}-${safeAnalyst}`,analystId:rec.analystId,analystName:rec.analystName,authorType:'SISTEMA',authorName:'Control diario de cartas',text,createdAt:nowISO(),threadStatus:'OPEN',readBy:[],notificationType:'CARTA_CONTROL',priority,actionRequired:badCount?'REVISAR_CARTA':'CONOCIMIENTO',autoGenerated:true,recipientRole:'JEFE',createdByRole:currentSessionUser?.role||'USUARIO',createdByName:currentSessionUser?.name||rec.analystName||'Usuario',controlSummary:{date,total:st.total,done:st.done,ok:okCount,bad:badCount,details}};
  await put('planComments',summary);await queue('CREATE','planComments',summary);
  if(typeof refreshNotificationBadge==='function')await refreshNotificationBadge();
}
async function assertDailyControlsBeforeDayClose(plan){
  if(!plan)return {ok:true};
  const st=await dailyControlStatus(plan.date,plan.analystId);
  if(!st.pending.length)return {ok:true,status:st};
  const norm=normalizeIdentityText, planName=norm(plan.catalogName||''), planId=String(plan.catalogId||'');
  const directlyLinked=st.pending.filter(d=>{
    if(d.linkMode==='TRANSVERSAL')return (d.applicableMethods||[]).some(m=>String(m?.id||'')===planId||norm(m?.name||m?.methodName||m||'')===planName);
    return norm(d.methodName||'')===planName || (d.section===plan.section && (!d.methodName||planName.includes(norm(d.methodName))||norm(d.methodName).includes(planName)));
  });
  const dayPlans=(await visiblePlanningRows()).filter(x=>x.date===plan.date&&x.analystId===plan.analystId&&x.status!=='CANCELADO');
  const remaining=dayPlans.filter(x=>x.id!==plan.id&&x.status!=='REALIZADO');
  const mustBlock=directlyLinked.length?directlyLinked:(!remaining.length?st.pending:[]);
  if(!mustBlock.length)return {ok:true,status:st};
  const reason=directlyLinked.length?'Esta actividad tiene cartas de control vinculadas pendientes':'Está intentando finalizar la última actividad de la jornada y aún existen cartas obligatorias pendientes';
  return {ok:false,status:st,message:`NO SE PUEDE FINALIZAR. ${reason}.\n\nFaltan ${mustBlock.length} carta(s):\n• ${mustBlock.map(x=>x.name).join('\n• ')}\n\nComplete las cartas indicadas y vuelva a finalizar. Avance actual: ${st.done}/${st.total}.`};
}
async function renderMyDayControlCharts(date,analystId){
  document.documentElement.dataset.sessionRole=currentSessionUser?.role||'';
  const box=$('#myDayControlCharts');if(!box)return;
  if(!analystId){box.classList.add('hidden');box.innerHTML='';return;}
  const defs=await controlChartsAvailableForAssignment(date,analystId);
  if(!defs.length){box.classList.add('hidden');box.innerHTML='';return;}
  box.classList.remove('hidden');
  const ds=await dailyControlStatus(date,analystId);
  box.innerHTML=`<div class="myday-chart-head"><div><span class="eyebrow">CONTROLES DIARIOS OBLIGATORIOS</span><h3>Cartas vinculadas a la jornada · ${ds.done}/${ds.total} completadas</h3><p>${ds.pending.length?'Debe completar las cartas ejecutables antes de cerrar la última actividad de la jornada.':'✓ Controles diarios ejecutables completos. La jornada puede cerrarse.'}</p><div class="daily-cc-progress"><i style="width:${ds.total?Math.round(ds.done/ds.total*100):100}%"></i></div></div><span class="myday-chart-count ${ds.pending.length?'pending':''}">${ds.done}/${ds.total}</span></div><div class="myday-chart-grid">${defs.map(d=>{const executable=isExecutableDailyControlChart(d),rec=ds.completed.get(d.id),state=rec?'COMPLETADA':executable?'PENDIENTE':'HABILITADA';return `<article class="myday-chart-card ${rec?'cc-completed':executable?'cc-pending':''}" data-control-chart-id="${d.id}"><div><small>${escapeHtml(sectionMeta(d.section).label)}</small><b>${escapeHtml(d.name)}</b><span>${escapeHtml(d.methodName||'Método general')}</span></div><div class="myday-chart-ready ${state.toLowerCase()}">${rec?`✓ COMPLETADA${isSharedDailyEquipmentControl(d)&&rec.analystName?' · '+escapeHtml(rec.analystName):''}`:executable?'ABRIR · PENDIENTE':'HABILITADA'}</div></article>`}).join('')}</div>`;
  $$('[data-control-chart-id]',box).forEach(el=>el.onclick=async()=>{const d=defs.find(x=>x.id===el.dataset.controlChartId),completedRec=ds.completed.get(d.id);if(completedRec&&isSharedDailyEquipmentControl(d)){toast(`✓ Control diario ya completado por ${completedRec.analystName||'otro analista'} · ${String(completedRec.measuredAt||'').replace('T',' ').slice(0,16)}. Se muestra solo para consulta.`);}if(isMicrobiologyFreezerChart(d))await openMicroFreezerControl(d,date,analystId,ds.completed.get(d.id));else if(isMicrobiologyIncubator364Chart(d))await openIncMicroControl(d,date,analystId,ds.completed.get(d.id));else if(isMicrobiologyIncubatorChart(d))await openMicroIncubatorControl(d,date,analystId,ds.completed.get(d.id));else if(isMicrobiologyEnvironmentChart(d))await openMicroEnvControl(d,date,analystId,ds.completed.get(d.id));else if(isMicrobiologyPHChart(d))await openPHControl(d,date,analystId);else if(isBalanceEnvironmentChart(d))await openBalanceEnvControl(d,date,analystId,ds.completed.get(d.id));else if(isMetalsChart(d))await openMetalsControl(d,date,analystId,ds.completed.get(d.id));else if(isOven314Chart(d))await openOven314Control(d,date,analystId,ds.completed.get(d.id));else if(isThermal105Chart(d)||isThermal150Chart(d)||isThermalDQOChart(d))await openThermalPointControl(d,date,analystId);else if(isDigestorChart(d))await openDigestorControl(d,date,analystId);else if(isFridge344Chart(d))await openFridge344Control(d,date,analystId);else if(isFridgeChart(d))await openFridgeControl(d,date,analystId);else if(isBalanceChart(d))await openBalanceControl(d,date,analystId,ds.completed.get(d.id));else if(isDistillerChart(d))await openDistillerControl(d,date,analystId);else if(isIncubatorChart(d))await openIncubatorControl(d,date,analystId);else if(isDBO5Chart(d))await openDBO5Control(d,date,analystId);else if(isPHChart(d))await openPHControl(d,date,analystId);else if(isConductivityChart(d))await openConductivityControl(d,date,analystId);else toast('El formato técnico de esta carta se implementará en la siguiente fase');});
}

async function renderMyDay(){
  if(!$('#myDayCards'))return;
  // Preserva el estado visual de Mi Jornada durante sincronizaciones/re-renderizados.
  // En Chrome un snapshot de Firebase podía reconstruir el DOM mientras el analista
  // hacía scroll, abría el desglose o escribía un comentario, cerrando <details>,
  // perdiendo el foco y provocando un salto de pantalla.
  const _myDayUi={scrollX:window.scrollX,scrollY:window.scrollY,open:new Set(),focusKey:'',focusValue:'',selectionStart:null,selectionEnd:null};
  $$('#myDayCards details[data-ui-key]').forEach(d=>{if(d.open)_myDayUi.open.add(d.dataset.uiKey)});
  const _activeEl=document.activeElement;
  if(_activeEl?.matches?.('[data-comment-input]')){
    _myDayUi.focusKey=_activeEl.dataset.commentInput||'';
    _myDayUi.focusValue=_activeEl.value||'';
    _myDayUi.selectionStart=_activeEl.selectionStart;_myDayUi.selectionEnd=_activeEl.selectionEnd;
  }
  const date=$('#myDayDate').value,analystId=$('#myDayAnalyst').value;
  await renderMyDayControlCharts(date,analystId);
  const plans=(await visiblePlanningRows()).filter(p=>p.date===date&&p.analystId===analystId&&p.status!=='CANCELADO').sort((a,b)=>a.startTime.localeCompare(b.startTime));
  $('#myDayEmpty').classList.toggle('hidden',plans.length>0);
  const a=(await getAll('analysts')).find(x=>x.id===analystId);
  const total=plans.reduce((t,p)=>t+Number(p.durationMinutes||0),0);
  const done=plans.filter(p=>p.status==='REALIZADO').length,inProgress=plans.filter(p=>p.status==='EN PROCESO').length;
  const pct=plans.length?Math.round(done/plans.length*100):0;
  const today=date===dateToday(),futureDay=date>dateToday(),now=new Date(),nowMin=now.getHours()*60+now.getMinutes();
  const active=plans.find(p=>p.status==='EN PROCESO')||(today?plans.find(p=>p.status==='PROGRAMADO'&&timeToMinutes(p.startTime)<=nowMin&&timeToMinutes(p.endTime)>nowMin):null);
  const next=plans.find(p=>p.status==='PROGRAMADO'&&(!today||timeToMinutes(p.startTime)>nowMin));
  let focusText='Sin actividad pendiente';
  if(active)focusText=`Ahora: ${active.catalogName}`;
  else if(next)focusText=`Siguiente ${next.startTime}: ${next.catalogName}`;
  $('#myDaySummary').innerHTML=analystId?`
    <div class="myday-overview">
      <div class="myday-kpis">
        <div class="myday-kpi"><b>${plans.length}</b><span>actividades</span></div>
        <div class="myday-kpi"><b>${minutesText(total)}</b><span>carga / ${a?.dailyHours||8} h</span></div>
        <div class="myday-kpi"><b>${done}/${plans.length}</b><span>finalizadas</span></div>
        <div class="myday-kpi"><b>${inProgress}</b><span>en proceso</span></div>
      </div>
      <div class="day-progress-panel">
        <div><b>${pct}% completado</b><span>${escapeHtml(focusText)}</span></div>
        <div class="day-progress-track"><i style="width:${pct}%"></i></div>
      </div>
    </div>`:'';
  const steps=await getAll('compositeSteps'),allComments=await getAll('planComments'),catalogForRequirements=await getAll('catalog');
  $('#myDayCards').innerHTML=plans.map((p,index)=>{
    let _catReq=catalogForRequirements.find(x=>x.id===p.catalogId);if(!_catReq)_catReq=catalogForRequirements.find(x=>x.section===p.section&&normalizeIdentityText(x.name)===normalizeIdentityText(p.catalogName));
    const _req={curve:planRequiresCalibration(p)||!!(_catReq?.calibrationConfig?.enabled&&_catReq.calibrationConfig?.points?.length),reagents:planHasReagents(p)||!!_catReq?.reagentConfig?.length};
    const ss=steps.filter(x=>x.catalogId===p.catalogId).sort((a,b)=>a.order-b.order);
    const comments=allComments.filter(c=>c.planId===p.id).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));    const st=timeToMinutes(p.startTime),en=timeToMinutes(p.endTime);
    const isNow=p.id===active?.id,isNext=!isNow&&p.id===next?.id;
    const late=today&&p.status==='PROGRAMADO'&&nowMin>st&&!isNow;
    let smartLabel=isNow?'AHORA':isNext?'SIGUIENTE':late?'ATRASADA':'';
    let smartDetail='';
    if(late)smartDetail=`${Math.max(1,nowMin-st)} min desde la hora planificada`;
    else if(isNext&&today)smartDetail=`Comienza en ${Math.max(0,st-nowMin)} min`;
    const flex=p.status==='PROGRAMADO'?`<div class="flex-order-actions"><button class="icon-order" title="Subir prioridad" data-move-up="${p.id}">↑</button><button class="icon-order" title="Bajar prioridad" data-move-down="${p.id}">↓</button><button class="btn secondary compact" data-prioritize="${p.id}">⇥ Hacer primero</button></div>`:'';
    const action=p.status==='PROGRAMADO'
      ?(futureDay?`${flex}<button class="btn secondary myday-action future-locked" disabled>🗓 Disponible el ${formatShortDate(p.date)}</button>`:`${flex}<button class="btn primary myday-action" data-start-activity="${p.id}">▶ Iniciar actividad</button>`)
      :p.status==='EN PROCESO'
        ?`<button class="btn primary myday-action" data-finish-activity="${p.id}">✓ Finalizar actividad</button>`
        :`<span class="done-pill">✓ Finalizada${p.actualFinishedAt?` · ${formatActualStamp(p.actualFinishedAt)}`:''}</span>`;
    let actual='';
    if(p.actualStartedAt){
      const realMins=p.actualFinishedAt?realWorkMinutesBetween(p.actualStartedAt,p.actualFinishedAt):0;
      const diff=p.actualFinishedAt?realMins-Number(p.durationMinutes||0):0;
      const variance=p.actualFinishedAt?(diff===0?'En tiempo':diff>0?`+${diff} min sobre lo planificado`:`${Math.abs(diff)} min antes de lo planificado`):'En ejecución';
      actual=`<div class="actual-time smart-actual"><b>Tiempo real</b><span>Inicio ${formatActualStamp(p.actualStartedAt)}${p.actualFinishedAt?` · Fin ${formatActualStamp(p.actualFinishedAt)}`:''}</span><em>${variance}</em></div>`;
    }
    return `<article class="myday-card ${p.status==='REALIZADO'?'is-done':''} ${isNow?'is-now':''} ${isNext?'is-next':''} ${late?'is-late':''}">
      <div class="timeline-rail"><span>${index+1}</span></div>
      <div class="myday-card-content">
        <div class="myday-top">
          <div>
            ${smartLabel?`<div class="smart-day-label ${late?'late':''}">${smartLabel}${smartDetail?` · ${smartDetail}`:''}</div>`:''}
            <div class="myday-time">${p.startTime}–${p.endTime}</div>
            <div class="myday-title">${escapeHtml(p.catalogName)}</div>
            <div class="myday-meta">${escapeHtml(sectionMeta(p.section).label)} · ${minutesText(p.durationMinutes)}${p.samples?` · ${p.samples} muestras planificadas`:''}${p.actualSamples!==null&&p.actualSamples!==undefined?` · ${p.actualSamples} muestras analizadas`:''}</div>
          </div>
          <span class="status-pill status-${p.status.replaceAll(' ','-')}">${p.status}</span>
        </div>
        
        ${p.notes?`<div class="boss-note"><b>⚑ Instrucción del jefe</b><span>${escapeHtml(p.notes)}</span></div>`:''}
        ${ss.length?`<details class="myday-breakdown compact-breakdown" data-ui-key="breakdown-${p.id}"><summary>Ver desglose · ${ss.length} subactividades</summary><div>${ss.map(x=>`<span>• ${escapeHtml(x.name)} · ${minutesText(x.minutes)}</span>`).join('')}</div></details>`:''}
        ${technicalRequirementMenuHtml(p,_req)}
        <div class="myday-actions-row">${action}</div>${actual}
        <details class="comment-thread compact-comments" data-ui-key="comments-${p.id}" ${comments.length?'open':''}>
          <summary>💬 Comentarios / novedades (${comments.length})</summary>
          <div class="comment-body">
            ${comments.length?comments.map(c=>`<div class="comment-item"><b>${escapeHtml(c.authorName)}</b><small>${fmtDate(c.createdAt)}</small><div>${escapeHtml(c.text)}</div></div>`).join(''):'<div class="myday-meta">Sin comentarios todavía.</div>'}
            <div class="comment-compose"><input data-comment-input="${p.id}" placeholder="Agregar observación, novedad o comentario..."/><button class="btn secondary" data-comment-save="${p.id}">Comentar</button></div>
          </div>
        </details>
      </div>
    </article>`;
  }).join('');
  // Restaura exactamente lo que el usuario tenía abierto antes del refresco.
  // Los comentarios con historial siguen abiertos por defecto solo en la primera carga.
  if(_myDayUi.open.size){
    $$('#myDayCards details[data-ui-key]').forEach(d=>{d.open=_myDayUi.open.has(d.dataset.uiKey)});
  }
  if(_myDayUi.focusKey){
    const _input=document.querySelector(`[data-comment-input="${CSS.escape(_myDayUi.focusKey)}"]`);
    if(_input){_input.value=_myDayUi.focusValue;_input.focus({preventScroll:true});try{_input.setSelectionRange(_myDayUi.selectionStart,_myDayUi.selectionEnd)}catch(_){}}
  }
  window.scrollTo({left:_myDayUi.scrollX,top:_myDayUi.scrollY,behavior:'instant'});
  $$('[data-start-activity]').forEach(el=>el.onclick=()=>startMyActivity(el.dataset.startActivity));
  $$('[data-finish-activity]').forEach(el=>el.onclick=()=>finishMyActivity(el.dataset.finishActivity));$$('[data-open-technical]').forEach(b=>b.onclick=()=>openTechnicalData(b.dataset.openTechnical));$$('[data-edit-technical]').forEach(b=>b.onclick=()=>editCompletedTechnicalData(b.dataset.editTechnical));
  $$('[data-move-up]').forEach(el=>el.onclick=()=>moveMyActivity(el.dataset.moveUp,-1));
  $$('[data-move-down]').forEach(el=>el.onclick=()=>moveMyActivity(el.dataset.moveDown,1));
  $$('[data-prioritize]').forEach(el=>el.onclick=()=>prioritizeMyActivity(el.dataset.prioritize));  $$('[data-comment-save]').forEach(el=>el.onclick=()=>addAnalystComment(el.dataset.commentSave));
  await renderUpcomingAgenda(analystId,date);
}

let bossAIRecommendations=[];

function plannerConflictCount(plans){
  let count=0;
  const by={};
  plans.filter(p=>p.status!=='CANCELADO').forEach(p=>(by[p.analystId]??=[]).push(p));
  Object.values(by).forEach(list=>{
    for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
      if(workOverlap(timeToMinutes(list[i].startTime),Number(list[i].durationMinutes||0),timeToMinutes(list[j].startTime),Number(list[j].durationMinutes||0)))count++;
    }
  });
  return count;
}
async function analyzeBossDay(){
  const date=$('#planDate').value;
  if(!date)return toast('Seleccione una fecha');
  const [plans,analysts,catalog]=await Promise.all([planningForDate(date),getAll('analysts'),getAll('catalog')]);
  const active=analysts.filter(a=>a.status==='ACTIVO'&&isOperationalAnalyst(a));
  const loads=active.map(a=>{
    const own=plans.filter(p=>p.analystId===a.id&&p.status!=='CANCELADO');
    const minutes=own.reduce((t,p)=>t+Number(p.durationMinutes||0),0),cap=Number(a.dailyHours||8)*60;
    return {a,own,minutes,cap,pct:cap?Math.round(minutes/cap*100):0,free:Math.max(0,cap-minutes),over:Math.max(0,minutes-cap)};
  });
  const conflicts=plannerConflictCount(plans);
  const total=loads.reduce((t,x)=>t+x.minutes,0),capacity=loads.reduce((t,x)=>t+x.cap,0);
  const avg=loads.length?total/loads.length:0;
  const imbalance=loads.length?Math.round(loads.reduce((t,x)=>t+Math.abs(x.minutes-avg),0)/loads.length):0;
  bossAIRecommendations=[];
  const findings=[];

  loads.filter(x=>x.over>0).forEach(x=>findings.push({level:'danger',title:`Sobrecarga: ${x.a.name}`,text:`Tiene ${minutesText(x.minutes)} planificadas para una jornada de ${minutesText(x.cap)}.`}));
  loads.filter(x=>x.minutes===0).forEach(x=>findings.push({level:'info',title:`Capacidad disponible: ${x.a.name}`,text:`No tiene actividades asignadas en esta fecha.`}));
  if(conflicts)findings.push({level:'danger',title:`${conflicts} cruce(s) horario(s)`,text:'Existen actividades simultáneas asignadas a la misma persona.'});
  if(imbalance>=120)findings.push({level:'warning',title:'Distribución desigual de carga',text:`La diferencia media respecto a la carga del equipo es ${minutesText(imbalance)}.`});

  // Reassignment proposals: only PROGRAMADO. Prefer competent analyst with a valid slot,
  // less load, and historical experience when available.
  for(const p of plans.filter(x=>x.status==='PROGRAMADO')){
    const item=catalog.find(x=>x.id===p.catalogId); if(!item)continue;
    const current=loads.find(x=>x.a.id===p.analystId); if(!current)continue;
    const hp=await historicalProfile(item,p.samples||0);
    const candidates=[];
    for(const l of loads){
      if(l.a.id===p.analystId)continue;
      if(!(l.a.competencies||[]).includes(p.section))continue;
      const plansWithout=plans.filter(x=>x.id!==p.id);
      const slot=findBestWorkSlot(plansWithout,l.a.id,Number(p.durationMinutes||0));
      if(!slot)continue;
      const hist=hp?.analystStats?.find(x=>x.id===l.a.id);
      const exp=hist?.count||0;
      const currentHist=hp?.analystStats?.find(x=>x.id===p.analystId)?.count||0;
      const newLoad=l.minutes+Number(p.durationMinutes||0);
      if(newLoad>l.cap)continue;
      const benefit=(current.minutes-current.cap>0?50:0)+(current.pct-l.pct)*0.6+(exp-currentHist)*8;
      candidates.push({l,slot,exp,currentHist,benefit});
    }
    candidates.sort((a,b)=>b.benefit-a.benefit);
    const best=candidates[0];
    if(best && best.benefit>=18){
      const rec={
        id:uid('REC'),type:'REASSIGN',planId:p.id,
        title:`Mover “${p.catalogName}” a ${best.l.a.name}`,
        text:`${p.analystName}: ${current.pct}% de carga → ${best.l.a.name}: ${best.l.pct}% actual. Horario propuesto ${minutesToTime(best.slot.start)}–${minutesToTime(best.slot.end)}${best.exp?` · ${best.exp} ejecución(es) históricas`:''}.`,
        analystId:best.l.a.id,analystName:best.l.a.name,start:minutesToTime(best.slot.start),end:minutesToTime(best.slot.end),
        score:Math.round(best.benefit)
      };
      bossAIRecommendations.push(rec);
    }
  }

  // Free-capacity suggestions
  const under=loads.filter(x=>x.pct>0&&x.pct<50).sort((a,b)=>a.pct-b.pct);
  if(under.length) findings.push({level:'info',title:'Capacidad parcial disponible',text:under.map(x=>`${x.a.name}: ${minutesText(x.free)} libres`).join(' · ')});

  // Score 0-100
  let score=100;
  score-=Math.min(35,conflicts*15);
  score-=Math.min(25,loads.reduce((t,x)=>t+(x.over>0?12:0),0));
  score-=Math.min(20,Math.round(imbalance/30));
  score-=Math.min(10,loads.filter(x=>x.minutes===0).length*2);
  score=Math.max(0,Math.round(score));

  const utilization=capacity?Math.round(total/capacity*100):0;
  $('#bossAIEmpty').classList.add('hidden');
  $('#bossAIResults').classList.remove('hidden');
  $('#bossAIResults').innerHTML=`
    <div class="boss-ai-score-row">
      <div class="boss-score ${score>=80?'good':score>=60?'medium':'low'}"><strong>${score}</strong><span>/100<br>organización</span></div>
      <div class="boss-ai-metrics">
        <div><small>Utilización del equipo</small><b>${utilization}%</b></div>
        <div><small>Carga total</small><b>${minutesText(total)}</b></div>
        <div><small>Cruces</small><b>${conflicts}</b></div>
        <div><small>Propuestas</small><b>${bossAIRecommendations.length}</b></div>
      </div>
    </div>
    ${findings.length?`<div class="boss-findings"><h4>Diagnóstico de la jornada</h4>${findings.map(f=>`<div class="boss-finding ${f.level}"><b>${escapeHtml(f.title)}</b><span>${escapeHtml(f.text)}</span></div>`).join('')}</div>`:`<div class="boss-finding good"><b>Jornada equilibrada</b><span>No se detectaron alertas importantes con las reglas actuales.</span></div>`}
    <div class="boss-recommendations">
      <h4>Propuestas de mejora</h4>
      ${bossAIRecommendations.length?bossAIRecommendations.slice(0,8).map((r,i)=>`<article class="boss-rec"><div><span class="rec-rank">#${i+1}</span><b>${escapeHtml(r.title)}</b><p>${escapeHtml(r.text)}</p></div><button class="btn secondary compact" data-apply-boss-rec="${r.id}">Aplicar propuesta</button></article>`).join(''):`<p class="muted">No hay movimientos con una mejora suficientemente clara. Puede mantener la distribución actual.</p>`}
    </div>`;
  $$('[data-apply-boss-rec]').forEach(b=>b.onclick=()=>applyBossRecommendation(b.dataset.applyBossRec));$$('[data-edit-technical]').forEach(b=>b.onclick=()=>editCompletedTechnicalData(b.dataset.editTechnical));
  await renderExecutivePlanner();
  await audit('ANALIZAR_JORNADA_IA','PLANIFICADOR',date,`Puntaje ${score}/100 · ${bossAIRecommendations.length} propuesta(s) · ${conflicts} cruce(s)`);
}
async function applyBossRecommendation(recId){
  const r=bossAIRecommendations.find(x=>x.id===recId);if(!r)return;
  const p=await getOne('planning',r.planId);if(!p||p.status!=='PROGRAMADO')return toast('La actividad ya no está disponible para reorganizar');
  if(!confirm(`¿Aplicar esta propuesta?\n\n${r.title}\n${r.start}–${r.end}\n\nQuedará registrada en trazabilidad.`))return;
  if(!p.originalAnalystId){p.originalAnalystId=p.analystId;p.originalAnalystName=p.analystName;p.originalStartTime=p.originalStartTime||p.startTime;p.originalEndTime=p.originalEndTime||p.endTime}
  p.analystId=r.analystId;p.analystName=r.analystName;p.startTime=r.start;p.endTime=r.end;p.updatedAt=nowISO();p.aiOptimized=true;
  await put('planning',p);await queue('UPDATE','planning',p);
  await audit('APLICAR_RECOMENDACION_IA','PLANIFICADOR',p.code,`${p.catalogName}: ${p.originalAnalystName||'—'} → ${r.analystName} · ${r.start}-${r.end}`);
  toast('Propuesta aplicada');
  await refreshPlanner();await analyzeBossDay();await renderMyDay();
}

async function renderAgenda(){if(!$('#agendaBody'))return;const date=$('#planDate').value,st=$('#agendaStatus').value;let data=(await visiblePlanningRows()).filter(p=>p.date===date&&(!st||p.status===st));data.sort((a,b)=>a.startTime.localeCompare(b.startTime)||a.analystName.localeCompare(b.analystName,'es'));$('#agendaEmpty').classList.toggle('hidden',data.length>0);$('#agendaTableWrap').classList.toggle('hidden',data.length===0);const steps=await getAll('compositeSteps'),comments=await getAll('planComments');$('#agendaBody').innerHTML=data.map(p=>{const ss=steps.filter(s=>s.catalogId===p.catalogId).sort((a,b)=>a.order-b.order),cc=comments.filter(c=>c.planId===p.id).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));const detail=ss.length?`<div class="agenda-detail">${ss.map(s=>`${escapeHtml(s.name)} (${minutesText(s.minutes)})`).join(' · ')}</div>`:'';const note=p.notes?`<div class="agenda-note"><b>Jefe:</b> ${escapeHtml(p.notes)}</div>`:'';const comm=cc.length?`<div class="agenda-comments"><b>Analista (${cc.length}):</b> ${cc.map(c=>escapeHtml(c.text)).join(' · ')}</div>`:'';return `<tr><td><b>${p.startTime}-${p.endTime}</b></td><td>${escapeHtml(p.analystName)}</td><td>${escapeHtml(sectionMeta(p.section).label)}</td><td><b>${escapeHtml(p.catalogName)}</b>${p.samples?`<div class="agenda-detail">${p.samples} muestras</div>`:''}${detail}${note}${comm}</td><td>${minutesText(p.durationMinutes)}</td><td><select class="status-select" data-plan-status="${p.id}"><option ${p.status==='PROGRAMADO'?'selected':''}>PROGRAMADO</option><option ${p.status==='EN PROCESO'?'selected':''}>EN PROCESO</option><option ${p.status==='REALIZADO'?'selected':''}>REALIZADO</option><option ${p.status==='CANCELADO'?'selected':''}>CANCELADO</option></select></td><td class="row-actions"><button data-plan-reassign="${p.id}" ${p.status!=='PROGRAMADO'?'disabled title="Solo disponible mientras está PROGRAMADO"':''}>Cambiar asignación</button><button data-plan-delete="${p.id}">Eliminar</button></td></tr>`}).join('');$$('[data-plan-status]').forEach(el=>el.onchange=()=>changePlanStatus(el.dataset.planStatus,el.value));$$('[data-plan-reassign]').forEach(el=>el.onclick=()=>openReassignPlan(el.dataset.planReassign));$$('[data-plan-delete]').forEach(el=>el.onclick=()=>deletePlan(el.dataset.planDelete))}
async function changePlanStatus(id,status){const p=await getOne('planning',id);if(!p)return;p.status=status;p.updatedAt=nowISO();await put('planning',p);await queue('UPDATE','planning',p);await audit('CAMBIAR_ESTADO','PLANIFICADOR',p.code,`${p.catalogName}: ${status}`);toast('Estado actualizado');if(typeof refreshPlanner==='function')await refreshPlanner();await renderAudit()}
async function openReassignPlan(id){
  if(currentSessionUser?.role!=='JEFE')return toast('Solo JEFE puede cambiar asignaciones');
  const p=await getOne('planning',id);if(!p)return toast('No se encontró la planificación');
  if(p.status!=='PROGRAMADO')return toast('Solo se puede reasignar una actividad PROGRAMADA');
  const analysts=(await getAll('analysts')).filter(a=>a.status==='ACTIVO'&&isOperationalAnalyst(a)&&(a.competencies||[]).includes(p.section)).sort((a,b)=>a.name.localeCompare(b.name,'es'));
  $('#reassignPlanId').value=p.id;
  $('#reassignPlanSummary').innerHTML=`<b>${escapeHtml(p.catalogName)}</b><br>${escapeHtml(p.date)} · ${escapeHtml(p.analystName)} · ${p.startTime}–${p.endTime} · ${minutesText(p.durationMinutes)}`;
  $('#reassignAnalyst').innerHTML=analysts.map(a=>`<option value="${a.id}" ${a.id===p.analystId?'selected':''}>${escapeHtml(a.name)}</option>`).join('');
  $('#reassignStart').value=p.startTime||'08:00';
  $('#reassignPlanDialog').showModal();
}
async function saveReassignPlan(ev){
  ev.preventDefault();
  const p=await getOne('planning',$('#reassignPlanId').value);if(!p)return toast('No se encontró la planificación');
  if(p.status!=='PROGRAMADO')return toast('La actividad ya no está disponible para reasignar');
  const a=await getOne('analysts',$('#reassignAnalyst').value);if(!a)return toast('Seleccione un analista');
  let start=$('#reassignStart').value||'08:00',startMin=timeToMinutes(start),dur=Number(p.durationMinutes||0);
  const dayPlans=(await planningForDate(p.date)).filter(x=>x.id!==p.id&&x.status!=='CANCELADO');
  const conflict=dayPlans.find(x=>x.analystId===a.id&&workOverlap(startMin,dur,timeToMinutes(x.startTime),Number(x.durationMinutes||0)));
  if(conflict){
    const slot=findBestWorkSlot(dayPlans,a.id,dur);
    if(slot){
      if(!confirm(`El horario elegido se cruza con "${conflict.catalogName}".\n\n¿Mover automáticamente esta actividad al primer espacio disponible (${minutesToTime(slot.start)}–${minutesToTime(slot.end)})?`))return;
      startMin=slot.start;start=minutesToTime(slot.start);
    }else if(!confirm(`El nuevo analista no tiene un bloque libre completo para esta actividad. ¿Guardar de todas formas para luego reorganizar la otra asignación?`))return;
  }
  const oldAnalyst=p.analystName,oldStart=p.startTime,oldEnd=p.endTime;
  if(!p.originalAnalystId){p.originalAnalystId=p.analystId;p.originalAnalystName=p.analystName;p.originalStartTime=p.startTime;p.originalEndTime=p.endTime}
  p.analystId=a.id;p.analystCode=a.code;p.analystName=a.name;p.startTime=start;p.endTime=minutesToTime(addWorkingMinutes(startMin,dur));p.updatedAt=nowISO();p.reassignedAt=nowISO();
  await put('planning',p);await queue('UPDATE','planning',p);
  await audit('CAMBIAR_ASIGNACION','PLANIFICADOR',p.code,`${p.catalogName}: ${oldAnalyst} ${oldStart}-${oldEnd} → ${a.name} ${p.startTime}-${p.endTime}`);
  $('#reassignPlanDialog').close();toast('Asignación cambiada sin perder trazabilidad');await refreshPlanner();await renderAudit();
  if(firebaseBridge.ready&&firebaseBridge.authUser)await flushOutbox(false);
}

async function deletePlan(id){
  const p=await getOne('planning',id);if(!p)return toast('La actividad ya no existe');
  if(currentSessionUser?.role!=='JEFE')return toast('Solo JEFE puede eliminar planificación');
  if(!confirm(`¿Eliminar definitivamente "${p.catalogName}" de ${p.analystName}?`))return;

  try{
    // 1) Registrar bloqueo local antes de borrar. Si Firestore entrega un snapshot atrasado,
    // la actividad no puede reaparecer en pantalla.
    await markPlanningDeleted(id);

    // 2) Borrado local primero para respuesta visual inmediata.
    await del('planning',id);

    // 3) Eliminar comentarios relacionados localmente y preparar su borrado remoto.
    const comments=(await getAll('planComments')).filter(x=>x.planId===id);
    for(const cm of comments){
      await del('planComments',cm.id);
      await queue('DELETE','planComments',{id:cm.id});
    }

    // 4) Preparar DELETE remoto de la planificación.
    await queue('DELETE','planning',{id});

    // 5) Refrescar TODAS las vistas antes de esperar a Firebase.
    await refreshPlanner();
    if(typeof renderMyDay==='function')await renderMyDay();
    if(typeof renderDailyMonitor==='function'&&currentSessionUser?.role==='JEFE')await renderDailyMonitor();
    if(typeof renderManagementDashboard==='function'&&document.querySelector('.nav-item.active')?.dataset.view==='gestion')await renderManagementDashboard();

    // 6) Confirmar Firestore. Si falla, permanece oculto localmente y Outbox reintenta.
    let synced=false;
    try{synced=await flushOutbox(false)}catch(e){console.warn('delete flush',e)}

    await audit('ELIMINAR_PLANIFICACION_DEFINITIVA','PLANIFICADOR',p.code||id,`${p.analystName} · ${p.catalogName} · ${p.date}`);
    toast(synced?'Actividad eliminada y sincronizada':'Actividad eliminada · sincronización pendiente');
  }catch(err){
    console.error('Eliminar planificación',err);
    toast(`No se pudo eliminar: ${err?.message||err}`);
  }
}
function mgmtRealMinutes(p){
  return p.actualStartedAt&&p.actualFinishedAt?realWorkMinutesBetween(p.actualStartedAt,p.actualFinishedAt):0;
}
function mgmtVariance(p){
  const real=mgmtRealMinutes(p);
  return real?real-Number(p.durationMinutes||0):null;
}
function signedMinutesText(v){
  if(v===null||v===undefined)return '—';
  if(v===0)return 'En tiempo';
  return `${v>0?'+':'−'}${minutesText(Math.abs(v))}`;
}
async function managementFilteredData(){
  const from=$('#mgmtFrom')?.value||'0000-01-01',to=$('#mgmtTo')?.value||'9999-12-31';
  const analyst=$('#mgmtAnalyst')?.value||'',status=$('#mgmtStatus')?.value||'';
  const analysts=(await getAll('analysts')).filter(a=>a.status==='ACTIVO'&&isOperationalAnalyst(a));
  const ids=new Set(analysts.map(a=>a.id));
  return (await getAll('planning')).filter(p=>
    ids.has(p.analystId)&&p.date>=from&&p.date<=to&&(!analyst||p.analystId===analyst)&&(!status||p.status===status)
  ).sort((a,b)=>b.date.localeCompare(a.date)||a.startTime.localeCompare(b.startTime));
}
async function renderManagementFilters(){
  if(!$('#mgmtAnalyst'))return;
  const current=$('#mgmtAnalyst').value;
  const anas=(await getAll('analysts')).filter(a=>a.status==='ACTIVO'&&isOperationalAnalyst(a)).sort((a,b)=>a.name.localeCompare(b.name,'es'));
  $('#mgmtAnalyst').innerHTML='<option value="">Todos los analistas</option>'+anas.map(a=>`<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
  if(current&&anas.some(a=>a.id===current))$('#mgmtAnalyst').value=current;
}

function dailyStatusClass(p){if(p.status==='REALIZADO')return 'done';if(p.actualStartedAt)return 'progress';return 'planned'}
function dailyStatusLabel(p){if(p.status==='REALIZADO')return 'REALIZADO';if(p.actualStartedAt)return 'EN PROCESO';return 'PROGRAMADO'}
function dailyDurationReal(p){if(!p.actualStartedAt)return null;const start=Date.parse(p.actualStartedAt),end=p.actualFinishedAt?Date.parse(p.actualFinishedAt):Date.now();return Number.isFinite(start)&&Number.isFinite(end)?Math.max(0,Math.round((end-start)/60000)):null}
function dailyTechnicalSummary(p){
  const parts=[];
  if(p.actualSamples!==undefined&&p.actualSamples!==null)parts.push(`${p.actualSamples} muestra(s)`);
  if(p.calibrationResult?.completed){const r2=p.calibrationResult.regression?.r2;parts.push(`Curva ${p.calibrationResult.points?.length||0} puntos${Number.isFinite(r2)?` · R² ${r2.toFixed(4)}`:''}`)}
  else if(planRequiresCalibration(p))parts.push('Curva pendiente');
  if(p.reagentResult?.items?.length){
    const usedItems=p.reagentResult.items.filter(r=>!r.notUsed&&r.usedInActivity!==false);
    const x=usedItems.slice(0,3).map(r=>{
      if(r.mode==='COUNT')return `${r.name}: ${r.used??'—'} ${r.unit||'u'}`;
      const envs=Array.isArray(r.containers)?r.containers.filter(e=>e.usedInActivity!==false):[];
      if(!envs.length){
        const consumption=r.physicalState==='LIQUID'?`${Number(r.volumeUsedMl||0).toFixed(2)} mL`:`${Number(r.used||0).toFixed(2)} g`;
        return `${r.name}: — (${consumption} consumo)`;
      }
      return envs.map((e,i)=>{
        const finalWeight=Number(e.finalWeight);
        const consumption=r.physicalState==='LIQUID'?`${Number(e.volumeUsedMl||0).toFixed(2)} mL`:`${Number(e.used||0).toFixed(2)} g`;
        const label=envs.length>1?` ${e.label||`Envase ${i+1}`}`:'';
        return `${r.name}${label}: ${Number.isFinite(finalWeight)?finalWeight.toFixed(2):'—'} g (${consumption} consumo)`;
      }).join(' · ');
    });
    parts.push(x.length?`Reactivos · ${x.join(' · ')}${usedItems.length>3?' · …':''}`:'Reactivos · sin consumo');
  }else if(planHasReagents(p))parts.push('Reactivos pendientes');
  return parts.join(' | ');
}
async function renderDailyMonitor(){
  if(currentSessionUser?.role!=='JEFE')return;
  const date=$('#dailyMonitorDate')?.value||dateToday();
  const plans=(await visiblePlanningRows()).filter(p=>p.date===date).sort((a,b)=>(a.startTime||'').localeCompare(b.startTime||''));
  const analysts=(await getAll('analysts')).filter(a=>a.status==='ACTIVO'&&isOperationalAnalyst(a)).sort((a,b)=>a.name.localeCompare(b.name,'es'));
  const comments=await getAll('planComments');
  const total=plans.length,done=plans.filter(p=>p.status==='REALIZADO').length,inProgress=plans.filter(p=>p.actualStartedAt&&p.status!=='REALIZADO').length,pending=plans.filter(p=>!p.actualStartedAt&&p.status!=='REALIZADO').length;
  const realMinutes=plans.reduce((sum,p)=>sum+(dailyDurationReal(p)||0),0);
  const techNeed=plans.filter(p=>planRequiresCalibration(p)||planHasReagents(p));
  const techDone=techNeed.filter(p=>(!planRequiresCalibration(p)||p.calibrationResult?.completed)&&(!planHasReagents(p)||p.reagentResult?.completed)).length;
  $('#dailyMonitorKpis').innerHTML=`<article><span>Actividades</span><strong>${total}</strong><small>${date}</small></article><article><span>Realizadas</span><strong>${done}</strong><small>${total?Math.round(done/total*100):0}% del plan</small></article><article><span>En proceso</span><strong>${inProgress}</strong><small>${pending} pendientes</small></article><article><span>Tiempo real</span><strong>${minutesText(realMinutes)}</strong><small>ejecutado acumulado</small></article><article><span>Cierre técnico</span><strong>${techDone}/${techNeed.length}</strong><small>curvas/reactivos completos</small></article>`;
  $('#dailyAnalystSummary').innerHTML=analysts.map(a=>{const ap=plans.filter(p=>p.analystId===a.id||normalizeIdentityText(p.analystName)===normalizeIdentityText(a.name));const ad=ap.filter(p=>p.status==='REALIZADO').length,rm=ap.reduce((sum,p)=>sum+(dailyDurationReal(p)||0),0);return `<button class="daily-analyst-chip" data-jump-analyst="${a.id}"><span class="daily-avatar">${escapeHtml((a.name||'?').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase())}</span><span><b>${escapeHtml(a.name)}</b><small>${ad}/${ap.length} realizadas · ${minutesText(rm)}</small></span><strong>${ap.length}</strong></button>`}).join('')||'<div class="empty-state">Sin analistas activos.</div>';
  const hb=[];for(let hr=8;hr<=16;hr++){const hs=String(hr).padStart(2,'0')+':00';hb.push({hr,count:plans.filter(p=>(p.startTime||'00:00')<=hs&&(p.endTime||'00:00')>hs).length})}const max=Math.max(1,...hb.map(x=>x.count));$('#dailyHourSummary').innerHTML=hb.map(x=>`<div class="hour-row"><span>${String(x.hr).padStart(2,'0')}:00</span><div><i style="width:${Math.round(x.count/max*100)}%"></i></div><b>${x.count}</b></div>`).join('');
  $('#dailyAnalystBoards').innerHTML=analysts.map(a=>{const ap=plans.filter(p=>p.analystId===a.id||normalizeIdentityText(p.analystName)===normalizeIdentityText(a.name));const dn=ap.filter(p=>p.status==='REALIZADO').length;if(!ap.length)return `<section class="daily-board" id="daily-board-${a.id}"><header><div><b>${escapeHtml(a.name)}</b><small>Sin actividades</small></div><span class="daily-board-total">0</span></header><div class="empty-state compact">Sin planificación para este día.</div></section>`;return `<section class="daily-board" id="daily-board-${a.id}"><header><div><b>${escapeHtml(a.name)}</b><small>${dn}/${ap.length} realizadas · ${Math.round(dn/ap.length*100)}%</small></div><span class="daily-board-total">${ap.length}</span></header><div class="daily-progress"><i style="width:${Math.round(dn/ap.length*100)}%"></i></div><div class="daily-task-list">${ap.map(p=>{const tech=dailyTechnicalSummary(p),real=dailyDurationReal(p),pc=comments.filter(x=>x.planId===p.id).length;return `<article class="daily-task ${dailyStatusClass(p)}"><div class="daily-task-time"><b>${escapeHtml(p.startTime||'—')}</b><span>${escapeHtml(p.endTime||'—')}</span></div><div class="daily-task-body"><div class="daily-task-top"><div><span class="daily-section">${escapeHtml(sectionMeta(p.section).label)}</span><h4>${escapeHtml(p.catalogName)}</h4></div><span class="daily-state ${dailyStatusClass(p)}">${dailyStatusLabel(p)}</span></div><div class="daily-task-meta"><span>Plan ${minutesText(p.durationMinutes||0)}</span>${real!==null?`<span>Real ${minutesText(real)}</span>`:''}${p.actualStartedAt?`<span>Inicio ${formatActualStamp(p.actualStartedAt)}</span>`:''}${p.actualFinishedAt?`<span>Fin ${formatActualStamp(p.actualFinishedAt)}</span>`:''}${pc?`<span>${pc} comentario(s)</span>`:''}</div>${tech?`<div class="daily-tech">${escapeHtml(tech)}</div>`:''}${p.notes?`<div class="daily-note"><b>Nota:</b> ${escapeHtml(p.notes)}</div>`:''}</div></article>`}).join('')}</div></section>`}).join('');
  $$('[data-jump-analyst]').forEach(b=>b.onclick=()=>document.getElementById(`daily-board-${b.dataset.jumpAnalyst}`)?.scrollIntoView({behavior:'smooth',block:'start'}));
  $('#dailyMonitorSubtitle').textContent=`${date} · ${plans.length} actividad(es) · ${done} realizada(s)`;
}

async function renderManagementDashboard(){
  if(!$('#managementBody'))return;
  await renderManagementFilters();
  const data=await managementFilteredData();
  const comments=await getAll('planComments');
  const total=data.length,realized=data.filter(p=>p.status==='REALIZADO').length,programmed=data.filter(p=>p.status==='PROGRAMADO').length;
  const plannedMinutes=data.filter(p=>p.status!=='CANCELADO').reduce((t,p)=>t+Number(p.durationMinutes||0),0);
  const realRows=data.filter(p=>p.status==='REALIZADO'&&mgmtRealMinutes(p)>0);
  const realMinutes=realRows.reduce((t,p)=>t+mgmtRealMinutes(p),0);
  const avgVar=realRows.length?Math.round(realRows.reduce((t,p)=>t+mgmtVariance(p),0)/realRows.length):0;
  const compliance=total?Math.round(realized/Math.max(1,data.filter(p=>p.status!=='CANCELADO').length)*100):0;

  $('#managementKpis').innerHTML=`
    <article><span>Actividades</span><strong>${total}</strong></article>
    <article><span>Realizadas</span><strong>${realized}</strong></article>
    <article><span>Programadas</span><strong>${programmed}</strong></article>
    <article><span>Cumplimiento</span><strong>${compliance}%</strong></article>
    <article><span>Horas planificadas</span><strong>${minutesText(plannedMinutes)}</strong></article>
    <article><span>Horas reales</span><strong>${realRows.length?minutesText(realMinutes):'—'}</strong></article>
    <article><span>Desviación promedio</span><strong>${realRows.length?signedMinutesText(avgVar):'—'}</strong></article>`;

  const by={};
  data.forEach(p=>{
    const k=p.analystId;
    if(!by[k])by[k]={name:p.analystName,total:0,done:0,planned:0,real:0,vars:[],onTime:0};
    const x=by[k];x.total++;if(p.status!=='CANCELADO')x.planned+=Number(p.durationMinutes||0);
    if(p.status==='REALIZADO'){
      x.done++;
      const rm=mgmtRealMinutes(p);if(rm){x.real+=rm;const v=rm-Number(p.durationMinutes||0);x.vars.push(v);if(v<=15)x.onTime++}
    }
  });
  $('#managementAnalystCards').innerHTML=Object.values(by).sort((a,b)=>a.name.localeCompare(b.name,'es')).map(x=>{
    const avg=x.vars.length?Math.round(x.vars.reduce((a,b)=>a+b,0)/x.vars.length):null;
    const completion=x.total?Math.round(x.done/x.total*100):0;
    const punctual=x.done?Math.round(x.onTime/x.done*100):0;
    return `<article class="performance-card">
      <div class="performance-head"><b>${escapeHtml(x.name)}</b><span>${completion}% realizadas</span></div>
      <div class="performance-values">
        <div><small>Actividades</small><strong>${x.done}/${x.total}</strong></div>
        <div><small>Planificadas</small><strong>${minutesText(x.planned)}</strong></div>
        <div><small>Tiempo real</small><strong>${x.real?minutesText(x.real):'—'}</strong></div>
        <div><small>Dentro de +15 min</small><strong>${x.done?punctual+'%':'—'}</strong></div>
      </div>
      <div class="performance-note">${avg===null?'Aún no hay suficiente ejecución real.':avg>15?`Promedio ${signedMinutesText(avg)} sobre lo planificado.`:avg<-15?`Promedio ${signedMinutesText(avg)} respecto a lo planificado.`:'Tiempo real cercano a lo planificado.'}</div>
    </article>`;
  }).join('')||'<div class="muted">Sin datos para resumir.</div>';

  $('#managementCount').textContent=`${data.length} registro(s)`;
  $('#managementEmpty').classList.toggle('hidden',data.length>0);
  $('#managementTableWrap').classList.toggle('hidden',data.length===0);
  $('#managementBody').innerHTML=data.map(p=>{
    const real=mgmtRealMinutes(p),v=mgmtVariance(p),cc=comments.filter(c=>c.planId===p.id);
    const statusClass=p.status==='REALIZADO'?'done':p.status==='EN PROCESO'?'progress':p.status==='CANCELADO'?'cancel':'planned';
    return `<tr>
      <td><b>${escapeHtml(p.date)}</b></td>
      <td>${escapeHtml(p.analystName)}</td>
      <td><b>${escapeHtml(p.catalogName)}</b><small>${escapeHtml(sectionMeta(p.section).label)}${p.samples?` · ${p.samples} muestras`:''}</small>${p.notes?`<small>Jefe: ${escapeHtml(p.notes)}</small>`:''}${cc.length?`<small>${cc.length} comentario(s)</small>`:''}</td>
      <td><b>${p.startTime}–${p.endTime}</b><small>${minutesText(p.durationMinutes)}</small></td>
      <td>${p.actualStartedAt?`<b>${formatActualStamp(p.actualStartedAt)}${p.actualFinishedAt?`–${formatActualStamp(p.actualFinishedAt)}`:''}</b><small>${real?minutesText(real):'En ejecución'}</small>`:'—'}</td>
      <td><span class="variance-pill ${v!==null?(v>15?'late':v<-15?'early':'ok'):''}">${signedMinutesText(v)}</span></td>
      <td><span class="mgmt-status ${statusClass}">${p.status}</span></td>
      <td>${p.status==='PROGRAMADO'?`<button class="btn secondary compact" data-edit-planning="${p.id}">Editar</button>`:'<span class="protected-label">Protegido</span>'}</td>
    </tr>`;
  }).join('');
  $$('[data-edit-planning]').forEach(b=>b.onclick=()=>openPlanningEdit(b.dataset.editPlanning));
}
async function analyzeManagementAI(){
  const data=await managementFilteredData();
  if(!data.length){$('#managementAI').innerHTML='<div class="boss-finding info"><b>Sin datos</b><span>No existen actividades en el período seleccionado.</span></div>';return}
  const by={};
  data.forEach(p=>{
    if(!by[p.analystId])by[p.analystId]={name:p.analystName,total:0,done:0,vars:[],planned:0};
    const x=by[p.analystId];x.total++;x.planned+=p.status!=='CANCELADO'?Number(p.durationMinutes||0):0;
    if(p.status==='REALIZADO'){x.done++;const v=mgmtVariance(p);if(v!==null)x.vars.push(v)}
  });
  const insights=[];
  for(const x of Object.values(by)){
    const completion=x.total?Math.round(x.done/x.total*100):0;
    const avg=x.vars.length?Math.round(x.vars.reduce((a,b)=>a+b,0)/x.vars.length):null;
    if(completion<70&&x.total>=3)insights.push({level:'warning',title:`Seguimiento de ${x.name}`,text:`${completion}% de las actividades del período están realizadas. Conviene revisar pendientes, reprogramaciones o estados sin cerrar.`});
    if(avg!==null&&avg>20)insights.push({level:'warning',title:`Tiempo real superior en ${x.name}`,text:`La ejecución real promedia ${minutesText(avg)} por encima de lo planificado. Revise si los tiempos del catálogo deben ajustarse.`});
    if(avg!==null&&avg<-30)insights.push({level:'info',title:`Tiempo real menor en ${x.name}`,text:`La ejecución termina en promedio ${minutesText(Math.abs(avg))} antes. Puede existir oportunidad de ajustar tiempos del catálogo o aprovechar capacidad.`});
  }
  const realized=data.filter(p=>p.status==='REALIZADO');
  const catalogMap={};
  realized.forEach(p=>{
    const v=mgmtVariance(p);if(v===null)return;
    const k=p.catalogId;if(!catalogMap[k])catalogMap[k]={name:p.catalogName,n:0,sum:0};catalogMap[k].n++;catalogMap[k].sum+=v;
  });
  Object.values(catalogMap).filter(x=>x.n>=3&&Math.abs(x.sum/x.n)>=20).sort((a,b)=>Math.abs(b.sum/b.n)-Math.abs(a.sum/a.n)).slice(0,4).forEach(x=>{
    const avg=Math.round(x.sum/x.n);
    insights.push({level:avg>0?'warning':'info',title:`Revisar parámetro: ${x.name}`,text:`En ${x.n} ejecuciones, el tiempo real difiere en promedio ${signedMinutesText(avg)} del catálogo.`});
  });
  if(!insights.length)insights.push({level:'good',title:'Comportamiento estable',text:'No se detectaron desviaciones relevantes con los datos disponibles para este período.'});
  $('#managementAI').innerHTML=insights.map(i=>`<div class="boss-finding ${i.level}"><b>${escapeHtml(i.title)}</b><span>${escapeHtml(i.text)}</span></div>`).join('');
  await audit('ANALIZAR_GESTION_IA','DASHBOARD GESTION',`${$('#mgmtFrom').value}_${$('#mgmtTo').value}`,`${data.length} actividades analizadas · ${insights.length} hallazgo(s)`);
}
function xmlCell(value,type='String',style=''){
  const v=String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  return `<Cell${style?` ss:StyleID="${style}"`:''}><Data ss:Type="${type}">${v}</Data></Cell>`;
}
async function exportManagementExcel(){
  const data=await managementFilteredData(),comments=await getAll('planComments');
  if(!data.length)return toast('No hay datos para exportar');
  const headers=['Fecha','Analista','Sección','Actividad','Muestras planificadas','Muestras analizadas reales','Estado','Inicio plan','Fin plan','Duración planificada','Inicio real','Fin real','Duración real','Desviación min','Observación jefe','Comentarios analista'];
  const rows=data.map(p=>{
    const cc=comments.filter(c=>c.planId===p.id).map(c=>`${c.authorName}: ${c.text}`).join(' | ');
    const real=mgmtRealMinutes(p),v=mgmtVariance(p);
    return [p.date,p.analystName,sectionMeta(p.section).label,p.catalogName,p.samples||'',p.actualSamples??'',p.status,p.startTime,p.endTime,minutesText(p.durationMinutes),p.actualStartedAt?formatActualStamp(p.actualStartedAt):'',p.actualFinishedAt?formatActualStamp(p.actualFinishedAt):'',real?minutesText(real):'',v===null?'':v,p.notes||'',cc];
  });
  const xml=`<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#DCE6F1" ss:Pattern="Solid"/></Style></Styles>
<Worksheet ss:Name="Actividades"><Table>
<Row>${headers.map(x=>xmlCell(x,'String','Header')).join('')}</Row>
${rows.map(r=>`<Row>${r.map(x=>xmlCell(x)).join('')}</Row>`).join('\n')}
</Table></Worksheet></Workbook>`;
  const blob=new Blob([xml],{type:'application/vnd.ms-excel;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=`ACTIVIDADES_ANALISTAS_${$('#mgmtFrom').value}_${$('#mgmtTo').value}.xls`;
  a.click();URL.revokeObjectURL(a.href);
  await audit('EXPORTAR_EXCEL','DASHBOARD GESTION','EXCEL',`${data.length} actividades exportadas`);
  toast('Excel generado');
}
async function exportReagentConsumptionExcel(){
  const filtered=(await managementFilteredData()).filter(p=>p.status==='REALIZADO'&&p.reagentResult?.items?.length);
  const allPlans=(await getAll('planning')).filter(p=>p.status==='REALIZADO'&&p.reagentResult?.items?.length);
  const catalog=await getAll('catalog');
  if(!filtered.length&&!allPlans.length)return toast('No hay registros de reactivos para exportar');

  const consumptionHeaders=['Fecha','Código planificación','Analista','Sección','Parámetro / actividad','Técnica / clasificación','Reactivo / material','Estado de uso','Tipo de control','Estado físico','Densidad g/mL','Tara envase g','Peso inicial vigente g','Origen peso inicial','Corregido por','Peso final registrado g','Consumo masa g','Consumo volumen mL','Cantidad contable utilizada','Unidad de consumo','Inventario neto final g','Inventario neto final mL','Hora inicio real','Hora fin real'];
  const consumptionRows=[];
  filtered.forEach(p=>{
    (p.reagentResult.items||[]).forEach(r=>consumptionRows.push([
      p.date,p.code,p.analystName,sectionMeta(p.section).label,p.catalogName,p.family||'',r.name||'',r.notUsed?'NO UTILIZADO':'UTILIZADO',reagentModeLabel(r.mode),
      r.mode==='WEIGHT'?(r.physicalState==='LIQUID'?'LÍQUIDO':'SÓLIDO'):'',r.mode==='WEIGHT'?(r.density??''):'',r.mode==='WEIGHT'?(r.tareWeight??''):'',
      r.mode==='WEIGHT'?(r.initialWeight??r.before??''):'',r.mode==='WEIGHT'?(r.initialSource||''):'',r.mode==='WEIGHT'?(r.initialWeightCorrectedBy||''):'',r.mode==='WEIGHT'?(r.finalWeight??r.after??''):'',r.mode==='WEIGHT'?(r.used??''):'',r.mode==='WEIGHT'?(r.volumeUsedMl??''):'',
      r.mode==='COUNT'?(r.used??''):'',r.mode==='WEIGHT'?(r.physicalState==='LIQUID'?'mL':'g'):(r.unit||'unidad'),r.mode==='WEIGHT'?(r.netRemainingG??''):'',r.mode==='WEIGHT'?(r.netRemainingMl??''):'',
      p.actualStartedAt?formatActualStamp(p.actualStartedAt):'',p.actualFinishedAt?formatActualStamp(p.actualFinishedAt):''
    ]));
  });

  // Inventario actual: último registro confirmado por reactivo/material (nombre + unidad).
  const latest=new Map();
  for(const p of allPlans){
    const stamp=Date.parse(p.actualFinishedAt||p.updatedAt||p.createdAt||0)||0;
    for(const r of p.reagentResult.items||[]){
      const key=reagentCycleKey(r);
      const prev=latest.get(key);
      if(!prev||stamp>prev.stamp)latest.set(key,{p,r,stamp});
    }
  }

  // También incluir reactivos configurados que todavía no tienen consumos.
  const configured=[];
  for(const cat of catalog){
    for(const r of cat.reagentConfig||[]){
      configured.push({cat,r,key:reagentCycleKey(r)});
    }
  }
  const keys=new Set([...configured.map(x=>x.key),...latest.keys()]);
  const inventoryHeaders=['Reactivo / material','Tipo de control','Estado físico','Densidad g/mL','Tara envase g','Peso bruto vigente g','Contenido neto actual g','Contenido neto actual mL','Unidad contable','Última cantidad contable usada','Última fecha de uso','Último analista','Último parámetro / actividad','Sección','Origen del peso vigente','Estado inventario'];
  const inventoryRows=[];
  for(const key of keys){
    const hit=latest.get(key);
    const cfg=configured.find(x=>x.key===key);
    const r=hit?.r||cfg?.r||{};
    const p=hit?.p;
    if(r.mode==='WEIGHT'){
      const finalWeight=Number(hit?.r?.finalWeight ?? hit?.r?.after);
      const gross=Number.isFinite(finalWeight)?finalWeight:Number(r.initialWeight);
      const tare=Number(hit?.r?.tareWeight ?? r.tareWeight);
      const density=Number(hit?.r?.density ?? r.density);
      const state=hit?.r?.physicalState||r.physicalState||'SOLID';
      const netG=(Number.isFinite(gross)&&Number.isFinite(tare))?Math.max(0,gross-tare):'';
      const netMl=state==='LIQUID'&&netG!==''&&Number.isFinite(density)&&density>0?netG/density:'';
      inventoryRows.push([r.name||'',reagentModeLabel(r.mode),state==='LIQUID'?'LÍQUIDO':'SÓLIDO',Number.isFinite(density)?density:'',Number.isFinite(tare)?tare:'',Number.isFinite(gross)?gross:'',netG,netMl,'','',p?.date||'',p?.analystName||'',p?.catalogName||cfg?.cat?.name||'',p?sectionMeta(p.section).label:(cfg?.cat?sectionMeta(cfg.cat.section).label:''),hit?'ÚLTIMO PESO FINAL':'PESO INICIAL CATÁLOGO',(Number.isFinite(gross)&&Number.isFinite(tare))?(netG<=0.000001?'AGOTADO · REPONER':'ACTIVO'):'FALTA TARA/PESO']);
    }else{
      inventoryRows.push([r.name||'',reagentModeLabel(r.mode),'','','','','','',''+(r.unit||'unidad'),hit?.r?.used??'',p?.date||'',p?.analystName||'',p?.catalogName||cfg?.cat?.name||'',p?sectionMeta(p.section).label:(cfg?.cat?sectionMeta(cfg.cat.section).label:''),'NO APLICA','CONSUMO CONTABLE']);
    }
  }
  inventoryRows.sort((a,b)=>String(a[0]).localeCompare(String(b[0]),'es'));

  const numericConsumption=new Set([10,11,12,15,16,17,18,20,21]);
  const numericInventory=new Set([3,4,5,6,7,9]);
  const rowXml=(row,numSet)=>`<Row>${row.map((x,i)=>xmlCell(x,(numSet.has(i)&&x!==''&&Number.isFinite(Number(x)))?'Number':'String',(numSet.has(i)&&x!==''?'Num':''))).join('')}</Row>`;
  const xml=`<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#173F63" ss:Pattern="Solid"/></Style><Style ss:ID="Num"><NumberFormat ss:Format="0.000"/></Style></Styles>
<Worksheet ss:Name="CONSUMOS"><Table>
<Row>${consumptionHeaders.map(x=>xmlCell(x,'String','Header')).join('')}</Row>
${consumptionRows.map(r=>rowXml(r,numericConsumption)).join('\n')}
</Table></Worksheet>
<Worksheet ss:Name="INVENTARIO ACTUAL"><Table>
<Row>${inventoryHeaders.map(x=>xmlCell(x,'String','Header')).join('')}</Row>
${inventoryRows.map(r=>rowXml(r,numericInventory)).join('\n')}
</Table></Worksheet>
</Workbook>`;
  const blob=new Blob([xml],{type:'application/vnd.ms-excel;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=`INVENTARIO_Y_CONSUMO_REACTIVOS_${new Date().toISOString().slice(0,10)}.xls`;a.click();URL.revokeObjectURL(a.href);
  await audit('EXPORTAR_INVENTARIO_CONSUMO_REACTIVOS','DASHBOARD GESTION','EXCEL',`${consumptionRows.length} consumos · ${inventoryRows.length} reactivos/materiales en inventario`);
  toast(`Excel generado · ${consumptionRows.length} consumos · ${inventoryRows.length} inventarios`);
}
async function openPlanningEdit(id){
  const p=await getOne('planning',id);
  if(!p)return;
  if(p.status!=='PROGRAMADO')return toast('Solo se pueden editar actividades PROGRAMADAS');
  const anas=(await getAll('analysts')).filter(a=>a.status==='ACTIVO'&&isOperationalAnalyst(a)&&(a.competencies||[]).includes(p.section));
  $('#editPlanId').value=p.id;$('#editPlanActivity').value=p.catalogName;$('#editPlanDate').value=p.date;$('#editPlanStart').value=p.startTime;
  $('#editPlanEnd').value=p.endTime;$('#editPlanDuration').value=minutesText(p.durationMinutes);$('#editPlanNotes').value=p.notes||'';
  $('#editPlanAnalyst').innerHTML=anas.map(a=>`<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
  $('#editPlanAnalyst').value=p.analystId;
  $('#planningEditDialog').showModal();
}
async function previewPlanningEdit(){
  const id=$('#editPlanId').value,p=await getOne('planning',id);if(!p)return;
  const start=timeToMinutes($('#editPlanStart').value);
  $('#editPlanEnd').value=minutesToTime(addWorkingMinutes(start,Number(p.durationMinutes||0)));
}
async function savePlanningEdit(e){
  e.preventDefault();
  const id=$('#editPlanId').value,p=await getOne('planning',id);if(!p)return;
  if(p.status!=='PROGRAMADO'){toast('La actividad ya no está PROGRAMADA');$('#planningEditDialog').close();return}
  const analystId=$('#editPlanAnalyst').value,date=$('#editPlanDate').value,start=$('#editPlanStart').value;
  const analyst=await getOne('analysts',analystId);if(!analyst||!date||!start)return toast('Complete los datos');
  const end=minutesToTime(addWorkingMinutes(timeToMinutes(start),Number(p.durationMinutes||0)));
  const day=(await planningForDate(date)).filter(x=>x.id!==p.id&&x.analystId===analystId&&x.status!=='CANCELADO');
  const conflict=day.find(x=>workOverlap(timeToMinutes(start),Number(p.durationMinutes||0),timeToMinutes(x.startTime),Number(x.durationMinutes||0)));
  if(conflict)return alert(`No se puede guardar: existe cruce con "${conflict.catalogName}" (${conflict.startTime}-${conflict.endTime}).`);
  const before=`${p.date} · ${p.analystName} · ${p.startTime}-${p.endTime}`;
  p.date=date;p.analystId=analyst.id;p.analystName=analyst.name;p.startTime=start;p.endTime=end;p.notes=$('#editPlanNotes').value.trim();p.updatedAt=nowISO();
  await put('planning',p);await queue('UPDATE','planning',p);
  await audit('EDITAR_PLANIFICACION','DASHBOARD GESTION',p.code,`${before} → ${p.date} · ${p.analystName} · ${p.startTime}-${p.endTime}`);
  $('#planningEditDialog').close();toast('Planificación actualizada');
  await renderManagementDashboard();await refreshPlanner();await renderMyDay();
}

async function renderDashboard(){const [cat,ana,rules]=await Promise.all([getAll('catalog'),getAll('analysts'),getAll('timeRules')]);const findings=await analyzeData(false);$('#statCatalog').textContent=cat.filter(x=>x.status==='ACTIVO').length;$('#statAnalysts').textContent=ana.filter(x=>x.status==='ACTIVO').length;$('#statRules').textContent=rules.length;$('#statAlerts').textContent=findings.filter(x=>x.level!=='OK').length}
function renderSectionTabs(){const el=$('#sectionTabs');el.innerHTML=SECTIONS.map(s=>`<button class="section-tab ${s.id===currentSection?'active':''}" data-section="${s.id}">${s.label}</button>`).join('');$$('[data-section]').forEach(b=>b.onclick=()=>{currentSection=b.dataset.section;renderSectionTabs();renderCatalog()})}
async function renderCatalog(){const meta=sectionMeta(currentSection);$('#catalogHeading').textContent=meta.label;$('#catalogHelp').textContent=meta.hint;let data=(await getAll('catalog')).filter(x=>x.section===currentSection);const q=$('#catalogSearch').value.trim().toLowerCase(),st=$('#catalogStatusFilter').value;data=data.filter(x=>(!q||`${x.code} ${x.name} ${x.family||''}`.toLowerCase().includes(q))&&(!st||x.status===st));data.sort((a,b)=>a.name.localeCompare(b.name,'es'));const [rules,steps]=await Promise.all([getAll('timeRules'),getAll('compositeSteps')]);$('#catalogEmpty').classList.toggle('hidden',data.length>0);$('#catalogTableWrap').classList.toggle('hidden',data.length===0);$('#catalogBody').innerHTML=data.map(x=>{const n=rules.filter(r=>r.catalogId===x.id).length,ss=steps.filter(s=>s.catalogId===x.id).sort((a,b)=>a.order-b.order);const time=x.timeMode==='FIXED'?minutesText(x.baseMinutes):x.timeMode==='BY_SAMPLES'?`${n} rango${n===1?'':'s'}`:x.timeMode==='COMPOSITE'?`${minutesText(x.baseMinutes)} · ${ss.length} detalle${ss.length===1?'':'s'}`:'Sin tiempo';const breakdown=ss.length?`<div class="catalog-breakdown">${ss.map(s=>`<span>${escapeHtml(s.name)} · ${minutesText(s.minutes)}</span>`).join('')}</div>`:'';const curve=x.calibrationConfig?.enabled?`<div class="catalog-curve-badge">CURVA · ${x.calibrationConfig.points?.length||0} puntos · ${Number(x.calibrationConfig.replicates||3)} réplica(s) · ${escapeHtml(x.calibrationConfig.unit||'')}</div>`:'';const reagents=x.reagentConfig?.length?`<div class="catalog-reagent-badge">${x.reagentConfig.length} reactivo(s) / material(es)</div>`:'';return `<tr><td><b>${x.code}</b></td><td>${sectionMeta(x.section).label}</td><td>${escapeHtml(x.family||'—')}</td><td><b>${escapeHtml(x.name)}</b><br><small>${escapeHtml(x.description||'')}</small>${breakdown}${curve}${reagents}</td><td>${time}</td><td><span class="badge ${x.status==='ACTIVO'?'good':'off'}">${x.status}</span></td><td class="row-actions"><button data-edit-cat="${x.id}">Editar</button><button data-toggle-cat="${x.id}">${x.status==='ACTIVO'?'Desactivar':'Activar'}</button></td></tr>`}).join('');$$('[data-edit-cat]').forEach(b=>b.onclick=()=>editCatalog(b.dataset.editCat));$$('[data-toggle-cat]').forEach(b=>b.onclick=()=>toggleCatalog(b.dataset.toggleCat))}
function setCatalogSectionOptions(){const sel=$('#catalogSection');sel.innerHTML=SECTIONS.map(s=>`<option value="${s.id}">${s.label}</option>`).join('')}
function updateCatalogForm(){const section=$('#catalogSection').value,meta=sectionMeta(section),timeSel=$('#catalogTimeMode'),forcedComposite=['RECEPCION_MUESTRAS','MICROBIOLOGIA','AASS'].includes(section);$('#familyLabel').childNodes[0].nodeValue=meta.family;if(forcedComposite){timeSel.value='COMPOSITE';timeSel.disabled=true;if(section==='RECEPCION_MUESTRAS')setDurationPicker(300)}else{timeSel.disabled=false}const mode=timeSel.value;$('#baseMinutesLabel').classList.toggle('hidden',!['FIXED','COMPOSITE'].includes(mode));$('#catalogBaseHours').disabled=mode==='COMPOSITE'&&section==='RECEPCION_MUESTRAS';$('#catalogBaseMinutePart').disabled=mode==='COMPOSITE'&&section==='RECEPCION_MUESTRAS';$('#rulesEditor').classList.toggle('hidden',mode!=='BY_SAMPLES');$('#compositeEditor').classList.toggle('hidden',mode!=='COMPOSITE');const help=$('#compositeHelp');if(help)help.textContent=section==='RECEPCION_MUESTRAS'?'El jefe seleccionará una sola actividad y el futuro Planificador reservará el bloque completo. En Recepción de Muestras el total queda fijado en 5 h.':section==='MICROBIOLOGIA'?'Defina la duración total de la actividad microbiológica y distribúyala entre sus subactividades. El futuro Planificador reservará el bloque completo con un solo clic.':section==='AASS'?'Defina la duración total del bloque de Absorción Atómica y distribúyala entre sus subactividades. El futuro Planificador reservará todo el bloque con un solo clic.':'Divida la duración total entre las subactividades que componen este bloque.';renderRuleRows();renderStepRows();updateCalibrationEditor();updateReagentEditor()}

let plannerCatalogReturn=null;
function openCatalogFromPlanner(){
  const section=$('#planSection')?.value||currentSection;
  const typed=($('#planActivitySearch')?.value||'').trim();
  plannerCatalogReturn={
    section,
    date:$('#planDate')?.value||'',
    analystId:$('#planAnalyst')?.value||'',
    notes:$('#planNotes')?.value||'',
    samples:$('#planSamples')?.value||''
  };
  currentSection=section;
  openCatalog();
  $('#catalogSection').value=section;
  if(typed)$('#catalogName').value=typed;
  $('#catalogDialogTitle').textContent='Agregar actividad desde Planificador';
  $('#catalogDialogHelp').textContent='Complete el parámetro, clasificación/técnica y tiempo. Al guardar volverá al Planificador con la nueva actividad seleccionada.';
  updateCatalogForm();
}

const REAGENT_ALLOWED_SECTIONS=['ACTIVIDADES_LABORATORIO','ENSAYOS_ANALITICOS','RECEPCION_MUESTRAS','MICROBIOLOGIA','AASS'];
function sectionAllowsReagents(section){return REAGENT_ALLOWED_SECTIONS.includes(section)}
let editingReagents=[];
let reagentMasterProfiles=[];
function reagentModeLabel(mode){return mode==='WEIGHT'?'PESO DE FRASCO':'CONTABLE'}
function cloneReagentProfile(r){return JSON.parse(JSON.stringify(r||{}))}
async function buildReagentMasterProfiles(){
  const cats=await getAll('catalog');
  const plans=await getAll('planning');
  const byIdentity=new Map();
  // Catálogo maestro por identidad real: NOMBRE + LOTE. Así un mismo reactivo puede
  // conservar varios lotes activos sin que el más reciente oculte a los demás.
  for(const cat of cats){
    const stamp=Date.parse(cat.updatedAt||cat.createdAt||0)||0;
    for(const r of cat.reagentConfig||[]){
      const nameKey=normalizeIdentityText(r.name||''),lotKey=normalizeIdentityText(r.lot||'');
      if(!nameKey)continue;
      const key=`${nameKey}|${lotKey}`;
      const prev=byIdentity.get(key);
      if(!prev||stamp>prev.stamp)byIdentity.set(key,{profile:cloneReagentProfile(r),stamp,source:`${cat.name||cat.code||'Catálogo'}`});
    }
  }
  // El último uso actualiza solamente SU MISMO lote; nunca reemplaza otro lote del mismo nombre.
  const latestUse=new Map();
  for(const p of plans){
    if(p.status!=='REALIZADO'||!p.reagentResult?.items?.length)continue;
    const stamp=Date.parse(p.actualFinishedAt||p.updatedAt||p.createdAt||0)||0;
    for(const item of p.reagentResult.items){
      const nameKey=normalizeIdentityText(item.name||''),lotKey=normalizeIdentityText(item.lot||'');
      if(!nameKey)continue;
      const key=`${nameKey}|${lotKey}`;
      const prev=latestUse.get(key);if(!prev||stamp>prev.stamp)latestUse.set(key,{item,p,stamp});
    }
  }
  for(const [key,hit] of latestUse){
    const base=byIdentity.get(key);if(!base)continue;
    const r=base.profile,item=hit.item;
    if(r.mode==='COUNT'&&Number.isFinite(Number(item.stockRemaining))){r.stockQuantity=Math.max(0,Number(item.stockRemaining));r.inventoryStatus=r.stockQuantity<=0?'AGOTADO':'ACTIVO';}
    if(r.mode==='WEIGHT'){
      if(item.physicalState)r.physicalState=item.physicalState;
      if(Number.isFinite(Number(item.density)))r.density=Number(item.density);
      const resultContainers=Array.isArray(item.containers)?item.containers:[];
      if(resultContainers.length&&Array.isArray(r.containers)){
        r.containers=r.containers.map(env=>{
          const used=resultContainers.find(x=>(x.containerId||x.id)===env.id);
          if(!used)return env;
          const final=Number(used.finalWeight);
          return {...env,lot:used.lot||env.lot||r.lot||'',initialWeight:Number.isFinite(final)?final:env.initialWeight,status:used.depleted?'AGOTADO':'ACTIVO'};
        });
      }else if(Number.isFinite(Number(item.finalWeight))){r.initialWeight=Number(item.finalWeight);}
    }
    base.source=`Último uso: ${hit.p.catalogName||hit.p.code||'actividad'}`;
  }
  reagentMasterProfiles=[...byIdentity.entries()].map(([key,v])=>{
    const nameKey=normalizeIdentityText(v.profile.name||''),lotKey=normalizeIdentityText(v.profile.lot||'');
    const displayValue=v.profile.lot?`${v.profile.name} · Lote ${v.profile.lot}`:(v.profile.name||'');
    if(v.profile.mode==='WEIGHT'&&Array.isArray(v.profile.containers))v.profile.inventoryStatus=v.profile.containers.some(x=>x.status!=='AGOTADO')?'ACTIVO':'AGOTADO';
    return {key,nameKey,lotKey,displayKey:normalizeIdentityText(displayValue),displayValue,...v};
  }).filter(x=>x.profile.inventoryStatus!=='AGOTADO' && !(x.profile.mode==='COUNT'&&Number(x.profile.stockQuantity)<=0))
    .sort((a,b)=>`${a.profile.name||''} ${a.profile.lot||''}`.localeCompare(`${b.profile.name||''} ${b.profile.lot||''}`,'es'));
  return reagentMasterProfiles;
}
function reagentMasterDatalistHtml(){
  return `<datalist id="reagentMasterList">${reagentMasterProfiles.map(x=>`<option value="${escapeHtml(x.displayValue)}">${escapeHtml(reagentModeLabel(x.profile.mode))}${x.profile.stockQuantity!==null&&x.profile.stockQuantity!==undefined&&x.profile.mode!=='WEIGHT'?` · Stock ${escapeHtml(x.profile.stockQuantity)}`:''}</option>`).join('')}</datalist>`;
}
async function autofillReagentFromMaster(index,typed){
  const key=normalizeIdentityText(typed||'');if(!key)return false;
  if(!reagentMasterProfiles.length)await buildReagentMasterProfiles();
  // Selección exacta del datalist (Nombre · Lote X).
  let hit=reagentMasterProfiles.find(x=>x.displayKey===key||x.key===key);
  if(!hit){
    const sameName=reagentMasterProfiles.filter(x=>x.nameKey===key);
    // Si existe un solo lote se puede completar por nombre. Con varios lotes se deja
    // la elección abierta al usuario para evitar seleccionar uno incorrecto.
    if(sameName.length===1)hit=sameName[0];
  }
  if(!hit){
    const starts=reagentMasterProfiles.filter(x=>x.displayKey.startsWith(key)||x.nameKey.startsWith(key));
    if(starts.length===1)hit=starts[0];
  }
  if(!hit)return false;
  const current=editingReagents[index]||{},src=cloneReagentProfile(hit.profile);
  src.id=current.id||uid('REA');src.order=current.order||index+1;
  if(src.mode==='WEIGHT')dedupeReagentContainers(src);
  editingReagents[index]={...src,_masterSource:hit.source,_autofilled:true};
  renderReagentRows();
  toast(`Ficha autocompletada: ${src.name}${src.lot?` · lote ${src.lot}`:''}`);
  return true;
}

function reagentDefaultUnit(mode){return mode==='WEIGHT'?'g':'unidad'}

function containerIdentityKey(e,r){
  const lot=normalizeIdentityText(e?.lot||r?.lot||'');
  const label=normalizeIdentityText(e?.label||'');
  const type=String(e?.containerType||'FRASCO').toUpperCase();
  // El ID manda cuando existe. Para registros antiguos/sin ID usamos lote + nombre + tipo.
  return e?.id?`ID:${e.id}`:`LEGACY:${lot}|${label}|${type}`;
}
function dedupeReagentContainers(r){
  if(!r||r.mode!=='WEIGHT')return [];
  const src=Array.isArray(r.containers)?r.containers:[];
  const out=[],seen=new Set();
  for(const raw of src){
    if(!raw)continue;
    const e={...raw};
    const key=containerIdentityKey(e,r);
    if(seen.has(key))continue;
    seen.add(key);out.push(e);
  }
  r.containers=out;
  return out;
}
function ensureReagentContainers(r){
  if(r.mode!=='WEIGHT')return [];
  if(Array.isArray(r.containers)&&r.containers.length){
    dedupeReagentContainers(r);
    if(r.containers.length)return r.containers;
  }
  r.containers=[{
    id:uid('ENV'),
    label:'Frasco principal',
    lot:r.lot||'',
    containerType:'FRASCO',
    tareWeight:r.tareWeight??'',
    initialWeight:r.initialWeight??'',
    status:'ACTIVO'
  }];
  return r.containers;
}
function renderContainerLists(){
  editingReagents.forEach((r,i)=>{
    if(r.mode!=='WEIGHT')return;
    const box=$(`[data-container-list="${i}"]`);if(!box)return;
    const arr=ensureReagentContainers(r);
    box.innerHTML=arr.map((e,j)=>`<div class="container-config-row">
      <label>Identificación<input data-container-label="${i}-${j}" value="${escapeHtml(e.label||`Frasco ${j+1}`)}" placeholder="Ej. Frasco principal"></label>
      <label>Lote<input data-container-lot="${i}-${j}" value="${escapeHtml(e.lot||r.lot||'')}" placeholder="Ej. A12345"></label>
      <label>Tipo<select data-container-type="${i}-${j}"><option value="FRASCO" ${e.containerType!=='SOBRE'?'selected':''}>FRASCO</option><option value="SOBRE" ${e.containerType==='SOBRE'?'selected':''}>SOBRE</option></select></label>
      <label>Tara del envase (g)<input type="number" min="0" step="any" data-container-tare="${i}-${j}" value="${e.tareWeight??''}"></label>
      <label>Peso del envase + contenido (g)<input type="number" min="0" step="any" data-container-initial="${i}-${j}" value="${e.initialWeight??''}"></label>
      <button type="button" class="icon-btn" data-remove-container="${i}-${j}" ${arr.length===1?'disabled':''}>×</button>
    </div>`).join('');
  });
  $$('[data-container-label]').forEach(el=>el.oninput=()=>{const [i,j]=el.dataset.containerLabel.split('-').map(Number);ensureReagentContainers(editingReagents[i])[j].label=el.value});
  $$('[data-container-lot]').forEach(el=>el.oninput=()=>{const [i,j]=el.dataset.containerLot.split('-').map(Number);ensureReagentContainers(editingReagents[i])[j].lot=el.value});
  $$('[data-container-type]').forEach(el=>el.onchange=()=>{const [i,j]=el.dataset.containerType.split('-').map(Number);ensureReagentContainers(editingReagents[i])[j].containerType=el.value});
  $$('[data-container-tare]').forEach(el=>el.oninput=()=>{const [i,j]=el.dataset.containerTare.split('-').map(Number);ensureReagentContainers(editingReagents[i])[j].tareWeight=el.value;validateReagents()});
  $$('[data-container-initial]').forEach(el=>el.oninput=()=>{const [i,j]=el.dataset.containerInitial.split('-').map(Number);ensureReagentContainers(editingReagents[i])[j].initialWeight=el.value;validateReagents()});
  $$('[data-remove-container]').forEach(btn=>btn.onclick=()=>{const [i,j]=btn.dataset.removeContainer.split('-').map(Number),arr=ensureReagentContainers(editingReagents[i]);if(arr.length>1){arr.splice(j,1);renderReagentRows()}});
}
function renderReagentRows(){
  const box=$('#reagentRows');if(!box)return;
  box.innerHTML=reagentMasterDatalistHtml()+editingReagents.map((r,i)=>`<div class="reagent-row">
    <label>Reactivo / material<input list="reagentMasterList" data-reagent-name="${i}" value="${escapeHtml(r.name||'')}" placeholder="Escriba o seleccione un reactivo ya registrado"><small>${r._autofilled?`✓ Autocompletado · ${escapeHtml(r._masterSource||'última ficha disponible')}`:'Si ya existe, se completan automáticamente lote, control, stock, tara, peso y densidad.'}</small></label>
    <label>Lote<input data-reagent-lot="${i}" value="${escapeHtml(r.lot||'')}" placeholder="Ej. A12345"><small>Puede registrar el mismo reactivo con otro lote. Solo se bloquea si coinciden nombre + lote.</small></label>
    <label>Forma de control<select data-reagent-mode="${i}"><option value="COUNT" ${r.mode!=='WEIGHT'?'selected':''}>CONTABLE · stock por unidades</option><option value="WEIGHT" ${r.mode==='WEIGHT'?'selected':''}>PESO DE FRASCO · antes/después</option></select></label>
    <label>Unidad<input data-reagent-unit="${i}" value="${escapeHtml(r.unit||reagentDefaultUnit(r.mode))}" placeholder="unidad / sobre / tableta"></label>
    ${r.mode!=='WEIGHT'?`<label>Stock disponible<input type="number" min="0" step="any" data-reagent-stock="${i}" value="${r.stockQuantity??''}" placeholder="Ej. 100"><small>Cantidad existente antes de iniciar consumos.</small></label>`:''}
    ${r.mode==='WEIGHT'?`
      <label>Estado físico<select data-reagent-state="${i}">
        <option value="SOLID" ${(r.physicalState||'SOLID')==='SOLID'?'selected':''}>SÓLIDO</option>
        <option value="LIQUID" ${r.physicalState==='LIQUID'?'selected':''}>LÍQUIDO</option>
      </select></label>
      ${r.physicalState==='LIQUID'?`<label>Densidad (g/mL)<input type="number" min="0.000001" step="any" data-reagent-density="${i}" value="${r.density??''}" placeholder="Ej. 1.025"><small>Se usa para convertir gramos consumidos a mL.</small></label>`:''}
      <div class="reagent-containers-box">
        <div class="reagent-containers-head"><b>Frascos / sobres de este lote</b><button type="button" class="btn secondary mini-btn" data-add-container="${i}">+ Agregar frasco / sobre</button></div>
        <div data-container-list="${i}"></div>
      </div>`:''}
    <button type="button" class="icon-btn reagent-remove" data-remove-reagent="${i}">×</button>
  </div>`).join('');
  $$('[data-reagent-name]').forEach(el=>{el.oninput=()=>{const i=Number(el.dataset.reagentName);editingReagents[i].name=el.value;editingReagents[i]._autofilled=false;validateReagents()};el.onchange=()=>autofillReagentFromMaster(Number(el.dataset.reagentName),el.value);el.onblur=()=>autofillReagentFromMaster(Number(el.dataset.reagentName),el.value)});
  $$('[data-reagent-lot]').forEach(el=>el.oninput=()=>{editingReagents[Number(el.dataset.reagentLot)].lot=el.value;validateReagents()});
  $$('[data-reagent-stock]').forEach(el=>el.oninput=()=>{editingReagents[Number(el.dataset.reagentStock)].stockQuantity=el.value;validateReagents()});
  $$('[data-reagent-mode]').forEach(el=>el.onchange=()=>{const i=Number(el.dataset.reagentMode);editingReagents[i].mode=el.value;editingReagents[i].unit=reagentDefaultUnit(el.value);if(el.value!=='WEIGHT'){editingReagents[i].initialWeight=null;editingReagents[i].physicalState=null;editingReagents[i].density=null;editingReagents[i].tareWeight=null;editingReagents[i].containers=[]}else{editingReagents[i].physicalState=editingReagents[i].physicalState||'SOLID'}renderReagentRows()});
  $$('[data-reagent-unit]').forEach(el=>el.oninput=()=>{editingReagents[Number(el.dataset.reagentUnit)].unit=el.value;validateReagents()});
  $$('[data-reagent-initial]').forEach(el=>el.oninput=()=>{editingReagents[Number(el.dataset.reagentInitial)].initialWeight=el.value;validateReagents()});
  $$('[data-reagent-state]').forEach(el=>el.onchange=()=>{const i=Number(el.dataset.reagentState);editingReagents[i].physicalState=el.value;if(el.value!=='LIQUID')editingReagents[i].density=null;renderReagentRows()});
  $$('[data-reagent-density]').forEach(el=>el.oninput=()=>{editingReagents[Number(el.dataset.reagentDensity)].density=el.value;validateReagents()});
  $$('[data-reagent-tare]').forEach(el=>el.oninput=()=>{editingReagents[Number(el.dataset.reagentTare)].tareWeight=el.value;validateReagents()});
  $$('[data-remove-reagent]').forEach(el=>el.onclick=()=>{editingReagents.splice(Number(el.dataset.removeReagent),1);renderReagentRows()});
  renderContainerLists();
  $$('[data-add-container]').forEach(btn=>btn.onclick=()=>{
    const i=Number(btn.dataset.addContainer),r=editingReagents[i],arr=ensureReagentContainers(r);
    dedupeReagentContainers(r);
    const last=arr[arr.length-1];
    // Evita crear varias filas vacías por doble clic o por pulsaciones repetidas.
    if(last && !(String(last.tareWeight??'').trim()) && !(String(last.initialWeight??'').trim()) && arr.length>1){toast('Complete el frasco/sobre pendiente antes de agregar otro');return;}
    const used=new Set(arr.map(e=>normalizeIdentityText(e.label||'')));let n=1,label='Frasco principal';
    if(used.has(normalizeIdentityText(label))){do{n++;label=`Frasco ${n}`}while(used.has(normalizeIdentityText(label)));}
    arr.push({id:uid('ENV'),label,lot:r.lot||'',containerType:'FRASCO',tareWeight:'',initialWeight:'',status:'ACTIVO'});
    renderReagentRows();
  });
  validateReagents();
}
function addReagent(){editingReagents.push({id:uid('REA'),name:'',lot:'',mode:'COUNT',unit:'unidad',stockQuantity:'',initialWeight:null,physicalState:'SOLID',density:null,tareWeight:null,containers:[]});renderReagentRows()}
function updateReagentEditor(){
  const section=$('#catalogSection')?.value||'';
  const allowed=sectionAllowsReagents(section);
  const editor=$('#reagentEditor');if(!editor)return;
  editor.classList.toggle('hidden',!allowed);
  if(!allowed){
    $('#catalogUsesReagents').checked=false;
    $('#reagentConfigBody').classList.add('hidden');
    editingReagents=[];
    return;
  }
  const enabled=$('#catalogUsesReagents').checked;
  $('#reagentConfigBody').classList.toggle('hidden',!enabled);
  if(enabled){buildReagentMasterProfiles().then(()=>renderReagentRows());}
}
function validateReagents(){
  const el=$('#reagentValidation');if(!el)return {level:'OK',text:''};
  const section=$('#catalogSection')?.value||'';
  if(!sectionAllowsReagents(section)||!$('#catalogUsesReagents')?.checked){el.textContent='';el.className='inline-alert';return {level:'OK',text:''}}
  if(!editingReagents.length){const out={level:'ERROR',text:'Agregue al menos un reactivo o material, o desactive “Sí, registrar consumo”.'};el.textContent=out.text;el.className='inline-alert error';return out}
  const names=editingReagents.map(r=>(r.name||'').trim());
  const reagentLotKeys=editingReagents.map(r=>`${normalizeIdentityText(r.name||'')}|${normalizeIdentityText(r.lot||'')}`);
  let out;
  if(names.some(n=>!n))out={level:'ERROR',text:'Todos los reactivos/materiales deben tener nombre.'};
  else if(editingReagents.some(r=>!(r.lot||'').trim()))out={level:'ERROR',text:'Registre el lote de cada reactivo/material.'};
  else if(new Set(reagentLotKeys).size!==reagentLotKeys.length)out={level:'ERROR',text:'Ya existe este mismo reactivo con el mismo lote. Use un lote diferente o elimine la fila duplicada.'};
  else if(editingReagents.some(r=>r.mode!=='WEIGHT'&&(!Number.isFinite(Number(r.stockQuantity))||Number(r.stockQuantity)<0)))out={level:'ERROR',text:'Para materiales contables, registre el stock disponible.'};
  else if(editingReagents.some(r=>!(r.unit||'').trim()))out={level:'ERROR',text:'Defina la unidad de control de cada reactivo.'};
  else if(editingReagents.some(r=>r.mode==='WEIGHT'&&ensureReagentContainers(r).some(e=>!(e.label||'').trim())))out={level:'ERROR',text:'Todos los frascos/sobres deben tener nombre.'};
  else if(editingReagents.some(r=>r.mode==='WEIGHT'&&ensureReagentContainers(r).some(e=>!Number.isFinite(Number(e.tareWeight))||Number(e.tareWeight)<0)))out={level:'ERROR',text:'Registre una tara válida para cada frasco/sobre.'};
  else if(editingReagents.some(r=>r.mode==='WEIGHT'&&ensureReagentContainers(r).some(e=>!Number.isFinite(Number(e.initialWeight))||Number(e.initialWeight)<=Number(e.tareWeight))))out={level:'ERROR',text:'El peso inicial de cada frasco/sobre debe ser mayor que su tara.'};
  else if(editingReagents.some(r=>r.mode==='WEIGHT' && r.physicalState==='LIQUID' && (r.density==='' || r.density===null || r.density===undefined || !Number.isFinite(Number(r.density)) || Number(r.density)<=0)))out={level:'ERROR',text:'Para cada reactivo LÍQUIDO, registre una densidad válida en g/mL.'};
  else out={level:'OK',text:`${editingReagents.length} reactivo(s)/material(es) configurado(s). Se permite el mismo reactivo con lotes diferentes; reactivo + lote no puede repetirse.`};
  el.textContent=out.text;el.className='inline-alert '+out.level.toLowerCase();return out;
}
function reagentConfigFromForm(){
  const section=$('#catalogSection')?.value||'';
  if(!sectionAllowsReagents(section)||!$('#catalogUsesReagents')?.checked)return [];
  return editingReagents.map((r,i)=>{if(r.mode==='WEIGHT')dedupeReagentContainers(r);const containers=r.mode==='WEIGHT'?ensureReagentContainers(r).map((e,j)=>({id:e.id||uid('ENV'),order:j+1,label:(e.label||`Frasco ${j+1}`).trim(),lot:(e.lot||r.lot||'').trim(),containerType:e.containerType==='SOBRE'?'SOBRE':'FRASCO',tareWeight:Number(e.tareWeight),initialWeight:Number(e.initialWeight),status:e.status||'ACTIVO'})):[];const first=containers[0]||{};return {id:r.id||uid('REA'),order:i+1,name:(r.name||'').trim(),lot:(r.lot||'').trim(),mode:r.mode==='WEIGHT'?'WEIGHT':'COUNT',unit:(r.unit||reagentDefaultUnit(r.mode)).trim(),stockQuantity:r.mode==='WEIGHT'?null:Number(r.stockQuantity),initialWeight:r.mode==='WEIGHT'?Number(first.initialWeight??r.initialWeight):null,physicalState:r.mode==='WEIGHT'?(r.physicalState||'SOLID'):null,density:r.mode==='WEIGHT'&&r.physicalState==='LIQUID'?Number(r.density):null,tareWeight:r.mode==='WEIGHT'?Number(first.tareWeight??r.tareWeight):null,containers,inventoryStatus:r.mode==='COUNT'?(Number(r.stockQuantity)<=0?'AGOTADO':'ACTIVO'):(containers.some(e=>e.status!=='AGOTADO')?'ACTIVO':'AGOTADO')};});
}

const DELETED_PLANNING_CONFIG_KEY='deletedPlanningIdsV1';

async function getDeletedPlanningIds(){
  const rec=await getOne('config',DELETED_PLANNING_CONFIG_KEY);
  return new Set(Array.isArray(rec?.ids)?rec.ids:[]);
}
async function saveDeletedPlanningIds(ids){
  const rec={key:DELETED_PLANNING_CONFIG_KEY,ids:[...ids],updatedAt:nowISO()};
  // Tombstone LOCAL: evita resurrección por snapshots atrasados mientras el DELETE de
  // planning se confirma en Firestore. La eliminación remota se sincroniza por planning.
  await put('config',rec)
}
async function markPlanningDeleted(id){
  const ids=await getDeletedPlanningIds();
  ids.add(id);
  await saveDeletedPlanningIds(ids);
}
async function unmarkPlanningDeleted(id){
  const ids=await getDeletedPlanningIds();
  if(ids.delete(id))await saveDeletedPlanningIds(ids);
}
async function purgeDeletedPlanningLocally(){
  const ids=await getDeletedPlanningIds();
  if(!ids.size)return;
  const plans=await getAll('planning');
  for(const p of plans){
    if(ids.has(p.id))await del('planning',p.id);
  }
}
async function isPlanningDeleted(id){
  const ids=await getDeletedPlanningIds();
  return ids.has(id);
}
async function visiblePlanningRows(rows=null){
  const plans=rows||await getAll('planning');
  const deleted=await getDeletedPlanningIds();
  const byId=new Map();
  for(const p of plans){
    if(!p?.id||deleted.has(p.id))continue;
    const prev=byId.get(p.id);
    const pt=Date.parse(p.updatedAt||p.createdAt||0)||0,qt=prev?(Date.parse(prev.updatedAt||prev.createdAt||0)||0):-1;
    if(!prev||pt>=qt)byId.set(p.id,p);
  }
  return [...byId.values()];
}

function planHasReagents(p){return Array.isArray(p?.reagentConfig)&&p.reagentConfig.length>0}

let editingCalibrationPoints=[];

function normalizeCalibrationPoint(v){
  const n=Number(String(v).replace(',','.'));
  return Number.isFinite(n)?n:null;
}
function activityLooksLikeCalibration(name=''){
  const t=normalizeIdentityText(name);
  return t.includes('curva')&&t.includes('calibracion');
}
function renderCalibrationPointRows(){
  const box=$('#calibrationPointRows');if(!box)return;
  box.innerHTML=editingCalibrationPoints.map((p,i)=>`
    <div class="calibration-point-row">
      <div class="point-index">P${i+1}</div>
      <label>Concentración<input type="number" step="any" value="${p.concentration??''}" data-cal-point="${i}" placeholder="Ej. 0.50"></label>
      <button type="button" class="icon-btn" data-remove-cal-point="${i}">×</button>
    </div>`).join('');
  $$('[data-cal-point]').forEach(el=>el.oninput=()=>{editingCalibrationPoints[Number(el.dataset.calPoint)].concentration=el.value;validateCalibrationConfig()});
  $$('[data-remove-cal-point]').forEach(el=>el.onclick=()=>{editingCalibrationPoints.splice(Number(el.dataset.removeCalPoint),1);renderCalibrationPointRows()});
  validateCalibrationConfig();
}
function addCalibrationPoint(){
  editingCalibrationPoints.push({concentration:''});
  renderCalibrationPointRows();
}
function updateCalibrationEditor(){
  const section=$('#catalogSection')?.value||'';
  const editor=$('#calibrationEditor');
  if(!editor)return;
  const allowed=section==='ACTIVIDADES_LABORATORIO';
  editor.classList.toggle('hidden',!allowed);
  if(!allowed){
    $('#catalogRequiresCalibration').checked=false;
    $('#calibrationConfigBody').classList.add('hidden');
    return;
  }
  const enabled=$('#catalogRequiresCalibration').checked;
  $('#calibrationConfigBody').classList.toggle('hidden',!enabled);
  if(enabled)renderCalibrationPointRows();
}
function validateCalibrationConfig(){
  const el=$('#calibrationValidation');if(!el)return {level:'OK',text:''};
  if(!$('#catalogRequiresCalibration')?.checked){el.textContent='';el.className='inline-alert';return {level:'OK',text:''}}
  const unit=$('#calibrationUnit').value.trim();
  const nums=editingCalibrationPoints.map(p=>normalizeCalibrationPoint(p.concentration));
  let out;
  if(!unit)out={level:'ERROR',text:'Ingrese la unidad de concentración de la curva.'};
  else if(nums.length<2)out={level:'ERROR',text:'La curva debe tener al menos 2 puntos.'};
  else if(nums.some(v=>v===null))out={level:'ERROR',text:'Todos los puntos deben tener una concentración numérica.'};
  else if(new Set(nums.map(String)).size!==nums.length)out={level:'ERROR',text:'No repita concentraciones dentro de la misma curva.'};
  else {const reps=Math.max(1,Math.min(10,Number($('#calibrationReplicates')?.value||3)));out={level:'OK',text:`Curva configurada: ${nums.length} puntos · ${reps} réplica${reps===1?'':'s'} por punto · ${unit}.`};}
  el.textContent=out.text;el.className='inline-alert '+out.level.toLowerCase();return out;
}
function calibrationConfigFromForm(){
  return {
    enabled:!!$('#catalogRequiresCalibration')?.checked,
    unit:$('#calibrationUnit')?.value.trim()||'',
    replicates:Math.max(1,Math.min(10,Number($('#calibrationReplicates')?.value||3))),
    points:editingCalibrationPoints.map((p,i)=>({order:i+1,concentration:normalizeCalibrationPoint(p.concentration)}))
  };
}
function openCatalog(){setCatalogSectionOptions();$('#catalogForm').reset();$('#catalogId').value='';$('#catalogSection').value=currentSection;$('#catalogStatus').value='ACTIVO';$('#catalogTimeMode').value=['RECEPCION_MUESTRAS','MICROBIOLOGIA','AASS'].includes(currentSection)?'COMPOSITE':currentSection==='ENSAYOS_ANALITICOS'?'BY_SAMPLES':'FIXED';editingRules=[];editingSteps=[];editingCalibrationPoints=[];editingReagents=[];$('#catalogUsesReagents').checked=false;$('#catalogRequiresCalibration').checked=false;$('#calibrationUnit').value='';$('#calibrationReplicates').value=3;if(currentSection==='RECEPCION_MUESTRAS')setDurationPicker(300);else if(['MICROBIOLOGIA','AASS'].includes(currentSection))setDurationPicker(0);$('#catalogDialogTitle').textContent='Nuevo elemento';updateCatalogForm();updateCalibrationEditor();updateReagentEditor();$('#catalogDialog').showModal()}
function timeRuleKey(r){return `${Number(r.minSamples)}|${Number(r.maxSamples)}|${Number(r.minutes)}`}
async function loadCleanTimeRules(catalogId){
  const all=(await getAll('timeRules')).filter(r=>r.catalogId===catalogId).sort((a,b)=>Number(a.minSamples)-Number(b.minSamples)||Number(a.maxSamples)-Number(b.maxSamples));
  const seen=new Set(),clean=[],dups=[];
  for(const r of all){const k=timeRuleKey(r);if(seen.has(k))dups.push(r);else{seen.add(k);clean.push(r)}}
  // V1.0.5.6.11: elimina duplicados exactos heredados también de Firestore.
  for(const r of dups){await del('timeRules',r.id);await queue('DELETE','timeRules',{id:r.id})}
  return clean;
}
async function liveReagentConfigForEditor(config){
  await reconcileInventoryFromConfirmedHistory();
  await buildReagentMasterProfiles();
  const master=new Map(reagentMasterProfiles.map(x=>[x.key,x.profile]));
  return (config||[]).map(raw=>{
    const key=`${normalizeIdentityText(raw.name||'')}|${normalizeIdentityText(raw.lot||'')}`;
    const live=master.get(key); if(!live)return null; // agotado: desaparece también del cuadro principal
    const r=cloneReagentProfile(live);
    if(r.mode==='WEIGHT'&&Array.isArray(r.containers)){
      r.containers=r.containers.filter(e=>e.status!=='AGOTADO'&&Number(e.initialWeight)>Number(e.tareWeight)+0.000001);
      if(!r.containers.length)return null;
      const first=r.containers[0];r.initialWeight=first.initialWeight;r.tareWeight=first.tareWeight;r.inventoryStatus='ACTIVO';
    }
    if(r.mode==='COUNT'&&(r.inventoryStatus==='AGOTADO'||Number(r.stockQuantity)<=0))return null;
    r._autofilled=true;r._masterSource='inventario vivo';return r;
  }).filter(Boolean);
}
async function editCatalog(id){await reconcileInventoryFromConfirmedHistory();const all=await getAll('catalog'),x=all.find(r=>r.id===id);if(!x)return;setCatalogSectionOptions();$('#catalogId').value=x.id;$('#catalogSection').value=x.section;$('#catalogName').value=x.name;$('#catalogFamily').value=x.family||'';$('#catalogTimeMode').value=x.timeMode||'FIXED';setDurationPicker(x.section==='RECEPCION_MUESTRAS'?300:(x.baseMinutes||0));$('#catalogStatus').value=x.status;$('#catalogDescription').value=x.description||'';editingRules=(await loadCleanTimeRules(id)).map(r=>({...r}));editingSteps=(await getAll('compositeSteps')).filter(r=>r.catalogId===id).sort((a,b)=>a.order-b.order).map(r=>({...r}));const cc=x.calibrationConfig||{};$('#catalogRequiresCalibration').checked=!!cc.enabled;$('#calibrationUnit').value=cc.unit||'';$('#calibrationReplicates').value=Math.max(1,Number(cc.replicates||3));editingCalibrationPoints=(cc.points||[]).sort((a,b)=>(a.order||0)-(b.order||0)).map(p=>({concentration:p.concentration}));editingReagents=(await liveReagentConfigForEditor((x.reagentConfig||[]).sort((a,b)=>(a.order||0)-(b.order||0)))).map(r=>({...r,physicalState:r.mode==='WEIGHT'?(r.physicalState||'SOLID'):null,density:r.density??null,tareWeight:r.tareWeight??null,containers:Array.isArray(r.containers)&&r.containers.length?r.containers.map(e=>({...e})):[]}));editingReagents.forEach(r=>{if(r.mode==='WEIGHT')dedupeReagentContainers(r)});$('#catalogUsesReagents').checked=sectionAllowsReagents(x.section)&&editingReagents.length>0;if(x.section==='ACTIVIDADES_LABORATORIO'&&activityLooksLikeCalibration(x.name)&&!cc.enabled){$('#catalogRequiresCalibration').checked=true;if(!editingCalibrationPoints.length)editingCalibrationPoints=[{concentration:''},{concentration:''},{concentration:''}];}$('#catalogDialogTitle').textContent='Editar elemento';updateCatalogForm();updateCalibrationEditor();updateReagentEditor();$('#catalogDialog').showModal()}
function addRule(){editingRules.push({id:uid('TMP'),minSamples:'',maxSamples:'',minutes:''});renderRuleRows();updateCalibrationEditor()}
function splitMinutes(total){const n=Math.max(0,Number(total||0));return {hours:Math.floor(n/60),minutes:n%60}}
function setDurationPicker(total){const d=splitMinutes(total);$('#catalogBaseHours').value=d.hours;$('#catalogBaseMinutePart').value=String(d.minutes)}
function getDurationPicker(){return Number($('#catalogBaseHours').value||0)*60+Number($('#catalogBaseMinutePart').value||0)}
function renderRuleRows(){const box=$('#ruleRows');box.innerHTML=editingRules.map((r,i)=>{const d=splitMinutes(r.minutes);return `<div class="rule-row"><label>Desde muestras<input type="number" min="1" value="${r.minSamples??''}" data-rule="${i}" data-field="minSamples"></label><label>Hasta muestras<input type="number" min="1" value="${r.maxSamples??''}" data-rule="${i}" data-field="maxSamples"></label><label>Horas<input type="number" min="0" max="24" step="1" value="${d.hours}" data-rule-hours="${i}"></label><label>Minutos<select data-rule-minutes="${i}">${[0,5,10,15,20,25,30,35,40,45,50,55].map(m=>`<option value="${m}" ${m===d.minutes?'selected':''}>${String(m).padStart(2,'0')} min</option>`).join('')}</select></label><button type="button" class="remove-rule" data-remove-rule="${i}">Eliminar</button></div>`}).join('');$$('[data-rule]').forEach(inp=>inp.oninput=()=>{editingRules[+inp.dataset.rule][inp.dataset.field]=inp.value===''?'':Number(inp.value);validateRuleDraft()});const syncDuration=i=>{const h=Number($(`[data-rule-hours="${i}"]`).value||0),m=Number($(`[data-rule-minutes="${i}"]`).value||0);editingRules[i].minutes=h*60+m;validateRuleDraft()};$$('[data-rule-hours]').forEach(inp=>inp.oninput=()=>syncDuration(+inp.dataset.ruleHours));$$('[data-rule-minutes]').forEach(sel=>sel.onchange=()=>syncDuration(+sel.dataset.ruleMinutes));$$('[data-remove-rule]').forEach(b=>b.onclick=()=>{editingRules.splice(+b.dataset.removeRule,1);renderRuleRows()});validateRuleDraft()}
function validateRules(rules){if(!rules.length)return {level:'ERROR',text:'Debe crear al menos un rango de muestras.'};const arr=rules.map(r=>({min:Number(r.minSamples),max:Number(r.maxSamples),minutes:Number(r.minutes)})).sort((a,b)=>a.min-b.min);if(arr.some(r=>!r.min||!r.max||!r.minutes||r.max<r.min))return {level:'ERROR',text:'Hay rangos incompletos o con valores inválidos.'};for(let i=1;i<arr.length;i++){if(arr[i].min<=arr[i-1].max)return {level:'ERROR',text:`Rangos superpuestos: ${arr[i-1].min}-${arr[i-1].max} y ${arr[i].min}-${arr[i].max}.`};if(arr[i].min>arr[i-1].max+1)return {level:'WARNING',text:`Existe un hueco entre ${arr[i-1].max} y ${arr[i].min} muestras.`}}return {level:'OK',text:'Rangos continuos y sin superposición.'}}
function addStep(){editingSteps.push({id:uid('TMPSTEP'),name:'',minutes:30});renderStepRows()}
function compositeTarget(){return $('#catalogSection').value==='RECEPCION_MUESTRAS'?300:getDurationPicker()}
function renderStepRows(){const box=$('#stepRows');if(!box)return;box.innerHTML=editingSteps.map((s,i)=>{const d=splitMinutes(s.minutes);return `<div class="step-row"><div class="step-order">${i+1}</div><label>Detalle / subactividad<input value="${escapeHtml(s.name||'')}" data-step="${i}" data-step-field="name" placeholder="Ej. Revisión de condiciones"></label><label>Horas<input type="number" min="0" max="8" step="1" value="${d.hours}" data-step-hours="${i}"></label><label>Minutos<select data-step-minutes="${i}">${[0,5,10,15,20,25,30,35,40,45,50,55].map(m=>`<option value="${m}" ${m===d.minutes?'selected':''}>${String(m).padStart(2,'0')} min</option>`).join('')}</select></label><button type="button" class="icon-btn" data-remove-step="${i}">×</button></div>`}).join('');$$('[data-step-field]').forEach(el=>el.oninput=()=>{editingSteps[Number(el.dataset.step)][el.dataset.stepField]=el.value;validateSteps()});$$('[data-step-hours]').forEach(el=>el.oninput=()=>{const i=Number(el.dataset.stepHours),mins=Number($(`[data-step-minutes="${i}"]`).value||0);editingSteps[i].minutes=Number(el.value||0)*60+mins;validateSteps()});$$('[data-step-minutes]').forEach(el=>el.onchange=()=>{const i=Number(el.dataset.stepMinutes),hrs=Number($(`[data-step-hours="${i}"]`).value||0);editingSteps[i].minutes=hrs*60+Number(el.value||0);validateSteps()});$$('[data-remove-step]').forEach(el=>el.onclick=()=>{editingSteps.splice(Number(el.dataset.removeStep),1);renderStepRows()});validateSteps()}
function validateSteps(){const el=$('#stepValidation');if(!el||$('#catalogTimeMode').value!=='COMPOSITE'){if(el)el.textContent='';return {level:'OK',text:''}}const target=compositeTarget(),sum=editingSteps.reduce((a,s)=>a+Number(s.minutes||0),0),missing=editingSteps.some(s=>!String(s.name||'').trim()||!Number(s.minutes));$('#compositeTotalLabel').textContent=minutesText(target);const diff=target-sum;$('#compositeProgress').textContent=diff===0?'Desglose completo':diff>0?`Faltan ${minutesText(diff)} por distribuir`:`Excede por ${minutesText(Math.abs(diff))}`;let out;if(!editingSteps.length)out={level:'ERROR',text:'Agregue al menos un detalle para esta actividad compuesta.'};else if(missing)out={level:'ERROR',text:'Cada detalle debe tener nombre y duración.'};else if(sum!==target)out={level:'ERROR',text:`El desglose suma ${minutesText(sum)} y debe sumar exactamente ${minutesText(target)}.`};else out={level:'OK',text:`Desglose válido: ${editingSteps.length} detalle(s), total ${minutesText(target)}.`};el.textContent=out.text;el.className='inline-alert '+out.level.toLowerCase();return out}
function validateRuleDraft(){const el=$('#ruleValidation');if($('#catalogTimeMode').value!=='BY_SAMPLES'){el.textContent='';return}const v=validateRules(editingRules);el.textContent=v.text;el.className='inline-alert '+v.level.toLowerCase()}

function cloneJson(v){return v==null?v:JSON.parse(JSON.stringify(v))}
function mergeOpenPlanReagentConfig(plan,latestConfig){
  const latest=Array.isArray(latestConfig)?cloneJson(latestConfig):[];
  const old=Array.isArray(plan?.reagentConfig)?plan.reagentConfig:[];
  const resultItems=Array.isArray(plan?.reagentResult?.items)?plan.reagentResult.items:[];
  const usedIds=new Set(resultItems.map(x=>x?.reagentId).filter(Boolean));
  const latestIds=new Set(latest.map(x=>x?.id).filter(Boolean));
  // Si ya hubo captura parcial de un reactivo que después se retiró del catálogo,
  // se conserva en la actividad para no romper la trazabilidad de lo ya registrado.
  for(const r of old){
    if(r?.id && usedIds.has(r.id) && !latestIds.has(r.id))latest.push(cloneJson(r));
  }
  return latest.map((r,i)=>({...r,order:i+1}));
}
async function propagateCatalogTechnicalConfigToOpenPlans(catalogRec){
  const plans=await visiblePlanningRows();
  const targets=plans.filter(p=>p.catalogId===catalogRec.id && !['REALIZADO','CANCELADO'].includes(p.status));
  let changed=0;
  for(const p of targets){
    const nextCalibration=catalogRec.calibrationConfig?.enabled?cloneJson(catalogRec.calibrationConfig):null;
    const nextReagents=mergeOpenPlanReagentConfig(p,catalogRec.reagentConfig||[]);
    const before=JSON.stringify({c:p.calibrationConfig||null,r:p.reagentConfig||[]});
    const after=JSON.stringify({c:nextCalibration,r:nextReagents});
    if(before===after)continue;
    p.calibrationConfig=nextCalibration;
    p.reagentConfig=nextReagents;
    p.catalogConfigSyncedAt=nowISO();
    p.catalogConfigVersionAt=catalogRec.updatedAt;
    p.updatedAt=nowISO();
    await put('planning',p);
    await queue('UPDATE','planning',p);
    changed++;
  }
  if(changed){
    await audit('ACTUALIZAR_CONFIG_TECNICA_PLANIFICADA','CATALOGO_MAESTRO',catalogRec.code,`${changed} actividad(es) PROGRAMADA(S)/EN PROCESO actualizadas con la configuración vigente de curva/reactivos`);
  }
  return changed;
}

async function saveCatalog(ev){ev.preventDefault();const id=$('#catalogId').value,section=$('#catalogSection').value,name=$('#catalogName').value.trim(),family=$('#catalogFamily').value.trim(),timeMode=$('#catalogTimeMode').value,baseMinutes=section==='RECEPCION_MUESTRAS'&&timeMode==='COMPOSITE'?300:getDurationPicker();if(!section||!name)return toast('Complete sección y nombre');if(['FIXED','COMPOSITE'].includes(timeMode)&&!baseMinutes)return toast('Ingrese la duración estándar');if(timeMode==='BY_SAMPLES'){const v=validateRules(editingRules);if(v.level==='ERROR')return toast(v.text)}if(timeMode==='COMPOSITE'){const v=validateSteps();if(v.level==='ERROR')return toast(v.text)}if($('#catalogRequiresCalibration')?.checked){const v=validateCalibrationConfig();if(v.level==='ERROR')return toast(v.text)}if(sectionAllowsReagents(section)&&$('#catalogUsesReagents')?.checked){const v=validateReagents();if(v.level==='ERROR')return toast(v.text)}const all=await getAll('catalog');const duplicate=all.find(x=>x.id!==id&&x.section===section&&x.name.trim().toLowerCase()===name.toLowerCase()&&(x.family||'').trim().toLowerCase()===family.toLowerCase());if(duplicate)return toast('Ya existe el mismo elemento en esta sección y clasificación');const existing=id?all.find(x=>x.id===id):null;const rec={id:id||uid('CAT'),code:existing?.code||nextCode(section,all),section,name,family,timeMode,baseMinutes:['FIXED','COMPOSITE'].includes(timeMode)?baseMinutes:null,description:$('#catalogDescription').value.trim(),calibrationConfig:calibrationConfigFromForm(),reagentConfig:reagentConfigFromForm(),status:$('#catalogStatus').value,createdAt:existing?.createdAt||nowISO(),updatedAt:nowISO()};await put('catalog',rec);const oldRules=(await getAll('timeRules')).filter(r=>r.catalogId===rec.id);for(const r of oldRules){await del('timeRules',r.id);await queue('DELETE','timeRules',{id:r.id})}if(timeMode==='BY_SAMPLES'){const seenRuleKeys=new Set();for(const r of editingRules){const key=timeRuleKey(r);if(seenRuleKeys.has(key))continue;seenRuleKeys.add(key);const ruleRec={id:uid('TR'),catalogId:rec.id,minSamples:Number(r.minSamples),maxSamples:Number(r.maxSamples),minutes:Number(r.minutes),createdAt:nowISO(),updatedAt:nowISO()};await put('timeRules',ruleRec);await queue('CREATE','timeRules',ruleRec)}}const oldSteps=(await getAll('compositeSteps')).filter(r=>r.catalogId===rec.id);for(const st of oldSteps){await del('compositeSteps',st.id);await queue('DELETE','compositeSteps',{id:st.id})}if(timeMode==='COMPOSITE'){for(let i=0;i<editingSteps.length;i++){const st=editingSteps[i];const stepRec={id:uid('STEP'),catalogId:rec.id,order:i+1,name:String(st.name).trim(),minutes:Number(st.minutes),createdAt:nowISO(),updatedAt:nowISO()};await put('compositeSteps',stepRec);await queue('CREATE','compositeSteps',stepRec)}}await queue(id?'UPDATE':'CREATE','catalog',rec);const propagated=id?await propagateCatalogTechnicalConfigToOpenPlans(rec):0;await audit(id?'EDITAR':'CREAR','CATALOGO_MAESTRO',rec.code,`${sectionMeta(section).label}: ${name}${family?` · ${family}`:''}${timeMode==='COMPOSITE'?` · bloque ${minutesText(baseMinutes)} con ${editingSteps.length} detalles`:''}`);currentSection=section;$('#catalogDialog').close();toast(id?(propagated?`Elemento actualizado · ${propagated} actividad(es) abierta(s) sincronizada(s)`:'Elemento actualizado'):'Elemento creado');await refreshAll();renderSectionTabs();
if(plannerCatalogReturn&&!id){
  const keep=plannerCatalogReturn;plannerCatalogReturn=null;
  switchView('planificador');
  $('#planSection').value=rec.section;
  $('#planActivitySearch').value='';
  await renderPlanSelectors();
  $('#planCatalog').value=rec.id;
  if(keep.date)$('#planDate').value=keep.date;
  if(keep.analystId)$('#planAnalyst').value=keep.analystId;
  if(keep.notes)$('#planNotes').value=keep.notes;
  if(keep.samples)$('#planSamples').value=keep.samples;
  await smartPlannerRecalculate();
  toast(`Actividad creada y seleccionada: ${rec.name}`);
}}
async function toggleCatalog(id){const all=await getAll('catalog'),x=all.find(r=>r.id===id);if(!x)return;x.status=x.status==='ACTIVO'?'INACTIVO':'ACTIVO';x.updatedAt=nowISO();await put('catalog',x);await queue('UPDATE','catalog',x);await audit('CAMBIAR_ESTADO','CATALOGO_MAESTRO',x.code,`${x.name}: ${x.status}`);toast(`Estado: ${x.status}`);await refreshAll()}
function renderCompetencyChecks(selected=[]){$('#competencyChecks').innerHTML=SECTIONS.map(s=>`<label><input type="checkbox" value="${s.id}" ${selected.includes(s.id)?'checked':''}> ${s.label}</label>`).join('')}
async function renderAnalysts(){let data=await getAll('analysts');const q=$('#analystSearch').value.trim().toLowerCase();data=data.filter(x=>!q||`${x.code} ${x.name} ${x.role||''}`.toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name,'es'));$('#analystEmpty').classList.toggle('hidden',data.length>0);$('#analystTableWrap').classList.toggle('hidden',data.length===0);$('#analystBody').innerHTML=data.map(x=>`<tr><td><b>${x.code}</b></td><td><b>${escapeHtml(x.name)}</b></td><td>${escapeHtml(x.role||'—')}</td><td>${x.dailyHours||8} h</td><td>${(x.competencies||[]).map(c=>`<span class="badge">${sectionMeta(c).label}</span>`).join(' ')||'—'}</td><td><span class="badge ${x.status==='ACTIVO'?'good':'off'}">${x.status}</span></td><td class="row-actions"><button data-edit-analyst="${x.id}">Editar</button></td></tr>`).join('');$$('[data-edit-analyst]').forEach(b=>b.onclick=()=>editAnalyst(b.dataset.editAnalyst))}
async function openAnalyst(){const defaultHours=(await getOne('config','dayHours'))?.value||8;$('#analystForm').reset();$('#analystId').value='';$('#analystHours').value=defaultHours;$('#analystStatus').value='ACTIVO';renderCompetencyChecks([]);$('#analystDialogTitle').textContent='Nuevo analista';$('#analystDialog').showModal()}
async function editAnalyst(id){const x=(await getAll('analysts')).find(r=>r.id===id);if(!x)return;$('#analystId').value=x.id;$('#analystName').value=x.name;$('#analystRole').value=x.role||'';$('#analystHours').value=x.dailyHours||8;$('#analystStatus').value=x.status;$('#analystNotes').value=x.notes||'';renderCompetencyChecks(x.competencies||[]);$('#analystDialogTitle').textContent='Editar analista';$('#analystDialog').showModal()}
async function saveAnalyst(ev){ev.preventDefault();const id=$('#analystId').value,name=$('#analystName').value.trim();if(!name)return toast('Ingrese el nombre del analista');const all=await getAll('analysts');const dup=all.find(x=>x.id!==id&&x.name.trim().toLowerCase()===name.toLowerCase());if(dup)return toast('Ese analista ya existe');const existing=id?all.find(x=>x.id===id):null,competencies=$$('#competencyChecks input:checked').map(x=>x.value);const rec={id:id||uid('ANA'),code:existing?.code||`ANA-${String(all.length+1).padStart(4,'0')}`,name,role:$('#analystRole').value.trim(),dailyHours:Number($('#analystHours').value||8),status:$('#analystStatus').value,competencies,notes:$('#analystNotes').value.trim(),createdAt:existing?.createdAt||nowISO(),updatedAt:nowISO()};await put('analysts',rec);await queue(id?'UPDATE':'CREATE','analysts',rec);await audit(id?'EDITAR':'CREAR','ANALISTAS',rec.code,`${name} · ${competencies.length} competencias`);$('#analystDialog').close();toast(id?'Analista actualizado':'Analista creado');await refreshAll()}
async function analyzeData(render=true){const [cat,rules,steps,ana]=await Promise.all([getAll('catalog'),getAll('timeRules'),getAll('compositeSteps'),getAll('analysts')]);const findings=[];const active=cat.filter(x=>x.status==='ACTIVO');for(const x of active){if(x.timeMode==='FIXED'&&!Number(x.baseMinutes))findings.push({level:'ERROR',title:`${x.code} · ${x.name}`,detail:'Tiene modelo de tiempo fijo pero no tiene duración estándar.'});if(x.timeMode==='BY_SAMPLES'){const rr=rules.filter(r=>r.catalogId===x.id);const v=validateRules(rr);if(v.level!=='OK')findings.push({level:v.level,title:`${x.code} · ${x.name}`,detail:v.text});else findings.push({level:'OK',title:`${x.code} · ${x.name}`,detail:`${rr.length} rango(s) válidos y sin superposición.`})}if(x.timeMode==='COMPOSITE'){const ss=steps.filter(s=>s.catalogId===x.id),sum=ss.reduce((a,s)=>a+Number(s.minutes||0),0),target=Number(x.baseMinutes||0);if(!ss.length||sum!==target)findings.push({level:'ERROR',title:`${x.code} · ${x.name}`,detail:`Actividad compuesta incompleta: el desglose suma ${minutesText(sum)} y debe sumar ${minutesText(target)}.`});else findings.push({level:'OK',title:`${x.code} · ${x.name}`,detail:`Bloque compuesto correcto: ${ss.length} detalle(s), total ${minutesText(target)}.`})}}
  const seen=new Map();for(const x of active){const k=`${x.section}|${(x.family||'').trim().toLowerCase()}|${x.name.trim().toLowerCase()}`;if(seen.has(k))findings.push({level:'ERROR',title:`Posible duplicado: ${x.name}`,detail:`Coincide con ${seen.get(k)} dentro de ${sectionMeta(x.section).label}.`});else seen.set(k,x.code)}
  for(const a of ana.filter(x=>x.status==='ACTIVO')){if(!(a.competencies||[]).length)findings.push({level:'WARNING',title:`${a.code} · ${a.name}`,detail:'Analista activo sin competencias configuradas; el futuro Planificador no podrá recomendarlo correctamente.'});else findings.push({level:'OK',title:`${a.code} · ${a.name}`,detail:`Tiene ${a.competencies.length} sección(es) autorizada(s).`})}
  if(!active.length)findings.push({level:'WARNING',title:'Catálogo todavía vacío',detail:'Cree sus actividades y ensayos desde cero. Esto es esperado al inicio de A2.'});if(!ana.length)findings.push({level:'WARNING',title:'Sin analistas',detail:'Agregue los analistas cuando esté listo para preparar las futuras asignaciones.'});
  if(render){const err=findings.filter(x=>x.level==='ERROR').length,warn=findings.filter(x=>x.level==='WARNING').length,ok=findings.filter(x=>x.level==='OK').length,total=Math.max(1,err+warn+ok),score=Math.max(0,Math.round((ok/(total))*100));$('#smartErrors').textContent=err;$('#smartWarnings').textContent=warn;$('#smartOk').textContent=ok;$('#smartScore').textContent=`${score}%`;$('#smartResults').innerHTML=findings.map(f=>`<div class="finding ${f.level.toLowerCase()}"><div class="level">${f.level}</div><div><b>${escapeHtml(f.title)}</b><small>${escapeHtml(f.detail)}</small></div></div>`).join('')||'<div class="empty"><h4>Sin hallazgos</h4></div>'}
  return findings}
async function renderAudit(){let data=await getAll('audit');data.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));$('#auditEmpty').classList.toggle('hidden',data.length>0);$('#auditTableWrap').classList.toggle('hidden',data.length===0);$('#auditBody').innerHTML=data.map(x=>`<tr><td>${fmtDate(x.createdAt)}</td><td>${escapeHtml(x.user||'')}</td><td><b>${x.action}</b></td><td>${x.module}</td><td>${x.recordId}</td><td>${escapeHtml(x.detail||'')}</td></tr>`).join('')}
async function loadConfig(){$('#cfgLab').value=(await getOne('config','labName'))?.value||'';$('#cfgUser').value=(await getOne('config','defaultUser'))?.value||'';$('#cfgDayHours').value=(await getOne('config','dayHours'))?.value||8}

async function controlChartMethodOptions(section){
  const catalog=(await getAll('catalog')).filter(x=>x.status==='ACTIVO'&&x.section===section);
  const steps=await getAll('compositeSteps');
  const rows=[];
  for(const c of catalog){
    rows.push({id:`CAT:${c.id}`,name:c.name,source:'CATALOGO',catalogId:c.id,label:c.family?`${c.name} · ${c.family}`:c.name});
    if(['AASS','MICROBIOLOGIA','RECEPCION_MUESTRAS'].includes(section)){
      for(const st of steps.filter(x=>x.catalogId===c.id)) rows.push({id:`STEP:${c.id}:${st.id}`,name:st.name,source:'SUBACTIVIDAD',catalogId:c.id,stepId:st.id,label:`${st.name} · ${c.name}`});
    }
  }
  const seen=new Set();return rows.filter(x=>{const k=normalizeIdentityText(x.name);if(seen.has(k))return false;seen.add(k);return true});
}
async function refreshChartMethodOptions(selected=''){
  const sel=$('#chartDefMethodSelect'), custom=$('#chartDefMethod');if(!sel||!custom)return;
  const section=$('#chartDefSection').value, opts=await controlChartMethodOptions(section);
  sel.innerHTML='<option value="">Seleccione ensayo / método configurado…</option>'+opts.map(x=>`<option value="${escapeHtml(x.id)}" data-name="${escapeHtml(x.name)}">${escapeHtml(x.label)}</option>`).join('')+'<option value="CUSTOM">Otro / método manual…</option>';
  const match=opts.find(x=>normalizeIdentityText(x.name)===normalizeIdentityText(selected));
  if(match){sel.value=match.id;custom.value=match.name;custom.closest('label').classList.add('hidden')}else if(selected){sel.value='CUSTOM';custom.value=selected;custom.closest('label').classList.remove('hidden')}else{custom.value='';custom.closest('label').classList.add('hidden')}
}
function transversalControlKey(d){
  if(!d||d.linkMode!=='TRANSVERSAL')return '';
  // 6.33.20.1: identidad funcional, NO solo equipo.
  // Un mismo equipo puede tener cartas distintas (p.ej. EI-227 pesaje y EI-227 condiciones ambientales).
  const equipment=normalizeIdentityText(String(d.equipmentKey||'')).replace(/\s+/g,'-');
  const purpose=normalizeIdentityText(String(d.name||d.controlType||d.methodName||'')).replace(/\s+/g,'-');
  return [equipment||'SIN-EQUIPO',purpose||'SIN-PROPOSITO'].join('::');
}
function stableTextHash(text){let h=2166136261;for(const ch of String(text)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0).toString(36).toUpperCase()}
function exactTransversalDuplicate(a,b){
  if(!a||!b||a.linkMode!=='TRANSVERSAL'||b.linkMode!=='TRANSVERSAL')return false;
  return transversalControlKey(a)===transversalControlKey(b);
}
async function dedupeControlChartDefs(){
  // 6.33.20.1: la visualización NUNCA elimina ni fusiona definiciones.
  // La deduplicación destructiva anterior podía borrar una carta válida cuando dos controles
  // diferentes compartían el mismo equipo. La persistencia queda gobernada por Firebase + ID.
  return 0;
}
async function consolidateRecoveredBalanceDefs(){
  // 6.33.21.2: consolidación segura de recuperaciones EI-227.
  // Conserva UNA definición canónica (prioridad: la que tenga más registros reales),
  // reasocia la trazabilidad de pesaje a esa definición y archiva las recuperaciones sobrantes.
  // No elimina registros ni definiciones de Firestore.
  if(currentSessionUser?.role!=='JEFE')return 0;
  const [defs,records]=await Promise.all([getAll('controlChartDefs'),getAll('controlChartRecords')]);
  const balanceDefs=defs.filter(d=>!d.archivedDuplicate&&isBalanceChart(d));
  const recovered=balanceDefs.filter(d=>d.recoveredFromRecords||String(d.code||'').startsWith('CC-RECUPERADA'));
  if(recovered.length<2)return 0;
  const balanceRecords=records.filter(r=>r.controlType==='BALANZA_MULTIPUNTO');
  const counts=new Map(balanceDefs.map(d=>[d.id,balanceRecords.filter(r=>r.chartId===d.id).length]));
  const candidates=[...balanceDefs].sort((a,b)=>
    (counts.get(b.id)||0)-(counts.get(a.id)||0) ||
    Number(Boolean(a.recoveredFromRecords))-Number(Boolean(b.recoveredFromRecords)) ||
    String(a.createdAt||'').localeCompare(String(b.createdAt||''))
  );
  const canonical=candidates[0];
  if(!canonical)return 0;
  const duplicates=recovered.filter(d=>d.id!==canonical.id);
  if(!duplicates.length)return 0;

  // Unir aplicabilidad sin perder métodos/áreas que quedaron repartidos entre recuperaciones.
  const sec=new Set(canonical.applicableSections||[]), meth=new Map();
  for(const d of [canonical,...duplicates]){
    for(const x of (d.applicableSections||[]))sec.add(x);
    for(const m of (d.applicableMethods||[])){
      const obj=typeof m==='string'?{id:m,name:m}:m;
      const key=normalizeIdentityText(obj.id||obj.name||obj.methodName||'');
      if(key&&!meth.has(key))meth.set(key,obj);
    }
  }
  canonical.applicableSections=[...sec];
  canonical.applicableMethods=[...meth.values()];
  canonical.status='ACTIVO';canonical.archivedDuplicate=false;canonical.recoveredFromRecords=true;
  canonical.notes=String(canonical.notes||'').replace(/\s*\[Consolidada[^\]]*\]/g,'').trim();
  canonical.updatedAt=nowISO();
  await put('controlChartDefs',canonical);await queue('UPDATE','controlChartDefs',canonical);

  let moved=0;
  const duplicateIds=new Set(duplicates.map(d=>d.id));
  for(const r of balanceRecords.filter(r=>duplicateIds.has(r.chartId))){
    r.originalChartId=r.originalChartId||r.chartId;
    r.chartId=canonical.id;r.updatedAt=nowISO();
    await put('controlChartRecords',r);await queue('UPDATE','controlChartRecords',r);moved++;
  }
  for(const d of duplicates){
    d.status='INACTIVO';d.archivedDuplicate=true;d.duplicateOf=canonical.id;d.updatedAt=nowISO();
    d.notes=`${String(d.notes||'').trim()} [Consolidada en ${canonical.code||canonical.id}; oculta para evitar duplicados.]`.trim();
    await put('controlChartDefs',d);await queue('UPDATE','controlChartDefs',d);
  }
  await audit('CONSOLIDAR','CARTAS_CONTROL_CONFIG',canonical.id,`Balanza EI-227: ${duplicates.length} definición(es) recuperada(s) archivada(s); ${moved} registro(s) conservados/reasociados.`);
  toast(`Balanza EI-227 consolidada: queda 1 carta con toda la trazabilidad`);
  return duplicates.length;
}
async function repairOrphanBalanceControlDef(){
  // Recuperación no destructiva: si existen registros históricos de pesaje EI-227
  // pero su definición fue eliminada por una versión anterior, reconstruimos la MISMA
  // definición usando el chartId y los métodos guardados en el snapshot histórico.
  if(currentSessionUser?.role!=='JEFE')return 0;
  const [defs,records]=await Promise.all([getAll('controlChartDefs'),getAll('controlChartRecords')]);
  const defIds=new Set(defs.filter(d=>!d.archivedDuplicate).map(d=>d.id));
  const orphan=records.filter(r=>r.controlType==='BALANZA_MULTIPUNTO'&&r.chartId&&!defIds.has(r.chartId)).sort((a,b)=>String(b.measuredAt||'').localeCompare(String(a.measuredAt||'')))[0];
  if(!orphan)return 0;
  const methodNames=[...new Set((orphan.applicableMethodsSnapshot||[]).filter(Boolean))];
  const methods=methodNames.map((name,i)=>({id:`RECOVERED:${i}:${stableTextHash(name)}`,section:'ENSAYOS_ANALITICOS',name}));
  const rec={id:orphan.chartId,code:'CC-RECUPERADA',name:'Carta de control de balanza',linkMode:'TRANSVERSAL',section:'ENSAYOS_ANALITICOS',methodName:methodNames[0]||'Control transversal de pesaje',applicableSections:['ENSAYOS_ANALITICOS','RECEPCION_MUESTRAS'],applicableMethods:methods,equipmentKey:'EI-227',executionScope:'DAILY_EQUIPMENT',status:'ACTIVO',notes:'Definición recuperada automáticamente desde la trazabilidad histórica de Balanza EI-227. Revisar métodos/áreas y guardar si requiere ajuste.',accessRule:'MULTI_APPLICABILITY',schemaVersion:5,recoveredFromRecords:true,createdAt:orphan.createdAt||nowISO(),updatedAt:nowISO()};
  await put('controlChartDefs',rec);
  await queue('CREATE','controlChartDefs',rec);
  await audit('RECUPERAR','CARTAS_CONTROL_CONFIG',rec.id,'Balanza EI-227 recuperada desde registros históricos; no se eliminaron ni alteraron registros.');
  return 1;
}
async function recoverMissingBalanceEnvironmentDef(){
  // 6.33.25.1: EI-227 Pesaje y EI-285 Condiciones Ambientales son DOS cartas distintas.
  // Recupera la ambiental sin tocar ni fusionar la carta de pesaje ni sus registros.
  if(currentSessionUser?.role!=='JEFE')return 0;
  const [defs,records]=await Promise.all([getAll('controlChartDefs'),getAll('controlChartRecords')]);
  if(defs.some(d=>!d.archivedDuplicate&&isBalanceEnvironmentChart(d)))return 0;
  const archived=defs.find(d=>d.archivedDuplicate&&isBalanceEnvironmentChart(d));
  if(archived){
    archived.archivedDuplicate=false;archived.duplicateOf='';archived.status='ACTIVO';archived.updatedAt=nowISO();
    await put('controlChartDefs',archived);await queue('UPDATE','controlChartDefs',archived);
    await audit('RECUPERAR','CARTAS_CONTROL_CONFIG',archived.id,'Condiciones ambientales de Balanza EI-285 reactivada sin alterar Pesaje EI-227.');
    return 1;
  }
  const hist=records.filter(r=>(r.controlType==='BALANZA_AMBIENTE_EI285'||(r.historicalEntry===true&&r.controlType==='BALANZA_AMBIENTAL'))).sort((a,b)=>String(b.measuredAt||'').localeCompare(String(a.measuredAt||'')))[0];
  const optionRows=await controlChartMethodOptions('ENSAYOS_ANALITICOS');
  const wanted=['Solidos suspendidos totales en aguas','Solidos totales en aguas','Solidos disueltos totales en aguas','Humedad en suelos','Solidos suspendidos volatiles en aguas','Materia organica agua y/o suelos','NTK en aguas y/o suelos ( Tradicional)','Conductividad en suelos y/o lodos','TPH Suelos y/o lodos (solos)'];
  const methods=[];
  for(const name of wanted){const found=optionRows.find(x=>normalizeIdentityText(x.name)===normalizeIdentityText(name));methods.push(found?{id:found.id,section:'ENSAYOS_ANALITICOS',name:found.name}:{id:`RECOVERED:${stableTextHash(name)}`,section:'ENSAYOS_ANALITICOS',name});}
  const candidate={linkMode:'TRANSVERSAL',equipmentKey:'EI-285',name:'Carta de control de condiciones de balanza'};
  const id=hist?.chartId||`CCD-TRANS-${stableTextHash(transversalControlKey(candidate))}`;
  const existingById=defs.find(d=>d.id===id);
  const cfg=hist?.metrologyConfigSnapshot||balanceEnvDefaultConfig();
  const rec={...(existingById||{}),id,code:existingById?.code||'CC-0014',name:'Carta de control de condiciones de balanza',linkMode:'TRANSVERSAL',section:'ENSAYOS_ANALITICOS',methodName:methods[0]?.name||'Condiciones ambientales de balanza',applicableSections:['ENSAYOS_ANALITICOS','RECEPCION_MUESTRAS'],applicableMethods:methods,equipmentKey:'EI-285',executionScope:'DAILY_EQUIPMENT',status:'ACTIVO',notes:'Condiciones ambientales de Balanza EI-285 / PF-09. Definición recuperada de forma independiente al control de pesaje EI-227.',accessRule:'MULTI_APPLICABILITY',schemaVersion:5,recoveredFromRecords:Boolean(hist),metrologyConfig:cfg,archivedDuplicate:false,duplicateOf:'',createdAt:existingById?.createdAt||hist?.createdAt||nowISO(),updatedAt:nowISO()};
  await put('controlChartDefs',rec);await queue(existingById?'UPDATE':'CREATE','controlChartDefs',rec);
  await audit('RECUPERAR','CARTAS_CONTROL_CONFIG',rec.id,`Condiciones ambientales EI-285 recuperada ${hist?'desde trazabilidad histórica':'desde definición técnica protegida'}; Pesaje EI-227 permanece independiente.`);
  return 1;
}
async function normalizeBalanceWeighingIdentity(){
  // Hace inequívoca la carta recuperada de pesaje sin cambiar su ID ni sus registros.
  if(currentSessionUser?.role!=='JEFE')return 0;
  const defs=await getAll('controlChartDefs');
  const d=defs.find(x=>!x.archivedDuplicate&&isBalanceChart(x));if(!d)return 0;
  let changed=false;
  if(normalizeIdentityText(d.name||'')==='carta de control de balanza'){d.name='Carta de control de pesaje Balanza EI-227';changed=true;}
  if(normalizeIdentityText(d.equipmentKey||'')!=='ei 227'){d.equipmentKey='EI-227';changed=true;}
  if(!changed)return 0;
  d.updatedAt=nowISO();await put('controlChartDefs',d);await queue('UPDATE','controlChartDefs',d);
  await audit('NORMALIZAR','CARTAS_CONTROL_CONFIG',d.id,'Identidad aclarada como Pesaje Balanza EI-227; chartId y registros históricos conservados.');
  return 1;
}
async function recoverMissingOven314ControlDef(){
  // 6.33.25: recuperación idempotente/no destructiva de Estufa EI-314.
  // Prioridad: definición visible > definición archivada > chartId histórico > identidad estable conocida.
  if(currentSessionUser?.role!=='JEFE')return 0;
  const [defs,records]=await Promise.all([getAll('controlChartDefs'),getAll('controlChartRecords')]);
  if(defs.some(d=>!d.archivedDuplicate&&isOven314Chart(d)))return 0;
  const archived=defs.find(d=>d.archivedDuplicate&&isOven314Chart(d));
  if(archived){
    archived.archivedDuplicate=false;archived.duplicateOf='';archived.status='ACTIVO';archived.updatedAt=nowISO();
    archived.notes=String(archived.notes||'').replace(/\s*\[Consolidada[^\]]*\]/g,'').trim();
    await put('controlChartDefs',archived);await queue('UPDATE','controlChartDefs',archived);
    await audit('RECUPERAR','CARTAS_CONTROL_CONFIG',archived.id,'Estufa EI-314 reactivada desde definición histórica archivada.');
    return 1;
  }
  const ovenRows=records.filter(r=>r.controlType==='ESTUFA_EI314');
  const historical=ovenRows.slice().sort((a,b)=>String(b.measuredAt||'').localeCompare(String(a.measuredAt||'')))[0];
  const optionRows=await controlChartMethodOptions('ENSAYOS_ANALITICOS');
  const wanted=['Solidos suspendidos totales en aguas','Solidos totales en aguas','Solidos disueltos totales en aguas','Humedad en suelos','Solidos suspendidos volatiles en aguas','Materia organica agua y/o suelos','PH en suelos y/o lodo cretib','Conductividad en suelos y/o lodos'];
  const methods=[];
  for(const name of wanted){
    const found=optionRows.find(x=>normalizeIdentityText(x.name)===normalizeIdentityText(name));
    methods.push(found?{id:found.id,section:'ENSAYOS_ANALITICOS',name:found.name}:{id:`RECOVERED:${stableTextHash(name)}`,section:'ENSAYOS_ANALITICOS',name});
  }
  const candidate={linkMode:'TRANSVERSAL',equipmentKey:'EI-314',name:'Carta de control de estufa EI-314'};
  const id=historical?.chartId||`CCD-TRANS-${stableTextHash(transversalControlKey(candidate))}`;
  const existingById=defs.find(d=>d.id===id);
  const cfg=historical?.metrologyConfigSnapshot||oven314DefaultConfig();
  const rec={...(existingById||{}),id,code:existingById?.code||'CC-0015',name:'Carta de control de estufa EI-314',linkMode:'TRANSVERSAL',section:'ENSAYOS_ANALITICOS',methodName:methods[0].name,applicableSections:['ENSAYOS_ANALITICOS'],applicableMethods:methods,equipmentKey:'EI-314',executionScope:'DAILY_EQUIPMENT',status:'ACTIVO',notes:'Definición Estufa EI-314 recuperada de forma no destructiva. Conserva criterios, corrección metrológica y trazabilidad histórica.',accessRule:'MULTI_APPLICABILITY',schemaVersion:5,recoveredFromRecords:Boolean(historical),metrologyConfig:cfg,archivedDuplicate:false,duplicateOf:'',createdAt:existingById?.createdAt||historical?.createdAt||nowISO(),updatedAt:nowISO()};
  await put('controlChartDefs',rec);await queue(existingById?'UPDATE':'CREATE','controlChartDefs',rec);
  await audit('RECUPERAR','CARTAS_CONTROL_CONFIG',rec.id,`Estufa EI-314 recuperada ${historical?'desde trazabilidad histórica':'desde definición técnica protegida'}; sin eliminar registros.`);
  return 1;
}
// 6.33.25.10 · Registro protegido de las 6 cartas técnicas de Microbiología.
// Motivo: una PWA/Netlify nueva NO transporta IndexedDB del navegador anterior. Si una carta
// quedó local y aún no había sido confirmada por Firestore, otro navegador podía mostrar menos
// definiciones. Estas seis identidades ya aprobadas se reconstruyen de forma idempotente y se
// envían a Firestore sin borrar, fusionar ni sobrescribir una definición existente.
const PROTECTED_MICROBIOLOGY_CHARTS=[
  {code:'CC-0018',name:'Carta de control de condiciones ambientales MICROBIOLOGIA',equipmentKey:'EI-347',methods:['Microbiologia-Lunes','Microbiologia-Martes','Microbiologia-Miercoles','Microbiologia-Jueves','Microbiologia-Viernes','microbiologia parcial 4H','microbiologia parcial 7H','microbiologia parcial 6H'],extra:{metrologyConfig:microEnvDefaultConfig()}},
  {code:'CC-0019',name:'Carta de control pHmetro MICROBIOLOGIA',equipmentKey:'EI-188',methods:['Microbiologia-Lunes','Microbiologia-Martes','Microbiologia-Miercoles','Microbiologia-Jueves','microbiologia parcial 4H','microbiologia parcial 7H','microbiologia parcial 6H']},
  {code:'CC-0020',name:'Carta de control de Bano de maria EI-364',equipmentKey:'EI-364-BANO-MARIA',methods:['Microbiologia-Lunes','Microbiologia-Martes','Microbiologia-Miercoles','Microbiologia-Jueves','microbiologia parcial 4H','microbiologia parcial 7H','microbiologia parcial 6H'],extra:{bathMariaConfig:microIncDefaultConfig()}},
  {code:'CC-0021',name:'Carta de control Incubadora MICROBIOLOGIA',equipmentKey:'EI-364-INCUBADORA-MICROBIOLOGIA',methods:['Microbiologia-Lunes','Microbiologia-Martes','Microbiologia-Miercoles','Microbiologia-Jueves','microbiologia parcial 4H','microbiologia parcial 7H','microbiologia parcial 6H'],extra:{microbiologyIncubatorConfig:incMicroDefaultConfig()}},
  {code:'CC-0022',name:'Carta de control de congelador EI-350',equipmentKey:'EI-350',methods:['Microbiologia-Martes','Microbiologia-Miercoles','Microbiologia-Jueves'],extra:{microbiologyFreezerConfig:microFreezerDefaultConfig()}},
  {code:'CC-0023',name:'Carta de control de nevera AGARES MICROBIOLOGIA EI-69',equipmentKey:'EI-69',methods:['Microbiologia-Lunes','Microbiologia-Martes','Microbiologia-Miercoles','Microbiologia-Jueves','Microbiologia-Viernes','microbiologia parcial 4H','microbiologia parcial 7H','microbiologia parcial 6H']}
];
async function recoverProtectedMicrobiologyDefs(){
  if(currentSessionUser?.role!=='JEFE')return 0;
  const defs=await getAll('controlChartDefs'), options=await controlChartMethodOptions('MICROBIOLOGIA');
  let restored=0;
  for(const spec of PROTECTED_MICROBIOLOGY_CHARTS){
    // Código es la identidad primaria; equipo/nombre permiten conservar ediciones de nombre.
    const existing=defs.find(d=>d.code===spec.code)||defs.find(d=>
      d.section==='MICROBIOLOGIA' && (
        normalizeIdentityText(d.equipmentKey||'')===normalizeIdentityText(spec.equipmentKey) ||
        normalizeIdentityText(d.name||'')===normalizeIdentityText(spec.name)
      )
    );
    if(existing)continue; // jamás sobrescribir una carta que ya existe, incluso si está INACTIVA.
    const methods=spec.methods.map((name,i)=>{
      const found=options.find(x=>normalizeIdentityText(x.name)===normalizeIdentityText(name));
      return found?{id:found.id,section:'MICROBIOLOGIA',name:found.name}:{id:`RECOVERED:MICRO:${spec.code}:${i}`,section:'MICROBIOLOGIA',name};
    });
    const candidate={linkMode:'TRANSVERSAL',equipmentKey:spec.equipmentKey,name:spec.name};
    const id=`CCD-TRANS-${stableTextHash(transversalControlKey(candidate))}`;
    const rec={id,code:spec.code,name:spec.name,linkMode:'TRANSVERSAL',section:'MICROBIOLOGIA',methodName:methods[0]?.name||'Microbiología',applicableSections:['MICROBIOLOGIA'],applicableMethods:methods,equipmentKey:spec.equipmentKey,executionScope:'DAILY_EQUIPMENT',status:'ACTIVO',notes:'Definición técnica protegida y recuperable. La recuperación no elimina ni reemplaza trazabilidad histórica.',accessRule:'MULTI_APPLICABILITY',schemaVersion:6,protectedDefinition:true,recoveredFromProtectedRegistry:true,...(spec.extra||{}),createdAt:nowISO(),updatedAt:nowISO()};
    await put('controlChartDefs',rec);await queue('CREATE','controlChartDefs',rec);
    await audit('RECUPERAR','CARTAS_CONTROL_CONFIG',rec.id,`${spec.code} recuperada desde registro técnico protegido; sin eliminar registros.`);
    defs.push(rec);restored++;
  }
  if(restored)console.info(`Cartas Microbiología recuperadas: ${restored}`);
  return restored;
}
let criticalControlRecoveryDone=false;
async function recoverCriticalControlDefs(){
  // 6.33.25.2: una sola pasada por sesión. Renderizar la tabla nunca debe reabrir Outbox.
  if(currentSessionUser?.role!=='JEFE'||criticalControlRecoveryDone)return 0;
  criticalControlRecoveryDone=true;
  let n=0;
  n+=await repairOrphanBalanceControlDef();
  n+=await consolidateRecoveredBalanceDefs();
  n+=await normalizeBalanceWeighingIdentity();
  n+=await recoverMissingBalanceEnvironmentDef();
  n+=await recoverMissingOven314ControlDef();
  n+=await recoverProtectedMicrobiologyDefs();
  if(n&&firebaseBridge.ready&&firebaseBridge.authUser){scheduleOutboxFlush(150);}
  return n;
}
async function renderControlChartEngine(){
  await dedupeControlChartDefs();
  await recoverCriticalControlDefs();
  const host=$('#controlChartDefsBody'), empty=$('#controlChartDefsEmpty');if(!host)return;
  const defs=(await getAll('controlChartDefs')).filter(d=>!d.archivedDuplicate).sort((a,b)=>String(a.section).localeCompare(String(b.section))||String(a.name).localeCompare(String(b.name)));
  host.innerHTML=defs.map(d=>{const trans=d.linkMode==='TRANSVERSAL';const areas=trans?(d.applicableSections||[]).map(x=>sectionMeta(x).label).join(', '):sectionMeta(d.section).label;const methods=trans?(d.applicableMethods||[]).map(x=>x.name||x.methodName||x).join(', '):(d.methodName||'—');return `<tr><td><b>${escapeHtml(d.name)}</b><small class="table-sub">${escapeHtml(d.code||d.id)}${trans?' · TRANSVERSAL':''}</small></td><td>${escapeHtml(areas||'—')}</td><td>${escapeHtml(methods||'—')}</td><td><span class="badge">${escapeHtml(d.status||'ACTIVO')}</span></td><td><button class="btn secondary small" data-chart-edit="${d.id}">Editar</button> <button class="btn secondary small" data-chart-toggle="${d.id}">${d.status==='INACTIVO'?'Activar':'Desactivar'}</button></td></tr>`}).join('');
  if(empty)empty.classList.toggle('hidden',defs.length>0);$$('[data-chart-edit]').forEach(b=>b.onclick=()=>openControlChartDef(b.dataset.chartEdit));$$('[data-chart-toggle]').forEach(b=>b.onclick=()=>toggleControlChartDef(b.dataset.chartToggle));
  const total=$('#chartEngineTotal');if(total)total.textContent=String(defs.length);const cloud=$('#chartEngineCloud');if(cloud){const ob=await getAll('outbox'),cc=ob.filter(x=>(x.entity==='controlChartDefs'||x.entity==='controlChartRecords')&&(x.status==='PENDIENTE'||x.status==='ERROR'));const ce=cc.filter(x=>x.status==='ERROR');cloud.textContent=ce.length?`ERROR · ${ce.length}`:cc.length?`PENDIENTE · ${cc.length}`:firebaseBridge.ready&&firebaseBridge.authUser?'FIRESTORE SINCRONIZADO':'ESPERANDO SESIÓN';cloud.title=ce[0]?.lastError||'';}
}
function fillChartSectionOptions(){const sel=$('#chartDefSection');if(!sel)return;sel.innerHTML=SECTIONS.map(x=>`<option value="${x.id}">${escapeHtml(x.label)}</option>`).join('')}
async function renderTransversalOptions(def=null){
  const secBox=$('#chartDefSectionsMulti'), methBox=$('#chartDefMethodsMulti');if(!secBox||!methBox)return;
  const selectedSections=new Set(def?.applicableSections||[]), selectedMethods=new Set((def?.applicableMethods||[]).map(x=>typeof x==='string'?x:(x.id||x.methodName||x.name)));
  secBox.innerHTML=SECTIONS.map(x=>`<label class="multi-check"><input type="checkbox" data-chart-section-multi value="${x.id}" ${selectedSections.has(x.id)?'checked':''}> <span>${escapeHtml(x.label)}</span></label>`).join('');
  const all=[];for(const sec of SECTIONS){for(const m of await controlChartMethodOptions(sec.id))all.push({...m,section:sec.id,sectionLabel:sec.label})}
  methBox.innerHTML=all.map(m=>`<label class="multi-check"><input type="checkbox" data-chart-method-multi value="${escapeHtml(m.id)}" data-section="${m.section}" data-name="${escapeHtml(m.name)}" ${selectedMethods.has(m.id)||selectedMethods.has(m.name)?'checked':''}> <span><b>${escapeHtml(m.name)}</b><small>${escapeHtml(m.sectionLabel)}</small></span></label>`).join('');
  const filter=()=>{const active=new Set($$('[data-chart-section-multi]:checked').map(x=>x.value));$$('[data-chart-method-multi]').forEach(x=>x.closest('label').classList.toggle('hidden',active.size>0&&!active.has(x.dataset.section)))};$$('[data-chart-section-multi]').forEach(x=>x.onchange=filter);filter();
}
async function updateChartLinkMode(def=null){const trans=$('#chartDefLinkMode')?.value==='TRANSVERSAL';$('#chartDefTransversalBox')?.classList.toggle('hidden',!trans);$('#chartDefSectionLabel')?.classList.toggle('hidden',trans);$('#chartDefMethodSelectLabel')?.classList.toggle('hidden',trans);const h=$('#chartDefAccessHint');if(h)h.innerHTML=trans?'<b>Acceso transversal:</b> si la jornada contiene cualquiera de las áreas/métodos seleccionados, la carta aparece una sola vez. Al completarse, satisface todos los usos vinculados de ese día.':'Acceso automático: el analista podrá usar esta carta únicamente si tiene asignada la actividad/área correspondiente.';if(trans)await renderTransversalOptions(def)}
async function openControlChartDef(id=''){
  fillChartSectionOptions();const d=id?await getOne('controlChartDefs',id):null;
  $('#chartDefId').value=d?.id||'';$('#chartDefName').value=d?.name||'';$('#chartDefLinkMode').value=d?.linkMode||'SPECIFIC';$('#chartDefSection').value=d?.section||'RECEPCION_MUESTRAS';$('#chartDefStatus').value=d?.status||'ACTIVO';$('#chartDefNotes').value=d?.notes||'';$('#chartDefEquipmentKey').value=d?.equipmentKey||'';$('#chartDefExecutionScope').value=d?.executionScope||'DAILY_EQUIPMENT';
  await refreshChartMethodOptions(d?.methodName||'');await updateChartLinkMode(d);
  const dlg=$('#controlChartDefDialog');if(!dlg)throw new Error('No se encontró el formulario de Carta de Control');if(typeof dlg.showModal==='function'){if(!dlg.open)dlg.showModal()}else{dlg.setAttribute('open','');dlg.style.display='block'}
}
async function saveControlChartDef(ev){
  ev.preventDefault();if(currentSessionUser?.role!=='JEFE')return toast('Solo JEFE puede configurar cartas de control');
  const id=$('#chartDefId').value,name=$('#chartDefName').value.trim(),mode=$('#chartDefLinkMode').value,all=await getAll('controlChartDefs'),existing=id?all.find(x=>x.id===id):null;let rec;
  if(mode==='TRANSVERSAL'){
    const applicableSections=$$('[data-chart-section-multi]:checked').map(x=>x.value), applicableMethods=$$('[data-chart-method-multi]:checked').map(x=>({id:x.value,section:x.dataset.section,name:x.dataset.name})),equipmentKey=$('#chartDefEquipmentKey').value.trim();
    if(!name||(!applicableSections.length&&!applicableMethods.length))return toast('Seleccione al menos un área o un ensayo/método para la carta transversal');
    const effectiveKey=equipmentKey||name;
    const candidateIdentity={linkMode:'TRANSVERSAL',equipmentKey:effectiveKey,name};
    const duplicate=all.find(x=>x.id!==id&&exactTransversalDuplicate(x,candidateIdentity));
    const base=existing||duplicate||null;
    const identityKey=transversalControlKey(candidateIdentity);
    const stableId=base?.id||`CCD-TRANS-${stableTextHash(identityKey)}`;
    rec={...(base||{}),id:stableId,code:base?.code||`CC-${String(all.length+1).padStart(4,'0')}`,name,linkMode:'TRANSVERSAL',section:applicableSections[0],methodName:applicableMethods[0].name,applicableSections,applicableMethods,equipmentKey:effectiveKey,executionScope:'DAILY_EQUIPMENT',status:$('#chartDefStatus').value,notes:$('#chartDefNotes').value.trim(),accessRule:'MULTI_APPLICABILITY',schemaVersion:4,createdAt:base?.createdAt||nowISO(),updatedAt:nowISO()};
    if(duplicate&&!existing)$('#chartDefId').value=duplicate.id;
  }else{
    const section=$('#chartDefSection').value,methodName=$('#chartDefMethod').value.trim();if(!name||!section||!methodName)return toast('Complete carta, actividad/área y ensayo/método');const duplicate=all.find(x=>x.id!==id&&x.linkMode!=='TRANSVERSAL'&&x.section===section&&normalizeIdentityText(x.methodName)===normalizeIdentityText(methodName));if(duplicate)return toast('Esta carta específica ya existe. Use Editar; no se creará un duplicado.');
    rec={...(existing||{}),id:id||uid('CCD'),code:existing?.code||`CC-${String(all.length+1).padStart(4,'0')}`,name,linkMode:'SPECIFIC',section,methodName,applicableSections:[],applicableMethods:[],equipmentKey:'',executionScope:'',status:$('#chartDefStatus').value,notes:$('#chartDefNotes').value.trim(),accessRule:'ACTIVIDAD_ASIGNADA',schemaVersion:3,createdAt:existing?.createdAt||nowISO(),updatedAt:nowISO()};
  }
  const wasExisting=all.some(x=>x.id===rec.id);await put('controlChartDefs',rec);await queue(wasExisting?'UPDATE':'CREATE','controlChartDefs',rec);await audit(wasExisting?'EDITAR':'CREAR','CARTAS_CONTROL_CONFIG',rec.code,rec.linkMode==='TRANSVERSAL'?`Transversal · ${(rec.applicableMethods||[]).length} método(s)`:`${sectionMeta(rec.section).label} · ${rec.methodName}`);$('#controlChartDefDialog').close();let cloudOk=false;if(firebaseBridge.ready&&firebaseBridge.authUser){cloudOk=await flushOutbox(false);}toast(cloudOk?(wasExisting?'Carta actualizada y confirmada en Firestore':'Carta creada y confirmada en Firestore'):'Carta guardada localmente · pendiente de confirmación Firestore');await renderControlChartEngine();
}
async function toggleControlChartDef(id){
  if(currentSessionUser?.role!=='JEFE')return toast('Solo JEFE puede configurar cartas de control');
  const d=await getOne('controlChartDefs',id);if(!d)return;d.status=d.status==='INACTIVO'?'ACTIVO':'INACTIVO';d.updatedAt=nowISO();await put('controlChartDefs',d);await queue('UPDATE','controlChartDefs',d);await audit('CAMBIAR_ESTADO','CARTAS_CONTROL_CONFIG',d.code,d.status);await renderControlChartEngine();
}
async function saveConfig(){const lab=$('#cfgLab').value.trim(),user=$('#cfgUser').value.trim(),dayHours=Number($('#cfgDayHours').value||8);await put('config',{key:'labName',value:lab});await put('config',{key:'defaultUser',value:user});await put('config',{key:'dayHours',value:dayHours});await audit('CONFIGURAR','SISTEMA','CONFIG','Configuración general actualizada');toast('Configuración guardada');await refreshAll()}

function incubatorDefaultConfig(){return {equipment:'EI-306',dataLogger:'PF-09',area:'Instrumental',criterion:{min:19,max:21},correctionRanges:[{min:18,max:20,factor:-0.1},{min:20,max:22,factor:-0.1}],effectiveFrom:dateToday(),certificateRef:'',version:1};}
function incubatorConfig(def){const c=def?.metrologyConfig||incubatorDefaultConfig();return {...incubatorDefaultConfig(),...c,criterion:{...incubatorDefaultConfig().criterion,...(c.criterion||{})},correctionRanges:Array.isArray(c.correctionRanges)&&c.correctionRanges.length?c.correctionRanges:incubatorDefaultConfig().correctionRanges};}
function incubatorFactor(v,cfg){const rows=cfg.correctionRanges||[];for(let i=0;i<rows.length;i++){const r=rows[i],last=i===rows.length-1;if(v>=Number(r.min)&&(last?v<=Number(r.max):v<Number(r.max)))return Number(r.factor)}return null;}
function incubatorCalc(v,cfg){const raw=Number(v),factor=incubatorFactor(raw,cfg);if(!Number.isFinite(raw)||factor===null||!Number.isFinite(factor))return {valid:false,raw,factor};const corrected=raw+factor,ok=corrected>=Number(cfg.criterion.min)&&corrected<=Number(cfg.criterion.max);return {valid:true,raw,factor,corrected,ok};}
async function incubatorRecords(chartId){return (await getAll('controlChartRecords')).filter(r=>r.chartId===chartId&&r.controlType==='INCUBADORA_EI306').sort((a,b)=>String(a.measuredAt).localeCompare(String(b.measuredAt)));}
async function ensureIncubatorConfig(def){if(def.metrologyConfig)return def;def.metrologyConfig=incubatorDefaultConfig();def.updatedAt=nowISO();await put('controlChartDefs',def);if(currentSessionUser?.role==='JEFE')await queue('UPDATE','controlChartDefs',def);return def;}
async function openIncubatorControl(def,date,analystId){const dlg=$('#incubatorControlDialog');if(!dlg)return toast('Formato Incubadora EI-306 no disponible');def=await ensureIncubatorConfig(def);$('#incChartId').value=def.id;$('#incAnalystId').value=analystId||'';$('#incInputDate').value=date||dateToday();$('#incTime').value=new Date().toTimeString().slice(0,5);$('#incTempRaw').value='';$('#incNotes').value='';$('#incPreview').innerHTML='';renderIncubatorConfig(def);await renderIncubator(def.id);if(typeof dlg.showModal==='function')dlg.showModal();else dlg.setAttribute('open','');}
function renderIncubatorConfig(def){const cfg=incubatorConfig(def),box=$('#incCorrectionRows');if($('#incCriterionLabel'))$('#incCriterionLabel').textContent=`${Number(cfg.criterion.min).toFixed(1)}–${Number(cfg.criterion.max).toFixed(1)} °C`;if($('#incConfigPanel'))$('#incConfigPanel').classList.toggle('hidden',currentSessionUser?.role!=='JEFE');if($('#incEffectiveFrom'))$('#incEffectiveFrom').value=cfg.effectiveFrom||dateToday();if($('#incCertificateRef'))$('#incCertificateRef').value=cfg.certificateRef||'';if($('#incCriterionMin'))$('#incCriterionMin').value=cfg.criterion.min;if($('#incCriterionMax'))$('#incCriterionMax').value=cfg.criterion.max;if(box)box.innerHTML=cfg.correctionRanges.map((r,i)=>`<div class="inc-config-row"><input type="number" step="0.01" value="${r.min}" data-inc-min="${i}"><input type="number" step="0.01" value="${r.max}" data-inc-max="${i}"><input type="number" step="0.01" value="${r.factor}" data-inc-factor="${i}"></div>`).join('');}
async function saveIncubatorConfig(){if(currentSessionUser?.role!=='JEFE')return toast('Solo JEFE/Calidad puede cambiar la configuración metrológica');const id=$('#incChartId').value,def=await getOne('controlChartDefs',id);if(!def)return;const mins=$$('[data-inc-min]'),maxs=$$('[data-inc-max]'),factors=$$('[data-inc-factor]'),ranges=mins.map((el,i)=>({min:Number(el.value),max:Number(maxs[i].value),factor:Number(factors[i].value)}));if(ranges.some(r=>![r.min,r.max,r.factor].every(Number.isFinite)||r.max<=r.min))return toast('Revise los rangos y factores de corrección');ranges.sort((a,b)=>a.min-b.min);const cmin=Number($('#incCriterionMin').value),cmax=Number($('#incCriterionMax').value);if(!Number.isFinite(cmin)||!Number.isFinite(cmax)||cmax<=cmin)return toast('Revise el criterio técnico');const old=incubatorConfig(def);def.metrologyConfig={equipment:'EI-306',dataLogger:'PF-09',area:'Instrumental',criterion:{min:cmin,max:cmax},correctionRanges:ranges,effectiveFrom:$('#incEffectiveFrom').value||dateToday(),certificateRef:$('#incCertificateRef').value.trim(),version:Number(old.version||1)+1};def.updatedAt=nowISO();await put('controlChartDefs',def);await queue('UPDATE','controlChartDefs',def);await audit('CONFIGURAR','CARTA_CONTROL_INCUBADORA',def.id,`Configuración metrológica v${def.metrologyConfig.version} · ${def.metrologyConfig.effectiveFrom}`);renderIncubatorConfig(def);previewIncubator();toast('Configuración metrológica EI-306 guardada y sincronizada');}
async function previewIncubator(){const def=await getOne('controlChartDefs',$('#incChartId')?.value),box=$('#incPreview');if(!box||!def)return;const raw=$('#incTempRaw').value;if(raw===''){box.innerHTML='';return}const cfg=incubatorConfig(def),c=incubatorCalc(raw,cfg);if(!c.valid){const min=Math.min(...cfg.correctionRanges.map(r=>Number(r.min))),max=Math.max(...cfg.correctionRanges.map(r=>Number(r.max)));box.innerHTML=`<div class="dbo5-result bad"><b>Lectura fuera de la tabla de corrección vigente</b><br>No se inventará un factor. Rango configurado: ${min.toFixed(1)}–${max.toFixed(1)} °C. Solicite revisión a Calidad.</div>`;return}box.innerHTML=`<div class="dbo5-result ${c.ok?'ok':'bad'}"><b>Temperatura corregida: ${c.corrected.toFixed(2)} °C</b><br>${c.raw.toFixed(2)} ${c.factor>=0?'+':'−'} ${Math.abs(c.factor).toFixed(2)} · criterio ${cfg.criterion.min}–${cfg.criterion.max} °C · ${c.ok?'CUMPLE':'NO CUMPLE'}</div>`;}
async function saveIncubatorControl(e){e.preventDefault();const chartId=$('#incChartId').value,analystId=$('#incAnalystId').value,def=await getOne('controlChartDefs',chartId),cfg=incubatorConfig(def),c=incubatorCalc($('#incTempRaw').value,cfg);if(!c.valid)return toast('Lectura fuera de la tabla de corrección vigente. No se puede guardar sin factor aplicable.');const date=$('#incInputDate').value,time=$('#incTime').value,analysts=await getAll('analysts'),a=analysts.find(x=>x.id===analystId),existing=await incubatorRecords(chartId),vals=[...existing.map(r=>Number(r.tempCorrected)),c.corrected],w=dbo5Westgard(vals),stat=existing.length+1<10?'ESTABLECIMIENTO':w.state;const rec={id:uid('CCR'),chartId,controlType:'INCUBADORA_EI306',section:'RECEPCION_MUESTRAS',methodName:'Incubadora DBO5',equipment:'EI-306',dataLogger:'PF-09',area:'Instrumental',analystId,analystName:a?.name||firebaseBridge?.authUser?.email||'Usuario',measuredAt:`${date}T${time}:00`,tempRaw:c.raw,tempFactor:c.factor,tempCorrected:c.corrected,tempCriterion:{...cfg.criterion},metrologyConfigSnapshot:JSON.parse(JSON.stringify(cfg)),overallResult:c.ok?'CUMPLE':'NO CUMPLE',statisticalState:stat,statisticalRules:w.rules||[],notes:$('#incNotes').value.trim(),schemaVersion:1,createdAt:nowISO(),updatedAt:nowISO()};const sameDay=(await getAll('controlChartRecords')).find(x=>x.chartId===chartId&&String(x.measuredAt||'').slice(0,10)===date);if(sameDay)return toast('Esta carta de Incubadora ya fue completada hoy. No se generará un duplicado.');await put('controlChartRecords',rec);await queue('CREATE','controlChartRecords',rec);await createControlChartCompletionAlert(rec,def);await audit('REGISTRAR','CARTA_CONTROL_INCUBADORA',rec.id,`${rec.overallResult} · ${c.raw.toFixed(2)} → ${c.corrected.toFixed(2)} °C · factor ${c.factor}`);toast('Control de Incubadora EI-306 guardado y enviado a Firebase');$('#incTempRaw').value='';$('#incNotes').value='';$('#incPreview').innerHTML='';await renderIncubator(chartId);}
async function renderIncubator(chartId){const rows=await incubatorRecords(chartId),body=$('#incHistoryBody');if(!body)return;const vals=rows.map(r=>Number(r.tempCorrected)),w=dbo5Westgard(vals);$('#incHistoryCount').textContent=`${rows.length} registros`;$('#incStats').innerHTML=rows.length<10?`<div><small>Estado estadístico</small><b>FASE DE ESTABLECIMIENTO</b></div><div><small>Datos requeridos</small><b>${rows.length}/10</b></div><div><small>Temperatura</small><b>—</b></div>`:`<div><small>Temperatura media ± s</small><b>${mean(vals).toFixed(2)} ± ${sd(vals).toFixed(2)} °C</b></div><div><small>Estado</small><b>${w.state}</b></div><div><small>Reglas</small><b>${(w.rules||[]).join(', ')||'Sin alarmas'}</b></div>`;body.innerHTML=rows.slice().reverse().map(r=>`<tr><td>${escapeHtml(String(r.measuredAt||'').replace('T',' ').slice(0,16))}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${Number(r.tempRaw).toFixed(2)}</td><td>${Number(r.tempFactor).toFixed(2)}</td><td>${Number(r.tempCorrected).toFixed(2)}</td><td>${Number(r.tempCriterion?.min??19).toFixed(1)}–${Number(r.tempCriterion?.max??21).toFixed(1)}</td><td><span class="badge">${r.overallResult}</span></td><td>${escapeHtml(r.statisticalState||'ESTABLECIMIENTO')}</td></tr>`).join('')||'<tr><td colspan="8">Sin registros todavía.</td></tr>';const ai=$('#incAi');if(!rows.length)ai.innerHTML='<b>IA:</b> Aún no existen registros de Incubadora EI-306. El primer control iniciará la trazabilidad.';else{const last=rows.at(-1);ai.innerHTML=`<b>IA · Diagnóstico:</b> Último control <b>${last.overallResult}</b> con ${Number(last.tempCorrected).toFixed(2)} °C corregidos. ${rows.length<10?`Hay ${rows.length}/10 registros; fase de establecimiento.`:`Estado estadístico: <b>${w.state}</b>${w.rules?.length?'. Reglas: '+w.rules.join(', '):'. Sin reglas de alarma.'}.`} La configuración metrológica histórica queda congelada en cada registro.`;}}
async function renderIncubatorManagement(def,month){
  resetControlChartManagementUI();
  const all=await incubatorRecords(def.id),rows=all.filter(r=>String(r.measuredAt||'').startsWith(month)),cfg=incubatorConfig(def),vals=rows.map(r=>Number(r.tempCorrected)).filter(Number.isFinite),ok=rows.filter(r=>r.overallResult==='CUMPLE').length,w=dbo5Westgard(vals);
  $('#ccChart1Title').textContent='Incubadora EI-306 · Temperatura corregida';$('#ccChart1Desc').textContent='Lectura corregida, media, ±1s, ±2s, ±3s y criterio técnico 19–21 °C.';
  $('#ccChart2Title').textContent='Configuración metrológica vigente';$('#ccChart2Desc').textContent='Factores de corrección y trazabilidad de calibración; el histórico conserva su configuración original.';
  $('#ccCount').textContent=`${rows.length} registros · ${month}`;
  $('#ccHistoryHead').innerHTML='<tr><th>Fecha/hora</th><th>Responsable</th><th>T leída</th><th>Factor</th><th>T corregida</th><th>Criterio</th><th>Resultado</th><th>Estadístico</th></tr>';
  if(!rows.length){showControlChartNoData('Incubadora EI-306',month);return;}
  $('#ccKpis').innerHTML=`<div><small>Controles</small><b>${rows.length}</b><span>${month}</span></div><div><small>Cumplimiento</small><b>${(ok/rows.length*100).toFixed(1)}%</b><span>${ok}/${rows.length} cumplen 19–21 °C</span></div><div><small>Media ± s</small><b>${mean(vals).toFixed(2)} ± ${sd(vals).toFixed(2)} °C</b><span>mín ${Math.min(...vals).toFixed(2)} · máx ${Math.max(...vals).toFixed(2)}</span></div><div><small>Equipo</small><b>EI-306</b><span>Data Logger PF-09</span></div>`;
  $('#ccTempState').textContent=rows.length<10?'ESTABLECIMIENTO':w.state;$('#ccHumState').textContent='CONFIGURACIÓN';
  $('#ccTempChart').innerHTML=ccSvgLine(rows,'tempCorrected','°C',19,21);
  $('#ccHumChart').innerHTML=`<div class="dbo5-ai"><b>Configuración vigente v${cfg.version||1}</b><br>Criterio: ${cfg.criterion.min}–${cfg.criterion.max} °C · Vigente desde ${cfg.effectiveFrom||'—'}${cfg.certificateRef?` · Certificado: ${escapeHtml(cfg.certificateRef)}`:''}<br>${cfg.correctionRanges.map(r=>`${r.min}–${r.max} °C → factor ${Number(r.factor)>=0?'+':''}${r.factor}`).join('<br>')}</div>`;
  const events=[];ccRuleDetails(vals,rows.map(r=>r.measuredAt)).forEach(x=>x.rules.forEach(rule=>events.push({rule,date:x.label})));$('#ccRules').innerHTML=events.length?events.map(e=>`<div class="cc-rule"><b>${escapeHtml(e.rule)}</b><span>Temperatura · ${ccFmtDate(e.date)}</span></div>`).join(''):'<div class="cc-ok">No se detectan reglas de alarma en la temperatura corregida.</div>';
  $('#ccAi').innerHTML=`<b>Diagnóstico mensual Incubadora EI-306:</b> ${ok}/${rows.length} controles cumplen 19–21 °C. ${rows.length<10?'La serie permanece en FASE DE ESTABLECIMIENTO hasta completar 10 registros.':`Estado estadístico: <b>${w.state}</b>.`} La IA evalúa exclusivamente la serie de Incubadora; no reutiliza datos de otras cartas ni modifica criterios.`;
  $('#ccHistoryBody').innerHTML=rows.slice().reverse().map(r=>`<tr><td>${ccFmtDate(r.measuredAt)}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${Number(r.tempRaw).toFixed(2)} °C</td><td>${Number(r.tempFactor)>=0?'+':''}${Number(r.tempFactor).toFixed(2)}</td><td>${Number(r.tempCorrected).toFixed(2)} °C</td><td>${Number(r.tempCriterion?.min??19).toFixed(1)}–${Number(r.tempCriterion?.max??21).toFixed(1)} °C</td><td><span class="badge">${escapeHtml(r.overallResult||'—')}</span></td><td>${escapeHtml(r.statisticalState||'ESTABLECIMIENTO')}</td></tr>`).join('');
}
// 6.33.13 · Destilador EI-328. IMPORTANTE: no modifica controlChartDefs al abrir.
// El analista solo crea controlChartRecords, igual que las cartas estables; evita UPDATE de definición/permisos.



// 6.33.25.6 · Congelador de cepas de referencia MICROBIOLOGÍA EI-350
// Fuente técnica: PG0406-04. Serie independiente, criterio -25 a -15 °C.
// Corrección metrológica por rango configurable; por defecto:
// -30 a -20 °C -> 0.00 °C; -20 a -10 °C -> +0.10 °C.
function isMicrobiologyFreezerChart(d){if(!d)return false;const n=normalizeIdentityText(d.name||''),m=normalizeIdentityText(d.methodName||''),k=normalizeIdentityText(d.controlKey||d.equipmentKey||''),sec=normalizeIdentityText([d.section,d.sectionName,d.area,d.areaName,(d.sections||[]).join(' ')].filter(Boolean).join(' '));const freezer=n.includes('congelador')||m.includes('congelador')||k.includes('congelador')||hasEquipmentIdentity(d.name,'EI-350')||hasEquipmentIdentity(d.methodName,'EI-350')||hasEquipmentIdentity(d.controlKey||d.equipmentKey,'EI-350');return freezer&&(n.includes('microbiologia')||m.includes('microbiologia')||k.includes('microbiologia')||sec.includes('microbiologia'));}
function microFreezerDefaultConfig(){return {equipment:'EI-350',sensor:'EI-333',area:'Microbiología',target:-20,criterion:{min:-25,max:-15},correctionRanges:[{min:-30,max:-20,factor:0},{min:-20,max:-10,factor:0.10}],effectiveFrom:dateToday(),reference:'PG0406-04 Control de Condiciones del Congelador',version:1};}
function microFreezerConfig(def){const d=microFreezerDefaultConfig(),c=def?.microbiologyFreezerConfig||{};return {...d,...c,criterion:{...d.criterion,...(c.criterion||{})},correctionRanges:Array.isArray(c.correctionRanges)&&c.correctionRanges.length?c.correctionRanges:d.correctionRanges};}
function microFreezerCalc(v,cfg){const raw=Number(v);if(!Number.isFinite(raw))return {valid:false};const ranges=cfg.correctionRanges||[];const r=ranges.find((x,i)=>raw>=Number(x.min)&&(i===ranges.length-1?raw<=Number(x.max):raw<Number(x.max)));if(!r)return {valid:false,raw,reason:'SIN_FACTOR'};const factor=Number(r.factor),corrected=raw+factor,ok=corrected>=Number(cfg.criterion.min)&&corrected<=Number(cfg.criterion.max);return {valid:true,raw,factor,corrected,ok,range:{min:Number(r.min),max:Number(r.max)}};}
async function microFreezerRecords(chartId){return (await getAll('controlChartRecords')).filter(r=>r.chartId===chartId&&(r.controlType==='CONGELADOR_MICROBIOLOGIA_EI350'||(r.historicalEntry===true&&r.controlType==='CONGELADOR_EI350'))).sort((a,b)=>String(a.measuredAt).localeCompare(String(b.measuredAt)));}
async function openMicroFreezerControl(def,date,analystId,completedRec){const dlg=$('#microFreezerDialog');if(!dlg)return toast('Formato Congelador EI-350 no disponible');const cfg=microFreezerConfig(def);$('#microFreezerChartId').value=def.id;$('#microFreezerAnalystId').value=analystId||'';$('#microFreezerDate').value=date||dateToday();$('#microFreezerTime').value=new Date().toTimeString().slice(0,5);$('#microFreezerTemp').value='';$('#microFreezerNotes').value='';$('#microFreezerPreview').innerHTML='';$('#microFreezerCriterion').textContent=`${cfg.criterion.min.toFixed(0)} a ${cfg.criterion.max.toFixed(0)} °C`;$('#microFreezerTarget').textContent=`${Number(cfg.target).toFixed(0)} °C`;$('#microFreezerSensor').textContent=cfg.sensor||'EI-333';$('#microFreezerConfig').classList.toggle('hidden',currentSessionUser?.role!=='JEFE');$('#microFreezerMin').value=cfg.criterion.min;$('#microFreezerMax').value=cfg.criterion.max;$('#microFreezerTargetInput').value=cfg.target;$('#microFreezerEffective').value=cfg.effectiveFrom||dateToday();$('#microFreezerReference').value=cfg.reference||'';$('#microFreezerCorrectionRows').innerHTML=(cfg.correctionRanges||[]).map(r=>`<div class="inc-config-row"><input data-mf-min type="number" step="0.01" value="${r.min}"><input data-mf-max type="number" step="0.01" value="${r.max}"><input data-mf-factor type="number" step="0.01" value="${r.factor}"></div>`).join('');await renderMicroFreezer(def.id);const same=completedRec||(await microFreezerRecords(def.id)).find(r=>String(r.measuredAt||'').slice(0,10)===(date||dateToday()));const btn=$('#microFreezerSave');btn.disabled=!!same;btn.textContent=same?'✓ Control ya completado hoy':'Guardar control Congelador EI-350';if(same)$('#microFreezerPreview').innerHTML=`<div class="dbo5-result ok"><b>✓ COMPLETADA HOY</b><br>${escapeHtml(same.analystName||'Analista')} · ${Number(same.tempCorrected).toFixed(2)} °C · ${escapeHtml(same.overallResult||'—')}.</div>`;if(typeof dlg.showModal==='function')dlg.showModal();else dlg.setAttribute('open','');}
async function previewMicroFreezer(){const def=await getOne('controlChartDefs',$('#microFreezerChartId')?.value),box=$('#microFreezerPreview');if(!def||!box)return;const cfg=microFreezerConfig(def),c=microFreezerCalc($('#microFreezerTemp').value,cfg);if(!Number.isFinite(c.raw)){box.innerHTML='';return}if(!c.valid){box.innerHTML='<div class="alert warn"><b>Lectura fuera de la tabla metrológica vigente.</b> No se guardará sin un factor definido por Calidad.</div>';return}const delta=c.corrected-Number(cfg.target);box.innerHTML=`<div class="cc-detail-grid"><div><small>Lectura</small><b>${c.raw.toFixed(2)} °C</b></div><div><small>Corrección</small><b>${c.factor>=0?'+':''}${c.factor.toFixed(2)} °C</b><span>${c.range.min} a ${c.range.max} °C</span></div><div><small>Temperatura corregida</small><b>${c.corrected.toFixed(2)} °C</b></div><div><small>Resultado</small><b>${c.ok?'CUMPLE':'NO CUMPLE'}</b><span>criterio ${cfg.criterion.min} a ${cfg.criterion.max} °C</span></div></div>`;}
async function saveMicroFreezerConfig(){if(currentSessionUser?.role!=='JEFE')return toast('Solo JEFE/Calidad puede cambiar esta configuración');const id=$('#microFreezerChartId').value,def=await getOne('controlChartDefs',id);if(!def)return;const mins=$$('[data-mf-min]'),maxs=$$('[data-mf-max]'),factors=$$('[data-mf-factor]'),ranges=mins.map((el,i)=>({min:Number(el.value),max:Number(maxs[i].value),factor:Number(factors[i].value)}));if(ranges.some(r=>![r.min,r.max,r.factor].every(Number.isFinite)||r.max<=r.min))return toast('Revise rangos y factores');ranges.sort((a,b)=>a.min-b.min);const cmin=Number($('#microFreezerMin').value),cmax=Number($('#microFreezerMax').value),target=Number($('#microFreezerTargetInput').value);if(![cmin,cmax,target].every(Number.isFinite)||cmax<=cmin)return toast('Revise criterio y objetivo');const old=microFreezerConfig(def);def.microbiologyFreezerConfig={equipment:'EI-350',sensor:'EI-333',area:'Microbiología',target,criterion:{min:cmin,max:cmax},correctionRanges:ranges,effectiveFrom:$('#microFreezerEffective').value||dateToday(),reference:$('#microFreezerReference').value.trim(),version:Number(old.version||1)+1};def.updatedAt=nowISO();await put('controlChartDefs',def);await queue('UPDATE','controlChartDefs',def);await audit('CONFIGURAR','CARTA_CONTROL_CONGELADOR',def.id,`Configuración EI-350 v${def.microbiologyFreezerConfig.version}`);toast('Configuración del Congelador EI-350 guardada');await openMicroFreezerControl(def,$('#microFreezerDate').value,$('#microFreezerAnalystId').value);}
async function saveMicroFreezerControl(e){e.preventDefault();const chartId=$('#microFreezerChartId').value,analystId=$('#microFreezerAnalystId').value,def=await getOne('controlChartDefs',chartId),cfg=microFreezerConfig(def),c=microFreezerCalc($('#microFreezerTemp').value,cfg);if(!c.valid)return toast('No se puede guardar: lectura sin factor metrológico aplicable');const date=$('#microFreezerDate').value,time=$('#microFreezerTime').value;if((await microFreezerRecords(chartId)).some(r=>String(r.measuredAt||'').slice(0,10)===date))return toast('Este congelador ya tiene un control registrado hoy');const a=(await getAll('analysts')).find(x=>x.id===analystId),existing=await microFreezerRecords(chartId),vals=[...existing.map(r=>Number(r.tempCorrected)),c.corrected],w=dbo5Westgard(vals),stat=vals.length<10?'ESTABLECIMIENTO':w.state;const rec={id:uid('CCR'),chartId,controlType:'CONGELADOR_MICROBIOLOGIA_EI350',section:'MICROBIOLOGIA',equipment:'EI-350',sensor:cfg.sensor||'EI-333',area:'Microbiología',analystId,analystName:a?.name||firebaseBridge?.authUser?.email||'Usuario',measuredAt:`${date}T${time}:00`,tempRaw:c.raw,tempFactor:c.factor,tempCorrected:c.corrected,tempCriterion:{...cfg.criterion},target:cfg.target,correctionRange:{...c.range},configSnapshot:JSON.parse(JSON.stringify(cfg)),overallResult:c.ok?'CUMPLE':'NO CUMPLE',statisticalState:stat,statisticalRules:w.rules||[],notes:$('#microFreezerNotes').value.trim(),schemaVersion:1,createdAt:nowISO(),updatedAt:nowISO()};await put('controlChartRecords',rec);await queue('CREATE','controlChartRecords',rec);await createControlChartCompletionAlert(rec,def);await audit('REGISTRAR','CARTA_CONTROL_CONGELADOR',rec.id,`EI-350 · ${c.corrected.toFixed(2)} °C · ${rec.overallResult}`);toast('Control del Congelador EI-350 guardado');dlgClose('microFreezerDialog');await renderMyDay();}
async function renderMicroFreezer(chartId){const rows=await microFreezerRecords(chartId),vals=rows.map(r=>Number(r.tempCorrected)),w=dbo5Westgard(vals),last=rows.at(-1);$('#microFreezerCount').textContent=`${rows.length} registros`;$('#microFreezerStats').innerHTML=rows.length?`<div><small>Media</small><b>${mean(vals).toFixed(2)} °C</b></div><div><small>Desv. estándar</small><b>${sd(vals).toFixed(3)} °C</b></div><div><small>Estado</small><b>${rows.length<10?'ESTABLECIMIENTO':w.state}</b></div><div><small>Último</small><b>${escapeHtml(last.overallResult||'—')}</b></div>`:'<div><small>Estado</small><b>Sin registros</b></div>';$('#microFreezerAi').innerHTML=!rows.length?'<b>IA:</b> El primer control iniciará la trazabilidad exclusiva del Congelador EI-350.':`<b>IA · Diagnóstico:</b> ${rows.filter(r=>r.overallResult==='CUMPLE').length}/${rows.length} controles cumplen. ${rows.length<10?'Serie en FASE DE ESTABLECIMIENTO hasta completar 10 registros.':`Estado estadístico <b>${w.state}</b>.`} ${(w.rules||[]).length?`Señales: <b>${escapeHtml(w.rules.join(' · '))}</b>. Revisar causa asignable, equipo, sensor, apertura de puerta/carga y documentar acción.`:'No se detectan señales estadísticas de alarma.'} La IA es asistiva y no modifica límites.`;$('#microFreezerHistory').innerHTML=rows.slice().reverse().map(r=>`<tr><td>${ccFmtDate(r.measuredAt)}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${Number(r.tempRaw).toFixed(2)}</td><td>${Number(r.tempFactor)>=0?'+':''}${Number(r.tempFactor).toFixed(2)}</td><td>${Number(r.tempCorrected).toFixed(2)}</td><td>${Number(r.tempCriterion?.min??-25)} a ${Number(r.tempCriterion?.max??-15)} °C</td><td>${escapeHtml(r.overallResult||'—')}</td><td>${escapeHtml(r.statisticalState||'ESTABLECIMIENTO')}</td></tr>`).join('');}
async function renderMicroFreezerManagement(def,month){const all=await microFreezerRecords(def.id),rows=all.filter(r=>String(r.measuredAt||'').startsWith(month));$('#ccChart3Card').classList.add('hidden');$('#ccChart1Title').textContent='Congelador EI-350 · Temperatura corregida';$('#ccChart1Desc').textContent='Media, ±1s, ±2s, ±3s y límites técnicos históricos.';$('#ccChart2Title').textContent='Metrología y acciones';$('#ccChart2Desc').textContent='Corrección aplicada y trazabilidad del sensor EI-333.';if(!rows.length){showControlChartNoData('Congelador EI-350',month);return;}const vals=rows.map(r=>Number(r.tempCorrected)),w=dbo5Westgard(vals),ok=rows.filter(r=>r.overallResult==='CUMPLE').length,cfg=microFreezerConfig(def);$('#ccKpis').innerHTML=`<div><small>Controles</small><b>${rows.length}</b><span>${month}</span></div><div><small>Cumplimiento</small><b>${(100*ok/rows.length).toFixed(1)}%</b><span>${ok}/${rows.length} cumplen</span></div><div><small>Temperatura media ± s</small><b>${mean(vals).toFixed(2)} ± ${sd(vals).toFixed(2)} °C</b><span>mín ${Math.min(...vals).toFixed(2)} · máx ${Math.max(...vals).toFixed(2)}</span></div><div><small>Equipo</small><b>EI-350</b><span>sensor ${escapeHtml(cfg.sensor||'EI-333')}</span></div>`;$('#ccTempState').textContent=rows.length<10?'ESTABLECIMIENTO':w.state;$('#ccTempChart').innerHTML=ccSvgLine(rows,'tempCorrected','°C',cfg.criterion.min,cfg.criterion.max);$('#ccHumState').textContent='METROLOGÍA';$('#ccHumChart').innerHTML=`<div class="cc-config-summary"><b>Configuración vigente</b><p>Objetivo ${cfg.target} °C · criterio ${cfg.criterion.min} a ${cfg.criterion.max} °C</p><p>${cfg.correctionRanges.map(r=>`${r.min} a ${r.max} °C → ${Number(r.factor)>=0?'+':''}${Number(r.factor).toFixed(2)} °C`).join(' · ')}</p><small>Cada registro conserva una copia de la configuración utilizada.</small></div>`;$('#ccAi').innerHTML=`<b>Diagnóstico mensual Congelador EI-350:</b> ${ok}/${rows.length} controles cumplen. ${rows.length<10?'La carta permanece en FASE DE ESTABLECIMIENTO hasta 10 registros.':`Estado estadístico: <b>${w.state}</b>.`} ${(w.rules||[]).length?'Se recomienda revisar causa asignable, sensor, aperturas, carga y documentar la acción antes de decidir continuidad.':'No se observan señales estadísticas de alarma.'} La IA es asistiva; la decisión corresponde a Calidad.`;$('#ccRules').innerHTML=(w.rules||[]).length?`<div class="alert warn"><b>Señales Westgard/Shewhart:</b> ${escapeHtml(w.rules.join(' · '))}</div>`:'<div class="alert success">No se detectan reglas de alarma en la serie.</div>';$('#ccHistoryHead').innerHTML='<tr><th>Fecha/hora</th><th>Responsable</th><th>T leída</th><th>Factor</th><th>T corregida</th><th>Resultado</th><th>Estadístico</th></tr>';$('#ccHistoryBody').innerHTML=rows.slice().reverse().map(r=>`<tr><td>${ccFmtDate(r.measuredAt)}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${Number(r.tempRaw).toFixed(2)}</td><td>${Number(r.tempFactor)>=0?'+':''}${Number(r.tempFactor).toFixed(2)}</td><td>${Number(r.tempCorrected).toFixed(2)}</td><td>${escapeHtml(r.overallResult||'—')}</td><td>${escapeHtml(r.statisticalState||'ESTABLECIMIENTO')}</td></tr>`).join('');$('#ccCount').textContent=`${rows.length} registros · ${month}`;}


// 6.33.24.3 · Baño de María MICROBIOLOGÍA EI-364 · PEC2601-03
// Identidad estricta: solo aplica a la carta cuyo nombre/método indica Baño de María; no se mezcla con incubadoras.

// 6.33.25.3 · Incubadora Microbiología EI-364 · serie independiente del Baño de María y EI-306
// 6.33.24 · Incubadora MICROBIOLOGIA EI-364 · PEC2601-03
// Identidad estricta: esta familia nunca hereda EI-306/PF-09 ni sus factores.
function isMicrobiologyIncubator364Chart(d){if(!d)return false;const n=normalizeIdentityText(d.name||''),m=normalizeIdentityText(d.methodName||''),k=normalizeIdentityText(d.controlKey||d.equipmentKey||'');const incub=(n.includes('incubadora')||m.includes('incubadora')||k.includes('incubadora'));const micro=(n.includes('microbiologia')||m.includes('microbiologia')||k.includes('microbiologia'));const bath=(n.includes('bano de maria')||n.includes('bano maria')||m.includes('bano de maria')||m.includes('bano maria')||k.includes('bano de maria')||k.includes('bano maria'));return incub&&micro&&!bath;}
function incMicroDefaultConfig(){return {equipment:'EI-364',area:'Microbiología',target:35.0,criterion:{min:34.5,max:35.5},effectiveFrom:dateToday(),reference:'PEC2601-03 Control Incubadora (EI364)',version:1};}
function incMicroConfig(def){const d=incMicroDefaultConfig(),c=def?.microbiologyIncubatorConfig||{};return {...d,...c,criterion:{...d.criterion,...(c.criterion||{})}};}
function incMicroCalc(v,cfg){const raw=Number(v),ok=Number.isFinite(raw)&&raw>=Number(cfg.criterion.min)&&raw<=Number(cfg.criterion.max);return {valid:Number.isFinite(raw),raw,ok};}
async function incMicroRecords(chartId){return (await getAll('controlChartRecords')).filter(r=>r.chartId===chartId&&r.controlType==='INCUBADORA_MICROBIOLOGIA_EI364').sort((a,b)=>String(a.measuredAt).localeCompare(String(b.measuredAt)));}
async function openIncMicroControl(def,date,analystId,completedRec){const dlg=$('#incMicroControlDialog');if(!dlg)return toast('Formato Incubadora Microbiología EI-364 no disponible');const cfg=incMicroConfig(def);$('#incMicroChartId').value=def.id;$('#incMicroAnalystId').value=analystId||'';$('#incMicroDate').value=date||dateToday();$('#incMicroTime').value=new Date().toTimeString().slice(0,5);$('#incMicroTemp').value='';$('#incMicroNotes').value='';$('#incMicroPreview').innerHTML='';$('#incMicroCriterion').textContent=`${cfg.criterion.min.toFixed(1)}–${cfg.criterion.max.toFixed(1)} °C`;$('#incMicroTarget').textContent=`${Number(cfg.target).toFixed(1)} °C`;$('#incMicroConfig').classList.toggle('hidden',currentSessionUser?.role!=='JEFE');$('#incMicroMin').value=cfg.criterion.min;$('#incMicroMax').value=cfg.criterion.max;$('#incMicroTargetInput').value=cfg.target;$('#incMicroEffective').value=cfg.effectiveFrom||dateToday();await renderIncMicro(def.id);const same=completedRec||(await incMicroRecords(def.id)).find(r=>String(r.measuredAt||'').slice(0,10)===(date||dateToday()));const btn=$('#incMicroSave');btn.disabled=!!same;btn.textContent=same?'✓ Control ya completado hoy':'Guardar control Incubadora EI-364';if(same)$('#incMicroPreview').innerHTML=`<div class="dbo5-result ok"><b>✓ COMPLETADA HOY</b><br>${escapeHtml(same.analystName||'Analista')} · ${Number(same.tempRaw).toFixed(2)} °C · ${escapeHtml(same.overallResult||'—')}. Una sola ejecución diaria cubre las actividades vinculadas.</div>`;if(typeof dlg.showModal==='function')dlg.showModal();else dlg.setAttribute('open','');}
async function previewIncMicro(){const def=await getOne('controlChartDefs',$('#incMicroChartId')?.value),box=$('#incMicroPreview');if(!def||!box)return;const c=incMicroCalc($('#incMicroTemp').value,incMicroConfig(def));if(!c.valid){box.innerHTML='';return}const cfg=incMicroConfig(def),delta=c.raw-Number(cfg.target);box.innerHTML=`<div class="dbo5-result ${c.ok?'ok':'bad'}"><b>${c.ok?'CUMPLE':'NO CUMPLE'} · ${c.raw.toFixed(2)} °C</b><br>Objetivo ${Number(cfg.target).toFixed(1)} °C · desviación ${delta>=0?'+':''}${delta.toFixed(2)} °C · criterio ${cfg.criterion.min.toFixed(1)}–${cfg.criterion.max.toFixed(1)} °C. ${c.ok?'Dentro del rango técnico.':'Fuera del rango: documente la novedad y revise condición/equipo antes de continuar.'}</div>`;}
async function saveIncMicroControl(e){e.preventDefault();const chartId=$('#incMicroChartId').value,analystId=$('#incMicroAnalystId').value,def=await getOne('controlChartDefs',chartId);if(!def)return;const cfg=incMicroConfig(def),c=incMicroCalc($('#incMicroTemp').value,cfg),date=$('#incMicroDate').value,time=$('#incMicroTime').value;if(!c.valid)return toast('Ingrese una temperatura válida');const all=await getAll('controlChartRecords'),same=all.find(r=>r.chartId===chartId&&r.controlType==='INCUBADORA_MICROBIOLOGIA_EI364'&&String(r.measuredAt||'').slice(0,10)===date);if(same)return toast(`✓ EI-364 ya fue completada hoy por ${same.analystName||'otro analista'}. No se permite duplicar.`);const analysts=await getAll('analysts'),a=analysts.find(x=>x.id===analystId),existing=await incMicroRecords(chartId),vals=[...existing.map(r=>Number(r.tempRaw)),c.raw],w=dbo5Westgard(vals),stat=vals.length<10?'ESTABLECIMIENTO':w.state;const rec={id:uid('CCR'),chartId,controlType:'INCUBADORA_MICROBIOLOGIA_EI364',section:'MICROBIOLOGIA',methodName:def.methodName||'Microbiología',equipment:'EI-364',area:'Microbiología',analystId,analystName:a?.name||firebaseBridge?.authUser?.email||'Usuario',measuredAt:`${date}T${time}:00`,tempRaw:c.raw,tempEvaluated:c.raw,target:Number(cfg.target),tempCriterion:{...cfg.criterion},configSnapshot:JSON.parse(JSON.stringify(cfg)),overallResult:c.ok?'CUMPLE':'NO CUMPLE',statisticalState:stat,statisticalRules:w.rules||[],notes:$('#incMicroNotes').value.trim(),schemaVersion:1,createdAt:nowISO(),updatedAt:nowISO()};await put('controlChartRecords',rec);await queue('CREATE','controlChartRecords',rec);await createControlChartCompletionAlert(rec,def);await audit('REGISTRAR','INCUBADORA_MICROBIOLOGIA_EI364',rec.id,`${rec.overallResult} · ${c.raw.toFixed(2)} °C · criterio ${cfg.criterion.min}-${cfg.criterion.max}`);toast('Control Incubadora EI-364 guardado y sincronizando');await renderIncMicro(chartId);$('#incMicroSave').disabled=true;$('#incMicroSave').textContent='✓ Control ya completado hoy';}
async function saveIncMicroConfig(){if(currentSessionUser?.role!=='JEFE')return toast('Solo JEFE/Calidad puede modificar límites');const id=$('#incMicroChartId').value,def=await getOne('controlChartDefs',id);if(!def)return;const min=Number($('#incMicroMin').value),max=Number($('#incMicroMax').value),target=Number($('#incMicroTargetInput').value);if(![min,max,target].every(Number.isFinite)||max<=min||target<min||target>max)return toast('Revise límite inferior, objetivo y límite superior');const old=incMicroConfig(def);def.microbiologyIncubatorConfig={equipment:'EI-364',area:'Microbiología',target,criterion:{min,max},effectiveFrom:$('#incMicroEffective').value||dateToday(),reference:'PEC2601-03 Control Incubadora (EI364)',version:Number(old.version||1)+1};def.updatedAt=nowISO();await put('controlChartDefs',def);await queue('UPDATE','controlChartDefs',def);await audit('CONFIGURAR','INCUBADORA_MICROBIOLOGIA_EI364',def.id,`Límites ${min}-${max} °C · objetivo ${target} °C`);$('#incMicroCriterion').textContent=`${min.toFixed(1)}–${max.toFixed(1)} °C`;$('#incMicroTarget').textContent=`${target.toFixed(1)} °C`;await previewIncMicro();toast('Configuración EI-364 actualizada y sincronizando');}
async function renderIncMicro(chartId){const rows=await incMicroRecords(chartId),body=$('#incMicroHistory');if(!body)return;const vals=rows.map(r=>Number(r.tempRaw)).filter(Number.isFinite),w=dbo5Westgard(vals);$('#incMicroCount').textContent=`${rows.length} registros`;$('#incMicroStats').innerHTML=rows.length<10?`<div><small>Estado estadístico</small><b>FASE DE ESTABLECIMIENTO</b></div><div><small>Datos requeridos</small><b>${rows.length}/10</b></div><div><small>Temperatura</small><b>${rows.length?mean(vals).toFixed(2)+' °C':'—'}</b></div>`:`<div><small>Media ± s</small><b>${mean(vals).toFixed(2)} ± ${sd(vals).toFixed(2)} °C</b></div><div><small>Estado</small><b>${w.state}</b></div><div><small>Reglas</small><b>${(w.rules||[]).join(', ')||'Sin alarmas'}</b></div>`;body.innerHTML=rows.slice().reverse().map(r=>`<tr><td>${escapeHtml(String(r.measuredAt||'').replace('T',' ').slice(0,16))}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${Number(r.tempRaw).toFixed(2)}</td><td>${Number(r.target??35).toFixed(1)}</td><td>${Number(r.tempCriterion?.min??34.5).toFixed(1)}–${Number(r.tempCriterion?.max??35.5).toFixed(1)}</td><td><span class="badge">${escapeHtml(r.overallResult||'—')}</span></td><td>${escapeHtml(r.statisticalState||'ESTABLECIMIENTO')}</td></tr>`).join('')||'<tr><td colspan="7">Sin registros todavía.</td></tr>';const ai=$('#incMicroAi');if(!rows.length)ai.innerHTML='<b>IA:</b> Aún no existen registros de EI-364. El primer control iniciará una serie propia, separada de EI-306.';else{const last=rows.at(-1);ai.innerHTML=`<b>IA · Diagnóstico:</b> Último control <b>${last.overallResult}</b> con ${Number(last.tempRaw).toFixed(2)} °C. ${rows.length<10?`Hay ${rows.length}/10 registros; fase de establecimiento.`:`Estado estadístico: <b>${w.state}</b>${w.rules?.length?'. Señales: '+w.rules.join(', '):'. Sin señales de alarma.'}`} ${last.overallResult==='NO CUMPLE'?'Revisar estabilidad térmica, puerta, carga, ubicación del sensor y documentar acción antes de liberar el uso.':'Mantener vigilancia diaria.'}`;}}
async function renderIncMicroManagement(def,month){resetControlChartManagementUI();const all=await incMicroRecords(def.id),rows=all.filter(r=>String(r.measuredAt||'').startsWith(month)),cfg=incMicroConfig(def),vals=rows.map(r=>Number(r.tempRaw)).filter(Number.isFinite),ok=rows.filter(r=>r.overallResult==='CUMPLE').length,w=dbo5Westgard(vals);$('#ccChart1Title').textContent='Incubadora Microbiología EI-364 · Temperatura';$('#ccChart1Desc').textContent=`Lectura, media, ±1s, ±2s, ±3s y límites técnicos ${cfg.criterion.min.toFixed(1)}–${cfg.criterion.max.toFixed(1)} °C.`;$('#ccChart2Title').textContent='Decisión y trazabilidad';$('#ccChart2Desc').textContent='Objetivo, límites vigentes y vigilancia estadística independiente de EI-306.';$('#ccCount').textContent=`${rows.length} registros · ${month}`;$('#ccHistoryHead').innerHTML='<tr><th>Fecha/hora</th><th>Responsable</th><th>Temperatura</th><th>Objetivo</th><th>Criterio</th><th>Resultado</th><th>Estadístico</th></tr>';if(!rows.length){showControlChartNoData('Incubadora Microbiología EI-364',month);return;}$('#ccKpis').innerHTML=`<div><small>Controles</small><b>${rows.length}</b><span>${month}</span></div><div><small>Cumplimiento</small><b>${(ok/rows.length*100).toFixed(1)}%</b><span>${ok}/${rows.length} cumplen</span></div><div><small>Media ± s</small><b>${mean(vals).toFixed(2)} ± ${sd(vals).toFixed(2)} °C</b><span>mín ${Math.min(...vals).toFixed(2)} · máx ${Math.max(...vals).toFixed(2)}</span></div><div><small>Equipo</small><b>EI-364</b><span>Microbiología</span></div>`;$('#ccTempState').textContent=rows.length<10?'ESTABLECIMIENTO':w.state;$('#ccHumState').textContent='CRITERIO';$('#ccTempChart').innerHTML=ccSvgLine(rows,'tempRaw','°C',cfg.criterion.min,cfg.criterion.max);$('#ccHumChart').innerHTML=`<div class="dbo5-ai"><b>PEC2601-03 · EI-364</b><br>Objetivo: ${Number(cfg.target).toFixed(1)} °C<br>Límite inferior: ${cfg.criterion.min.toFixed(1)} °C<br>Límite superior: ${cfg.criterion.max.toFixed(1)} °C<br>Vigente desde: ${escapeHtml(cfg.effectiveFrom||'—')}<br><br>Esta carta no usa ni hereda factores de EI-306.</div>`;const events=[];ccRuleDetails(vals,rows.map(r=>r.measuredAt)).forEach(x=>x.rules.forEach(rule=>events.push({rule,date:x.label})));$('#ccRules').innerHTML=events.length?events.map(e=>`<div class="cc-rule"><b>${escapeHtml(e.rule)}</b><span>Temperatura · ${ccFmtDate(e.date)}</span></div>`).join(''):'<div class="cc-ok">No se detectan reglas de alarma en EI-364.</div>';$('#ccAi').innerHTML=`<b>Diagnóstico mensual EI-364:</b> ${ok}/${rows.length} controles cumplen ${cfg.criterion.min.toFixed(1)}–${cfg.criterion.max.toFixed(1)} °C. ${rows.length<10?'La serie está en FASE DE ESTABLECIMIENTO hasta completar 10 registros.':`Estado estadístico: <b>${w.state}</b>.`} ${w.rules?.length?'Calidad debe revisar las señales antes de decidir acciones.':'Sin señales estadísticas que requieran acción adicional.'} La IA es asistiva y no modifica límites.`;$('#ccHistoryBody').innerHTML=rows.slice().reverse().map(r=>`<tr><td>${ccFmtDate(r.measuredAt)}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${Number(r.tempRaw).toFixed(2)} °C</td><td>${Number(r.target??35).toFixed(1)} °C</td><td>${Number(r.tempCriterion?.min??34.5).toFixed(1)}–${Number(r.tempCriterion?.max??35.5).toFixed(1)} °C</td><td><span class="badge">${escapeHtml(r.overallResult||'—')}</span></td><td>${escapeHtml(r.statisticalState||'ESTABLECIMIENTO')}</td></tr>`).join('');}


function isMicrobiologyIncubatorChart(d){if(!d)return false;const n=normalizeIdentityText(d.name||''),m=normalizeIdentityText(d.methodName||''),k=normalizeIdentityText(d.controlKey||d.equipmentKey||'');const bath=(n.includes('bano de maria')||n.includes('bano maria')||m.includes('bano de maria')||m.includes('bano maria')||k.includes('bano de maria')||k.includes('bano maria'));return bath&&(hasEquipmentIdentity(d.name,'EI-364')||hasEquipmentIdentity(d.methodName,'EI-364')||hasEquipmentIdentity(d.controlKey||d.equipmentKey,'EI-364')||k.includes('ei 364')||n.includes('ei 364')||m.includes('ei 364'));}
function microIncDefaultConfig(){return {equipment:'EI-364',area:'Microbiología',target:44.5,criterion:{min:44.0,max:45.0},effectiveFrom:dateToday(),reference:'PEC2601-03 Control Baño María G (EI364)',version:1};}
function microIncConfig(def){const d=microIncDefaultConfig(),c=def?.bathMariaConfig||{};return {...d,...c,criterion:{...d.criterion,...(c.criterion||{})}};}
function microIncCalc(v,cfg){const raw=Number(v),ok=Number.isFinite(raw)&&raw>=Number(cfg.criterion.min)&&raw<=Number(cfg.criterion.max);return {valid:Number.isFinite(raw),raw,ok};}
async function microIncRecords(chartId){return (await getAll('controlChartRecords')).filter(r=>r.chartId===chartId&&r.controlType==='BANO_MARIA_EI364').sort((a,b)=>String(a.measuredAt).localeCompare(String(b.measuredAt)));}
async function openMicroIncubatorControl(def,date,analystId,completedRec){const dlg=$('#microIncControlDialog');if(!dlg)return toast('Formato Baño de María EI-364 no disponible');const cfg=microIncConfig(def);$('#microIncChartId').value=def.id;$('#microIncAnalystId').value=analystId||'';$('#microIncDate').value=date||dateToday();$('#microIncTime').value=new Date().toTimeString().slice(0,5);$('#microIncTemp').value='';$('#microIncNotes').value='';$('#microIncPreview').innerHTML='';$('#microIncCriterion').textContent=`${cfg.criterion.min.toFixed(1)}–${cfg.criterion.max.toFixed(1)} °C`;$('#microIncTarget').textContent=`${Number(cfg.target).toFixed(1)} °C`;$('#microIncConfig').classList.toggle('hidden',currentSessionUser?.role!=='JEFE');$('#microIncMin').value=cfg.criterion.min;$('#microIncMax').value=cfg.criterion.max;$('#microIncTargetInput').value=cfg.target;$('#microIncEffective').value=cfg.effectiveFrom||dateToday();await renderMicroIncubator(def.id);const same=completedRec||(await microIncRecords(def.id)).find(r=>String(r.measuredAt||'').slice(0,10)===(date||dateToday()));const btn=$('#microIncSave');btn.disabled=!!same;btn.textContent=same?'✓ Control ya completado hoy':'Guardar control Baño de María EI-364';if(same)$('#microIncPreview').innerHTML=`<div class="dbo5-result ok"><b>✓ COMPLETADA HOY</b><br>${escapeHtml(same.analystName||'Analista')} · ${Number(same.tempRaw).toFixed(2)} °C · ${escapeHtml(same.overallResult||'—')}. Una sola ejecución diaria cubre las actividades vinculadas.</div>`;if(typeof dlg.showModal==='function')dlg.showModal();else dlg.setAttribute('open','');}
async function previewMicroIncubator(){const def=await getOne('controlChartDefs',$('#microIncChartId')?.value),box=$('#microIncPreview');if(!def||!box)return;const c=microIncCalc($('#microIncTemp').value,microIncConfig(def));if(!c.valid){box.innerHTML='';return}const cfg=microIncConfig(def),delta=c.raw-Number(cfg.target);box.innerHTML=`<div class="dbo5-result ${c.ok?'ok':'bad'}"><b>${c.ok?'CUMPLE':'NO CUMPLE'} · ${c.raw.toFixed(2)} °C</b><br>Línea central ${Number(cfg.target).toFixed(1)} °C · desviación ${delta>=0?'+':''}${delta.toFixed(2)} °C · límites ${cfg.criterion.min.toFixed(1)}–${cfg.criterion.max.toFixed(1)} °C. ${c.ok?'Dentro del rango técnico.':'Fuera de límites: documente la novedad, verifique estabilidad térmica y no dé por conforme el control hasta revisar la causa.'}</div>`;}
async function saveMicroIncubatorControl(e){e.preventDefault();const chartId=$('#microIncChartId').value,analystId=$('#microIncAnalystId').value,def=await getOne('controlChartDefs',chartId);if(!def)return;const cfg=microIncConfig(def),c=microIncCalc($('#microIncTemp').value,cfg),date=$('#microIncDate').value,time=$('#microIncTime').value;if(!c.valid)return toast('Ingrese una temperatura válida');const all=await getAll('controlChartRecords'),same=all.find(r=>r.chartId===chartId&&r.controlType==='BANO_MARIA_EI364'&&String(r.measuredAt||'').slice(0,10)===date);if(same)return toast(`✓ Baño de María EI-364 ya fue completado hoy por ${same.analystName||'otro analista'}. No se permite duplicar.`);const analysts=await getAll('analysts'),a=analysts.find(x=>x.id===analystId),existing=await microIncRecords(chartId),vals=[...existing.map(r=>Number(r.tempRaw)),c.raw],w=dbo5Westgard(vals),stat=vals.length<10?'ESTABLECIMIENTO':w.state;const rec={id:uid('CCR'),chartId,controlType:'BANO_MARIA_EI364',section:'MICROBIOLOGIA',methodName:def.methodName||'Microbiología',equipment:'EI-364',area:'Microbiología',analystId,analystName:a?.name||firebaseBridge?.authUser?.email||'Usuario',measuredAt:`${date}T${time}:00`,tempRaw:c.raw,tempEvaluated:c.raw,target:Number(cfg.target),tempCriterion:{...cfg.criterion},configSnapshot:JSON.parse(JSON.stringify(cfg)),overallResult:c.ok?'CUMPLE':'NO CUMPLE',statisticalState:stat,statisticalRules:w.rules||[],notes:$('#microIncNotes').value.trim(),schemaVersion:1,createdAt:nowISO(),updatedAt:nowISO()};await put('controlChartRecords',rec);await queue('CREATE','controlChartRecords',rec);await createControlChartCompletionAlert(rec,def);await audit('REGISTRAR','BANO_MARIA_EI364',rec.id,`${rec.overallResult} · ${c.raw.toFixed(2)} °C · límites ${cfg.criterion.min}-${cfg.criterion.max}`);toast('Control Baño de María EI-364 guardado y sincronizando');await renderMicroIncubator(chartId);$('#microIncSave').disabled=true;$('#microIncSave').textContent='✓ Control ya completado hoy';}
async function saveMicroIncConfig(){if(currentSessionUser?.role!=='JEFE')return toast('Solo JEFE/Calidad puede modificar límites');const id=$('#microIncChartId').value,def=await getOne('controlChartDefs',id);if(!def)return;const min=Number($('#microIncMin').value),max=Number($('#microIncMax').value),target=Number($('#microIncTargetInput').value);if(![min,max,target].every(Number.isFinite)||max<=min||target<min||target>max)return toast('Revise límite inferior, línea central y límite superior');const old=microIncConfig(def);def.bathMariaConfig={equipment:'EI-364',area:'Microbiología',target,criterion:{min,max},effectiveFrom:$('#microIncEffective').value||dateToday(),reference:'PEC2601-03 Control Baño María G (EI364)',version:Number(old.version||1)+1};def.updatedAt=nowISO();await put('controlChartDefs',def);await queue('UPDATE','controlChartDefs',def);await audit('CONFIGURAR','BANO_MARIA_EI364',def.id,`Límites ${min}-${max} °C · línea central ${target} °C`);$('#microIncCriterion').textContent=`${min.toFixed(1)}–${max.toFixed(1)} °C`;$('#microIncTarget').textContent=`${target.toFixed(1)} °C`;await previewMicroIncubator();toast('Configuración Baño de María EI-364 actualizada y sincronizando');}
async function renderMicroIncubator(chartId){const rows=await microIncRecords(chartId),body=$('#microIncHistory');if(!body)return;const vals=rows.map(r=>Number(r.tempRaw)).filter(Number.isFinite),w=dbo5Westgard(vals);$('#microIncCount').textContent=`${rows.length} registros`;$('#microIncStats').innerHTML=rows.length<10?`<div><small>Estado estadístico</small><b>FASE DE ESTABLECIMIENTO</b></div><div><small>Datos requeridos</small><b>${rows.length}/10</b></div><div><small>Media observada</small><b>${rows.length?mean(vals).toFixed(2)+' °C':'—'}</b></div>`:`<div><small>Media ± s</small><b>${mean(vals).toFixed(2)} ± ${sd(vals).toFixed(2)} °C</b></div><div><small>Estado</small><b>${w.state}</b></div><div><small>Reglas</small><b>${(w.rules||[]).join(', ')||'Sin alarmas'}</b></div>`;body.innerHTML=rows.slice().reverse().map(r=>`<tr><td>${escapeHtml(String(r.measuredAt||'').replace('T',' ').slice(0,16))}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${Number(r.tempRaw).toFixed(2)}</td><td>${Number(r.target??44.5).toFixed(1)}</td><td>${Number(r.tempCriterion?.min??44).toFixed(1)}–${Number(r.tempCriterion?.max??45).toFixed(1)}</td><td><span class="badge">${escapeHtml(r.overallResult||'—')}</span></td><td>${escapeHtml(r.statisticalState||'ESTABLECIMIENTO')}</td></tr>`).join('')||'<tr><td colspan="7">Sin registros todavía.</td></tr>';const ai=$('#microIncAi');if(!rows.length)ai.innerHTML='<b>IA:</b> Aún no existen registros del Baño de María EI-364. El primer control iniciará la trazabilidad estadística con línea central 44.5 °C y límites técnicos 44.0–45.0 °C.';else{const last=rows.at(-1);ai.innerHTML=`<b>IA · Diagnóstico:</b> Último control <b>${last.overallResult}</b> con ${Number(last.tempRaw).toFixed(2)} °C. ${rows.length<10?`Hay ${rows.length}/10 registros; fase de establecimiento.`:`Estado estadístico: <b>${w.state}</b>${w.rules?.length?'. Señales: '+w.rules.join(', '):'. Sin señales de alarma.'}`} ${last.overallResult==='NO CUMPLE'?'Acción sugerida: revisar nivel de agua, estabilidad térmica, tapa, ubicación del sensor y tiempo de estabilización; documentar la acción y repetir el control antes de liberar el uso.':'Mantener vigilancia diaria y observar tendencias alrededor de 44.5 °C.'}`;}}
async function renderMicroIncubatorManagement(def,month){resetControlChartManagementUI();const all=await microIncRecords(def.id),rows=all.filter(r=>String(r.measuredAt||'').startsWith(month)),cfg=microIncConfig(def),vals=rows.map(r=>Number(r.tempRaw)).filter(Number.isFinite),ok=rows.filter(r=>r.overallResult==='CUMPLE').length,w=dbo5Westgard(vals);$('#ccChart1Title').textContent='Baño de María EI-364 · Temperatura';$('#ccChart1Desc').textContent=`Lectura, media, ±1s, ±2s, ±3s y límites técnicos ${cfg.criterion.min.toFixed(1)}–${cfg.criterion.max.toFixed(1)} °C.`;$('#ccChart2Title').textContent='Criterio, decisión y trazabilidad';$('#ccChart2Desc').textContent='Línea central 44.5 °C, límites técnicos, cumplimiento y vigilancia Westgard/Shewhart.';$('#ccCount').textContent=`${rows.length} registros · ${month}`;$('#ccHistoryHead').innerHTML='<tr><th>Fecha/hora</th><th>Responsable</th><th>Temperatura</th><th>Línea central</th><th>Límites</th><th>Resultado</th><th>Estadístico</th></tr>';if(!rows.length){showControlChartNoData('Baño de María EI-364',month);return;}$('#ccKpis').innerHTML=`<div><small>Controles</small><b>${rows.length}</b><span>${month}</span></div><div><small>Cumplimiento</small><b>${(ok/rows.length*100).toFixed(1)}%</b><span>${ok}/${rows.length} cumplen</span></div><div><small>Media ± s</small><b>${mean(vals).toFixed(2)} ± ${sd(vals).toFixed(2)} °C</b><span>mín ${Math.min(...vals).toFixed(2)} · máx ${Math.max(...vals).toFixed(2)}</span></div><div><small>Equipo</small><b>EI-364</b><span>Baño de María · Microbiología</span></div>`;$('#ccTempState').textContent=rows.length<10?'ESTABLECIMIENTO':w.state;$('#ccHumState').textContent='CRITERIO';$('#ccTempChart').innerHTML=ccSvgLine(rows,'tempRaw','°C',cfg.criterion.min,cfg.criterion.max);$('#ccHumChart').innerHTML=`<div class="dbo5-ai"><b>PEC2601-03 · Baño de María EI-364</b><br>Línea central: ${Number(cfg.target).toFixed(1)} °C<br>Límite inferior: ${cfg.criterion.min.toFixed(1)} °C<br>Límite superior: ${cfg.criterion.max.toFixed(1)} °C<br>Vigente desde: ${escapeHtml(cfg.effectiveFrom||'—')}<br><br>La IA es asistiva: detecta cumplimiento, tendencias y reglas estadísticas, pero no modifica los límites aprobados por Calidad.</div>`;const events=[];ccRuleDetails(vals,rows.map(r=>r.measuredAt)).forEach(x=>x.rules.forEach(rule=>events.push({rule,date:x.label})));$('#ccRules').innerHTML=events.length?events.map(e=>`<div class="cc-rule"><b>${escapeHtml(e.rule)}</b><span>Temperatura · ${ccFmtDate(e.date)}</span></div>`).join(''):'<div class="cc-ok">No se detectan reglas de alarma en Baño de María EI-364.</div>';$('#ccAi').innerHTML=`<b>Diagnóstico mensual Baño de María EI-364:</b> ${ok}/${rows.length} controles cumplen ${cfg.criterion.min.toFixed(1)}–${cfg.criterion.max.toFixed(1)} °C. ${rows.length<10?'La serie está en FASE DE ESTABLECIMIENTO hasta completar 10 registros.':`Estado estadístico: <b>${w.state}</b>.`} ${w.rules?.length?'Calidad debe revisar las señales, su secuencia y posibles causas antes de decidir la acción.':'Sin señales estadísticas que requieran acción adicional.'} Si existe NO CUMPLE, revisar estabilidad, nivel de agua, tapa, sensor y tiempo de estabilización antes de liberar el equipo.`;$('#ccHistoryBody').innerHTML=rows.slice().reverse().map(r=>`<tr><td>${ccFmtDate(r.measuredAt)}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${Number(r.tempRaw).toFixed(2)} °C</td><td>${Number(r.target??44.5).toFixed(1)} °C</td><td>${Number(r.tempCriterion?.min??44).toFixed(1)}–${Number(r.tempCriterion?.max??45).toFixed(1)} °C</td><td><span class="badge">${escapeHtml(r.overallResult||'—')}</span></td><td>${escapeHtml(r.statisticalState||'ESTABLECIMIENTO')}</td></tr>`).join('');}

// 6.33.23 · Condiciones ambientales MICROBIOLOGIA · MC1602-08
function isMicrobiologyEnvironmentChart(d){if(!d)return false;const n=normalizeIdentityText(d.name||''),m=normalizeIdentityText(d.methodName||''),k=normalizeIdentityText(d.controlKey||d.equipmentKey||'');return (n.includes('condiciones ambientales')&&n.includes('microbiologia'))||(m.includes('condiciones ambientales')&&m.includes('microbiologia'))||k.includes('microbiologia ambiente')||hasEquipmentIdentity(d.name,'EI-347')||hasEquipmentIdentity(d.controlKey||d.equipmentKey,'EI-347');}
function microEnvDefaultConfig(){return {equipment:'EI-347',reference:'PF-09',area:'Microbiología',tempCriterion:{min:15,max:25},humCriterion:{max:80},tempCorrectionRanges:[{min:-50,max:15,factor:0},{min:15,max:25,factor:-0.20},{min:25,max:100,factor:0}],humCorrectionRanges:[{min:0,max:20,factor:0},{min:20,max:40,factor:-2.10},{min:40,max:100,factor:-1.00}],effectiveFrom:dateToday(),certificateRef:'MC1602-08 · Termohigrómetro EI/347 · verificación semestral con PF/09',version:1};}
function microEnvConfig(def){const d=microEnvDefaultConfig(),c=def?.metrologyConfig?.equipment==='EI-347'?def.metrologyConfig:{};return {...d,...c,tempCriterion:{...d.tempCriterion,...(c.tempCriterion||{})},humCriterion:{...d.humCriterion,...(c.humCriterion||{})},tempCorrectionRanges:Array.isArray(c.tempCorrectionRanges)&&c.tempCorrectionRanges.length?c.tempCorrectionRanges:d.tempCorrectionRanges,humCorrectionRanges:Array.isArray(c.humCorrectionRanges)&&c.humCorrectionRanges.length?c.humCorrectionRanges:d.humCorrectionRanges};}
function microEnvRange(v,ranges){const n=Number(v);if(!Number.isFinite(n))return null;return ranges.find((r,i)=>n>=Number(r.min)&&(i===ranges.length-1?n<=Number(r.max):n<Number(r.max)))||null;}
function microEnvCalc(t,h,cfg){const tr=microEnvRange(t,cfg.tempCorrectionRanges),hr=microEnvRange(h,cfg.humCorrectionRanges);if(!tr||!hr)return {valid:false};const rawT=Number(t),rawH=Number(h),tc=rawT+Number(tr.factor),hc=rawH+Number(hr.factor),tok=tc>=Number(cfg.tempCriterion.min)&&tc<=Number(cfg.tempCriterion.max),hok=hc<=Number(cfg.humCriterion.max);return {valid:true,rawT,rawH,tc,hc,tf:Number(tr.factor),hf:Number(hr.factor),tr,hr,tok,hok,ok:tok&&hok};}
async function microEnvRecords(chartId){return (await getAll('controlChartRecords')).filter(r=>r.chartId===chartId&&(r.controlType==='MICROBIOLOGIA_AMBIENTE_EI347'||(r.historicalEntry===true&&r.controlType==='MICRO_AMBIENTAL'))).sort((a,b)=>String(a.measuredAt).localeCompare(String(b.measuredAt)));}
function renderMicroEnvConfig(def){const cfg=microEnvConfig(def),sec=$('#microEnvConfigSection');if(sec)sec.classList.toggle('hidden',currentSessionUser?.role!=='JEFE');if(currentSessionUser?.role!=='JEFE')return;$('#microEnvTempMin').value=cfg.tempCriterion.min;$('#microEnvTempMax').value=cfg.tempCriterion.max;$('#microEnvHumMax').value=cfg.humCriterion.max;$('#microEnvEffectiveFrom').value=cfg.effectiveFrom||dateToday();$('#microEnvCertificateRef').value=cfg.certificateRef||'';$('#microEnvTempCorrectionRows').innerHTML=cfg.tempCorrectionRanges.map(r=>`<div class="inc-config-row"><input data-menv-tmin type="number" step="0.01" value="${r.min}"><input data-menv-tmax type="number" step="0.01" value="${r.max}"><input data-menv-tfactor type="number" step="0.01" value="${r.factor}"></div>`).join('');$('#microEnvHumCorrectionRows').innerHTML=cfg.humCorrectionRanges.map(r=>`<div class="inc-config-row"><input data-menv-hmin type="number" step="0.01" value="${r.min}"><input data-menv-hmax type="number" step="0.01" value="${r.max}"><input data-menv-hfactor type="number" step="0.01" value="${r.factor}"></div>`).join('');}
async function openMicroEnvControl(def,date,analystId,completedRec){const dlg=$('#microEnvControlDialog');if(!dlg)return toast('Formato de Condiciones Ambientales de Microbiología no disponible');$('#microEnvChartId').value=def.id;$('#microEnvAnalystId').value=analystId||'';$('#microEnvInputDate').value=date||dateToday();$('#microEnvTime').value=new Date().toTimeString().slice(0,5);$('#microEnvTempRaw').value='';$('#microEnvHumRaw').value='';$('#microEnvNotes').value='';$('#microEnvPreview').innerHTML='';renderMicroEnvConfig(def);await renderMicroEnv(def.id);const existing=completedRec||(await microEnvRecords(def.id)).find(r=>String(r.measuredAt||'').slice(0,10)===(date||dateToday()));const submit=$('#microEnvControlForm button[type="submit"]');for(const id of ['microEnvTempRaw','microEnvHumRaw','microEnvNotes'])$('#'+id).disabled=!!existing;if(existing){$('#microEnvTempRaw').value=Number(existing.tempRaw).toFixed(2);$('#microEnvHumRaw').value=Number(existing.humRaw).toFixed(1);$('#microEnvNotes').value=existing.notes||'';submit.disabled=true;submit.textContent=`✓ COMPLETADA HOY · ${existing.analystName||'Responsable'}`;$('#microEnvPreview').innerHTML=`<div class="preview-ok"><b>Control diario ya realizado.</b><span>${Number(existing.tempCorrected).toFixed(2)} °C · ${Number(existing.humCorrected).toFixed(1)} %HR · ${existing.overallResult}</span></div>`;}else{submit.disabled=false;submit.textContent='Guardar control ambiental Microbiología';}dlg.showModal?dlg.showModal():dlg.setAttribute('open','');}
function previewMicroEnv(){const id=$('#microEnvChartId')?.value;if(!id)return;getOne('controlChartDefs',id).then(def=>{const cfg=microEnvConfig(def),c=microEnvCalc($('#microEnvTempRaw').value,$('#microEnvHumRaw').value,cfg),box=$('#microEnvPreview');if(!$('#microEnvTempRaw').value&&!$('#microEnvHumRaw').value){box.innerHTML='';return}if(!c.valid){box.innerHTML='<div class="preview-bad"><b>Lectura fuera del rango configurado</b><span>Revise el dato o solicite revisión a Calidad.</span></div>';return}box.innerHTML=`<div class="${c.ok?'preview-ok':'preview-bad'}"><b>${c.ok?'CUMPLE':'NO CUMPLE'}</b><span>Temperatura evaluada ${c.tc.toFixed(2)} °C · criterio ${cfg.tempCriterion.min}–${cfg.tempCriterion.max} °C</span><span>HR evaluada ${c.hc.toFixed(1)} % · criterio ≤ ${cfg.humCriterion.max}%</span></div>`;});}
async function saveMicroEnvConfig(){if(currentSessionUser?.role!=='JEFE')return toast('Solo JEFE/Calidad puede cambiar factores de corrección');const id=$('#microEnvChartId').value,def=await getOne('controlChartDefs',id);if(!def)return;const build=(a,b,c)=>$$(a).map((el,i)=>({min:Number(el.value),max:Number($$(b)[i].value),factor:Number($$(c)[i].value)}));const tr=build('[data-menv-tmin]','[data-menv-tmax]','[data-menv-tfactor]'),hr=build('[data-menv-hmin]','[data-menv-hmax]','[data-menv-hfactor]');if([...tr,...hr].some(r=>![r.min,r.max,r.factor].every(Number.isFinite)||r.max<=r.min))return toast('Revise rangos y factores');const old=microEnvConfig(def);def.metrologyConfig={equipment:'EI-347',reference:'PF-09',area:'Microbiología',tempCriterion:{min:Number($('#microEnvTempMin').value),max:Number($('#microEnvTempMax').value)},humCriterion:{max:Number($('#microEnvHumMax').value)},tempCorrectionRanges:tr.sort((a,b)=>a.min-b.min),humCorrectionRanges:hr.sort((a,b)=>a.min-b.min),effectiveFrom:$('#microEnvEffectiveFrom').value||dateToday(),certificateRef:$('#microEnvCertificateRef').value.trim(),version:Number(old.version||1)+1};def.updatedAt=nowISO();await put('controlChartDefs',def);await queue('UPDATE','controlChartDefs',def);await audit('CONFIGURAR','CARTA_CONTROL_MICRO_AMBIENTE',def.id,`Configuración metrológica v${def.metrologyConfig.version}`);renderMicroEnvConfig(def);previewMicroEnv();toast('Configuración ambiental de Microbiología guardada');}
async function saveMicroEnvControl(e){e.preventDefault();const chartId=$('#microEnvChartId').value,analystId=$('#microEnvAnalystId').value,def=await getOne('controlChartDefs',chartId),cfg=microEnvConfig(def),date=$('#microEnvInputDate').value,time=$('#microEnvTime').value,c=microEnvCalc($('#microEnvTempRaw').value,$('#microEnvHumRaw').value,cfg);if(!c.valid)return toast('Revise temperatura y humedad.');const all=await getAll('controlChartRecords');if(all.some(x=>x.chartId===chartId&&String(x.measuredAt||'').slice(0,10)===date))return toast('El control ambiental de Microbiología ya fue completado hoy.');const a=(await getAll('analysts')).find(x=>x.id===analystId),existing=await microEnvRecords(chartId),tv=[...existing.map(r=>Number(r.tempCorrected)),c.tc],hv=[...existing.map(r=>Number(r.humCorrected)),c.hc],tw=dbo5Westgard(tv),hw=dbo5Westgard(hv),stat=existing.length+1<10?'ESTABLECIMIENTO':(tw.state==='FUERA DE CONTROL'||hw.state==='FUERA DE CONTROL'?'FUERA DE CONTROL':'BAJO CONTROL');const rec={id:`CCR-MICRO-AMBIENTE-${String(chartId).replace(/[^a-zA-Z0-9_-]/g,'_')}-${date}`,chartId,controlType:'MICROBIOLOGIA_AMBIENTE_EI347',section:def?.section||'MICROBIOLOGIA',methodName:def?.methodName||'Condiciones ambientales MICROBIOLOGIA',area:'Microbiología',equipment:'EI-347',reference:'PF-09',analystId,analystName:a?.name||currentSessionUser?.name||'Usuario',measuredAt:`${date}T${time}:00`,tempRaw:c.rawT,tempFactor:c.tf,tempCorrected:c.tc,humRaw:c.rawH,humFactor:c.hf,humCorrected:c.hc,tempCriterion:{...cfg.tempCriterion},humCriterion:{...cfg.humCriterion},tempCorrectionRangeSnapshot:{...c.tr},humCorrectionRangeSnapshot:{...c.hr},metrologyConfigSnapshot:JSON.parse(JSON.stringify(cfg)),overallResult:c.ok?'CUMPLE':'NO CUMPLE',statisticalState:stat,statisticalRules:[...(tw.rules||[]).map(x=>'T:'+x),...(hw.rules||[]).map(x=>'HR:'+x)],notes:$('#microEnvNotes').value.trim(),schemaVersion:1,createdAt:nowISO(),updatedAt:nowISO()};await put('controlChartRecords',rec);await queue('CREATE','controlChartRecords',rec);await createControlChartCompletionAlert(rec,def);await audit('REGISTRAR','CARTA_CONTROL_MICRO_AMBIENTE',rec.id,`${rec.overallResult} · T ${c.tc.toFixed(2)} °C · HR ${c.hc.toFixed(1)} %`);toast('Control ambiental de Microbiología guardado y sincronizado');await renderMicroEnv(chartId);await renderMyDayControlCharts(date,analystId);}
async function renderMicroEnv(chartId){const rows=await microEnvRecords(chartId),body=$('#microEnvHistoryBody');if(!body)return;const tv=rows.map(r=>Number(r.tempCorrected)),hv=rows.map(r=>Number(r.humCorrected)),tw=dbo5Westgard(tv),hw=dbo5Westgard(hv);$('#microEnvHistoryCount').textContent=`${rows.length} registros`;$('#microEnvStats').innerHTML=rows.length<10?`<div><small>Estado estadístico</small><b>FASE DE ESTABLECIMIENTO</b></div><div><small>Datos requeridos</small><b>${rows.length}/10</b></div>`:`<div><small>Temperatura media ± s</small><b>${mean(tv).toFixed(2)} ± ${sd(tv).toFixed(2)} °C</b></div><div><small>HR media ± s</small><b>${mean(hv).toFixed(1)} ± ${sd(hv).toFixed(1)} %</b></div><div><small>Estado</small><b>${tw.state==='FUERA DE CONTROL'||hw.state==='FUERA DE CONTROL'?'FUERA DE CONTROL':'BAJO CONTROL'}</b></div>`;body.innerHTML=rows.slice().reverse().map(r=>`<tr><td>${escapeHtml(String(r.measuredAt||'').replace('T',' ').slice(0,16))}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${Number(r.tempRaw).toFixed(2)}</td><td>${Number(r.tempCorrected).toFixed(2)}</td><td>${Number(r.humRaw).toFixed(1)}</td><td>${Number(r.humCorrected).toFixed(1)}</td><td><span class="badge">${r.overallResult}</span></td><td>${escapeHtml(r.statisticalState||'ESTABLECIMIENTO')}</td></tr>`).join('')||'<tr><td colspan="8">Sin registros todavía.</td></tr>';const ai=$('#microEnvAi');if(!rows.length)ai.innerHTML='<b>IA:</b> El primer control iniciará la trazabilidad ambiental de Microbiología.';else{const r=rows.at(-1),rules=(r.statisticalRules||[]);ai.innerHTML=`<b>IA · Diagnóstico:</b> El último control <b>${r.overallResult}</b>. T evaluada ${Number(r.tempCorrected).toFixed(2)} °C y HR ${Number(r.humCorrected).toFixed(1)} %. ${rows.length<10?`Hay ${rows.length}/10 registros; fase de establecimiento.`:`Estado estadístico: <b>${r.statisticalState}</b>. ${rules.length?'Señales: '+escapeHtml(rules.join(', '))+'. Revisar causa asignable y documentar acción.':'Sin señales de alarma activas.'}`}`;}}
async function renderMicroEnvManagement(def,month){const rows=(await microEnvRecords(def.id)).filter(r=>String(r.measuredAt||'').startsWith(month));if(!rows.length){showControlChartNoData(def.name||'Condiciones ambientales MICROBIOLOGIA',month);return}const cfg=microEnvConfig(def),tv=rows.map(r=>Number(r.tempCorrected)),hv=rows.map(r=>Number(r.humCorrected)),tw=dbo5Westgard(tv),hw=dbo5Westgard(hv),rules=[...(tw.rules||[]).map(x=>'T:'+x),...(hw.rules||[]).map(x=>'HR:'+x)];$('#ccChart1Title').textContent='Microbiología · Temperatura corregida';$('#ccChart1Desc').textContent=`Media, ±1s, ±2s, ±3s y criterio ${cfg.tempCriterion.min}–${cfg.tempCriterion.max} °C.`;$('#ccChart2Title').textContent='Microbiología · Humedad corregida';$('#ccChart2Desc').textContent=`Media, ±1s, ±2s, ±3s y criterio ≤ ${cfg.humCriterion.max} %HR.`;$('#ccTempChart').innerHTML=ccSvgLine(rows,'tempCorrected','°C',cfg.tempCriterion.min,cfg.tempCriterion.max);$('#ccHumChart').innerHTML=ccSvgLine(rows,'humCorrected','%HR',Math.min(...hv,0),cfg.humCriterion.max);$('#ccCount').textContent=`${rows.length} registros · ${month}`;$('#ccKpis').innerHTML=`<div><small>Termohigrómetro</small><b>EI-347</b></div><div><small>Referencia</small><b>PF-09</b></div><div><small>Criterio T</small><b>15–25 °C</b></div><div><small>Criterio HR</small><b>≤80%</b></div>`;const nc=rows.filter(r=>r.overallResult==='NO CUMPLE').length;$('#ccAi').innerHTML=`<b>IA · Análisis:</b> ${nc?`${nc} control(es) NO CUMPLE. Revisar condiciones del área, climatización, puertas, carga térmica y acción documentada.`:'Cumplimiento técnico del período sin desviaciones.'} ${rules.length?`Se detectan señales estadísticas ${escapeHtml(rules.join(', '))}; evaluar tendencia antes de decidir intervención.`:'No se detectan reglas de alarma con los datos disponibles.'}`;$('#ccRules').innerHTML=`<b>Westgard/Shewhart:</b> ${rows.length<10?'Fase de establecimiento; las señales son preliminares hasta completar 10 registros.':(rules.length?escapeHtml(rules.join(' · ')):'Sin reglas activas.')}<br><small>1_2s = vigilancia; 1_3s/2_2s/R_4s = investigar causa asignable; 7x = desplazamiento; 7T = tendencia. La IA apoya, Calidad decide.</small>`;$('#ccHistoryHead').innerHTML='<tr><th>Fecha/hora</th><th>Responsable</th><th>T leída</th><th>T corregida</th><th>HR leída</th><th>HR corregida</th><th>Resultado</th></tr>';$('#ccHistoryBody').innerHTML=rows.slice().reverse().map(r=>`<tr><td>${ccFmtDate(r.measuredAt)}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${Number(r.tempRaw).toFixed(2)}</td><td>${Number(r.tempCorrected).toFixed(2)}</td><td>${Number(r.humRaw).toFixed(1)}</td><td>${Number(r.humCorrected).toFixed(1)}</td><td>${escapeHtml(r.overallResult)}</td></tr>`).join('');$('#ccTempState').textContent=rows.length<10?'ESTABLECIMIENTO':tw.state;$('#ccHumState').textContent=rows.length<10?'ESTABLECIMIENTO':hw.state;}

function isBalanceEnvChart(d){return isBalanceEnvironmentChart(d);}
function balanceEnvDefaultConfig(){return {equipment:'EI-285',dataLogger:'PF-09',area:'Balanza',tempCriterion:{min:10,max:30},humCriterion:{max:60},tempCorrectionRanges:[{min:0,max:20,factor:-0.25},{min:20,max:35,factor:-0.42}],humCorrectionRanges:[{min:0,max:50,factor:4.43},{min:50,max:80,factor:2.03}],effectiveFrom:dateToday(),certificateRef:'',version:1};}
function balanceEnvConfig(def){const d=balanceEnvDefaultConfig(),c=def?.metrologyConfig?.equipment==='EI-285'?def.metrologyConfig:{};return {...d,...c,tempCriterion:{...d.tempCriterion,...(c.tempCriterion||{})},humCriterion:{...d.humCriterion,...(c.humCriterion||{})},tempCorrectionRanges:Array.isArray(c.tempCorrectionRanges)&&c.tempCorrectionRanges.length?c.tempCorrectionRanges:d.tempCorrectionRanges,humCorrectionRanges:Array.isArray(c.humCorrectionRanges)&&c.humCorrectionRanges.length?c.humCorrectionRanges:d.humCorrectionRanges};}
function balanceEnvRange(v,ranges){const n=Number(v);if(!Number.isFinite(n))return null;return ranges.find((r,i)=>n>=Number(r.min)&&(i===ranges.length-1?n<=Number(r.max):n<Number(r.max)))||null;}
function balanceEnvCalc(t,h,cfg){const tr=balanceEnvRange(t,cfg.tempCorrectionRanges),hr=balanceEnvRange(h,cfg.humCorrectionRanges);if(!tr||!hr)return {valid:false,tempRange:tr,humRange:hr};const rawT=Number(t),rawH=Number(h),tc=rawT+Number(tr.factor),hc=rawH+Number(hr.factor),tok=tc>=Number(cfg.tempCriterion.min)&&tc<=Number(cfg.tempCriterion.max),hok=hc<=Number(cfg.humCriterion.max);return {valid:true,rawT,rawH,tc,hc,tf:Number(tr.factor),hf:Number(hr.factor),tr,hr,tok,hok,ok:tok&&hok};}
async function balanceEnvRecords(chartId){return (await getAll('controlChartRecords')).filter(r=>r.chartId===chartId&&(r.controlType==='BALANZA_AMBIENTE_EI285'||(r.historicalEntry===true&&r.controlType==='BALANZA_AMBIENTAL'))).sort((a,b)=>String(a.measuredAt).localeCompare(String(b.measuredAt)));}
function renderBalanceEnvConfig(def){const cfg=balanceEnvConfig(def),sec=$('#balanceEnvConfigSection');if(sec)sec.classList.toggle('hidden',currentSessionUser?.role!=='JEFE');if(currentSessionUser?.role!=='JEFE')return;$('#balanceEnvTempMin').value=cfg.tempCriterion.min;$('#balanceEnvTempMax').value=cfg.tempCriterion.max;$('#balanceEnvHumMax').value=cfg.humCriterion.max;$('#balanceEnvEffectiveFrom').value=cfg.effectiveFrom||dateToday();$('#balanceEnvCertificateRef').value=cfg.certificateRef||'';$('#balanceEnvTempCorrectionRows').innerHTML=cfg.tempCorrectionRanges.map((r,i)=>`<div class="inc-config-row"><input data-benv-tmin type="number" step="0.01" value="${r.min}"><input data-benv-tmax type="number" step="0.01" value="${r.max}"><input data-benv-tfactor type="number" step="0.01" value="${r.factor}"></div>`).join('');$('#balanceEnvHumCorrectionRows').innerHTML=cfg.humCorrectionRanges.map(r=>`<div class="inc-config-row"><input data-benv-hmin type="number" step="0.01" value="${r.min}"><input data-benv-hmax type="number" step="0.01" value="${r.max}"><input data-benv-hfactor type="number" step="0.01" value="${r.factor}"></div>`).join('');}
async function openBalanceEnvControl(def,date,analystId,completedRec){const dlg=$('#balanceEnvControlDialog');if(!dlg)return toast('Formato Condiciones de Balanza EI-285 no disponible');$('#balanceEnvChartId').value=def.id;$('#balanceEnvAnalystId').value=analystId||'';$('#balanceEnvInputDate').value=date||dateToday();$('#balanceEnvTime').value=new Date().toTimeString().slice(0,5);$('#balanceEnvTempRaw').value='';$('#balanceEnvHumRaw').value='';$('#balanceEnvNotes').value='';$('#balanceEnvPreview').innerHTML='';renderBalanceEnvConfig(def);await renderBalanceEnv(def.id);const existing=completedRec||(await balanceEnvRecords(def.id)).find(r=>String(r.measuredAt||'').slice(0,10)===(date||dateToday()));const submit=$('#balanceEnvControlForm button[type="submit"]');for(const id of ['balanceEnvTempRaw','balanceEnvHumRaw','balanceEnvNotes'])$('#'+id).disabled=!!existing;if(existing){$('#balanceEnvTempRaw').value=Number(existing.tempRaw).toFixed(2);$('#balanceEnvHumRaw').value=Number(existing.humRaw).toFixed(1);$('#balanceEnvNotes').value=existing.notes||'';submit.disabled=true;submit.textContent=`✓ COMPLETADA HOY · ${existing.analystName||'Responsable'}`;$('#balanceEnvPreview').innerHTML=`<div class="preview-ok"><b>Control diario ya realizado.</b><span>${Number(existing.tempCorrected).toFixed(2)} °C · ${Number(existing.humCorrected).toFixed(1)} %HR · ${existing.overallResult}</span></div>`;}else{submit.disabled=false;submit.textContent='Guardar control Condiciones de Balanza EI-285';}if(typeof dlg.showModal==='function')dlg.showModal();else dlg.setAttribute('open','');}
function previewBalanceEnv(){const defId=$('#balanceEnvChartId')?.value;if(!defId)return;getOne('controlChartDefs',defId).then(def=>{const cfg=balanceEnvConfig(def),c=balanceEnvCalc($('#balanceEnvTempRaw').value,$('#balanceEnvHumRaw').value,cfg),box=$('#balanceEnvPreview');if(!$('#balanceEnvTempRaw').value&&!$('#balanceEnvHumRaw').value){box.innerHTML='';return}if(!c.valid){box.innerHTML='<div class="preview-bad"><b>Sin corrección metrológica aplicable</b><span>La lectura está fuera de la tabla vigente. Revise el dato o solicite revisión a Calidad.</span></div>';return}box.innerHTML=`<div class="${c.ok?'preview-ok':'preview-bad'}"><b>${c.ok?'CUMPLE':'NO CUMPLE'}</b><span>Temperatura evaluada ${c.tc.toFixed(2)} °C · criterio ${cfg.tempCriterion.min}–${cfg.tempCriterion.max} °C</span><span>HR evaluada ${c.hc.toFixed(1)} % · criterio ≤ ${cfg.humCriterion.max}%</span></div>`;});}
async function saveBalanceEnvConfig(){if(currentSessionUser?.role!=='JEFE')return toast('Solo JEFE/Calidad puede cambiar factores de corrección');const id=$('#balanceEnvChartId').value,def=await getOne('controlChartDefs',id);if(!def)return;const build=(a,b,c)=>$$(a).map((el,i)=>({min:Number(el.value),max:Number($$(b)[i].value),factor:Number($$(c)[i].value)}));const tr=build('[data-benv-tmin]','[data-benv-tmax]','[data-benv-tfactor]'),hr=build('[data-benv-hmin]','[data-benv-hmax]','[data-benv-hfactor]');if([...tr,...hr].some(r=>![r.min,r.max,r.factor].every(Number.isFinite)||r.max<=r.min))return toast('Revise los rangos y factores');const old=balanceEnvConfig(def);def.metrologyConfig={equipment:'EI-285',dataLogger:'PF-09',area:'Balanza',tempCriterion:{min:Number($('#balanceEnvTempMin').value),max:Number($('#balanceEnvTempMax').value)},humCriterion:{max:Number($('#balanceEnvHumMax').value)},tempCorrectionRanges:tr.sort((a,b)=>a.min-b.min),humCorrectionRanges:hr.sort((a,b)=>a.min-b.min),effectiveFrom:$('#balanceEnvEffectiveFrom').value||dateToday(),certificateRef:$('#balanceEnvCertificateRef').value.trim(),version:Number(old.version||1)+1};def.updatedAt=nowISO();await put('controlChartDefs',def);await queue('UPDATE','controlChartDefs',def);await audit('CONFIGURAR','CARTA_CONTROL_BALANZA_AMBIENTE',def.id,`Configuración metrológica v${def.metrologyConfig.version}`);renderBalanceEnvConfig(def);previewBalanceEnv();toast('Configuración metrológica EI-285 guardada');}
async function saveBalanceEnvControl(e){e.preventDefault();const chartId=$('#balanceEnvChartId').value,analystId=$('#balanceEnvAnalystId').value,def=await getOne('controlChartDefs',chartId),cfg=balanceEnvConfig(def),date=$('#balanceEnvInputDate').value,time=$('#balanceEnvTime').value,c=balanceEnvCalc($('#balanceEnvTempRaw').value,$('#balanceEnvHumRaw').value,cfg);if(!c.valid)return toast('Lectura fuera de la tabla de corrección vigente. No se guardará sin factor aplicable.');const all=await getAll('controlChartRecords');if(all.some(x=>x.chartId===chartId&&String(x.measuredAt||'').slice(0,10)===date))return toast('El control de Condiciones de Balanza EI-285 ya fue completado hoy por el área.');const a=(await getAll('analysts')).find(x=>x.id===analystId),existing=await balanceEnvRecords(chartId),tv=[...existing.map(r=>Number(r.tempCorrected)),c.tc],hv=[...existing.map(r=>Number(r.humCorrected)),c.hc],tw=dbo5Westgard(tv),hw=dbo5Westgard(hv),stat=existing.length+1<10?'ESTABLECIMIENTO':(tw.state==='FUERA DE CONTROL'||hw.state==='FUERA DE CONTROL'?'FUERA DE CONTROL':'BAJO CONTROL');const rec={id:`CCR-BALANZA_AMBIENTE-${String(chartId).replace(/[^a-zA-Z0-9_-]/g,'_')}-${date}`,chartId,controlType:'BALANZA_AMBIENTE_EI285',section:def?.section||'ENSAYOS_ANALITICOS',methodName:def?.methodName||'Condiciones ambientales de balanza',area:'Balanza',equipment:'EI-285',dataLogger:'PF-09',analystId,analystName:a?.name||currentSessionUser?.name||'Usuario',measuredAt:`${date}T${time}:00`,tempRaw:c.rawT,tempFactor:c.tf,tempCorrected:c.tc,humRaw:c.rawH,humFactor:c.hf,humCorrected:c.hc,tempCriterion:{...cfg.tempCriterion},humCriterion:{...cfg.humCriterion},tempCorrectionRangeSnapshot:{...c.tr},humCorrectionRangeSnapshot:{...c.hr},metrologyConfigSnapshot:JSON.parse(JSON.stringify(cfg)),overallResult:c.ok?'CUMPLE':'NO CUMPLE',statisticalState:stat,statisticalRules:[...(tw.rules||[]).map(x=>'T:'+x),...(hw.rules||[]).map(x=>'HR:'+x)],notes:$('#balanceEnvNotes').value.trim(),schemaVersion:1,createdAt:nowISO(),updatedAt:nowISO()};await put('controlChartRecords',rec);await queue('CREATE','controlChartRecords',rec);await createControlChartCompletionAlert(rec,def);await audit('REGISTRAR','CARTA_CONTROL_BALANZA_AMBIENTE',rec.id,`${rec.overallResult} · T ${c.tc.toFixed(2)} °C · HR ${c.hc.toFixed(1)} %`);toast('Control de Condiciones de Balanza guardado y sincronizado');await renderBalanceEnv(chartId);await renderMyDayControlCharts(date,analystId);}
async function renderBalanceEnv(chartId){const rows=await balanceEnvRecords(chartId),body=$('#balanceEnvHistoryBody');if(!body)return;const tv=rows.map(r=>Number(r.tempCorrected)),hv=rows.map(r=>Number(r.humCorrected)),tw=dbo5Westgard(tv),hw=dbo5Westgard(hv);$('#balanceEnvHistoryCount').textContent=`${rows.length} registros`;$('#balanceEnvStats').innerHTML=rows.length<10?`<div><small>Estado estadístico</small><b>FASE DE ESTABLECIMIENTO</b></div><div><small>Datos requeridos</small><b>${rows.length}/10</b></div>`:`<div><small>Temperatura media ± s</small><b>${mean(tv).toFixed(2)} ± ${sd(tv).toFixed(2)} °C</b></div><div><small>HR media ± s</small><b>${mean(hv).toFixed(1)} ± ${sd(hv).toFixed(1)} %</b></div><div><small>Estado</small><b>${tw.state==='FUERA DE CONTROL'||hw.state==='FUERA DE CONTROL'?'FUERA DE CONTROL':'BAJO CONTROL'}</b></div>`;body.innerHTML=rows.slice().reverse().map(r=>`<tr><td>${escapeHtml(String(r.measuredAt||'').replace('T',' ').slice(0,16))}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${Number(r.tempRaw).toFixed(2)}</td><td>${Number(r.tempCorrected).toFixed(2)}</td><td>${Number(r.humRaw).toFixed(1)}</td><td>${Number(r.humCorrected).toFixed(1)}</td><td><span class="badge">${r.overallResult}</span></td><td>${escapeHtml(r.statisticalState||'ESTABLECIMIENTO')}</td></tr>`).join('')||'<tr><td colspan="8">Sin registros todavía.</td></tr>';const ai=$('#balanceEnvAi');if(!rows.length)ai.innerHTML='<b>IA:</b> El primer control iniciará la trazabilidad de Condiciones de Balanza EI-285.';else{const r=rows[rows.length-1];ai.innerHTML=`<b>IA · Diagnóstico:</b> El último control <b>${r.overallResult}</b>. Temperatura evaluada ${Number(r.tempCorrected).toFixed(2)} °C y HR evaluada ${Number(r.humCorrected).toFixed(1)} %. ${rows.length<10?`Hay ${rows.length} de 10 registros mínimos; permanece en establecimiento.`:`Vigilancia estadística activa: ${r.statisticalState}.`}`;}}
async function renderBalanceEnvManagement(def,month){const rows=(await balanceEnvRecords(def.id)).filter(r=>String(r.measuredAt||'').startsWith(month));if(!rows.length){showControlChartNoData(def.name||'Carta de control de condiciones de balanza',month);return}const cfg=balanceEnvConfig(def),tv=rows.map(r=>Number(r.tempCorrected)),hv=rows.map(r=>Number(r.humCorrected));$('#ccChart1Title').textContent='Balanza · Temperatura corregida';$('#ccChart1Desc').textContent=`Media, ±1s, ±2s, ±3s y criterio ${cfg.tempCriterion.min}–${cfg.tempCriterion.max} °C.`;$('#ccChart2Title').textContent='Balanza · Humedad corregida';$('#ccChart2Desc').textContent=`Media, ±1s, ±2s, ±3s y criterio ≤ ${cfg.humCriterion.max} %HR.`;$('#ccTempChart').innerHTML=ccSvgLine(rows,'tempCorrected','°C',cfg.tempCriterion.min,cfg.tempCriterion.max);$('#ccHumChart').innerHTML=ccSvgLine(rows,'humCorrected','%HR',Math.min(...hv,0),cfg.humCriterion.max);$('#ccCount').textContent=`${rows.length} registros · ${month}`;$('#ccKpis').innerHTML=`<div><small>Equipo</small><b>EI-285</b></div><div><small>Data Logger</small><b>PF-09</b></div><div><small>Criterio T</small><b>${cfg.tempCriterion.min}–${cfg.tempCriterion.max} °C</b></div><div><small>Criterio HR</small><b>≤ ${cfg.humCriterion.max}%</b></div>`;$('#ccAi').innerHTML=`<b>IA · Análisis:</b> ${rows.filter(r=>r.overallResult==='NO CUMPLE').length?`Se detectan ${rows.filter(r=>r.overallResult==='NO CUMPLE').length} controles NO CUMPLE en el período. Revise tendencia y acciones registradas.`:'Todos los controles del período cumplen los criterios técnicos.'}`;$('#ccRules').innerHTML=`<b>Vigilancia estadística:</b> ${rows.length<10?'Fase de establecimiento; se requieren 10 registros.':'Activa con reglas Shewhart/Westgard independientes para temperatura y humedad.'}`;$('#ccHistoryHead').innerHTML='<tr><th>Fecha/hora</th><th>Responsable</th><th>T leída</th><th>T corregida</th><th>HR leída</th><th>HR corregida</th><th>Resultado</th></tr>';$('#ccHistoryBody').innerHTML=rows.slice().reverse().map(r=>`<tr><td>${ccFmtDate(r.measuredAt)}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${Number(r.tempRaw).toFixed(2)}</td><td>${Number(r.tempCorrected).toFixed(2)}</td><td>${Number(r.humRaw).toFixed(1)}</td><td>${Number(r.humCorrected).toFixed(1)}</td><td>${escapeHtml(r.overallResult)}</td></tr>`).join('');$('#ccTempState').textContent=rows.length<10?'ESTABLECIMIENTO':'VIGILANCIA';$('#ccHumState').textContent=rows.length<10?'ESTABLECIMIENTO':'VIGILANCIA';}

function isMetalsChart(d){if(!d)return false;const n=normalizeIdentityText(d.name||''),m=normalizeIdentityText(d.methodName||''),k=normalizeIdentityText(d.controlKey||d.equipmentKey||'');return n.includes('carta de control de metales')||m.includes('control total del area')||hasEquipmentIdentity(d.name,'EI-313')||hasEquipmentIdentity(d.methodName,'EI-313')||hasEquipmentIdentity(d.controlKey||d.equipmentKey,'EI-313')||k.includes('ei 313');}
function metalsDefaultConfig(){return {equipment:'EI-313',dataLogger:'PF-09',area:'Metales',tempCriterion:{min:10,max:35},humCriterion:{max:60},tempCorrectionRanges:[{min:9,max:25,factor:0.30},{min:25,max:36,factor:0.32}],humCorrectionRanges:[{min:20,max:50,factor:3.30},{min:50,max:70,factor:2.20}],effectiveFrom:dateToday(),certificateRef:'',version:1};}
function metalsConfig(def){const d=metalsDefaultConfig(),c=def?.metrologyConfig?.equipment==='EI-313'?def.metrologyConfig:{};return {...d,...c,tempCriterion:{...d.tempCriterion,...(c.tempCriterion||{})},humCriterion:{...d.humCriterion,...(c.humCriterion||{})},tempCorrectionRanges:Array.isArray(c.tempCorrectionRanges)&&c.tempCorrectionRanges.length?c.tempCorrectionRanges:d.tempCorrectionRanges,humCorrectionRanges:Array.isArray(c.humCorrectionRanges)&&c.humCorrectionRanges.length?c.humCorrectionRanges:d.humCorrectionRanges};}
function metalsRange(v,ranges){const n=Number(v);if(!Number.isFinite(n))return null;return ranges.find((r,i)=>n>=Number(r.min)&&(i===ranges.length-1?n<=Number(r.max):n<Number(r.max)))||null;}
function metalsCalc(t,h,cfg){const tr=metalsRange(t,cfg.tempCorrectionRanges),hr=metalsRange(h,cfg.humCorrectionRanges);if(!tr||!hr)return {valid:false,tempRange:tr,humRange:hr};const rawT=Number(t),rawH=Number(h),tc=rawT+Number(tr.factor),hc=rawH+Number(hr.factor),tok=tc>=Number(cfg.tempCriterion.min)&&tc<=Number(cfg.tempCriterion.max),hok=hc<=Number(cfg.humCriterion.max);return {valid:true,rawT,rawH,tc,hc,tf:Number(tr.factor),hf:Number(hr.factor),tr,hr,tok,hok,ok:tok&&hok};}
async function metalsRecords(chartId){return (await getAll('controlChartRecords')).filter(r=>r.chartId===chartId&&(r.controlType==='METALES_EI313'||(r.historicalEntry===true&&r.controlType==='METALES_AMBIENTAL'))).sort((a,b)=>String(a.measuredAt).localeCompare(String(b.measuredAt)));}
function renderMetalsConfig(def){const cfg=metalsConfig(def),sec=$('#metalsConfigSection');if(sec)sec.classList.toggle('hidden',currentSessionUser?.role!=='JEFE');if(currentSessionUser?.role!=='JEFE')return;$('#metalsTempMin').value=cfg.tempCriterion.min;$('#metalsTempMax').value=cfg.tempCriterion.max;$('#metalsHumMax').value=cfg.humCriterion.max;$('#metalsEffectiveFrom').value=cfg.effectiveFrom||dateToday();$('#metalsCertificateRef').value=cfg.certificateRef||'';$('#metalsTempCorrectionRows').innerHTML=cfg.tempCorrectionRanges.map((r,i)=>`<div class="inc-config-row"><input data-met-tmin type="number" step="0.01" value="${r.min}"><input data-met-tmax type="number" step="0.01" value="${r.max}"><input data-met-tfactor type="number" step="0.01" value="${r.factor}"></div>`).join('');$('#metalsHumCorrectionRows').innerHTML=cfg.humCorrectionRanges.map(r=>`<div class="inc-config-row"><input data-met-hmin type="number" step="0.01" value="${r.min}"><input data-met-hmax type="number" step="0.01" value="${r.max}"><input data-met-hfactor type="number" step="0.01" value="${r.factor}"></div>`).join('');}
async function openMetalsControl(def,date,analystId,completedRec){const dlg=$('#metalsControlDialog');if(!dlg)return toast('Formato Metales EI-313 no disponible');$('#metalsChartId').value=def.id;$('#metalsAnalystId').value=analystId||'';$('#metalsInputDate').value=date||dateToday();$('#metalsTime').value=new Date().toTimeString().slice(0,5);$('#metalsTempRaw').value='';$('#metalsHumRaw').value='';$('#metalsNotes').value='';$('#metalsPreview').innerHTML='';renderMetalsConfig(def);await renderMetals(def.id);const existing=completedRec||(await metalsRecords(def.id)).find(r=>String(r.measuredAt||'').slice(0,10)===(date||dateToday()));const submit=$('#metalsControlForm button[type="submit"]');for(const id of ['metalsTempRaw','metalsHumRaw','metalsNotes'])$('#'+id).disabled=!!existing;if(existing){$('#metalsTempRaw').value=Number(existing.tempRaw).toFixed(2);$('#metalsHumRaw').value=Number(existing.humRaw).toFixed(1);$('#metalsNotes').value=existing.notes||'';submit.disabled=true;submit.textContent=`✓ COMPLETADA HOY · ${existing.analystName||'Responsable'}`;$('#metalsPreview').innerHTML=`<div class="preview-ok"><b>Control diario ya realizado.</b><span>${Number(existing.tempCorrected).toFixed(2)} °C · ${Number(existing.humCorrected).toFixed(1)} %HR · ${existing.overallResult}</span></div>`;}else{submit.disabled=false;submit.textContent='Guardar control Metales EI-313';}if(typeof dlg.showModal==='function')dlg.showModal();else dlg.setAttribute('open','');}
function previewMetals(){const defId=$('#metalsChartId')?.value;if(!defId)return;getOne('controlChartDefs',defId).then(def=>{const cfg=metalsConfig(def),c=metalsCalc($('#metalsTempRaw').value,$('#metalsHumRaw').value,cfg),box=$('#metalsPreview');if(!$('#metalsTempRaw').value&&!$('#metalsHumRaw').value){box.innerHTML='';return}if(!c.valid){box.innerHTML='<div class="preview-bad"><b>Sin corrección metrológica aplicable</b><span>La lectura está fuera de la tabla vigente. Revise el dato o solicite revisión a Calidad.</span></div>';return}box.innerHTML=`<div class="${c.ok?'preview-ok':'preview-bad'}"><b>${c.ok?'CUMPLE':'NO CUMPLE'}</b><span>Temperatura evaluada ${c.tc.toFixed(2)} °C · criterio ${cfg.tempCriterion.min}–${cfg.tempCriterion.max} °C</span><span>HR evaluada ${c.hc.toFixed(1)} % · criterio ≤ ${cfg.humCriterion.max}%</span></div>`;});}
async function saveMetalsConfig(){if(currentSessionUser?.role!=='JEFE')return toast('Solo JEFE/Calidad puede cambiar factores de corrección');const id=$('#metalsChartId').value,def=await getOne('controlChartDefs',id);if(!def)return;const build=(a,b,c)=>$$(a).map((el,i)=>({min:Number(el.value),max:Number($$(b)[i].value),factor:Number($$(c)[i].value)}));const tr=build('[data-met-tmin]','[data-met-tmax]','[data-met-tfactor]'),hr=build('[data-met-hmin]','[data-met-hmax]','[data-met-hfactor]');if([...tr,...hr].some(r=>![r.min,r.max,r.factor].every(Number.isFinite)||r.max<=r.min))return toast('Revise los rangos y factores');const old=metalsConfig(def);def.metrologyConfig={equipment:'EI-313',dataLogger:'PF-09',area:'Metales',tempCriterion:{min:Number($('#metalsTempMin').value),max:Number($('#metalsTempMax').value)},humCriterion:{max:Number($('#metalsHumMax').value)},tempCorrectionRanges:tr.sort((a,b)=>a.min-b.min),humCorrectionRanges:hr.sort((a,b)=>a.min-b.min),effectiveFrom:$('#metalsEffectiveFrom').value||dateToday(),certificateRef:$('#metalsCertificateRef').value.trim(),version:Number(old.version||1)+1};def.updatedAt=nowISO();await put('controlChartDefs',def);await queue('UPDATE','controlChartDefs',def);await audit('CONFIGURAR','CARTA_CONTROL_METALES',def.id,`Configuración metrológica v${def.metrologyConfig.version}`);renderMetalsConfig(def);previewMetals();toast('Configuración metrológica EI-313 guardada');}
async function saveMetalsControl(e){e.preventDefault();const chartId=$('#metalsChartId').value,analystId=$('#metalsAnalystId').value,def=await getOne('controlChartDefs',chartId),cfg=metalsConfig(def),date=$('#metalsInputDate').value,time=$('#metalsTime').value,c=metalsCalc($('#metalsTempRaw').value,$('#metalsHumRaw').value,cfg);if(!c.valid)return toast('Lectura fuera de la tabla de corrección vigente. No se guardará sin factor aplicable.');const all=await getAll('controlChartRecords');if(all.some(x=>x.chartId===chartId&&String(x.measuredAt||'').slice(0,10)===date))return toast('El control de Metales EI-313 ya fue completado hoy por el área.');const a=(await getAll('analysts')).find(x=>x.id===analystId),existing=await metalsRecords(chartId),tv=[...existing.map(r=>Number(r.tempCorrected)),c.tc],hv=[...existing.map(r=>Number(r.humCorrected)),c.hc],tw=dbo5Westgard(tv),hw=dbo5Westgard(hv),stat=existing.length+1<10?'ESTABLECIMIENTO':(tw.state==='FUERA DE CONTROL'||hw.state==='FUERA DE CONTROL'?'FUERA DE CONTROL':'BAJO CONTROL');const rec={id:`CCR-METALES-${String(chartId).replace(/[^a-zA-Z0-9_-]/g,'_')}-${date}`,chartId,controlType:'METALES_EI313',section:'AASS',methodName:def?.methodName||'Control total del área',area:'Metales',equipment:'EI-313',dataLogger:'PF-09',analystId,analystName:a?.name||currentSessionUser?.name||'Usuario',measuredAt:`${date}T${time}:00`,tempRaw:c.rawT,tempFactor:c.tf,tempCorrected:c.tc,humRaw:c.rawH,humFactor:c.hf,humCorrected:c.hc,tempCriterion:{...cfg.tempCriterion},humCriterion:{...cfg.humCriterion},tempCorrectionRangeSnapshot:{...c.tr},humCorrectionRangeSnapshot:{...c.hr},metrologyConfigSnapshot:JSON.parse(JSON.stringify(cfg)),overallResult:c.ok?'CUMPLE':'NO CUMPLE',statisticalState:stat,statisticalRules:[...(tw.rules||[]).map(x=>'T:'+x),...(hw.rules||[]).map(x=>'HR:'+x)],notes:$('#metalsNotes').value.trim(),schemaVersion:1,createdAt:nowISO(),updatedAt:nowISO()};await put('controlChartRecords',rec);await queue('CREATE','controlChartRecords',rec);await createControlChartCompletionAlert(rec,def);await audit('REGISTRAR','CARTA_CONTROL_METALES',rec.id,`${rec.overallResult} · T ${c.tc.toFixed(2)} °C · HR ${c.hc.toFixed(1)} %`);toast('Control de Metales guardado y sincronizado');await renderMetals(chartId);await renderMyDayControlCharts(date,analystId);}
async function renderMetals(chartId){const rows=await metalsRecords(chartId),body=$('#metalsHistoryBody');if(!body)return;const tv=rows.map(r=>Number(r.tempCorrected)),hv=rows.map(r=>Number(r.humCorrected)),tw=dbo5Westgard(tv),hw=dbo5Westgard(hv);$('#metalsHistoryCount').textContent=`${rows.length} registros`;$('#metalsStats').innerHTML=rows.length<10?`<div><small>Estado estadístico</small><b>FASE DE ESTABLECIMIENTO</b></div><div><small>Datos requeridos</small><b>${rows.length}/10</b></div>`:`<div><small>Temperatura media ± s</small><b>${mean(tv).toFixed(2)} ± ${sd(tv).toFixed(2)} °C</b></div><div><small>HR media ± s</small><b>${mean(hv).toFixed(1)} ± ${sd(hv).toFixed(1)} %</b></div><div><small>Estado</small><b>${tw.state==='FUERA DE CONTROL'||hw.state==='FUERA DE CONTROL'?'FUERA DE CONTROL':'BAJO CONTROL'}</b></div>`;body.innerHTML=rows.slice().reverse().map(r=>`<tr><td>${escapeHtml(String(r.measuredAt||'').replace('T',' ').slice(0,16))}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${Number(r.tempRaw).toFixed(2)}</td><td>${Number(r.tempCorrected).toFixed(2)}</td><td>${Number(r.humRaw).toFixed(1)}</td><td>${Number(r.humCorrected).toFixed(1)}</td><td><span class="badge">${r.overallResult}</span></td><td>${escapeHtml(r.statisticalState||'ESTABLECIMIENTO')}</td></tr>`).join('')||'<tr><td colspan="8">Sin registros todavía.</td></tr>';const ai=$('#metalsAi');if(!rows.length)ai.innerHTML='<b>IA:</b> El primer control iniciará la trazabilidad de Metales EI-313.';else{const r=rows[rows.length-1];ai.innerHTML=`<b>IA · Diagnóstico:</b> El último control <b>${r.overallResult}</b>. Temperatura evaluada ${Number(r.tempCorrected).toFixed(2)} °C y HR evaluada ${Number(r.humCorrected).toFixed(1)} %. ${rows.length<10?`Hay ${rows.length} de 10 registros mínimos; permanece en establecimiento.`:`Vigilancia estadística activa: ${r.statisticalState}.`}`;}}
async function renderMetalsManagement(def,month){const rows=(await metalsRecords(def.id)).filter(r=>String(r.measuredAt||'').startsWith(month));if(!rows.length){showControlChartNoData(def.name||'Carta de control de metales',month);return}const cfg=metalsConfig(def),tv=rows.map(r=>Number(r.tempCorrected)),hv=rows.map(r=>Number(r.humCorrected));$('#ccChart1Title').textContent='Metales · Temperatura corregida';$('#ccChart1Desc').textContent=`Media, ±1s, ±2s, ±3s y criterio ${cfg.tempCriterion.min}–${cfg.tempCriterion.max} °C.`;$('#ccChart2Title').textContent='Metales · Humedad corregida';$('#ccChart2Desc').textContent=`Media, ±1s, ±2s, ±3s y criterio ≤ ${cfg.humCriterion.max} %HR.`;$('#ccTempChart').innerHTML=ccSvgLine(rows,'tempCorrected','°C',cfg.tempCriterion.min,cfg.tempCriterion.max);$('#ccHumChart').innerHTML=ccSvgLine(rows,'humCorrected','%HR',Math.min(...hv,0),cfg.humCriterion.max);$('#ccCount').textContent=`${rows.length} registros · ${month}`;$('#ccKpis').innerHTML=`<div><small>Equipo</small><b>EI-313</b></div><div><small>Data Logger</small><b>PF-09</b></div><div><small>Criterio T</small><b>${cfg.tempCriterion.min}–${cfg.tempCriterion.max} °C</b></div><div><small>Criterio HR</small><b>≤ ${cfg.humCriterion.max}%</b></div>`;$('#ccAi').innerHTML=`<b>IA · Análisis:</b> ${rows.filter(r=>r.overallResult==='NO CUMPLE').length?`Se detectan ${rows.filter(r=>r.overallResult==='NO CUMPLE').length} controles NO CUMPLE en el período. Revise tendencia y acciones registradas.`:'Todos los controles del período cumplen los criterios técnicos.'}`;$('#ccRules').innerHTML=`<b>Vigilancia estadística:</b> ${rows.length<10?'Fase de establecimiento; se requieren 10 registros.':'Activa con reglas Shewhart/Westgard independientes para temperatura y humedad.'}`;$('#ccHistoryHead').innerHTML='<tr><th>Fecha/hora</th><th>Responsable</th><th>T leída</th><th>T corregida</th><th>HR leída</th><th>HR corregida</th><th>Resultado</th></tr>';$('#ccHistoryBody').innerHTML=rows.slice().reverse().map(r=>`<tr><td>${ccFmtDate(r.measuredAt)}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${Number(r.tempRaw).toFixed(2)}</td><td>${Number(r.tempCorrected).toFixed(2)}</td><td>${Number(r.humRaw).toFixed(1)}</td><td>${Number(r.humCorrected).toFixed(1)}</td><td>${escapeHtml(r.overallResult)}</td></tr>`).join('');$('#ccTempState').textContent=rows.length<10?'ESTABLECIMIENTO':'VIGILANCIA';$('#ccHumState').textContent=rows.length<10?'ESTABLECIMIENTO':'VIGILANCIA';}

function isBalanceEnvironmentChart(d){if(!d)return false;const n=normalizeIdentityText(d.name||''),m=normalizeIdentityText(d.methodName||''),o=normalizeIdentityText(d.notes||'');return (n.includes('condiciones')&&n.includes('balanza'))||(m.includes('condiciones')&&m.includes('balanza'))||(o.includes('condiciones ambientales')&&o.includes('balanza'))||hasEquipmentIdentity(d.name,'EI-285')||hasEquipmentIdentity(d.controlKey||d.equipmentKey,'EI-285');}
function isBalanceChart(d){if(!d||isBalanceEnvironmentChart(d))return false;const n=normalizeIdentityText(d.name||''),m=normalizeIdentityText(d.methodName||''),k=normalizeIdentityText(d.controlKey||d.equipmentKey||'');return n.includes('balanza')||m.includes('balanza')||n.includes('ei 227')||m.includes('ei 227')||k.includes('ei 227');}
function balanceRecords(chartId){return getAll('controlChartRecords').then(rows=>rows.filter(r=>r.chartId===chartId&&r.controlType==='BALANZA_MULTIPUNTO').sort((a,b)=>String(a.measuredAt).localeCompare(String(b.measuredAt))));}
function balancePoint(reading,nominal,tolerance){const r=Number(reading),n=Number(nominal),t=Number(tolerance),error=Math.abs(r-n);return {nominal:n,reading:r,error,tolerance:t,low:n-t,high:n+t,unit:'g',ok:error<=t};}
async function openBalanceControl(def,date,analystId,completedRec=null){const dlg=$('#balanceControlDialog');if(!dlg)return toast('Formato Balanza no disponible');const targetDate=date||dateToday(),rows=await getAll('controlChartRecords'),existing=completedRec||rows.filter(r=>r.chartId===def.id&&r.controlType==='BALANZA_MULTIPUNTO'&&String(r.measuredAt||'').slice(0,10)===targetDate).sort((a,b)=>String(a.createdAt||a.measuredAt).localeCompare(String(b.createdAt||b.measuredAt)))[0]||null;$('#balChartId').value=def.id;$('#balAnalystId').value=analystId||'';$('#balInputDate').value=targetDate;$('#balTime').value=existing?String(existing.measuredAt||'').slice(11,16):new Date().toTimeString().slice(0,5);$('#balRead1').value=existing?.mass1?.reading??'';$('#balRead100').value=existing?.mass100?.reading??'';$('#balNotes').value=existing?.notes||'';const methods=(def.applicableMethods||[]).map(x=>typeof x==='string'?x:(x.name||x.methodName||'')).filter(Boolean);$('#balApplies').textContent=existing?`✓ Control diario ya ejecutado por ${existing.analystName||'otro analista'} · ${String(existing.measuredAt||'').replace('T',' ').slice(0,16)}. Este registro cubre a todos los analistas y ensayos vinculados al EI-227.`:(methods.length?methods.join(' · '):'Control transversal de pesaje');const form=$('#balanceControlForm'),submit=form?.querySelector('button[type=submit]');['#balInputDate','#balTime','#balRead1','#balRead100','#balNotes'].forEach(sel=>{const el=$(sel);if(el)el.disabled=!!existing});if(submit){submit.disabled=!!existing;submit.textContent=existing?'✓ CONTROL COMPLETADO · SOLO CONSULTA':'Guardar control Balanza EI-227'}$('#balPreview').innerHTML=existing?`<div class="dbo5-result ok"><b>Control diario EI-227 completado</b><br>Responsable: ${escapeHtml(existing.analystName||'—')} · Resultado: ${escapeHtml(existing.overallResult||'COMPLETADA')}. No se permite un segundo registro para esta fecha/equipo.</div>`:'';await renderBalance(def.id);if(typeof dlg.showModal==='function')dlg.showModal();else dlg.setAttribute('open','');}
function previewBalance(){const box=$('#balPreview');if(!box)return;const a=$('#balRead1')?.value,b=$('#balRead100')?.value,p1=a!==''?balancePoint(a,1,0.001):null,p100=b!==''?balancePoint(b,100,0.002):null;if(!p1&&!p100){box.innerHTML='';return}const card=(p,label,d)=>p?`<div class="dbo5-result ${p.ok?'ok':'bad'}"><b>${label}: ${p.reading.toFixed(d)} g</b><br>Error absoluto ${p.error.toFixed(d)} g · criterio ±${p.tolerance.toFixed(d)} g (${p.low.toFixed(d)}–${p.high.toFixed(d)} g) · ${p.ok?'CUMPLE':'NO CUMPLE'}</div>`:`<div class="dbo5-result"><b>${label}</b><br>Pendiente de lectura</div>`;box.innerHTML=card(p1,'Masa 1 g',4)+card(p100,'Masa 100 g',4);}
async function saveBalanceControl(e){e.preventDefault();const chartId=$('#balChartId').value,analystId=$('#balAnalystId').value,date=$('#balInputDate').value,time=$('#balTime').value,p1=balancePoint($('#balRead1').value,1,0.001),p100=balancePoint($('#balRead100').value,100,0.002);if(!Number.isFinite(p1.reading)||!Number.isFinite(p100.reading))return toast('Complete las lecturas de 1 g y 100 g');const allRows=await getAll('controlChartRecords'),sameDay=allRows.find(x=>x.chartId===chartId&&x.controlType==='BALANZA_MULTIPUNTO'&&String(x.measuredAt||'').slice(0,10)===date);if(sameDay)return toast(`La Balanza EI-227 ya fue controlada hoy por ${sameDay.analystName||'otro analista'}. El mismo registro cubre a todos los analistas y ensayos vinculados.`);const analysts=await getAll('analysts'),a=analysts.find(x=>x.id===analystId),def=await getOne('controlChartDefs',chartId),existing=await balanceRecords(chartId),v1=[...existing.map(r=>Number(r.mass1?.reading)),p1.reading],v100=[...existing.map(r=>Number(r.mass100?.reading)),p100.reading],w1=dbo5Westgard(v1),w100=dbo5Westgard(v100),global=p1.ok&&p100.ok?'CUMPLE':'NO CUMPLE',stat=existing.length+1<10?'ESTABLECIMIENTO':[w1,w100].some(x=>x.state==='FUERA DE CONTROL')?'FUERA DE CONTROL':[w1,w100].some(x=>x.state==='ADVERTENCIA')?'ADVERTENCIA':'EN CONTROL',rules=[...(w1.rules||[]).map(x=>'1g:'+x),...(w100.rules||[]).map(x=>'100g:'+x)],applies=(def?.applicableMethods||[]).map(x=>typeof x==='string'?x:(x.name||x.methodName||'')).filter(Boolean);const safeChart=String(chartId||'EI227').replace(/[^a-zA-Z0-9_-]/g,'_'),rec={id:`CCR-BAL-${safeChart}-${date}`,chartId,controlType:'BALANZA_MULTIPUNTO',section:'TRANSVERSAL',methodName:'Control transversal de pesaje',equipment:'EI-227',analystId,analystName:a?.name||firebaseBridge?.authUser?.email||'Usuario',measuredAt:`${date}T${time}:00`,mass1:p1,mass100:p100,criterion:{type:'ABSOLUTE_ERROR',levels:[{nominal:1,tolerance:0.001,low:0.999,high:1.001,unit:'g'},{nominal:100,tolerance:0.002,low:99.998,high:100.002,unit:'g'}],source:'Carta de Control Balanza EI-227'},applicableMethodsSnapshot:applies,overallResult:global,statisticalState:stat,statisticalRules:rules,notes:$('#balNotes').value.trim(),schemaVersion:1,createdAt:nowISO(),updatedAt:nowISO()};await put('controlChartRecords',rec);await queue('CREATE','controlChartRecords',rec);await createControlChartCompletionAlert(rec,def);await audit('REGISTRAR','CARTA_CONTROL_BALANZA',rec.id,`${global} · 1g=${p1.reading} · 100g=${p100.reading} · transversal`);toast('Control Balanza EI-227 guardado. Cubre una sola vez los ensayos vinculados de la jornada.');$('#balRead1').value='';$('#balRead100').value='';$('#balNotes').value='';$('#balPreview').innerHTML='';await renderBalance(chartId);if($('#myDayDate'))await renderMyDay();}
async function renderBalance(chartId){const rows=await balanceRecords(chartId),body=$('#balHistoryBody');if(!body)return;$('#balHistoryCount').textContent=`${rows.length} registros`;const v1=rows.map(r=>Number(r.mass1?.reading)).filter(Number.isFinite),v100=rows.map(r=>Number(r.mass100?.reading)).filter(Number.isFinite),w1=dbo5Westgard(v1),w100=dbo5Westgard(v100);$('#balStats').innerHTML=`<div><small>Masa 1 g · media ± s</small><b>${v1.length?mean(v1).toFixed(4)+' ± '+sd(v1).toFixed(4):'—'}</b><span>${rows.length<10?'FASE DE ESTABLECIMIENTO':w1.state}</span></div><div><small>Masa 100 g · media ± s</small><b>${v100.length?mean(v100).toFixed(4)+' ± '+sd(v100).toFixed(4):'—'}</b><span>${rows.length<10?'FASE DE ESTABLECIMIENTO':w100.state}</span></div>`;body.innerHTML=rows.slice().reverse().map(r=>`<tr><td>${escapeHtml(String(r.measuredAt||'').replace('T',' ').slice(0,16))}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${Number(r.mass1.reading).toFixed(4)}</td><td>${Number(r.mass1.error).toFixed(4)}</td><td>${Number(r.mass100.reading).toFixed(4)}</td><td>${Number(r.mass100.error).toFixed(4)}</td><td><span class="badge">${r.overallResult}</span></td><td>${escapeHtml(r.statisticalState||'ESTABLECIMIENTO')}</td></tr>`).join('')||'<tr><td colspan="8">Sin registros todavía.</td></tr>';const ai=$('#balAi');if(!rows.length)ai.innerHTML='<b>IA:</b> Aún no existen registros de Balanza EI-227. El primer control iniciará la trazabilidad multipunto.';else{const last=rows.at(-1),bad=[];if(!last.mass1.ok)bad.push('1 g');if(!last.mass100.ok)bad.push('100 g');ai.innerHTML=`<b>IA · Diagnóstico:</b> El último control <b>${last.overallResult}</b>. ${bad.length?'Revisar el punto '+bad.join(' y ')+'.':'Ambos puntos cumplen sus errores máximos permitidos.'} ${rows.length<10?`Hay ${rows.length} de 10 registros mínimos; permanece en fase de establecimiento.`:`Estado estadístico: <b>${last.statisticalState}</b>.`} Este control transversal se ejecuta una sola vez por jornada/equipo y no se duplica por ensayo.`;}}
function balanceSvgRows(rows,key){return rows.map(r=>({...r,balValue:Number(r[key]?.reading)}));}
function ccRuleMeaning(rule){
  const map={
    '1_2s':['ADVERTENCIA','Un punto supera ±2s. Confirmar el siguiente control y revisar condición del equipo/patrón antes de intervenir.'],
    '1_3s':['ACCIÓN','Un punto supera ±3s. Revisar el control, patrón, nivelación/condición del equipo y documentar la investigación antes de continuar.'],
    '2_2s':['ACCIÓN','Dos resultados consecutivos quedan más allá de ±2s del mismo lado. Investigar sesgo o desplazamiento sistemático.'],
    'R_4s':['ACCIÓN','La diferencia entre dos resultados consecutivos alcanza 4s. Investigar variación aleatoria, manipulación, ambiente o patrón.'],
    '7x':['VIGILANCIA','Siete resultados consecutivos quedan del mismo lado de la media. Revisar desplazamiento sostenido del proceso.'],
    '7T':['VIGILANCIA','Siete resultados muestran tendencia continua. Revisar deriva del equipo/patrón y condiciones ambientales.']
  };return map[rule]||['REVISAR','Revisar la señal estadística y documentar la decisión de Calidad.'];
}
function ccDecisionSupport(events, rowsCount){
  if(rowsCount<10)return `<div class="cc-ok"><b>Fase de establecimiento ${rowsCount}/10.</b><br>Las reglas se muestran como vigilancia preliminar; Calidad debe completar la línea base antes de tomar decisiones estadísticas definitivas.</div>`;
  if(!events.length)return '<div class="cc-ok"><b>Proceso sin señales estadísticas activas.</b><br>Continuar vigilancia rutinaria. El cumplimiento técnico se evalúa por separado de la estabilidad estadística.</div>';
  return events.map(e=>{const [level,action]=ccRuleMeaning(e.rule);return `<div class="cc-rule"><div><b>${escapeHtml(level)} · ${escapeHtml(e.rule)}</b><br><small>${escapeHtml(action)}</small></div><span>${escapeHtml(e.kind)} · ${ccFmtDate(e.date)}</span></div>`}).join('');
}
async function renderBalanceManagement(def,month){$('#ccChart3Card').classList.add('hidden');$('#ccChart1Title').textContent='Balanza EI-227 · Masa 1 g';$('#ccChart1Desc').textContent='Lectura, media, ±1s, ±2s, ±3s y criterio técnico 0.999–1.001 g.';$('#ccChart2Title').textContent='Balanza EI-227 · Masa 100 g';$('#ccChart2Desc').textContent='Lectura, media, ±1s, ±2s, ±3s y criterio técnico 99.998–100.002 g.';const all=await balanceRecords(def.id),rows=all.filter(r=>String(r.measuredAt||'').startsWith(month));$('#ccCount').textContent=`${rows.length} registros · ${month}`;$('#ccHistoryHead').innerHTML='<tr><th>Fecha/hora</th><th>Responsable</th><th>1 g</th><th>Error</th><th>100 g</th><th>Error</th><th>Resultado</th><th>Estadístico</th><th>Detalle</th></tr>';if(!rows.length){$('#ccEmpty').classList.remove('hidden');$('#ccDashboard').classList.add('hidden');return}$('#ccEmpty').classList.add('hidden');$('#ccDashboard').classList.remove('hidden');const v1=rows.map(r=>Number(r.mass1.reading)),v100=rows.map(r=>Number(r.mass100.reading)),w1=dbo5Westgard(v1),w100=dbo5Westgard(v100),comp=rows.filter(r=>r.overallResult==='CUMPLE').length,pct=100*comp/rows.length,maxErr=Math.max(...rows.flatMap(r=>[r.mass1.error,r.mass100.error]));$('#ccKpis').innerHTML=`<div><small>Controles</small><b>${rows.length}</b><span>${month}</span></div><div><small>Cumplimiento</small><b>${pct.toFixed(1)}%</b><span>${comp}/${rows.length} cumplen ambos puntos</span></div><div><small>Error absoluto máximo</small><b>${maxErr.toFixed(4)} g</b><span>1 g ±0.001 · 100 g ±0.002</span></div><div><small>Equipo</small><b>EI-227</b><span>Control transversal de pesaje</span></div>`;$('#ccTempState').textContent=rows.length<10?'ESTABLECIMIENTO':w1.state;$('#ccHumState').textContent=rows.length<10?'ESTABLECIMIENTO':w100.state;$('#ccTempChart').innerHTML=ccSvgLine(balanceSvgRows(rows,'mass1'),'balValue','g',0.999,1.001);$('#ccHumChart').innerHTML=ccSvgLine(balanceSvgRows(rows,'mass100'),'balValue','g',99.998,100.002);const events=[];[['1 g',v1],['100 g',v100]].forEach(([kind,v])=>ccRuleDetails(v,rows.map(r=>r.measuredAt)).forEach(x=>x.rules.forEach(rule=>events.push({kind,rule,date:x.label}))));$('#ccRules').innerHTML=ccDecisionSupport(events,rows.length);const critical=events.filter(e=>['1_3s','2_2s','R_4s'].includes(e.rule)),warnings=events.filter(e=>!['1_3s','2_2s','R_4s'].includes(e.rule));$('#ccAi').innerHTML=`<b>Diagnóstico mensual Balanza EI-227:</b> ${rows.length-comp?`<b>${rows.length-comp}</b> control(es) presentaron incumplimiento técnico; revisar antes de liberar el uso asociado.`:'Todos los controles del período cumplen simultáneamente los criterios técnicos de 1 g y 100 g.'} ${rows.length<10?`La carta está en <b>FASE DE ESTABLECIMIENTO (${rows.length}/10)</b>; las señales estadísticas son preliminares.`:`Estado estadístico: 1 g <b>${w1.state}</b>, 100 g <b>${w100.state}</b>. ${critical.length?`Se detectan <b>${critical.length} señal(es) que requieren investigación documentada</b>.`:warnings.length?`Hay <b>${warnings.length} señal(es) de vigilancia</b>; confirmar tendencia con los siguientes controles.`:'No hay señales Westgard/Shewhart activas.'}`}<br><small>Apoyo a decisión: el sistema separa CUMPLIMIENTO TÉCNICO de CONTROL ESTADÍSTICO, identifica la regla y propone la acción; la decisión final y su documentación corresponden a Calidad. La IA no cambia límites ni criterios.</small>`;$('#ccHistoryBody').innerHTML=rows.slice().reverse().map(r=>`<tr><td>${ccFmtDate(r.measuredAt)}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${r.mass1.reading.toFixed(4)}</td><td>${r.mass1.error.toFixed(4)}</td><td>${r.mass100.reading.toFixed(4)}</td><td>${r.mass100.error.toFixed(4)}</td><td><span class="badge">${r.overallResult}</span></td><td>${escapeHtml(r.statisticalState||'—')}</td><td><button class="btn secondary compact" type="button" onclick="showCcPoint('${r.id}')">Ver</button></td></tr>`).join('');}
function isDistillerChart(d){if(!d)return false;const n=normalizeIdentityText(d.name||''),m=normalizeIdentityText(d.methodName||'');return n.includes('agua destilada')||n.includes('destilador')||m.includes('agua destilada')||m.includes('destilador')||n.includes('ei 328')||m.includes('ei 328');}
function distillerRecords(chartId){return getAll('controlChartRecords').then(rows=>rows.filter(r=>r.chartId===chartId&&r.controlType==='DESTILADOR_EI328').sort((a,b)=>String(a.measuredAt).localeCompare(String(b.measuredAt))));}
function distillerCalc(v){const raw=Number(v);if(!Number.isFinite(raw))return {valid:false};const min=15,max=20,ok=raw>=min&&raw<=max;return {valid:true,raw,value:raw,min,max,ok};}
async function openDistillerControl(def,date,analystId){const dlg=$('#distillerControlDialog');if(!dlg)return toast('Formato Destilador EI-328 no disponible');$('#distChartId').value=def.id;$('#distAnalystId').value=analystId||'';$('#distInputDate').value=date||dateToday();$('#distTime').value=new Date().toTimeString().slice(0,5);$('#distReading').value='';$('#distNotes').value='';$('#distPreview').innerHTML='';await renderDistiller(def.id);if(typeof dlg.showModal==='function')dlg.showModal();else dlg.setAttribute('open','');}
function previewDistiller(){const box=$('#distPreview');if(!box)return;const v=$('#distReading').value;if(v===''){box.innerHTML='';return}const c=distillerCalc(v);if(!c.valid){box.innerHTML='';return}box.innerHTML=`<div class="dbo5-result ${c.ok?'ok':'bad'}"><b>Resistividad: ${c.value.toFixed(2)} MΩ·cm</b><br>Sin factor de corrección: valor evaluado = valor leído · criterio ${c.min.toFixed(1)}–${c.max.toFixed(1)} MΩ·cm · ${c.ok?'CUMPLE':'NO CUMPLE'}</div>`;}
async function saveDistillerControl(e){e.preventDefault();const chartId=$('#distChartId').value,analystId=$('#distAnalystId').value,def=await getOne('controlChartDefs',chartId),c=distillerCalc($('#distReading').value);if(!c.valid)return toast('Ingrese una lectura válida de resistividad');const date=$('#distInputDate').value,time=$('#distTime').value;const sameDay=(await getAll('controlChartRecords')).find(x=>x.chartId===chartId&&String(x.measuredAt||'').slice(0,10)===date);if(sameDay)return toast('Esta carta del Destilador ya fue completada hoy. No se generará un duplicado.');const analysts=await getAll('analysts'),a=analysts.find(x=>x.id===analystId),existing=await distillerRecords(chartId),vals=[...existing.map(r=>Number(r.resistivity)),c.value],w=dbo5Westgard(vals),stat=existing.length+1<10?'ESTABLECIMIENTO':w.state;const rec={id:uid('CCR'),chartId,controlType:'DESTILADOR_EI328',section:'RECEPCION_MUESTRAS',methodName:def?.methodName||'Agua destilada',equipment:'EI-328',variable:'Resistividad',unit:'MΩ·cm',analystId,analystName:a?.name||firebaseBridge?.authUser?.email||'Usuario',measuredAt:`${date}T${time}:00`,resistivityRaw:c.raw,resistivity:c.value,correctionFactor:0,correctionApplied:false,criterion:{min:15,max:20,unit:'MΩ·cm'},criterionSnapshot:{min:15,max:20,unit:'MΩ·cm',correction:'SIN_CORRECCION'},overallResult:c.ok?'CUMPLE':'NO CUMPLE',statisticalState:stat,statisticalRules:w.rules||[],notes:$('#distNotes').value.trim(),schemaVersion:1,createdAt:nowISO(),updatedAt:nowISO()};await put('controlChartRecords',rec);await queue('CREATE','controlChartRecords',rec);await createControlChartCompletionAlert(rec,def);await audit('REGISTRAR','CARTA_CONTROL_DESTILADOR',rec.id,`${rec.overallResult} · ${c.value.toFixed(2)} MΩ·cm · sin corrección`);toast('Control Destilador EI-328 guardado y enviado a Firebase');$('#distReading').value='';$('#distNotes').value='';$('#distPreview').innerHTML='';await renderDistiller(chartId);}
async function renderDistiller(chartId){const rows=await distillerRecords(chartId),body=$('#distHistoryBody');if(!body)return;const vals=rows.map(r=>Number(r.resistivity)),w=dbo5Westgard(vals);$('#distHistoryCount').textContent=`${rows.length} registros`;$('#distStats').innerHTML=rows.length<10?`<div><small>Estado estadístico</small><b>FASE DE ESTABLECIMIENTO</b></div><div><small>Datos requeridos</small><b>${rows.length}/10</b></div><div><small>Resistividad</small><b>—</b></div>`:`<div><small>Resistividad media ± s</small><b>${mean(vals).toFixed(2)} ± ${sd(vals).toFixed(2)} MΩ·cm</b></div><div><small>Estado</small><b>${w.state}</b></div><div><small>Reglas</small><b>${(w.rules||[]).join(', ')||'Sin alarmas'}</b></div>`;body.innerHTML=rows.slice().reverse().map(r=>`<tr><td>${escapeHtml(String(r.measuredAt||'').replace('T',' ').slice(0,16))}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${Number(r.resistivityRaw??r.resistivity).toFixed(2)}</td><td>${Number(r.resistivity).toFixed(2)}</td><td>15.0–20.0</td><td><span class="badge">${r.overallResult}</span></td><td>${escapeHtml(r.statisticalState||'ESTABLECIMIENTO')}</td></tr>`).join('')||'<tr><td colspan="7">Sin registros todavía.</td></tr>';const ai=$('#distAi');if(!rows.length)ai.innerHTML='<b>IA:</b> Aún no existen registros del Destilador EI-328. El primer control iniciará la trazabilidad.';else{const last=rows.at(-1);ai.innerHTML=`<b>IA · Diagnóstico:</b> Último control <b>${last.overallResult}</b> con ${Number(last.resistivity).toFixed(2)} MΩ·cm. No se aplica factor de corrección. ${rows.length<10?`Hay ${rows.length}/10 registros; fase de establecimiento.`:`Estado estadístico: <b>${w.state}</b>${w.rules?.length?'. Reglas: '+w.rules.join(', '):'. Sin reglas de alarma.'}.`}`;}}
async function renderDistillerManagement(def,month){
  resetControlChartManagementUI();
  const all=await distillerRecords(def.id),rows=all.filter(r=>String(r.measuredAt||'').startsWith(month)),vals=rows.map(r=>Number(r.resistivity)).filter(Number.isFinite),ok=rows.filter(r=>r.overallResult==='CUMPLE').length,w=dbo5Westgard(vals);
  $('#ccChart1Title').textContent='Destilador EI-328 · Resistividad';$('#ccChart1Desc').textContent='Valor leído sin corrección, media, ±1s, ±2s, ±3s y criterio técnico 15–20 MΩ·cm.';
  $('#ccChart2Title').textContent='Criterio técnico';$('#ccChart2Desc').textContent='Evaluación directa del valor leído; no se aplica factor de corrección.';
  $('#ccCount').textContent=`${rows.length} registros · ${month}`;
  $('#ccHistoryHead').innerHTML='<tr><th>Fecha/hora</th><th>Responsable</th><th>Resistividad</th><th>Criterio</th><th>Resultado</th><th>Estadístico</th><th>Reglas</th></tr>';
  if(!rows.length){showControlChartNoData('Destilador EI-328',month);return;}
  $('#ccKpis').innerHTML=`<div><small>Controles</small><b>${rows.length}</b><span>${month}</span></div><div><small>Cumplimiento</small><b>${(ok/rows.length*100).toFixed(1)}%</b><span>${ok}/${rows.length} cumplen 15–20 MΩ·cm</span></div><div><small>Media ± s</small><b>${mean(vals).toFixed(2)} ± ${sd(vals).toFixed(2)} MΩ·cm</b><span>mín ${Math.min(...vals).toFixed(2)} · máx ${Math.max(...vals).toFixed(2)}</span></div><div><small>Equipo</small><b>EI-328</b><span>Resistividad · lectura directa</span></div>`;
  $('#ccTempState').textContent=rows.length<10?'ESTABLECIMIENTO':w.state;$('#ccHumState').textContent='CRITERIO';
  $('#ccTempChart').innerHTML=ccSvgLine(rows,'resistivity','MΩ·cm',15,20);$('#ccHumChart').innerHTML='<div class="dbo5-ai"><b>EI-328 · Sin factor de corrección</b><br>Valor evaluado = valor leído.<br>Criterio técnico: 15.0–20.0 MΩ·cm.<br>Los límites estadísticos se calculan únicamente con registros de esta carta.</div>';
  const events=[];ccRuleDetails(vals,rows.map(r=>r.measuredAt)).forEach(x=>x.rules.forEach(rule=>events.push({rule,date:x.label})));$('#ccRules').innerHTML=events.length?events.map(e=>`<div class="cc-rule"><b>${escapeHtml(e.rule)}</b><span>Resistividad · ${ccFmtDate(e.date)}</span></div>`).join(''):'<div class="cc-ok">No se detectan reglas de alarma en resistividad.</div>';
  $('#ccAi').innerHTML=`<b>Diagnóstico mensual Destilador EI-328:</b> ${ok}/${rows.length} controles cumplen 15–20 MΩ·cm. ${rows.length<10?'La serie permanece en FASE DE ESTABLECIMIENTO hasta completar 10 registros.':`Estado estadístico: <b>${w.state}</b>.`} No se aplica corrección y no se reutilizan datos ni métricas de Conductividad.`;
  $('#ccHistoryBody').innerHTML=rows.slice().reverse().map(r=>`<tr><td>${ccFmtDate(r.measuredAt)}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${Number(r.resistivity).toFixed(2)} MΩ·cm</td><td>15.0–20.0 MΩ·cm</td><td><span class="badge">${escapeHtml(r.overallResult||'—')}</span></td><td>${escapeHtml(r.statisticalState||'ESTABLECIMIENTO')}</td><td>${escapeHtml((r.statisticalRules||[]).join(', ')||'—')}</td></tr>`).join('');
}
// 6.33.19 · Controles térmicos específicos: Nitrógeno total 105 ±2 °C y Fósforo total 150 ±2 °C.
function isThermal105Chart(d){if(!d)return false;const n=normalizeIdentityText(d.name||''),m=normalizeIdentityText(d.methodName||'');return (n.includes('nitrogeno total')||m.includes('nitrogeno total'))&&!n.includes('ntk')&&!m.includes('ntk');}
function isThermalDQOChart(d){if(!d)return false;const n=normalizeIdentityText(d.name||''),m=normalizeIdentityText(d.methodName||''),k=normalizeIdentityText(d.controlKey||d.equipmentKey||'');return n.includes('dqo')||m==='dqo'||m.includes('demanda quimica de oxigeno')||hasEquipmentIdentity(d.name,'EI-360')||hasEquipmentIdentity(d.methodName,'EI-360')||hasEquipmentIdentity(d.controlKey||d.equipmentKey,'EI-360')||k.includes('ei 360');}
function isThermal150Chart(d){if(!d||isThermalDQOChart(d))return false;const n=normalizeIdentityText(d.name||''),m=normalizeIdentityText(d.methodName||'');return n.includes('fosforo total')||m.includes('fosforo total')||m.includes('fosforo total y o solubles');}
function thermalPointSpec(d){if(isThermal105Chart(d))return {type:'NITROGENO_TOTAL_105',name:'Nitrógeno total',nominal:105,tol:2,min:103,max:107,equipment:'EI-154',method:'Nitrógeno total en aguas'};if(isThermalDQOChart(d))return {type:'DQO_150_EI360',name:'DQO',nominal:150,tol:2,min:148,max:152,equipment:'EI-360',method:'DQO'};return {type:'FOSFORO_TOTAL_150',name:'Fósforo total',nominal:150,tol:2,min:148,max:152,equipment:'EI-154',method:'Fósforo total y/o solubles en aguas'};}
function thermalPointCalc(v,spec){const raw=Number(v);if(!Number.isFinite(raw))return {valid:false};const error=raw-spec.nominal,absError=Math.abs(error),ok=absError<=spec.tol;return {valid:true,raw,error,absError,ok};}
async function thermalPointRecords(chartId,type){return (await getAll('controlChartRecords')).filter(r=>r.chartId===chartId&&r.controlType===type).sort((a,b)=>String(a.measuredAt).localeCompare(String(b.measuredAt)));}
async function openThermalPointControl(def,date,analystId){const dlg=$('#thermalPointControlDialog'),spec=thermalPointSpec(def);if(!dlg)return toast('Formato térmico no disponible');$('#tpChartId').value=def.id;$('#tpAnalystId').value=analystId||'';$('#tpInputDate').value=date||dateToday();$('#tpTime').value=new Date().toTimeString().slice(0,5);$('#tpTempRaw').value='';$('#tpNotes').value='';$('#tpPreview').innerHTML='';$('#tpEyebrow').textContent=`CARTA DE CONTROL · ${spec.name.toUpperCase()}`;$('#tpTitle').textContent=`Control de temperatura · ${spec.name}`;$('#tpEquipment').textContent=spec.equipment;$('#tpProcess').textContent=spec.name;$('#tpNominal').textContent=`${spec.nominal} °C`;$('#tpCriterion').textContent=`${spec.nominal} ± ${spec.tol} °C (${spec.min}–${spec.max} °C)`;$('#tpAi').innerHTML=`Ingrese la temperatura. El sistema calculará automáticamente el error respecto a ${spec.nominal} °C y evaluará ±${spec.tol} °C.`;await renderThermalPoint(def.id,spec);if(typeof dlg.showModal==='function')dlg.showModal();else dlg.setAttribute('open','');}
async function previewThermalPoint(){const def=await getOne('controlChartDefs',$('#tpChartId')?.value);if(!def)return;const spec=thermalPointSpec(def),c=thermalPointCalc($('#tpTempRaw').value,spec),box=$('#tpPreview');if(!box)return;if(!c.valid){box.innerHTML='';return;}box.innerHTML=`<div class="cc-detail-grid"><div><small>Lectura</small><b>${c.raw.toFixed(2)} °C</b></div><div><small>Objetivo</small><b>${spec.nominal.toFixed(0)} °C</b></div><div><small>Error</small><b>${c.error>=0?'+':''}${c.error.toFixed(2)} °C</b><span>|error| ${c.absError.toFixed(2)} °C</span></div><div><small>Resultado</small><b>${c.ok?'CUMPLE':'NO CUMPLE'}</b><span>aceptación ±${spec.tol} °C</span></div></div>`;}
async function saveThermalPointControl(e){e.preventDefault();const chartId=$('#tpChartId').value,analystId=$('#tpAnalystId').value,def=await getOne('controlChartDefs',chartId);if(!def)return;const spec=thermalPointSpec(def),c=thermalPointCalc($('#tpTempRaw').value,spec);if(!c.valid)return toast('Ingrese una temperatura válida.');const date=$('#tpInputDate').value,time=$('#tpTime').value,all=await getAll('controlChartRecords');if(all.find(x=>x.chartId===chartId&&String(x.measuredAt||'').slice(0,10)===date))return toast(`El control de ${spec.name} ya fue completado hoy.`);const analysts=await getAll('analysts'),a=analysts.find(x=>x.id===analystId),existing=await thermalPointRecords(chartId,spec.type),vals=[...existing.map(r=>Number(r.temperature)),c.raw],w=dbo5Westgard(vals),stat=existing.length+1<10?'ESTABLECIMIENTO':w.state;const rec={id:uid('CCR'),chartId,controlType:spec.type,section:def?.section||'ENSAYOS_ANALITICOS',methodName:def?.methodName||spec.method,equipment:spec.equipment,analystId,analystName:a?.name||firebaseBridge?.authUser?.email||'Usuario',measuredAt:`${date}T${time}:00`,temperature:c.raw,nominal:spec.nominal,tolerance:spec.tol,error:c.error,absoluteError:c.absError,criterion:{min:spec.min,max:spec.max},overallResult:c.ok?'CUMPLE':'NO CUMPLE',statisticalState:stat,statisticalRules:w.rules||[],notes:$('#tpNotes').value.trim(),schemaVersion:1,createdAt:nowISO(),updatedAt:nowISO()};await put('controlChartRecords',rec);await queue('CREATE','controlChartRecords',rec);await createControlChartCompletionAlert(rec,def);await audit('REGISTRAR','CARTA_CONTROL_TERMICA',rec.id,`${spec.name} · ${rec.overallResult} · ${c.raw.toFixed(2)} °C · error ${c.error.toFixed(2)} °C`);toast(`Control de ${spec.name} guardado y enviado a Firebase`);$('#tpTempRaw').value='';$('#tpNotes').value='';$('#tpPreview').innerHTML='';await renderThermalPoint(chartId,spec);}
async function renderThermalPoint(chartId,spec){const rows=await thermalPointRecords(chartId,spec.type),body=$('#tpHistoryBody'),vals=rows.map(r=>Number(r.temperature)),w=dbo5Westgard(vals);$('#tpHistoryCount').textContent=`${rows.length} registros`;$('#tpStats').innerHTML=rows.length<10?`<div><small>Estado estadístico</small><b>FASE DE ESTABLECIMIENTO</b></div><div><small>Datos requeridos</small><b>${rows.length}/10</b></div><div><small>Objetivo</small><b>${spec.nominal} ± ${spec.tol} °C</b></div>`:`<div><small>Media ± s</small><b>${mean(vals).toFixed(2)} ± ${sd(vals).toFixed(2)} °C</b></div><div><small>Estado</small><b>${w.state}</b></div><div><small>Reglas</small><b>${(w.rules||[]).join(', ')||'Sin alarmas'}</b></div>`;body.innerHTML=rows.slice().reverse().map(r=>`<tr><td>${escapeHtml(String(r.measuredAt||'').replace('T',' ').slice(0,16))}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${Number(r.temperature).toFixed(2)} °C</td><td>${Number(r.nominal).toFixed(0)} °C</td><td>${Number(r.error)>=0?'+':''}${Number(r.error).toFixed(2)} °C</td><td>±${Number(r.tolerance).toFixed(0)} °C</td><td><span class="badge">${escapeHtml(r.overallResult)}</span></td><td>${escapeHtml(r.statisticalState||'ESTABLECIMIENTO')}</td></tr>`).join('')||'<tr><td colspan="8">Sin registros todavía.</td></tr>';$('#tpAi').innerHTML=!rows.length?`<b>IA:</b> Aún no existen registros de ${spec.name}. El primer control iniciará la trazabilidad.`:`<b>IA · Diagnóstico:</b> Último control <b>${rows.at(-1).overallResult}</b> a ${Number(rows.at(-1).temperature).toFixed(2)} °C, error ${Number(rows.at(-1).error)>=0?'+':''}${Number(rows.at(-1).error).toFixed(2)} °C. ${rows.length<10?`${rows.length}/10 registros; fase de establecimiento.`:`Estado estadístico: <b>${w.state}</b>${w.rules?.length?'. Reglas: '+w.rules.join(', '):'. Sin alarmas.'}.`}`;}
async function renderThermalPointManagement(def,month){const spec=thermalPointSpec(def),rows=(await thermalPointRecords(def.id,spec.type)).filter(r=>String(r.measuredAt||'').startsWith(month)),vals=rows.map(r=>Number(r.temperature)),w=dbo5Westgard(vals),ok=rows.filter(r=>r.overallResult==='CUMPLE').length;$('#ccChart1Title').textContent=`${spec.name} · ${spec.nominal} °C`;$('#ccChart1Desc').textContent=`Temperatura, media, ±1s, ±2s, ±3s y aceptación ${spec.nominal} ± ${spec.tol} °C.`;$('#ccChart2Title').textContent='Criterio técnico';$('#ccChart2Desc').textContent='Evaluación directa del error respecto al valor objetivo. El factor de corrección no se expone al analista.';$('#ccTempState').textContent=rows.length<10?'ESTABLECIMIENTO':w.state;$('#ccHumState').textContent=`${ok}/${rows.length||0} CUMPLE`;$('#ccTempChart').innerHTML=ccSvgLine(rows,'temperature','°C',spec.min,spec.max);$('#ccHumChart').innerHTML=`<div class="dbo5-ai"><b>Objetivo:</b> ${spec.nominal} °C<br><b>Tolerancia:</b> ±${spec.tol} °C<br><b>Rango:</b> ${spec.min}–${spec.max} °C<br><b>Equipo:</b> ${spec.equipment}</div>`;$('#ccRules').innerHTML=(w.rules||[]).length?w.rules.map(r=>`<div class="cc-rule"><b>${escapeHtml(r)}</b><span>Temperatura</span></div>`).join(''):'<div class="cc-ok">Sin reglas de alarma.</div>';$('#ccAi').innerHTML=`<b>Diagnóstico mensual ${spec.name}:</b> ${ok}/${rows.length} controles cumplen. ${rows.length<10?'FASE DE ESTABLECIMIENTO hasta completar 10 registros.':`Estado estadístico: <b>${w.state}</b>.`} El error se calcula automáticamente contra ${spec.nominal} °C.`;$('#ccHistoryBody').innerHTML=rows.slice().reverse().map(r=>`<tr><td>${ccFmtDate(r.measuredAt)}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${Number(r.temperature).toFixed(2)} °C</td><td>${Number(r.error)>=0?'+':''}${Number(r.error).toFixed(2)} °C</td><td><span class="badge">${escapeHtml(r.overallResult)}</span></td><td>${escapeHtml(r.statisticalState||'ESTABLECIMIENTO')}</td><td>${escapeHtml((r.statisticalRules||[]).join(', ')||'—')}</td></tr>`).join('');}
function applyMetrologyFactorPrivacy(root){if(!root)return;const hide=currentSessionUser?.role!=='JEFE';root.querySelectorAll('.chief-factor-only').forEach(el=>el.classList.toggle('hidden',hide));}

// 6.33.18 · Digestor EI-154 NTK · control transversal diario a 350 °C.
function isDigestorChart(d){if(!d||isThermal105Chart(d)||isThermal150Chart(d))return false;const n=normalizeIdentityText(d.name||''),m=normalizeIdentityText(d.methodName||''),k=normalizeIdentityText(d.controlKey||d.equipmentKey||'');return hasEquipmentIdentity(d.name,'EI-154')||hasEquipmentIdentity(d.methodName,'EI-154')||hasEquipmentIdentity(d.controlKey||d.equipmentKey,'EI-154')||n.includes('digestor')&&n.includes('ntk')||m.includes('digestor')&&m.includes('ntk')||k.includes('ei 154');}
function digestorDefaultConfig(){return {equipment:'EI-154',criterion:{min:360,max:390},correctionRanges:[{min:350,max:375,factor:0.30},{min:375,max:390,factor:0.30}],effectiveFrom:dateToday(),certificateRef:'',version:1};}
function digestorConfig(def){return def?.metrologyConfig?.equipment==='EI-154'?def.metrologyConfig:digestorDefaultConfig();}
function digestorCalc(v,cfg){const raw=Number(v);if(!Number.isFinite(raw))return {valid:false};const rs=cfg.correctionRanges||[],r=rs.find((x,i)=>raw>=Number(x.min)&&(i===rs.length-1?raw<=Number(x.max):raw<Number(x.max)));if(!r)return {valid:false,raw,reason:'SIN_FACTOR'};const factor=Number(r.factor),corrected=raw+factor,ok=corrected>=Number(cfg.criterion.min)&&corrected<=Number(cfg.criterion.max);return {valid:true,raw,factor,corrected,ok,range:{min:Number(r.min),max:Number(r.max)}};}
async function digestorRecords(chartId){return (await getAll('controlChartRecords')).filter(r=>r.chartId===chartId&&r.controlType==='DIGESTOR_EI154').sort((a,b)=>String(a.measuredAt).localeCompare(String(b.measuredAt)));}
async function openDigestorControl(def,date,analystId){const dlg=$('#digestorControlDialog');if(!dlg)return toast('Formato Digestor EI-154 no disponible');$('#digChartId').value=def.id;$('#digAnalystId').value=analystId||'';$('#digInputDate').value=date||dateToday();$('#digTime').value=new Date().toTimeString().slice(0,5);$('#digTempRaw').value='';$('#digNotes').value='';$('#digPreview').innerHTML='';renderDigestorConfig(def);await renderDigestor(def.id);if(typeof dlg.showModal==='function')dlg.showModal();else dlg.setAttribute('open','');}
function renderDigestorConfig(def){const cfg=digestorConfig(def),box=$('#digCorrectionRows');if(!box)return;$('#digCriterionMin').value=cfg.criterion.min;$('#digCriterionMax').value=cfg.criterion.max;$('#digEffectiveFrom').value=cfg.effectiveFrom||dateToday();$('#digCertificateRef').value=cfg.certificateRef||'';box.innerHTML=(cfg.correctionRanges||[]).map(r=>`<div class="inc-config-row"><input data-dig-min type="number" step="0.01" value="${r.min}"><input data-dig-max type="number" step="0.01" value="${r.max}"><input data-dig-factor type="number" step="0.01" value="${r.factor}"></div>`).join('');$('#digCriterionLabel').textContent=`${cfg.criterion.min}–${cfg.criterion.max} °C`;const sec=$('#digConfigSection');if(sec)sec.classList.toggle('hidden',currentSessionUser?.role!=='JEFE');}
function previewDigestor(){const id=$('#digChartId')?.value;if(!id)return;getOne('controlChartDefs',id).then(def=>{const c=digestorCalc($('#digTempRaw').value,digestorConfig(def)),box=$('#digPreview');if(!box)return;if(!Number.isFinite(c.raw)){box.innerHTML='';return;}if(!c.valid){box.innerHTML='<div class="alert warn"><b>Sin factor de corrección aplicable.</b> La lectura está fuera del intervalo vigente 350–390 °C.</div>';return;}const factor=currentSessionUser?.role==='JEFE'?`<div><small>Factor de corrección</small><b>${c.factor>=0?'+':''}${c.factor.toFixed(2)} °C</b><span>${c.range.min}–${c.range.max} °C</span></div>`:'';box.innerHTML=`<div class="cc-detail-grid"><div><small>Lectura</small><b>${c.raw.toFixed(2)} °C</b></div>${factor}<div><small>T evaluada</small><b>${c.corrected.toFixed(2)} °C</b></div><div><small>Resultado</small><b>${c.ok?'CUMPLE':'NO CUMPLE'}</b><span>criterio ${digestorConfig(def).criterion.min}–${digestorConfig(def).criterion.max} °C</span></div></div>`;});}
async function saveDigestorConfig(){if(currentSessionUser?.role!=='JEFE')return toast('Solo JEFE/Calidad puede cambiar la configuración metrológica');const id=$('#digChartId').value,def=await getOne('controlChartDefs',id);if(!def)return;const mins=$$('[data-dig-min]'),maxs=$$('[data-dig-max]'),fs=$$('[data-dig-factor]'),ranges=mins.map((el,i)=>({min:Number(el.value),max:Number(maxs[i].value),factor:Number(fs[i].value)}));if(ranges.some(r=>![r.min,r.max,r.factor].every(Number.isFinite)||r.max<=r.min))return toast('Revise rangos y factores');ranges.sort((a,b)=>a.min-b.min);const cmin=Number($('#digCriterionMin').value),cmax=Number($('#digCriterionMax').value);if(!Number.isFinite(cmin)||!Number.isFinite(cmax)||cmax<=cmin)return toast('Revise el criterio técnico');const old=digestorConfig(def);def.metrologyConfig={equipment:'EI-154',criterion:{min:cmin,max:cmax},correctionRanges:ranges,effectiveFrom:$('#digEffectiveFrom').value||dateToday(),certificateRef:$('#digCertificateRef').value.trim(),version:Number(old.version||1)+1};def.updatedAt=nowISO();await put('controlChartDefs',def);await queue('UPDATE','controlChartDefs',def);await audit('CONFIGURAR','CARTA_CONTROL_DIGESTOR',def.id,`Configuración EI-154 v${def.metrologyConfig.version}`);renderDigestorConfig(def);previewDigestor();toast('Configuración metrológica EI-154 guardada');}
async function saveDigestorControl(e){e.preventDefault();const chartId=$('#digChartId').value,analystId=$('#digAnalystId').value,def=await getOne('controlChartDefs',chartId),cfg=digestorConfig(def),c=digestorCalc($('#digTempRaw').value,cfg);if(!c.valid)return toast('Lectura fuera de la tabla de corrección vigente. No se puede guardar sin factor aplicable.');const date=$('#digInputDate').value,time=$('#digTime').value,all=await getAll('controlChartRecords');if(all.find(x=>x.chartId===chartId&&String(x.measuredAt||'').slice(0,10)===date))return toast('El control del Digestor EI-154 ya fue completado hoy.');const analysts=await getAll('analysts'),a=analysts.find(x=>x.id===analystId),existing=await digestorRecords(chartId),vals=[...existing.map(r=>Number(r.tempCorrected)),c.corrected],w=dbo5Westgard(vals),stat=existing.length+1<10?'ESTABLECIMIENTO':w.state;const rec={id:uid('CCR'),chartId,controlType:'DIGESTOR_EI154',section:def?.section||'ENSAYOS_ANALITICOS',methodName:def?.methodName||'NTK',equipment:'EI-154',analystId,analystName:a?.name||firebaseBridge?.authUser?.email||'Usuario',measuredAt:`${date}T${time}:00`,tempRaw:c.raw,tempFactor:c.factor,tempCorrected:c.corrected,tempCriterion:{...cfg.criterion},correctionRangeSnapshot:{...c.range},metrologyConfigSnapshot:JSON.parse(JSON.stringify(cfg)),overallResult:c.ok?'CUMPLE':'NO CUMPLE',statisticalState:stat,statisticalRules:w.rules||[],notes:$('#digNotes').value.trim(),schemaVersion:1,createdAt:nowISO(),updatedAt:nowISO()};await put('controlChartRecords',rec);await queue('CREATE','controlChartRecords',rec);await createControlChartCompletionAlert(rec,def);await audit('REGISTRAR','CARTA_CONTROL_DIGESTOR',rec.id,`${rec.overallResult} · ${c.raw.toFixed(2)} → ${c.corrected.toFixed(2)} °C`);toast('Control Digestor EI-154 guardado y enviado a Firebase');$('#digTempRaw').value='';$('#digNotes').value='';$('#digPreview').innerHTML='';await renderDigestor(chartId);}
async function renderDigestor(chartId){const rows=await digestorRecords(chartId),body=$('#digHistoryBody');if(!body)return;const vals=rows.map(r=>Number(r.tempCorrected)),w=dbo5Westgard(vals);$('#digHistoryCount').textContent=`${rows.length} registros`;$('#digStats').innerHTML=rows.length<10?`<div><small>Estado estadístico</small><b>FASE DE ESTABLECIMIENTO</b></div><div><small>Datos requeridos</small><b>${rows.length}/10</b></div><div><small>Temperatura</small><b>—</b></div>`:`<div><small>Media ± s</small><b>${mean(vals).toFixed(2)} ± ${sd(vals).toFixed(2)} °C</b></div><div><small>Estado</small><b>${w.state}</b></div><div><small>Reglas</small><b>${(w.rules||[]).join(', ')||'Sin alarmas'}</b></div>`;body.innerHTML=rows.slice().reverse().map(r=>`<tr><td>${escapeHtml(String(r.measuredAt||'').replace('T',' ').slice(0,16))}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${Number(r.tempRaw).toFixed(2)}</td><td>${Number(r.tempFactor).toFixed(2)}</td><td>${Number(r.tempCorrected).toFixed(2)}</td><td>${Number(r.tempCriterion?.min??360)}–${Number(r.tempCriterion?.max??390)}</td><td><span class="badge">${r.overallResult}</span></td><td>${escapeHtml(r.statisticalState||'ESTABLECIMIENTO')}</td></tr>`).join('')||'<tr><td colspan="8">Sin registros todavía.</td></tr>';$('#digAi').innerHTML=!rows.length?'<b>IA:</b> Aún no existen registros del Digestor EI-154. El primer control iniciará la trazabilidad.':`<b>IA · Diagnóstico:</b> Último control <b>${rows.at(-1).overallResult}</b> con ${Number(rows.at(-1).tempCorrected).toFixed(2)} °C corregidos. ${rows.length<10?`${rows.length}/10 registros; fase de establecimiento.`:`Estado estadístico: <b>${w.state}</b>.`}`;}
async function renderDigestorManagement(def,month){const rows=(await digestorRecords(def.id)).filter(r=>String(r.measuredAt||'').startsWith(month)),vals=rows.map(r=>Number(r.tempCorrected)),w=dbo5Westgard(vals),ok=rows.filter(r=>r.overallResult==='CUMPLE').length;$('#ccChart1Title').textContent='Digestor EI-154 · Temperatura corregida';$('#ccChart1Desc').textContent='Lectura corregida, media, ±1s, ±2s, ±3s y criterio técnico 360–390 °C.';$('#ccChart2Title').textContent='Configuración metrológica';$('#ccChart2Desc').textContent='Factor aplicado y trazabilidad de calibración.';if(!rows.length){showControlChartNoData('Digestor EI-154',month);return;}$('#ccKpis').innerHTML=`<div><small>Controles</small><b>${rows.length}</b><span>${month}</span></div><div><small>Cumplimiento</small><b>${(ok/rows.length*100).toFixed(1)}%</b><span>${ok}/${rows.length}</span></div><div><small>Media ± s</small><b>${mean(vals).toFixed(2)} ± ${sd(vals).toFixed(2)} °C</b></div><div><small>Equipo</small><b>EI-154</b><span>Digestor NTK</span></div>`;$('#ccTempState').textContent=rows.length<10?'ESTABLECIMIENTO':w.state;$('#ccHumState').textContent='METROLOGÍA';$('#ccTempChart').innerHTML=ccSvgLine(rows,'tempCorrected','°C',360,390);const cfg=digestorConfig(def);$('#ccHumChart').innerHTML=`<div class="dbo5-ai"><b>Configuración vigente EI-154</b><br>Criterio: ${cfg.criterion.min}–${cfg.criterion.max} °C.<br>${cfg.correctionRanges.map(r=>`${r.min}–${r.max} °C → ${r.factor>=0?'+':''}${r.factor} °C`).join('<br>')}<br>Vigente desde: ${escapeHtml(cfg.effectiveFrom||'—')}</div>`;$('#ccRules').innerHTML=(w.rules||[]).length?(w.rules||[]).map(r=>`<div class="cc-rule"><b>${escapeHtml(r)}</b><span>Temperatura corregida</span></div>`).join(''):'<div class="cc-ok">Sin reglas de alarma.</div>';$('#ccAi').innerHTML=`<b>Diagnóstico mensual Digestor EI-154:</b> ${ok}/${rows.length} controles cumplen 360–390 °C. ${rows.length<10?'FASE DE ESTABLECIMIENTO hasta completar 10 registros.':`Estado estadístico: <b>${w.state}</b>.`} La evaluación usa la temperatura corregida y el factor histórico congelado en cada registro.`;$('#ccHistoryBody').innerHTML=rows.slice().reverse().map(r=>`<tr><td>${ccFmtDate(r.measuredAt)}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${Number(r.tempRaw).toFixed(2)} °C</td><td>${Number(r.tempFactor).toFixed(2)} °C → ${Number(r.tempCorrected).toFixed(2)} °C</td><td><span class="badge">${escapeHtml(r.overallResult)}</span></td><td>${escapeHtml(r.statisticalState||'ESTABLECIMIENTO')}</td><td>${escapeHtml((r.statisticalRules||[]).join(', ')||'—')}</td></tr>`).join('');}

// 6.33.16 · Nevera EI-269 · temperatura corregida con configuración metrológica histórica.
function hasEquipmentIdentity(v,code){const x=normalizeIdentityText(v||'').replace(/[^a-z0-9]+/g,'');return x.includes(String(code||'').toLowerCase().replace(/[^a-z0-9]+/g,''));}
function isFridge344Chart(d){if(!d)return false;const n=normalizeIdentityText(d.name||''),m=normalizeIdentityText(d.methodName||''),k=normalizeIdentityText(d.controlKey||d.equipmentKey||''),o=normalizeIdentityText(d.notes||'');return hasEquipmentIdentity(d.name,'EI-344')||hasEquipmentIdentity(d.methodName,'EI-344')||hasEquipmentIdentity(d.controlKey||d.equipmentKey,'EI-344')||hasEquipmentIdentity(d.metrologyConfig?.equipment,'EI-344')||hasEquipmentIdentity(d.notes,'EI-344')||((n.includes('nevera')||m.includes('nevera')||o.includes('nevera'))&&(n.includes('estandar')||m.includes('estandar')||o.includes('estandar')||n.includes('patron')||m.includes('patron')||o.includes('patron')))||(n.includes('carta de control patrones')||m.includes('control de patrones'));}
function fridge344DefaultConfig(){return {equipment:'EI-344',criterion:{min:2,max:8},correctionRanges:[{min:0,max:6,factor:-0.67},{min:6,max:10,factor:-0.56}],effectiveFrom:dateToday(),certificateRef:'',version:1};}
function fridge344Config(def){return def?.metrologyConfig?.equipment==='EI-344'?def.metrologyConfig:fridge344DefaultConfig();}
function fridge344Calc(v,cfg){const raw=Number(v);if(!Number.isFinite(raw))return {valid:false};const ranges=cfg.correctionRanges||[];const r=ranges.find((x,i)=>raw>=Number(x.min)&&(i===ranges.length-1?raw<=Number(x.max):raw<Number(x.max)));if(!r)return {valid:false,raw,reason:'SIN_FACTOR'};const corrected=raw+Number(r.factor),ok=corrected>=Number(cfg.criterion.min)&&corrected<=Number(cfg.criterion.max);return {valid:true,raw,factor:Number(r.factor),corrected,ok,range:{min:Number(r.min),max:Number(r.max)}};}
function fridge344Records(chartId){return getAll('controlChartRecords').then(rows=>rows.filter(r=>r.chartId===chartId&&r.controlType==='NEVERA_EI344').sort((a,b)=>String(a.measuredAt).localeCompare(String(b.measuredAt))));}
async function openFridge344Control(def,date,analystId){const dlg=$('#fridge344ControlDialog');if(!dlg)return toast('Formato Nevera EI-344 no disponible');$('#fridge344ChartId').value=def.id;$('#fridge344AnalystId').value=analystId||'';$('#fridge344InputDate').value=date||dateToday();$('#fridge344Time').value=new Date().toTimeString().slice(0,5);$('#fridge344TempRaw').value='';$('#fridge344Notes').value='';$('#fridge344Preview').innerHTML='';renderFridge344344Config(def);await renderFridge344(def.id);if(typeof dlg.showModal==='function')dlg.showModal();else dlg.setAttribute('open','');}
function renderFridge344344Config(def){const cfg=fridge344Config(def),box=$('#fridge344CorrectionRows');if(!box)return;$('#fridge344CriterionMin').value=cfg.criterion.min;$('#fridge344CriterionMax').value=cfg.criterion.max;$('#fridge344EffectiveFrom').value=cfg.effectiveFrom||dateToday();$('#fridge344CertificateRef').value=cfg.certificateRef||'';box.innerHTML=(cfg.correctionRanges||[]).map((r,i)=>`<div class="inc-config-row"><input data-fridge344-min type="number" step="0.01" value="${r.min}"><input data-fridge344-max type="number" step="0.01" value="${r.max}"><input data-fridge344-factor type="number" step="0.01" value="${r.factor}"></div>`).join('');const sec=$('#fridge344ConfigSection');if(sec)sec.classList.toggle('hidden',currentSessionUser?.role!=='JEFE');}
function previewFridge344(){const defId=$('#fridge344ChartId')?.value;if(!defId)return;getOne('controlChartDefs',defId).then(def=>{const c=fridge344Calc($('#fridge344TempRaw').value,fridge344Config(def)),box=$('#fridge344Preview');if(!box)return;if(!Number.isFinite(c.raw)){box.innerHTML='';return;}if(!c.valid){box.innerHTML='<div class="alert warn"><b>Sin factor de corrección aplicable.</b> La lectura está fuera de la tabla vigente 0–10 °C y no puede guardarse.</div>';return;}box.innerHTML=`<div class="cc-detail-grid"><div><small>Lectura</small><b>${c.raw.toFixed(2)} °C</b></div><div><small>Factor</small><b>${c.factor>=0?'+':''}${c.factor.toFixed(2)} °C</b><span>rango ${c.range.min}–${c.range.max} °C</span></div><div><small>Temperatura corregida</small><b>${c.corrected.toFixed(2)} °C</b></div><div><small>Resultado</small><b>${c.ok?'CUMPLE':'NO CUMPLE'}</b><span>criterio 2–8 °C</span></div></div>`;});}
async function saveFridge344Config(){if(currentSessionUser?.role!=='JEFE')return toast('Solo JEFE/Calidad puede cambiar la configuración metrológica');const id=$('#fridge344ChartId').value,def=await getOne('controlChartDefs',id);if(!def)return;const mins=$$('[data-fridge344-min]'),maxs=$$('[data-fridge344-max]'),factors=$$('[data-fridge344-factor]'),ranges=mins.map((el,i)=>({min:Number(el.value),max:Number(maxs[i].value),factor:Number(factors[i].value)}));if(ranges.some(r=>![r.min,r.max,r.factor].every(Number.isFinite)||r.max<=r.min))return toast('Revise los rangos y factores');ranges.sort((a,b)=>a.min-b.min);const cmin=Number($('#fridge344CriterionMin').value),cmax=Number($('#fridge344CriterionMax').value);if(!Number.isFinite(cmin)||!Number.isFinite(cmax)||cmax<=cmin)return toast('Revise el criterio técnico');const old=fridge344Config(def);def.metrologyConfig={equipment:'EI-344',criterion:{min:cmin,max:cmax},correctionRanges:ranges,effectiveFrom:$('#fridge344EffectiveFrom').value||dateToday(),certificateRef:$('#fridge344CertificateRef').value.trim(),version:Number(old.version||1)+1};def.updatedAt=nowISO();await put('controlChartDefs',def);await queue('UPDATE','controlChartDefs',def);await audit('CONFIGURAR','CARTA_CONTROL_NEVERA',def.id,`Configuración metrológica v${def.metrologyConfig.version}`);renderFridge344344Config(def);previewFridge344();toast('Configuración metrológica EI-344 guardada');}
async function saveFridge344Control(e){e.preventDefault();const chartId=$('#fridge344ChartId').value,analystId=$('#fridge344AnalystId').value,def=await getOne('controlChartDefs',chartId),cfg=fridge344Config(def),c=fridge344Calc($('#fridge344TempRaw').value,cfg);if(!c.valid)return toast('Lectura fuera de la tabla de corrección vigente. No se puede guardar sin factor aplicable.');const date=$('#fridge344InputDate').value,time=$('#fridge344Time').value,all=await getAll('controlChartRecords');if(all.find(x=>x.chartId===chartId&&String(x.measuredAt||'').slice(0,10)===date))return toast('La Carta de Nevera EI-344 ya fue completada hoy.');const analysts=await getAll('analysts'),a=analysts.find(x=>x.id===analystId),existing=await fridge344Records(chartId),vals=[...existing.map(r=>Number(r.tempCorrected)),c.corrected],w=dbo5Westgard(vals),stat=existing.length+1<10?'ESTABLECIMIENTO':w.state;const rec={id:uid('CCR'),chartId,controlType:'NEVERA_EI344',section:def?.section||'RECEPCION_MUESTRAS',methodName:def?.methodName||'Nevera',equipment:'EI-344',analystId,analystName:a?.name||firebaseBridge?.authUser?.email||'Usuario',measuredAt:`${date}T${time}:00`,tempRaw:c.raw,tempFactor:c.factor,tempCorrected:c.corrected,tempCriterion:{...cfg.criterion},correctionRangeSnapshot:{...c.range},metrologyConfigSnapshot:JSON.parse(JSON.stringify(cfg)),overallResult:c.ok?'CUMPLE':'NO CUMPLE',statisticalState:stat,statisticalRules:w.rules||[],notes:$('#fridge344Notes').value.trim(),schemaVersion:1,createdAt:nowISO(),updatedAt:nowISO()};await put('controlChartRecords',rec);await queue('CREATE','controlChartRecords',rec);await createControlChartCompletionAlert(rec,def);await audit('REGISTRAR','CARTA_CONTROL_NEVERA',rec.id,`${rec.overallResult} · ${c.raw.toFixed(2)} → ${c.corrected.toFixed(2)} °C · factor ${c.factor.toFixed(2)}`);toast('Control Nevera EI-344 guardado y enviado a Firebase');$('#fridge344TempRaw').value='';$('#fridge344Notes').value='';$('#fridge344Preview').innerHTML='';await renderFridge344(chartId);}
async function renderFridge344(chartId){const rows=await fridge344Records(chartId),body=$('#fridge344HistoryBody');if(!body)return;const vals=rows.map(r=>Number(r.tempCorrected)),w=dbo5Westgard(vals);$('#fridge344HistoryCount').textContent=`${rows.length} registros`;$('#fridge344Stats').innerHTML=rows.length<10?`<div><small>Estado estadístico</small><b>FASE DE ESTABLECIMIENTO</b></div><div><small>Datos requeridos</small><b>${rows.length}/10</b></div><div><small>Temperatura</small><b>—</b></div>`:`<div><small>Temperatura media ± s</small><b>${mean(vals).toFixed(2)} ± ${sd(vals).toFixed(2)} °C</b></div><div><small>Estado</small><b>${w.state}</b></div><div><small>Reglas</small><b>${(w.rules||[]).join(', ')||'Sin alarmas'}</b></div>`;body.innerHTML=rows.slice().reverse().map(r=>`<tr><td>${escapeHtml(String(r.measuredAt||'').replace('T',' ').slice(0,16))}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${Number(r.tempRaw).toFixed(2)}</td><td>${Number(r.tempFactor)>=0?'+':''}${Number(r.tempFactor).toFixed(2)}</td><td>${Number(r.tempCorrected).toFixed(2)}</td><td>${Number(r.tempCriterion?.min??0).toFixed(1)}–${Number(r.tempCriterion?.max??6).toFixed(1)}</td><td><span class="badge">${r.overallResult}</span></td><td>${escapeHtml(r.statisticalState||'ESTABLECIMIENTO')}</td></tr>`).join('')||'<tr><td colspan="8">Sin registros todavía.</td></tr>';const ai=$('#fridge344Ai');if(!rows.length)ai.innerHTML='<b>IA:</b> Aún no existen registros de Nevera EI-344. El primer control iniciará la trazabilidad.';else{const last=rows.at(-1);ai.innerHTML=`<b>IA · Diagnóstico:</b> Último control <b>${last.overallResult}</b>: ${Number(last.tempRaw).toFixed(2)} °C ${Number(last.tempFactor)>=0?'+':''}${Number(last.tempFactor).toFixed(2)} = <b>${Number(last.tempCorrected).toFixed(2)} °C</b>. ${rows.length<10?`Fase de establecimiento ${rows.length}/10.`:`Estado estadístico: <b>${w.state}</b>.`} Los factores históricos permanecen congelados por registro.`;}}
async function renderFridge344344Management(def,month){const all=await fridge344Records(def.id),rows=all.filter(r=>String(r.measuredAt||'').startsWith(month));$('#ccChart3Card').classList.add('hidden');$('#ccChart1Title').textContent='Nevera EI-344 · Temperatura corregida';$('#ccChart1Desc').textContent='Media, ±1s, ±2s, ±3s y criterio técnico histórico 2–8 °C.';$('#ccChart2Title').textContent='Configuración metrológica';$('#ccChart2Desc').textContent='Factores vigentes y trazabilidad de calibración.';if(!rows.length){showControlChartNoData('Nevera EI-344',month);return;}const vals=rows.map(r=>Number(r.tempCorrected)),w=dbo5Westgard(vals),ok=rows.filter(r=>r.overallResult==='CUMPLE').length;$('#ccKpis').innerHTML=`<div><small>Controles</small><b>${rows.length}</b><span>${month}</span></div><div><small>Cumplimiento</small><b>${(100*ok/rows.length).toFixed(1)}%</b><span>${ok}/${rows.length} cumplen</span></div><div><small>Temperatura media ± s</small><b>${mean(vals).toFixed(2)} ± ${sd(vals).toFixed(2)} °C</b><span>mín ${Math.min(...vals).toFixed(2)} · máx ${Math.max(...vals).toFixed(2)}</span></div><div><small>Equipo</small><b>EI-344</b><span>criterio 2–8 °C</span></div>`;$('#ccTempState').textContent=rows.length<10?'ESTABLECIMIENTO':w.state;$('#ccTempChart').innerHTML=ccSvgLine(rows,'tempCorrected','°C',2,8);$('#ccHumState').textContent='METROLOGÍA';$('#ccHumChart').innerHTML=`<div class="cc-config-summary"><b>Tabla de corrección utilizada</b><p>0–6 °C → −0.67 °C · 6–10 °C → −0.56 °C</p><small>Cada registro conserva la configuración histórica utilizada.</small></div>`;$('#ccAi').innerHTML=`<b>Diagnóstico mensual Nevera EI-344:</b> ${ok}/${rows.length} controles cumplen 2–8 °C. ${rows.length<10?'La serie permanece en FASE DE ESTABLECIMIENTO hasta completar 10 registros.':`Estado estadístico: <b>${w.state}</b>.`} La IA no modifica factores ni criterios.`;$('#ccRules').innerHTML=(w.rules||[]).length?`<div class="alert warn">${escapeHtml(w.rules.join(' · '))}</div>`:'<div class="alert success">No se detectan reglas de alarma en la serie.</div>';$('#ccHistoryHead').innerHTML='<tr><th>Fecha/hora</th><th>Responsable</th><th>T leída</th><th>Factor</th><th>T corregida</th><th>Resultado</th><th>Estadístico</th></tr>';$('#ccHistoryBody').innerHTML=rows.slice().reverse().map(r=>`<tr><td>${ccFmtDate(r.measuredAt)}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${Number(r.tempRaw).toFixed(2)}</td><td>${Number(r.tempFactor)>=0?'+':''}${Number(r.tempFactor).toFixed(2)}</td><td>${Number(r.tempCorrected).toFixed(2)}</td><td>${r.overallResult}</td><td>${escapeHtml(r.statisticalState||'ESTABLECIMIENTO')}</td></tr>`).join('');$('#ccCount').textContent=`${rows.length} registros · ${month}`;}


function isOven314Chart(d){if(!d)return false;const n=normalizeIdentityText(d.name||''),m=normalizeIdentityText(d.methodName||''),k=normalizeIdentityText(d.controlKey||d.equipmentKey||'');return hasEquipmentIdentity(d.name,'EI-314')||hasEquipmentIdentity(d.methodName,'EI-314')||hasEquipmentIdentity(d.controlKey||d.equipmentKey,'EI-314')||k.includes('ei 314')||(n.includes('carta de control de estufa')&&!n.includes('incubadora'));}
function oven314DefaultConfig(){return {equipment:'EI-314',referenceThermometer:'EI-317',area:'Instrumental',criterion:{min:103,max:105},correctionRanges:[{min:102,max:104,factor:0.01},{min:104,max:106,factor:0.01}],effectiveFrom:dateToday(),certificateRef:'Carta de Control estufa EI-314',version:1};}
function oven314Config(def){const c=def?.metrologyConfig;return c?.equipment==='EI-314'?c:oven314DefaultConfig();}
function oven314Calc(v,cfg){const raw=Number(v);if(!Number.isFinite(raw))return {valid:false};const ranges=cfg.correctionRanges||[];const r=ranges.find((x,i)=>raw>=Number(x.min)&&(i===ranges.length-1?raw<=Number(x.max):raw<Number(x.max)));if(!r)return {valid:false,raw,reason:'SIN_FACTOR'};const corrected=raw+Number(r.factor),ok=corrected>=Number(cfg.criterion.min)&&corrected<=Number(cfg.criterion.max);return {valid:true,raw,factor:Number(r.factor),corrected,ok,range:{min:Number(r.min),max:Number(r.max)}};}
async function oven314Records(chartId){return (await getAll('controlChartRecords')).filter(r=>r.chartId===chartId&&r.controlType==='ESTUFA_EI314').sort((a,b)=>String(a.measuredAt).localeCompare(String(b.measuredAt)));}
function renderOven314Config(def){const cfg=oven314Config(def),sec=$('#oven314ConfigSection');if(sec)sec.classList.toggle('hidden',currentSessionUser?.role!=='JEFE');if(currentSessionUser?.role!=='JEFE')return;$('#oven314CriterionMin').value=cfg.criterion.min;$('#oven314CriterionMax').value=cfg.criterion.max;$('#oven314EffectiveFrom').value=cfg.effectiveFrom||dateToday();$('#oven314CertificateRef').value=cfg.certificateRef||'';$('#oven314CorrectionRows').innerHTML=(cfg.correctionRanges||[]).map(r=>`<div class="inc-config-row"><input data-oven-min type="number" step="0.01" value="${r.min}"><input data-oven-max type="number" step="0.01" value="${r.max}"><input data-oven-factor type="number" step="0.01" value="${r.factor}"></div>`).join('');}
async function openOven314Control(def,date,analystId,completedRec){const dlg=$('#oven314ControlDialog');if(!dlg)return toast('Formato Estufa EI-314 no disponible');$('#oven314ChartId').value=def.id;$('#oven314AnalystId').value=analystId||'';$('#oven314InputDate').value=date||dateToday();$('#oven314Time').value=new Date().toTimeString().slice(0,5);$('#oven314TempRaw').value='';$('#oven314Notes').value='';$('#oven314Preview').innerHTML='';renderOven314Config(def);await renderOven314(def.id);const existing=completedRec||(await oven314Records(def.id)).find(r=>String(r.measuredAt||'').slice(0,10)===(date||dateToday()));const submit=$('#oven314ControlForm button[type="submit"]');for(const id of ['oven314TempRaw','oven314Notes'])$('#'+id).disabled=!!existing;if(existing){$('#oven314TempRaw').value=Number(existing.tempRaw).toFixed(2);$('#oven314Notes').value=existing.notes||'';submit.disabled=true;submit.textContent=`✓ COMPLETADA HOY · ${existing.analystName||'Responsable'}`;$('#oven314Preview').innerHTML=`<div class="preview-ok"><b>Control diario ya realizado.</b><span>${Number(existing.tempCorrected).toFixed(2)} °C · ${existing.overallResult}</span></div>`;}else{submit.disabled=false;submit.textContent='Guardar control Estufa EI-314';}if(typeof dlg.showModal==='function')dlg.showModal();else dlg.setAttribute('open','');}
function previewOven314(){const id=$('#oven314ChartId')?.value;if(!id)return;getOne('controlChartDefs',id).then(def=>{const cfg=oven314Config(def),c=oven314Calc($('#oven314TempRaw').value,cfg),box=$('#oven314Preview');if(!box)return;if(!Number.isFinite(c.raw)){box.innerHTML='';return;}if(!c.valid){box.innerHTML='<div class="alert warn"><b>Lectura fuera de la tabla metrológica vigente.</b> No se inventará un factor de corrección y el registro queda bloqueado.</div>';return;}const factor=currentSessionUser?.role==='JEFE'?`<div><small>Factor</small><b>${c.factor>=0?'+':''}${c.factor.toFixed(2)} °C</b><span>${c.range.min}–${c.range.max} °C</span></div>`:'';box.innerHTML=`<div class="cc-detail-grid"><div><small>Lectura</small><b>${c.raw.toFixed(2)} °C</b></div>${factor}<div><small>Temperatura evaluada</small><b>${c.corrected.toFixed(2)} °C</b></div><div><small>Resultado</small><b>${c.ok?'CUMPLE':'NO CUMPLE'}</b><span>criterio ${cfg.criterion.min}–${cfg.criterion.max} °C</span></div></div>`;});}
async function saveOven314Config(){if(currentSessionUser?.role!=='JEFE')return toast('Solo JEFE/Calidad puede cambiar la configuración metrológica');const id=$('#oven314ChartId').value,def=await getOne('controlChartDefs',id);if(!def)return;const mins=$$('[data-oven-min]'),maxs=$$('[data-oven-max]'),factors=$$('[data-oven-factor]'),ranges=mins.map((el,i)=>({min:Number(el.value),max:Number(maxs[i].value),factor:Number(factors[i].value)}));if(ranges.some(r=>![r.min,r.max,r.factor].every(Number.isFinite)||r.max<=r.min))return toast('Revise rangos y factores');const cmin=Number($('#oven314CriterionMin').value),cmax=Number($('#oven314CriterionMax').value);if(!Number.isFinite(cmin)||!Number.isFinite(cmax)||cmax<=cmin)return toast('Revise el criterio técnico');const old=oven314Config(def);def.metrologyConfig={equipment:'EI-314',referenceThermometer:'EI-317',area:'Instrumental',criterion:{min:cmin,max:cmax},correctionRanges:ranges.sort((a,b)=>a.min-b.min),effectiveFrom:$('#oven314EffectiveFrom').value||dateToday(),certificateRef:$('#oven314CertificateRef').value.trim(),version:Number(old.version||1)+1};def.updatedAt=nowISO();await put('controlChartDefs',def);await queue('UPDATE','controlChartDefs',def);await audit('CONFIGURAR','CARTA_CONTROL_ESTUFA',def.id,`Configuración metrológica v${def.metrologyConfig.version}`);renderOven314Config(def);previewOven314();toast('Configuración metrológica Estufa EI-314 guardada');}
async function saveOven314Control(e){e.preventDefault();const chartId=$('#oven314ChartId').value,analystId=$('#oven314AnalystId').value,def=await getOne('controlChartDefs',chartId),cfg=oven314Config(def),date=$('#oven314InputDate').value,time=$('#oven314Time').value,c=oven314Calc($('#oven314TempRaw').value,cfg);if(!c.valid)return toast('Lectura fuera de la tabla de corrección vigente. No se guardará sin factor aplicable.');const all=await getAll('controlChartRecords');if(all.some(x=>x.chartId===chartId&&String(x.measuredAt||'').slice(0,10)===date))return toast('La Estufa EI-314 ya fue controlada hoy.');const a=(await getAll('analysts')).find(x=>x.id===analystId),existing=await oven314Records(chartId),vals=[...existing.map(r=>Number(r.tempCorrected)),c.corrected],w=dbo5Westgard(vals),stat=existing.length+1<10?'ESTABLECIMIENTO':w.state;const rec={id:`CCR-ESTUFA-EI314-${String(chartId).replace(/[^a-zA-Z0-9_-]/g,'_')}-${date}`,chartId,controlType:'ESTUFA_EI314',section:def?.section||'ENSAYOS_ANALITICOS',methodName:def?.methodName||'Control de estufa',equipment:'EI-314',referenceThermometer:'EI-317',analystId,analystName:a?.name||currentSessionUser?.name||'Usuario',measuredAt:`${date}T${time}:00`,tempRaw:c.raw,tempFactor:c.factor,tempCorrected:c.corrected,tempCriterion:{...cfg.criterion},correctionRangeSnapshot:{...c.range},metrologyConfigSnapshot:JSON.parse(JSON.stringify(cfg)),overallResult:c.ok?'CUMPLE':'NO CUMPLE',statisticalState:stat,statisticalRules:w.rules||[],notes:$('#oven314Notes').value.trim(),schemaVersion:1,createdAt:nowISO(),updatedAt:nowISO()};await put('controlChartRecords',rec);await queue('CREATE','controlChartRecords',rec);await createControlChartCompletionAlert(rec,def);await audit('REGISTRAR','CARTA_CONTROL_ESTUFA',rec.id,`${rec.overallResult} · ${c.corrected.toFixed(2)} °C`);toast('Control Estufa EI-314 guardado y sincronizado');await renderOven314(chartId);await renderMyDayControlCharts(date,analystId);}
async function renderOven314(chartId){const rows=await oven314Records(chartId),vals=rows.map(r=>Number(r.tempCorrected)),w=dbo5Westgard(vals),last=rows.at(-1);$('#oven314HistoryCount').textContent=`${rows.length} registros`;$('#oven314Stats').innerHTML=`<div><small>Estado estadístico</small><b>${rows.length<10?'FASE DE ESTABLECIMIENTO':w.state}</b></div><div><small>Datos requeridos</small><b>${Math.min(rows.length,10)}/10</b></div><div><small>Temperatura media ± s</small><b>${rows.length?mean(vals).toFixed(2)+' ± '+sd(vals).toFixed(2)+' °C':'—'}</b></div>`;$('#oven314HistoryBody').innerHTML=rows.length?rows.slice().reverse().map(r=>`<tr><td>${ccFmtDate(r.measuredAt)}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${Number(r.tempRaw).toFixed(2)}</td><td>${Number(r.tempCorrected).toFixed(2)}</td><td>${r.overallResult}</td><td>${escapeHtml(r.statisticalState||'ESTABLECIMIENTO')}</td></tr>`).join(''):'<tr><td colspan="6">Sin registros todavía.</td></tr>';$('#oven314Ai').innerHTML=last?`<b>IA · Diagnóstico:</b> El último control <b>${last.overallResult}</b> con ${Number(last.tempCorrected).toFixed(2)} °C. ${rows.length<10?`Hay ${rows.length} de 10 registros para establecer vigilancia estadística.`:`Estado estadístico: <b>${w.state}</b>.`} La IA no modifica el criterio 103–105 °C ni la configuración metrológica.`:'<b>IA:</b> Aún no existen registros de Estufa EI-314. El primer control iniciará la trazabilidad.';}
async function renderOven314Management(def,month){const rows=(await oven314Records(def.id)).filter(r=>String(r.measuredAt||'').startsWith(month));$('#ccChart3Card').classList.add('hidden');$('#ccChart1Title').textContent='Estufa EI-314 · Temperatura corregida';$('#ccChart1Desc').textContent='Media, ±1s, ±2s, ±3s y criterio técnico histórico 103–105 °C.';$('#ccChart2Title').textContent='Configuración metrológica';$('#ccChart2Desc').textContent='Tabla auxiliar, vigencia y trazabilidad de calibración.';if(!rows.length){showControlChartNoData('Estufa EI-314',month);return;}const vals=rows.map(r=>Number(r.tempCorrected)),w=dbo5Westgard(vals),ok=rows.filter(r=>r.overallResult==='CUMPLE').length;$('#ccKpis').innerHTML=`<div><small>Controles</small><b>${rows.length}</b><span>${month}</span></div><div><small>Cumplimiento</small><b>${(100*ok/rows.length).toFixed(1)}%</b><span>${ok}/${rows.length}</span></div><div><small>Temperatura media ± s</small><b>${mean(vals).toFixed(2)} ± ${sd(vals).toFixed(2)} °C</b><span>mín ${Math.min(...vals).toFixed(2)} · máx ${Math.max(...vals).toFixed(2)}</span></div><div><small>Equipo</small><b>EI-314</b><span>criterio 103–105 °C</span></div>`;$('#ccTempState').textContent=rows.length<10?'ESTABLECIMIENTO':w.state;$('#ccTempChart').innerHTML=ccSvgLine(rows,'tempCorrected','°C',103,105);$('#ccHumState').textContent='METROLOGÍA';$('#ccHumChart').innerHTML='<div class="cc-config-summary"><b>Tabla de corrección base</b><p>102–&lt;104 °C → +0.01 °C · 104–106 °C → +0.01 °C</p><small>Referencia de medición EI-317. Cada registro conserva snapshot histórico.</small></div>';$('#ccAi').innerHTML=`<b>Diagnóstico mensual Estufa EI-314:</b> ${ok}/${rows.length} controles cumplen 103–105 °C. ${rows.length<10?'Serie en FASE DE ESTABLECIMIENTO.':`Estado estadístico: <b>${w.state}</b>.`} La IA no altera criterios ni factores.`;$('#ccRules').innerHTML=(w.rules||[]).length?`<div class="alert warn">${escapeHtml(w.rules.join(' · '))}</div>`:'<div class="alert success">No se detectan reglas de alarma en la serie.</div>';$('#ccHistoryHead').innerHTML='<tr><th>Fecha/hora</th><th>Responsable</th><th>T leída</th><th>T corregida</th><th>Resultado</th><th>Estadístico</th></tr>';$('#ccHistoryBody').innerHTML=rows.slice().reverse().map(r=>`<tr><td>${ccFmtDate(r.measuredAt)}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${Number(r.tempRaw).toFixed(2)}</td><td>${Number(r.tempCorrected).toFixed(2)}</td><td>${r.overallResult}</td><td>${escapeHtml(r.statisticalState||'ESTABLECIMIENTO')}</td></tr>`).join('');$('#ccCount').textContent=`${rows.length} registros · ${month}`;}

function isMicrobiologyAgarFridgeChart(d){if(!d)return false;const n=normalizeIdentityText(d.name||''),m=normalizeIdentityText(d.methodName||''),k=normalizeIdentityText(d.controlKey||d.equipmentKey||''),sec=normalizeIdentityText([d.section,d.sectionName,d.area,d.areaName,(d.sections||[]).join(' ')].filter(Boolean).join(' '));return (hasEquipmentIdentity(d.name,'EI-69')||hasEquipmentIdentity(d.methodName,'EI-69')||hasEquipmentIdentity(d.controlKey||d.equipmentKey,'EI-69')||hasEquipmentIdentity(d.metrologyConfig?.equipment,'EI-69')||((n.includes('nevera')&&n.includes('agar'))||(m.includes('nevera')&&m.includes('agar'))))&&(n.includes('microbiologia')||m.includes('microbiologia')||k.includes('microbiologia')||sec.includes('microbiologia'));}
function isFridgeChart(d){if(!d)return false;const n=normalizeIdentityText(d.name||''),m=normalizeIdentityText(d.methodName||''),o=normalizeIdentityText(d.notes||'');if(isFridge344Chart(d))return false;return isMicrobiologyAgarFridgeChart(d)||hasEquipmentIdentity(d.name,'EI-269')||hasEquipmentIdentity(d.methodName,'EI-269')||hasEquipmentIdentity(d.controlKey||d.equipmentKey,'EI-269')||hasEquipmentIdentity(d.metrologyConfig?.equipment,'EI-269')||hasEquipmentIdentity(d.notes,'EI-269')||((n.includes('nevera')||m.includes('nevera')||o.includes('nevera'))&&!n.includes('estandar')&&!m.includes('estandar')&&!o.includes('estandar'));}
function fridgeIdentity(def){return isMicrobiologyAgarFridgeChart(def)?{equipment:'EI-69',label:'Nevera de AGARES MICROBIOLOGÍA EI-69',criterion:{min:2,max:8},controlType:'NEVERA_MICROBIOLOGIA_EI69',reference:'PG0406-04 Control de Condiciones Nevera de Caldos y Agares preparados'}:{equipment:'EI-269',label:'Nevera EI-269',criterion:{min:0,max:6},controlType:'NEVERA_EI269',reference:''};}
function fridgeDefaultConfig(def){const x=fridgeIdentity(def);return {equipment:x.equipment,criterion:{...x.criterion},correctionRanges:[{min:0,max:4,factor:0.46},{min:4,max:10,factor:0.56}],effectiveFrom:dateToday(),certificateRef:x.reference,version:1};}
function fridgeConfig(def){const x=fridgeIdentity(def),c=def?.metrologyConfig;return c?.equipment===x.equipment?{...fridgeDefaultConfig(def),...c,criterion:{...x.criterion,...(c.criterion||{})}}:fridgeDefaultConfig(def);}
function fridgeCalc(v,cfg){const raw=Number(v);if(!Number.isFinite(raw))return {valid:false};const ranges=cfg.correctionRanges||[];const r=ranges.find((x,i)=>raw>=Number(x.min)&&(i===ranges.length-1?raw<=Number(x.max):raw<Number(x.max)));if(!r)return {valid:false,raw,reason:'SIN_FACTOR'};const corrected=raw+Number(r.factor),ok=corrected>=Number(cfg.criterion.min)&&corrected<=Number(cfg.criterion.max);return {valid:true,raw,factor:Number(r.factor),corrected,ok,range:{min:Number(r.min),max:Number(r.max)}};}
function fridgeRecords(chartId){return getAll('controlChartRecords').then(rows=>rows.filter(r=>r.chartId===chartId&&(r.controlType==='NEVERA_EI269'||r.controlType==='NEVERA_MICROBIOLOGIA_EI69'||(r.historicalEntry===true&&r.controlType==='NEVERA'))).sort((a,b)=>String(a.measuredAt).localeCompare(String(b.measuredAt))));}
function updateFridgeDialogIdentity(def){const x=fridgeIdentity(def),cfg=fridgeConfig(def),dlg=$('#fridgeControlDialog');if(!dlg)return;const ey=dlg.querySelector('.eyebrow');if(ey)ey.textContent=`CARTA DE CONTROL · ${x.label.toUpperCase()}`;const kpis=dlg.querySelectorAll('.dbo5-kpis b');if(kpis[0])kpis[0].textContent=x.label;if(kpis[3])kpis[3].textContent=`${cfg.criterion.min}–${cfg.criterion.max} °C`;const save=dlg.querySelector('#fridgeControlForm button[type="submit"]');if(save)save.textContent=`Guardar control ${x.label}`;const legend=dlg.querySelectorAll('.dbo5-legend span');if(legend[1])legend[1].textContent=`Criterio ${cfg.criterion.min}–${cfg.criterion.max} °C`;const h4=dlg.querySelector('#fridgeConfigSection h4');if(h4)h4.textContent=`⚙ Configuración metrológica ${x.equipment} · JEFE/Calidad`;}
async function openFridgeControl(def,date,analystId){const dlg=$('#fridgeControlDialog');if(!dlg)return toast('Formato de Nevera no disponible');$('#fridgeChartId').value=def.id;$('#fridgeAnalystId').value=analystId||'';$('#fridgeInputDate').value=date||dateToday();$('#fridgeTime').value=new Date().toTimeString().slice(0,5);$('#fridgeTempRaw').value='';$('#fridgeNotes').value='';$('#fridgePreview').innerHTML='';updateFridgeDialogIdentity(def);renderFridgeConfig(def);await renderFridge(def.id);if(typeof dlg.showModal==='function')dlg.showModal();else dlg.setAttribute('open','');}
function renderFridgeConfig(def){const cfg=fridgeConfig(def),box=$('#fridgeCorrectionRows');if(!box)return;$('#fridgeCriterionMin').value=cfg.criterion.min;$('#fridgeCriterionMax').value=cfg.criterion.max;$('#fridgeEffectiveFrom').value=cfg.effectiveFrom||dateToday();$('#fridgeCertificateRef').value=cfg.certificateRef||'';box.innerHTML=(cfg.correctionRanges||[]).map(r=>`<div class="inc-config-row"><input data-fridge-min type="number" step="0.01" value="${r.min}"><input data-fridge-max type="number" step="0.01" value="${r.max}"><input data-fridge-factor type="number" step="0.01" value="${r.factor}"></div>`).join('');const sec=$('#fridgeConfigSection');if(sec)sec.classList.toggle('hidden',currentSessionUser?.role!=='JEFE');}
function previewFridge(){const defId=$('#fridgeChartId')?.value;if(!defId)return;getOne('controlChartDefs',defId).then(def=>{const cfg=fridgeConfig(def),c=fridgeCalc($('#fridgeTempRaw').value,cfg),box=$('#fridgePreview');if(!box)return;if(!Number.isFinite(c.raw)){box.innerHTML='';return;}if(!c.valid){box.innerHTML='<div class="alert warn"><b>Sin factor de corrección aplicable.</b> La lectura está fuera de la tabla metrológica vigente y no puede guardarse.</div>';return;}box.innerHTML=`<div class="cc-detail-grid"><div><small>Lectura</small><b>${c.raw.toFixed(2)} °C</b></div><div><small>Factor</small><b>${c.factor>=0?'+':''}${c.factor.toFixed(2)} °C</b><span>rango ${c.range.min}–${c.range.max} °C</span></div><div><small>Temperatura corregida</small><b>${c.corrected.toFixed(2)} °C</b></div><div><small>Resultado</small><b>${c.ok?'CUMPLE':'NO CUMPLE'}</b><span>criterio ${cfg.criterion.min}–${cfg.criterion.max} °C</span></div></div>`;});}
async function saveFridgeConfig(){if(currentSessionUser?.role!=='JEFE')return toast('Solo JEFE/Calidad puede cambiar la configuración metrológica');const id=$('#fridgeChartId').value,def=await getOne('controlChartDefs',id);if(!def)return;const x=fridgeIdentity(def),mins=$$('[data-fridge-min]'),maxs=$$('[data-fridge-max]'),factors=$$('[data-fridge-factor]'),ranges=mins.map((el,i)=>({min:Number(el.value),max:Number(maxs[i].value),factor:Number(factors[i].value)}));if(ranges.some(r=>![r.min,r.max,r.factor].every(Number.isFinite)||r.max<=r.min))return toast('Revise los rangos y factores');ranges.sort((a,b)=>a.min-b.min);const cmin=Number($('#fridgeCriterionMin').value),cmax=Number($('#fridgeCriterionMax').value);if(!Number.isFinite(cmin)||!Number.isFinite(cmax)||cmax<=cmin)return toast('Revise el criterio técnico');const old=fridgeConfig(def);def.metrologyConfig={equipment:x.equipment,criterion:{min:cmin,max:cmax},correctionRanges:ranges,effectiveFrom:$('#fridgeEffectiveFrom').value||dateToday(),certificateRef:$('#fridgeCertificateRef').value.trim(),version:Number(old.version||1)+1};def.updatedAt=nowISO();await put('controlChartDefs',def);await queue('UPDATE','controlChartDefs',def);await audit('CONFIGURAR','CARTA_CONTROL_NEVERA',def.id,`Configuración ${x.equipment} v${def.metrologyConfig.version}`);updateFridgeDialogIdentity(def);renderFridgeConfig(def);previewFridge();toast(`Configuración metrológica ${x.equipment} guardada`);}
async function saveFridgeControl(e){e.preventDefault();const chartId=$('#fridgeChartId').value,analystId=$('#fridgeAnalystId').value,def=await getOne('controlChartDefs',chartId),x=fridgeIdentity(def),cfg=fridgeConfig(def),c=fridgeCalc($('#fridgeTempRaw').value,cfg);if(!c.valid)return toast('Lectura fuera de la tabla de corrección vigente. No se puede guardar sin factor aplicable.');const date=$('#fridgeInputDate').value,time=$('#fridgeTime').value,all=await getAll('controlChartRecords');if(all.find(r=>r.chartId===chartId&&String(r.measuredAt||'').slice(0,10)===date))return toast(`${x.label} ya fue completada hoy.`);const analysts=await getAll('analysts'),a=analysts.find(z=>z.id===analystId),existing=await fridgeRecords(chartId),vals=[...existing.map(r=>Number(r.tempCorrected)),c.corrected],w=dbo5Westgard(vals),stat=existing.length+1<10?'ESTABLECIMIENTO':w.state;const rec={id:uid('CCR'),chartId,controlType:x.controlType,section:def?.section||'MICROBIOLOGIA',methodName:def?.methodName||x.label,equipment:x.equipment,analystId,analystName:a?.name||firebaseBridge?.authUser?.email||'Usuario',measuredAt:`${date}T${time}:00`,tempRaw:c.raw,tempFactor:c.factor,tempCorrected:c.corrected,tempCriterion:{...cfg.criterion},correctionRangeSnapshot:{...c.range},metrologyConfigSnapshot:JSON.parse(JSON.stringify(cfg)),overallResult:c.ok?'CUMPLE':'NO CUMPLE',statisticalState:stat,statisticalRules:w.rules||[],notes:$('#fridgeNotes').value.trim(),schemaVersion:1,createdAt:nowISO(),updatedAt:nowISO()};await put('controlChartRecords',rec);await queue('CREATE','controlChartRecords',rec);await createControlChartCompletionAlert(rec,def);await audit('REGISTRAR','CARTA_CONTROL_NEVERA',rec.id,`${x.equipment} · ${rec.overallResult} · ${c.raw.toFixed(2)} → ${c.corrected.toFixed(2)} °C`);toast(`Control ${x.label} guardado y enviado a Firebase`);$('#fridgeTempRaw').value='';$('#fridgeNotes').value='';$('#fridgePreview').innerHTML='';await renderFridge(chartId);}
async function renderFridge(chartId){const def=await getOne('controlChartDefs',chartId),x=fridgeIdentity(def),rows=await fridgeRecords(chartId),body=$('#fridgeHistoryBody');if(!body)return;const vals=rows.map(r=>Number(r.tempCorrected)),w=dbo5Westgard(vals);$('#fridgeHistoryCount').textContent=`${rows.length} registros`;$('#fridgeStats').innerHTML=rows.length<10?`<div><small>Estado estadístico</small><b>FASE DE ESTABLECIMIENTO</b></div><div><small>Datos requeridos</small><b>${rows.length}/10</b></div><div><small>Temperatura</small><b>—</b></div>`:`<div><small>Temperatura media ± s</small><b>${mean(vals).toFixed(2)} ± ${sd(vals).toFixed(2)} °C</b></div><div><small>Estado</small><b>${w.state}</b></div><div><small>Reglas</small><b>${(w.rules||[]).join(', ')||'Sin alarmas'}</b></div>`;body.innerHTML=rows.slice().reverse().map(r=>`<tr><td>${escapeHtml(String(r.measuredAt||'').replace('T',' ').slice(0,16))}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${Number(r.tempRaw).toFixed(2)}</td><td>${Number(r.tempFactor)>=0?'+':''}${Number(r.tempFactor).toFixed(2)}</td><td>${Number(r.tempCorrected).toFixed(2)}</td><td>${Number(r.tempCriterion?.min??x.criterion.min).toFixed(1)}–${Number(r.tempCriterion?.max??x.criterion.max).toFixed(1)}</td><td><span class="badge">${r.overallResult}</span></td><td>${escapeHtml(r.statisticalState||'ESTABLECIMIENTO')}</td></tr>`).join('')||'<tr><td colspan="8">Sin registros todavía.</td></tr>';const ai=$('#fridgeAi');if(!rows.length)ai.innerHTML=`<b>IA:</b> Aún no existen registros de ${x.label}. El primer control iniciará la trazabilidad.`;else{const last=rows.at(-1);ai.innerHTML=`<b>IA · Diagnóstico:</b> Último control <b>${last.overallResult}</b>: ${Number(last.tempRaw).toFixed(2)} °C ${Number(last.tempFactor)>=0?'+':''}${Number(last.tempFactor).toFixed(2)} = <b>${Number(last.tempCorrected).toFixed(2)} °C</b>. ${rows.length<10?`Fase de establecimiento ${rows.length}/10.`:`Estado estadístico: <b>${w.state}</b>.`} Se vigilan tendencia y reglas Westgard/Shewhart; Calidad conserva la decisión final.`;}}
async function renderFridgeManagement(def,month){const x=fridgeIdentity(def),cfg=fridgeConfig(def),all=await fridgeRecords(def.id),rows=all.filter(r=>String(r.measuredAt||'').startsWith(month));$('#ccChart3Card').classList.add('hidden');$('#ccChart1Title').textContent=`${x.label} · Temperatura corregida`;$('#ccChart1Desc').textContent=`Media, ±1s, ±2s, ±3s y criterio técnico histórico ${cfg.criterion.min}–${cfg.criterion.max} °C.`;$('#ccChart2Title').textContent='Configuración metrológica';$('#ccChart2Desc').textContent='Factores vigentes y trazabilidad de calibración.';if(!rows.length){showControlChartNoData(x.label,month);return;}const vals=rows.map(r=>Number(r.tempCorrected)),w=dbo5Westgard(vals),ok=rows.filter(r=>r.overallResult==='CUMPLE').length;$('#ccKpis').innerHTML=`<div><small>Controles</small><b>${rows.length}</b><span>${month}</span></div><div><small>Cumplimiento</small><b>${(100*ok/rows.length).toFixed(1)}%</b><span>${ok}/${rows.length} cumplen</span></div><div><small>Temperatura media ± s</small><b>${mean(vals).toFixed(2)} ± ${sd(vals).toFixed(2)} °C</b><span>mín ${Math.min(...vals).toFixed(2)} · máx ${Math.max(...vals).toFixed(2)}</span></div><div><small>Equipo</small><b>${x.equipment}</b><span>criterio ${cfg.criterion.min}–${cfg.criterion.max} °C</span></div>`;$('#ccTempState').textContent=rows.length<10?'ESTABLECIMIENTO':w.state;$('#ccTempChart').innerHTML=ccSvgLine(rows,'tempCorrected','°C',cfg.criterion.min,cfg.criterion.max);$('#ccHumState').textContent='METROLOGÍA';$('#ccHumChart').innerHTML=`<div class="cc-config-summary"><b>Tabla de corrección utilizada</b><p>${cfg.correctionRanges.map(r=>`${r.min}–${r.max} °C → ${Number(r.factor)>=0?'+':''}${Number(r.factor).toFixed(2)} °C`).join(' · ')}</p><small>Cada registro conserva la configuración histórica utilizada.</small></div>`;$('#ccAi').innerHTML=`<b>Diagnóstico mensual ${x.label}:</b> ${ok}/${rows.length} controles cumplen ${cfg.criterion.min}–${cfg.criterion.max} °C. ${rows.length<10?'La serie permanece en FASE DE ESTABLECIMIENTO hasta completar 10 registros.':`Estado estadístico: <b>${w.state}</b>.`} ${(w.rules||[]).length?'Existen señales que requieren revisión de causa asignable y acción documentada.':'No se observan señales estadísticas de alarma.'} La IA es asistiva y no modifica criterios.`;$('#ccRules').innerHTML=(w.rules||[]).length?`<div class="alert warn"><b>Señales Westgard/Shewhart:</b> ${escapeHtml(w.rules.join(' · '))}</div>`:'<div class="alert success">No se detectan reglas de alarma en la serie.</div>';$('#ccHistoryHead').innerHTML='<tr><th>Fecha/hora</th><th>Responsable</th><th>T leída</th><th>Factor</th><th>T corregida</th><th>Resultado</th><th>Estadístico</th></tr>';$('#ccHistoryBody').innerHTML=rows.slice().reverse().map(r=>`<tr><td>${ccFmtDate(r.measuredAt)}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${Number(r.tempRaw).toFixed(2)}</td><td>${Number(r.tempFactor)>=0?'+':''}${Number(r.tempFactor).toFixed(2)}</td><td>${Number(r.tempCorrected).toFixed(2)}</td><td>${r.overallResult}</td><td>${escapeHtml(r.statisticalState||'ESTABLECIMIENTO')}</td></tr>`).join('');$('#ccCount').textContent=`${rows.length} registros · ${month}`;}

function isIncubatorChart(d){if(!d||isMicrobiologyIncubatorChart(d))return false;const n=normalizeIdentityText(d.name||''),m=normalizeIdentityText(d.methodName||''),k=normalizeIdentityText(d.controlKey||d.equipmentKey||'');return hasEquipmentIdentity(d.name,'EI-306')||hasEquipmentIdentity(d.methodName,'EI-306')||hasEquipmentIdentity(d.controlKey||d.equipmentKey,'EI-306')||k.includes('ei 306')||((n.includes('incubadora')||m.includes('incubadora'))&&!n.includes('microbiologia')&&!m.includes('microbiologia'));}
function isDBO5Chart(d){return !!d && !isIncubatorChart(d) && (normalizeIdentityText(d.methodName||'').includes('dbo5')||normalizeIdentityText(d.name||'').includes('dbo5'));}
function isPHChart(d){if(!d)return false;const n=normalizeIdentityText(d.name||''),m=normalizeIdentityText(d.methodName||'');return n.includes('control de ph')||n.includes('carta de control de ph')||m==='ph'||m.includes('phmetro')||m.includes('ph metro');}
function isConductivityChart(d){if(!d)return false;const n=normalizeIdentityText(d.name||''),m=normalizeIdentityText(d.methodName||'');return n.includes('conductividad')||m.includes('conductividad')||m.includes('conductimetr');}
function conductivityRecords(chartId){return getAll('controlChartRecords').then(rows=>rows.filter(r=>r.chartId===chartId&&r.controlType==='CONDUCTIVIDAD_MULTIPUNTO').sort((a,b)=>String(a.measuredAt).localeCompare(String(b.measuredAt))));}
function conductivityPoint(reading,nominal,unit){const r=Number(reading),n=Number(nominal),error=r-n,absError=Math.abs(error),errorPct=n?absError/n*100:0,limitPct=5,low=n*.95,high=n*1.05;return {nominal:n,reading:r,error,absError,errorPct,limitPct,low,high,unit,ok:errorPct<=limitPct};}
async function openConductivityControl(def,date,analystId){const dlg=$('#conductivityControlDialog');if(!dlg)return toast('Formato Conductividad no disponible');$('#condChartId').value=def.id;$('#condAnalystId').value=analystId||'';$('#condInputDate').value=date||dateToday();$('#condTime').value=new Date().toTimeString().slice(0,5);['84','1413','1288'].forEach(x=>{$('#condRead'+x).value=''});$('#condNotes').value='';$('#condPreview').innerHTML='';await renderConductivity(def.id);if(typeof dlg.showModal==='function')dlg.showModal();else dlg.setAttribute('open','');}
function previewConductivity(){const cfg=[['84',84,'µS/cm'],['1413',1413,'µS/cm'],['1288',12.88,'mS/cm']],box=$('#condPreview');if(!box)return;const pts=cfg.map(([id,n,u])=>{const el=$('#condRead'+id),v=Number(el?.value);return el?.value!==''&&Number.isFinite(v)?conductivityPoint(v,n,u):null});if(pts.every(x=>!x)){box.innerHTML='';return}box.innerHTML=pts.map((x,i)=>x?`<div class="dbo5-result ${x.ok?'ok':'bad'}"><b>${[84,1413,12.88][i]} ${x.unit}: ${x.reading.toFixed(i===2?3:1)} ${x.unit}</b><br>Error ${x.errorPct.toFixed(2)}% · límite ±5% (${x.low.toFixed(i===2?3:2)}–${x.high.toFixed(i===2?3:2)} ${x.unit}) · ${x.ok?'CUMPLE':'NO CUMPLE'}</div>`:`<div class="dbo5-result"><b>${[84,1413,12.88][i]} ${cfg[i][2]}</b><br>Pendiente de lectura</div>`).join('');}
async function saveConductivityControl(e){e.preventDefault();const chartId=$('#condChartId').value,analystId=$('#condAnalystId').value,date=$('#condInputDate').value,time=$('#condTime').value,c84=conductivityPoint($('#condRead84').value,84,'µS/cm'),c1413=conductivityPoint($('#condRead1413').value,1413,'µS/cm'),c1288=conductivityPoint($('#condRead1288').value,12.88,'mS/cm');if([c84,c1413,c1288].some(p=>!Number.isFinite(p.reading)))return toast('Complete las tres lecturas de Conductividad');const analysts=await getAll('analysts'),a=analysts.find(x=>x.id===analystId),existing=await conductivityRecords(chartId),series={c84:[...existing.map(r=>Number(r.c84?.reading)),c84.reading],c1413:[...existing.map(r=>Number(r.c1413?.reading)),c1413.reading],c1288:[...existing.map(r=>Number(r.c1288?.reading)),c1288.reading]},w={c84:dbo5Westgard(series.c84),c1413:dbo5Westgard(series.c1413),c1288:dbo5Westgard(series.c1288)};const global=c84.ok&&c1413.ok&&c1288.ok?'CUMPLE':'NO CUMPLE',stat=existing.length+1<10?'ESTABLECIMIENTO':Object.values(w).some(x=>x.state==='FUERA DE CONTROL')?'FUERA DE CONTROL':Object.values(w).some(x=>x.state==='ADVERTENCIA')?'ADVERTENCIA':'EN CONTROL',rules=Object.entries(w).flatMap(([k,v])=>(v.rules||[]).map(x=>`${k}:${x}`));const rec={id:uid('CCR'),chartId,controlType:'CONDUCTIVIDAD_MULTIPUNTO',section:'RECEPCION_MUESTRAS',methodName:'Conductividad',equipment:'EI-104',analystId,analystName:a?.name||firebaseBridge?.authUser?.email||'Usuario',measuredAt:`${date}T${time}:00`,c84,c1413,c1288,criterion:{type:'RELATIVE_ERROR_PERCENT',limitPct:5,source:'Criterio técnico interno establecido para carta de control',levels:[{nominal:84,unit:'µS/cm',low:79.80,high:88.20},{nominal:1413,unit:'µS/cm',low:1342.35,high:1483.65},{nominal:12.88,unit:'mS/cm',low:12.236,high:13.524}]},overallResult:global,statisticalState:stat,statisticalRules:rules,notes:$('#condNotes').value.trim(),schemaVersion:1,createdAt:nowISO(),updatedAt:nowISO()};const sameDay=(await getAll('controlChartRecords')).find(x=>x.chartId===rec.chartId&&String(x.measuredAt||'').slice(0,10)===String(rec.measuredAt||'').slice(0,10));if(sameDay)return toast('Esta carta de control ya fue completada hoy. No se generará un duplicado.');await put('controlChartRecords',rec);await queue('CREATE','controlChartRecords',rec);const chartDef=await getOne('controlChartDefs',rec.chartId);await createControlChartCompletionAlert(rec,chartDef);await audit('REGISTRAR','CARTA_CONTROL_CONDUCTIVIDAD',rec.id,`${global} · 84=${c84.reading} · 1413=${c1413.reading} · 12.88=${c1288.reading}`);toast('Control de Conductividad guardado y enviado a Firebase');['84','1413','1288'].forEach(x=>{$('#condRead'+x).value=''});$('#condNotes').value='';$('#condPreview').innerHTML='';await renderConductivity(chartId);}
async function renderConductivity(chartId){const rows=await conductivityRecords(chartId),body=$('#condHistoryBody');if(!body)return;$('#condHistoryCount').textContent=`${rows.length} registros`;const keys=[['c84','84 µS/cm'],['c1413','1413 µS/cm'],['c1288','12.88 mS/cm']],stats=$('#condStats');stats.innerHTML=keys.map(([k,label])=>{const vals=rows.map(r=>Number(r[k]?.reading)).filter(Number.isFinite),w=dbo5Westgard(vals);return `<div><small>${label} media ± s</small><b>${vals.length?mean(vals).toFixed(k==='c1288'?3:2)+' ± '+sd(vals).toFixed(k==='c1288'?3:2):'—'}</b><span>${rows.length<10?'FASE DE ESTABLECIMIENTO':w.state}</span></div>`}).join('');body.innerHTML=rows.slice().reverse().map(r=>`<tr><td>${escapeHtml(String(r.measuredAt||'').replace('T',' ').slice(0,16))}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${r.c84.reading.toFixed(1)}</td><td>${r.c84.errorPct.toFixed(2)}%</td><td>${r.c1413.reading.toFixed(1)}</td><td>${r.c1413.errorPct.toFixed(2)}%</td><td>${r.c1288.reading.toFixed(3)}</td><td>${r.c1288.errorPct.toFixed(2)}%</td><td><span class="badge">${r.overallResult}</span></td><td>${escapeHtml(r.statisticalState||'ESTABLECIMIENTO')}</td></tr>`).join('')||'<tr><td colspan="10">Sin registros todavía.</td></tr>';const ai=$('#condAi');if(!rows.length)ai.innerHTML='<b>IA:</b> Aún no existen registros de Conductividad. El primer control iniciará la trazabilidad multipunto.';else{const last=rows.at(-1),bad=[['84 µS/cm',last.c84],['1413 µS/cm',last.c1413],['12.88 mS/cm',last.c1288]].filter(x=>!x[1].ok).map(x=>x[0]);ai.innerHTML=`<b>IA · Diagnóstico:</b> El último control multipunto <b>${last.overallResult}</b>. ${bad.length?'Fuera del límite ±5% en '+bad.join(', ')+'.':'Los tres niveles cumplen el límite técnico ±5%.'} ${rows.length<10?`Hay ${rows.length} de 10 registros mínimos; cada nivel permanece en fase de establecimiento.`:`Estado estadístico global: <b>${last.statisticalState}</b>.`} La IA no modifica los límites establecidos.`;}}
function isMicrobiologyPHChart(d){if(!d)return false;const n=normalizeIdentityText(d.name||''),m=normalizeIdentityText(d.methodName||''),sec=normalizeIdentityText([d.section,d.sectionName,d.area,d.areaName,(d.sections||[]).join(' ')].filter(Boolean).join(' '));const phIdentity=n.includes('phmetro')||n.includes('ph metro')||n.includes('control de ph')||m==='ph'||m.includes('phmetro')||m.includes('ph metro');return phIdentity&&(n.includes('microbiologia')||m.includes('microbiologia')||sec.includes('microbiologia'));}
function phEquipment(def){return isMicrobiologyPHChart(def)?'EI-188':'EI-345';}
function phAreaLabel(def){return isMicrobiologyPHChart(def)?'Microbiología':'Recepción de Muestras';}
function phRecords(chartId){return getAll('controlChartRecords').then(rows=>rows.filter(r=>r.chartId===chartId&&r.controlType==='PH_MULTIPUNTO').sort((a,b)=>String(a.measuredAt).localeCompare(String(b.measuredAt))));}
function phPoint(reading,nominal){const r=Number(reading),n=Number(nominal),error=Math.abs(r-n);return {nominal:n,reading:r,error,ok:error<=0.10};}
async function openPHControl(def,date,analystId){const dlg=$('#phControlDialog');if(!dlg)return toast('Formato pH no disponible');const eq=phEquipment(def),area=phAreaLabel(def);dlg.dataset.equipment=eq;dlg.dataset.area=area;const eyebrow=dlg.querySelector('.dialog-head .eyebrow'),title=dlg.querySelector('.dialog-head h3'),desc=dlg.querySelector('.dialog-head p'),kpi=dlg.querySelector('.dbo5-kpis div:first-child b'),submit=dlg.querySelector('button[type=submit]');if(eyebrow)eyebrow.textContent=`CARTA DE CONTROL · pH · ${eq}`;if(title)title.textContent=`Control multipunto · ${area}`;if(desc)desc.textContent=`pHmetro ${eq} · verificación en pH 4.00, 7.00 y 10.00 con criterio ±0.10 pH.`;if(kpi)kpi.textContent=`pHmetro ${eq}`;if(submit)submit.textContent=`Guardar control pH · ${eq}`;$('#phChartId').value=def.id;$('#phAnalystId').value=analystId||'';$('#phInputDate').value=date||dateToday();$('#phTime').value=new Date().toTimeString().slice(0,5);['4','7','10'].forEach(x=>{$('#phRead'+x).value=''});$('#phNotes').value='';$('#phPreview').innerHTML='';await renderPH(def.id);if(typeof dlg.showModal==='function')dlg.showModal();else dlg.setAttribute('open','');}
function previewPH(){const vals=[['4',4],['7',7],['10',10]],box=$('#phPreview');if(!box)return;const pts=vals.map(([id,n])=>{const el=$('#phRead'+id),v=Number(el?.value);return el?.value!==''&&Number.isFinite(v)?phPoint(v,n):null});if(pts.every(x=>!x)){box.innerHTML='';return}box.innerHTML=pts.map((x,i)=>x?`<div class="dbo5-result ${x.ok?'ok':'bad'}"><b>pH ${[4,7,10][i].toFixed(2)}: ${x.reading.toFixed(2)}</b><br>Error absoluto ${x.error.toFixed(2)} pH · criterio ±0.10 · ${x.ok?'CUMPLE':'NO CUMPLE'}</div>`:`<div class="dbo5-result"><b>pH ${[4,7,10][i].toFixed(2)}</b><br>Pendiente de lectura</div>`).join('');}
async function savePHControl(e){e.preventDefault();const chartId=$('#phChartId').value,analystId=$('#phAnalystId').value,date=$('#phInputDate').value,time=$('#phTime').value;const p4=phPoint($('#phRead4').value,4),p7=phPoint($('#phRead7').value,7),p10=phPoint($('#phRead10').value,10);if([p4,p7,p10].some(p=>!Number.isFinite(p.reading)))return toast('Complete las tres lecturas de pH');const analysts=await getAll('analysts'),a=analysts.find(x=>x.id===analystId),existing=await phRecords(chartId);const series={4:[...existing.map(r=>Number(r.p4?.reading)),p4.reading],7:[...existing.map(r=>Number(r.p7?.reading)),p7.reading],10:[...existing.map(r=>Number(r.p10?.reading)),p10.reading]};const w={4:dbo5Westgard(series[4]),7:dbo5Westgard(series[7]),10:dbo5Westgard(series[10])};const global=p4.ok&&p7.ok&&p10.ok?'CUMPLE':'NO CUMPLE',stat=existing.length+1<10?'ESTABLECIMIENTO':Object.values(w).some(x=>x.state==='FUERA DE CONTROL')?'FUERA DE CONTROL':Object.values(w).some(x=>x.state==='ADVERTENCIA')?'ADVERTENCIA':'EN CONTROL';const rules=Object.entries(w).flatMap(([k,v])=>(v.rules||[]).map(x=>`pH${k}:${x}`));const def=await getOne('controlChartDefs',chartId),equipment=phEquipment(def),areaLabel=phAreaLabel(def);const rec={id:uid('CCR'),chartId,controlType:'PH_MULTIPUNTO',section:isMicrobiologyPHChart(def)?'MICROBIOLOGIA':'RECEPCION_MUESTRAS',methodName:'pH',equipment,area:areaLabel,analystId,analystName:a?.name||firebaseBridge?.authUser?.email||'Usuario',measuredAt:`${date}T${time}:00`,p4,p7,p10,criterion:{type:'ABS_ERROR',limit:0.10,unit:'pH'},overallResult:global,statisticalState:stat,statisticalRules:rules,notes:$('#phNotes').value.trim(),schemaVersion:1,createdAt:nowISO(),updatedAt:nowISO()};const sameDay=(await getAll('controlChartRecords')).find(x=>x.chartId===rec.chartId&&String(x.measuredAt||'').slice(0,10)===String(rec.measuredAt||'').slice(0,10));if(sameDay)return toast('Esta carta de control ya fue completada hoy. No se generará un duplicado.');await put('controlChartRecords',rec);await queue('CREATE','controlChartRecords',rec);const chartDef=await getOne('controlChartDefs',rec.chartId);await createControlChartCompletionAlert(rec,chartDef);await audit('REGISTRAR','CARTA_CONTROL_PH',rec.id,`${global} · 4=${p4.reading.toFixed(2)} · 7=${p7.reading.toFixed(2)} · 10=${p10.reading.toFixed(2)}`);toast('Control pH guardado y enviado a Firebase');['4','7','10'].forEach(x=>{$('#phRead'+x).value=''});$('#phNotes').value='';$('#phPreview').innerHTML='';await renderPH(chartId);}
async function renderPH(chartId){const rows=await phRecords(chartId),body=$('#phHistoryBody');if(!body)return;$('#phHistoryCount').textContent=`${rows.length} registros`;const keys=[['p4','pH 4.00'],['p7','pH 7.00'],['p10','pH 10.00']],stats=$('#phStats');stats.innerHTML=keys.map(([k,label])=>{const vals=rows.map(r=>Number(r[k]?.reading)).filter(Number.isFinite),w=dbo5Westgard(vals);return `<div><small>${label} media ± s</small><b>${vals.length?mean(vals).toFixed(3)+' ± '+sd(vals).toFixed(3):'—'}</b><span>${rows.length<10?'FASE DE ESTABLECIMIENTO':w.state}</span></div>`}).join('');body.innerHTML=rows.slice().reverse().map(r=>`<tr><td>${escapeHtml(String(r.measuredAt||'').replace('T',' ').slice(0,16))}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${r.p4.reading.toFixed(2)}</td><td>${r.p4.error.toFixed(2)}</td><td>${r.p7.reading.toFixed(2)}</td><td>${r.p7.error.toFixed(2)}</td><td>${r.p10.reading.toFixed(2)}</td><td>${r.p10.error.toFixed(2)}</td><td><span class="badge">${r.overallResult}</span></td><td>${escapeHtml(r.statisticalState||'ESTABLECIMIENTO')}</td></tr>`).join('')||'<tr><td colspan="10">Sin registros todavía.</td></tr>';const ai=$('#phAi');if(!rows.length)ai.innerHTML='<b>IA:</b> Aún no existen registros de pH. El primer control iniciará la trazabilidad multipunto.';else{const last=rows.at(-1),bad=[['4.00',last.p4],['7.00',last.p7],['10.00',last.p10]].filter(x=>!x[1].ok).map(x=>x[0]);ai.innerHTML=`<b>IA · Diagnóstico:</b> El último control multipunto <b>${last.overallResult}</b>. ${bad.length?'Fuera de criterio en pH '+bad.join(', ')+'.':'Los tres niveles cumplen ±0.10 pH.'} ${rows.length<10?`Hay ${rows.length} de 10 registros mínimos; cada nivel permanece en fase de establecimiento.`:`Estado estadístico global: <b>${last.statisticalState}</b>.`} La IA no modifica el criterio de aceptación.`;}}
function dbo5TempFactor(v){if(v>=16&&v<18)return .21;if(v>=18&&v<21)return .13;if(v>=21&&v<=24)return .11;return null;}
function dbo5HumFactor(v){if(v>=20&&v<65)return 8.1;if(v>=65&&v<=90)return 7.1;return null;}
function mean(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:0} function sd(a){if(a.length<2)return 0;const m=mean(a);return Math.sqrt(a.reduce((q,x)=>q+(x-m)**2,0)/(a.length-1));}
function dbo5Westgard(vals){if(vals.length<10)return {state:'ESTABLECIMIENTO',rules:[]};const base=vals.slice(0,-1).length>=10?vals.slice(0,-1):vals, m=mean(base),s=sd(base);if(!s)return {state:'SIN VARIACIÓN',rules:[]};const z=vals.map(x=>(x-m)/s),r=[];const last=z.at(-1);if(Math.abs(last)>=3)r.push('1_3s');else if(Math.abs(last)>=2)r.push('1_2s');if(z.length>=2&&Math.abs(z.at(-1))>=2&&Math.abs(z.at(-2))>=2&&Math.sign(z.at(-1))===Math.sign(z.at(-2)))r.push('2_2s');if(z.length>=2&&Math.abs(z.at(-1)-z.at(-2))>=4)r.push('R_4s');if(z.length>=7){const q=z.slice(-7);if(q.every(x=>x>0)||q.every(x=>x<0))r.push('7x');const raw=vals.slice(-7);if(raw.every((x,i)=>!i||x>raw[i-1])||raw.every((x,i)=>!i||x<raw[i-1]))r.push('7T');}return {state:r.some(x=>x!=='1_2s')?'FUERA DE CONTROL':r.length?'ADVERTENCIA':'EN CONTROL',rules:r,m,s};}
function dbo5Calc(t,h){const tf=dbo5TempFactor(t),hf=dbo5HumFactor(h);if(tf===null||hf===null)return {valid:false,tf,hf};const tc=t+tf,hc=h+hf;return {valid:true,tf,hf,tc,hc,tempOk:tc>=17&&tc<=23,humOk:hc>=20&&hc<=80};}
async function dbo5Records(chartId){return (await getAll('controlChartRecords')).filter(r=>r.chartId===chartId&&r.controlType==='DBO5_AMBIENTAL').sort((a,b)=>String(a.measuredAt).localeCompare(String(b.measuredAt)));}
async function openDBO5Control(def,date,analystId){const dlg=$('#dbo5ControlDialog');if(!dlg)return toast('Formato DBO5 no disponible');$('#dbo5ChartId').value=def.id;$('#dbo5AnalystId').value=analystId||'';$('#dbo5Date').value=date||dateToday();$('#dbo5InputDate').value=date||dateToday();$('#dbo5Time').value=new Date().toTimeString().slice(0,5);$('#dbo5TempRaw').value='';$('#dbo5HumRaw').value='';$('#dbo5Notes').value='';await renderDBO5(def.id);if(typeof dlg.showModal==='function')dlg.showModal();else dlg.setAttribute('open','');}
async function renderDBO5(chartId){const rows=await dbo5Records(chartId),body=$('#dbo5HistoryBody');if(!body)return;const tv=rows.map(r=>Number(r.tempCorrected)),hv=rows.map(r=>Number(r.humCorrected)),tw=dbo5Westgard(tv),hw=dbo5Westgard(hv);$('#dbo5HistoryCount').textContent=`${rows.length} registros`;const stats=$('#dbo5Stats');if(rows.length<10)stats.innerHTML=`<div><small>Estado estadístico</small><b>FASE DE ESTABLECIMIENTO</b></div><div><small>Datos requeridos</small><b>${rows.length}/10</b></div><div><small>Temperatura</small><b>—</b></div><div><small>Humedad</small><b>—</b></div>`;else stats.innerHTML=`<div><small>Temperatura media ± s</small><b>${mean(tv).toFixed(2)} ± ${sd(tv).toFixed(2)} °C</b></div><div><small>Estado T</small><b>${tw.state}</b></div><div><small>Humedad media ± s</small><b>${mean(hv).toFixed(2)} ± ${sd(hv).toFixed(2)} %</b></div><div><small>Estado HR</small><b>${hw.state}</b></div>`;body.innerHTML=rows.slice().reverse().map(r=>`<tr><td>${escapeHtml(r.measuredAt?.replace('T',' ').slice(0,16)||'')}</td><td>${escapeHtml(r.analystName||r.analystId||'—')}</td><td>${Number(r.tempRaw).toFixed(2)}</td><td>+${Number(r.tempFactor).toFixed(2)}</td><td>${Number(r.tempCorrected).toFixed(2)}</td><td>${Number(r.humRaw).toFixed(2)}</td><td>+${Number(r.humFactor).toFixed(1)}</td><td>${Number(r.humCorrected).toFixed(1)}</td><td><span class="badge">${r.environmentalResult}</span></td><td>${escapeHtml(r.statisticalState||'ESTABLECIMIENTO')}</td></tr>`).join('')||'<tr><td colspan="10">Sin registros todavía.</td></tr>';const ai=$('#dbo5Ai');if(!rows.length)ai.innerHTML='<b>IA:</b> Aún no existen registros. El primer control establecerá la trazabilidad ambiental.';else{const last=rows.at(-1),alerts=[...(tw.rules||[]).map(x=>'T '+x),...(hw.rules||[]).map(x=>'HR '+x)];ai.innerHTML=`<b>IA · Diagnóstico:</b> El último control ambiental <b>${last.environmentalResult}</b>. ${rows.length<10?`Hay ${rows.length} de 10 registros mínimos; la carta permanece en fase de establecimiento y no se declara control estadístico.`:`Temperatura: ${tw.state}. Humedad: ${hw.state}.${alerts.length?' Reglas detectadas: '+alerts.join(', ')+'.':' No se detectan reglas de alarma.'}`} La IA no modifica los criterios de aceptación.`;}}
function previewDBO5(){const t=Number($('#dbo5TempRaw')?.value),h=Number($('#dbo5HumRaw')?.value),box=$('#dbo5Preview');if(!box||!Number.isFinite(t)||!Number.isFinite(h))return;const c=dbo5Calc(t,h);if(!c.valid){box.innerHTML=`<div class="dbo5-result bad"><b>Lectura fuera de tabla de corrección</b><br>No se inventará un factor. Temperatura válida para corrección: 16–24 °C; HR: 20–90 %.</div>`;return;}box.innerHTML=`<div class="dbo5-result ${c.tempOk?'ok':'bad'}"><b>Temperatura corregida: ${c.tc.toFixed(2)} °C</b><br>${t.toFixed(2)} + ${c.tf.toFixed(2)} · criterio 17–23 °C · ${c.tempOk?'CUMPLE':'NO CUMPLE'}</div><div class="dbo5-result ${c.humOk?'ok':'bad'}"><b>Humedad corregida: ${c.hc.toFixed(1)} %HR</b><br>${h.toFixed(1)} + ${c.hf.toFixed(1)} · criterio 20–80 % · ${c.humOk?'CUMPLE':'NO CUMPLE'}</div>`;}
async function saveDBO5Control(e){e.preventDefault();const chartId=$('#dbo5ChartId').value,analystId=$('#dbo5AnalystId').value,t=Number($('#dbo5TempRaw').value),h=Number($('#dbo5HumRaw').value),c=dbo5Calc(t,h);if(!c.valid)return toast('Lectura fuera de los rangos configurados de corrección');const analysts=await getAll('analysts'),a=analysts.find(x=>x.id===analystId),date=$('#dbo5InputDate').value,time=$('#dbo5Time').value,existing=await dbo5Records(chartId),tmpT=[...existing.map(r=>Number(r.tempCorrected)),c.tc],tmpH=[...existing.map(r=>Number(r.humCorrected)),c.hc],tw=dbo5Westgard(tmpT),hw=dbo5Westgard(tmpH),env=c.tempOk&&c.humOk?'CUMPLE':'NO CUMPLE',stat=existing.length+1<10?'ESTABLECIMIENTO':(tw.state==='FUERA DE CONTROL'||hw.state==='FUERA DE CONTROL'?'FUERA DE CONTROL':tw.state==='ADVERTENCIA'||hw.state==='ADVERTENCIA'?'ADVERTENCIA':'EN CONTROL');const rec={id:uid('CCR'),chartId,controlType:'DBO5_AMBIENTAL',section:'RECEPCION_MUESTRAS',methodName:'DBO5',area:'Instrumental',thermohygrometer:'EI-270',dataLogger:'PF-09',analystId,analystName:a?.name||firebaseBridge?.authUser?.email||'Usuario',measuredAt:`${date}T${time}:00`,tempRaw:t,tempFactor:c.tf,tempCorrected:c.tc,humRaw:h,humFactor:c.hf,humCorrected:c.hc,tempCriterion:{min:17,max:23},humCriterion:{min:20,max:80},environmentalResult:env,statisticalState:stat,statisticalRules:[...(tw.rules||[]).map(x=>'T:'+x),...(hw.rules||[]).map(x=>'HR:'+x)],notes:$('#dbo5Notes').value.trim(),schemaVersion:1,createdAt:nowISO(),updatedAt:nowISO()};const sameDay=(await getAll('controlChartRecords')).find(x=>x.chartId===rec.chartId&&String(x.measuredAt||'').slice(0,10)===String(rec.measuredAt||'').slice(0,10));if(sameDay)return toast('Esta carta de control ya fue completada hoy. No se generará un duplicado.');await put('controlChartRecords',rec);await queue('CREATE','controlChartRecords',rec);const chartDef=await getOne('controlChartDefs',rec.chartId);await createControlChartCompletionAlert(rec,chartDef);await audit('REGISTRAR','CARTA_CONTROL_DBO5',rec.id,`${env} · T ${c.tc.toFixed(2)} °C · HR ${c.hc.toFixed(1)} %`);toast('Control DBO5 guardado y enviado a Firebase');$('#dbo5TempRaw').value='';$('#dbo5HumRaw').value='';$('#dbo5Notes').value='';$('#dbo5Preview').innerHTML='';await renderDBO5(chartId);}


function ccMonthNow(){return new Date().toISOString().slice(0,7)}
function ccFmtDate(v){if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?String(v).slice(0,16):d.toLocaleString('es-EC',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
function ccRuleDetails(vals, labels){
  if(vals.length<10)return vals.map((v,i)=>({i,label:labels[i],rules:[]}));
  const out=[];
  for(let i=0;i<vals.length;i++){
    const prefix=vals.slice(0,i+1), w=dbo5Westgard(prefix);
    out.push({i,label:labels[i],rules:w.rules||[]});
  }
  return out;
}
function ccSvgLine(rows,key,unit,technicalMin,technicalMax){
  if(!rows.length)return '<div class="cc-no-data">Sin datos</div>';
  const vals=rows.map(r=>Number(r[key])).filter(Number.isFinite),m=mean(vals),s=sd(vals);
  const lines=[{v:m,t:'Media'},{v:m+s,t:'+1s'},{v:m-s,t:'−1s'},{v:m+2*s,t:'+2s'},{v:m-2*s,t:'−2s'},{v:m+3*s,t:'+3s'},{v:m-3*s,t:'−3s'},{v:technicalMin,t:'Límite mín.'},{v:technicalMax,t:'Límite máx.'}];
  // Escala inteligente: nunca imponer un padding absoluto grande. En cartas de alta precisión
  // (p.ej. 1 g ±0.001 g) el eje se concentra en el rango técnico/estadístico real.
  const finiteLines=lines.map(x=>x.v).filter(Number.isFinite), all=[...vals,...finiteLines],lo=Math.min(...all),hi=Math.max(...all);
  const techSpan=(Number.isFinite(technicalMin)&&Number.isFinite(technicalMax))?Math.abs(technicalMax-technicalMin):0;
  const dataSpan=Math.max(hi-lo,0), precisionFloor=Math.max(Math.abs(m)*1e-6,1e-9);
  const pad=Math.max(dataSpan*.10,techSpan*.12,Math.abs(s)*.35,precisionFloor),min=lo-pad,max=hi+pad;
  const W=900,H=330,L=54,R=18,T=18,B=50,px=i=>L+(W-L-R)*(rows.length===1?.5:i/(rows.length-1)),py=v=>T+(H-T-B)*(1-(v-min)/(max-min||1));
  const grid=[0,.25,.5,.75,1].map(q=>{const v=min+(max-min)*q,y=py(v);return `<line x1="${L}" y1="${y}" x2="${W-R}" y2="${y}" class="cc-gridline"/><text x="${L-8}" y="${y+4}" text-anchor="end" class="cc-axis">${v.toFixed((Math.abs(max-min)<0.02)?4:(Math.abs(max-min)<2?3:(unit==='°C'?1:0)))}</text>`}).join('');
  const ref=lines.map((x,i)=>`<line x1="${L}" y1="${py(x.v)}" x2="${W-R}" y2="${py(x.v)}" class="cc-ref cc-ref-${i<7?'stat':'tech'}"/><text x="${W-R-4}" y="${py(x.v)-3}" text-anchor="end" class="cc-ref-label">${x.t}</text>`).join('');
  const pts=rows.map((r,i)=>`${px(i)},${py(Number(r[key]))}`).join(' ');
  const circles=rows.map((r,i)=>`<circle cx="${px(i)}" cy="${py(Number(r[key]))}" r="5" class="cc-point"><title>${ccFmtDate(r.measuredAt)} · ${Number(r[key]).toFixed(2)} ${unit}</title></circle>`).join('');
  const labels=rows.map((r,i)=>i===0||i===rows.length-1||rows.length<=8?`<text x="${px(i)}" y="${H-22}" text-anchor="middle" class="cc-axis">${String(r.measuredAt||'').slice(8,10)}</text>`:'').join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tendencia ${unit}">${grid}${ref}<polyline points="${pts}" class="cc-series"/>${circles}${labels}<text x="${W/2}" y="${H-5}" text-anchor="middle" class="cc-axis">Día del mes</text></svg>`;
}
function resetControlChartManagementUI(){
  $('#ccEmpty').classList.add('hidden');$('#ccDashboard').classList.remove('hidden');$('#ccChart3Card').classList.add('hidden');
  $('#ccKpis').innerHTML='';$('#ccTempChart').innerHTML='';$('#ccHumChart').innerHTML='';$('#ccChart3').innerHTML='';$('#ccAi').innerHTML='';$('#ccRules').innerHTML='';$('#ccHistoryBody').innerHTML='';$('#ccPointDetail').classList.add('hidden');$('#ccPointDetail').innerHTML='';$('#ccTempState').textContent='—';$('#ccHumState').textContent='—';$('#ccChart3State').textContent='—';
}
function showControlChartNoData(name,month){
  $('#ccDashboard').classList.add('hidden');$('#ccEmpty').classList.remove('hidden');$('#ccEmpty').innerHTML=`<div class="empty-icon">📈</div><h4>${escapeHtml(name)} · Sin registros</h4><p>No existen controles para ${escapeHtml(month)}. No se muestran datos heredados de otra carta.</p>`;
}
function controlChartManagementAdapter(def){
  if(isMicrobiologyFreezerChart(def))return renderMicroFreezerManagement;if(isMicrobiologyIncubator364Chart(def))return renderIncMicroManagement;if(isMicrobiologyIncubatorChart(def))return renderMicroIncubatorManagement;if(isMicrobiologyEnvironmentChart(def))return renderMicroEnvManagement;if(isMicrobiologyPHChart(def))return renderPHManagement;if(isBalanceEnvironmentChart(def))return renderBalanceEnvManagement;if(isMetalsChart(def))return renderMetalsManagement;if(isOven314Chart(def))return renderOven314Management;if(isThermal105Chart(def)||isThermal150Chart(def)||isThermalDQOChart(def))return renderThermalPointManagement;if(isDigestorChart(def))return renderDigestorManagement;if(isFridge344Chart(def))return renderFridge344344Management;if(isFridgeChart(def))return renderFridgeManagement;if(isBalanceChart(def))return renderBalanceManagement;if(isDistillerChart(def))return renderDistillerManagement;if(isIncubatorChart(def))return renderIncubatorManagement;if(isPHChart(def))return renderPHManagement;if(isConductivityChart(def))return renderConductivityManagement;if(isDBO5Chart(def))return null;return undefined;
}
function ccEnhanceManagementDecisionGuide(){
  const box=$('#ccRules');if(!box||box.querySelector('.cc-decision-guide'))return;
  const text=box.textContent||'',catalog={
    '1_2s':['VIGILANCIA','Un punto supera ±2s. Confirmar el siguiente control y revisar tendencia antes de intervenir.'],
    '1_3s':['ACCIÓN','Un punto supera ±3s. Investigar causa asignable, revisar equipo/patrón/ambiente y documentar decisión.'],
    '2_2s':['ACCIÓN','Dos resultados consecutivos superan ±2s del mismo lado. Revisar desplazamiento sistemático y trazabilidad.'],
    'R_4s':['ACCIÓN','La amplitud entre resultados excede 4s. Revisar precisión, repetibilidad, manipulación y condición del sistema.'],
    '7x':['VIGILANCIA','Siete resultados permanecen del mismo lado de la media. Revisar posible desplazamiento sostenido.'],
    '7T':['VIGILANCIA','Siete resultados muestran tendencia continua. Revisar deriva y evolución del sistema de medición.']
  };
  const rules=Object.keys(catalog).filter(r=>text.includes(r)),guide=document.createElement('div');guide.className='cc-decision-guide';
  const phase=(($('#ccTempState')?.textContent||'')+' '+($('#ccHumState')?.textContent||'')).includes('ESTABLECIMIENTO');
  if(!rules.length){guide.innerHTML=`<b>Apoyo a decisión de Calidad</b><span>${phase?'Serie en establecimiento: las señales son preliminares hasta disponer del mínimo definido. ':'Sin señales Westgard/Shewhart activas. '}Mantener vigilancia y evaluar siempre el cumplimiento técnico por separado.</span>`;}
  else guide.innerHTML=`<b>Apoyo a decisión de Calidad</b><span>${phase?'Señales preliminares durante establecimiento. ':''}La IA identifica la regla y propone revisión; no cambia límites ni sustituye la decisión del Jefe.</span><div class="cc-action-grid">${rules.map(r=>`<div><strong>${r} · ${catalog[r][0]}</strong><small>${catalog[r][1]}</small></div>`).join('')}</div>`;
  box.appendChild(guide);
}

// 6.33.25.10.5 · Carga histórica universal (01-ene-2026 a 31-ago-2026).
// Registros históricos usan la misma colección controlChartRecords, quedan marcados como HISTORICO_MANUAL
// y NO generan notificaciones ni obligaciones diarias.
const CC_HIST_START='2026-01-01',CC_HIST_END='2026-08-31';
function ccHistoricalAllowed(month){return !!month&&month>='2026-01'&&month<='2026-08'}
function ccHistoricalSchema(def){
  if(isPHChart(def)||isMicrobiologyPHChart(def))return {kind:'PH',fields:[['p4','pH 4.00','0.01'],['p7','pH 7.00','0.01'],['p10','pH 10.00','0.01']]};
  if(isConductivityChart(def))return {kind:'COND',fields:[['c84','84 µS/cm','0.01'],['c1413','1413 µS/cm','0.01'],['c1288','12.88 mS/cm','0.001']]};
  if(isBalanceChart(def))return {kind:'BAL',fields:[['mass1','Masa 1 g','0.0001'],['mass100','Masa 100 g','0.0001']]};
  if(isDBO5Chart(def)||isMicrobiologyEnvironmentChart(def)||isBalanceEnvironmentChart(def)||isMetalsChart(def))return {kind:'ENV',fields:[['temp','Temperatura leída °C','0.01'],['tempFactor','Factor T °C','0.01'],['hum','Humedad leída %HR','0.1'],['humFactor','Factor HR','0.1']]};
  return {kind:'TEMP',fields:[['temp','Temperatura/lectura','0.01'],['factor','Factor/corrección','0.01']]};
}
async function ccHistoricalAnalystOptions(){const a=(await getAll('analysts')).filter(x=>x.status!=='INACTIVO');return '<option value="">Seleccione…</option>'+a.map(x=>`<option value="${x.id}">${escapeHtml(x.name||x.id)}</option>`).join('')}
async function openHistoricalLoader(){
  const def=await getOne('controlChartDefs',$('#ccChartSelect').value),month=$('#ccMonth').value;if(!def)return;
  if(!ccHistoricalAllowed(month))return toast('La carga histórica está habilitada del 01/01/2026 al 31/08/2026.');
  const dlg=$('#ccHistoricalDialog'),schema=ccHistoricalSchema(def),opts=await ccHistoricalAnalystOptions(),records=(await getAll('controlChartRecords')).filter(r=>r.chartId===def.id&&String(r.measuredAt||'').startsWith(month));
  $('#ccHistTitle').textContent=`Carga histórica · ${def.name}`;$('#ccHistSubtitle').textContent=`${month} · Ingrese únicamente fechas realmente documentadas. Los cálculos se validan con el criterio de la carta.`;$('#ccHistChartId').value=def.id;$('#ccHistMonth').value=month;$('#ccHistKind').value=schema.kind;
  const days=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate(),existing=new Map(records.map(r=>[String(r.measuredAt||'').slice(0,10),r]));let html='';
  for(let d=1;d<=days;d++){const date=`${month}-${String(d).padStart(2,'0')}`,r=existing.get(date);html+=`<tr data-hdate="${date}" class="${r?'cc-hist-existing':''}"><td><b>${date}</b>${r?'<small>REGISTRADO</small>':''}</td><td><select data-hanalyst ${r?'disabled':''}>${opts}</select></td>${schema.fields.map(([k,label,step])=>`<td><label><span>${label}</span><input data-hfield="${k}" type="number" step="${step}" ${r?'disabled':''}></label></td>`).join('')}<td><input data-hnotes placeholder="Observación" ${r?'disabled':''}></td><td>${r?'<span class="badge">✓ Guardado</span>':'<input data-huse type="checkbox" title="Incluir esta fecha">'}</td></tr>`}
  $('#ccHistHead').innerHTML=`<tr><th>Fecha</th><th>Responsable</th>${schema.fields.map(x=>`<th>${escapeHtml(x[1])}</th>`).join('')}<th>Observación</th><th>Incluir</th></tr>`;$('#ccHistBody').innerHTML=html;
  // Restore visible existing values for reference.
  for(const [date,r] of existing){const tr=$(`#ccHistBody tr[data-hdate="${date}"]`);if(!tr)continue;const sel=tr.querySelector('[data-hanalyst]');if(sel)sel.value=r.analystId||'';const vals=schema.kind==='PH'?{p4:r.p4?.reading,p7:r.p7?.reading,p10:r.p10?.reading}:schema.kind==='COND'?{c84:r.c84?.reading,c1413:r.c1413?.reading,c1288:r.c1288?.reading}:schema.kind==='BAL'?{mass1:r.mass1?.reading,mass100:r.mass100?.reading}:schema.kind==='ENV'?{temp:r.tempRaw,tempFactor:r.tempFactor,hum:r.humRaw,humFactor:r.humFactor}:{temp:r.tempRaw??r.tempEvaluated??r.reading,factor:r.tempFactor??0};tr.querySelectorAll('[data-hfield]').forEach(i=>{const v=vals[i.dataset.hfield];if(v!==undefined&&v!==null)i.value=v});const n=tr.querySelector('[data-hnotes]');if(n)n.value=r.notes||''}
  dlg.showModal();
}
function ccHistPoint(reading,nominal,limit){const v=Number(reading),e=Math.abs(v-nominal);return {nominal,reading:v,error:e,ok:e<=limit}}
async function saveHistoricalMonth(){
  const chartId=$('#ccHistChartId').value,month=$('#ccHistMonth').value,kind=$('#ccHistKind').value,def=await getOne('controlChartDefs',chartId);if(!def||!ccHistoricalAllowed(month))return;
  const analysts=await getAll('analysts'),existing=await getAll('controlChartRecords');let saved=0,skipped=0;
  for(const tr of $$('#ccHistBody tr[data-hdate]')){const use=tr.querySelector('[data-huse]');if(!use||!use.checked)continue;const date=tr.dataset.hdate,analystId=tr.querySelector('[data-hanalyst]').value,a=analysts.find(x=>x.id===analystId),get=k=>tr.querySelector(`[data-hfield="${k}"]`)?.value,notes=tr.querySelector('[data-hnotes]').value.trim();if(!analystId){skipped++;continue}if(existing.some(r=>r.chartId===chartId&&String(r.measuredAt||'').slice(0,10)===date)){skipped++;continue}
    let rec={id:uid('CCR'),chartId,section:def.section||'',methodName:def.methodName||'',analystId,analystName:a?.name||'Analista',measuredAt:`${date}T12:00:00`,notes,source:'HISTORICO_MANUAL',historicalEntry:true,historicalImportedAt:nowISO(),schemaVersion:1,createdAt:nowISO(),updatedAt:nowISO(),statisticalState:'ESTABLECIMIENTO',statisticalRules:[]};
    if(kind==='PH'){const p4=ccHistPoint(get('p4'),4,0.10),p7=ccHistPoint(get('p7'),7,0.10),p10=ccHistPoint(get('p10'),10,0.10);if([p4.reading,p7.reading,p10.reading].some(Number.isNaN)){skipped++;continue}Object.assign(rec,{controlType:'PH_MULTIPUNTO',equipment:phEquipment(def),area:phAreaLabel(def),p4,p7,p10,criterion:{type:'ABS_ERROR',limit:.10,unit:'pH'},overallResult:p4.ok&&p7.ok&&p10.ok?'CUMPLE':'NO CUMPLE'});}
    else if(kind==='COND'){const mk=(v,n,u)=>{v=Number(v);const e=Math.abs((v-n)/n*100);return {nominal:n,reading:v,errorPct:e,low:n*.95,high:n*1.05,unit:u,ok:e<=5}},c84=mk(get('c84'),84,'µS/cm'),c1413=mk(get('c1413'),1413,'µS/cm'),c1288=mk(get('c1288'),12.88,'mS/cm');if([c84.reading,c1413.reading,c1288.reading].some(Number.isNaN)){skipped++;continue}Object.assign(rec,{controlType:'CONDUCTIVIDAD_MULTIPUNTO',equipment:'EI-104',c84,c1413,c1288,overallResult:c84.ok&&c1413.ok&&c1288.ok?'CUMPLE':'NO CUMPLE'});}
    else if(kind==='BAL'){const m1=ccHistPoint(get('mass1'),1,.001),m100=ccHistPoint(get('mass100'),100,.002);if([m1.reading,m100.reading].some(Number.isNaN)){skipped++;continue}Object.assign(rec,{controlType:'BALANZA_MULTIPUNTO',equipment:'EI-227',mass1:m1,mass100:m100,overallResult:m1.ok&&m100.ok?'CUMPLE':'NO CUMPLE'});}
    else if(kind==='ENV'){const t=Number(get('temp')),tf=Number(get('tempFactor')||0),h=Number(get('hum')),hf=Number(get('humFactor')||0);if([t,h].some(Number.isNaN)){skipped++;continue}const tc=t+tf,hc=h+hf;let tmin=17,tmax=23,hmin=20,hmax=80,type='DBO5_AMBIENTAL';if(isMicrobiologyEnvironmentChart(def)){const c=microEnvConfig(def);tmin=c.tempCriterion.min;tmax=c.tempCriterion.max;hmin=-Infinity;hmax=c.humCriterion.max;type='MICROBIOLOGIA_AMBIENTE_EI347'}else if(isBalanceEnvironmentChart(def)){const c=balanceEnvConfig(def);tmin=c.tempCriterion.min;tmax=c.tempCriterion.max;hmin=-Infinity;hmax=c.humCriterion.max;type='BALANZA_AMBIENTE_EI285'}else if(isMetalsChart(def)){const c=metalsConfig(def);tmin=c.tempCriterion.min;tmax=c.tempCriterion.max;hmin=-Infinity;hmax=c.humCriterion.max;type='METALES_EI313'}Object.assign(rec,{controlType:type,tempRaw:t,tempFactor:tf,tempCorrected:tc,humRaw:h,humFactor:hf,humCorrected:hc,tempCriterion:{min:tmin,max:tmax},humCriterion:{min:hmin,max:hmax},environmentalResult:tc>=tmin&&tc<=tmax&&hc>=hmin&&hc<=hmax?'CUMPLE':'NO CUMPLE',overallResult:tc>=tmin&&tc<=tmax&&hc>=hmin&&hc<=hmax?'CUMPLE':'NO CUMPLE'});}
    else {const raw=Number(get('temp')),factor=Number(get('factor')||0);if(Number.isNaN(raw)){skipped++;continue}const val=raw+factor;let min=-Infinity,max=Infinity,type='TEMPERATURA_HISTORICA';if(isOven314Chart(def)){min=103;max=105;type='ESTUFA_EI314'}else if(isThermal105Chart(def)){min=103;max=107;type='TERMICO_105'}else if(isThermal150Chart(def)||isThermalDQOChart(def)){min=148;max=152;type=isThermalDQOChart(def)?'DQO_EI360':'TERMICO_150'}else if(isDigestorChart(def)){min=360;max=390;type='DIGESTOR_EI154'}else if(isFridge344Chart(def)){min=2;max=8;type='NEVERA_EI344'}else if(isFridgeChart(def)){const c=fridgeConfig(def);min=c.criterion.min;max=c.criterion.max;type=fridgeIdentity(def).controlType}else if(isMicrobiologyFreezerChart(def)){const c=microFreezerConfig(def);min=c.criterion.min;max=c.criterion.max;type='CONGELADOR_MICROBIOLOGIA_EI350'}else if(isMicrobiologyIncubator364Chart(def)){const c=incMicroConfig(def);min=c.criterion.min;max=c.criterion.max;type='INCUBADORA_MICROBIOLOGIA_EI364'}else if(isIncubatorChart(def)){min=19;max=21;type='INCUBADORA_EI306'}Object.assign(rec,{controlType:type,tempRaw:raw,tempFactor:factor,tempCorrected:val,tempEvaluated:val,tempCriterion:{min,max},overallResult:val>=min&&val<=max?'CUMPLE':'NO CUMPLE'});}
    await put('controlChartRecords',rec);await queue('CREATE','controlChartRecords',rec);await audit('CARGA_HISTORICA','CARTA_CONTROL',rec.id,`${def.name} · ${date} · ${rec.overallResult}`);saved++;
  }
  if(saved){await flushOutbox(false);toast(`${saved} registro(s) histórico(s) guardados. ${skipped?skipped+' omitidos por datos incompletos/duplicados.':''}`);$('#ccHistoricalDialog').close();await renderControlChartsManagement()}else toast(`No se guardaron registros. ${skipped?'Revise responsable, valores o duplicados.':'Marque las fechas que desea incluir.'}`);
}
function updateHistoricalButton(){const b=$('#btnCcHistorical');if(!b)return;const m=$('#ccMonth')?.value||'';b.classList.toggle('hidden',!ccHistoricalAllowed(m));b.textContent=ccHistoricalAllowed(m)?'＋ Cargar histórico':'＋ Cargar histórico'}

async function renderControlChartsManagement(){
  if(currentSessionUser?.role!=='JEFE')return;
  const defs=(await getAll('controlChartDefs')).filter(d=>d.status==='ACTIVO'&&(isMicrobiologyIncubator364Chart(d)||isMicrobiologyIncubatorChart(d)||isMicrobiologyEnvironmentChart(d)||isMicrobiologyPHChart(d)||isBalanceEnvironmentChart(d)||isMetalsChart(d)||isOven314Chart(d)||isThermal105Chart(d)||isThermal150Chart(d)||isThermalDQOChart(d)||isDigestorChart(d)||isFridge344Chart(d)||isFridgeChart(d)||isBalanceChart(d)||isDistillerChart(d)||isIncubatorChart(d)||isDBO5Chart(d)||isPHChart(d)||isConductivityChart(d)));
  const sel=$('#ccChartSelect');if(!sel)return;
  const prior=sel.value;sel.innerHTML=defs.map(d=>`<option value="${d.id}">${escapeHtml(d.name)} · ${escapeHtml(d.methodName||'')}</option>`).join('');if(prior&&defs.some(d=>d.id===prior))sel.value=prior;
  if(!$('#ccMonth').value)$('#ccMonth').value=ccMonthNow();updateHistoricalButton();
  if(!defs.length){$('#ccEmpty').classList.remove('hidden');$('#ccDashboard').classList.add('hidden');return;}
  const def=defs.find(d=>d.id===(sel.value||defs[0].id))||defs[0],chartId=def.id,month=$('#ccMonth').value||ccMonthNow();
  resetControlChartManagementUI();
  const adapter=controlChartManagementAdapter(def);
  if(adapter){await adapter(def,month);ccEnhanceManagementDecisionGuide();return;}
  if(adapter===undefined){showControlChartNoData(def.name||'Carta de control',month);return;}
  $('#ccChart3Card').classList.add('hidden');$('#ccChart1Title').textContent='Temperatura corregida';$('#ccChart1Desc').textContent='Media, ±1s, ±2s, ±3s y límites técnicos 17–23 °C.';$('#ccChart2Title').textContent='Humedad corregida';$('#ccChart2Desc').textContent='Media, ±1s, ±2s, ±3s y límites técnicos 20–80 %HR.';
  const all=await dbo5Records(chartId),rows=all.filter(r=>String(r.measuredAt||'').startsWith(month));
  $('#ccCount').textContent=`${rows.length} registros · ${month}`;$('#ccHistoryHead').innerHTML='<tr><th>Fecha/hora</th><th>Responsable</th><th>T corregida</th><th>HR corregida</th><th>Ambiental</th><th>Estadístico</th><th>Reglas</th><th>Detalle</th></tr>';
  if(!rows.length){$('#ccEmpty').classList.remove('hidden');$('#ccDashboard').classList.add('hidden');return;}$('#ccEmpty').classList.add('hidden');$('#ccDashboard').classList.remove('hidden');
  const tv=rows.map(r=>Number(r.tempCorrected)),hv=rows.map(r=>Number(r.humCorrected)),tw=dbo5Westgard(tv),hw=dbo5Westgard(hv),comp=rows.filter(r=>r.environmentalResult==='CUMPLE').length,pct=100*comp/rows.length;
  const prevDate=new Date(month+'-01T00:00:00');prevDate.setMonth(prevDate.getMonth()-1);const pm=`${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}`,prev=all.filter(r=>String(r.measuredAt||'').startsWith(pm));const prevPct=prev.length?100*prev.filter(r=>r.environmentalResult==='CUMPLE').length/prev.length:null;
  $('#ccKpis').innerHTML=`<div><small>Controles</small><b>${rows.length}</b><span>${month}</span></div><div><small>Cumplimiento ambiental</small><b>${pct.toFixed(1)}%</b><span>${comp}/${rows.length} cumplen</span></div><div><small>Temperatura media ± s</small><b>${mean(tv).toFixed(2)} ± ${sd(tv).toFixed(2)} °C</b><span>mín ${Math.min(...tv).toFixed(2)} · máx ${Math.max(...tv).toFixed(2)}</span></div><div><small>Humedad media ± s</small><b>${mean(hv).toFixed(1)} ± ${sd(hv).toFixed(1)} %</b><span>mín ${Math.min(...hv).toFixed(1)} · máx ${Math.max(...hv).toFixed(1)}</span></div>`;
  $('#ccTempState').textContent=tw.state;$('#ccHumState').textContent=hw.state;$('#ccTempChart').innerHTML=ccSvgLine(rows,'tempCorrected','°C',17,23);$('#ccHumChart').innerHTML=ccSvgLine(rows,'humCorrected','%HR',20,80);
  const tr=ccRuleDetails(tv,rows.map(r=>r.measuredAt)),hr=ccRuleDetails(hv,rows.map(r=>r.measuredAt));const events=[];tr.forEach(x=>x.rules.forEach(rule=>events.push({kind:'Temperatura',rule,date:x.label})));hr.forEach(x=>x.rules.forEach(rule=>events.push({kind:'Humedad',rule,date:x.label})));
  $('#ccRules').innerHTML=events.length?events.slice().reverse().map(e=>`<div class="cc-rule"><b>${escapeHtml(e.rule)}</b><span>${e.kind} · ${ccFmtDate(e.date)}</span></div>`).join(''):`<div class="cc-ok">No se detectan reglas de alarma en el período.</div>`;
  const trend=prevPct===null?'Sin período anterior comparable':`${pct>=prevPct?'Mejora/estable':'Disminución'} frente a ${pm}: ${prevPct.toFixed(1)}% → ${pct.toFixed(1)}%`;
  $('#ccAi').innerHTML=`<b>Diagnóstico mensual:</b> ${pct===100?'Todos los controles cumplen los límites ambientales definidos.':`${rows.length-comp} control(es) no cumplen los límites ambientales.`} ${rows.length<10?'El período permanece en FASE DE ESTABLECIMIENTO para interpretación estadística.':`Temperatura: <b>${tw.state}</b>. Humedad: <b>${hw.state}</b>.`} ${events.length?`Se identificaron <b>${events.length}</b> activaciones de reglas; revise los puntos señalados y su trazabilidad.`:'No se observan activaciones de reglas en los puntos evaluados.'}<br><br><b>Tendencia:</b> ${trend}.<br><small>La IA es asistiva: los criterios 17–23 °C y 20–80 %HR y las reglas configuradas no se modifican automáticamente.</small>`;
  $('#ccHistoryBody').innerHTML=rows.slice().reverse().map(r=>`<tr><td>${ccFmtDate(r.measuredAt)}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${Number(r.tempCorrected).toFixed(2)} °C</td><td>${Number(r.humCorrected).toFixed(1)} %</td><td><span class="badge">${r.environmentalResult}</span></td><td>${escapeHtml(r.statisticalState||'—')}</td><td>${escapeHtml((r.statisticalRules||[]).join(', ')||'—')}</td><td><button class="btn secondary compact" type="button" onclick="showCcPoint('${r.id}')">Ver</button></td></tr>`).join('');
}
function phSvgRows(rows,key){return rows.map(r=>({...r,phValue:Number(r[key]?.reading)}));}
async function renderPHManagement(def,month){
  $('#ccChart3Card').classList.remove('hidden');$('#ccChart1Title').textContent='Control pH 4.00';$('#ccChart1Desc').textContent='Lectura, media, ±1s, ±2s, ±3s y criterio técnico 3.90–4.10.';$('#ccChart2Title').textContent='Control pH 7.00';$('#ccChart2Desc').textContent='Lectura, media, ±1s, ±2s, ±3s y criterio técnico 6.90–7.10.';$('#ccChart3Title').textContent='Control pH 10.00';$('#ccChart3Desc').textContent='Lectura, media, ±1s, ±2s, ±3s y criterio técnico 9.90–10.10.';
  const all=await phRecords(def.id),rows=all.filter(r=>String(r.measuredAt||'').startsWith(month));$('#ccCount').textContent=`${rows.length} registros · ${month}`;$('#ccHistoryHead').innerHTML='<tr><th>Fecha/hora</th><th>Responsable</th><th>pH 4</th><th>pH 7</th><th>pH 10</th><th>Resultado</th><th>Estadístico</th><th>Detalle</th></tr>';
  if(!rows.length){$('#ccEmpty').classList.remove('hidden');$('#ccDashboard').classList.add('hidden');return;}$('#ccEmpty').classList.add('hidden');$('#ccDashboard').classList.remove('hidden');
  const vals=k=>rows.map(r=>Number(r[k]?.reading)),v4=vals('p4'),v7=vals('p7'),v10=vals('p10'),w4=dbo5Westgard(v4),w7=dbo5Westgard(v7),w10=dbo5Westgard(v10),comp=rows.filter(r=>r.overallResult==='CUMPLE').length,pct=100*comp/rows.length;
  $('#ccKpis').innerHTML=`<div><small>Controles</small><b>${rows.length}</b><span>${month}</span></div><div><small>Cumplimiento multipunto</small><b>${pct.toFixed(1)}%</b><span>${comp}/${rows.length} cumplen los 3 niveles</span></div><div><small>Error máximo observado</small><b>${Math.max(...rows.flatMap(r=>[r.p4.error,r.p7.error,r.p10.error])).toFixed(3)} pH</b><span>criterio ≤ 0.10 pH</span></div><div><small>Equipo</small><b>${phEquipment(def)}</b><span>${phAreaLabel(def)} · pH 4.00 · 7.00 · 10.00</span></div>`;
  $('#ccTempState').textContent=rows.length<10?'ESTABLECIMIENTO':w4.state;$('#ccHumState').textContent=rows.length<10?'ESTABLECIMIENTO':w7.state;$('#ccChart3State').textContent=rows.length<10?'ESTABLECIMIENTO':w10.state;$('#ccTempChart').innerHTML=ccSvgLine(phSvgRows(rows,'p4'),'phValue','pH',3.90,4.10);$('#ccHumChart').innerHTML=ccSvgLine(phSvgRows(rows,'p7'),'phValue','pH',6.90,7.10);$('#ccChart3').innerHTML=ccSvgLine(phSvgRows(rows,'p10'),'phValue','pH',9.90,10.10);
  const events=[];[['pH 4.00',v4],['pH 7.00',v7],['pH 10.00',v10]].forEach(([kind,v])=>ccRuleDetails(v,rows.map(r=>r.measuredAt)).forEach(x=>x.rules.forEach(rule=>events.push({kind,rule,date:x.label}))));$('#ccRules').innerHTML=events.length?events.slice().reverse().map(e=>`<div class="cc-rule"><b>${escapeHtml(e.rule)}</b><span>${e.kind} · ${ccFmtDate(e.date)}</span></div>`).join(''):`<div class="cc-ok">No se detectan reglas de alarma en los tres niveles.</div>`;
  const failed=rows.length-comp;$('#ccAi').innerHTML=`<b>Diagnóstico mensual pH ${phEquipment(def)}:</b> ${failed?`${failed} control(es) no cumplieron el criterio multipunto ±0.10 pH.`:'Todos los controles del período cumplen simultáneamente pH 4.00, 7.00 y 10.00.'} ${rows.length<10?'Cada nivel permanece en FASE DE ESTABLECIMIENTO hasta completar 10 registros.':`Estados: pH 4 <b>${w4.state}</b>, pH 7 <b>${w7.state}</b>, pH 10 <b>${w10.state}</b>.`} ${events.length?`Se detectaron ${events.length} activaciones estadísticas para revisión.`:'No se detectan reglas estadísticas.'}<br><small>La IA es asistiva. El criterio técnico ±0.10 pH y las reglas estadísticas no se modifican automáticamente.</small>`;
  $('#ccHistoryBody').innerHTML=rows.slice().reverse().map(r=>`<tr><td>${ccFmtDate(r.measuredAt)}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${r.p4.reading.toFixed(2)} (${r.p4.error.toFixed(2)})</td><td>${r.p7.reading.toFixed(2)} (${r.p7.error.toFixed(2)})</td><td>${r.p10.reading.toFixed(2)} (${r.p10.error.toFixed(2)})</td><td><span class="badge">${r.overallResult}</span></td><td>${escapeHtml(r.statisticalState||'—')}</td><td><button class="btn secondary compact" type="button" onclick="showCcPoint('${r.id}')">Ver</button></td></tr>`).join('');
}
function conductivitySvgRows(rows,key){return rows.map(r=>({...r,condValue:Number(r[key]?.reading)}));}
async function renderConductivityManagement(def,month){
  $('#ccChart3Card').classList.remove('hidden');$('#ccChart1Title').textContent='Control 84 µS/cm';$('#ccChart1Desc').textContent='Lectura, media, ±1s, ±2s, ±3s y límite técnico 79.80–88.20 µS/cm.';$('#ccChart2Title').textContent='Control 1413 µS/cm';$('#ccChart2Desc').textContent='Lectura, media, ±1s, ±2s, ±3s y límite técnico 1342.35–1483.65 µS/cm.';$('#ccChart3Title').textContent='Control 12.88 mS/cm';$('#ccChart3Desc').textContent='Lectura, media, ±1s, ±2s, ±3s y límite técnico 12.236–13.524 mS/cm.';
  const all=await conductivityRecords(def.id),rows=all.filter(r=>String(r.measuredAt||'').startsWith(month));$('#ccCount').textContent=`${rows.length} registros · ${month}`;$('#ccHistoryHead').innerHTML='<tr><th>Fecha/hora</th><th>Responsable</th><th>84 µS/cm</th><th>1413 µS/cm</th><th>12.88 mS/cm</th><th>Resultado</th><th>Estadístico</th><th>Detalle</th></tr>';
  if(!rows.length){$('#ccEmpty').classList.remove('hidden');$('#ccDashboard').classList.add('hidden');return;}$('#ccEmpty').classList.add('hidden');$('#ccDashboard').classList.remove('hidden');
  const vals=k=>rows.map(r=>Number(r[k]?.reading)),v1=vals('c84'),v2=vals('c1413'),v3=vals('c1288'),w1=dbo5Westgard(v1),w2=dbo5Westgard(v2),w3=dbo5Westgard(v3),comp=rows.filter(r=>r.overallResult==='CUMPLE').length,pct=100*comp/rows.length;
  $('#ccKpis').innerHTML=`<div><small>Controles</small><b>${rows.length}</b><span>${month}</span></div><div><small>Cumplimiento multipunto</small><b>${pct.toFixed(1)}%</b><span>${comp}/${rows.length} cumplen los 3 niveles</span></div><div><small>Error relativo máximo</small><b>${Math.max(...rows.flatMap(r=>[r.c84.errorPct,r.c1413.errorPct,r.c1288.errorPct])).toFixed(2)}%</b><span>criterio ≤ 5.00%</span></div><div><small>Equipo</small><b>EI-104</b><span>84 · 1413 µS/cm · 12.88 mS/cm</span></div>`;
  $('#ccTempState').textContent=rows.length<10?'ESTABLECIMIENTO':w1.state;$('#ccHumState').textContent=rows.length<10?'ESTABLECIMIENTO':w2.state;$('#ccChart3State').textContent=rows.length<10?'ESTABLECIMIENTO':w3.state;$('#ccTempChart').innerHTML=ccSvgLine(conductivitySvgRows(rows,'c84'),'condValue','µS/cm',79.80,88.20);$('#ccHumChart').innerHTML=ccSvgLine(conductivitySvgRows(rows,'c1413'),'condValue','µS/cm',1342.35,1483.65);$('#ccChart3').innerHTML=ccSvgLine(conductivitySvgRows(rows,'c1288'),'condValue','mS/cm',12.236,13.524);
  const events=[];[['84 µS/cm',v1],['1413 µS/cm',v2],['12.88 mS/cm',v3]].forEach(([kind,v])=>ccRuleDetails(v,rows.map(r=>r.measuredAt)).forEach(x=>x.rules.forEach(rule=>events.push({kind,rule,date:x.label}))));$('#ccRules').innerHTML=events.length?events.slice().reverse().map(e=>`<div class="cc-rule"><b>${escapeHtml(e.rule)}</b><span>${e.kind} · ${ccFmtDate(e.date)}</span></div>`).join(''):`<div class="cc-ok">No se detectan reglas de alarma en los tres niveles.</div>`;
  const failed=rows.length-comp;$('#ccAi').innerHTML=`<b>Diagnóstico mensual Conductividad:</b> ${failed?`${failed} control(es) no cumplieron simultáneamente el límite ±5%.`:'Todos los controles del período cumplen simultáneamente los tres niveles dentro de ±5%.'} ${rows.length<10?'Cada nivel permanece en FASE DE ESTABLECIMIENTO hasta completar 10 registros.':`Estados: 84 µS/cm <b>${w1.state}</b>, 1413 µS/cm <b>${w2.state}</b>, 12.88 mS/cm <b>${w3.state}</b>.`} ${events.length?`Se detectaron ${events.length} activaciones estadísticas para revisión.`:'No se detectan reglas estadísticas.'}<br><small>La IA es asistiva. Los límites técnicos establecidos y las reglas estadísticas no se modifican automáticamente.</small>`;
  $('#ccHistoryBody').innerHTML=rows.slice().reverse().map(r=>`<tr><td>${ccFmtDate(r.measuredAt)}</td><td>${escapeHtml(r.analystName||'—')}</td><td>${r.c84.reading.toFixed(1)} (${r.c84.errorPct.toFixed(2)}%)</td><td>${r.c1413.reading.toFixed(1)} (${r.c1413.errorPct.toFixed(2)}%)</td><td>${r.c1288.reading.toFixed(3)} (${r.c1288.errorPct.toFixed(2)}%)</td><td><span class="badge">${r.overallResult}</span></td><td>${escapeHtml(r.statisticalState||'—')}</td><td><button class="btn secondary compact" type="button" onclick="showCcPoint('${r.id}')">Ver</button></td></tr>`).join('');
}
async function showCcPoint(id){const r=await getOne('controlChartRecords',id),box=$('#ccPointDetail');if(!r||!box)return;box.classList.remove('hidden');if(r.controlType==='BALANZA_MULTIPUNTO'){box.innerHTML=`<div class="section-head"><div><h3>Detalle trazable Balanza EI-227 · ${ccFmtDate(r.measuredAt)}</h3><p>${escapeHtml(r.analystName||'—')} · Control transversal de pesaje</p></div><button class="icon-btn" type="button" onclick="document.getElementById('ccPointDetail').classList.add('hidden')">×</button></div><div class="cc-detail-grid"><div><small>Punto 1 g</small><b>${Number(r.mass1.reading).toFixed(4)} g</b><span>Error ${Number(r.mass1.error).toFixed(4)} g · criterio ±0.001 g · ${r.mass1.ok?'CUMPLE':'NO CUMPLE'}</span></div><div><small>Punto 100 g</small><b>${Number(r.mass100.reading).toFixed(4)} g</b><span>Error ${Number(r.mass100.error).toFixed(4)} g · criterio ±0.002 g · ${r.mass100.ok?'CUMPLE':'NO CUMPLE'}</span></div><div><small>Resultado global</small><b>${escapeHtml(r.overallResult)}</b><span>Ambos puntos deben cumplir</span></div><div><small>Aplicabilidad</small><b>Transversal</b><span>${escapeHtml((r.applicableMethodsSnapshot||[]).join(' · ')||'Pesajes vinculados')}</span></div></div>${r.notes?`<p class="cc-note"><b>Observación:</b> ${escapeHtml(r.notes)}</p>`:''}`;}else if(r.controlType==='CONDUCTIVIDAD_MULTIPUNTO'){box.innerHTML=`<div class="section-head"><div><h3>Detalle trazable Conductividad · ${ccFmtDate(r.measuredAt)}</h3><p>${escapeHtml(r.analystName||'—')} · Conductímetro ${escapeHtml(r.equipment||'EI-104')}</p></div><button class="icon-btn" type="button" onclick="document.getElementById('ccPointDetail').classList.add('hidden')">×</button></div><div class="cc-detail-grid">${[['c84','84 µS/cm'],['c1413','1413 µS/cm'],['c1288','12.88 mS/cm']].map(([k,n])=>`<div><small>Control ${n}</small><b>${Number(r[k].reading).toFixed(k==='c1288'?3:1)} ${r[k].unit}</b><span>Error relativo ${Number(r[k].errorPct).toFixed(2)}% · límites ${Number(r[k].low).toFixed(k==='c1288'?3:2)}–${Number(r[k].high).toFixed(k==='c1288'?3:2)} · ${r[k].ok?'CUMPLE':'NO CUMPLE'}</span></div>`).join('')}<div><small>Resultado global</small><b>${escapeHtml(r.overallResult)}</b><span>criterio ±5% en los 3 niveles</span></div></div>${r.notes?`<p class="cc-note"><b>Observación:</b> ${escapeHtml(r.notes)}</p>`:''}`;}else if(r.controlType==='PH_MULTIPUNTO'){box.innerHTML=`<div class="section-head"><div><h3>Detalle trazable pH · ${ccFmtDate(r.measuredAt)}</h3><p>${escapeHtml(r.analystName||'—')} · pHmetro ${escapeHtml(r.equipment||'EI-345')}</p></div><button class="icon-btn" type="button" onclick="document.getElementById('ccPointDetail').classList.add('hidden')">×</button></div><div class="cc-detail-grid">${[['p4','4.00'],['p7','7.00'],['p10','10.00']].map(([k,n])=>`<div><small>Control pH ${n}</small><b>${Number(r[k].reading).toFixed(2)}</b><span>Error |lectura−nominal| = ${Number(r[k].error).toFixed(3)} · ${r[k].ok?'CUMPLE':'NO CUMPLE'}</span></div>`).join('')}<div><small>Resultado global</small><b>${escapeHtml(r.overallResult)}</b><span>criterio ±0.10 pH en los 3 niveles</span></div></div>${r.notes?`<p class="cc-note"><b>Observación:</b> ${escapeHtml(r.notes)}</p>`:''}`;}else{box.innerHTML=`<div class="section-head"><div><h3>Detalle trazable · ${ccFmtDate(r.measuredAt)}</h3><p>${escapeHtml(r.analystName||'—')} · ${escapeHtml(r.area||'Instrumental')} · ${escapeHtml(r.thermohygrometer||'EI-270')} / ${escapeHtml(r.dataLogger||'PF-09')}</p></div><button class="icon-btn" type="button" onclick="document.getElementById('ccPointDetail').classList.add('hidden')">×</button></div><div class="cc-detail-grid"><div><small>Temperatura original</small><b>${Number(r.tempRaw).toFixed(2)} °C</b><span>Factor +${Number(r.tempFactor).toFixed(2)} → ${Number(r.tempCorrected).toFixed(2)} °C</span></div><div><small>Humedad original</small><b>${Number(r.humRaw).toFixed(1)} %HR</b><span>Factor +${Number(r.humFactor).toFixed(1)} → ${Number(r.humCorrected).toFixed(1)} %HR</span></div><div><small>Cumplimiento ambiental</small><b>${escapeHtml(r.environmentalResult)}</b><span>17–23 °C · 20–80 %HR</span></div><div><small>Estado estadístico</small><b>${escapeHtml(r.statisticalState||'—')}</b><span>${escapeHtml((r.statisticalRules||[]).join(', ')||'Sin reglas')}</span></div></div>${r.notes?`<p class="cc-note"><b>Observación:</b> ${escapeHtml(r.notes)}</p>`:''}`;}box.scrollIntoView({behavior:'smooth',block:'nearest'});}

async function backup(){const data={app:'ERP_PLANIFICACION_NEXTGEN',version:APP_VERSION,exportedAt:nowISO(),catalog:await getAll('catalog'),timeRules:await getAll('timeRules'),compositeSteps:await getAll('compositeSteps'),analysts:await getAll('analysts'),audit:await getAll('audit'),outbox:await getAll('outbox'),config:await getAll('config'),planning:await getAll('planning'),planComments:await getAll('planComments'),controlChartDefs:await getAll('controlChartDefs'),controlChartRecords:await getAll('controlChartRecords')};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`RESPALDO_ERP_PLANIFICACION_${APP_VERSION}_${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);await audit('EXPORTAR','SISTEMA','BACKUP','Respaldo general exportado');toast('Respaldo generado');await refreshAll()}
async function resetDB(){if(!confirm('Esto eliminará catálogo, reglas, analistas y trazabilidad locales de esta versión. ¿Continuar?'))return;await Promise.all(['catalog','timeRules','compositeSteps','analysts','audit','outbox','config','planning','planComments','controlChartDefs','controlChartRecords'].map(clearStore));toast('Base local reiniciada');await loadConfig();await refreshAll()}
async function refreshAll(){await Promise.all([renderDashboard(),renderCatalog(),renderAnalysts(),renderAudit(),analyzeData(true),renderMyDayAnalysts(),renderManagementFilters(),refreshNotificationBadge(),renderControlChartEngine()]);if($('#planDate'))await refreshPlanner();if($('#myDayDate'))await renderMyDay()}

let currentSessionUser=null;

function refreshAuthUI(){
  const configured=firebaseBridge.configured;
  const signed=!!firebaseBridge.authUser;
  if($('#localSessionSelect'))$('#localSessionSelect').classList.toggle('hidden',configured);
  if($('#btnFirebaseLogin'))$('#btnFirebaseLogin').classList.toggle('hidden',!configured||signed);
  if($('#btnFirebaseLogout'))$('#btnFirebaseLogout').classList.toggle('hidden',!configured||!signed);
  if($('#firebaseSessionInfo'))$('#firebaseSessionInfo').classList.toggle('hidden',!configured||!signed);
  if($('#firebaseSessionName'))$('#firebaseSessionName').textContent=currentSessionUser?.name||firebaseBridge.authUser?.displayName||'Usuario Firebase';
  if($('#firebaseSessionEmail'))$('#firebaseSessionEmail').textContent=firebaseBridge.authUser?.email||'';
  if($('#authConfigBadge')){
    $('#authConfigBadge').textContent=configured?'FIREBASE':'LOCAL';
    $('#authConfigBadge').className=`sync-config-badge ${configured?'connected':''}`;
  }
  if($('#authModeLabel'))$('#authModeLabel').textContent=configured?'Firebase Authentication':'Sesión local de prueba';
  if($('#authCurrentUser'))$('#authCurrentUser').textContent=firebaseBridge.authUser?.email||'—';
  if($('#authCurrentRole'))$('#authCurrentRole').textContent=currentSessionUser?.role||'—';
  if($('#authAnalystLink'))$('#authAnalystLink').textContent=currentSessionUser?.analystId||'—';
  if($('#authProfileSource'))$('#authProfileSource').textContent=currentSessionUser?.role==='SIN_ROL'?'FALTA users/{UID}':'Firestore users/{UID}';
}
function showAuthGate(message=''){
  const gate=$('#firebaseLoginDialog');if(gate)gate.classList.remove('hidden');
  const status=$('#authGateConnection');if(status&&message)status.textContent=message;
}
function hideAuthGate(){
  const gate=$('#firebaseLoginDialog');if(gate)gate.classList.add('hidden');
  const err=$('#firebaseLoginError');if(err){err.textContent='';err.classList.add('hidden')}
}
function openFirebaseLogin(){
  if(!firebaseBridge.configured){showAuthGate('Firebase no está configurado');return toast('Firebase no está configurado')}
  const err=$('#firebaseLoginError');if(err){err.textContent='';err.classList.add('hidden')}
  const pass=$('#firebaseLoginPassword');if(pass)pass.value='';
  showAuthGate(firebaseBridge.authReady?'Ingrese sus credenciales':'Conectando con Firebase…');
  setTimeout(()=>{const email=$('#firebaseLoginEmail');if(email)email.focus()},50);
}
function friendlyAuthError(err){
  const code=String(err?.code||'');
  if(code.includes('invalid-credential')||code.includes('wrong-password')||code.includes('user-not-found'))return 'Correo o contraseña incorrectos.';
  if(code.includes('too-many-requests'))return 'Demasiados intentos. Espere unos minutos e intente nuevamente.';
  if(code.includes('network-request-failed'))return 'No hay conexión con Firebase.';
  if(code.includes('invalid-email'))return 'El correo electrónico no es válido.';
  return String(err?.message||'No se pudo iniciar sesión.');
}
async function submitFirebaseLogin(e){
  e.preventDefault();

  if(!firebaseBridge.configured||!firebaseBridge.authReady){
    toast('Firebase Authentication todavía no está listo');
    return;
  }

  const form=$('#firebaseLoginForm');
  const emailInput=$('#firebaseLoginEmail');
  const passInput=$('#firebaseLoginPassword');

  // Los IDs anteriores son los campos reales del formulario.
  // FormData queda como respaldo para autofill de Chrome/Safari.
  const fd=form?new FormData(form):null;
  const email=String(
    emailInput?.value ??
    fd?.get('email') ??
    ''
  ).trim();

  const password=String(
    passInput?.value ??
    fd?.get('password') ??
    ''
  );

  console.debug('ERP Auth form', {emailPresent:!!email,passwordPresent:!!password,formFound:!!form});

  if(!email||!password){
    const friendly='Ingrese correo y contraseña';
    toast(friendly);
    const ae=$('#firebaseLoginError');
    if(ae){
      ae.textContent=friendly;
      ae.classList.remove('hidden');
    }
    return;
  }

  const btn=$('#btnFirebaseLoginSubmit');
  if(btn){
    btn.disabled=true;
    btn.textContent='Ingresando…';
  }

  try{
    firebaseBridge.lastError='';
    const ae=$('#firebaseLoginError');
    if(ae){
      ae.classList.add('hidden');
      ae.textContent='';
    }

    const cred=await firebaseBridge.authMods.signInWithEmailAndPassword(
      firebaseBridge.auth,
      email,
      password
    );

    firebaseBridge.authUser=cred.user;

    if(passInput)passInput.value='';
    // onAuthStateChanged continúa el flujo. La pantalla de acceso permanece visible
    // mientras perfil + nube + Outbox terminan de sincronizarse.
    const gateStatus=$('#authGateConnection');
    if(gateStatus){
      gateStatus.textContent='SINCRONIZANDO… cargando perfil y datos';
      gateStatus.classList.add('syncing');
    }
    setSyncState('SINCRONIZANDO','Inicio correcto · descargando información compartida…');

  }catch(err){
    console.error('Firebase login',err);
    firebaseBridge.lastError=String(err?.message||err);

    const code=String(err?.code||'');
    const friendly=
      code.includes('invalid-credential')?'Correo o contraseña incorrectos':
      code.includes('user-not-found')?'Usuario no registrado en Firebase':
      code.includes('wrong-password')?'Contraseña incorrecta':
      code.includes('too-many-requests')?'Demasiados intentos. Espere unos minutos':
      code.includes('network-request-failed')?'No hay conexión con Firebase':
      'No se pudo iniciar sesión: '+(err?.message||'Error desconocido');

    toast(friendly);
    const ae=$('#firebaseLoginError');
    if(ae){
      ae.textContent=friendly;
      ae.classList.remove('hidden');
    }
  }finally{
    if(btn){
      btn.disabled=false;
      btn.textContent='Entrar';
    }
  }
}
async function firebaseLogout(){
  if(!firebaseBridge.authReady)return;
  try{
    // Antes de cerrar, intentar confirmar cualquier cambio local pendiente.
    // Si no hay Internet, el Outbox queda intacto y se reintentará al próximo inicio.
    if(firebaseBridge.ready&&firebaseBridge.authUser){
      try{await flushOutbox(false)}catch(e){console.warn('Cierre con Outbox pendiente',e)}
    }
    stopRealtimeSync();
    await firebaseBridge.authMods.signOut(firebaseBridge.auth);
    showAuthGate('Sesión cerrada · ingrese nuevamente');
    toast('Sesión cerrada');
  }catch(err){toast('No se pudo cerrar la sesión')}
}
async function findERPUserForAuth(authUser){
  if(!authUser)return null;

  // Identidad canónica estricta: users/{Firebase UID}.
  // No hacemos consultas por email porque las reglas de seguridad permiten
  // a un ANALISTA leer únicamente su propio documento users/{uid}.
  if(firebaseBridge.ready){
    const {doc,getDoc}=firebaseBridge.mods;
    const uidSnap=await getDoc(doc(firebaseBridge.db,'users',authUser.uid));
    if(uidSnap.exists()){
      const data=uidSnap.data()||{};
      return {
        id:authUser.uid,
        ...data,
        firebaseUid:authUser.uid,
        email:data.email||authUser.email||''
      };
    }
    return null;
  }

  // Contingencia offline: solo perfil previamente vinculado al MISMO UID.
  const localUsers=await getAll('users');
  return localUsers.find(u=>u.firebaseUid===authUser.uid)||null;
}
async function handleFirebaseAuthState(authUser){
  firebaseBridge.authUser=authUser||null;
  refreshAuthUI();

  if(!authUser){
    stopRealtimeSync();
    currentSessionUser=null;
    applyRoleUI();
    refreshAuthUI();
    const gateStatus=$('#authGateConnection');if(gateStatus)gateStatus.classList.remove('syncing');
    showAuthGate(firebaseBridge.authReady?'Ingrese correo y contraseña':'Conectando con Firebase…');
    return;
  }

  try{
    const gateStatus=$('#authGateConnection');
    if(gateStatus){gateStatus.textContent='SINCRONIZANDO… verificando perfil y datos';gateStatus.classList.add('syncing')}
    setSyncState('SINCRONIZANDO','Verificando perfil y sincronizando datos…');

    // 1. El perfil Firestore users/{UID} manda sobre cualquier dato local.
    let profile=await findERPUserForAuth(authUser);

    if(!profile){
      currentSessionUser={
        id:authUser.uid,
        name:'Perfil ERP pendiente',
        email:authUser.email||'',
        role:'SIN_ROL',
        status:'SIN_PERFIL',
        firebaseUid:authUser.uid
      };
      applyRoleUI();
      refreshAuthUI();
      setSyncState('ERROR','Falta perfil users/{UID}');
      const ae=$('#firebaseLoginError');if(ae){ae.textContent='Su cuenta está autenticada, pero no tiene un perfil ERP habilitado. Contacte al administrador.';ae.classList.remove('hidden')}
      showAuthGate('Perfil ERP no habilitado');
      toast(`Autenticación correcta, pero no existe users/${authUser.uid} en Firestore`);
      return;
    }

    profile={
      ...profile,
      id:profile.id||authUser.uid,
      firebaseUid:authUser.uid,
      email:profile.email||authUser.email||'',
      updatedAt:nowISO()
    };

    // 2. Aplicar rol cloud inmediatamente.
    currentSessionUser=profile;
    await put('users',profile);
    await put('config',{key:'localSessionUser',value:profile.id});
    applyRoleUI();
    refreshAuthUI();

    // 3. Leer el estado global de migración desde Firestore.
    await refreshMigrationUI();

    // 4. Descargar estado compartido desde la nube.
    try{
      await pullFirebaseData(false);
    }catch(syncErr){
      console.warn('Sesión correcta; descarga inicial pendiente',syncErr);
      firebaseBridge.lastError=String(syncErr?.message||syncErr);
    }

    // 5. Resolver vínculo real de analista después de descargar analysts.
    profile=await resolveAnalystLink(profile);
    currentSessionUser=profile;
    await put('users',profile);
    applyRoleUI();
    refreshAuthUI();

    await audit(
      'INICIAR_SESION_FIREBASE',
      'USUARIOS',
      profile.id,
      `${profile.name} · ${profile.role} · ${authUser.email||''}`
    );

    // 6. Navegación según rol cloud.
    if(profile.role==='ANALISTA'){
      if(profile.analystId){
        if($('#myDayAnalyst')){
          $('#myDayAnalyst').value=profile.analystId;
          $('#myDayAnalyst').disabled=true;
        }
        switchView('mi-jornada');
        await renderMyDay();
      }else{
        switchView('mi-jornada');
        toast('Analista autenticado. Falta vincular su registro operativo.');
      }
    }else if(profile.role==='JEFE'){
      if($('#myDayAnalyst'))$('#myDayAnalyst').disabled=false;
      switchView('inicio');
    }else{
      switchView('inicio');
    }

    // 7. Limpiar confirmaciones de lectura heredadas de V1.0.5.6.15 antes de
    // confirmar la Outbox operativa. La campana ya usa un canal silencioso.
    try{await retireLegacyCommentReadOutbox()}catch(e){console.warn('Limpieza de lecturas heredadas',e)}
    // Confirmar pendientes, volver a contrastar con nube y recién después activar live sync.
    // Esto protege el caso: cerrar sesión / cerrar APP / volver horas después.
    try{await flushOutbox(false)}catch(e){console.warn('Outbox pendiente al reanudar sesión',e)}
    try{await pullFirebaseData(false)}catch(e){console.warn('Revisión cloud pendiente al reanudar sesión',e)}
    startRealtimeSync();
    await refreshMigrationUI();

    const gateDone=$('#authGateConnection');
    if(gateDone){gateDone.textContent='SINCRONIZACIÓN COMPLETA · abriendo ERP';gateDone.classList.remove('syncing')}
    setSyncState('SINCRONIZADO','Datos actualizados · sesión lista');
    hideAuthGate();
    toast(`Bienvenido · ${profile.name}`);

  }catch(err){
    console.error('Procesamiento de sesión Firebase',err);
    firebaseBridge.lastError=String(err?.message||err);
    toast(`No se pudo cargar el perfil ERP: ${err?.code||err?.message||'error'}`);
    refreshAuthUI();
  }
}

const ROLE_ACCESS={
  JEFE:['inicio','planificador','mi-jornada','seguimiento-diario','gestion','cartas-control','catalogo','analistas','inteligencia','trazabilidad','configuracion'],
  ANALISTA:['inicio','mi-jornada'],
  SIN_ROL:['inicio']
};
async function ensureLocalUsers(){
  const existing=await getAll('users');
  const analysts=(await getAll('analysts')).filter(a=>a.status==='ACTIVO'&&isOperationalAnalyst(a));
  const desired=[{id:'USR-JEFE',name:'Jefe / Administrador',role:'JEFE',analystId:null,status:'ACTIVO'}]
    .concat(analysts.map(a=>({id:`USR-${a.id}`,name:a.name,role:'ANALISTA',analystId:a.id,status:'ACTIVO'})));
  for(const u of desired){
    const prev=existing.find(x=>x.id===u.id);
    await put('users',{...prev,...u,email:prev?.email||'',firebaseUid:prev?.firebaseUid||null,createdAt:prev?.createdAt||nowISO(),updatedAt:nowISO()});
  }
}
async function loadLocalSession(){
  await ensureLocalUsers();
  if(firebaseBridge.configured){currentSessionUser=null;applyRoleUI();refreshAuthUI();return;}
  const users=(await getAll('users')).filter(u=>u.status==='ACTIVO').sort((a,b)=>(a.role==='JEFE'?-1:1)||a.name.localeCompare(b.name,'es'));
  const saved=(await getOne('config','localSessionUser'))?.value;
  currentSessionUser=users.find(u=>u.id===saved)||users[0]||null;
  const sel=$('#localSessionSelect');
  if(sel){
    sel.innerHTML=users.map(u=>`<option value="${u.id}">${u.role==='JEFE'?'Jefe':'Analista'} · ${escapeHtml(u.name)}</option>`).join('');
    if(currentSessionUser)sel.value=currentSessionUser?.id;
  }
  applyRoleUI();
}
async function changeLocalSession(){
  const u=await getOne('users',$('#localSessionSelect').value);if(!u)return;
  currentSessionUser=u;
  await put('config',{key:'localSessionUser',value:u.id});
  await audit('CAMBIAR_SESION_LOCAL','USUARIOS',u.id,`${u.name} · ${u.role}`);
  applyRoleUI();
  if(u.role==='ANALISTA'){
    if($('#myDayAnalyst')){$('#myDayAnalyst').value=u.analystId;$('#myDayAnalyst').disabled=true}
    switchView('mi-jornada');
    await renderMyDay();
  }else{
    if($('#myDayAnalyst'))$('#myDayAnalyst').disabled=false;
    switchView('inicio');
  }
  toast(`Sesión: ${u.name}`);
}
function canAccessView(view){return !!currentSessionUser&&(ROLE_ACCESS[currentSessionUser?.role]||[]).includes(view)}
function applyRoleUI(){
  const role=currentSessionUser?.role||'SIN_ROL';
  const allowed=ROLE_ACCESS[role]||[];
  $$('.nav-item').forEach(b=>b.classList.toggle('role-hidden',!allowed.includes(b.dataset.view)));
  if($('#sessionRoleBadge')){$('#sessionRoleBadge').textContent=role;$('#sessionRoleBadge').className=`role-badge role-${role.toLowerCase()}`}
  if($('#btnBackup'))$('#btnBackup').classList.toggle('hidden',role!=='JEFE');if($('#btnNotifications'))$('#btnNotifications').classList.toggle('hidden',!currentSessionUser);
  if($('#myDayAnalyst')){
    if(role==='ANALISTA'){ $('#myDayAnalyst').value=currentSessionUser?.analystId||'';$('#myDayAnalyst').disabled=true }
    else $('#myDayAnalyst').disabled=false;
  }
}

function switchView(view){
  if(!canAccessView(view)){
    toast('Este módulo no está habilitado para su rol');
    view=currentSessionUser?.role==='ANALISTA'?'mi-jornada':'inicio';
  }$$('.view').forEach(x=>x.classList.remove('active'));$(`#view-${view}`).classList.add('active');$$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===view));const meta={inicio:['Inicio','Catálogo y planificación trabajando sobre una sola base'],planificador:['Planificador Inteligente','Asignación basada en catálogo, competencias, carga y horario'],'mi-jornada':['Mi Jornada','Vista diaria del analista, instrucciones, desglose y comentarios'],catalogo:['Catálogo Maestro','Secciones independientes, una sola fuente de verdad'],analistas:['Analistas','Personas, jornada y competencias'],inteligencia:['Control inteligente','Validaciones antes de planificar'],trazabilidad:['Trazabilidad','Historial local de cambios y parametrización'],'seguimiento-diario':['Seguimiento Diario','Vista ejecutiva del trabajo diario por analista'],gestion:['Dashboard Gestión','Actividades realizadas, cumplimiento, Excel y edición controlada'],'cartas-control':['Cartas de Control','Tendencias, Westgard, cumplimiento e IA para Calidad'],configuracion:['Configuración','Parámetros generales del núcleo']}[view];$('#pageTitle').textContent=meta[0];$('#pageSubtitle').textContent=meta[1];const b=$('#btnContextNew');b.classList.toggle('hidden',currentSessionUser?.role!=='JEFE'||!['catalogo','analistas'].includes(view));b.textContent=view==='catalogo'?'+ Nuevo elemento':'+ Nuevo analista';b.onclick=view==='catalogo'?openCatalog:openAnalyst;if(view==='inteligencia')analyzeData(true);if(view==='planificador')refreshPlanner();if(view==='mi-jornada'){renderMyDayAnalysts().then(()=>{if(currentSessionUser?.role==='ANALISTA'){$('#myDayAnalyst').value=currentSessionUser?.analystId||'';$('#myDayAnalyst').disabled=true}renderMyDay()})}if(view==='seguimiento-diario')renderDailyMonitor();if(view==='gestion')renderManagementDashboard();if(view==='cartas-control')renderControlChartsManagement()}
async function refreshPlanner(){
  await renderPlanSelectors();
  await renderDailyLoad();
  await renderAgenda();
  await renderExecutivePlanner();
  await renderMandatoryPlanningAlerts();
}

async function init(){db=await openDB();
    await purgeDeletedPlanningLocally();
  firebaseBridge.lastSyncAt=(await getOne('config','lastCloudSyncAt'))?.value||null;if($('#planDate'))$('#planDate').value=dateToday();if($('#myDayDate'))$('#myDayDate').value=dateToday();renderSectionTabs();setCatalogSectionOptions();renderCompetencyChecks([]);$$('.nav-item').forEach(b=>b.onclick=()=>switchView(b.dataset.view));$$('[data-close]').forEach(b=>b.onclick=()=>document.getElementById(b.dataset.close).close());$('#catalogForm').addEventListener('submit',saveCatalog);$('#reassignPlanForm').addEventListener('submit',saveReassignPlan);$('#analystForm').addEventListener('submit',saveAnalyst);$('#catalogSection').addEventListener('change',updateCatalogForm);$('#catalogTimeMode').addEventListener('change',updateCatalogForm);$('#catalogName').addEventListener('input',()=>{if($('#catalogSection').value==='ACTIVIDADES_LABORATORIO'&&activityLooksLikeCalibration($('#catalogName').value)&&!$('#catalogId').value){$('#catalogRequiresCalibration').checked=true;updateCalibrationEditor()}});$('#catalogRequiresCalibration').addEventListener('change',updateCalibrationEditor);$('#calibrationUnit').addEventListener('input',validateCalibrationConfig);$('#calibrationReplicates').addEventListener('input',validateCalibrationConfig);if($('#btnAddCalibrationPoint'))$('#btnAddCalibrationPoint').onclick=addCalibrationPoint;if($('#catalogUsesReagents'))$('#catalogUsesReagents').addEventListener('change',updateReagentEditor);if($('#btnAddReagent'))$('#btnAddReagent').onclick=addReagent;$('#catalogBaseHours').addEventListener('input',()=>{if($('#catalogTimeMode').value==='COMPOSITE')validateSteps()});$('#catalogBaseMinutePart').addEventListener('change',()=>{if($('#catalogTimeMode').value==='COMPOSITE')validateSteps()});if($('#btnAddRule'))$('#btnAddRule').onclick=addRule;if($('#btnAddStep'))$('#btnAddStep').onclick=addStep;$('#catalogSearch').addEventListener('input',renderCatalog);$('#catalogStatusFilter').addEventListener('change',renderCatalog);$('#analystSearch').addEventListener('input',renderAnalysts);if($('#btnAnalyze'))$('#btnAnalyze').onclick=()=>analyzeData(true);if($('#planSection')){$('#planSection').addEventListener('change',async()=>{if($('#planActivitySearch'))$('#planActivitySearch').value='';await renderAnalystOptions();await renderPlanSelectors();await smartPlannerRecalculate()});$('#planCatalog').addEventListener('change',smartPlannerRecalculate);
$('#planActivitySearch').addEventListener('input',renderPlanSelectors);
if($('#btnAddActivityFromPlanner'))$('#btnAddActivityFromPlanner').onclick=openCatalogFromPlanner;$('#planSamples').addEventListener('input',smartPlannerRecalculate);$('#planStart').addEventListener('input',updatePlanPreview);$('#planDate').addEventListener('change',async()=>{await smartPlannerRecalculate();await renderExecutivePlanner();await renderMandatoryPlanningAlerts();if($('#bossAIResults')){$('#bossAIResults').classList.add('hidden');$('#bossAIEmpty').classList.remove('hidden')}});$('#agendaStatus').addEventListener('change',renderAgenda);if($('#btnSuggestAnalyst'))$('#btnSuggestAnalyst').onclick=suggestAnalyst;if($('#btnOptimizeDay'))$('#btnOptimizeDay').onclick=analyzeBossDay;if($('#btnSavePlan'))$('#btnSavePlan').onclick=savePlan;$('#planAnalyst').addEventListener('change',autoScheduleSelectedAnalyst);}if($('#myDayDate')){$('#myDayDate').addEventListener('change',renderMyDay);if($('#btnMyDayToday'))$('#btnMyDayToday').onclick=()=>{$('#myDayDate').value=dateToday();renderMyDay()};$('#myDayAnalyst').addEventListener('change',renderMyDay);if($('#btnRestoreBossPlan'))$('#btnRestoreBossPlan').onclick=()=>restoreBossSchedule($('#myDayDate').value,$('#myDayAnalyst').value);}if($('#dailyMonitorDate')){
  $('#dailyMonitorDate').value=dateToday();
  $('#dailyMonitorDate').addEventListener('change',renderDailyMonitor);
  if($('#btnDailyToday'))$('#btnDailyToday').onclick=()=>{$('#dailyMonitorDate').value=dateToday();renderDailyMonitor()};
  if($('#btnRefreshDailyMonitor'))$('#btnRefreshDailyMonitor').onclick=renderDailyMonitor;
}
if($('#mgmtFrom')){
  $('#mgmtFrom').value=monthStartISO();
  $('#mgmtTo').value=dateToday();
  $('#mgmtFrom').addEventListener('change',renderManagementDashboard);
  $('#mgmtTo').addEventListener('change',renderManagementDashboard);
  $('#mgmtAnalyst').addEventListener('change',renderManagementDashboard);
  $('#mgmtStatus').addEventListener('change',renderManagementDashboard);
  if($('#btnMgmtToday'))$('#btnMgmtToday').onclick=()=>{$('#mgmtFrom').value=dateToday();$('#mgmtTo').value=dateToday();renderManagementDashboard()};
  if($('#btnManagementAI'))$('#btnManagementAI').onclick=analyzeManagementAI;
  if($('#btnExportReagentExcel'))$('#btnExportReagentExcel').onclick=exportReagentConsumptionExcel;
  if($('#btnExportManagementExcel'))$('#btnExportManagementExcel').onclick=exportManagementExcel;
  $('#planningEditForm').addEventListener('submit',savePlanningEdit);
  $('#editPlanStart').addEventListener('input',previewPlanningEdit);
}
if($('#finishActivityForm'))$('#finishActivityForm').addEventListener('submit',submitFinishActivity);if($('#btnSaveCalibrationDraft'))$('#btnSaveCalibrationDraft').onclick=saveCalibrationDraft;if($('#btnSaveReagentDraft'))$('#btnSaveReagentDraft').onclick=saveReagentDraft;if($('#btnUnlockTechnicalEdit'))$('#btnUnlockTechnicalEdit').onclick=unlockCompletedTechnicalEdit;
if($('#microFreezerTemp'))$('#microFreezerTemp').addEventListener('input',previewMicroFreezer);if($('#microFreezerControlForm'))$('#microFreezerControlForm').addEventListener('submit',saveMicroFreezerControl);if($('#btnSaveMicroFreezerConfig'))$('#btnSaveMicroFreezerConfig').onclick=saveMicroFreezerConfig;if($('#incMicroTemp'))$('#incMicroTemp').addEventListener('input',previewIncMicro);if($('#incMicroControlForm'))$('#incMicroControlForm').addEventListener('submit',saveIncMicroControl);if($('#btnSaveIncMicroConfig'))$('#btnSaveIncMicroConfig').onclick=saveIncMicroConfig;if($('#microIncTemp'))$('#microIncTemp').addEventListener('input',previewMicroIncubator);if($('#microIncControlForm'))$('#microIncControlForm').addEventListener('submit',saveMicroIncubatorControl);if($('#btnSaveMicroIncConfig'))$('#btnSaveMicroIncConfig').onclick=saveMicroIncConfig;if($('#microEnvTempRaw'))['microEnvTempRaw','microEnvHumRaw'].forEach(id=>$('#'+id).addEventListener('input',previewMicroEnv));if($('#microEnvControlForm'))$('#microEnvControlForm').addEventListener('submit',saveMicroEnvControl);if($('#btnSaveMicroEnvConfig'))$('#btnSaveMicroEnvConfig').onclick=saveMicroEnvConfig;if($('#btnRefreshControlCharts'))$('#btnRefreshControlCharts').onclick=renderControlChartsManagement;if($('#ccChartSelect'))$('#ccChartSelect').addEventListener('change',renderControlChartsManagement);if($('#ccMonth'))$('#ccMonth').addEventListener('change',()=>{updateHistoricalButton();renderControlChartsManagement()});if($('#btnCcHistorical'))$('#btnCcHistorical').onclick=openHistoricalLoader;if($('#btnSaveHistoricalMonth'))$('#btnSaveHistoricalMonth').onclick=saveHistoricalMonth;if($('#btnCcCurrentMonth'))$('#btnCcCurrentMonth').onclick=()=>{$('#ccMonth').value=ccMonthNow();renderControlChartsManagement()};if($('#balanceEnvTempRaw'))['balanceEnvTempRaw','balanceEnvHumRaw'].forEach(id=>$('#'+id).addEventListener('input',previewBalanceEnv));if($('#balanceEnvControlForm'))$('#balanceEnvControlForm').addEventListener('submit',saveBalanceEnvControl);if($('#btnSaveBalanceEnvConfig'))$('#btnSaveBalanceEnvConfig').onclick=saveBalanceEnvConfig;if($('#metalsTempRaw'))['metalsTempRaw','metalsHumRaw'].forEach(id=>$('#'+id).addEventListener('input',previewMetals));if($('#metalsControlForm'))$('#metalsControlForm').addEventListener('submit',saveMetalsControl);if($('#btnSaveMetalsConfig'))$('#btnSaveMetalsConfig').onclick=saveMetalsConfig;if($('#oven314TempRaw'))$('#oven314TempRaw').addEventListener('input',previewOven314);if($('#oven314ControlForm'))$('#oven314ControlForm').addEventListener('submit',saveOven314Control);if($('#btnSaveOven314Config'))$('#btnSaveOven314Config').onclick=saveOven314Config;if($('#tpTempRaw'))$('#tpTempRaw').addEventListener('input',previewThermalPoint);if($('#thermalPointControlForm'))$('#thermalPointControlForm').addEventListener('submit',saveThermalPointControl);if($('#digTempRaw'))$('#digTempRaw').addEventListener('input',previewDigestor);if($('#digestorControlForm'))$('#digestorControlForm').addEventListener('submit',saveDigestorControl);if($('#btnSaveDigConfig'))$('#btnSaveDigConfig').onclick=saveDigestorConfig;if($('#fridge344TempRaw'))$('#fridge344TempRaw').addEventListener('input',previewFridge344);if($('#fridge344ControlForm'))$('#fridge344ControlForm').addEventListener('submit',saveFridge344Control);if($('#btnSaveFridge344Config'))$('#btnSaveFridge344Config').onclick=saveFridge344Config;if($('#fridgeTempRaw'))$('#fridgeTempRaw').addEventListener('input',previewFridge);if($('#fridgeControlForm'))$('#fridgeControlForm').addEventListener('submit',saveFridgeControl);if($('#btnSaveFridgeConfig'))$('#btnSaveFridgeConfig').onclick=saveFridgeConfig;if($('#balRead1'))['balRead1','balRead100'].forEach(id=>$('#'+id).addEventListener('input',previewBalance));if($('#balanceControlForm'))$('#balanceControlForm').addEventListener('submit',saveBalanceControl);if($('#distReading'))$('#distReading').addEventListener('input',previewDistiller);if($('#distillerControlForm'))$('#distillerControlForm').addEventListener('submit',saveDistillerControl);if($('#incTempRaw'))$('#incTempRaw').addEventListener('input',previewIncubator);if($('#incubatorControlForm'))$('#incubatorControlForm').addEventListener('submit',saveIncubatorControl);if($('#btnSaveIncConfig'))$('#btnSaveIncConfig').onclick=saveIncubatorConfig;if($('#phRead4'))['4','7','10'].forEach(x=>$('#phRead'+x).addEventListener('input',previewPH));if($('#condRead84'))['84','1413','1288'].forEach(x=>$('#condRead'+x).addEventListener('input',previewConductivity));if($('#conductivityControlForm'))$('#conductivityControlForm').addEventListener('submit',saveConductivityControl);if($('#phControlForm'))$('#phControlForm').addEventListener('submit',savePHControl);if($('#dbo5TempRaw'))$('#dbo5TempRaw').addEventListener('input',previewDBO5);if($('#dbo5HumRaw'))$('#dbo5HumRaw').addEventListener('input',previewDBO5);if($('#dbo5ControlForm'))$('#dbo5ControlForm').addEventListener('submit',saveDBO5Control);if($('#btnSaveConfig'))$('#btnSaveConfig').onclick=saveConfig;if($('#btnNewControlChart'))$('#btnNewControlChart').onclick=()=>openControlChartDef();if($('#chartDefLinkMode'))$('#chartDefLinkMode').addEventListener('change',()=>updateChartLinkMode());if($('#chartDefSection'))$('#chartDefSection').addEventListener('change',()=>refreshChartMethodOptions(''));if($('#chartDefMethodSelect'))$('#chartDefMethodSelect').addEventListener('change',()=>{const sel=$('#chartDefMethodSelect'),custom=$('#chartDefMethod'),opt=sel.options[sel.selectedIndex];if(sel.value==='CUSTOM'){custom.value='';custom.closest('label').classList.remove('hidden');custom.focus()}else{custom.value=opt?.dataset?.name||'';custom.closest('label').classList.add('hidden')}});if($('#controlChartDefForm'))$('#controlChartDefForm').addEventListener('submit',saveControlChartDef);if($('#btnBackup'))$('#btnBackup').onclick=backup;if($('#btnReset'))$('#btnReset').onclick=resetDB;if($('#localSessionSelect'))$('#localSessionSelect').addEventListener('change',changeLocalSession);if($('#btnFirebaseLogin'))$('#btnFirebaseLogin').onclick=openFirebaseLogin;
if($('#btnFirebaseLogout'))$('#btnFirebaseLogout').onclick=firebaseLogout;if($('#btnNotifications'))$('#btnNotifications').onclick=async()=>{const p=await ensureSystemNotificationPermission(true);if(p==='granted')toast('Avisos del sistema activados · llegarán al completar todas las cartas');else if(p==='denied')toast('Notificaciones bloqueadas en el navegador/sistema');await openCommunications();};if($('#commStatusFilter'))$('#commStatusFilter').onchange=renderCommunications;if($('#commTypeFilter'))$('#commTypeFilter').onchange=renderCommunications;if($('#commSearch'))$('#commSearch').oninput=()=>{clearTimeout(window.__commSearchTimer);window.__commSearchTimer=setTimeout(renderCommunications,180)};if($('#btnRefreshCommunications'))$('#btnRefreshCommunications').onclick=renderCommunications;
if($('#firebaseLoginForm')){
  $('#firebaseLoginForm').addEventListener('submit',submitFirebaseLogin);
}if($('#btnSyncNow'))$('#btnSyncNow').onclick=manualSync;
if($('#btnSyncConfigNow'))$('#btnSyncConfigNow').onclick=manualSync;
if($('#btnPullFirebase'))$('#btnPullFirebase').onclick=()=>pullFirebaseData(true);
if($('#btnInitialMigration'))$('#btnInitialMigration').onclick=initialControlledMigration;
await loadConfig();await refreshAll();
  await refreshSyncUI();
  firebaseBridge.configured=firebaseConfigValid();
  if(firebaseBridge.configured){
    currentSessionUser=null;
    applyRoleUI();
    showAuthGate('Conectando con Firebase…');
    await initFirebaseBridge();
  }else{
    await loadLocalSession();
    hideAuthGate();
  }
if($('#myDayDate'))$('#myDayDate').value=dateToday();
if($('#planDate')&&!$('#planDate').value)$('#planDate').value=dateToday();
if(!firebaseBridge.configured)switchView(currentSessionUser?.role==='ANALISTA'?'mi-jornada':'inicio');
}
init().catch(e=>{console.error(e);alert('No se pudo iniciar la base local: '+e.message)});

let cloudResumeBusy=false;
let lastCloudResumeAt=0;
async function resumeCloudSession(force=false){
  if(cloudResumeBusy||!firebaseBridge.ready||!firebaseBridge.authUser)return;
  const now=Date.now();
  if(!force&&now-lastCloudResumeAt<60000){scheduleOutboxFlush(80);return}
  cloudResumeBusy=true;
  lastCloudResumeAt=now;
  try{
    await flushOutbox(false);
    await pullFirebaseData(false);
    startRealtimeSync();
  }catch(e){
    console.warn('Reanudación de sincronización',e);
  }finally{
    cloudResumeBusy=false;
    await refreshSyncUI();
  }
}
window.addEventListener('online',()=>{if(firebaseBridge.ready)reconcileAfterResume(true);else initFirebaseBridge()});
window.addEventListener('pageshow',()=>{if(firebaseBridge.ready&&firebaseBridge.authUser)reconcileAfterResume(false)});
window.addEventListener('focus',()=>{if(firebaseBridge.ready&&firebaseBridge.authUser)reconcileAfterResume(false)});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&firebaseBridge.ready&&firebaseBridge.authUser)reconcileAfterResume(false)});
// 10.8 · Heartbeat de transporte únicamente. Antes repintaba la vista cada 15 s y podía
// cerrar el selector/reiniciar el formulario aunque no existiera ninguna acción del usuario.
setInterval(()=>{if(firebaseBridge.ready&&firebaseBridge.authUser){scheduleOutboxFlush(200);refreshSyncUI().catch(()=>{});}},15000);
// 10.7 · watchdog visual de ACK. No escribe ni consulta Firestore: solo compara
// el estado real de Outbox con el indicador. Corrige estados visuales obsoletos.
setInterval(()=>{
  if(firebaseBridge.ready&&firebaseBridge.authUser&&!firebaseBridge.busy){
    refreshSyncUI().catch(e=>console.warn('Watchdog de sincronización',e));
  }
},2500);
window.addEventListener('offline',()=>setSyncState('LOCAL','Sin conexión · cambios protegidos localmente'));
if('serviceWorker' in navigator){navigator.serviceWorker.addEventListener('message',async event=>{if(event.data?.type==='OPEN_COMMUNICATIONS'){try{window.focus();await openCommunications()}catch(e){console.warn('Abrir comunicaciones desde notificación',e)}}});}
