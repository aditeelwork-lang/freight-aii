import React, { useState } from 'react';
import { loginUser, registerUser } from '../api';

export default function Auth({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', companyName: '', role: 'shipper' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => setFormData({ ...formData, [event.target.name]: event.target.value });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (isLogin) {
        const response = await loginUser({ email: formData.email, password: formData.password });
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        onLoginSuccess?.(response.data.user);
      } else {
        await registerUser(formData);
        setSuccess('Registration successful. Please log in.');
        setIsLogin(true);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not connect to Freight-AI. Check that the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-brand"><div className="brand-icon">↗</div><div><strong>Freight-AI</strong><span>LOGISTICS INTELLIGENCE</span></div></div>
      <section className="auth-card">
        <p className="eyebrow">{isLogin ? 'WELCOME BACK' : 'GET STARTED'}</p>
        <h1>{isLogin ? 'Sign in to Freight-AI' : 'Create your workspace'}</h1>
        <p className="auth-subtitle">{isLogin ? 'Access your freight operations workspace.' : 'Register your company to start managing shipments.'}</p>
        {error && <div className="alert error-alert" role="alert">{error}</div>}
        {success && <div className="alert success-alert" role="status">{success}</div>}
        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && <>
            <label>Full name<input name="name" value={formData.name} onChange={handleChange} required minLength="2" autoComplete="name" placeholder="Your full name" /></label>
            <label>Company name<input name="companyName" value={formData.companyName} onChange={handleChange} required minLength="2" autoComplete="organization" placeholder="Company name" /></label>
            <label>Account type<select name="role" value={formData.role} onChange={handleChange}><option value="shipper">Shipper</option><option value="carrier">Carrier</option></select></label>
          </>}
          <label>Email address<input type="email" name="email" value={formData.email} onChange={handleChange} required autoComplete="email" placeholder="you@company.com" /></label>
          <label>Password<input type="password" name="password" value={formData.password} onChange={handleChange} required minLength={isLogin ? 1 : 8} autoComplete={isLogin ? 'current-password' : 'new-password'} placeholder={isLogin ? 'Your password' : 'At least 8 characters'} /></label>
          <button className="primary-btn auth-submit" type="submit" disabled={loading}>{loading ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}</button>
        </form>
        <p className="auth-switch">{isLogin ? "Don't have an account?" : 'Already registered?'} <button type="button" onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }}>{isLogin ? 'Create account' : 'Sign in'}</button></p>
      </section>
      <p className="auth-footnote">Demo build · Do not use real shipment or customer data</p>
    </div>
  );
}
