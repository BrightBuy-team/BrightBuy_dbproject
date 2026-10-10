import { apiBase,apiRequest } from '../catalogue/client'
import { requestSession } from '../catalogue/session'
import { formatPrice } from '../catalogue/search'
import { useState, useEffect } from 'react';

// Define the Variant interface matching our Java Backend
interface Variant {
  variantId: number;
  productId: number;
  variantName: string;
  stockQuantity: number;
  price: number;
}

export default function InventoryApp() {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [lowStockVariants, setLowStockVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const [allowed,setAllowed]=useState(false)
  const base=apiBase('inventory')
  async function fetchData(){
    const [all,low]=await Promise.all([apiRequest<Variant[]>(base+'/variants'),apiRequest<Variant[]>(base+'/low-stock?threshold=10')])
    setVariants(all);setLowStockVariants(low)
  }
  useEffect(()=>{
    const c=new AbortController()
    requestSession(apiBase('auth'),c.signal).then(async user=>{
      if(user?.accountType!=='EMPLOYEE'||!['WarehouseStaff','Admin'].includes(user.role))
        throw new Error('Sign in with a warehouse staff or admin account.')
      const [all,low]=await Promise.all([apiRequest<Variant[]>(base+'/variants',{signal:c.signal}),apiRequest<Variant[]>(base+'/low-stock?threshold=10',{signal:c.signal})])
      if(!c.signal.aborted){setVariants(all);setLowStockVariants(low);setAllowed(true);setLoading(false)}
    }).catch(e=>{if(!c.signal.aborted){setError((e as Error).message);setLoading(false)}})
    return ()=>c.abort()
  },[base])
  async function handleUpdateStock(variantId:number,currentStock:number){
    const value=prompt('New stock quantity for variant #'+variantId,currentStock.toString())
    if(value===null)return
    if(!/^\\d+$/.test(value.trim())||!Number.isSafeInteger(Number(value))||Number(value)>2147483647){setError('Enter a non-negative whole number within the database range.');return}
    setBusy(true);setError('')
    try{await apiRequest(base+'/variants/'+variantId+'/stock?quantity='+Number(value),{method:'PUT'});await fetchData()}
    catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  if(loading)return <main><p role="status">Checking staff session…</p></main>
  if(!allowed)return <main><h1>Inventory access</h1><p role="alert">{error}</p><a href="/?view=login">Sign in</a></main>
  return (
    <div className="dashboard-container">
      <header className="dashboard-header" style={{ position: 'relative' }}>
        <a href="/" style={{ position: 'absolute', left: '2rem', top: '50%', transform: 'translateY(-50%)', textDecoration: 'none', color: '#115e59', fontWeight: 'bold', fontSize: '1.2rem' }}>← Back to Home</a>
        <h1>BrightBuy <span>Warehouse</span></h1>
        <p>Inventory Management System</p>
      </header>

      <main className="dashboard-content">
        {error&&<p role="alert">{error}</p>}
        {/* Low Stock Alerts Section */}
        <section className="dashboard-section alerts-section">
          <h2><span className="icon">⚠️</span> Low Stock Alerts</h2>
          {variants.length === 0 ? (
            <div className="glass-card success-card" style={{ opacity: 0.7 }}>
              <p>No items in inventory to monitor.</p>
            </div>
          ) : lowStockVariants.length === 0 ? (
            <div className="glass-card success-card">
              <p>All items are sufficiently stocked!</p>
            </div>
          ) : (
            <div className="alerts-grid">
              {lowStockVariants.map(variant => (
                <div key={variant.variantId} className="glass-card alert-card">
                  <div className="card-header">
                    <h3>Variant: {variant.variantName}</h3>
                    <span className="badge critical">Stock: {variant.stockQuantity}</span>
                  </div>
                  <p>Product ID: {variant.productId}</p>
                  <button className="btn btn-alert" disabled={busy} onClick={() => handleUpdateStock(variant.variantId, variant.stockQuantity)}>
                    Restock Now
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Full Inventory List Section */}
        <section className="dashboard-section inventory-section">
          <h2><span className="icon">📦</span> Full Inventory</h2>
          <div className="glass-card table-container">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Variant ID</th>
                  <th>Variant</th>
                  <th>Product ID</th>
                  <th>Price</th>
                  <th>Stock Quantity</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {variants.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>No variants found in database.</td>
                  </tr>
                ) : (
                  variants.map(variant => (
                    <tr key={variant.variantId}>
                      <td>#{variant.variantId}</td>
                      <td className="sku-cell">{variant.variantName}</td>
                      <td>{variant.productId}</td>
                      <td>{formatPrice(variant.price)}</td>
                      <td>
                        <span className={`stock-indicator ${variant.stockQuantity < 10 ? 'low' : 'good'}`}>
                          {variant.stockQuantity}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-primary" disabled={busy} onClick={() => handleUpdateStock(variant.variantId, variant.stockQuantity)}>
                          Update Stock
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
