// Read-only local smoke measurement, not a production capacity certification.
import assert from 'node:assert/strict'
const base=process.env.BRIGHTBUY_TEST_API||'http://127.0.0.1:18086'
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname))
async function measure(path,collectErrors=false){
 const started=performance.now()
 const response=await fetch(base+path,{signal:AbortSignal.timeout(30000)})
 if(!collectErrors)assert.equal(response.status,200)
 const body=await response.json()
 return {ms:Math.round(performance.now()-started),status:response.status,body}
}
const browse=await measure('/api/catalogue/products')
assert.ok(browse.body.total_products>=10000,'Load the opted-in 10k fixture first')
const samples=[]
for(const [name,path,limit] of [
 ['browse','/api/catalogue/products',2000],
 ['search','/api/catalogue/products?keyword=PERF-09999',3000],
 ['detail','/api/catalogue/products/1',1000],
 ['category+stock+price','/api/catalogue/products?categoryId=1&inStockOnly=true&minPrice=90&maxPrice=110&sort=price_asc',2000]
]){
 const times=[]
 for(let i=0;i<10;i++)times.push((await measure(path)).ms)
 times.sort((a,b)=>a-b)
 samples.push({scenario:name,requests:10,p50_ms:times[4],p95_ms:times[9],budget_ms:limit,within_budget:times[9]<limit})
}
async function burst(paths){
 const started=performance.now()
 const results=await Promise.all(paths.map(path=>measure(path,true)))
 const successful=results.filter(r=>r.status===200)
 assert.ok(successful.every(r=>r.body.total_products===1),'Each successful fixture SKU search must return exactly one product')
 const statuses={}
 for(const r of results)statuses[r.status]=(statuses[r.status]||0)+1
 const times=results.map(r=>r.ms).sort((a,b)=>a-b)
 return {requests:paths.length,statuses,elapsed_ms:Math.round(performance.now()-started),p50_ms:times[99],p95_ms:times[189],max_ms:times[199],budget_ms:3000,within_budget:successful.length===paths.length&&times[189]<3000}
}
const identical=await burst(Array.from({length:200},()=>'/api/catalogue/products?keyword=PERF-09999'))
// No in-flight sharing is possible here: all 200 validated keys differ.
const distinct=await burst(Array.from({length:200},(_,i)=>'/api/catalogue/products?keyword=PERF-'+String(9801+i).padStart(5,'0')))
console.log(JSON.stringify({products:browse.body.total_products,sequential:samples,
 concurrent_identical_search_burst:identical,concurrent_distinct_search_burst:distinct,
 scope:'Two one-shot 200-request bursts on local 2-CPU MySQL; not 200 browser sessions or sustained browse/checkout load'},null,2))
if(process.env.BRIGHTBUY_PERFORMANCE_STRICT==='true'){
 assert.ok(samples.every(s=>s.within_budget)&&identical.within_budget&&distinct.within_budget,'Local latency budgets exceeded; see measurements above')
}
