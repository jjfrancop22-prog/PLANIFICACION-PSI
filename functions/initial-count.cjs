'use strict';
const {key,quantities,adjustStock}=require('./consumption-core.cjs');
function initialDeltas(items){return quantities(items);}
function validateInitialPlan(plan,user){
 if(!plan||plan.status==='REALIZADO'||plan.completionCommittedAt)throw Error('Actividad finalizada');
 if(user.role!=='JEFE'&&(user.role!=='ANALISTA'||String(user.analystId||'')!==String(plan.analystId||'')))throw Error('Analista no asignado');
 if(plan.reagentResult?.inventoryCommittedAt)throw Error('Consumo inicial ya confirmado');
}
function computeInitialStock(stock,used){return adjustStock(stock,used);}
module.exports={initialDeltas,validateInitialPlan,computeInitialStock,key};
