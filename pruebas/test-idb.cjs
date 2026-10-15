// Small serial transaction adapter for local regression; this is not a browser or Firebase emulator.
const clone=x=>x===undefined?undefined:structuredClone(x);
let chain=Promise.resolve();
class DB{
 constructor(){this.tables=new Map()}
 createObjectStore(name,{keyPath}){this.tables.set(name,{keyPath,rows:new Map()})}
 transaction(name,mode){
  const table=this.tables.get(name),operations=[];
  const tx={error:null,objectStore:()=>({
   get:key=>add(()=>clone(table.rows.get(key))),
   getAll:()=>add(()=>[...table.rows.values()].map(clone)),
   put:row=>add(()=>{table.rows.set(row[table.keyPath],clone(row));return row[table.keyPath]}),
   delete:key=>add(()=>table.rows.delete(key))
  })};
  function add(fn){const request={};operations.push([fn,request]);return request}
  chain=chain.then(()=>new Promise(resolve=>setTimeout(()=>{
   try{while(operations.length){const [fn,req]=operations.shift();req.result=fn();req.onsuccess?.()}tx.oncomplete?.()}
   catch(e){tx.error=e;tx.onerror?.()}
   resolve();
  },0)));
  return tx;
 }
}
module.exports={open(){const request={result:new DB()};setTimeout(()=>{request.onupgradeneeded?.();request.onsuccess?.()},0);return request}};
