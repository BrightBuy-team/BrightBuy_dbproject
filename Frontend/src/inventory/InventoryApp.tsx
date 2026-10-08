import { useState, useEffect } from 'react';

// Define the Variant interface matching our Java Backend
interface Variant {
  variantId: number;
  productId: number;
  sku: string;
  stockQuantity: number;
  price: number;
}

export default function InventoryApp() {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [lowStockVariants, setLowStockVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin] = useState(localStorage.getItem('role') === 'admin');

  // Function to fetch all data from our Java Backend
  const fetchData = async () => {
    try {
      // 1. Fetch all variants
      const variantsRes = await fetch('http://localhost:8080/api/inventory/variants');
      const variantsData = await variantsRes.json();
      setVariants(variantsData);

      // 2. Fetch low stock items (threshold = 10)
      const lowStockRes = await fetch('http://localhost:8080/api/inventory/low-stock?threshold=10');
      const lowStockData = await lowStockRes.json();
      setLowStockVariants(lowStockData);

      setLoading(false);
    } catch (error) {
      console.error("Error connecting to backend:", error);
      setLoading(false);
    }
  };

  // Run this once when the page loads
  useEffect(() => {
    fetchData();
  }, []);

  // Function to update stock quantity
  const handleUpdateStock = async (variantId: number, currentStock: number) => {
    const newStockStr = prompt(`Enter new stock quantity for Variant #${variantId}:`, currentStock.toString());
    if (newStockStr === null) return; // User cancelled

    const newStock = parseInt(newStockStr, 10);
    if (isNaN(newStock) || newStock < 0) {
      alert("Please enter a valid positive number.");
      return;
    }

    try {
      // Send the PUT request to our Java Backend
      const res = await fetch(`http://localhost:8080/api/inventory/variants/${variantId}/stock?quantity=${newStock}`, {
        method: 'PUT'
      });

      if (res.ok) {
        // Refresh the data to show the new stock and trigger your SQL Audit table!
        fetchData();
        alert("Stock updated successfully!");
      } else {
        alert("Failed to update stock.");
      }
    } catch (error) {
      console.error("Error updating stock:", error);
    }
  };

  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', textAlign: 'center', padding: '2rem' }}>
        <h1 style={{ color: '#ef4444', fontSize: '3rem', marginBottom: '1rem' }}>Access Denied</h1>
        <p style={{ fontSize: '1.2rem', color: '#64748b', marginBottom: '2rem' }}>You do not have permission to view the warehouse inventory. Admin access is required.</p>
        <a href="/" style={{ padding: '1rem 2rem', backgroundColor: '#0f172a', color: 'white', textDecoration: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Return to Home</a>
      </div>
    );
  }

  if (loading) {
    return <div className="loading">Connecting to Backend...</div>;
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header" style={{ position: 'relative' }}>
        <a href="/" style={{ position: 'absolute', left: '2rem', top: '50%', transform: 'translateY(-50%)', textDecoration: 'none', color: '#115e59', fontWeight: 'bold', fontSize: '1.2rem' }}>← Back to Home</a>
        <h1>BrightBuy <span>Warehouse</span></h1>
        <p>Inventory Management System</p>
      </header>

      <main className="dashboard-content">
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
                    <h3>SKU: {variant.sku}</h3>
                    <span className="badge critical">Stock: {variant.stockQuantity}</span>
                  </div>
                  <p>Product ID: {variant.productId}</p>
                  <button className="btn btn-alert" onClick={() => handleUpdateStock(variant.variantId, variant.stockQuantity)}>
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
                  <th>SKU</th>
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
                      <td className="sku-cell">{variant.sku}</td>
                      <td>{variant.productId}</td>
                      <td>${variant.price.toFixed(2)}</td>
                      <td>
                        <span className={`stock-indicator ${variant.stockQuantity < 10 ? 'low' : 'good'}`}>
                          {variant.stockQuantity}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-primary" onClick={() => handleUpdateStock(variant.variantId, variant.stockQuantity)}>
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
