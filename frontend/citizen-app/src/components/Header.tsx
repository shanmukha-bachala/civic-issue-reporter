import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Plus, List, User, Menu, X, Bell } from 'lucide-react';
import CivicLogo from './CivicLogo';

const API_BASE = 'http://localhost:5000';

const Header: React.FC = () => {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const navigate = useNavigate();
  const [logoError, setLogoError] = React.useState(false);
  const [auth, setAuth] = React.useState<{ token: string | null; user: any | null }>({ token: null, user: null });
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [notifUnread, setNotifUnread] = React.useState(0);
  const [notifs, setNotifs] = React.useState<any[]>([]);

  React.useEffect(() => {
    const token = localStorage.getItem('token');
    let user: any = null;
    try { user = JSON.parse(localStorage.getItem('user') || 'null'); } catch {}
    setAuth({ token, user });
  }, [location.pathname]);

  // Load unread notifications count for bell
  React.useEffect(() => {
    const load = async () => {
      try {
        if (!auth.token) { setNotifUnread(0); setNotifs([]); return; }
        const r = await fetch(`${API_BASE}/api/notifications?read=false&limit=20`, { headers: { Authorization: `Bearer ${auth.token}` } });
        if (!r.ok) { setNotifUnread(0); return; }
        const j = await r.json();
        if (j?.success) { setNotifs(j.data || []); setNotifUnread((j.data || []).length); }
      } catch { setNotifUnread(0); }
    };
    load();
  }, [auth.token]);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setAuth({ token: null, user: null });
    navigate('/');
  };

  const navItems: { path: string; label: string; icon: any }[] = [
    { path: '/', label: 'Home', icon: User },
    // Only show Issues Map when logged in; visitors see solved map on Home
    ...(auth.user ? [{ path: (auth.user.role === 'admin' ? '/map/admin' : '/map/citizen'), label: 'Issues Map', icon: List }] : []),
    // Citizen-only Local Concerns
    ...(auth.user?.role === 'citizen' ? [{ path: '/local', label: 'Local Concerns', icon: List }] : []),
    // Analytics nav for both roles
    ...(auth.user ? [{ path: (auth.user.role === 'admin' ? '/admin/analytics' : '/citizen/analytics'), label: 'Analytics', icon: List }] : [])
  ];

  return (
    <header className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            {logoError ? (
              <CivicLogo size={36} />
            ) : (
              <img
                src={process.env.REACT_APP_LOGO_URL || '/logo.png'}
                alt="Logo"
                className="w-9 h-9 object-contain rounded"
                onError={() => setLogoError(true)}
              />
            )}
            <span className="text-xl font-bold text-white-900">
              Civic Mitr
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? 'text-white bg-white/10'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Menu */}
          <div className="hidden md:flex items-center space-x-4">
            {auth.token && auth.user ? (
              <>
                <button onClick={() => setNotifOpen(true)} className="relative p-2 rounded hover:bg-white/10">
                  <Bell className="w-5 h-5" />
                  {notifUnread > 0 && (
                    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center text-xs font-semibold text-white bg-red-500 rounded-full min-w-[1.25rem] h-5 px-1">
                      {notifUnread}
                    </span>
                  )}
                </button>
                <Link
                  to={auth.user.role === 'admin' ? '/admin/dashboard' : '/citizen/dashboard'}
                  className="px-4 py-2 text-sm font-medium text-white/90 hover:text-white"
                >
                  Dashboard
                </Link>
                <Link
                  to="/profile"
                  className="px-4 py-2 text-sm font-medium text-white/90 hover:text-white"
                >
                  Profile
                </Link>
                <button
                  onClick={logout}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-500/90 rounded hover:bg-red-600"
                >
                  Logout
                </button>
              </>
            ) : (
              location.pathname === '/' ? (
                <Link
                  to="/login"
                  className="btn-ghost-light transition-colors"
                >
                  <span>Login</span>
                </Link>
              ) : null
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
          >
            {isMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <div className="flex flex-col space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium ${
                      location.pathname === item.path
                        ? 'text-blue-600 bg-blue-50'
                        : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              {auth.token && auth.user ? (
                <>
                  <Link
                    to={auth.user.role === 'admin' ? '/admin/dashboard' : '/citizen/dashboard'}
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
                  >
                    <span>Dashboard</span>
                  </Link>
                  <Link
                    to="/profile"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
                  >
                    <span>Profile</span>
                  </Link>
                  <button
                    onClick={() => { setIsMenuOpen(false); logout(); }}
                    className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-white bg-red-500 hover:bg-red-600"
                  >
                    <span>Logout</span>
                  </button>
                </>
              ) : (
                location.pathname === '/' ? (
                <Link
                  to="/login"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-white/90 hover:text-white hover:bg-white/10"
                >
                  <span>Login</span>
                </Link>
                ) : null
              )}
            </div>
          </div>
        )}
      </div>

      {/* Notifications modal */}
      {notifOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center mt-10">
          <div className="absolute inset-0 bg-black/30" onClick={() => setNotifOpen(false)} />
          <div className="relative z-10 w-full max-w-md mx-4 card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="inline-flex items-center gap-2"><Bell className="w-5 h-5" /> <span className="text-lg font-semibold">Notifications</span></div>
              <div className="flex items-center gap-2">
                <button onClick={() => setNotifOpen(false)} className="px-3 py-1 text-sm border rounded hover:bg-gray-100">Close</button>
                {notifUnread > 0 && (
                  <button onClick={async () => { try { if (!auth.token) return; const r = await fetch(`${API_BASE}/api/notifications/mark-all-read`, { method: 'PUT', headers: { Authorization: `Bearer ${auth.token}` } }); if (r.ok) { setNotifUnread(0); setNotifs([]); } } catch {} }} className="px-3 py-1 text-sm btn-outline-indigo">Mark all as read</button>
                )}
              </div>
            </div>
            {notifs.length > 0 ? (
              <ul className="divide-y divide-gray-200 max-h-[60vh] overflow-auto">
                {notifs.map((n) => (
                  <li key={n.id} className="py-3 flex items-start justify-between">
                    <div className="pr-4">
                      <div className="text-sm font-medium text-gray-900">{n.title}</div>
                      <div className="text-sm text-gray-600">{n.message}</div>
                    </div>
                    <Link to={`/issues/${n.issue_id}`} onClick={() => setNotifOpen(false)} className="text-sm text-indigo-700 hover:underline">View</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-gray-600">No new notifications.</div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;