import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Clock, Edit, Save, X, Zap } from 'lucide-react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';

interface Issue {
  id: string;
  title: string;
  description?: string;
  status: 'submitted' | 'acknowledged' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at?: string;
  latitude?: number;
  longitude?: number;
}

const API_BASE = 'http://localhost:5000';

const CitizenDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation() as any;
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ [id: string]: { title: string; description: string; priority: Issue['priority']; categoryId?: string; address?: string; latitude?: number; longitude?: number; newFiles?: File[] } }>({});
  const [categories, setCategories] = useState<any[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [ackResolved, setAckResolved] = useState<Set<string>>(new Set());
  const [issueVotes, setIssueVotes] = useState<Record<string, number>>({});
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [search, setSearch] = useState('');

  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  }, []);
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (location?.state?.justReported) {
      setBanner('Issue reported successfully!');
      setTimeout(() => setBanner(null), 3000);
    }
    // load acknowledged resolved set per user
    try {
      const key = user ? `resolvedAckIds:${user.id}` : null;
      if (key) {
        const raw = localStorage.getItem(key);
        if (raw) setAckResolved(new Set(JSON.parse(raw)));
      }
    } catch {}
    const load = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/issues?reporter=${user.id}&limit=200&sortBy=created_at&sortOrder=DESC`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to fetch issues');
        setIssues(data?.data?.issues || []);
        // Load categories
        const cats = await fetch(`${API_BASE}/api/categories`).then(r => r.json());
        if (cats?.success) setCategories(cats.data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, token]);

  // Load upvote counts for issues listed in the dashboard
  useEffect(() => {
    const loadVotes = async () => {
      try {
        const token = localStorage.getItem('token') || undefined;
        const counts: Record<string, number> = {};
        await Promise.all((issues || []).map(async (i: any) => {
          const r = await fetch(`${API_BASE}/api/issues/${i.id}/upvotes`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
          if (!r.ok) return;
          const j = await r.json();
          counts[i.id] = j?.data?.count ?? 0;
        }));
        setIssueVotes(counts);
      } catch (e) {
        // ignore; will render zeros
      }
    };
    if (issues.length > 0) loadVotes();
  }, [issues]);

  const stats = useMemo(() => {
    const total = issues.length;
    const solved = issues.filter(i => i.status === 'resolved' || i.status === 'closed').length;
    const notSolved = total - solved;
    const priorityCounts = {
      urgent: issues.filter(i => i.priority === 'urgent').length,
      high: issues.filter(i => i.priority === 'high').length,
      medium: issues.filter(i => i.priority === 'medium').length,
      low: issues.filter(i => i.priority === 'low').length,
    };
    return { total, solved, notSolved, priorityCounts };
  }, [issues]);

  // citizen open issues map (all users): fetch separately
  const [openAll, setOpenAll] = useState<any[]>([]);
  const [publicSummary, setPublicSummary] = useState<{ totalIssues: number; totalReporters: number } | null>(null);
  useEffect(() => {
    const loadOpen = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/issues?limit=500&sortBy=created_at&sortOrder=DESC`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load open issues');
        const all = data?.data?.issues || [];
        const open = all.filter((i: any) => !(i.status === 'resolved' || i.status === 'closed'));
        setOpenAll(open);
      } catch {}
    };
    const loadPublicSummary = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/analytics/public-summary`);
        const j = await r.json();
        if (j?.success) setPublicSummary(j.data);
      } catch {}
    };
    loadOpen();
    loadPublicSummary();
  }, [token]);

  const mapCenter = useMemo<[number, number]>(() => {
    const withCoords = openAll.filter((i: any) => i.latitude != null && i.longitude != null);
    if (withCoords.length > 0) return [withCoords[0].latitude as any, withCoords[0].longitude as any];
    return [20.5937, 78.9629];
  }, [openAll]);

  // New: load server notifications (unread)
  useEffect(() => {
    const loadNotifs = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const r = await fetch(`${API_BASE}/api/notifications?read=false&limit=50`, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) return;
        const j = await r.json();
        if (j?.success) { setNotifications(j.data || []); setUnreadCount((j.data || []).length); }
      } catch {}
    };
    loadNotifs();
  }, []);

  // Fallback: resolved/closed issues not yet acknowledged by this user
  const resolvedUnread = useMemo(() => {
    return issues.filter(i => (i.status === 'resolved' || i.status === 'closed') && !ackResolved.has(i.id));
  }, [issues, ackResolved]);

  const markAllNotificationsRead = () => {
    if (!user) return;
    const allIds = new Set<string>();
    ackResolved.forEach((id) => allIds.add(id));
    issues.forEach(i => { if (i.status === 'resolved' || i.status === 'closed') allIds.add(i.id); });
    setAckResolved(allIds);
    try { localStorage.setItem(`resolvedAckIds:${user.id}`, JSON.stringify(Array.from(allIds))); } catch {}
  };

  const startEdit = (issue: any) => {
    setEditing(prev => ({
      ...prev,
      [issue.id]: {
        title: issue.title,
        description: issue.description || '',
        priority: issue.priority,
        categoryId: issue.category_id || issue.categoryId,
        address: issue.address || '',
        latitude: issue.latitude,
        longitude: issue.longitude,
      }
    }));
  };

  const cancelEdit = (id: string) => {
    setEditing(prev => { const p = { ...prev }; delete p[id]; return p; });
  };

  const setMyLocationFor = (id: string) => {
    if (!navigator.geolocation) return alert('Geolocation not supported');
    navigator.geolocation.getCurrentPosition((pos) => {
      setEditing(prev => ({ ...prev, [id]: { ...prev[id], latitude: pos.coords.latitude, longitude: pos.coords.longitude } }));
    }, () => alert('Unable to fetch location'));
  };

  const saveEdit = async (id: string) => {
    try {
      const payload: any = {};
      if (editing[id]?.title !== undefined) payload.title = editing[id].title;
      if (editing[id]?.description !== undefined) payload.description = editing[id].description;
      if (editing[id]?.priority) payload.priority = editing[id].priority;
      if (editing[id]?.categoryId) payload.categoryId = editing[id].categoryId;
      if (editing[id]?.address !== undefined) payload.address = editing[id].address;
      if (editing[id]?.latitude !== undefined) payload.latitude = editing[id].latitude;
      if (editing[id]?.longitude !== undefined) payload.longitude = editing[id].longitude;
      const res = await fetch(`${API_BASE}/api/issues/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to save');
      // Upload new photos if any
      const files = editing[id]?.newFiles || [];
      if (files.length > 0) {
        const fd = new FormData();
        files.forEach(f => fd.append('files', f));
        const up = await fetch(`${API_BASE}/api/issues/${id}/attachments`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd
        });
        const upData = await up.json();
        if (!up.ok) throw new Error(upData?.error || 'Failed to upload photos');
        setIssues(prev => prev.map(i => i.id === id ? upData.data : i));
      } else {
        setIssues(prev => prev.map(i => i.id === id ? data.data : i));
      }
      cancelEdit(id);
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded shadow border">
          <p className="mb-4">You are not logged in.</p>
          <button onClick={() => navigate('/login')} className="px-4 py-2 bg-blue-600 text-white rounded">Go to Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-auth-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {(user?.firstName || user?.email || 'User')}</h1>
          <div className="flex items-center gap-2">
            <Link to="/report" className="px-4 py-2 btn-gradient">Report Issue</Link>
          </div>
        </div>

        {/* Public analytics summary */}
        <div className="card p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 rounded border bg-white/70">
              <div className="text-xs text-gray-500">Platform Issues (all users)</div>
              <div className="text-xl font-semibold">{publicSummary?.totalIssues ?? '—'}</div>
            </div>
            <div className="p-3 rounded border bg-white/70">
              <div className="text-xs text-gray-500">Unique Reporters</div>
              <div className="text-xl font-semibold">{publicSummary?.totalReporters ?? '—'}</div>
            </div>
          </div>
        </div>

        {banner && (
          <div className="mb-4 p-3 border border-green-200 bg-green-50 text-green-700 rounded">{banner}</div>
        )}
        {(() => { const hlat = user?.homeLatitude ?? user?.home_latitude; const hlng = user?.homeLongitude ?? user?.home_longitude; if (hlat == null || hlng == null) return (
          <div className="mb-4 p-3 border border-yellow-200 bg-yellow-50 text-yellow-800 rounded">Please set your Home Location in your Profile to unlock Local Concerns and upvoting. <Link to="/profile" className="text-indigo-700 hover:underline ml-2">Set now</Link></div>
        ); return null; })()}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="card card-hover p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total My Issues</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-blue-600" />
          </div>
          <div className="card card-hover p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Solved</p>
              <p className="text-2xl font-bold text-green-600">{stats.solved}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <div className="card card-hover p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Not Solved</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.notSolved}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
          <div className="card card-hover p-4">
            <p className="text-sm text-gray-600">Priority</p>
            <div className="flex justify-between mt-2 text-sm">
              <span className="text-red-600">Urgent: {stats.priorityCounts.urgent}</span>
              <span className="text-orange-600">High: {stats.priorityCounts.high}</span>
              <span className="text-yellow-600">Medium: {stats.priorityCounts.medium}</span>
              <span className="text-gray-600">Low: {stats.priorityCounts.low}</span>
            </div>
          </div>
        </div>

        {/* Citizen Map: open issues */}
        <div className="card p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-900">Open Issues Map</h2>
          </div>
          <div className="rounded-xl overflow-hidden border border-white/70">
            <MapContainer center={mapCenter} zoom={12} style={{ height: 360, width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url={process.env.REACT_APP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
              />
              {openAll.filter((i: any) => i.latitude != null && i.longitude != null).map((i: any) => (
                <Marker key={i.id} position={[i.latitude as any, i.longitude as any]}>
                  <Popup>
                    <div className="text-sm">
                      <div className="font-semibold">{i.title}</div>
                      <div className="text-gray-600">{i.status.replace('_',' ')}</div>
                      <a className="text-indigo-700 underline" href={`/issues/${i.id}`}>View</a>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>

        {/* Inbox panel */}
        {inboxOpen && (
          <div className="mb-6 card p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => { setInboxOpen(false); }} className="px-3 py-1 text-sm border rounded hover:bg-gray-100">Close</button>
                {(unreadCount > 0) && (
                  <button onClick={async () => { try { const token = localStorage.getItem('token'); if (!token) return; const r = await fetch(`${API_BASE}/api/notifications/mark-all-read`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } }); if (r.ok) { setUnreadCount(0); setNotifications([]); } } catch {} }} className="px-3 py-1 text-sm btn-outline-indigo">Mark all as read</button>
                )}
              </div>
            </div>
            {unreadCount > 0 ? (
              <ul className="divide-y divide-gray-200">
                {notifications.map((n) => (
                  <li key={n.id} className="py-3 flex items-start justify-between">
                    <div className="pr-4">
                      <div className="text-sm font-medium text-gray-900">{n.title}</div>
                      <div className="text-sm text-gray-600">{n.message}</div>
                    </div>
                    <Link to={`/issues/${n.issue_id}`} className="text-sm text-indigo-700 hover:underline">View</Link>
                  </li>
                ))}
              </ul>
            ) : (
              resolvedUnread.length === 0 ? (
                <div className="text-sm text-gray-600">No new notifications.</div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {resolvedUnread.map((i) => (
                    <li key={i.id} className="py-3 flex items-start justify-between">
                      <div className="pr-4">
                        <div className="text-sm font-medium text-gray-900">Issue resolved: {i.title}</div>
                        <div className="text-sm text-gray-600">Status: {i.status.replace('_',' ')}</div>
                      </div>
                      <Link to={`/issues/${i.id}`} className="text-sm text-indigo-700 hover:underline">View</Link>
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>
        )}

        {/* List */}
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">My Issues</h2>
            <div className="ml-4 flex-1 max-w-sm">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title" className="w-full px-3 py-2 border rounded" />
            </div>
          </div>

          {loading ? (
            <div className="p-6 text-gray-600">Loading...</div>
          ) : error ? (
            <div className="p-6 text-red-600">{error}</div>
          ) : issues.length === 0 ? (
            <div className="p-6 text-gray-600">No issues reported yet.</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {(issues.filter(i => (i.title || '').toLowerCase().includes(search.toLowerCase()))).map((issue) => (
                <div key={issue.id} onClick={() => { if (!editing[issue.id]) startEdit(issue); }} className="cursor-pointer group p-6 transition-all duration-200 border-l-4 border-transparent hover:bg-white/70 hover:border-indigo-500">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <div className="text-sm font-medium text-gray-900">{issue.title}</div>
                      {editing[issue.id] ? (
                        <>
                          <label className="block text-xs font-medium mt-2">Title</label>
                          <input className="mt-1 w-full p-2 border rounded" value={editing[issue.id].title} onChange={(e) => setEditing(prev => ({ ...prev, [issue.id]: { ...prev[issue.id], title: e.target.value } }))} />
                          <label className="block text-xs font-medium mt-2">Description</label>
                          <textarea className="mt-1 w-full p-2 border rounded" rows={3} value={editing[issue.id].description} onChange={(e) => setEditing(prev => ({ ...prev, [issue.id]: { ...prev[issue.id], description: e.target.value } }))} />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                            <div>
                              <label className="block text-xs font-medium">Add Photos</label>
                              <input type="file" multiple accept="image/png, image/jpeg, image/jpg, image/gif" className="mt-1 w-full" onChange={(e) => setEditing(prev => ({ ...prev, [issue.id]: { ...prev[issue.id], newFiles: Array.from(e.target.files || []) } }))} />
                            </div>
                            <div>
                              <label className="block text-xs font-medium">Priority</label>
                              <select className="mt-1 px-2 py-1 border rounded w-full" value={editing[issue.id].priority} onChange={(e) => setEditing(prev => ({ ...prev, [issue.id]: { ...prev[issue.id], priority: e.target.value as Issue['priority'] } }))}>
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="urgent">Urgent</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium">Category</label>
                              <select className="mt-1 px-2 py-1 border rounded w-full" value={editing[issue.id].categoryId || ''} onChange={(e) => setEditing(prev => ({ ...prev, [issue.id]: { ...prev[issue.id], categoryId: e.target.value } }))}>
                                <option value="">Select category</option>
                                {categories.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                              </select>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                            <div>
                              <label className="block text-xs font-medium">Address (optional)</label>
                              <input className="mt-1 w-full p-2 border rounded" value={editing[issue.id].address || ''} onChange={(e) => setEditing(prev => ({ ...prev, [issue.id]: { ...prev[issue.id], address: e.target.value } }))} />
                            </div>
                            <div>
                              <label className="block text-xs font-medium">Location</label>
                              <div className="mt-1">
                                {React.createElement(require('../components/MapPicker').default, { lat: editing[issue.id].latitude ?? null, lng: editing[issue.id].longitude ?? null, onChange: (lat: number, lng: number) => setEditing(prev => ({ ...prev, [issue.id]: { ...prev[issue.id], latitude: lat, longitude: lng } })), height: 180, zoom: 14 })}
                              </div>
                              <button type="button" onClick={() => setMyLocationFor(issue.id)} className="mt-1 text-xs text-blue-600 hover:text-blue-700">Use my location</button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-gray-600 mt-1">{issue.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-sm">
                        <span className="px-2 py-1 bg-gray-100 rounded">Status: {issue.status.replace('_', ' ')}</span>
                        <span className="px-2 py-1 bg-gray-100 rounded inline-flex items-center gap-1">👍 {issueVotes[issue.id] ?? 0}</span>
                        {!editing[issue.id] && (
                          <span className="px-2 py-1 bg-gray-100 rounded inline-flex items-center gap-1">
                            <Zap className="w-4 h-4" /> Priority: {issue.priority}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {editing[issue.id] ? (
                        <>
                          <button onClick={() => saveEdit(issue.id)} className="inline-flex items-center px-3 py-2 btn-gradient">
                            <Save className="w-4 h-4 mr-1" /> Save
                          </button>
                          <button onClick={() => cancelEdit(issue.id)} className="inline-flex items-center px-3 py-2 border rounded hover:bg-gray-100 transition-colors">
                            <X className="w-4 h-4 mr-1" /> Cancel
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CitizenDashboardPage;
