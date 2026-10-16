'use strict';
// Backend opcional para desplegar en Firebase Functions tras configurar permisos.
// NO se invoca desde el cliente hasta realizar pruebas de integración.
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const admin=require('firebase-admin');
const {requestFingerprint}=require('./request-fingerprint.cjs');
const {key,deltas,adjustStock}=require('./consumption-core.cjs');
const {validateCorrectionScope,validateCatalogCoverage}=require('./authorization-core.cjs');
admin.initializeApp();
const db=admin.firestore();
exports.correctCountConsumption=onCall({region:'us-central1'},async request=>{
  if(!request.auth)throw new HttpsError('unauthenticated','Inicie sesión');
  const {planId,items,expectedRevision,requestId,reason,authorizationId}=request.data||{};
  if(typeof planId!=='string'||!planId||!Array.isArray(items)||items.length>100||typeof requestId!=='string'||!/^[\w-]{8,100}$/.test(requestId))throw new HttpsError('invalid-argument','Solicitud inválida');
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw new HttpsError('invalid-argument','Revisión inválida');
  const userSnap=await db.doc(`users/${request.auth.uid}`).get();
  const user=userSnap.data();
  if(!userSnap.exists||user.status!=='ACTIVO')throw new HttpsError('permission-denied','Usuario inactivo');
  const fingerprint=requestFingerprint(planId,items,expectedRevision,JSON.stringify({reason,authorizationId:authorizationId||null}));
  const planRef=db.doc(`planning/${planId}`),auditRef=db.doc(`audit/COUNT-${requestId}`);
  const authorizationRef=(typeof authorizationId==='string'&&/^TECH-AUTH-[\w-]{8,100}$/.test(authorizationId))?db.doc(`audit/${authorizationId}`):null;
  try{return await db.runTransaction(async tx=>{
    const planSnap=await tx.get(planRef),auditSnap=await tx.get(auditRef);
    const authorizationSnap=authorizationRef?await tx.get(authorizationRef):null;
    if(auditSnap.exists){if(auditSnap.data().actorUid!==request.auth.uid||auditSnap.data().planId!==planId||auditSnap.data().fingerprint!==fingerprint)throw Error('Identificador de solicitud utilizado con datos distintos');return {ok:true,alreadyApplied:true,revision:auditSnap.data().revision};}
    if(!planSnap.exists)throw Error('Actividad no encontrada');
    const plan=planSnap.data(),closed=plan.status==='REALIZADO'||!!plan.completionCommittedAt;
    if(user.role!=='JEFE'){
      if(closed)throw Error('Actividad finalizada: requiere JEFE');
      if(user.role!=='ANALISTA'||String(user.analystId||'')!==String(plan.analystId||''))throw Error('No es el analista asignado');
    }else if(closed){
      if(!authorizationSnap?.exists)throw Error('Se requiere autorización previa del JEFE');
      const authorization=authorizationSnap.data();
      if(authorization.action!=='AUTORIZAR_EDICION_TECNICA'||authorization.planId!==planId||authorization.actorUid!==request.auth.uid||authorization.usedByRequestId)throw Error('Autorización inválida o utilizada');
      if(!String(reason||'').trim()||String(reason).trim().length<10)throw Error('Motivo del JEFE obligatorio');
    }
    if(!plan.catalogId)throw Error('Actividad sin catálogo asignado');
    const old=plan.reagentResult;
    if(!old?.inventoryCommittedAt)throw Error('No existe consumo previo confirmado');
    const revision=Number(old.correctionRevision||0);
    if(revision!==expectedRevision)throw Error('El consumo fue modificado en otra computadora');
    validateCorrectionScope(old.items,items);
    const delta=deltas(old.items,items),keys=[...delta.keys()];
    const catalogSnap=await tx.get(db.doc(`catalog/${plan.catalogId}`));
    if(!catalogSnap.exists)throw Error('Catálogo asignado no encontrado');
    const matches=[catalogSnap];
    if(!matches.length)throw Error('Lotes no encontrados');
    validateCatalogCoverage(plan,matches.map(d=>d.data()),old.items);
    // Los documentos del query transaccional ya están leídos en esta transacción.
    const live=matches;
    const baseline=new Map();
    for(const snap of live)for(const r of snap.data().reagentConfig||[]){const k=key(r);if(!delta.has(k))continue;if(r.mode!=='COUNT')throw Error('Modo incompatible');const n=Number(r.stockQuantity);if(!Number.isFinite(n))throw Error('Stock inválido');if(baseline.has(k))throw Error('Lote duplicado en catálogo asignado');baseline.set(k,n);}
    for(const k of keys){if(!baseline.has(k))throw Error('Lote no encontrado');adjustStock(baseline.get(k),delta.get(k));}
    const stamp=new Date().toISOString();
    for(const snap of live){const data=snap.data();tx.update(snap.ref,{reagentConfig:(data.reagentConfig||[]).map(r=>{const k=key(r);if(!delta.has(k))return r;const stock=adjustStock(baseline.get(k),delta.get(k));return {...r,stockQuantity:stock,inventoryStatus:stock<=0?'AGOTADO':'ACTIVO'};}),updatedAt:stamp});}
    tx.update(planRef,{reagentResult:{...old,items,inventoryCommittedAt:stamp,correctionRevision:revision+1},updatedAt:stamp});
    if(closed)tx.update(authorizationRef,{usedByRequestId:requestId,usedAt:stamp});
    tx.create(auditRef,{action:'CORRECCION_CONSUMO_COUNT',actorUid:request.auth.uid,planId,requestId,fingerprint,reason:String(reason||''),authorizationId:closed?authorizationId:null,createdAt:stamp,revision:revision+1,delta:Object.fromEntries(delta),previous:old.items,next:items});
    return {ok:true,revision:revision+1,delta:Object.fromEntries(delta)};
  });}catch(err){throw new HttpsError('failed-precondition',String(err.message||err));}
});

