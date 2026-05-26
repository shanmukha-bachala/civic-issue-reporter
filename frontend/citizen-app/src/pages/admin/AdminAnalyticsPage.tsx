import React, { useEffect, useMemo, useState } from 'react';

const API_BASE = 'http://localhost:5000';

// Vertical bar component
const VerticalBar: React.FC<{ label: string; value: number; max: number; color?: string }> = ({ label, value, max, color = '#4f46e5' }) => {
  const pct = Math.max(0, Math.min(100, max > 0 ? Math.round((value / max) * 100) : 0));
  return (
    <div className="flex flex-col items-center mx-1 min-w-[36px]">
      <div className="w-6 sm:w-7 bg-gray-100 rounded-sm h-32 relative overflow-hidden">
        <div className="absolute bottom-0 w-full rounded-sm" style={{ height: `${pct}%`, background: color }} />
      </div>
      <div className="mt-1 text-[10px] leading-tight text-center text-gray-700 truncate max-w-[48px]">{label}</div>
      <div className="text-[10px] text-gray-500">{value}</div>
    </div>
  );
};

// Simple line chart with two series (created vs resolved)
const LineChart: React.FC<{ data: { date: string; created: number; resolved: number }[] }>
= ({ data }) => {
  const width = 600;
  const height = 160;
  const pad = 28;
  const xCount = Math.max(1, data.length);
  const maxY = Math.max(1, ...data.map(d => Math.max(d.created, d.resolved)));
  const xStep = (width - pad * 2) / Math.max(1, xCount - 1);
  const scaleY = (v: number) => height - pad - (maxY > 0 ? (v / maxY) * (height - pad * 2) : 0);
  const pointsCreated = data.map((d, i) => `${pad + i * xStep},${scaleY(d.created)}`).join(' ');
  const pointsResolved = data.map((d, i) => `${pad + i * xStep},${scaleY(d.resolved)}`).join(' ');
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
      <polyline fill="none" stroke="#2563eb" strokeWidth="2" points={pointsCreated} />
      <polyline fill="none" stroke="#10b981" strokeWidth="2" points={pointsResolved} />
      {/* axes */}
      <line x1={pad} y1={height-pad} x2={width-pad} y2={height-pad} stroke="#e5e7eb" />
      <line x1={pad} y1={pad} x2={pad} y2={height-pad} stroke="#e5e7eb" />
    </svg>
  );
};

const AdminAnalyticsPage: React.FC = () => {
  const [dash, setDash] = useState<any | null>(null);
  const [issues5k, setIssues5k] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const user = useMemo(() => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; } }, []);
  const token = localStorage.getItem('token') || '';

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        // Dashboard analytics for 30 days
        const r = await fetch(`${API_BASE}/api/analytics/dashboard?timeframe=30`, { headers: { Authorization: `Bearer ${token}` } });
        const j = await r.json();
        if (j?.success) setDash(j.data);
      } catch (e: any) { setError(e.message || 'Failed to load analytics'); }
    };
    const loadIssues5k = async () => {
      try {
        const lat = user?.workLatitude ?? user?.work_latitude; const lng = user?.workLongitude ?? user?.work_longitude;
        if (lat == null || lng == null) { setIssues5k([]); return; }
        const params = new URLSearchParams({ center: `${lat},${lng}`, radius_m: '5000', limit: '500' });
        const r = await fetch(`${API_BASE}/api/issues?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
        const j = await r.json();
        setIssues5k(j?.data?.issues || []);
      } catch { setIssues5k([]); }
    };
    if (token) load();
    loadIssues5k();
  }, [token, user]);

  // Weekly compare (last 7 vs previous 7) using dailyTrends
  const weeklyCompare = useMemo(() => {
    const arr = dash?.dailyTrends || [];
    const last14 = arr.slice(-14);
    const prev = last14.slice(0, 7); const curr = last14.slice(7);
    const sum = (xs: any[], key: string) => xs.reduce((a, b) => a + (b?.[key] || 0), 0);
    return {
      prevSolved: sum(prev, 'resolved'), currSolved: sum(curr, 'resolved'),
      prevUnsolved: Math.max(sum(prev, 'created') - sum(prev, 'resolved'), 0),
      currUnsolved: Math.max(sum(curr, 'created') - sum(curr, 'resolved'), 0)
    };
  }, [dash]);

  // Category bar in 5km area
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const i of issues5k) {
      const name = i.category_name || 'General';
      map[name] = (map[name] || 0) + 1;
    }
    const entries = Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0, 12);
    const max = Math.max(1, ...entries.map(([,v]) => v as number));
    return { entries, max };
  }, [issues5k]);

  return (
    <div className="min-h-screen app-auth-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Analytics</h1>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 1. Weekly solved vs unsolved compare */}
          <div className="card p-4">
            <h2 className="text-lg font-semibold mb-2">Solved vs Unsolved (Week over Week)</h2>
            {!dash ? (
              <div className="text-sm text-gray-600">Loading…</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Previous 7 days</div>
                  <div className="flex items-end gap-3">
                    <VerticalBar label="Solved" value={weeklyCompare.prevSolved} max={Math.max(1, weeklyCompare.prevSolved, weeklyCompare.currSolved, weeklyCompare.prevUnsolved, weeklyCompare.currUnsolved)} color="#10b981" />
                    <VerticalBar label="Unsolved" value={weeklyCompare.prevUnsolved} max={Math.max(1, weeklyCompare.prevSolved, weeklyCompare.currSolved, weeklyCompare.prevUnsolved, weeklyCompare.currUnsolved)} color="#ef4444" />
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Current 7 days</div>
                  <div className="flex items-end gap-3">
                    <VerticalBar label="Solved" value={weeklyCompare.currSolved} max={Math.max(1, weeklyCompare.prevSolved, weeklyCompare.currSolved, weeklyCompare.prevUnsolved, weeklyCompare.currUnsolved)} color="#10b981" />
                    <VerticalBar label="Unsolved" value={weeklyCompare.currUnsolved} max={Math.max(1, weeklyCompare.prevSolved, weeklyCompare.currSolved, weeklyCompare.prevUnsolved, weeklyCompare.currUnsolved)} color="#ef4444" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. Bar chart categories in 5km area */}
          <div className="card p-4">
            <h2 className="text-lg font-semibold mb-2">Categories in your 5km area</h2>
            {categoryCounts.entries.length === 0 ? (
              <div className="text-sm text-gray-600">No issues in your 5km area.</div>
            ) : (
              <div className="flex items-end gap-3 overflow-x-auto py-1">
                {categoryCounts.entries.map(([name, count]) => (
                  <VerticalBar key={String(name)} label={String(name)} value={Number(count)} max={categoryCounts.max} />
                ))}
              </div>
            )}
          </div>

          {/* 3. Line chart trends */}
          <div className="card p-4 lg:col-span-2">
            <h2 className="text-lg font-semibold mb-2">Overall Issue Trends (30 days)</h2>
            {!dash ? (
              <div className="text-sm text-gray-600">Loading…</div>
            ) : (
              <LineChart data={(dash.dailyTrends || []).map((d: any) => ({ date: d.date, created: d.created, resolved: d.resolved }))} />
            )}
            <div className="mt-2 text-xs text-gray-500">Blue: Created, Green: Resolved</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalyticsPage;
