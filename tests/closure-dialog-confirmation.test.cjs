const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
test('el formulario de cierre permanece abierto hasta confirmación remota',()=>{
  const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
  const start=app.indexOf('const claim=await claimActivityCompletion(p);');
  const end=app.indexOf('async function renderRecentMyActivities(',start);
  assert.ok(start>0&&end>start);
  const code=app.slice(start,end);
  assert.ok(code.indexOf('await completeActivityRecord(')<code.indexOf("$('#finishActivityDialog').close();"));
  assert.match(code,/catch\(err\)\{\s*releaseActivityCompletion\(p\.id\)/);
  assert.match(code,/finally\{if\(submitBtn\)submitBtn\.disabled=false;\}/);
});
