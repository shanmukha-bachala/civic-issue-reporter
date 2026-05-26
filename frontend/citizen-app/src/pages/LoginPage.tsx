import React, { useState } from 'react';
import { User, Lock, MapPin } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'citizen' | 'admin'>('citizen');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });
      let data;
      if (!res.ok) {
        // If not ok, parse as text and show error
        const text = await res.text();
        throw new Error(text || 'Login failed');
      } else {
        data = await res.json();
      }
      const token = data?.data?.token;
      const user = data?.data?.user;
      if (token) {
        localStorage.setItem('token', token);
      }
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
      }
      const finalRole = (user?.role || role || 'citizen').toLowerCase();
      if (finalRole === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/citizen/dashboard');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen app-ui-bg flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center">
            <MapPin className="w-8 h-8 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Access your civic issues dashboard
          </p>
        </div>
        
        <div className="card p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 text-red-700 border border-red-200 rounded p-3 text-sm">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                I am a
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'citizen' | 'admin')}
                className="w-full pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="citizen">Citizen</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <button type="button" onClick={async () => {
                try {
                  const res = await fetch('http://localhost:5000/api/auth/oauth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'google', role }) });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data?.error || 'Social login failed');
                  const token = data?.data?.token; const user = data?.data?.user;
                  if (token) localStorage.setItem('token', token);
                  if (user) localStorage.setItem('user', JSON.stringify(user));
                  const finalRole = (user?.role || role || 'citizen').toLowerCase();
                  if (finalRole === 'admin') navigate('/admin/dashboard'); else navigate('/citizen/dashboard');
                } catch (e:any) { setError(e.message); }
              }} className="w-full py-2 border rounded">Continue with Google</button>
              <button type="button" onClick={async () => {
                try {
                  const res = await fetch('http://localhost:5000/api/auth/oauth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'facebook', role }) });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data?.error || 'Social login failed');
                  const token = data?.data?.token; const user = data?.data?.user;
                  if (token) localStorage.setItem('token', token);
                  if (user) localStorage.setItem('user', JSON.stringify(user));
                  const finalRole = (user?.role || role || 'citizen').toLowerCase();
                  if (finalRole === 'admin') navigate('/admin/dashboard'); else navigate('/citizen/dashboard');
                } catch (e:any) { setError(e.message); }
              }} className="w-full py-2 border rounded">Continue with Facebook</button>
              <button type="button" onClick={async () => {
                try {
                  const res = await fetch('http://localhost:5000/api/auth/oauth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'x', role }) });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data?.error || 'Social login failed');
                  const token = data?.data?.token; const user = data?.data?.user;
                  if (token) localStorage.setItem('token', token);
                  if (user) localStorage.setItem('user', JSON.stringify(user));
                  const finalRole = (user?.role || role || 'citizen').toLowerCase();
                  if (finalRole === 'admin') navigate('/admin/dashboard'); else navigate('/citizen/dashboard');
                } catch (e:any) { setError(e.message); }
              }} className="w-full py-2 border rounded">Continue with X</button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
                  Forgot your password?
                </a>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className={`w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium btn-gradient ${loading ? 'opacity-80 cursor-not-allowed' : ''}`}
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>

            <div className="text-center">
              <span className="text-sm text-gray-600">
                Don't have an account?{' '}
                <Link to="/signup/citizen" className="font-medium text-blue-600 hover:text-blue-500">
                  Sign up
                </Link>
              </span>
            </div>
          </form>
        </div>

        <div className="text-center">
          <Link
            to="/"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;