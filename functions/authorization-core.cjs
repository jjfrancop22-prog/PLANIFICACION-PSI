'use strict';
const {quantities}=require('./consumption-core.cjs');
function validateCorrectionScope(previous,next){
 const a=quantities(previous),b=quantities(next);
 if(a.size!==b.size||[...a.keys()].some(k=>!b.has(k)))throw Error('No se permite agregar, quitar o cambiar reactivos/lotes en una corrección');
 return true;
}
function validateCatalogCoverage(plan,catalogs,previous){
 const allowed=quantities(previous);
 const found=new Set();
 for(const catalog of catalogs){
  const {key}=require('./consumption-core.cjs');
  for(const item of catalog.reagentConfig||[]){
   const k=key(item);if(!allowed.has(k))continue;
   if(item.mode!=='COUNT')throw Error('Modo del lote incompatible');
   found.add(k);
  }
 }
 if(found.size!==allowed.size)throw Error('Faltan reactivos/lotes en catálogo');
 if(!plan.catalogId)throw Error('La actividad no tiene catálogo asignado');
 return true;
}
module.exports={validateCorrectionScope,validateCatalogCoverage};
