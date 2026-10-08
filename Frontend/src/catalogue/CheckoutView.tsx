import { useState, useEffect } from 'react';
import { getCart, clearCart, getCartTotalPrice } from './cart';
import { authApiBase, requestSession } from './session';
import type { SessionUser } from './session';

export default function CheckoutView({ onBack, onComplete }: { onBack: () => void, onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  
  const [deliveryMode, setDeliveryMode] = useState('delivery');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    requestSession(
      authApiBase(import.meta.env.VITE_CATALOGUE_API_URL || 'http://localhost:8080/api/catalogue', import.meta.env.VITE_AUTH_API_URL),
      controller.signal
    ).then(u => {
      setUser(u);
      setLoadingSession(false);
    }).catch(() => {
      setLoadingSession(false);
    });
    return () => controller.abort();
  }, []);

  const cart = getCart();

  if (cart.length === 0) {
    return <section className="catalogue-checkout">
      <h2>Your cart is empty.</h2>
      <button onClick={onBack}>Back to Cart</button>
    </section>;
  }

  if (loadingSession) {
    return <section className="catalogue-checkout">Checking account...</section>;
  }

  if (!user) {
    return <section className="catalogue-checkout catalogue-notice">
      <h2>Authentication Required</h2>
      <p>Please log in to proceed with checkout.</p>
      <button onClick={onBack}>Back to Cart</button>
      {/* Assuming there is a login route or button somewhere else, maybe header */}
    </section>;
  }

  const handleNext = () => setStep(s => s + 1);
  const handlePrev = () => setStep(s => s - 1);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');
    const items = cart.map(item => ({
      variantId: item.variantId,
      quantity: item.quantity
    }));

    try {
      const apiUrl = import.meta.env.VITE_CHECKOUT_API_URL || 'http://localhost:8080/api/checkout';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: user.id,
          cartItems: items
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Checkout failed');
      }

      clearCart();
      onComplete();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const [cityType, setCityType] = useState('main');
  const hasOutOfStockItems = cart.some(item => item.stockQuantity === 0);
  const baseDays = cityType === 'main' ? 5 : 7;
  const estDeliveryDays = deliveryMode === 'delivery' ? baseDays + (hasOutOfStockItems ? 3 : 0) : 0;

  return (
    <section className="catalogue-checkout" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h1>Checkout</h1>
      
      {step === 1 && (
        <div>
          <h2>Step 1: Delivery Mode</h2>
          <label>
            <input type="radio" value="delivery" checked={deliveryMode === 'delivery'} onChange={() => setDeliveryMode('delivery')} />
            Delivery
          </label>
          <br/>
          <label>
            <input type="radio" value="pickup" checked={deliveryMode === 'pickup'} onChange={() => setDeliveryMode('pickup')} />
            Store Pickup
          </label>
          <div style={{marginTop: '1rem'}}>
            <button onClick={handleNext} className="catalogue-primary">Next</button>
            <button onClick={onBack} className="catalogue-text-button" style={{marginLeft: '1rem'}}>Back to Cart</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2>Step 2: Address & Estimated Delivery</h2>
          {deliveryMode === 'delivery' ? (
            <>
              <label style={{display: 'block', marginBottom: '0.5rem'}}>Shipping Address:</label>
              <textarea value={address} onChange={e => setAddress(e.target.value)} rows={3} style={{width: '100%'}} />
              <label style={{display: 'block', marginTop: '1rem', marginBottom: '0.5rem'}}>City Type:</label>
              <select value={cityType} onChange={e => setCityType(e.target.value)} style={{width: '100%', marginBottom: '1rem', padding: '0.5rem'}}>
                <option value="main">Main City (e.g. Colombo, Kandy, Galle)</option>
                <option value="other">Other City / Regional</option>
              </select>
              <p><strong>Estimated Delivery:</strong> {estDeliveryDays} days {hasOutOfStockItems && '(Includes +3 days for out of stock items)'}</p>
            </>
          ) : (
            <p>Pickup in store available tomorrow.</p>
          )}
          
          <div style={{marginTop: '1rem'}}>
            <button onClick={handleNext} className="catalogue-primary" disabled={deliveryMode === 'delivery' && !address.trim()}>Next</button>
            <button onClick={handlePrev} className="catalogue-text-button" style={{marginLeft: '1rem'}}>Back</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h2>Step 3: Payment Method</h2>
          <label>
            <input type="radio" value="card" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} />
            Credit / Debit Card
          </label>
          <br/>
          <label>
            <input type="radio" value="paypal" checked={paymentMethod === 'paypal'} onChange={() => setPaymentMethod('paypal')} />
            PayPal
          </label>
          <br/>
          <label>
            <input type="radio" value="cod" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} />
            Cash on Delivery
          </label>
          <div style={{marginTop: '1rem'}}>
            <button onClick={handleNext} className="catalogue-primary">Review Order</button>
            <button onClick={handlePrev} className="catalogue-text-button" style={{marginLeft: '1rem'}}>Back</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div>
          <h2>Step 4: Review & Submit</h2>
          <ul>
            <li><strong>Delivery:</strong> {deliveryMode}</li>
            {deliveryMode === 'delivery' && <li><strong>Address:</strong> {address}</li>}
            <li><strong>Payment:</strong> {paymentMethod}</li>
            <li><strong>Total:</strong> ${getCartTotalPrice().toFixed(2)}</li>
          </ul>
          
          {error && <p className="catalogue-field-error" style={{color: 'red'}}>{error}</p>}
          
          <div style={{marginTop: '1rem'}}>
            <button onClick={handleSubmit} className="catalogue-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Processing...' : 'Place Order'}
            </button>
            <button onClick={handlePrev} className="catalogue-text-button" style={{marginLeft: '1rem'}} disabled={isSubmitting}>Back</button>
          </div>
        </div>
      )}

    </section>
  );
}
