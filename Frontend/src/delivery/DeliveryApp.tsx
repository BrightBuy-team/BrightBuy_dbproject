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
        const res = await fetch('http://localhost:8080/api/delivery/cities');
        if (!res.ok) throw new Error("Failed to fetch cities");
        const data = await res.json();
        setCities(data);

        // Select the first city by default if available
        if (data && data.length > 0) {
          setSelectedCityId(data[0].cityId.toString());
        }
        setLoading(false);
      } catch (err) {
        console.error("Error fetching cities:", err);
        setError("Could not connect to the backend server. Make sure your Spring Boot server is running!");
        setLoading(false);
      }
    };
    fetchCities();
  }, []);

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCityId || !orderId) {
      alert("Please enter an Order ID and select a Destination City.");
      return;
    }

    setCalculating(true);
    setEstimatedDate(null);
    setError(null);

    try {
      const res = await fetch(`http://localhost:8080/api/delivery/estimate?cityId=${selectedCityId}&orderId=${orderId}`);
      if (!res.ok) {
        throw new Error("Failed to calculate estimate. Ensure the Order ID exists in the database.");
      }
      const data = await res.json();

      // Formatting the date nicely
      const dateObj = new Date(data.estimated_delivery_date);
      const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      setEstimatedDate(dateObj.toLocaleDateString(undefined, options));

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during calculation.");
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

        <header className="delivery-header">
          <div className="icon-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13"></rect>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
          </div>
          <h1>Track & Estimate</h1>
          <p>Instantly calculate delivery times based on inventory and location.</p>
        </header>

        {error && (
          <div className="error-message">
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
            <small>Must be a valid existing Order ID in the database to calculate out-of-stock penalties.</small>
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
            <p className="success-note">✔ Logistics planned successfully via BrightBuy SQL Engine.</p>
          </div>
        )}

      </div>
    </div>
  );
}
