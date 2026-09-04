const APP_VERSION='V1.0.5.6.6-HORARIO-SECUENCIAL-INTELIGENTE';
const DB_NAME='ERP_PLANIFICACION_NEXTGEN_CLEAN';
const DB_VERSION=7;
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
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=e=>{const d=e.target.result;if(!d.objectStoreNames.contains('catalog')){const s=d.createObjectStore('catalog',{keyPath:'id'});s.createIndex('section','section');s.createIndex('status','status')}if(!d.objectStoreNames.contains('timeRules')){const s=d.createObjectStore('timeRules',{keyPath:'id'});s.createIndex('catalogId','catalogId')}if(!d.objectStoreNames.contains('compositeSteps')){const s=d.createObjectStore('compositeSteps',{keyPath:'id'});s.createIndex('catalogId','catalogId')}if(!d.objectStoreNames.contains('analysts')){const s=d.createObjectStore('analysts',{keyPath:'id'});s.createIndex('status','status')}if(!d.objectStoreNames.contains('audit')){const s=d.createObjectStore('audit',{keyPath:'id'});s.createIndex('createdAt','createdAt')}if(!d.objectStoreNames.contains('outbox'))d.createObjectStore('outbox',{keyPath:'id'});if(!d.objectStoreNames.contains('config'))d.createObjectStore('config',{keyPath:'key'});if(!d.objectStoreNames.contains('planning')){const s=d.createObjectStore('planning',{keyPath:'id'});s.createIndex('date','date');s.createIndex('analystId','analystId');s.createIndex('status','status')}if(!d.objectStoreNames.contains('planComments')){const s=d.createObjectStore('planComments',{keyPath:'id'});s.createIndex('planId','planId');s.createIndex('analystId','analystId');s.createIndex('createdAt','createdAt')}if(!d.objectStoreNames.contains('dailySamples')){const s=d.createObjectStore('dailySamples',{keyPath:'id'});s.createIndex('date','date');s.createIndex('section','section');s.createIndex('status','status')}if(!d.objectStoreNames.contains('users')){const s=d.createObjectStore('users',{keyPath:'id'});s.createIndex('role','role');s.createIndex('analystId','analystId');s.createIndex('status','status')}};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
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
  await put('outbox',{
    id:uid('OUT'),createdAt:nowISO(),type,entity,payload,recordId,
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

const FIREBASE_SYNC_STORES=['catalog','timeRules','compositeSteps','analysts','planning','planComments'];
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
  refreshSyncUI();
}
async function refreshSyncUI(){
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
  // No permitir que un snapshot remoto pinte SINCRONIZADO si todavía hay cambios locales abiertos.
  if(firebaseBridge.ready&&firebaseBridge.authUser&&!firebaseBridge.busy){
    if(errors.length)setSyncStateVisualOnly('ERROR',`${errors.length} cambio(s) con error`);
    else if(pending.length)setSyncStateVisualOnly('PENDIENTE',`${pending.length} cambio(s) por confirmar`);
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
    firebaseBridge.auth=authMod.getAuth(app);
    firebaseBridge.mods=fsMod;
    firebaseBridge.authMods=authMod;
    firebaseBridge.ready=true;
    firebaseBridge.authReady=true;
    firebaseBridge.lastError=null;
    authMod.setPersistence(firebaseBridge.auth,authMod.browserLocalPersistence).catch(()=>{});
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
async function pullFirebaseStore(storeName){
  if(!firebaseBridge.ready||!FIREBASE_SYNC_STORES.includes(storeName))return 0;
  const {collection,getDocs}=firebaseBridge.mods;
  const snap=await getDocs(collection(firebaseBridge.db,storeName));
  let count=0;
  for(const d of snap.docs){
    await applyCloudRecord(storeName,d.id,d.data());
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
        const payload=sanitizeCloudObject({...row,_cloudUpdatedAt:nowISO()});
        batch.set(doc(firebaseBridge.db,storeName,row.id),payload,{merge:true});
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

        const payload=sanitizeCloudObject(item.payload||{});
        const id=payload.id||item.recordId||item.id;
        const ref=doc(firebaseBridge.db,item.entity,id);

        if(item.type==='DELETE'){
          await deleteDoc(ref);
          const check=await getDoc(ref);
          if(check.exists())throw new Error('Firestore no confirmó la eliminación');
        }else{
          const cloudStamp=nowISO();
          await setDoc(ref,{...payload,_cloudUpdatedAt:cloudStamp},{merge:true});
          const check=await getDoc(ref);
          if(!check.exists())throw new Error('Firestore no confirmó la escritura');
          const cloud=check.data()||{};
          // Confirmar identidad y la revisión funcional del registro.
          if(payload.id&&cloud.id&&String(payload.id)!==String(cloud.id)){
            throw new Error('Firestore devolvió un registro diferente');
          }
          if(payload.updatedAt&&cloud.updatedAt&&String(cloud.updatedAt)!==String(payload.updatedAt)){
            throw new Error('La revisión confirmada en Firestore no coincide');
          }
        }

        item.status='SINCRONIZADO';
        item.syncedAt=nowISO();
        item.lastError=null;
        item.attempts=Number(item.attempts||0)+1;
        await put('outbox',item);
        sent++;
      }catch(err){
        item.status='ERROR';
        item.attempts=Number(item.attempts||0)+1;
        item.lastError=String(err?.message||err);
        await put('outbox',item);
        failed++;
        // No abortar el lote completo: continuar con otros registros.
        console.error('Outbox item falló',item.entity,item.recordId||item.payload?.id,err);
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
  const clean={...data,id:data.id||id};delete clean._cloudUpdatedAt;
  // Si este equipo ya eliminó una planificación, una lectura atrasada de Firestore
  // no puede resucitarla mientras se confirma el DELETE remoto.
  if(storeName==='planning' && await isPlanningDeleted(clean.id)){
    await del('planning',clean.id);
    return;
  }
  const local=await getOne(storeName,clean.id);
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
    const unsub=onSnapshot(collection(firebaseBridge.db,storeName),async snap=>{
      let changed=false;
      for(const ch of snap.docChanges()){
        if(ch.type==='removed'){
          const pending=(await getAll('outbox')).some(x=>
            x.entity===storeName &&
            (x.payload?.id||x.id)===ch.doc.id &&
            (x.status==='PENDIENTE'||x.status==='ERROR')
          );
          if(!pending)await del(storeName,ch.doc.id);
          changed=true;
          continue;
        }
        await applyCloudRecord(storeName,ch.doc.id,ch.doc.data());changed=true;
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
        const active=document.querySelector('.nav-item.active')?.dataset.view;
        if(active==='mi-jornada')await renderMyDay();
        else if(active==='planificador')await refreshPlanner();
        else if(active==='gestion')await renderManagementDashboard();
      }
    },err=>{
      firebaseBridge.lastError=String(err?.message||err);setSyncState('ERROR','Escucha en tiempo real interrumpida');
    });
    firebaseBridge.unsubs.push(unsub);
  });
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
async function savePlan(){
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
async function planComments(planId){return (await getAll('planComments')).filter(c=>c.planId===planId).sort((a,b)=>a.createdAt.localeCompare(b.createdAt))}
async function addAnalystComment(planId){
  const input=document.querySelector(`[data-comment-input="${planId}"]`),text=(input?.value||'').trim();if(!text)return toast('Escriba un comentario');
  const p=await getOne('planning',planId);if(!p)return toast('Planificación no encontrada');
  const rec={id:uid('COM'),planId,analystId:p.analystId,analystName:p.analystName,authorType:'ANALISTA',authorName:p.analystName,text,createdAt:nowISO()};
  await put('planComments',rec);await queue('CREATE','planComments',rec);await audit('COMENTAR','MI JORNADA',p.code,`${p.analystName}: ${text}`);input.value='';toast('Comentario registrado');await renderMyDay();await renderAgenda();await renderAudit();
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
  if(p.status==='REALIZADO')return toast('La actividad ya está finalizada');
  p=await hydratePlanTechnicalRequirements(p);
  p.status='EN PROCESO';p.actualStartedAt=p.actualStartedAt||nowISO();p.updatedAt=nowISO();
  await put('planning',p);await queue('UPDATE','planning',p);
  await audit('INICIAR_ACTIVIDAD','MI JORNADA',p.code,`${p.analystName} inició ${p.catalogName} a las ${formatActualStamp(p.actualStartedAt)}`);
  toast(`Actividad iniciada · ${formatActualStamp(p.actualStartedAt)}`);
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
  $('#finishCalibrationUnit').textContent=`Concentración en ${unit||'unidad configurada'} · ingrese 3 absorbancias por punto.`;
  const old=existingCalibrationReadings(p);
  $('#finishCalibrationRows').innerHTML=p.calibrationConfig.points.map((pt,i)=>{
    const rr=old[i]?.readings||[];
    return `<tr>
      <td>P${i+1}</td><td><b>${pt.concentration}</b> ${escapeHtml(unit)}</td>
      ${[0,1,2].map(j=>`<td><input type="number" step="any" inputmode="decimal" data-cal-reading="${i}-${j}" value="${rr[j]??''}" placeholder="0.000"></td>`).join('')}
      <td data-cal-mean="${i}">—</td><td data-cal-cv="${i}">—</td>
    </tr>`;
  }).join('');
  $$('[data-cal-reading]').forEach(el=>el.addEventListener('input',updateCalibrationCalculations));
  updateCalibrationCalculations();
}
function collectCalibrationResult(p,requireComplete=true){
  if(!planRequiresCalibration(p))return {ok:true,result:null};
  const points=[];
  for(let i=0;i<p.calibrationConfig.points.length;i++){
    const readings=[];
    for(let j=0;j<3;j++){
      const raw=$(`[data-cal-reading="${i}-${j}"]`)?.value;
      if(raw===''||raw===undefined){if(requireComplete)return {ok:false,text:`Complete las 3 absorbancias del punto P${i+1}.`};else continue}
      const n=Number(String(raw).replace(',','.'));
      if(!Number.isFinite(n))return {ok:false,text:`La absorbancia P${i+1}.${j+1} no es válida.`};
      readings.push(n);
    }
    if(readings.length===3){
      const avg=mean(readings),sd=sampleSd(readings),cv=avg===0?null:Math.abs(sd/avg*100);
      points.push({order:i+1,concentration:Number(p.calibrationConfig.points[i].concentration),readings,mean:avg,sd,cv});
    }else{
      points.push({order:i+1,concentration:Number(p.calibrationConfig.points[i].concentration),readings});
    }
  }
  const complete=points.every(x=>x.readings.length===3);
  const reg=complete?linearRegression(points.map(x=>({x:x.concentration,y:x.mean}))):null;
  return {ok:true,result:{unit:p.calibrationConfig.unit||'',replicates:3,points,regression:reg,completed:complete,capturedAt:nowISO()}};
}
function updateCalibrationCalculations(){
  const planId=$('#finishActivityPlanId')?.value;if(!planId)return;
  getOne('planning',planId).then(p=>{
    if(!p||!planRequiresCalibration(p))return;
    for(let i=0;i<p.calibrationConfig.points.length;i++){
      const vals=[0,1,2].map(j=>Number($(`[data-cal-reading="${i}-${j}"]`)?.value)).filter(Number.isFinite);
      const m=$(`[data-cal-mean="${i}"]`),cv=$(`[data-cal-cv="${i}"]`);
      if(vals.length===3){
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
  toast('Lecturas de curva guardadas');
}


function reagentContainerCycleKey(reagent,container){return `${normalizeIdentityText(reagent?.name||'')}|${normalizeIdentityText(reagent?.unit||'')}|${container?.id||normalizeIdentityText(container?.label||'ENVASE')}`}
async function latestConfirmedContainerRecord(reagent,container,excludePlanId=null){
  const key=reagentContainerCycleKey(reagent,container),plans=await getAll('planning');let best=null;
  for(const p of plans){if(p.id===excludePlanId||p.status!=='REALIZADO'||!p.reagentResult?.items?.length)continue;for(const item of p.reagentResult.items){if(item.mode!=='WEIGHT'||!Array.isArray(item.containers))continue;for(const env of item.containers){if(reagentContainerCycleKey({name:item.name,unit:item.unit},env)!==key)continue;const stamp=Date.parse(p.actualFinishedAt||p.updatedAt||p.createdAt||0)||0;if(!best||stamp>best.stamp)best={plan:p,item,container:env,stamp}}}}return best;
}
async function resolveContainerCurrentWeight(plan,reagent,container){
  const latest=await latestConfirmedContainerRecord(reagent,container,plan.id);
  if(latest){const f=Number(latest.container.finalWeight);if(Number.isFinite(f)){const dep=latest.container.depleted===true||f<=Number(latest.container.tareWeight)+0.000001;return dep?{weight:null,source:'AGOTADO',depleted:true}:{weight:f,source:'HISTORICO',depleted:false}}}
  const configured=Number(container.initialWeight);return Number.isFinite(configured)?{weight:configured,source:'CATALOGO',depleted:false}:null;
}
function reagentCycleKey(r){
  return `${normalizeIdentityText(r?.name||'')}|${normalizeIdentityText(r?.unit||'')}`;
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
  for(let i=0;i<p.reagentConfig.length;i++){
    const r=p.reagentConfig[i],old=oldMap.get(r.id)||{};
    if(r.mode==='WEIGHT'){
      const containers=Array.isArray(r.containers)&&r.containers.length?r.containers:[{id:'LEGACY',label:'Envase 1',containerType:'FRASCO',tareWeight:r.tareWeight,initialWeight:r.initialWeight}];
      const oldContainers=new Map((old.containers||[]).map(e=>[e.containerId||e.id,e]));
      const envCards=[];
      for(let j=0;j<containers.length;j++){
        const env=containers[j],oldEnv=oldContainers.get(env.id)||{},current=await resolveContainerCurrentWeight(p,r,env);
        const initial=Number.isFinite(Number(oldEnv.initialWeight))?Number(oldEnv.initialWeight):(current?.weight??null),checked=oldEnv.usedInActivity===true;
        envCards.push(`<div class="reagent-container-use ${current?.depleted?'depleted':''}">
          <div class="container-use-head"><label class="container-use-check"><input type="checkbox" data-use-container="${r.id}|${env.id}" ${checked?'checked':''}> Usar en esta actividad</label><span class="badge">${escapeHtml(env.containerType||'FRASCO')} · ${escapeHtml(env.label||`Envase ${j+1}`)}</span></div>
          ${current?.depleted?`<div class="reagent-replacement-alert"><b>Envase agotado</b><span>Ingrese el peso inicial del nuevo ${env.containerType==='SOBRE'?'sobre':'frasco'}.</span></div>`:''}
          <div class="reagent-inputs">
            ${current?.depleted?`<label>Nuevo peso inicial (g)<input type="number" step="any" min="${Number(env.tareWeight||0)}" data-env-new-initial="${r.id}|${env.id}"></label><input type="hidden" data-env-initial="${r.id}|${env.id}" data-env-source="REPOSICION" value="">`:`<label>Peso inicial (g)<div class="reag-initial-control"><input readonly data-env-initial="${r.id}|${env.id}" data-env-source="${current?.source||'CATALOGO'}" value="${initial??''}"><button type="button" class="btn secondary mini-btn" data-correct-env-initial="${r.id}|${env.id}">Corregir</button></div></label>`}
            <label>Peso final (g)<input type="number" step="any" min="0" data-env-final="${r.id}|${env.id}" value="${oldEnv.finalWeight??''}" ${checked?'':'disabled'}></label>
            <label>Consumo calculado<input readonly data-env-used="${r.id}|${env.id}" value="${oldEnv.consumptionValue??''}"></label>
          </div><div class="reagent-used-result" data-env-result="${r.id}|${env.id}">Consumo: <strong>—</strong></div>
        </div>`);
      }
      parts.push(`<div class="reagent-capture-card"><div class="reagent-capture-head"><div><b>${escapeHtml(r.name)}</b><small>${r.physicalState==='LIQUID'?`LÍQUIDO · densidad ${Number(r.density).toFixed(4)} g/mL`:'SÓLIDO'} · ${containers.length} envase(s)</small></div><span class="badge">R${i+1}</span></div><div class="multi-container-list">${envCards.join('')}</div></div>`);
    }else{
      parts.push(`<div class="reagent-capture-card"><div class="reagent-capture-head"><div><b>${escapeHtml(r.name)}</b><small>${reagentModeLabel(r.mode)} · ${escapeHtml(r.unit||'unidad')}</small></div><span class="badge">R${i+1}</span></div><div class="reagent-inputs"><label>Cantidad utilizada (${escapeHtml(r.unit||'unidad')})<input type="number" step="any" min="0" data-reag-count="${r.id}" value="${old.used??''}"></label></div><div class="reagent-used-result" data-reag-result="${r.id}">Consumo: <strong>${old.used??'—'} ${escapeHtml(r.unit||'unidad')}</strong></div></div>`);
    }
  }
  $('#finishReagentRows').innerHTML=parts.join('');
  $$('[data-use-container]').forEach(ch=>ch.onchange=()=>{const f=$(`[data-env-final="${ch.dataset.useContainer}"]`);if(f)f.disabled=!ch.checked;updateReagentCalculations(p)});
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
      const result=$(`[data-reag-result="${r.id}"]`),raw=$(`[data-reag-count="${r.id}"]`)?.value,n=raw===''?null:Number(raw);
      if(result)result.innerHTML=n===null||!Number.isFinite(n)?'Consumo: <strong>—</strong>':`Consumo: <strong>${n} ${escapeHtml(r.unit||'unidad')}</strong>`;
    }
  }
  const check=collectReagentResult(p,false),v=$('#finishReagentValidation');if(!v)return;
  if(check.complete){v.textContent='Registro listo. Los reactivos sin envase marcado quedarán como NO UTILIZADOS.';v.className='inline-alert ok'}else{v.textContent='Complete únicamente los pesos finales de los envases que haya marcado como utilizados.';v.className='inline-alert info'}
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
        usedContainers.push({containerId:env.id,label:env.label,containerType:env.containerType||'FRASCO',usedInActivity:true,tareWeight,initialWeight,finalWeight,used,volumeUsedMl,netRemainingG,netRemainingMl,depleted,initialSource:source,initialWeightCorrected:source==='CORREGIDO_MANUAL'});
      }
      if(!usedContainers.length){
        items.push({reagentId:r.id,name:r.name,mode:r.mode,unit:'g',physicalState:r.physicalState||'SOLID',density:r.physicalState==='LIQUID'?Number(r.density):null,containers:[],used:0,volumeUsedMl:r.physicalState==='LIQUID'?0:null,consumptionValue:0,consumptionUnit:r.physicalState==='LIQUID'?'mL':'g',usedInActivity:false,notUsed:true,depleted:false});
        continue;
      }
      const totalMass=usedContainers.reduce((a,e)=>a+(e.used||0),0),totalMl=r.physicalState==='LIQUID'?usedContainers.reduce((a,e)=>a+(e.volumeUsedMl||0),0):null;
      items.push({reagentId:r.id,name:r.name,mode:r.mode,unit:'g',physicalState:r.physicalState||'SOLID',density:r.physicalState==='LIQUID'?Number(r.density):null,containers:usedContainers,used:totalMass,volumeUsedMl:totalMl,consumptionValue:r.physicalState==='LIQUID'?totalMl:totalMass,consumptionUnit:r.physicalState==='LIQUID'?'mL':'g',usedInActivity:true,notUsed:false,depleted:usedContainers.every(e=>e.depleted)});
    }else{
      const raw=$(`[data-reag-count="${r.id}"]`)?.value;
      if(raw===''){
        items.push({reagentId:r.id,name:r.name,mode:r.mode,unit:r.unit||'unidad',used:0,usedInActivity:false,notUsed:true});
        continue;
      }
      const used=Number(raw);if(!Number.isFinite(used)||used<0)return {ok:false,text:`Revise la cantidad utilizada de ${r.name}.`};
      items.push({reagentId:r.id,name:r.name,mode:r.mode,unit:r.unit||'unidad',used,usedInActivity:used>0,notUsed:used===0});
    }
  }
  return {ok:true,complete,result:{items,completed:complete,capturedAt:nowISO()}};
}

async function saveReagentDraft(){
  const p=await getOne('planning',$('#finishActivityPlanId').value);if(!p||!planHasReagents(p))return;
  const rr=collectReagentResult(p,false);if(!rr.ok)return toast(rr.text);
  p.reagentResult=rr.result;p.updatedAt=nowISO();await put('planning',p);await queue('UPDATE','planning',p);
  await audit('GUARDAR_CONSUMO_REACTIVOS_PARCIAL','MI JORNADA',p.code,`${p.analystName} guardó consumos parciales de ${p.catalogName}`);
  toast('Consumos guardados sin finalizar');
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
    ?`<button type="button" class="btn secondary tech-req-action" data-edit-technical="${p.id}">Ver / Editar datos técnicos</button>`
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
  if(item.reagentConfig?.length&&!p.reagentResult?.completed){
    const merged=mergeReagentConfigFromCatalog(p.reagentConfig||[],item.reagentConfig);
    if(JSON.stringify(merged)!==JSON.stringify(p.reagentConfig||[])){p.reagentConfig=merged;changed=true}
    p.reagentResult=p.reagentResult||null;
  }
  if(changed){p.updatedAt=nowISO();await put('planning',p);await queue('UPDATE','planning',p)}
  return p;
}

async function openTechnicalData(planId){
  let p=await getOne('planning',planId);if(!p)return;
  if(!assertOwnPlan(p)&&currentSessionUser?.role!=='JEFE')return toast('No tiene permiso para modificar esta actividad');
  p=await hydratePlanTechnicalRequirements(p);
  if(!planRequiresCalibration(p)&&!planHasReagents(p))return toast('Esta actividad no tiene datos técnicos configurados');

  $('#finishActivityPlanId').value=p.id;
  $('#finishTechnicalEditMode').value=p.status==='REALIZADO'?'1':'2';
  $('#finishActivitySummary').innerHTML=`<b>${escapeHtml(p.catalogName)}</b><span>${p.status==='REALIZADO'?'Actividad REALIZADA · edición técnica':'Registro técnico previo a finalizar'}</span>`;
  $('#finishSamplesLabel').classList.add('hidden');
  $('#finishActualSamples').required=false;
  $('#finishActualSamples').value=p.actualSamples??'';
  $('#finishActivityComment').value='';
  $('#finishActivityHelp').textContent=p.status==='REALIZADO'
    ?'Puede completar o corregir los datos técnicos. El estado REALIZADO y los tiempos originales no cambian.'
    :'Complete la curva y/o reactivos. Estos datos quedarán guardados y luego podrá finalizar la actividad.';
  renderFinishCalibration(p);
  await renderFinishReagents(p);
  const submit=$('#finishActivityForm button[type="submit"]');if(submit)submit.textContent='Guardar datos técnicos';
  $('#finishActivityDialog').showModal();
}

async function editCompletedTechnicalData(planId){return openTechnicalData(planId)}
async function finishMyActivity(planId){
  const _guardPlan=await getOne('planning',planId);if(!_guardPlan||!assertOwnPlan(_guardPlan))return toast('No puede modificar actividades de otro analista');
  const p=await getOne('planning',planId);if(!p)return;
  if(p.status==='REALIZADO')return toast('La actividad ya está finalizada');
  if(!p.actualStartedAt)return toast('Primero debe iniciar la actividad');

  const needsSamples=requiresActualSamples(p.section),needsCurve=planRequiresCalibration(p),needsReagents=planHasReagents(p);
  if(needsSamples||needsCurve||needsReagents){
    $('#finishActivityPlanId').value=p.id;
    $('#finishTechnicalEditMode').value='0';
    const _finishSubmit=$('#finishActivityForm button[type="submit"]');if(_finishSubmit)_finishSubmit.textContent='Finalizar actividad';
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
async function completeActivityRecord(p,actualSamples=null,finalComment='',calibrationResult=undefined,reagentResult=undefined){
  p.status='REALIZADO';p.actualFinishedAt=nowISO();p.updatedAt=nowISO();
  if(actualSamples!==null)p.actualSamples=Math.max(0,Number(actualSamples));if(calibrationResult!==undefined)p.calibrationResult=calibrationResult;if(reagentResult!==undefined)p.reagentResult=reagentResult;
  await put('planning',p);await queue('UPDATE','planning',p);
  if(finalComment){
    const comment={id:uid('COM'),planId:p.id,analystId:p.analystId,authorName:p.analystName,text:finalComment,createdAt:nowISO()};
    await put('planComments',comment);await queue('CREATE','planComments',comment);
  }
  const sampleDetail=p.actualSamples!==null&&p.actualSamples!==undefined?` · ${p.actualSamples} muestras analizadas`:'';const curveDetail=p.calibrationResult?.completed?` · curva ${p.calibrationResult.points.length} puntos × 3 · R² ${p.calibrationResult.regression?.r2?.toFixed(6)??'—'}`:'';const reagentDetail=p.reagentResult?.completed?` · ${p.reagentResult.items.length} consumo(s) de reactivos registrados`:'';
  await audit('FINALIZAR_ACTIVIDAD','MI JORNADA',p.code,`${p.analystName} finalizó ${p.catalogName} a las ${formatActualStamp(p.actualFinishedAt)}${sampleDetail}${curveDetail}${reagentDetail}`);
  toast(`Actividad finalizada${sampleDetail}`);
  await renderMyDay();await renderAgenda();await renderDailyLoad();await renderAudit();await renderManagementDashboard();
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
  }
  const comment=$('#finishActivityComment').value.trim();

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
    toast(mode==='1'?'Datos técnicos actualizados':'Datos técnicos guardados · ahora puede finalizar cuando corresponda');
    await renderMyDay();return;
  }

  if(p.status==='REALIZADO'){ $('#finishActivityDialog').close(); return toast('La actividad ya está finalizada') }
  const samples=Number($('#finishActualSamples').value);
  if(requiresActualSamples(p.section)&&(!Number.isFinite(samples)||samples<0))return toast('Ingrese el número de muestras analizadas');
  $('#finishActivityDialog').close();
  await completeActivityRecord(p,requiresActualSamples(p.section)?samples:null,comment,calibrationResult,reagentResult);
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


async function renderMyDay(){
  if(!$('#myDayCards'))return;
  const date=$('#myDayDate').value,analystId=$('#myDayAnalyst').value;
  const plans=(await visiblePlanningRows()).filter(p=>p.date===date&&p.analystId===analystId&&p.status!=='CANCELADO').sort((a,b)=>a.startTime.localeCompare(b.startTime));
  $('#myDayEmpty').classList.toggle('hidden',plans.length>0);
  const a=(await getAll('analysts')).find(x=>x.id===analystId);
  const total=plans.reduce((t,p)=>t+Number(p.durationMinutes||0),0);
  const done=plans.filter(p=>p.status==='REALIZADO').length,inProgress=plans.filter(p=>p.status==='EN PROCESO').length;
  const pct=plans.length?Math.round(done/plans.length*100):0;
  const today=date===dateToday(),now=new Date(),nowMin=now.getHours()*60+now.getMinutes();
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
      ?`${flex}<button class="btn primary myday-action" data-start-activity="${p.id}">▶ Iniciar actividad</button>`
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
        ${ss.length?`<details class="myday-breakdown compact-breakdown"><summary>Ver desglose · ${ss.length} subactividades</summary><div>${ss.map(x=>`<span>• ${escapeHtml(x.name)} · ${minutesText(x.minutes)}</span>`).join('')}</div></details>`:''}
        ${technicalRequirementMenuHtml(p,_req)}
        <div class="myday-actions-row">${action}</div>${actual}
        <details class="comment-thread compact-comments" ${comments.length?'open':''}>
          <summary>💬 Comentarios / novedades (${comments.length})</summary>
          <div class="comment-body">
            ${comments.length?comments.map(c=>`<div class="comment-item"><b>${escapeHtml(c.authorName)}</b><small>${fmtDate(c.createdAt)}</small><div>${escapeHtml(c.text)}</div></div>`).join(''):'<div class="myday-meta">Sin comentarios todavía.</div>'}
            <div class="comment-compose"><input data-comment-input="${p.id}" placeholder="Agregar observación, novedad o comentario..."/><button class="btn secondary" data-comment-save="${p.id}">Comentar</button></div>
          </div>
        </details>
      </div>
    </article>`;
  }).join('');
  $$('[data-start-activity]').forEach(el=>el.onclick=()=>startMyActivity(el.dataset.startActivity));
  $$('[data-finish-activity]').forEach(el=>el.onclick=()=>finishMyActivity(el.dataset.finishActivity));$$('[data-open-technical]').forEach(b=>b.onclick=()=>openTechnicalData(b.dataset.openTechnical));$$('[data-edit-technical]').forEach(b=>b.onclick=()=>editCompletedTechnicalData(b.dataset.editTechnical));
  $$('[data-move-up]').forEach(el=>el.onclick=()=>moveMyActivity(el.dataset.moveUp,-1));
  $$('[data-move-down]').forEach(el=>el.onclick=()=>moveMyActivity(el.dataset.moveDown,1));
  $$('[data-prioritize]').forEach(el=>el.onclick=()=>prioritizeMyActivity(el.dataset.prioritize));  $$('[data-comment-save]').forEach(el=>el.onclick=()=>addAnalystComment(el.dataset.commentSave));
  if($('#myDayRecent')){$('#myDayRecent').innerHTML='';$('#myDayRecent').classList.add('hidden')}
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

async function renderAgenda(){if(!$('#agendaBody'))return;const date=$('#planDate').value,st=$('#agendaStatus').value;let data=(await visiblePlanningRows()).filter(p=>p.date===date&&(!st||p.status===st));data.sort((a,b)=>a.startTime.localeCompare(b.startTime)||a.analystName.localeCompare(b.analystName,'es'));$('#agendaEmpty').classList.toggle('hidden',data.length>0);$('#agendaTableWrap').classList.toggle('hidden',data.length===0);const steps=await getAll('compositeSteps'),comments=await getAll('planComments');$('#agendaBody').innerHTML=data.map(p=>{const ss=steps.filter(s=>s.catalogId===p.catalogId).sort((a,b)=>a.order-b.order),cc=comments.filter(c=>c.planId===p.id).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));const detail=ss.length?`<div class="agenda-detail">${ss.map(s=>`${escapeHtml(s.name)} (${minutesText(s.minutes)})`).join(' · ')}</div>`:'';const note=p.notes?`<div class="agenda-note"><b>Jefe:</b> ${escapeHtml(p.notes)}</div>`:'';const comm=cc.length?`<div class="agenda-comments"><b>Analista (${cc.length}):</b> ${cc.map(c=>escapeHtml(c.text)).join(' · ')}</div>`:'';return `<tr><td><b>${p.startTime}-${p.endTime}</b></td><td>${escapeHtml(p.analystName)}</td><td>${escapeHtml(sectionMeta(p.section).label)}</td><td><b>${escapeHtml(p.catalogName)}</b>${p.samples?`<div class="agenda-detail">${p.samples} muestras</div>`:''}${detail}${note}${comm}</td><td>${minutesText(p.durationMinutes)}</td><td><select class="status-select" data-plan-status="${p.id}"><option ${p.status==='PROGRAMADO'?'selected':''}>PROGRAMADO</option><option ${p.status==='EN PROCESO'?'selected':''}>EN PROCESO</option><option ${p.status==='REALIZADO'?'selected':''}>REALIZADO</option><option ${p.status==='CANCELADO'?'selected':''}>CANCELADO</option></select></td><td class="row-actions"><button data-plan-delete="${p.id}">Eliminar</button></td></tr>`}).join('');$$('[data-plan-status]').forEach(el=>el.onchange=()=>changePlanStatus(el.dataset.planStatus,el.value));$$('[data-plan-delete]').forEach(el=>el.onclick=()=>deletePlan(el.dataset.planDelete))}
async function changePlanStatus(id,status){const p=await getOne('planning',id);if(!p)return;p.status=status;p.updatedAt=nowISO();await put('planning',p);await queue('UPDATE','planning',p);await audit('CAMBIAR_ESTADO','PLANIFICADOR',p.code,`${p.catalogName}: ${status}`);toast('Estado actualizado');if(typeof refreshPlanner==='function')await refreshPlanner();await renderAudit()}
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
async function renderCatalog(){const meta=sectionMeta(currentSection);$('#catalogHeading').textContent=meta.label;$('#catalogHelp').textContent=meta.hint;let data=(await getAll('catalog')).filter(x=>x.section===currentSection);const q=$('#catalogSearch').value.trim().toLowerCase(),st=$('#catalogStatusFilter').value;data=data.filter(x=>(!q||`${x.code} ${x.name} ${x.family||''}`.toLowerCase().includes(q))&&(!st||x.status===st));data.sort((a,b)=>a.name.localeCompare(b.name,'es'));const [rules,steps]=await Promise.all([getAll('timeRules'),getAll('compositeSteps')]);$('#catalogEmpty').classList.toggle('hidden',data.length>0);$('#catalogTableWrap').classList.toggle('hidden',data.length===0);$('#catalogBody').innerHTML=data.map(x=>{const n=rules.filter(r=>r.catalogId===x.id).length,ss=steps.filter(s=>s.catalogId===x.id).sort((a,b)=>a.order-b.order);const time=x.timeMode==='FIXED'?minutesText(x.baseMinutes):x.timeMode==='BY_SAMPLES'?`${n} rango${n===1?'':'s'}`:x.timeMode==='COMPOSITE'?`${minutesText(x.baseMinutes)} · ${ss.length} detalle${ss.length===1?'':'s'}`:'Sin tiempo';const breakdown=ss.length?`<div class="catalog-breakdown">${ss.map(s=>`<span>${escapeHtml(s.name)} · ${minutesText(s.minutes)}</span>`).join('')}</div>`:'';const curve=x.calibrationConfig?.enabled?`<div class="catalog-curve-badge">CURVA · ${x.calibrationConfig.points?.length||0} puntos · triplicado · ${escapeHtml(x.calibrationConfig.unit||'')}</div>`:'';const reagents=x.reagentConfig?.length?`<div class="catalog-reagent-badge">${x.reagentConfig.length} reactivo(s) / material(es)</div>`:'';return `<tr><td><b>${x.code}</b></td><td>${sectionMeta(x.section).label}</td><td>${escapeHtml(x.family||'—')}</td><td><b>${escapeHtml(x.name)}</b><br><small>${escapeHtml(x.description||'')}</small>${breakdown}${curve}${reagents}</td><td>${time}</td><td><span class="badge ${x.status==='ACTIVO'?'good':'off'}">${x.status}</span></td><td class="row-actions"><button data-edit-cat="${x.id}">Editar</button><button data-toggle-cat="${x.id}">${x.status==='ACTIVO'?'Desactivar':'Activar'}</button></td></tr>`}).join('');$$('[data-edit-cat]').forEach(b=>b.onclick=()=>editCatalog(b.dataset.editCat));$$('[data-toggle-cat]').forEach(b=>b.onclick=()=>toggleCatalog(b.dataset.toggleCat))}
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
function reagentModeLabel(mode){return mode==='WEIGHT'?'PESO DE FRASCO':'CONTABLE'}
function reagentDefaultUnit(mode){return mode==='WEIGHT'?'g':'unidad'}

function ensureReagentContainers(r){
  if(r.mode!=='WEIGHT')return [];
  if(Array.isArray(r.containers)&&r.containers.length)return r.containers;
  r.containers=[{
    id:uid('ENV'),
    label:'Envase 1',
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
      <label>Nombre<input data-container-label="${i}-${j}" value="${escapeHtml(e.label||`Envase ${j+1}`)}"></label>
      <label>Tipo<select data-container-type="${i}-${j}"><option value="FRASCO" ${e.containerType!=='SOBRE'?'selected':''}>FRASCO</option><option value="SOBRE" ${e.containerType==='SOBRE'?'selected':''}>SOBRE</option></select></label>
      <label>Tara (g)<input type="number" min="0" step="any" data-container-tare="${i}-${j}" value="${e.tareWeight??''}"></label>
      <label>Peso inicial (g)<input type="number" min="0" step="any" data-container-initial="${i}-${j}" value="${e.initialWeight??''}"></label>
      <button type="button" class="icon-btn" data-remove-container="${i}-${j}" ${arr.length===1?'disabled':''}>×</button>
    </div>`).join('');
  });
  $$('[data-container-label]').forEach(el=>el.oninput=()=>{const [i,j]=el.dataset.containerLabel.split('-').map(Number);ensureReagentContainers(editingReagents[i])[j].label=el.value});
  $$('[data-container-type]').forEach(el=>el.onchange=()=>{const [i,j]=el.dataset.containerType.split('-').map(Number);ensureReagentContainers(editingReagents[i])[j].containerType=el.value});
  $$('[data-container-tare]').forEach(el=>el.oninput=()=>{const [i,j]=el.dataset.containerTare.split('-').map(Number);ensureReagentContainers(editingReagents[i])[j].tareWeight=el.value;validateReagents()});
  $$('[data-container-initial]').forEach(el=>el.oninput=()=>{const [i,j]=el.dataset.containerInitial.split('-').map(Number);ensureReagentContainers(editingReagents[i])[j].initialWeight=el.value;validateReagents()});
  $$('[data-remove-container]').forEach(btn=>btn.onclick=()=>{const [i,j]=btn.dataset.removeContainer.split('-').map(Number),arr=ensureReagentContainers(editingReagents[i]);if(arr.length>1){arr.splice(j,1);renderReagentRows()}});
}
function renderReagentRows(){
  const box=$('#reagentRows');if(!box)return;
  box.innerHTML=editingReagents.map((r,i)=>`<div class="reagent-row">
    <label>Reactivo / material<input data-reagent-name="${i}" value="${escapeHtml(r.name||'')}" placeholder="Ej. Sulfato de sodio"></label>
    <label>Forma de control<select data-reagent-mode="${i}"><option value="COUNT" ${r.mode!=='WEIGHT'?'selected':''}>CONTABLE · cantidad usada</option><option value="WEIGHT" ${r.mode==='WEIGHT'?'selected':''}>PESO DE FRASCO · antes/después</option></select></label>
    <label>Unidad<input data-reagent-unit="${i}" value="${escapeHtml(r.unit||reagentDefaultUnit(r.mode))}" placeholder="g / unidad"></label>
    ${r.mode==='WEIGHT'?`
      <label>Estado físico<select data-reagent-state="${i}">
        <option value="SOLID" ${(r.physicalState||'SOLID')==='SOLID'?'selected':''}>SÓLIDO</option>
        <option value="LIQUID" ${r.physicalState==='LIQUID'?'selected':''}>LÍQUIDO</option>
      </select></label>
      ${r.physicalState==='LIQUID'?`<label>Densidad (g/mL)<input type="number" min="0.000001" step="any" data-reagent-density="${i}" value="${r.density??''}" placeholder="Ej. 1.025"><small>Se usa para convertir gramos consumidos a mL.</small></label>`:''}
      <label>Tara del envase (g)<input type="number" min="0" step="any" data-reagent-tare="${i}" value="${r.tareWeight??''}" placeholder="Ej. 120.50"><small>Peso del envase vacío. Permite calcular inventario neto real.</small></label>
      <label class="reagent-initial-weight">Peso inicial del envase principal (g)<input type="number" min="0" step="any" data-reagent-initial="${i}" value="${r.initialWeight??''}" placeholder="Ej. 850.20"><small>Compatibilidad con registros anteriores.</small></label>
      <div class="reagent-containers-box">
        <div class="reagent-containers-head"><b>Frascos / sobres disponibles</b><button type="button" class="btn secondary mini-btn" data-add-container="${i}">+ Agregar envase</button></div>
        <div data-container-list="${i}"></div>
      </div>`:''}
    <button type="button" class="icon-btn reagent-remove" data-remove-reagent="${i}">×</button>
  </div>`).join('');
  $$('[data-reagent-name]').forEach(el=>el.oninput=()=>{editingReagents[Number(el.dataset.reagentName)].name=el.value;validateReagents()});
  $$('[data-reagent-mode]').forEach(el=>el.onchange=()=>{const i=Number(el.dataset.reagentMode);editingReagents[i].mode=el.value;editingReagents[i].unit=reagentDefaultUnit(el.value);if(el.value!=='WEIGHT'){editingReagents[i].initialWeight=null;editingReagents[i].physicalState=null;editingReagents[i].density=null;editingReagents[i].tareWeight=null}else{editingReagents[i].physicalState=editingReagents[i].physicalState||'SOLID'}renderReagentRows()});
  $$('[data-reagent-unit]').forEach(el=>el.oninput=()=>{editingReagents[Number(el.dataset.reagentUnit)].unit=el.value;validateReagents()});
  $$('[data-reagent-initial]').forEach(el=>el.oninput=()=>{editingReagents[Number(el.dataset.reagentInitial)].initialWeight=el.value;validateReagents()});
  $$('[data-reagent-state]').forEach(el=>el.onchange=()=>{const i=Number(el.dataset.reagentState);editingReagents[i].physicalState=el.value;if(el.value!=='LIQUID')editingReagents[i].density=null;renderReagentRows()});
  $$('[data-reagent-density]').forEach(el=>el.oninput=()=>{editingReagents[Number(el.dataset.reagentDensity)].density=el.value;validateReagents()});
  $$('[data-reagent-tare]').forEach(el=>el.oninput=()=>{editingReagents[Number(el.dataset.reagentTare)].tareWeight=el.value;validateReagents()});
  $$('[data-remove-reagent]').forEach(el=>el.onclick=()=>{editingReagents.splice(Number(el.dataset.removeReagent),1);renderReagentRows()});
  renderContainerLists();
  $$('[data-add-container]').forEach(btn=>btn.onclick=()=>{const i=Number(btn.dataset.addContainer),arr=ensureReagentContainers(editingReagents[i]);arr.push({id:uid('ENV'),label:`Envase ${arr.length+1}`,containerType:'FRASCO',tareWeight:'',initialWeight:'',status:'ACTIVO'});renderReagentRows()});
  validateReagents();
}
function addReagent(){editingReagents.push({id:uid('REA'),name:'',mode:'COUNT',unit:'unidad',initialWeight:null,physicalState:'SOLID',density:null,tareWeight:null});renderReagentRows()}
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
  if(enabled)renderReagentRows();
}
function validateReagents(){
  const el=$('#reagentValidation');if(!el)return {level:'OK',text:''};
  const section=$('#catalogSection')?.value||'';
  if(!sectionAllowsReagents(section)||!$('#catalogUsesReagents')?.checked){el.textContent='';el.className='inline-alert';return {level:'OK',text:''}}
  if(!editingReagents.length){const out={level:'ERROR',text:'Agregue al menos un reactivo o material, o desactive “Sí, registrar consumo”.'};el.textContent=out.text;el.className='inline-alert error';return out}
  const names=editingReagents.map(r=>(r.name||'').trim());
  let out;
  if(names.some(n=>!n))out={level:'ERROR',text:'Todos los reactivos/materiales deben tener nombre.'};
  else if(editingReagents.some(r=>!(r.unit||'').trim()))out={level:'ERROR',text:'Defina la unidad de control de cada reactivo.'};
  else if(editingReagents.some(r=>r.mode==='WEIGHT'&&ensureReagentContainers(r).some(e=>!(e.label||'').trim())))out={level:'ERROR',text:'Todos los frascos/sobres deben tener nombre.'};
  else if(editingReagents.some(r=>r.mode==='WEIGHT'&&ensureReagentContainers(r).some(e=>!Number.isFinite(Number(e.tareWeight))||Number(e.tareWeight)<0)))out={level:'ERROR',text:'Registre una tara válida para cada frasco/sobre.'};
  else if(editingReagents.some(r=>r.mode==='WEIGHT'&&ensureReagentContainers(r).some(e=>!Number.isFinite(Number(e.initialWeight))||Number(e.initialWeight)<=Number(e.tareWeight))))out={level:'ERROR',text:'El peso inicial de cada frasco/sobre debe ser mayor que su tara.'};
  else if(editingReagents.some(r=>r.mode==='WEIGHT' && r.physicalState==='LIQUID' && (r.density==='' || r.density===null || r.density===undefined || !Number.isFinite(Number(r.density)) || Number(r.density)<=0)))out={level:'ERROR',text:'Para cada reactivo LÍQUIDO, registre una densidad válida en g/mL.'};
  else if(new Set(names.map(n=>normalizeIdentityText(n))).size!==names.length)out={level:'ERROR',text:'No repita el mismo reactivo dentro del ensayo.'};
  else out={level:'OK',text:`${editingReagents.length} reactivo(s)/material(es) configurado(s) para captura obligatoria al finalizar.`};
  el.textContent=out.text;el.className='inline-alert '+out.level.toLowerCase();return out;
}
function reagentConfigFromForm(){
  const section=$('#catalogSection')?.value||'';
  if(!sectionAllowsReagents(section)||!$('#catalogUsesReagents')?.checked)return [];
  return editingReagents.map((r,i)=>{const containers=r.mode==='WEIGHT'?ensureReagentContainers(r).map((e,j)=>({id:e.id||uid('ENV'),order:j+1,label:(e.label||`Envase ${j+1}`).trim(),containerType:e.containerType==='SOBRE'?'SOBRE':'FRASCO',tareWeight:Number(e.tareWeight),initialWeight:Number(e.initialWeight),status:e.status||'ACTIVO'})):[];const first=containers[0]||{};return {id:r.id||uid('REA'),order:i+1,name:(r.name||'').trim(),mode:r.mode==='WEIGHT'?'WEIGHT':'COUNT',unit:(r.unit||reagentDefaultUnit(r.mode)).trim(),initialWeight:r.mode==='WEIGHT'?Number(first.initialWeight??r.initialWeight):null,physicalState:r.mode==='WEIGHT'?(r.physicalState||'SOLID'):null,density:r.mode==='WEIGHT'&&r.physicalState==='LIQUID'?Number(r.density):null,tareWeight:r.mode==='WEIGHT'?Number(first.tareWeight??r.tareWeight):null,containers};});
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
  else out={level:'OK',text:`Curva configurada: ${nums.length} puntos · triplicado · ${unit}.`};
  el.textContent=out.text;el.className='inline-alert '+out.level.toLowerCase();return out;
}
function calibrationConfigFromForm(){
  return {
    enabled:!!$('#catalogRequiresCalibration')?.checked,
    unit:$('#calibrationUnit')?.value.trim()||'',
    replicates:3,
    points:editingCalibrationPoints.map((p,i)=>({order:i+1,concentration:normalizeCalibrationPoint(p.concentration)}))
  };
}
function openCatalog(){setCatalogSectionOptions();$('#catalogForm').reset();$('#catalogId').value='';$('#catalogSection').value=currentSection;$('#catalogStatus').value='ACTIVO';$('#catalogTimeMode').value=['RECEPCION_MUESTRAS','MICROBIOLOGIA','AASS'].includes(currentSection)?'COMPOSITE':currentSection==='ENSAYOS_ANALITICOS'?'BY_SAMPLES':'FIXED';editingRules=[];editingSteps=[];editingCalibrationPoints=[];editingReagents=[];$('#catalogUsesReagents').checked=false;$('#catalogRequiresCalibration').checked=false;$('#calibrationUnit').value='';if(currentSection==='RECEPCION_MUESTRAS')setDurationPicker(300);else if(['MICROBIOLOGIA','AASS'].includes(currentSection))setDurationPicker(0);$('#catalogDialogTitle').textContent='Nuevo elemento';updateCatalogForm();updateCalibrationEditor();updateReagentEditor();$('#catalogDialog').showModal()}
async function editCatalog(id){const all=await getAll('catalog'),x=all.find(r=>r.id===id);if(!x)return;setCatalogSectionOptions();$('#catalogId').value=x.id;$('#catalogSection').value=x.section;$('#catalogName').value=x.name;$('#catalogFamily').value=x.family||'';$('#catalogTimeMode').value=x.timeMode||'FIXED';setDurationPicker(x.section==='RECEPCION_MUESTRAS'?300:(x.baseMinutes||0));$('#catalogStatus').value=x.status;$('#catalogDescription').value=x.description||'';editingRules=(await getAll('timeRules')).filter(r=>r.catalogId===id).sort((a,b)=>a.minSamples-b.minSamples).map(r=>({...r}));editingSteps=(await getAll('compositeSteps')).filter(r=>r.catalogId===id).sort((a,b)=>a.order-b.order).map(r=>({...r}));const cc=x.calibrationConfig||{};$('#catalogRequiresCalibration').checked=!!cc.enabled;$('#calibrationUnit').value=cc.unit||'';editingCalibrationPoints=(cc.points||[]).sort((a,b)=>(a.order||0)-(b.order||0)).map(p=>({concentration:p.concentration}));editingReagents=(x.reagentConfig||[]).sort((a,b)=>(a.order||0)-(b.order||0)).map(r=>({...r,physicalState:r.mode==='WEIGHT'?(r.physicalState||'SOLID'):null,density:r.density??null,tareWeight:r.tareWeight??null,containers:Array.isArray(r.containers)&&r.containers.length?r.containers.map(e=>({...e})):r.mode==='WEIGHT'?[{id:uid('ENV'),label:'Envase 1',containerType:'FRASCO',tareWeight:r.tareWeight??'',initialWeight:r.initialWeight??'',status:'ACTIVO'}]:[]}));$('#catalogUsesReagents').checked=sectionAllowsReagents(x.section)&&editingReagents.length>0;if(x.section==='ACTIVIDADES_LABORATORIO'&&activityLooksLikeCalibration(x.name)&&!cc.enabled){$('#catalogRequiresCalibration').checked=true;if(!editingCalibrationPoints.length)editingCalibrationPoints=[{concentration:''},{concentration:''},{concentration:''}];}$('#catalogDialogTitle').textContent='Editar elemento';updateCatalogForm();updateCalibrationEditor();updateReagentEditor();$('#catalogDialog').showModal()}
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
async function saveCatalog(ev){ev.preventDefault();const id=$('#catalogId').value,section=$('#catalogSection').value,name=$('#catalogName').value.trim(),family=$('#catalogFamily').value.trim(),timeMode=$('#catalogTimeMode').value,baseMinutes=section==='RECEPCION_MUESTRAS'&&timeMode==='COMPOSITE'?300:getDurationPicker();if(!section||!name)return toast('Complete sección y nombre');if(['FIXED','COMPOSITE'].includes(timeMode)&&!baseMinutes)return toast('Ingrese la duración estándar');if(timeMode==='BY_SAMPLES'){const v=validateRules(editingRules);if(v.level==='ERROR')return toast(v.text)}if(timeMode==='COMPOSITE'){const v=validateSteps();if(v.level==='ERROR')return toast(v.text)}if($('#catalogRequiresCalibration')?.checked){const v=validateCalibrationConfig();if(v.level==='ERROR')return toast(v.text)}if(sectionAllowsReagents(section)&&$('#catalogUsesReagents')?.checked){const v=validateReagents();if(v.level==='ERROR')return toast(v.text)}const all=await getAll('catalog');const duplicate=all.find(x=>x.id!==id&&x.section===section&&x.name.trim().toLowerCase()===name.toLowerCase()&&(x.family||'').trim().toLowerCase()===family.toLowerCase());if(duplicate)return toast('Ya existe el mismo elemento en esta sección y clasificación');const existing=id?all.find(x=>x.id===id):null;const rec={id:id||uid('CAT'),code:existing?.code||nextCode(section,all),section,name,family,timeMode,baseMinutes:['FIXED','COMPOSITE'].includes(timeMode)?baseMinutes:null,description:$('#catalogDescription').value.trim(),calibrationConfig:calibrationConfigFromForm(),reagentConfig:reagentConfigFromForm(),status:$('#catalogStatus').value,createdAt:existing?.createdAt||nowISO(),updatedAt:nowISO()};await put('catalog',rec);const oldRules=(await getAll('timeRules')).filter(r=>r.catalogId===rec.id);for(const r of oldRules)await del('timeRules',r.id);if(timeMode==='BY_SAMPLES'){for(const r of editingRules){await put('timeRules',{id:uid('TR'),catalogId:rec.id,minSamples:Number(r.minSamples),maxSamples:Number(r.maxSamples),minutes:Number(r.minutes),createdAt:nowISO()})}}const oldSteps=(await getAll('compositeSteps')).filter(r=>r.catalogId===rec.id);for(const s of oldSteps)await del('compositeSteps',s.id);if(timeMode==='COMPOSITE'){for(let i=0;i<editingSteps.length;i++){const s=editingSteps[i];await put('compositeSteps',{id:uid('STEP'),catalogId:rec.id,order:i+1,name:String(s.name).trim(),minutes:Number(s.minutes),createdAt:nowISO()})}}await queue(id?'UPDATE':'CREATE','catalog',rec);await audit(id?'EDITAR':'CREAR','CATALOGO_MAESTRO',rec.code,`${sectionMeta(section).label}: ${name}${family?` · ${family}`:''}${timeMode==='COMPOSITE'?` · bloque ${minutesText(baseMinutes)} con ${editingSteps.length} detalles`:''}`);currentSection=section;$('#catalogDialog').close();toast(id?'Elemento actualizado':'Elemento creado');await refreshAll();renderSectionTabs();
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
async function saveConfig(){const lab=$('#cfgLab').value.trim(),user=$('#cfgUser').value.trim(),dayHours=Number($('#cfgDayHours').value||8);await put('config',{key:'labName',value:lab});await put('config',{key:'defaultUser',value:user});await put('config',{key:'dayHours',value:dayHours});await audit('CONFIGURAR','SISTEMA','CONFIG','Configuración general actualizada');toast('Configuración guardada');await refreshAll()}
async function backup(){const data={app:'ERP_PLANIFICACION_NEXTGEN',version:APP_VERSION,exportedAt:nowISO(),catalog:await getAll('catalog'),timeRules:await getAll('timeRules'),compositeSteps:await getAll('compositeSteps'),analysts:await getAll('analysts'),audit:await getAll('audit'),outbox:await getAll('outbox'),config:await getAll('config'),planning:await getAll('planning')};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`RESPALDO_ERP_PLANIFICACION_${APP_VERSION}_${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);await audit('EXPORTAR','SISTEMA','BACKUP','Respaldo general exportado');toast('Respaldo generado');await refreshAll()}
async function resetDB(){if(!confirm('Esto eliminará catálogo, reglas, analistas y trazabilidad locales de esta versión. ¿Continuar?'))return;await Promise.all(['catalog','timeRules','compositeSteps','analysts','audit','outbox','config','planning'].map(clearStore));toast('Base local reiniciada');await loadConfig();await refreshAll()}
async function refreshAll(){await Promise.all([renderDashboard(),renderCatalog(),renderAnalysts(),renderAudit(),analyzeData(true),renderMyDayAnalysts(),renderManagementFilters()]);if($('#planDate'))await refreshPlanner();if($('#myDayDate'))await renderMyDay()}

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
    const gateStatus=$('#authGateConnection');if(gateStatus)gateStatus.textContent='Autenticación correcta · cargando perfil y datos…';
    await handleFirebaseAuthState(cred.user);

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
    showAuthGate(firebaseBridge.authReady?'Ingrese correo y contraseña':'Conectando con Firebase…');
    return;
  }

  try{
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

    // 7. Confirmar pendientes, volver a contrastar con nube y recién después activar live sync.
    // Esto protege el caso: cerrar sesión / cerrar APP / volver horas después.
    try{await flushOutbox(false)}catch(e){console.warn('Outbox pendiente al reanudar sesión',e)}
    try{await pullFirebaseData(false)}catch(e){console.warn('Revisión cloud pendiente al reanudar sesión',e)}
    startRealtimeSync();
    await refreshMigrationUI();

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
  JEFE:['inicio','planificador','mi-jornada','seguimiento-diario','gestion','catalogo','analistas','inteligencia','trazabilidad','configuracion'],
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
  if($('#btnBackup'))$('#btnBackup').classList.toggle('hidden',role!=='JEFE');
  if($('#myDayAnalyst')){
    if(role==='ANALISTA'){ $('#myDayAnalyst').value=currentSessionUser?.analystId||'';$('#myDayAnalyst').disabled=true }
    else $('#myDayAnalyst').disabled=false;
  }
}

function switchView(view){
  if(!canAccessView(view)){
    toast('Este módulo no está habilitado para su rol');
    view=currentSessionUser?.role==='ANALISTA'?'mi-jornada':'inicio';
  }$$('.view').forEach(x=>x.classList.remove('active'));$(`#view-${view}`).classList.add('active');$$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===view));const meta={inicio:['Inicio','Catálogo y planificación trabajando sobre una sola base'],planificador:['Planificador Inteligente','Asignación basada en catálogo, competencias, carga y horario'],'mi-jornada':['Mi Jornada','Vista diaria del analista, instrucciones, desglose y comentarios'],catalogo:['Catálogo Maestro','Secciones independientes, una sola fuente de verdad'],analistas:['Analistas','Personas, jornada y competencias'],inteligencia:['Control inteligente','Validaciones antes de planificar'],trazabilidad:['Trazabilidad','Historial local de cambios y parametrización'],'seguimiento-diario':['Seguimiento Diario','Vista ejecutiva del trabajo diario por analista'],gestion:['Dashboard Gestión','Actividades realizadas, cumplimiento, Excel y edición controlada'],configuracion:['Configuración','Parámetros generales del núcleo']}[view];$('#pageTitle').textContent=meta[0];$('#pageSubtitle').textContent=meta[1];const b=$('#btnContextNew');b.classList.toggle('hidden',currentSessionUser?.role!=='JEFE'||!['catalogo','analistas'].includes(view));b.textContent=view==='catalogo'?'+ Nuevo elemento':'+ Nuevo analista';b.onclick=view==='catalogo'?openCatalog:openAnalyst;if(view==='inteligencia')analyzeData(true);if(view==='planificador')refreshPlanner();if(view==='mi-jornada'){renderMyDayAnalysts().then(()=>{if(currentSessionUser?.role==='ANALISTA'){$('#myDayAnalyst').value=currentSessionUser?.analystId||'';$('#myDayAnalyst').disabled=true}renderMyDay()})}if(view==='seguimiento-diario')renderDailyMonitor();if(view==='gestion')renderManagementDashboard()}
async function refreshPlanner(){
  await renderPlanSelectors();
  await renderDailyLoad();
  await renderAgenda();
  await renderExecutivePlanner();
}

async function init(){db=await openDB();
    await purgeDeletedPlanningLocally();
  firebaseBridge.lastSyncAt=(await getOne('config','lastCloudSyncAt'))?.value||null;if($('#planDate'))$('#planDate').value=dateToday();if($('#myDayDate'))$('#myDayDate').value=dateToday();renderSectionTabs();setCatalogSectionOptions();renderCompetencyChecks([]);$$('.nav-item').forEach(b=>b.onclick=()=>switchView(b.dataset.view));$$('[data-close]').forEach(b=>b.onclick=()=>document.getElementById(b.dataset.close).close());$('#catalogForm').addEventListener('submit',saveCatalog);$('#analystForm').addEventListener('submit',saveAnalyst);$('#catalogSection').addEventListener('change',updateCatalogForm);$('#catalogTimeMode').addEventListener('change',updateCatalogForm);$('#catalogName').addEventListener('input',()=>{if($('#catalogSection').value==='ACTIVIDADES_LABORATORIO'&&activityLooksLikeCalibration($('#catalogName').value)&&!$('#catalogId').value){$('#catalogRequiresCalibration').checked=true;updateCalibrationEditor()}});$('#catalogRequiresCalibration').addEventListener('change',updateCalibrationEditor);$('#calibrationUnit').addEventListener('input',validateCalibrationConfig);if($('#btnAddCalibrationPoint'))$('#btnAddCalibrationPoint').onclick=addCalibrationPoint;if($('#catalogUsesReagents'))$('#catalogUsesReagents').addEventListener('change',updateReagentEditor);if($('#btnAddReagent'))$('#btnAddReagent').onclick=addReagent;$('#catalogBaseHours').addEventListener('input',()=>{if($('#catalogTimeMode').value==='COMPOSITE')validateSteps()});$('#catalogBaseMinutePart').addEventListener('change',()=>{if($('#catalogTimeMode').value==='COMPOSITE')validateSteps()});if($('#btnAddRule'))$('#btnAddRule').onclick=addRule;if($('#btnAddStep'))$('#btnAddStep').onclick=addStep;$('#catalogSearch').addEventListener('input',renderCatalog);$('#catalogStatusFilter').addEventListener('change',renderCatalog);$('#analystSearch').addEventListener('input',renderAnalysts);if($('#btnAnalyze'))$('#btnAnalyze').onclick=()=>analyzeData(true);if($('#planSection')){$('#planSection').addEventListener('change',async()=>{if($('#planActivitySearch'))$('#planActivitySearch').value='';await renderAnalystOptions();await renderPlanSelectors();await smartPlannerRecalculate()});$('#planCatalog').addEventListener('change',smartPlannerRecalculate);
$('#planActivitySearch').addEventListener('input',renderPlanSelectors);
if($('#btnAddActivityFromPlanner'))$('#btnAddActivityFromPlanner').onclick=openCatalogFromPlanner;$('#planSamples').addEventListener('input',smartPlannerRecalculate);$('#planStart').addEventListener('input',updatePlanPreview);$('#planDate').addEventListener('change',async()=>{await smartPlannerRecalculate();await renderExecutivePlanner();if($('#bossAIResults')){$('#bossAIResults').classList.add('hidden');$('#bossAIEmpty').classList.remove('hidden')}});$('#agendaStatus').addEventListener('change',renderAgenda);if($('#btnSuggestAnalyst'))$('#btnSuggestAnalyst').onclick=suggestAnalyst;if($('#btnOptimizeDay'))$('#btnOptimizeDay').onclick=analyzeBossDay;if($('#btnSavePlan'))$('#btnSavePlan').onclick=savePlan;$('#planAnalyst').addEventListener('change',autoScheduleSelectedAnalyst);}if($('#myDayDate')){$('#myDayDate').addEventListener('change',renderMyDay);if($('#btnMyDayToday'))$('#btnMyDayToday').onclick=()=>{$('#myDayDate').value=dateToday();renderMyDay()};$('#myDayAnalyst').addEventListener('change',renderMyDay);if($('#btnRestoreBossPlan'))$('#btnRestoreBossPlan').onclick=()=>restoreBossSchedule($('#myDayDate').value,$('#myDayAnalyst').value);}if($('#dailyMonitorDate')){
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
if($('#finishActivityForm'))$('#finishActivityForm').addEventListener('submit',submitFinishActivity);if($('#btnSaveCalibrationDraft'))$('#btnSaveCalibrationDraft').onclick=saveCalibrationDraft;if($('#btnSaveReagentDraft'))$('#btnSaveReagentDraft').onclick=saveReagentDraft;
if($('#btnSaveConfig'))$('#btnSaveConfig').onclick=saveConfig;if($('#btnBackup'))$('#btnBackup').onclick=backup;if($('#btnReset'))$('#btnReset').onclick=resetDB;if($('#localSessionSelect'))$('#localSessionSelect').addEventListener('change',changeLocalSession);if($('#btnFirebaseLogin'))$('#btnFirebaseLogin').onclick=openFirebaseLogin;
if($('#btnFirebaseLogout'))$('#btnFirebaseLogout').onclick=firebaseLogout;
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
window.addEventListener('online',()=>{if(firebaseBridge.ready)resumeCloudSession(true);else initFirebaseBridge()});
window.addEventListener('pageshow',()=>{if(firebaseBridge.ready&&firebaseBridge.authUser)resumeCloudSession(false)});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&firebaseBridge.ready&&firebaseBridge.authUser)resumeCloudSession(false)});
setInterval(()=>{if(firebaseBridge.ready&&firebaseBridge.authUser)scheduleOutboxFlush(200)},10000);
window.addEventListener('offline',()=>setSyncState('LOCAL','Sin conexión · cambios protegidos localmente'));