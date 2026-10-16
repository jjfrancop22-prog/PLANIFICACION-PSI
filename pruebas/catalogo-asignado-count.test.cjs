'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../functions/index.cjs'),'utf8');
for(const name of ['correctCountConsumption','commitInitialCountConsumption']){
  const begin=code.indexOf(`exports.${name}=`);
  assert.ok(begin>=0,`Falta ${name}`);
  const next=code.indexOf('\nexports.',begin+8);
  const body=code.slice(begin,next<0?code.length:next);
  assert.match(body,/tx\.get\(db\.doc\(`catalog\/\$\{plan\.catalogId\}`\)\)/,`${name} debe leer el catálogo asignado`);
  assert.doesNotMatch(body,/tx\.get\(db\.collection\('catalog'\)\)/,`${name} no debe leer todos los catálogos`);
  assert.match(body,/Lote duplicado en catálogo asignado/,`${name} debe rechazar lotes duplicados`);
  console.log(`OK ${name}: catálogo asignado y lote único`);
}