// Registro inicial COUNT: consumo e inventario en una única transacción.
// No altera la ruta antigua del cliente hasta que se complete la migración controlada.
const {initialDeltas,validateInitialPlan,computeInitialStock}=require('./initial-count.cjs');
exports.commitInitialCountConsumption=onCall({region:'us-central1'},async request=>{
  if(!request.auth)throw new HttpsError('unauthenticated','Inicie sesión');
  const {planId,items,requestId}=request.data||{};
  if(typeof planId!=='string'||!planId||!Array.isArray(items)||items.length>100||typeof requestId!=='string'||!/^[\w-]{8,100}$/.test(requestId))throw new HttpsError('invalid-argument','Solicitud inválida');
  const userSnap=await db.doc(`users/${request.auth.uid}`).get();
  const user=userSnap.data();
  if(!userSnap.exists||user.status!=='ACTIVO')throw new HttpsError('permission-denied','Usuario inactivo');
  const fingerprint=requestFingerprint(planId,items,null,null);
  const planRef=db.doc(`planning/${planId}`),auditRef=db.doc(`audit/INITIAL-COUNT-${requestId}`);
  try{return await db.runTransaction(async tx=>{
    const [planSnap,auditSnap]=await Promise.all([tx.get(planRef),tx.get(auditRef)]);
    if(auditSnap.exists){
      const audit=auditSnap.data();
      if(audit.actorUid!==request.auth.uid||audit.planId!==planId||audit.fingerprint!==fingerprint)throw Error('Identificador reutilizado con datos distintos');
      return {ok:true,alreadyApplied:true};
    }
    if(!planSnap.exists)throw Error('Actividad no encontrada');
    const plan=planSnap.data();validateInitialPlan(plan,user);
    if(plan.reagentResult?.inventoryCommittedAt)throw Error('El consumo inicial ya fue confirmado: actualice antes de corregir');
    const delta=initialDeltas(items);
    if(!delta.size)throw Error('Sin consumos COUNT para registrar');
    const catalogSnap=await tx.get(db.doc(`catalog/${plan.catalogId}`));
    if(!catalogSnap.exists)throw Error('Catálogo asignado no encontrado');
    const matches=[catalogSnap];
    if(!matches.length)throw Error('Reactivos no encontrados');
    validateCatalogCoverage(plan,matches.map(d=>d.data()),items);
    const balances=new Map();
    for(const c of matches){for(const r of c.data().reagentConfig||[]){
      const k=key(r);if(!delta.has(k))continue;
      if(r.mode!=='COUNT')throw Error('Reactivo no contable');
      const stock=Number(r.stockQuantity);
      if(!Number.isSafeInteger(stock)||stock<0)throw Error('Saldo inválido');
      if(balances.has(k))throw Error('Lote duplicado en catálogo asignado');
      balances.set(k,stock);
    }}
    for(const [k,used] of delta){if(!balances.has(k))throw Error('Lote no encontrado');computeInitialStock(balances.get(k),used);}
    const stamp=new Date().toISOString();
    for(const c of matches){tx.update(c.ref,{
      reagentConfig:(c.data().reagentConfig||[]).map(r=>{
        const k=key(r);if(!delta.has(k))return r;
        const stock=computeInitialStock(balances.get(k),delta.get(k));
        return {...r,stockQuantity:stock,inventoryStatus:stock<=0?'AGOTADO':'ACTIVO'};
      }),updatedAt:stamp
    });}
    tx.update(planRef,{reagentResult:{completed:true,items,inventoryCommittedAt:stamp,correctionRevision:0},updatedAt:stamp});
    tx.create(auditRef,{action:'CONSUMO_INICIAL_COUNT',actorUid:request.auth.uid,planId,requestId,fingerprint,createdAt:stamp,delta:Object.fromEntries(delta)});
    return {ok:true,inventoryCommittedAt:stamp};
  });}catch(err){throw new HttpsError('failed-precondition',String(err.message||err));}
});

