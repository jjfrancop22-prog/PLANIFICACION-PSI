'use strict';const assert=require('node:assert/strict');const test=require('node:test');const {inspectWeightCatalog}=require('../functions/weight-readiness.cjs');
const base=(containers)=>[{id:'A',reagentConfig:[{id:'R',mode:'WEIGHT',containers}]}];
test('No interpreta initialWeight como saldo actual',()=>{const r=inspectWeightCatalog(base([{id:'X',tareWeight:100,initialWeight:500}]));assert.equal(r.pendingCount,1);assert.equal(r.issues[0].code,'SALDO_SIN_CONCILIAR')});
test('Reconoce saldo conciliado',()=>{const r=inspectWeightCatalog(base([{id:'X',tareWeight:100,initialWeight:500,currentWeight:300}]));assert.equal(r.readyCount,1)});
test('Rechaza saldo inferior a tara',()=>{assert.equal(inspectWeightCatalog(base([{id:'X',tareWeight:100,initialWeight:500,currentWeight:90}])).issues[0].code,'SALDO_FUERA_RANGO')});
test('Detecta duplicados',()=>{const c={id:'X',tareWeight:100,initialWeight:500,currentWeight:300};assert.equal(inspectWeightCatalog(base([c,c])).issues[0].code,'DUPLICADO')});
test('No acepta números como texto',()=>{assert.equal(inspectWeightCatalog(base([{id:'X',tareWeight:100,initialWeight:500,currentWeight:'300'}])).pendingCount,1)});
