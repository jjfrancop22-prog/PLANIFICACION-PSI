const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const root=path.join(__dirname,'..');
const backend=fs.readFileSync(path.join(root,'functions/index.cjs'),'utf8');
const ui=fs.readFileSync(path.join(root,'app.js'),'utf8');
test('el cierre exige la versión técnica recibida del cliente',()=>{
  assert.match(backend,/expectedTechnicalEditedAt/);
  assert.match(backend,/plan\.technicalEditedAt\|\|''/);
  assert.match(backend,/Los datos técnicos fueron modificados desde otra computadora/);
});
test('la interfaz envía la versión técnica junto con la revisión del inventario',()=>{
  assert.match(ui,/expectedTechnicalEditedAt:p\.technicalEditedAt\|\|null/);
  assert.match(ui,/expectedRevision:Number\(p\.reagentResult\?\.correctionRevision\|\|0\)/);
});
test('la versión técnica forma parte de la huella de idempotencia',()=>{
  assert.match(backend,/expectedTechnicalEditedAt:expectedTechnicalEditedAt\?\?null/);
});