// Autorización auditada del JEFE: solo el servidor puede emitir el registro.
// No cambia inventario ni desbloquea por sí sola una actividad cerrada.
exports.authorizeCompletedTechnicalEdit=onCall({region:'us-central1'},async request=>{
  if(!request.auth)throw new HttpsError('unauthenticated','Inicie sesión');
  const {planId,reason,requestId}=request.data||{};
  if(typeof planId!=='string'||!planId||typeof reason!=='string'||reason.trim().length<10||reason.length>1000||typeof requestId!=='string'||!/^[\w-]{8,100}$/.test(requestId))throw new HttpsError('invalid-argument','Datos de autorización inválidos');
  const userSnap=await db.doc(`users/${request.auth.uid}`).get();
  if(!userSnap.exists||userSnap.data().status!=='ACTIVO'||userSnap.data().role!=='JEFE')throw new HttpsError('permission-denied','Solo JEFE activo puede autorizar');
  const ref=db.doc(`planning/${planId}`),audit=db.doc(`audit/TECH-AUTH-${requestId}`);
  const fingerprint=requestFingerprint(planId,[],null,reason.trim());
  try{return await db.runTransaction(async tx=>{
    const [planSnap,auditSnap]=await Promise.all([tx.get(ref),tx.get(audit)]);
    if(auditSnap.exists){const a=auditSnap.data();if(a.actorUid!==request.auth.uid||a.fingerprint!==fingerprint)throw Error('Identificador reutilizado');return {ok:true,alreadyApplied:true,authorizationId:audit.id};}
    if(!planSnap.exists||planSnap.data().status!=='REALIZADO')throw Error('Actividad no finalizada o inexistente');
    if(!planSnap.data().reagentResult?.inventoryCommittedAt)throw Error('Sin consumo confirmado');
    tx.create(audit,{action:'AUTORIZAR_EDICION_TECNICA',planId,actorUid:request.auth.uid,reason:reason.trim(),fingerprint,createdAt:admin.firestore.FieldValue.serverTimestamp(),note:'Autorización de un solo uso para corrección COUNT post-cierre'});
    return {ok:true,authorizationId:audit.id};
  });}catch(e){throw new HttpsError('failed-precondition',String(e.message||e));}
});

