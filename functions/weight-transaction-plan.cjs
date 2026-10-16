'use strict';
// Preparación determinista de correcciones WEIGHT. No escribe en Firestore.
const {weightDifferences}=require('./weight-correction-core.cjs');
const EPS=1e-7;
function prepareWeightCorrection(previous,next){
 if(!Array.isArray(previous)||!Array.isArray(next))throw Error('Consumos inválidos');
 const identities=arr=>arr.map(x=>`${String(x.reagentId||'')}|${String(x.name||'').trim().toLowerCase()}|${String(x.lot||'').trim().toLowerCase()}|${x.mode}`).sort();
 const a=identities(previous),b=identities(next);
 if(JSON.stringify(a)!==JSON.stringify(b)||new Set(a).size!==a.length)throw Error('No se permite agregar, quitar o duplicar reactivos');
 for(let i=0;i<previous.length;i++){
  const old=previous[i],fresh=next.find(x=>String(x.reagentId)===String(old.reagentId));
  if(!fresh||old.mode!==fresh.mode)throw Error('Identidad del reactivo modificada');
  if(old.mode!=='WEIGHT')throw Error('Corrección mixta no habilitada');
  if(old.physicalState!==fresh.physicalState)throw Error('Estado físico modificado');
 }
 const changes=weightDifferences(previous,next);
 for(const change of changes){
  if(!Number.isFinite(change.additionalUsedGrams)||!Number.isFinite(change.newFinalWeight))throw Error('Diferencia no válida');
  if(Math.abs(change.additionalUsedGrams)<EPS)change.additionalUsedGrams=0;
 }
 return {changes,changedContainers:changes.filter(c=>c.additionalUsedGrams!==0).length};
}
module.exports={prepareWeightCorrection};
