'use strict';
// Núcleo de validación por envase. No escribe inventario.
const EPS=1e-7;
function finite(n,label){if(typeof n!=='number'||!Number.isFinite(n))throw Error(`${label}: número inválido`);return n;}
function containerKey(x){const id=String(x.containerId||x.id||'').trim();if(!id)throw Error('Envase sin identificador');return id;}
function mapContainers(items){
 if(!Array.isArray(items)||items.length>100)throw Error('Lista inválida');
 const map=new Map();
 for(const item of items){
  if(item.mode!=='WEIGHT')continue;
  if(typeof item.name!=='string'||!item.name.trim()||typeof item.lot!=='string')throw Error('Reactivo sin identidad');
  if(item.usedInActivity===false||item.notUsed){if((item.containers||[]).length)throw Error('Envases marcados como no utilizados');continue;}
  if(!Array.isArray(item.containers)||item.containers.length>100)throw Error('Envases inválidos');
  for(const env of item.containers){
   const key=`${item.name.trim().toLowerCase()}|${item.lot.trim().toLowerCase()}|${containerKey(env)}`;
   if(map.has(key))throw Error('Envase duplicado');
   const tare=finite(env.tareWeight,'Tara'),initial=finite(env.initialWeight,'Peso inicial'),final=finite(env.finalWeight,'Peso final');
   if(tare<0||initial<tare-EPS||final<tare-EPS||final>initial+EPS)throw Error('Pesos incompatibles');
   const density=item.physicalState==='LIQUID'?finite(item.density,'Densidad'):null;
   if(density!==null&&density<=0)throw Error('Densidad inválida');
   map.set(key,{tare,initial,final,density,used:initial-final});
  }
 }
 return map;
}
function weightDifferences(before,after){
 const a=mapContainers(before),b=mapContainers(after);
 if(a.size!==b.size||[...a.keys()].some(k=>!b.has(k)))throw Error('No se permite cambiar envases en una corrección');
 const out=[];
 for(const [key,old] of a){const next=b.get(key);
  if(Math.abs(old.tare-next.tare)>EPS||old.density!==next.density)throw Error('Tara o densidad modificada: requiere revisión');
  if(Math.abs(old.initial-next.initial)>EPS)throw Error('Peso inicial modificado: requiere conciliación manual');
  out.push({key,additionalUsedGrams:next.used-old.used,previousFinalWeight:old.final,newFinalWeight:next.final,additionalUsedMl:old.density===null?null:(next.used-old.used)/old.density});
 }
 return out;
}
module.exports={mapContainers,weightDifferences};
