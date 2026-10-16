const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../functions/index.cjs'),'utf8');
const block=source.split('exports.finalizeActivitySafely=')[1];
assert.ok(block,'Debe existir finalizeActivitySafely');
assert.ok(block.includes("if(String(plan.technicalEditedAt||'')!==String(expectedTechnicalEditedAt||''))"),'Debe verificar la versión técnica aunque no se envíe una curva');
assert.ok(!block.includes("if(calibrationResult!==null&&calibrationResult!==undefined&&String(plan.technicalEditedAt"),'No debe omitir control al no enviar curva');
console.log('OK: cierre comprueba versión técnica en todos los casos');
