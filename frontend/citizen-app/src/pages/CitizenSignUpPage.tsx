import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const API_BASE = 'http://localhost:5000';

const CitizenSignUpPage: React.FC = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '', userType: 'citizen' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      setError('All fields are required');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const parts = form.name.trim().split(' ');
      const firstName = parts[0] || form.name;
      const lastName = parts.slice(1).join(' ');
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          firstName,
          lastName,
          role: form.userType === 'admin' ? 'admin' : 'citizen'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Registration failed');
      // After successful signup, redirect to dashboard
      if (form.userType === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/citizen/dashboard');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center app-ui-bg">
      <form className="card p-8 w-full max-w-md" onSubmit={handleSubmit}>
        <h2 className="text-2xl font-bold mb-6">Sign Up</h2>
        {error && <div className="text-red-500 mb-4">{error}</div>}
        <select name="userType" className="mb-4 w-full p-2 border rounded" value={form.userType} onChange={handleChange}>
          <option value="citizen">Citizen</option>
          <option value="admin">Admin</option>
        </select>
        <input name="name" type="text" placeholder="Name" className="mb-4 w-full p-2 border rounded" value={form.name} onChange={handleChange} />
        <input name="email" type="email" placeholder="Email" className="mb-4 w-full p-2 border rounded" value={form.email} onChange={handleChange} />
        <input name="password" type="password" placeholder="Password" className="mb-6 w-full p-2 border rounded" value={form.password} onChange={handleChange} />
        <button type="submit" disabled={loading} className={`w-full py-2 btn-gradient ${loading ? 'opacity-80 cursor-not-allowed' : ''}`}>{loading ? 'Signing Up...' : 'Sign Up'}</button>
        <div className="text-center text-sm text-gray-600 mt-3">
          Already have an account? <Link to="/login" className="text-blue-600 hover:text-blue-700">Login</Link>
        </div>
        <div className="grid grid-cols-1 gap-3 mt-4">
          <button type="button" onClick={async () => {
            try {
              const res = await fetch('http://localhost:5000/api/auth/oauth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'google', role: form.userType }) });
              const data = await res.json();
              if (!res.ok) throw new Error(data?.error || 'Social signup failed');
              const token = data?.data?.token; const user = data?.data?.user;
              if (token) localStorage.setItem('token', token);
              if (user) localStorage.setItem('user', JSON.stringify(user));
              if (user?.role === 'admin') navigate('/admin/dashboard'); else navigate('/citizen/dashboard');
            } catch (e:any) { setError(e.message); }
          }} className="w-full py-2 border rounded">Sign up with Google</button>
          <button type="button" onClick={async () => {
            try {
              const res = await fetch('http://localhost:5000/api/auth/oauth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'facebook', role: form.userType }) });
              const data = await res.json();
              if (!res.ok) throw new Error(data?.error || 'Social signup failed');
              const token = data?.data?.token; const user = data?.data?.user;
              if (token) localStorage.setItem('token', token);
              if (user) localStorage.setItem('user', JSON.stringify(user));
              if (user?.role === 'admin') navigate('/admin/dashboard'); else navigate('/citizen/dashboard');
            } catch (e:any) { setError(e.message); }
          }} className="w-full py-2 border rounded">Sign up with Facebook</button>
          <button type="button" onClick={async () => {
            try {
              const res = await fetch('http://localhost:5000/api/auth/oauth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'x', role: form.userType }) });
              const data = await res.json();
              if (!res.ok) throw new Error(data?.error || 'Social signup failed');
              const token = data?.data?.token; const user = data?.data?.user;
              if (token) localStorage.setItem('token', token);
              if (user) localStorage.setItem('user', JSON.stringify(user));
              if (user?.role === 'admin') navigate('/admin/dashboard'); else navigate('/citizen/dashboard');
            } catch (e:any) { setError(e.message); }
          }} className="w-full py-2 border rounded">Sign up with X</button>
        </div>
      </form>
    </div>
  );
};

export default CitizenSignUpPage;