// Informe de preparación para migración WEIGHT: no modifica inventario.
const {inspectWeightCatalog}=require('./weight-readiness.cjs');
exports.inspectWeightInventoryReadiness=onCall({region:'us-central1'},async request=>{
 if(!request.auth)throw new HttpsError('unauthenticated','Inicie sesión');
 const userSnap=await db.doc(`users/${request.auth.uid}`).get();
 if(!userSnap.exists||userSnap.data().status!=='ACTIVO'||userSnap.data().role!=='JEFE')throw new HttpsError('permission-denied','Solo JEFE activo puede consultar la conciliación');
 const snapshot=await db.collection('catalog').get();
 return inspectWeightCatalog(snapshot.docs.map(d=>({id:d.id,...d.data()})));
});

// Corrección WEIGHT transaccional de catálogo asignado, habilitada solo
// cuando los envases tienen currentWeight conciliado. Cliente aún no conectado.
const {computeWeightCatalogCorrection}=require('./weight-commit-core.cjs');
exports.correctWeightConsumption=onCall({region:'us-central1'},async request=>{
 if(!request.auth)throw new HttpsError('unauthenticated','Inicie sesión');
 const {planId,items,expectedRevision,requestId,reason,authorizationId}=request.data||{};
 if(typeof planId!=='string'||!planId||!Array.isArray(items)||items.length>100||
    !Number.isSafeInteger(expectedRevision)||expectedRevision<0||
    typeof requestId!=='string'||!/^[\w-]{8,100}$/.test(requestId))throw new HttpsError('invalid-argument','Solicitud inválida');
 const userSnap=await db.doc(`users/${request.auth.uid}`).get();
 const user=userSnap.data();
 if(!userSnap.exists||user.status!=='ACTIVO')throw new HttpsError('permission-denied','Usuario inactivo');
 const planRef=db.doc(`planning/${planId}`),auditRef=db.doc(`audit/WEIGHT-${requestId}`);
 const authRef=typeof authorizationId==='string'&&/^TECH-AUTH-[\w-]{8,100}$/.test(authorizationId)?db.doc(`audit/${authorizationId}`):null;
 const fingerprint=requestFingerprint(planId,items,expectedRevision,JSON.stringify({reason,authorizationId:authorizationId||null}));
 try{return await db.runTransaction(async tx=>{
  const planSnap=await tx.get(planRef),auditSnap=await tx.get(auditRef);
  const authSnap=authRef?await tx.get(authRef):null;
  if(auditSnap.exists){const a=auditSnap.data();if(a.actorUid!==request.auth.uid||a.planId!==planId||a.fingerprint!==fingerprint)throw Error('Solicitud reutilizada con datos diferentes');return {ok:true,alreadyApplied:true,revision:a.revision};}
  if(!planSnap.exists)throw Error('Actividad no encontrada');
  const plan=planSnap.data(),closed=plan.status==='REALIZADO'||!!plan.completionCommittedAt;
  if(user.role!=='JEFE'&&(closed||user.role!=='ANALISTA'||String(user.analystId||'')!==String(plan.analystId||'')))throw Error('Analista no autorizado');
  if(closed){
   if(user.role!=='JEFE'||!authSnap?.exists)throw Error('Requiere autorización del JEFE');
   const auth=authSnap.data();
   if(auth.action!=='AUTORIZAR_EDICION_TECNICA'||auth.planId!==planId||auth.actorUid!==request.auth.uid||auth.usedByRequestId)throw Error('Autorización inválida');
   if(typeof reason!=='string'||reason.trim().length<10)throw Error('Motivo obligatorio');
  }
  if(!plan.catalogId)throw Error('Actividad sin catálogo');
  const catalogRef=db.doc(`catalog/${plan.catalogId}`),catalogSnap=await tx.get(catalogRef);
  if(!catalogSnap.exists)throw Error('Catálogo no encontrado');
  const old=plan.reagentResult,revision=Number(old?.correctionRevision||0);
  if(revision!==expectedRevision)throw Error('Consumo modificado en otra computadora');
  const {reagentConfig,updates}=computeWeightCatalogCorrection(plan,{id:catalogSnap.id,...catalogSnap.data()},items);
  const stamp=new Date().toISOString();
  tx.update(catalogRef,{reagentConfig,updatedAt:stamp});
  tx.update(planRef,{reagentResult:{...old,items,inventoryCommittedAt:stamp,correctionRevision:revision+1},updatedAt:stamp});
  if(closed)tx.update(authRef,{usedByRequestId:requestId,usedAt:stamp});
  tx.create(auditRef,{action:'CORRECCION_CONSUMO_WEIGHT',actorUid:request.auth.uid,planId,requestId,fingerprint,authorizationId:closed?authorizationId:null,reason:String(reason||''),revision:revision+1,createdAt:stamp,previous:old.items,next:items,updates});
  return {ok:true,revision:revision+1,updatedContainers:updates.length};
 });}catch(e){throw new HttpsError('failed-precondition',String(e.message||e));}
});

