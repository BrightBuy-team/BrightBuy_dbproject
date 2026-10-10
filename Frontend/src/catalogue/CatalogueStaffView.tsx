import { useEffect,useState } from 'react'
import type { FormEvent } from 'react'
import { catalogueBase,apiRequest } from './client'

type Product={product_id:number;sku:string;name:string;description:string|null;image_url:string|null;is_active:boolean}
type Category={category_id:number;name:string;description:string|null;parent_category_id:number|null;is_active:boolean}
export default function CatalogueStaffView(){
 const [products,setProducts]=useState<Product[]>([])
 const [categories,setCategories]=useState<Category[]>([])
 const [message,setMessage]=useState('')
 const [busy,setBusy]=useState(false)
 const [selected,setSelected]=useState<Product|null>(null)
 const [category,setCategory]=useState<Category|null>(null)
 const [keyword,setKeyword]=useState('')
 const [page,setPage]=useState(1)
 const base=catalogueBase+'/staff'
 const productsUrl=base+'/products?'+new URLSearchParams({keyword,page:String(page)})
 async function refresh(){
  const [p,c]=await Promise.all([apiRequest<Product[]>(productsUrl),apiRequest<Category[]>(base+'/categories')])
  setProducts(p);setCategories(c)
 }
 useEffect(()=>{let alive=true;Promise.all([apiRequest<Product[]>(productsUrl),apiRequest<Category[]>(base+'/categories')])
  .then(([p,c])=>{if(alive){setProducts(p);setCategories(c)}}).catch(e=>{if(alive)setMessage((e as Error).message)});return()=>{alive=false}},[base,productsUrl])
 async function write(url:string,method:string,body?:unknown){
  setBusy(true);setMessage('')
  try{await apiRequest(url,{method,body:body===undefined?undefined:JSON.stringify(body)});await refresh();setMessage('Saved.');setSelected(null);setCategory(null)}
  catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
 }
 function saveProduct(e:FormEvent<HTMLFormElement>){
  e.preventDefault();const f=new FormData(e.currentTarget)
  const p={sku:f.get('sku'),name:f.get('name'),description:f.get('description'),imageUrl:f.get('imageUrl'),
   categoryId:Number(f.get('categoryId')),
   price:Number(f.get('price')),stock:Number(f.get('stock'))}
  void write(base+'/products'+(selected?'/'+selected.product_id:''),selected?'PUT':'POST',p)
 }
 function saveCategory(e:FormEvent<HTMLFormElement>){
  e.preventDefault();const f=new FormData(e.currentTarget)
  void write(base+'/categories'+(category?'/'+category.category_id:''),category?'PUT':'POST',{
   name:f.get('name'),description:f.get('description'),parentCategoryId:f.get('parent')?Number(f.get('parent')):null,active:f.has('active')})
 }
 return <section className="catalogue-detail-state"><h1>Catalogue maintenance</h1>
  <p>Warehouse staff or admin account required. Products are retired, never deleted. New products receive a category and an initial variant atomically.</p>
  {message&&<p role="status">{message}</p>}
  <h2>{selected?'Edit product #'+selected.product_id:'Create product'}</h2>
  <form key={'p'+(selected?.product_id||0)} onSubmit={saveProduct}>
   <label>SKU<input name="sku" required maxLength={50} defaultValue={selected?.sku}/></label>
   <label>Name<input name="name" required maxLength={150} defaultValue={selected?.name}/></label>
   <label>Description<textarea name="description" defaultValue={selected?.description||''}/></label>
   <label>Image URL<input name="imageUrl" maxLength={500} defaultValue={selected?.image_url||''}/></label>
   {!selected&&<><label>First category<select name="categoryId" required><option value="">Select category</option>{categories.map(c=><option key={c.category_id} value={c.category_id}>{c.name}</option>)}</select></label>
    <label>Initial variant price (USD)<input name="price" type="number" min="0.01" step="0.01" required/></label>
    <label>Initial stock<input name="stock" type="number" min={0} step={1} required/></label></>}
   <button disabled={busy}>Save product</button><button type="button" onClick={()=>setSelected(null)}>New product</button>
  </form>
  <h2>Products</h2><form onSubmit={e=>{e.preventDefault();setKeyword(String(new FormData(e.currentTarget).get('keyword')||''));setPage(1)}}>
   <label>Find staff products (including retired)<input name="keyword" maxLength={255}/></label><button>Search</button></form>
  <p>Page {page} — up to 100 products per page.</p>
  {products.map(p=><article key={p.product_id}><span>#{p.product_id} {p.name} ({p.sku})</span>
   <button disabled={busy} onClick={()=>setSelected(p)}>Edit</button>
   <button disabled={busy} onClick={()=>void write(base+'/products/'+p.product_id+'/active','PATCH',{active:!p.is_active})}>{p.is_active?'Retire':'Restore'}</button></article>)}
  <button disabled={page===1||busy} onClick={()=>setPage(p=>p-1)}>Previous products</button>
  <button disabled={products.length<100||busy} onClick={()=>setPage(p=>p+1)}>Next products</button>
  <h2>{category?'Edit category':'Create category'}</h2>
  <form key={'c'+(category?.category_id||0)} onSubmit={saveCategory}>
   <label>Name<input name="name" required maxLength={100} defaultValue={category?.name}/></label>
   <label>Description<textarea name="description" maxLength={500} defaultValue={category?.description||''}/></label>
   <label>Parent ID (blank for root)<input name="parent" type="number" min={1} defaultValue={category?.parent_category_id||''}/></label>
   <label><input name="active" type="checkbox" defaultChecked={category?category.is_active:true}/>Active</label>
   <button disabled={busy}>Save category</button><button type="button" onClick={()=>setCategory(null)}>New category</button>
  </form>
  {categories.map(c=><button key={c.category_id} onClick={()=>setCategory(c)}>Edit #{c.category_id} {c.name}</button>)}
  <h2>Product category membership</h2><form onSubmit={e=>{
   e.preventDefault();const f=new FormData(e.currentTarget);void write(base+'/products/'+f.get('product')+'/categories/'+f.get('category'),String(f.get('operation')))
  }}><label>Product ID<input name="product" type="number" min={1} required/></label>
   <label>Category ID<input name="category" type="number" min={1} required/></label>
   <label>Action<select name="operation"><option value="POST">Assign</option><option value="DELETE">Remove</option></select></label>
   <button disabled={busy}>Save membership</button><p>Removing the final category is rejected.</p></form>
  <a href="/inventory.html">Manage variant stock</a>
 </section>
}
