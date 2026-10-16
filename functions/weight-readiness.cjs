'use strict';
// Diagnóstico de conciliación, SOLO LECTURA. No deriva saldos desde initialWeight.
function inspectWeightCatalog(catalogs){
 if(!Array.isArray(catalogs))throw Error('Catálogos inválidos');
 const issues=[],ready=[];const seen=new Set();
 for(const catalog of catalogs){
  const catalogId=String(catalog.id||'');
  for(const reagent of catalog.reagentConfig||[]){
   if(reagent.mode!=='WEIGHT')continue;
   const reagentId=String(reagent.id||reagent.name||'');
   for(const container of reagent.containers||[]){
    const containerId=String(container.id||container.containerId||'').trim();
    const ref={catalogId,reagentId,containerId};
    const key=[catalogId,reagentId,containerId].join('|');
    if(!containerId){issues.push({...ref,code:'SIN_ID'});continue;}
    if(seen.has(key)){issues.push({...ref,code:'DUPLICADO'});continue;}
    seen.add(key);
    const tare=container.tareWeight,initial=container.initialWeight,current=container.currentWeight;
    if(typeof tare!=='number'||!Number.isFinite(tare)||tare<0||typeof initial!=='number'||!Number.isFinite(initial)||initial<tare){issues.push({...ref,code:'PESOS_BASE_INVALIDOS'});continue;}
    if(typeof current!=='number'||!Number.isFinite(current)){issues.push({...ref,code:'SALDO_SIN_CONCILIAR'});continue;}
    if(current<tare-1e-7||current>initial+1e-7){issues.push({...ref,code:'SALDO_FUERA_RANGO'});continue;}
    ready.push(ref);
   }
  }
 }
 return {total:ready.length+issues.length,readyCount:ready.length,pendingCount:issues.length,ready,issues};
}
module.exports={inspectWeightCatalog};
