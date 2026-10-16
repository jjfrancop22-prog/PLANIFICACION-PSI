/* Monitor distribuido V28.21.51: observabilidad, nunca altera operaciones ni outbox. */
(()=>{'use strict';
const COLLECTION='syncHealth', INTERVAL=45000, STALE=180000;
// Punto de corte compartido de esta versión. Se compara con la creación ORIGINAL, no con el reintento.
const ALERTS_SINCE='2026-10-16T14:43:35.000Z';
const ALERTS_SINCE_MS=Date.parse(ALERTS_SINCE);
function incidentCreatedAt(i){const t=Date.parse(i.origin||'');return Number.isFinite(t)?t:null}
function isNewIncident(i){const t=incidentCreatedAt(i);return t!==null&&t>=ALERTS_SINCE_MS}
function recentHeartbeat(x){const t=x.updatedAt?.toMillis?.();return Number.isFinite(t)&&t>=ALERTS_SINCE_MS}

// La revisión es exclusivamente visual: nunca elimina ni altera el outbox.
const REVIEW_KEY='psi-sync-health-reviewed-v1';
const ALERT_KEY='psi-sync-health-alert-seen-v1';
const ALERT_MAX=100;
let feedFromCache=false, lastAlertItems=[];
function seenMap(){try{return JSON.parse(localStorage.getItem(ALERT_KEY)||'{}')||{}}catch{return {}}}
function rememberAlert(key){try{const m=seenMap();m[key]=new Date().toISOString();const keys=Object.keys(m).sort((a,b)=>String(m[b]).localeCompare(String(m[a])));for(const k of keys.slice(ALERT_MAX))delete m[k];localStorage.setItem(ALERT_KEY,JSON.stringify(m))}catch{}}
function incidentKey(x,i){return [x.uid,i.id,i.state,i.error||''].join('|')}
function currentAlerts(){const now=Date.now();const result=[];for(const x of feed){
 for(const i of x.incidents||[]){if(isNewIncident(i)&&['ERROR','CRITICO','DEMORA'].includes(i.state))result.push({key:incidentKey(x,i),uid:x.uid,name:x.name||x.uid,operation:i.operation||i.entity||'Operación',detail:i.detail||i.recordId||'',state:i.state,error:i.error||'',since:i.since||''})}
 if(recentHeartbeat(x)&&now-x.updatedAt.toMillis()>STALE)result.push({key:x.uid+'|SIN_CONTACTO',uid:x.uid,name:x.name||x.uid,operation:'Equipo sin reporte reciente',detail:'Último reporte: '+formatAt(x.updatedAt.toDate?.()||new Date(x.updatedAt.toMillis())),state:'SIN_CONTACTO',error:'No implica pérdida de datos; verificar conexión y sesión.',since:''});
}return result}

function reviewedMap(){try{return JSON.parse(localStorage.getItem(REVIEW_KEY)||'{}')||{}}catch{return {}}}
function reviewSignature(i){return [i.id,i.origin,i.blockedAt,i.status].join('|')}
function isReviewed(i,uid){return reviewedMap()[uid+'|'+i.id]===reviewSignature(i)}
function markReviewed(i,uid){const m=reviewedMap();m[uid+'|'+i.id]=reviewSignature(i);localStorage.setItem(REVIEW_KEY,JSON.stringify(m))}

let lastSignature='', lastSent=0, busy=false, unsubscribe=null, timer=null, feed=[], lastAlert='';
const root=document.createElement('div');root.id='syncHealthWidget';root.style.cssText='position:fixed;right:18px;bottom:18px;z-index:9900;max-width:min(460px,calc(100vw - 36px));font:13px system-ui';
root.innerHTML='<button id="healthToggle" type="button" style="padding:12px 16px;background:#164b75;color:white;border:0;border-radius:10px;cursor:pointer">🛡️ Monitor Firebase</button><section id="healthPanel" hidden style="background:white;color:#18283c;border:1px solid #b9cbdc;border-radius:12px;padding:16px;margin-top:6px;box-shadow:0 6px 25px #0003;max-height:65vh;overflow:auto"><h3 style="margin:0 0 8px">Monitor inteligente de analistas</h3><div id="healthSummary">Esperando conexión…</div><div id="healthNewAlerts" style="margin-top:10px"></div><div id="healthRows" style="margin-top:10px"></div><small>Las operaciones sin conexión solo se conocen cuando el equipo vuelve a comunicarse. No se modifican registros operativos.</small></section>';
document.body.append(root);
// Botón junto a la campana; evita que quede oculto detrás de paneles inferiores.
const bell=document.getElementById('btnNotifications');
if(bell?.parentElement){root.style.cssText='display:inline-flex;position:relative;z-index:30;font:13px system-ui;align-items:center;max-width:100%';bell.insertAdjacentElement('afterend',root);}
const alertBadge=document.createElement('span');alertBadge.id='healthAlertBadge';alertBadge.style.cssText='display:none;position:absolute;right:-5px;top:-5px;background:#b42318;color:white;border-radius:12px;padding:1px 5px;font-size:10px;font-weight:bold;pointer-events:none';alertBadge.textContent='!';bell?.append(alertBadge);
const healthStyle=document.createElement('style');healthStyle.textContent='#healthPanel{position:absolute;right:0;top:calc(100% + 8px);width:min(450px,calc(100vw - 32px));z-index:10001}#healthToggle{white-space:nowrap;font-size:12px}@media(max-width:650px){#healthToggle{font-size:0!important;padding:10px!important}#healthToggle::before{content:"🛡️";font-size:18px}}';document.head.append(healthStyle);
const toggle=root.querySelector('#healthToggle'),panel=root.querySelector('#healthPanel'),summary=root.querySelector('#healthSummary'),rows=root.querySelector('#healthRows'),newAlerts=root.querySelector('#healthNewAlerts');
toggle.addEventListener('click',()=>{panel.hidden=!panel.hidden;render()});
newAlerts.addEventListener('click',e=>{const btn=e.target.closest('button[data-seen]');if(!btn||getProfile()?.role!=='JEFE')return;const a=lastAlertItems.find(x=>x.key===btn.dataset.seen);if(a){rememberAlert(a.key);render()}});
// La campana abre el monitor cuando existen incidencias nuevas, sin alterar su manejador original.
alertBadge.addEventListener('click',()=>{panel.hidden=false;render()});
rows.addEventListener('click',e=>{const button=e.target.closest('button[data-review]');if(!button)return;const p=getProfile(),b=getBridge();if(p?.role!=='JEFE'||!b?.authUser)return;const owner=button.dataset.owner,id=button.dataset.review;const ownerRecord=feed.find(x=>x.uid===owner);const incident=ownerRecord?.incidents?.find(i=>i.id===id&&i.state==='RETENIDA_PERMISOS');if(!incident||owner!==b.authUser.uid)return;const ok=confirm('Marcar esta alerta histórica como revisada SOLO EN ESTE NAVEGADOR?\n\nNo se ha verificado Firebase. La escritura original seguirá pendiente y no se eliminará ni reenviará.');if(!ok)return;try{markReviewed(incident,owner);render()}catch(err){alert('No se pudo guardar la revisión local: '+err.message)}});
function safe(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function getBridge(){return typeof firebaseBridge!=='undefined'?firebaseBridge:null}
function getProfile(){return typeof currentSessionUser!=='undefined'?currentSessionUser:null}
function classify(item){if(item.status==='BLOQUEADO_PERMISOS')return 'RETENIDA_PERMISOS';if(item.status==='CONFLICTO_LOCAL')return 'CRITICO';if(item.status==='ERROR')return 'ERROR';if(item.status==='PENDIENTE'){const age=Date.now()-Date.parse(item.updatedAt||item.createdAt||new Date().toISOString());return Number.isFinite(age)&&age>=120000?'DEMORA':Number.isFinite(age)&&age>=60000?'PREVENTIVA':'PENDIENTE'}return 'OK'}
function label(entity,payload,item){
 if(entity==='planning'){
  if(payload?.status==='REALIZADO'||payload?.completionCommittedAt)return '🏁 Finalización de actividad';
  if(payload?.status==='EN PROCESO')return '▶ Apertura / actualización en proceso';
  return 'Planificación · '+String(payload?.status||'actualización');
 }
 if(entity==='catalog')return '🧪 Inventario / reactivos';
 if(entity==='planComments')return 'Comentario / evidencia de actividad';
 if(entity==='controlChartRecords')return 'Carta de control';
 return entity;
}
function detail(entity,payload){
 if(entity==='planning')return [payload?.activityName,payload?.activity,payload?.catalogName,payload?.code,payload?.analystName].filter(Boolean).slice(0,2).join(' · ').slice(0,110);
 if(entity==='catalog')return String(payload?.name||payload?.productName||'').slice(0,90);
 return '';
}
function formatAt(v){if(!v)return 'Sin fecha';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString('es-EC',{dateStyle:'short',timeStyle:'short'})}
async function tick(){const b=getBridge(),p=getProfile();if(b?.authUser&&p?.status==='ACTIVO'&&b.ready&&!busy){busy=true;try{
 const all=await getAll('outbox');const open=all.filter(x=>['PENDIENTE','ERROR','CONFLICTO_LOCAL','BLOQUEADO_PERMISOS'].includes(x.status));
 const recent=all.filter(x=>x.status==='SINCRONIZADO').sort((a,z)=>String(z.syncedAt||'').localeCompare(String(a.syncedAt||''))).slice(0,12);
 const incidents=open.map(x=>({id:x.id,recordId:x.recordId||'',operation:label(x.entity,x.payload,x),detail:detail(x.entity,x.payload),entity:x.entity,state:classify(x),error:String(x.lastError||'').slice(0,180),since:x.blockedAt||x.updatedAt||x.createdAt,origin:x.createdAt||'',blockedAt:x.blockedAt||'',status:x.status}));
 const signature=JSON.stringify(incidents.map(x=>[x.id,x.state,x.error]));
 // Heartbeat only while app is active; throttled to one write per 45 s. No duplicate incident documents.
 if(Date.now()-lastSent>=INTERVAL||signature!==lastSignature){const sdk=b.mods;const uid=b.authUser.uid;
 await sdk.setDoc(sdk.doc(b.db,COLLECTION,uid),{uid,analystId:p.analystId||'',name:p.name||'',role:p.role,updatedAt:sdk.serverTimestamp(),clientAt:new Date().toISOString(),incidents,confirmed:recent.map(x=>({id:x.id,recordId:x.recordId||'',operation:label(x.entity,x.payload,x),detail:detail(x.entity,x.payload),recordId:x.recordId||"",at:x.syncedAt})),pending:open.length,sessionId:typeof PAGE_SESSION_ID==='string'?PAGE_SESSION_ID:''},{merge:true});lastSent=Date.now();lastSignature=signature;}
 if(p.role==='ANALISTA')feed=[{uid:b.authUser.uid,name:p.name,incidents,confirmed:recent.map(x=>({operation:label(x.entity,x.payload,x),detail:detail(x.entity,x.payload),recordId:x.recordId||"",at:x.syncedAt})),updatedAt:{toMillis:()=>Date.now()}}];render();
 }catch(e){summary.textContent='⚠️ No se pudo publicar el diagnóstico: '+String(e?.message||e).slice(0,120)}finally{busy=false}}
}
function render(){const p=getProfile(),boss=p?.role==='JEFE';root.style.display=p?.status==='ACTIVO'?'inline-flex':'none';toggle.textContent='🛡️ Monitor Firebase'+(boss&&feed.some(x=>x.incidents?.some(i=>isNewIncident(i)&&['ERROR','CRITICO','DEMORA'].includes(i.state)))?' 🔴':'');
const active=feed.flatMap(x=>(x.incidents||[]).filter(i=>isNewIncident(i)&&['ERROR','CRITICO','DEMORA'].includes(i.state)));const disconnected=boss?feed.filter(x=>recentHeartbeat(x)&&Date.now()-x.updatedAt.toMillis()>STALE):[];lastAlertItems=boss?currentAlerts():[];const seen=seenMap();const unread=lastAlertItems.filter(a=>!seen[a.key]);const alertCount=unread.length;if(alertBadge){alertBadge.style.display=boss&&alertCount?'block':'none';alertBadge.textContent=alertCount>99?'99+':String(alertCount)}toggle.style.background=alertCount&&boss?'#ad3434':'#164b75';if(panel.hidden)return;
newAlerts.innerHTML=boss?(lastAlertItems.length?`<div style="border:1px solid #f2c6c0;background:#fff9f8;border-radius:8px;padding:9px"><b>🔔 Incidencias actuales: ${lastAlertItems.length} · Nuevas: ${unread.length}</b><div style="font-size:11px;margin:4px 0">Avisos registrados en este navegador. No son notificaciones push; se actualizan cuando el JEFE tiene el ERP abierto y conectado.</div>${lastAlertItems.slice(0,20).map(a=>`<div style="border-top:1px solid #edd;padding:7px 0"><b>${safe(a.state)} · ${safe(a.name)}</b><br>${safe(a.operation)}${a.detail?' · '+safe(a.detail):''}<br><small>${safe(a.error||a.since||'')}</small>${!seen[a.key]?`<br><button type="button" data-seen="${safe(a.key)}" style="padding:4px 8px;cursor:pointer">Marcar aviso como leído</button>`:'<br><small>✓ Aviso leído; la incidencia continúa activa.</small>'}</div>`).join('')}</div>`:'<div style="color:#246c43">✓ Sin incidencias activas nuevas detectadas.</div>'):'';
const alerts=feed.flatMap(x=>(x.incidents||[]).filter(i=>isNewIncident(i)&&['ERROR','CRITICO','DEMORA'].includes(i.state)).map(i=>({name:x.name,...i})));
summary.textContent=`${boss?'Todos los usuarios':'Mis operaciones'} · ${feed.length} usuario(s) reportando · ${alerts.length} incidencia(s) · ${disconnected.length} sin contacto${feedFromCache?' · ⚠️ lectura desde caché':''}`;
rows.innerHTML='<p style="font-size:12px;color:#765b23">Alertas activas solo desde V28.21.57 (16/10/2026, 14:43 UTC). Las operaciones anteriores siguen conservadas en los equipos y en el diagnóstico, pero no generan avisos. No se borran ni se reintentan escrituras.</p>'+feed.map(x=>{const age=x.updatedAt?.toMillis?Date.now()-x.updatedAt.toMillis():Infinity;const stale=recentHeartbeat(x)&&age>STALE;const allIncidents=x.incidents||[];const incidents=allIncidents.filter(isNewIncident);const historicCount=allIncidents.length-incidents.length;const confirmed=x.confirmed||[];const retained=incidents.filter(i=>i.state==='RETENIDA_PERMISOS');const reviewed=retained.filter(i=>isReviewed(i,x.uid));const visible=incidents.filter(i=>!isReviewed(i,x.uid));return `<div style="border-top:1px solid #ddd;padding:9px 0"><b>${safe(x.name||x.uid)}</b> ${stale?'🟠 Sin reporte reciente':incidents.some(i=>['CRITICO','ERROR'].includes(i.state))?'🔴 Incidencia':incidents.some(i=>i.state==='DEMORA')?'🟠 Demora':'🟢 Reportando'}<div>${incidents.length} pendiente(s) desde esta versión · ${historicCount} histórica(s) oculta(s) · ${retained.length} retenida(s) por permisos · ${reviewed.length} revisada(s) visualmente · ${confirmed.length} confirmación(es) recientes</div>${visible.slice(0,10).map(i=>`<div style="padding:6px;background:#fff5ed;margin:3px 0">${safe(i.state==='RETENIDA_PERMISOS'?'RETENIDA HISTÓRICA (sin verificación de servidor)':i.state)} · ${safe(i.operation)} · ${safe(i.detail||i.recordId)}<br><small>${safe(i.error)}${i.origin?' · Creada: '+safe(i.origin):''}${i.blockedAt?' · Retenida: '+safe(i.blockedAt):''}</small>${boss&&x.uid===getBridge()?.authUser?.uid&&i.state==='RETENIDA_PERMISOS'?`<br><button type="button" data-owner="${safe(x.uid)}" data-review="${safe(i.id)}" style="margin-top:6px;padding:6px 10px;border:1px solid #b8a27a;border-radius:6px;background:white;cursor:pointer">Marcar alerta como revisada (sin borrar operación)</button>`:''}</div>`).join('')}${reviewed.length?`<details><summary>${reviewed.length} alerta(s) histórica(s) revisada(s) — las operaciones siguen pendientes</summary>${reviewed.map(i=>`<small style="display:block">${safe(i.id)} · ${safe(i.origin||'Sin fecha')}</small>`).join('')}</details>`:''}${confirmed.slice(0,8).map(i=>`<small style="display:block">✓ ${safe(i.operation)}${i.detail?" · "+safe(i.detail):""} · ${safe(formatAt(i.at))}</small>`).join('')}</div>`}).join('')||'<p>No hay reportes disponibles todavía.</p>';
const key=alerts.map(a=>a.name+a.id+a.state).concat(disconnected.map(x=>x.uid+'SIN_CONTACTO')).sort().join('|');if(boss&&key&&key!==lastAlert){lastAlert=key;toggle.style.background='#ad3434';}else if(!key){lastAlert='';toggle.style.background='#164b75'}
}
function listen(){const b=getBridge(),p=getProfile();if(unsubscribe){unsubscribe();unsubscribe=null}feed=[];lastSignature='';lastSent=0;if(!b?.ready||!b.authUser||!p||p.status!=='ACTIVO')return;
const sdk=b.mods;const ref=p.role==='JEFE'?sdk.collection(b.db,COLLECTION):sdk.doc(b.db,COLLECTION,b.authUser.uid);
unsubscribe=sdk.onSnapshot(ref,s=>{feedFromCache=!!s.metadata?.fromCache;feed=p.role==='JEFE'?s.docs.map(d=>d.data()):s.exists()?[s.data()]:[];render()},e=>{summary.textContent='Error de lectura del monitor: '+e.message});tick();}
let authKey='';timer=setInterval(()=>{const b=getBridge(),p=getProfile(),key=(b?.authUser?.uid||'')+'|'+(p?.role||'')+'|'+(p?.status||'');if(key!==authKey){authKey=key;listen()}tick();render()},INTERVAL);
setTimeout(()=>{authKey='initial';listen()},3000);
})();