// Primer consumo WEIGHT: transacción atómica; no se activa en la UI hasta
// validar migración, permisos y sincronización con el emulador Firebase.
const {computeInitialWeightCatalog}=require('./weight-initial-core.cjs');
exports.commitInitialWeightConsumption=onCall({region:'us-central1'},async request=>{
 if(!request.auth)throw new HttpsError('unauthenticated','Inicie sesión');
 const {planId,items,requestId}=request.data||{};
 if(typeof planId!=='string'||!planId||!Array.isArray(items)||items.length>100||typeof requestId!=='string'||!/^[\w-]{8,100}$/.test(requestId))throw new HttpsError('invalid-argument','Solicitud inválida');
 const userSnap=await db.doc(`users/${request.auth.uid}`).get();
 if(!userSnap.exists||userSnap.data().status!=='ACTIVO')throw new HttpsError('permission-denied','Usuario inactivo');
 const user=userSnap.data(),planRef=db.doc(`planning/${planId}`),auditRef=db.doc(`audit/INITIAL-WEIGHT-${requestId}`);
 const fingerprint=requestFingerprint(planId,items,null,null);
 try{return await db.runTransaction(async tx=>{
  const [planSnap,auditSnap]=await Promise.all([tx.get(planRef),tx.get(auditRef)]);
  if(auditSnap.exists){const a=auditSnap.data();if(a.actorUid!==request.auth.uid||a.planId!==planId||a.fingerprint!==fingerprint)throw Error('Identificador reutilizado');return {ok:true,alreadyApplied:true,inventoryCommittedAt:a.createdAt};}
  if(!planSnap.exists)throw Error('Actividad no encontrada');
  const plan=planSnap.data();validateInitialPlan(plan,user);
  if(!plan.catalogId)throw Error('Actividad sin catálogo');
  const catalogRef=db.doc(`catalog/${plan.catalogId}`),catalogSnap=await tx.get(catalogRef);
  if(!catalogSnap.exists)throw Error('Catálogo no encontrado');
  const {reagentConfig,updates}=computeInitialWeightCatalog(plan,{id:catalogSnap.id,...catalogSnap.data()},items);
  const stamp=new Date().toISOString();
  tx.update(catalogRef,{reagentConfig,updatedAt:stamp});
  tx.update(planRef,{reagentResult:{completed:true,items,inventoryCommittedAt:stamp,correctionRevision:0},updatedAt:stamp});
  tx.create(auditRef,{action:'CONSUMO_INICIAL_WEIGHT',actorUid:request.auth.uid,planId,requestId,fingerprint,createdAt:stamp,updates});
  return {ok:true,inventoryCommittedAt:stamp,updatedContainers:updates.length};
 });}catch(e){throw new HttpsError('failed-precondition',String(e.message||e));}
});

