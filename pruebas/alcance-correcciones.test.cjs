'use strict';
const assert=require('node:assert/strict');
const {validateCorrectionScope}=require('../functions/authorization-core.cjs');
const x=(name,lot,used)=>({name,lot,used,mode:'COUNT'});
assert.equal(validateCorrectionScope([x('TNT','A',4)],[x('TNT','A',7)]),true);
assert.throws(()=>validateCorrectionScope([x('TNT','A',4)],[x('TNT','B',7)]));
assert.throws(()=>validateCorrectionScope([x('TNT','A',4)],[x('TNT','A',7),x('Otro','B',1)]));
assert.throws(()=>validateCorrectionScope([x('TNT','A',4)],[]));
console.log('4 pruebas de alcance correctas');
