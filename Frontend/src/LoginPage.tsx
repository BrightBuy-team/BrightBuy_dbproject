import { useState } from 'react';
import './LoginPage.css';

export default function LoginPage({ onLogin }: { onLogin: (role: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    
    // Simple mock authentication
    if (email === 'admin@brightbuy.com' && password === 'admin123') {
      onLogin('admin');
    } else if (email && password) {
      onLogin('user');
    }
  };

  return (
    <div className="login-container">
      <div className="login-left">
        <div className="login-branding">
          <div className="login-logo-icon">b.</div>
          <span className="login-logo-text">BrightBuy</span>
        </div>
        <div className="login-quote-container">
          <h1 className="login-heading">Welcome to BrightBuy</h1>
          <p className="login-quote">
            "This platform has completely transformed how I manage my everyday shopping. Good finds, everyday possibilities."
          </p>
          <p className="login-author">~ Happy Customer</p>
        </div>
      </div>
      
      <div className="login-right">
        <div className="login-form-container">
          <h2 className="login-title">Sign In to Your Account</h2>
          <p className="login-subtitle">Enter your email and password to continue</p>
          
          {error && <div className="login-error">{error}</div>}
          
          <form className="login-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input 
                id="email" 
                type="email" 
                placeholder="admin@brightbuy.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input 
                id="password" 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            
            <button type="submit" className="login-submit-btn">Login</button>
          </form>
          
          <div className="login-demo-hint">
            <p><strong>Admin Access:</strong> admin@brightbuy.com / admin123</p>
            <p><strong>User Access:</strong> Any other email / password</p>
          </div>
        </div>
      </div>
    </div>
  );
}
