'use strict';
const {createHash}=require('node:crypto');
function requestFingerprint(planId,items,revision,reason){return createHash('sha256').update(JSON.stringify({planId,items,revision,reason:reason||''})).digest('hex');}
module.exports={requestFingerprint};
