/* Monitor distribuido V28.21.51: observabilidad, nunca altera operaciones ni outbox. */
(()=>{'use strict';
const COLLECTION='syncHealth', INTERVAL=45000, STALE=180000;
let lastSignature='', lastSent=0, busy=false, unsubscribe=null, timer=null, feed=[], lastAlert='';
const root=document.createElement('div');root.id='syncHealthWidget';root.style.cssText='position:fixed;right:18px;bottom:18px;z-index:9900;max-width:min(460px,calc(100vw - 36px));font:13px system-ui';
root.innerHTML='<button id="healthToggle" type="button" style="padding:12px 16px;background:#164b75;color:white;border:0;border-radius:10px;cursor:pointer">🛡️ Monitor Firebase</button><section id="healthPanel" hidden style="background:white;color:#18283c;border:1px solid #b9cbdc;border-radius:12px;padding:16px;margin-top:6px;box-shadow:0 6px 25px #0003;max-height:65vh;overflow:auto"><h3 style="margin:0 0 8px">Monitor inteligente de analistas</h3><div id="healthSummary">Esperando conexión…</div><div id="healthRows" style="margin-top:10px"></div><small>Las operaciones sin conexión solo se conocen cuando el equipo vuelve a comunicarse. No se modifican registros operativos.</small></section>';
document.body.append(root);
const toggle=root.querySelector('#healthToggle'),panel=root.querySelector('#healthPanel'),summary=root.querySelector('#healthSummary'),rows=root.querySelector('#healthRows');
toggle.addEventListener('click',()=>{panel.hidden=!panel.hidden;render()});
function safe(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function getBridge(){return typeof firebaseBridge!=='undefined'?firebaseBridge:null}
function getProfile(){return typeof currentSessionUser!=='undefined'?currentSessionUser:null}
function classify(item){if(item.status==='CONFLICTO_LOCAL'||item.status==='BLOQUEADO_PERMISOS')return 'CRITICO';if(item.status==='ERROR')return 'ERROR';if(item.status==='PENDIENTE'){const age=Date.now()-Date.parse(item.updatedAt||item.createdAt||new Date().toISOString());return age>=120000?'DEMORA':age>=60000?'PREVENTIVA':'PENDIENTE'}return 'OK'}
function label(entity,payload){if(entity==='planning'){if(payload?.status==='REALIZADO'||payload?.completionCommittedAt)return 'Finalización';if(payload?.status==='EN PROCESO')return 'Apertura / actualización';return 'Planificación / reactivos'}if(entity==='catalog')return 'Inventario / reactivos';return entity}
async function tick(){const b=getBridge(),p=getProfile();if(b?.authUser&&p?.status==='ACTIVO'&&b.ready&&!busy){busy=true;try{
 const all=await getAll('outbox');const open=all.filter(x=>['PENDIENTE','ERROR','CONFLICTO_LOCAL','BLOQUEADO_PERMISOS'].includes(x.status));
 const recent=all.filter(x=>x.status==='SINCRONIZADO').sort((a,z)=>String(z.syncedAt||'').localeCompare(String(a.syncedAt||''))).slice(0,12);
 const incidents=open.map(x=>({id:x.id,recordId:x.recordId||'',operation:label(x.entity,x.payload),entity:x.entity,state:classify(x),error:String(x.lastError||'').slice(0,180),since:x.updatedAt||x.createdAt}));
 const signature=JSON.stringify(incidents.map(x=>[x.id,x.state,x.error]));
 // Heartbeat only while app is active; throttled to one write per 45 s. No duplicate incident documents.
 if(Date.now()-lastSent>=INTERVAL||signature!==lastSignature){const sdk=b.mods;const uid=b.authUser.uid;
 await sdk.setDoc(sdk.doc(b.db,COLLECTION,uid),{uid,analystId:p.analystId||'',name:p.name||'',role:p.role,updatedAt:sdk.serverTimestamp(),clientAt:new Date().toISOString(),incidents,confirmed:recent.map(x=>({id:x.id,recordId:x.recordId||'',operation:label(x.entity,x.payload),at:x.syncedAt})),pending:open.length,sessionId:typeof PAGE_SESSION_ID==='string'?PAGE_SESSION_ID:''},{merge:true});lastSent=Date.now();lastSignature=signature;}
 if(p.role==='ANALISTA')feed=[{uid:b.authUser.uid,name:p.name,incidents,confirmed:recent.map(x=>({operation:label(x.entity,x.payload),at:x.syncedAt})),updatedAt:{toMillis:()=>Date.now()}}];render();
 }catch(e){summary.textContent='⚠️ No se pudo publicar el diagnóstico: '+String(e?.message||e).slice(0,120)}finally{busy=false}}
}
function render(){const p=getProfile(),boss=p?.role==='JEFE';toggle.textContent='🛡️ Monitor Firebase'+(boss&&feed.some(x=>x.incidents?.some(i=>['ERROR','CRITICO','DEMORA'].includes(i.state)))?' 🔴':'');
if(panel.hidden)return;
const alerts=feed.flatMap(x=>(x.incidents||[]).filter(i=>['ERROR','CRITICO','DEMORA'].includes(i.state)).map(i=>({name:x.name,...i})));
summary.textContent=`${boss?'Todos los usuarios':'Mis operaciones'} · ${feed.length} equipo(s) reportando · ${alerts.length} incidencia(s) detectada(s)`;
rows.innerHTML=feed.map(x=>{const age=x.updatedAt?.toMillis?Date.now()-x.updatedAt.toMillis():Infinity;const stale=age>STALE;const incidents=x.incidents||[];const confirmed=x.confirmed||[];return `<div style="border-top:1px solid #ddd;padding:9px 0"><b>${safe(x.name||x.uid)}</b> ${stale?'🟠 Sin reporte reciente':incidents.some(i=>['CRITICO','ERROR'].includes(i.state))?'🔴 Incidencia':incidents.some(i=>i.state==='DEMORA')?'🟠 Demora':'🟢 Reportando'}<div>${incidents.length} pendiente(s) · ${confirmed.length} confirmación(es) recientes</div>${incidents.slice(0,10).map(i=>`<div style="padding:4px;background:#fff5ed;margin:3px 0">${safe(i.state)} · ${safe(i.operation)} · ${safe(i.recordId)}<br><small>${safe(i.error)}</small></div>`).join('')}${confirmed.slice(0,3).map(i=>`<small style="display:block">✓ ${safe(i.operation)} · ${safe(i.at)}</small>`).join('')}</div>`}).join('')||'<p>No hay reportes disponibles todavía.</p>';
const key=alerts.map(a=>a.name+a.id+a.state).sort().join('|');if(boss&&key&&key!==lastAlert){lastAlert=key;toggle.style.background='#ad3434';}else if(!key){lastAlert='';toggle.style.background='#164b75'}
}
function listen(){const b=getBridge(),p=getProfile();if(unsubscribe){unsubscribe();unsubscribe=null}feed=[];lastSignature='';lastSent=0;if(!b?.ready||!b.authUser||!p||p.status!=='ACTIVO')return;
const sdk=b.mods;const ref=p.role==='JEFE'?sdk.collection(b.db,COLLECTION):sdk.doc(b.db,COLLECTION,b.authUser.uid);
unsubscribe=sdk.onSnapshot(ref,s=>{feed=p.role==='JEFE'?s.docs.map(d=>d.data()):s.exists()?[s.data()]:[];render()},e=>{summary.textContent='Error de lectura del monitor: '+e.message});tick();}
let authKey='';timer=setInterval(()=>{const b=getBridge(),p=getProfile(),key=(b?.authUser?.uid||'')+'|'+(p?.role||'')+'|'+(p?.status||'');if(key!==authKey){authKey=key;listen()}tick();render()},INTERVAL);
setTimeout(()=>{authKey='initial';listen()},3000);
})();
