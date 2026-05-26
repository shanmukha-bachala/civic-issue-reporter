import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Eye, CheckCircle, AlertTriangle, Zap } from 'lucide-react';
import { MapContainer, Marker, Popup, TileLayer, Circle } from 'react-leaflet';

const API_BASE = 'http://localhost:5000';

const fetchAllIssues = async (token?: string, center?: { lat: number, lng: number }, radiusM: number = 5000) => {
  const params = new URLSearchParams({ limit: '200', sortBy: 'created_at', sortOrder: 'DESC' });
  if (center) { params.set('center', `${center.lat},${center.lng}`); params.set('radius_m', String(radiusM)); }
  const res = await fetch(`${API_BASE}/api/issues?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to load issues');
  return (data?.data?.issues || []).map((i: any) => ({
    id: i.id,
    title: i.title,
    category: i.category_name || 'General',
    status: i.status,
    priority: i.priority,
    latitude: i.latitude ?? null,
    longitude: i.longitude ?? null,
    location: i.address || `${i.latitude?.toFixed?.(4)}, ${i.longitude?.toFixed?.(4)}`,
    time: new Date(i.created_at || Date.now()).toLocaleString(),
    icon: '📌',
    citizen: `${i.reporter_first_name || ''} ${i.reporter_last_name || ''}`.trim() || 'Unknown',
    assigned_id: i.assigned_user_id || i.assigned_id || null,
    assigned_first_name: i.assigned_first_name || null,
    assigned_last_name: i.assigned_last_name || null,
    resolved_by_id: i.resolved_by_id || null,
  }));
};

const AdminDashboardPage: React.FC = () => {
  const [issues, setIssues] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<'low' | 'medium' | 'high' | 'urgent' | null>(null);
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [filterMode, setFilterMode] = useState<'urgency' | 'category' | null>(null);
  const [filterValue, setFilterValue] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const adminUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token') || undefined;
    const lat = adminUser?.workLatitude ?? adminUser?.work_latitude ?? adminUser?.latitude ?? null;
    const lng = adminUser?.workLongitude ?? adminUser?.work_longitude ?? adminUser?.longitude ?? null;
    const center = (lat != null && lng != null) ? { lat, lng } : undefined;
    fetchAllIssues(token, center, 5000).then(setIssues).catch((e) => setError(e.message));
    // Load analytics for admin/staff
    if (token) {
      fetch(`${API_BASE}/api/analytics/dashboard?timeframe=30`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(j => { if (j?.success) setAnalytics(j.data); }).catch(() => {});
    }
  }, [adminUser]);

  const getStatusBadge = (status: string) => {
    const badges = {
      submitted: 'bg-yellow-100 text-yellow-800',
      acknowledged: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-purple-100 text-purple-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800'
    };
    return badges[status as keyof typeof badges] || badges.submitted;
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: 'text-gray-500',
      medium: 'text-yellow-500',
      high: 'text-orange-500',
      urgent: 'text-red-500'
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  const solvedCount = issues.filter((i) => i.status === 'resolved' || i.status === 'closed').length;
  const notSolvedCount = issues.length - solvedCount;
  const prio = {
    urgent: issues.filter((i) => i.priority === 'urgent').length,
    high: issues.filter((i) => i.priority === 'high').length,
    medium: issues.filter((i) => i.priority === 'medium').length,
    low: issues.filter((i) => i.priority === 'low').length,
  };

  // Distance helper (meters)
  const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Admin work center from profile/user object
  const adminLat = adminUser?.workLatitude ?? adminUser?.work_latitude ?? adminUser?.latitude ?? null;
  const adminLng = adminUser?.workLongitude ?? adminUser?.work_longitude ?? adminUser?.longitude ?? null;

  // Filter issues within 5km of admin center
  const issuesInArea = useMemo(() => {
    if (adminLat == null || adminLng == null) return issues;
    return issues.filter((i) => (i.latitude != null && i.longitude != null) && haversine(adminLat, adminLng, i.latitude, i.longitude) <= 5000);
  }, [issues, adminLat, adminLng]);

  const openInArea = useMemo(() => issuesInArea.filter((i: any) => !(i.status === 'resolved' || i.status === 'closed') && i.latitude != null && i.longitude != null), [issuesInArea]);
  const mapCenter = useMemo<[number, number]>(() => {
    if (adminLat != null && adminLng != null) return [adminLat as any, adminLng as any];
    if (openInArea.length > 0) return [openInArea[0].latitude as any, openInArea[0].longitude as any];
    return [20.5937, 78.9629];
  }, [adminLat, adminLng, openInArea]);

  // Issues used for category UI (respect urgency filter)
  const issuesForCategory = useMemo(() => {
    let base = issuesInArea;
    if (selectedPriority) base = base.filter((i) => i.priority === selectedPriority);
    return base;
  }, [issuesInArea, selectedPriority]);

  // Category counts for classification UI
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of issuesForCategory) {
      const cat = i.category || 'General';
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [issuesForCategory]);

  const priorityOrderNum: Record<string, number> = { low: 1, medium: 2, high: 3, urgent: 4 };

  // Compute per-category urgency (max priority seen in current filtered set)
  const categoryUrgency = useMemo(() => {
    const map: Record<string, { urgency: 'low'|'medium'|'high'|'urgent'; count: number }> = {};
    for (const i of issuesForCategory) {
      const cat = i.category || 'General';
      const p = (i.priority || 'medium') as 'low'|'medium'|'high'|'urgent';
      if (!map[cat]) map[cat] = { urgency: p, count: 0 };
      map[cat].count += 1;
      if (priorityOrderNum[p] > priorityOrderNum[map[cat].urgency]) map[cat].urgency = p;
    }
    return Object.entries(map).sort((a,b) => priorityOrderNum[b[1].urgency]-priorityOrderNum[a[1].urgency] || b[1].count-a[1].count);
  }, [issuesForCategory]);

  // Visible issues based on selected urgency + category filters
  const visibleIssues = useMemo(() => {
    let base = issuesInArea;
    // merged filter logic
    if (filterMode === 'urgency' && filterValue) base = base.filter((i) => i.priority === filterValue);
    if (filterMode === 'category' && filterValue) base = base.filter((i) => (i.category || 'General') === filterValue);
    if (search) {
      const q = search.toLowerCase();
      const matches: any[] = [];
      const others: any[] = [];
      for (const it of base) {
        if ((it.title || '').toLowerCase().includes(q)) matches.push(it); else others.push(it);
      }
      base = matches.concat(others);
    }
    return base;
  }, [issuesInArea, filterMode, filterValue, search]);

  // Pride score: points for issues resolved by this admin
  const resolvedByAdmin = useMemo(() => {
    const name = `${adminUser?.firstName || ''} ${adminUser?.lastName || ''}`.trim().toLowerCase();
    return issues.filter((i) => {
      const isResolved = i.status === 'resolved' || i.status === 'closed';
      if (!isResolved) return false;
      const assignedName = `${i.assigned_first_name || ''} ${i.assigned_last_name || ''}`.trim().toLowerCase();
      const idMatch = adminUser?.id && (String(i.assigned_id || '') === String(adminUser.id) || String(i.resolved_by_id || '') === String(adminUser.id));
      const nameMatch = name && assignedName && (assignedName === name);
      return Boolean(idMatch || nameMatch);
    });
  }, [issues, adminUser]);

  const prideScore = useMemo(() => {
    const weights: Record<string, number> = { low: 1, medium: 2, high: 3, urgent: 5 };
    return resolvedByAdmin.reduce((sum: number, i: any) => sum + (weights[i.priority] || 1), 0);
  }, [resolvedByAdmin]);

  const milestones = [25, 50, 100, 200];
  const nextMilestone = milestones.find((m) => m > prideScore) || 200;
  const progressPct = Math.max(0, Math.min(100, Math.round((prideScore / nextMilestone) * 100)));

  const [resolution, setResolution] = useState<{ open: boolean; issue?: any; note: string; file: File | null; capLat: number | null; capLng: number | null; submitting: boolean; error: string | null }>({ open: false, issue: undefined, note: '', file: null, capLat: null, capLng: null, submitting: false, error: null });

  const toggleResolved = async (issue: any) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');
      const isResolved = (issue.status === 'resolved' || issue.status === 'closed');
      if (!isResolved) {
        // Going to resolved: ask for image and note first
        setResolution({ open: true, issue, note: '', file: null, capLat: null, capLng: null, submitting: false, error: null });
        return;
      }
      // Unresolve back to in_progress
      const res = await fetch(`${API_BASE}/api/issues/${issue.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'in_progress' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Update failed');
      setIssues((prev) => prev.map((i) => i.id === issue.id ? { ...i, status: 'in_progress' } : i));
    } catch (e: any) {
      alert(e.message);
    }
  };

  const submitResolution = async () => {
    if (!resolution.issue) return;
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');
      setResolution(prev => ({ ...prev, submitting: true, error: null }));

      // Enforce mandatory live geotagged capture
      if (!resolution.file || resolution.capLat == null || resolution.capLng == null) {
        setResolution(prev => ({ ...prev, submitting: false, error: 'A live on‑site photo with location is required.' }));
        return;
      }

      // Frontend on-site check (within 150 meters of issue location)
      const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371000;
        const toRad = (d: number) => (d * Math.PI) / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };
      const i = resolution.issue;
      if (i?.latitude != null && i?.longitude != null) {
        const dist = haversine(Number(i.latitude), Number(i.longitude), Number(resolution.capLat), Number(resolution.capLng));
        if (dist > 150) {
          setResolution(prev => ({ ...prev, submitting: false, error: `Capture must be on-site (within 150m). Current distance: ${Math.round(dist)}m.` }));
          return;
        }
      }

      // 1) Update status to resolved, include note if backend supports it
      const res = await fetch(`${API_BASE}/api/issues/${resolution.issue.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'resolved' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to mark resolved');

      let updatedIssue: any = { ...resolution.issue, status: 'resolved' };

      // 2) Attach note by appending into description as a fallback (if API doesn't store resolutionNote)
      if (resolution.note) {
        try {
          const baseDesc = resolution.issue.description || '';
          const locationNote = (resolution.capLat != null && resolution.capLng != null) ? ` (on-site at ${Number(resolution.capLat).toFixed(5)}, ${Number(resolution.capLng).toFixed(5)})` : '';
          const mergedDesc = baseDesc ? `${baseDesc}\n\nResolution: ${resolution.note}${locationNote}` : `Resolution: ${resolution.note}${locationNote}`;
          const res2 = await fetch(`${API_BASE}/api/issues/${resolution.issue.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ description: mergedDesc })
          });
          const data2 = await res2.json();
          if (res2.ok) updatedIssue = data2.data;
        } catch {}
      }

      // 3) Upload resolution image if provided
      if (resolution.file) {
        const fd = new FormData();
        fd.append('files', resolution.file);
        if (resolution.capLat != null && resolution.capLng != null) {
          // Do not send capture_latitude/longitude to backend
        }
        const up = await fetch(`${API_BASE}/api/issues/${resolution.issue.id}/attachments`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd
        });
        const upData = await up.json();
        if (up.ok) updatedIssue = upData.data;
      }

      setIssues(prev => prev.map(i => i.id === resolution.issue!.id ? updatedIssue : i));
      setResolution({ open: false, issue: undefined, note: '', file: null, capLat: null, capLng: null, submitting: false, error: null });
    } catch (e: any) {
      setResolution(prev => ({ ...prev, submitting: false, error: e.message || 'Failed to submit resolution' }));
    }
  };

  const cleanDuplicates = () => {
    // Remove duplicates by title and category (case-insensitive)
    const seen = new Set();
    const unique = issues.filter((issue) => {
      const key = (issue.title.trim().toLowerCase() + '|' + (issue.category || '').trim().toLowerCase());
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    setIssues(unique);
  };

  return (
    <div className="min-h-screen app-auth-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold mb-8 text-gray-900">Welcome, {(() => {
          const user = JSON.parse(localStorage.getItem('user') || '{}');
          return user?.firstName ? String(user.firstName).toUpperCase() : 'Admin';
        })()}</h1>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="card card-hover p-4">
            <p className="text-sm text-gray-600">Total Issues</p>
            <p className="text-2xl font-bold">{issues.length}</p>
          </div>
          <div className="card card-hover p-4">
            <p className="text-sm text-gray-600">Solved</p>
            <p className="text-2xl font-bold text-green-600">{solvedCount}</p>
          </div>
          <div className="card card-hover p-4">
            <p className="text-sm text-gray-600">Not Solved</p>
            <p className="text-2xl font-bold text-yellow-600">{notSolvedCount}</p>
          </div>
          <div className="card card-hover p-4">
            <p className="text-sm text-gray-600">Priority (U/H/M/L)</p>
            <p className="text-xl font-bold">
              {prio.urgent}/{prio.high}/{prio.medium}/{prio.low}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-red-600">{error}</div>
        )}

        {(adminLat == null || adminLng == null) && (
          <div className="mb-4 p-3 border border-yellow-200 bg-yellow-50 text-yellow-800 rounded">No work area set. Set your work area during signup or update your profile so you see issues within 5km of your area.</div>
        )}



        {/* Category Urgency */}
        <div className="card p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-900">Category Urgency</h2>
          </div>
          {categoryUrgency.length === 0 ? (
            <div className="text-sm text-gray-600">No issues in your area.</div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {categoryUrgency.map(([cat, info]) => (
                <li key={cat} className="py-2 flex items-center justify-between">
                  <div className="text-sm text-gray-900">{cat}</div>
                  <div className="inline-flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${info.urgency === 'urgent' ? 'bg-red-100 text-red-700' : info.urgency === 'high' ? 'bg-orange-100 text-orange-700' : info.urgency === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>{info.urgency.toUpperCase()}</span>
                    <span className="text-xs text-gray-600">{info.count}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pride Score */}
        <div className="card p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-900">Service Score</h2>
            <div className="text-sm text-gray-600">{prideScore} pts</div>
          </div>
          <div className="h-3 w-full bg-indigo-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="mt-2 text-xs text-gray-600">Resolved by you: {resolvedByAdmin.length} • Next milestone: {nextMilestone} pts</div>
        </div>

        {/* Admin Map: open issues within 5km */}
        <div className="card p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-900">My Area — Open Issues Map</h2>
          </div>
          <div className="rounded-xl overflow-hidden border border-white/70">
            <MapContainer center={mapCenter} zoom={12} style={{ height: 360, width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url={process.env.REACT_APP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
              />
              {(adminLat != null && adminLng != null) && (
                <Circle center={[adminLat as any, adminLng as any]} radius={5000} pathOptions={{ color: '#2563eb', fillColor: '#60a5fa', fillOpacity: 0.12 }} />
              )}
              {openInArea.map((i: any) => (
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


        <div className="card">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">All Reported Issues</h2>
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-600">{visibleIssues.length}</div>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title" className="px-3 py-1.5 border rounded" />
              <button onClick={cleanDuplicates} className="ml-2 px-3 py-1 text-xs rounded btn-gradient-blue text-white">Cleaner</button>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {visibleIssues.map((issue) => (
              <div key={issue.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="text-2xl">{issue.icon}</div>
                    <div>
                      <Link to={`/issues/${issue.id}`} className="text-sm font-medium text-gray-900 hover:underline">{issue.title}</Link>
                      <p className="text-sm text-gray-500 mt-1">{issue.category}</p>
                      <div className="flex items-center space-x-4 mt-2">
                        <div className="flex items-center text-sm text-gray-500">
                          <MapPin className="w-4 h-4 mr-1" />
                          {issue.location}
                        </div>
                        <span className="text-sm text-gray-500">{issue.time}</span>
                        <span className="text-sm text-gray-500">Reported by: {issue.citizen}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(issue.status)}`}>
                      {issue.status.replace('_', ' ')}
                    </span>
                    <Zap className={`w-4 h-4 ${getPriorityColor(issue.priority)}`} />
                    <Link to={`/issues/${issue.id}`} className="ml-2 px-3 py-1 text-xs rounded btn-outline-indigo">View</Link>
                    <button
                      onClick={() => toggleResolved(issue)}
                      className="ml-2 px-3 py-1 text-xs rounded btn-gradient-blue text-white"
                    >
                      {(issue.status === 'resolved' || issue.status === 'closed') ? 'Mark Unresolved' : 'Mark Resolved'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Resolution modal */}
        {resolution.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30" onClick={() => !resolution.submitting && setResolution({ open: false, issue: undefined, note: '', file: null, capLat: null, capLng: null, submitting: false, error: null })} />
            <div className="relative z-10 w-full max-w-md card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Submit Resolution Details</h3>
              <p className="text-sm text-gray-600 mb-4">Capture a live, on‑site photo (required) and add a brief summary.</p>
              {resolution.error && (
                <div className="mb-3 p-2 border border-red-200 bg-red-50 text-red-700 rounded text-sm">{resolution.error}</div>
              )}
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Resolution summary</label>
                <textarea className="w-full p-2 border rounded" rows={4} value={resolution.note} onChange={(e) => setResolution(prev => ({ ...prev, note: e.target.value }))} placeholder="What was done to resolve the issue?" />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Live Geo‑tagged Photo (required)</label>
                {React.createElement(require('../../components/CameraCapture').default, { onCapture: (file: File, meta: any) => setResolution(prev => ({ ...prev, file, capLat: meta.lat, capLng: meta.lng })) , label: 'Capture on‑site photo' })}
                {resolution.capLat != null && resolution.capLng != null && (
                  <p className="mt-1 text-xs text-gray-600">Captured at: {Number(resolution.capLat).toFixed(5)}, {Number(resolution.capLng).toFixed(5)}</p>
                )}
              </div>
              <div className="flex items-center justify-end gap-2">
                <button disabled={resolution.submitting} onClick={() => setResolution({ open: false, issue: undefined, note: '', file: null, capLat: null, capLng: null, submitting: false, error: null })} className="px-4 py-2 border rounded hover:bg-gray-100">Cancel</button>
                <button disabled={resolution.submitting} onClick={submitResolution} className={`px-4 py-2 btn-gradient ${resolution.submitting ? 'opacity-80 cursor-not-allowed' : ''}`}>{resolution.submitting ? 'Submitting...' : 'Submit & Mark Resolved'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboardPage;
