const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const src=fs.readFileSync(require('node:path').join(__dirname,'..','app.js'),'utf8');
test('cierre reintenta solamente errores transitorios y conserva requestId',()=>{
 const start=src.indexOf('async function completeActivityRecord(');
 const end=src.indexOf('const technicalSubmissionLocks=',start);
 const body=src.slice(start,end);
 assert.match(body,/functions\/unavailable/);
 assert.match(body,/functions\/deadline-exceeded/);
 assert.match(body,/if\(!transient\|\|!navigator\.onLine\)throw firstError/);
 assert.equal((body.match(/finishCall\(\{\.\.\.finishPayload,requestId:finishRequestId\}\)/g)||[]).length,2);
 assert.match(body,/getDocFromServer/);
});
