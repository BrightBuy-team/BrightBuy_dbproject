import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.2 }
    );

    const hiddenElements = document.querySelectorAll('.scroll-reveal');
    hiddenElements.forEach((el) => observer.observe(el));

    return () => {
      window.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, []);

  // Calculate cloud parallax (move inward when scrolling down)
  const cloudOffset = Math.max(0, 100 - (scrollY * 0.15));

  return (
    <div className="store-container">
      {/* HEADER */}
      <header className="store-header">
        <div className="header-container">
          <div className="logo-container">
            <div className="logo-icon">b.</div>
            <span className="logo-text">BrightBuy</span>
          </div>
          
          <nav className="main-nav">
            <a href="/catalogue.html" className="nav-link">Catalogue</a>
            <a href="/inventory.html" className="nav-link">Inventory</a>
            <a href="/delivery.html" className="nav-link">Delivery</a>
          </nav>
          
          <div className="header-actions">
            <button className="icon-btn" aria-label="Search">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </button>
            <button className="icon-btn" aria-label="Account">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </button>
            <button className="icon-btn cart-btn" aria-label="Cart">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
              <span className="cart-badge">0</span>
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="hero-section">
        <div className="hero-content">
          <span className="hero-badge">Welcome to BrightBuy</span>
          <h1 className="hero-title">Elevate Your<br/><span>Shopping Experience</span></h1>
          <p className="hero-subtitle">Discover premium collections tailored just for you. Quality meets convenience.</p>
        </div>
      </section>

      {/* SCROLL REVEAL TEXT SECTION */}
      <section className="reveal-section">
        <div className="reveal-content scroll-reveal">
          <h2 className="reveal-text">
            Good finds.<br/>
            <span className="reveal-highlight">Everyday possibilities.</span>
          </h2>
          <p className="reveal-subtext">Explore the collection. Find the details that make it yours.</p>
          <div style={{ marginTop: '3rem' }}>
            <a href="/catalogue.html" className="btn btn-primary massive-btn" style={{ padding: '1rem 3rem', fontSize: '1.2rem' }}>Shop Collection</a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="store-footer">
        <p>&copy; 2026 BrightBuy. All rights reserved.</p>
      </footer>
    </div>
  )
}

export default App
