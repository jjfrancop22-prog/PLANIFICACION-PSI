'use strict';
function key(x){return `${String(x.name||'').trim().toLocaleLowerCase()}|${String(x.lot||'').trim().toLocaleLowerCase()}`;}
function quantities(items){
 if(!Array.isArray(items)||items.length>100)throw Error('Lista de consumos inválida');
 const result=new Map();
 for(const item of items){
  if(!item||typeof item!=='object')throw Error('Reactivo inválido');
  if(item.notUsed||item.usedInActivity===false)continue;
  if(item.mode!=='COUNT')throw Error('Solo COUNT admitido en esta fase');
  if(typeof item.name!=='string'||!item.name.trim()||typeof item.lot!=='string'||!item.lot.trim())throw Error('Identidad de reactivo/lote inválida');
  if(typeof item.used!=='number'||!Number.isSafeInteger(item.used)||item.used<0)throw Error('Cantidad COUNT debe ser un entero no negativo');
  const k=key(item);
  if(result.has(k))throw Error('Reactivo/lote duplicado en la solicitud');
  result.set(k,item.used);
 }
 return result;
}
function deltas(oldItems,newItems){const a=quantities(oldItems),b=quantities(newItems),out=new Map();for(const k of new Set([...a.keys(),...b.keys()]))out.set(k,(b.get(k)||0)-(a.get(k)||0));return out;}
function adjustStock(stock,delta){if(!Number.isSafeInteger(stock)||stock<0||!Number.isSafeInteger(delta))throw Error('Saldo COUNT inválido');const result=stock-delta;if(!Number.isSafeInteger(result)||result<0)throw Error('Stock insuficiente');return result;}
module.exports={key,quantities,deltas,adjustStock};
