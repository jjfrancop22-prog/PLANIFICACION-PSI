'use strict';
// Modelo transaccional por envase: no realiza escrituras ni asume que
// initialWeight del catálogo equivale a saldo disponible actual.
const {prepareWeightCorrection}=require('./weight-transaction-plan.cjs');
const EPS=1e-7;
function buildContainerUpdates(previous,next,catalogReagents){
 const {changes}=prepareWeightCorrection(previous,next);
 if(!Array.isArray(catalogReagents))throw Error('Catálogo inválido');
 const updates=[];
 for(const change of changes){
  const parts=change.key.split('|');
  const [name,lot,containerId]=parts;
  const candidates=[];
  for(let i=0;i<catalogReagents.length;i++){
   const r=catalogReagents[i];
   if(r.mode!=='WEIGHT'||String(r.name||'').trim().toLowerCase()!==name||String(r.lot||'').trim().toLowerCase()!==lot)continue;
   for(let j=0;j<(r.containers||[]).length;j++){
    const c=r.containers[j];
    if(String(c.id||c.containerId||'').trim()===containerId)candidates.push({i,j,r,c});
   }
  }
  if(candidates.length!==1)throw Error('Envase inexistente o ambiguo en el catálogo: '+change.key);
  const {i,j,c}=candidates[0];
  // Solo un campo de saldo EXPLÍCITO y sincronizado es aceptable.
  // initialWeight es el peso original, NO el saldo actual.
  if(typeof c.currentWeight!=='number'||!Number.isFinite(c.currentWeight))throw Error('Envase sin currentWeight confirmado; requiere migración y conciliación: '+change.key);
  const nextWeight=c.currentWeight-change.additionalUsedGrams;
  if(nextWeight<Number(c.tareWeight)-EPS)throw Error('Saldo por debajo de la tara');
  if(nextWeight>Number(c.initialWeight)+EPS)throw Error('Saldo superior al peso inicial');
  updates.push({reagentIndex:i,containerIndex:j,containerId,currentWeight:Math.max(Number(c.tareWeight),nextWeight),deltaGrams:change.additionalUsedGrams});
 }
 return updates;
}
module.exports={buildContainerUpdates};
