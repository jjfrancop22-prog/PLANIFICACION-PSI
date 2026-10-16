'use strict';
// Pure computation: update only the catalog explicitly assigned to the plan.
const {buildContainerUpdates}=require('./weight-inventory-transaction.cjs');
function computeWeightCatalogCorrection(plan, catalog, nextItems){
 if(!plan||!catalog||String(plan.catalogId||'')!==String(catalog.id||''))throw Error('Catálogo no corresponde a la actividad');
 if(!plan.reagentResult?.inventoryCommittedAt)throw Error('Consumo previo sin confirmar');
 if(!Array.isArray(nextItems)||nextItems.length>100)throw Error('Consumos inválidos');
 const original=catalog.reagentConfig;
 if(!Array.isArray(original))throw Error('Catálogo sin reactivos');
 const updates=buildContainerUpdates(plan.reagentResult.items,nextItems,original);
 const modified=structuredClone(original);
 for(const u of updates){
  const container=modified[u.reagentIndex].containers[u.containerIndex];
  container.currentWeight=u.currentWeight;
 }
 return {reagentConfig:modified,updates};
}
module.exports={computeWeightCatalogCorrection};
