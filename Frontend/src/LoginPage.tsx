import { useState } from 'react';
import './LoginPage.css';

export default function LoginPage({ onLogin }: { onLogin: (role: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    
    // Get existing users
    const usersStr = localStorage.getItem('mockUsers');
    const users = usersStr ? JSON.parse(usersStr) : [];

    if (isRegistering) {
      // Check if user already exists
      if (email === 'admin@brightbuy.com' || users.find((u: any) => u.email === email)) {
        setError('An account with this email already exists.');
        return;
      }
      // Create new user
      users.push({ email, password });
      localStorage.setItem('mockUsers', JSON.stringify(users));
      // Auto-login after registration
      onLogin('user');
    } else {
      // Handle Login
      if (email === 'admin@brightbuy.com' && password === 'admin123') {
        onLogin('admin');
        return;
      } 
      
      const user = users.find((u: any) => u.email === email && u.password === password);
      if (user) {
        onLogin('user');
      } else {
        setError('Invalid email or password.');
      }
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
          <h2 className="login-title">{isRegistering ? 'Create an Account' : 'Sign In to Your Account'}</h2>
          <p className="login-subtitle">
            {isRegistering ? 'Enter your details to create a new account' : 'Enter your email and password to continue'}
          </p>
          
          {error && <div className="login-error">{error}</div>}
          
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input 
                id="email" 
                type="email" 
                placeholder="you@example.com" 
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
            
            <button type="submit" className="login-submit-btn">
              {isRegistering ? 'Create Account' : 'Login'}
            </button>
          </form>
          
          <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem' }}>
            {isRegistering ? (
              <p style={{ color: '#64748b' }}>
                Already have an account?{' '}
                <button 
                  onClick={() => { setIsRegistering(false); setError(''); }}
                  style={{ background: 'none', border: 'none', color: '#0f172a', fontWeight: 'bold', cursor: 'pointer', padding: 0 }}
                >
                  Sign In
                </button>
              </p>
            ) : (
              <p style={{ color: '#64748b' }}>
                Don't have an account?{' '}
                <button 
                  onClick={() => { setIsRegistering(true); setError(''); }}
                  style={{ background: 'none', border: 'none', color: '#0f172a', fontWeight: 'bold', cursor: 'pointer', padding: 0 }}
                >
                  Create one
                </button>
              </p>
            )}
          </div>
          
          <div className="login-demo-hint">
            <p><strong>Admin Access:</strong> admin@brightbuy.com / admin123</p>
            <p><strong>User Access:</strong> Create a new account to test</p>
          </div>
        </div>
      </div>
    </div>
  );
}
