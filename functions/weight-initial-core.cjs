'use strict';
// Consumo inicial: saldo conciliado menos consumo absoluto por envase.
const {mapContainers}=require('./weight-correction-core.cjs');
const EPS=1e-7;
function computeInitialWeightCatalog(plan,catalog,items){
 if(!plan||String(plan.catalogId||'')!==String(catalog?.id||''))throw Error('Catálogo ajeno a la actividad');
 if(plan.reagentResult?.inventoryCommittedAt)throw Error('Consumo ya confirmado');
 if(!Array.isArray(items)||!items.length||items.length>100||items.some(i=>i.mode!=='WEIGHT'))throw Error('Solo consumos WEIGHT');
 const consumption=mapContainers(items);
 if(!consumption.size)throw Error('Sin envases utilizados');
 const original=catalog.reagentConfig;
 if(!Array.isArray(original))throw Error('Catálogo inválido');
 const copy=structuredClone(original),seen=new Set(),updates=[];
 for(const [k,v] of consumption){
  const [name,lot,id]=k.split('|');const found=[];
  for(let i=0;i<copy.length;i++){
   const r=copy[i];if(r.mode!=='WEIGHT'||String(r.name||'').trim().toLowerCase()!==name||String(r.lot||'').trim().toLowerCase()!==lot)continue;
   for(let j=0;j<(r.containers||[]).length;j++)if(String(r.containers[j].id||r.containers[j].containerId||'').trim()===id)found.push([i,j]);
  }
  if(found.length!==1)throw Error('Envase inexistente o ambiguo: '+k);
  const [i,j]=found[0],c=copy[i].containers[j];
  if(seen.has(`${i}|${j}`))throw Error('Envase duplicado');seen.add(`${i}|${j}`);
  if(typeof c.currentWeight!=='number'||!Number.isFinite(c.currentWeight))throw Error('Envase sin saldo conciliado: '+k);
  if(typeof c.tareWeight!=='number'||typeof c.initialWeight!=='number'||!Number.isFinite(c.tareWeight)||!Number.isFinite(c.initialWeight)||Math.abs(c.tareWeight-v.tare)>EPS||Math.abs(c.initialWeight-v.initial)>EPS)throw Error('Tara o peso inicial no coinciden: '+k);
  const next=c.currentWeight-v.used;
  if(next<c.tareWeight-EPS||next>c.initialWeight+EPS)throw Error('Saldo insuficiente o fuera de rango: '+k);
  c.currentWeight=Math.max(c.tareWeight,next);
  updates.push({reagentIndex:i,containerIndex:j,containerId:id,deltaGrams:v.used,currentWeight:c.currentWeight});
 }
 return {reagentConfig:copy,updates};
}
module.exports={computeInitialWeightCatalog};