// V28.21.58: actualización acotada de curva técnica sin sobrescribir reagentResult.
exports.saveTechnicalMetadata=onCall({region:'us-central1'},async request=>{
  if(!request.auth)throw new HttpsError('unauthenticated','Inicie sesión');
  const {planId,calibrationResult,expectedTechnicalEditedAt,requestId}=request.data||{};
  if(typeof planId!=='string'||!planId||typeof requestId!=='string'||!/^[\w-]{8,100}$/.test(requestId))throw new HttpsError('invalid-argument','Solicitud inválida');
  if(expectedTechnicalEditedAt!==null&&expectedTechnicalEditedAt!==undefined&&typeof expectedTechnicalEditedAt!=='string')throw new HttpsError('invalid-argument','Versión técnica inválida');
  if(calibrationResult!==null&&(typeof calibrationResult!=='object'||Array.isArray(calibrationResult)))throw new HttpsError('invalid-argument','Curva inválida');
  if(JSON.stringify(calibrationResult).length>120000)throw new HttpsError('invalid-argument','Curva demasiado extensa');
  const userSnap=await db.doc(`users/${request.auth.uid}`).get();
  if(!userSnap.exists||userSnap.data().status!=='ACTIVO')throw new HttpsError('permission-denied','Usuario inactivo');
  const planRef=db.doc(`planning/${planId}`),auditRef=db.doc(`audit/TECH-${requestId}`);
  const fingerprint=requestFingerprint(planId,{calibrationResult,expectedTechnicalEditedAt:expectedTechnicalEditedAt??null},null,'TECH');
  try{return await db.runTransaction(async tx=>{
    const [planSnap,auditSnap]=await Promise.all([tx.get(planRef),tx.get(auditRef)]);
    if(auditSnap.exists){
      if(auditSnap.data().fingerprint!==fingerprint||auditSnap.data().actorUid!==request.auth.uid)throw Error('Solicitud reutilizada con datos diferentes');
      return {ok:true,alreadyApplied:true};
    }
    if(!planSnap.exists)throw Error('Actividad no encontrada');
    const plan=planSnap.data(),user=userSnap.data();
    if(user.role!=='JEFE'&&(user.role!=='ANALISTA'||String(user.analystId||'')!==String(plan.analystId||'')))throw Error('Usuario no autorizado');
    if(plan.status==='REALIZADO'||plan.completionCommittedAt)throw Error('Curva posterior al cierre requiere autorización y flujo específico');
    if(!plan.reagentResult?.inventoryCommittedAt)throw Error('Consumo no confirmado');
    if(String(plan.technicalEditedAt||'')!==String(expectedTechnicalEditedAt||''))throw Error('Datos técnicos modificados en otra computadora; actualice antes de guardar');
    const stamp=new Date().toISOString();
    const patch={technicalEditedAt:stamp,technicalEditedBy:request.auth.uid,updatedAt:stamp};
    if(calibrationResult!==null)patch.calibrationResult=calibrationResult;
    tx.update(planRef,patch);
    tx.create(auditRef,{action:'GUARDAR_METADATOS_TECNICOS',actorUid:request.auth.uid,planId,fingerprint,createdAt:stamp});
    return {ok:true,technicalEditedAt:stamp};
  });}catch(err){throw new HttpsError('failed-precondition',String(err.message||err));}
});

