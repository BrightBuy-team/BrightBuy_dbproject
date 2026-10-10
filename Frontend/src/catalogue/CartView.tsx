import { useEffect, useState } from 'react';
import { cartSnapshot, clearCart, updateCartQuantity, removeFromCart } from './cart';
import { formatPrice } from './search';

export default function CartView({ onCheckout, onContinueShopping }: { onCheckout: () => void, onContinueShopping: () => void }) {
  const [snapshot, setSnapshot] = useState(cartSnapshot);
  const cart=snapshot.items;

  useEffect(() => {
    const handleUpdate = () => setSnapshot(cartSnapshot());
    window.addEventListener('cart-updated', handleUpdate);
    return () => window.removeEventListener('cart-updated', handleUpdate);
  }, []);

  return <section className="catalogue-cart">
    <h1>Your Shopping Cart</h1>
    <p>Prices are in USD. Stock is not reserved until you place the order.</p>
    {snapshot.error&&<div role="alert"><p>{snapshot.error}</p><button onClick={()=>clearCart()}>Clear unreadable cart</button></div>}
    <p role="status">{typeof sessionStorage!=='undefined'?sessionStorage.getItem('brightbuy_cart_notice'):''}</p>
    {cart.length === 0 ? (
      <div className="catalogue-empty">
        <p>Your cart is empty.</p>
        <button onClick={onContinueShopping} className="catalogue-primary">Continue Shopping</button>
      </div>
    ) : (
      <div>
        <table className="catalogue-cart-table" style={{width: '100%', textAlign: 'left', marginBottom: '2rem'}}>
          <thead>
            <tr>
              <th>Product</th>
              <th>Price</th>
              <th>Quantity</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cart.map(item => (
              <tr key={item.variantId}>
                <td>
                  <strong>{item.productName}</strong>
                  <br />
                  <small>{item.variantLabel}</small>
                </td>
                <td>{formatPrice(parseFloat(item.price))}</td>
                <td>
                  <input aria-label={`Quantity for ${item.productName}`} type="number" min="1" max={item.stockQuantity} value={item.quantity}
                    onChange={(e) => updateCartQuantity(item.variantId, Number(e.target.value))}
                    style={{width: '60px'}}
                  />
                  <br/>
                  <small>{item.stockQuantity} available</small>
                </td>
                <td>{formatPrice(parseFloat(item.price) * item.quantity)}</td>
                <td>
                  <button onClick={() => removeFromCart(item.variantId)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <div style={{display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '2rem'}}>
          <h3>Total: {formatPrice(cart.reduce((sum,i)=>sum+Number(i.price)*i.quantity,0))}</h3>
          <button onClick={onCheckout} className="catalogue-primary">Proceed to Checkout</button>
        </div>
        <div style={{marginTop: '2rem'}}>
          <button onClick={onContinueShopping} className="catalogue-text-button">Continue Shopping</button>
        </div>
      </div>
    )}
  </section>;
}
