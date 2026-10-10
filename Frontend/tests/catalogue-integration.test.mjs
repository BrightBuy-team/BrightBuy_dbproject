import assert from 'node:assert/strict'
import {test,after} from 'node:test'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {createServer} from 'vite'
import {mergeCartLines} from '../src/catalogue/cartMerge.ts'
import {readStoredCart,updateCartQuantity} from '../src/catalogue/cart.ts'
const line={productId:1,variantId:1,productName:'Test',variantLabel:'Black',price:'12.50',quantity:1,stockQuantity:5}
test('guest and customer lines merge without altering inputs',()=>{
 const saved=[{...line}],guest=[{...line,quantity:2},{...line,variantId:2}]
 const result=mergeCartLines(saved,guest)
 assert.equal(result.items[0].quantity,3);assert.equal(result.items.length,2)
 assert.equal(saved[0].quantity,1);assert.equal(guest[0].quantity,2);assert.equal(result.adjusted,false)
})
test('cart merge caps at the more conservative stock snapshot and announces it',()=>{
 const result=mergeCartLines([{...line,quantity:3}],[{...line,quantity:2,stockQuantity:2}])
 assert.equal(result.items[0].quantity,2);assert.equal(result.items[0].stockQuantity,2);assert.equal(result.adjusted,true)
})
test('oversized combined cart is rejected, not silently truncated',()=>{
 assert.throws(()=>mergeCartLines(Array.from({length:100},(_,i)=>({...line,variantId:i+1})),[{...line,variantId:101}]))
})
test('saved cart rejects corrupt, duplicate and invalid lines without writing',()=>{
 const before=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage')
 let raw='{}';let writes=0
 Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:()=>raw,setItem:()=>writes++}})
 try{
  for(const invalid of ['{}','bad json',JSON.stringify([line,line]),JSON.stringify([{...line,quantity:1.5}]),JSON.stringify([{...line,price:'NaN'}])]){
   raw=invalid;assert.throws(()=>readStoredCart('test'),/saved cart/)
  }
  raw=JSON.stringify([line]);assert.equal(readStoredCart('test')[0].quantity,1)
  updateCartQuantity(1,NaN);updateCartQuantity(1,1.5);assert.equal(writes,0)
 }finally{if(before)Object.defineProperty(globalThis,'sessionStorage',before);else delete globalThis.sessionStorage}
})
const vite=await createServer({server:{middlewareMode:true,hmr:false,ws:false,watch:null},appType:'custom'})
after(()=>vite.close())
const {apiBase,apiRequest}=await vite.ssrLoadModule('/src/catalogue/client.ts')
const {AccountStatusView}=await vite.ssrLoadModule('/src/catalogue/AccountStatus.tsx')
test('account view exposes real sign-out only for a signed-in user',()=>{
 const html=renderToStaticMarkup(createElement(AccountStatusView,{data:{id:1,email:'test@example.invalid'},loading:false,retry(){},logout(){}}))
 assert.match(html,/Sign out/)
 assert.doesNotMatch(renderToStaticMarkup(createElement(AccountStatusView,{data:null,loading:false,retry(){},logout(){}})),/Sign out/)
})
test('module APIs derive from the catalogue deployment',()=>{
 assert.equal(new URL(apiBase('inventory')).origin,new URL(apiBase('auth')).origin)
 assert.match(apiBase('checkout'),/\/api\/checkout$/)
})
test('write client sends session cookies and a freshly fetched CSRF token',async()=>{
 const original=globalThis.fetch,calls=[]
 globalThis.fetch=async(url,init)=>{calls.push({url,init});return new Response(calls.length===1?'{"token":"fresh-token"}':'',{status:200,headers:{'content-type':calls.length===1?'application/json':'text/plain'}})}
 try{
  await apiRequest('https://example.invalid/api/inventory/variants/1/stock?quantity=3',{method:'PUT'})
  assert.equal(calls.length,2);assert.match(calls[0].url,/\/auth\/csrf$/)
  assert.equal(calls[0].init.credentials,'include');assert.equal(calls[1].init.credentials,'include')
  assert.equal(calls[1].init.headers.get('X-XSRF-TOKEN'),'fresh-token')
 }finally{globalThis.fetch=original}
})
test('failed CSRF fetch never sends the mutation',async()=>{
 const original=globalThis.fetch;let calls=0
 globalThis.fetch=async()=>{calls++;return new Response('',{status:503})}
 try{await assert.rejects(()=>apiRequest('https://example.invalid',{method:'POST'}));assert.equal(calls,1)}finally{globalThis.fetch=original}
})
test('permission errors never expose raw response bodies',async()=>{
 const original=globalThis.fetch
 globalThis.fetch=async()=>new Response('private SQL details',{status:403})
 try{await assert.rejects(()=>apiRequest('https://example.invalid'),e=>e.message.includes('permission')&&!e.message.includes('SQL'))}finally{globalThis.fetch=original}
})
