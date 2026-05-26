import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const API_BASE = 'http://localhost:5000';

const AdminSignUpPage: React.FC = () => {
  const [form, setForm] = useState({ username: '', email: '', password: '', userType: 'admin' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) { setError('Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    }, () => setError('Unable to fetch location'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.email || !form.password) {
      setError('All fields are required');
      return;
    }
    if (form.userType === 'admin' && (coords.lat == null || coords.lng == null)) {
      setError('Please set your work area location on the map or use your current location.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const parts = form.username.trim().split(' ');
      const firstName = parts[0] || form.username;
      const lastName = parts.slice(1).join(' ');
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          firstName,
          lastName,
          role: form.userType === 'admin' ? 'admin' : 'citizen',
          latitude: coords.lat,
          longitude: coords.lng,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Registration failed');
      // Optionally store user/token if returned
      if (data?.data?.token) localStorage.setItem('token', data.data.token);
      if (data?.data?.user) localStorage.setItem('user', JSON.stringify(data.data.user));
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
          <option value="admin">Admin</option>
          <option value="citizen">Citizen</option>
        </select>
        <input name="username" type="text" placeholder="Username" className="mb-4 w-full p-2 border rounded" value={form.username} onChange={handleChange} />
        <input name="email" type="email" placeholder="Email" className="mb-4 w-full p-2 border rounded" value={form.email} onChange={handleChange} />
        <input name="password" type="password" placeholder="Password" className="mb-4 w-full p-2 border rounded" value={form.password} onChange={handleChange} />
        {form.userType === 'admin' && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Work Area Location</label>
            <div className="mb-2">
              {React.createElement(require('../components/MapPicker').default, { lat: coords.lat, lng: coords.lng, onChange: (lat: number, lng: number) => setCoords({ lat, lng }), height: 220 })}
            </div>
            <div className="text-xs text-gray-600">Click on the map to set your work area center, or <button type="button" onClick={useMyLocation} className="text-blue-600 hover:text-blue-700">use my current location</button>.</div>
            {coords.lat != null && coords.lng != null && (
              <div className="text-xs text-gray-600 mt-1">Lat: {coords.lat.toFixed(5)}, Lng: {coords.lng.toFixed(5)}</div>
            )}
          </div>
        )}
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

export default AdminSignUpPage;
