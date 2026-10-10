import { apiBase,apiRequest } from '../catalogue/client'
import { useState, useEffect } from 'react';

// Interfaces matching Java Backend
interface City {
  cityId: number;
  name: string;
  isMainCity: boolean;
}

export default function DeliveryApp() {
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<string>('');
  const [orderId, setOrderId] = useState<string>('');
  const [estimatedDate, setEstimatedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [calculating, setCalculating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch cities on load
  useEffect(() => {
    const fetchCities = async () => {
      try {
        const data = await apiRequest<City[]>(apiBase('delivery')+'/cities');
        setCities(data);

        // Select the first city by default if available
        if (data && data.length > 0) {
          setSelectedCityId(data[0].cityId.toString());
        }
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'The delivery service is unavailable.');
        setLoading(false);
      }
    };
    fetchCities();
  }, []);

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCityId || !orderId) {
      setError('Enter an order ID and choose the destination city.');
      return;
    }

    setCalculating(true);
    setEstimatedDate(null);
    setError(null);

    try {
      const data = await apiRequest<{est_delivery_date:string|null;delivery_mode:string}>(apiBase('delivery')+'/estimate?'+new URLSearchParams({cityId:selectedCityId,orderId}));

      // Formatting the date nicely
      if(data.delivery_mode==='pickup'){setEstimatedDate('Store pickup — city-based delivery dates do not apply.');return}
      if(!data.est_delivery_date)throw new Error('No delivery date has been recorded for this order.');
      const dateObj = new Date(data.est_delivery_date.slice(0,10)+'T00:00:00');
      if(Number.isNaN(dateObj.getTime()))throw new Error('Invalid delivery date returned.');
      const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      setEstimatedDate(dateObj.toLocaleDateString(undefined, options));

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'The estimate could not be loaded.');
    } finally {
      setCalculating(false);
    }
  };

  if (loading) {
    return <div className="loading-screen"><h2>Loading Delivery System...</h2></div>;
  }

  return (
    <div className="delivery-container">
      <div className="glass-panel delivery-card">

        <header className="delivery-header" style={{ position: 'relative' }}>
          <a href="/" style={{ position: 'absolute', left: '1rem', top: '1rem', textDecoration: 'none', color: '#2563eb', fontWeight: 'bold' }}>← Back</a>

          <div className="icon-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13"></rect>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
          </div>
          <h1>Track & Estimate</h1>
          <p>View the purchase-time delivery estimate for your own order. Sign in first.</p>
        </header>

        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleCalculate} className="delivery-form">
          <div className="form-group">
            <label htmlFor="orderId">Order ID</label>
            <input
              type="number"
              id="orderId"
              placeholder="e.g. 101"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              required
            />
            <small>Use one of your order IDs. The destination must match the order; later stock changes do not change its recorded estimate.</small>
          </div>

          <div className="form-group">
            <label htmlFor="city">Destination City</label>
            <select
              id="city"
              value={selectedCityId}
              onChange={(e) => setSelectedCityId(e.target.value)}
              required
            >
              {cities.map(city => (
                <option key={city.cityId} value={city.cityId}>
                  {city.name} {city.isMainCity ? "(Main Hub - Faster)" : "(Regional - Standard)"}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn-calculate" disabled={calculating}>
            {calculating ? 'Calculating...' : 'Get Delivery Estimate'}
          </button>
        </form>

        {estimatedDate && (
          <div className="result-card">
            <h3>Estimated Delivery Date</h3>
            <div className="date-display">{estimatedDate}</div>
            <p className="success-note">Recorded when the order was placed.</p>
          </div>
        )}

      </div>
    </div>
  );
}
