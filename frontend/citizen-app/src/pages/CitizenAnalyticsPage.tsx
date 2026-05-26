import React, { useEffect, useMemo, useState } from 'react';

const API_BASE = 'http://localhost:5000';

const VerticalBar: React.FC<{ label: string; value: number; max: number; color?: string }>
= ({ label, value, max, color = '#4f46e5' }) => {
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
      <line x1={pad} y1={height-pad} x2={width-pad} y2={height-pad} stroke="#e5e7eb" />
      <line x1={pad} y1={pad} x2={pad} y2={height-pad} stroke="#e5e7eb" />
    </svg>
  );
};

const CitizenAnalyticsPage: React.FC = () => {
  const [myIssues, setMyIssues] = useState<any[]>([]);
  const [allIssues, setAllIssues] = useState<any[]>([]);
  const [areaIssues, setAreaIssues] = useState<any[]>([]);
  const user = useMemo(() => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; } }, []);
  const token = localStorage.getItem('token') || '';

  useEffect(() => {
    const loadMine = async () => {
      try {
        if (!user?.id) return;
        const r = await fetch(`${API_BASE}/api/issues?reporter=${user.id}&limit=500&sortBy=created_at&sortOrder=DESC`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const j = await r.json();
        setMyIssues(j?.data?.issues || []);
      } catch { setMyIssues([]); }
    };
    const loadAll = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/issues?limit=500&sortBy=created_at&sortOrder=DESC`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const j = await r.json();
        setAllIssues(j?.data?.issues || []);
      } catch { setAllIssues([]); }
    };
    const loadArea = async () => {
      try {
        const hlat = user?.homeLatitude ?? user?.home_latitude; const hlng = user?.homeLongitude ?? user?.home_longitude;
        if (hlat == null || hlng == null) { setAreaIssues([]); return; }
        const params = new URLSearchParams({ center: `${hlat},${hlng}`, radius_m: '5000', limit: '500' });
        const r = await fetch(`${API_BASE}/api/issues?${params.toString()}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const j = await r.json();
        setAreaIssues(j?.data?.issues || []);
      } catch { setAreaIssues([]); }
    };
    loadMine();
    loadAll();
    loadArea();
  }, [token, user]);

  // 1) Graphical/statistical representation of issues in his locality
  const localityStats = useMemo(() => {
    const total = areaIssues.length;
    const solved = areaIssues.filter(i => i.status === 'resolved' || i.status === 'closed').length;
    const notSolved = total - solved;
    return { total, solved, notSolved };
  }, [areaIssues]);

  // 2) Bar chart based on categories of issues reported in his 5km area
  const areaCategories = useMemo(() => {
    const map: Record<string, number> = {};
    for (const i of areaIssues) { const c = i.category_name || 'General'; map[c] = (map[c] || 0) + 1; }
    const entries = Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0, 10);
    const max = Math.max(1, ...entries.map(([,v]) => v as number));
    return { entries, max };
  }, [areaIssues]);

  // 3) Bar chart of category of his issues and whether solved or unsolved
  const myCategorySolved = useMemo(() => {
    const map: Record<string, { solved: number; unsolved: number }> = {};
    for (const i of myIssues) {
      const c = i.category_name || 'General';
      const isSolved = i.status === 'resolved' || i.status === 'closed';
      if (!map[c]) map[c] = { solved: 0, unsolved: 0 };
      if (isSolved) map[c].solved += 1; else map[c].unsolved += 1;
    }
    const rows = Object.entries(map).map(([k,v]) => ({ category: k, ...v }));
    const max = Math.max(1, ...rows.map(r => Math.max(r.solved, r.unsolved)));
    return { rows, max };
  }, [myIssues]);

  // 4) Line chart of overall issue trends by day by week etc. (from all issues we fetched)
  const dailyTrends = useMemo(() => {
    // bucket by date string
    const map: Record<string, { created: number; resolved: number }> = {};
    for (const i of allIssues) {
      const d = (i.created_at || '').slice(0,10);
      if (!map[d]) map[d] = { created: 0, resolved: 0 };
      map[d].created += 1;
      if (i.status === 'resolved' || i.status === 'closed') map[d].resolved += 1;
    }
    return Object.entries(map).sort((a,b) => a[0].localeCompare(b[0])).map(([date,val]) => ({ date, ...val }));
  }, [allIssues]);

  return (
    <div className="min-h-screen app-auth-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Analytics</h1>

        {/* 1) Locality stats */}
        <div className="card p-4 mb-6">
          <h2 className="text-lg font-semibold mb-2">Your Locality (5km) Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3 rounded border bg-white/70">
              <div className="text-xs text-gray-500">Total Issues</div>
              <div className="text-xl font-semibold">{localityStats.total}</div>
            </div>
            <div className="p-3 rounded border bg-white/70">
              <div className="text-xs text-gray-500">Solved</div>
              <div className="text-xl font-semibold text-green-600">{localityStats.solved}</div>
            </div>
            <div className="p-3 rounded border bg-white/70">
              <div className="text-xs text-gray-500">Unsolved</div>
              <div className="text-xl font-semibold text-amber-600">{localityStats.notSolved}</div>
            </div>
          </div>
        </div>

        {/* 2) Area categories */}
        <div className="card p-4 mb-6">
          <h2 className="text-lg font-semibold mb-2">Categories in your 5km area</h2>
          {areaCategories.entries.length === 0 ? (
            <div className="text-sm text-gray-600">No issues around your home area yet.</div>
          ) : (
            <div className="flex items-end gap-3 overflow-x-auto py-1">
              {areaCategories.entries.map(([name, count]) => (
                <VerticalBar key={String(name)} label={String(name)} value={Number(count)} max={areaCategories.max} />
              ))}
            </div>
          )}
        </div>

        {/* 3) My issues category solved vs unsolved */}
        <div className="card p-4 mb-6">
          <h2 className="text-lg font-semibold mb-2">Your Issues by Category (Solved vs Unsolved)</h2>
          {myCategorySolved.rows.length === 0 ? (
            <div className="text-sm text-gray-600">No issues reported by you yet.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {myCategorySolved.rows.map(row => (
                <div key={row.category}>
                  <div className="text-sm font-medium text-gray-800 mb-2">{row.category}</div>
                  <div className="flex items-end gap-3">
                    <VerticalBar label="Solved" value={row.solved} max={myCategorySolved.max} color="#10b981" />
                    <VerticalBar label="Unsolved" value={row.unsolved} max={myCategorySolved.max} color="#ef4444" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4) Overall trends */}
        <div className="card p-4">
          <h2 className="text-lg font-semibold mb-2">Overall Trends</h2>
          <LineChart data={dailyTrends} />
          <div className="mt-2 text-xs text-gray-500">Blue: Created, Green: Resolved</div>
        </div>
      </div>
    </div>
  );
};

export default CitizenAnalyticsPage;