// V28.21.58: cierre autoritativo; nunca reescribir planificación completa desde la cola.
exports.finalizeActivitySafely=onCall({region:'us-central1'},async request=>{
  if(!request.auth)throw new HttpsError('unauthenticated','Inicie sesión');
  const {planId,actualSamples,calibrationResult,expectedRevision,expectedTechnicalEditedAt,requestId}=request.data||{};
  if(typeof planId!=='string'||!planId||typeof requestId!=='string'||!/^[-\w]{8,100}$/.test(requestId))throw new HttpsError('invalid-argument','Solicitud inválida');
  if(actualSamples!==null&&actualSamples!==undefined&&(!Number.isSafeInteger(actualSamples)||actualSamples<0))throw new HttpsError('invalid-argument','Muestras inválidas');
  if(calibrationResult!==null&&calibrationResult!==undefined&&(typeof calibrationResult!=='object'||Array.isArray(calibrationResult)||JSON.stringify(calibrationResult).length>120000))throw new HttpsError('invalid-argument','Curva inválida');
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw new HttpsError('invalid-argument','Revisión inválida');
  if(expectedTechnicalEditedAt!==null&&expectedTechnicalEditedAt!==undefined&&typeof expectedTechnicalEditedAt!=='string')throw new HttpsError('invalid-argument','Versión técnica inválida');
  const userSnap=await db.doc(`users/${request.auth.uid}`).get();
  if(!userSnap.exists||userSnap.data().status!=='ACTIVO')throw new HttpsError('permission-denied','Usuario inactivo');
  const fingerprint=requestFingerprint(planId,{actualSamples:actualSamples??null,calibrationResult:calibrationResult??null,expectedTechnicalEditedAt:expectedTechnicalEditedAt??null},expectedRevision,'FINAL');
  const planRef=db.doc(`planning/${planId}`),auditRef=db.doc(`audit/FINAL-${requestId}`);
  try{return await db.runTransaction(async tx=>{
    const [planSnap,auditSnap]=await Promise.all([tx.get(planRef),tx.get(auditRef)]);
    if(auditSnap.exists){const a=auditSnap.data();if(a.fingerprint!==fingerprint||a.actorUid!==request.auth.uid)throw Error('Solicitud reutilizada con otros datos');return {ok:true,alreadyApplied:true,finishedAt:a.finishedAt};}
    if(!planSnap.exists)throw Error('Actividad inexistente');
    const plan=planSnap.data(),user=userSnap.data();
    if(user.role!=='JEFE'&&(user.role!=='ANALISTA'||String(user.analystId||'')!==String(plan.analystId||'')))throw Error('Actividad de otro analista');
    if(plan.status==='REALIZADO'||plan.completionCommittedAt)throw Error('Actividad ya finalizada');
    if(plan.status!=='EN PROCESO'||!plan.actualStartedAt)throw Error('La apertura no está confirmada');
    if(Number(plan.reagentResult?.correctionRevision||0)!==expectedRevision)throw Error('Consumos modificados desde otra computadora');
    if(plan.reagentResult?.completed&&!plan.reagentResult?.inventoryCommittedAt)throw Error('Inventario no confirmado');
    if(String(plan.technicalEditedAt||'')!==String(expectedTechnicalEditedAt||''))throw Error('Los datos técnicos fueron modificados desde otra computadora; actualice antes de finalizar');
    if(calibrationResult?.completed!==undefined&&plan.calibrationResult?.completed&&calibrationResult?.completed===false)throw Error('No se puede eliminar la curva');
    const stamp=new Date().toISOString();
    const patch={status:'REALIZADO',actualFinishedAt:stamp,completionCommittedAt:stamp,completionCommittedBy:request.auth.uid,completionOperationId:`FINAL-${planId.replace(/[^a-zA-Z0-9_-]/g,'_')}`,updatedAt:stamp};
    if(actualSamples!==null&&actualSamples!==undefined)patch.actualSamples=actualSamples;
    if(calibrationResult!==null&&calibrationResult!==undefined)patch.calibrationResult=calibrationResult;
    tx.update(planRef,patch);
    tx.create(auditRef,{action:'FINALIZAR_ACTIVIDAD_TRANSACCIONAL',actorUid:request.auth.uid,planId,fingerprint,finishedAt:stamp,createdAt:stamp});
    return {ok:true,finishedAt:stamp};
  });}catch(err){throw new HttpsError('failed-precondition',String(err.message||err));}
});
