import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ThumbsUp } from 'lucide-react';

const API_BASE = 'http://localhost:5000';

const CitizenLocalConcernsPage: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [issues, setIssues] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [votes, setVotes] = useState<Record<string, { count: number; hasUpvoted: boolean }>>({});

  useEffect(() => {
    try { setUser(JSON.parse(localStorage.getItem('user') || 'null')); } catch {}
  }, []);

  const center = useMemo(() => {
    const lat = user?.homeLatitude ?? user?.home_latitude ?? null;
    const lng = user?.homeLongitude ?? user?.home_longitude ?? null;
    return (lat != null && lng != null) ? { lat, lng } : null;
  }, [user]);

  useEffect(() => {
    const load = async () => {
      if (!user) { setLoading(false); return; }
      if (!center) { setLoading(false); return; }
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: '200', sortBy: 'created_at', sortOrder: 'DESC', center: `${center.lat},${center.lng}`, radius_m: '5000' });
        const token = localStorage.getItem('token') || undefined;
        const res = await fetch(`${API_BASE}/api/issues?${params.toString()}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load issues');
        const open = (data?.data?.issues || []).filter((i: any) => !(i.status === 'resolved' || i.status === 'closed'));
        setIssues(open);
        // Fetch upvote counts
        const counts: Record<string, { count: number; hasUpvoted: boolean }> = {};
        await Promise.all(open.map(async (i: any) => {
          const r = await fetch(`${API_BASE}/api/issues/${i.id}/upvotes`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
          const j = await r.json();
          if (j?.success) counts[i.id] = j.data; else counts[i.id] = { count: 0, hasUpvoted: false };
        }));
        setVotes(counts);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, center]);

  const upvote = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/issues/${id}/upvote`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to upvote');
      setVotes((prev) => ({ ...prev, [id]: { count: data.data.count, hasUpvoted: true } }));
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (!user) return <div className="min-h-screen app-auth-bg flex items-center justify-center">Login required</div>;
  if (!center) return (
    <div className="min-h-screen app-auth-bg py-8">
      <div className="max-w-3xl mx-auto card p-6">
        <h1 className="text-2xl font-bold mb-2">Local Concerns</h1>
        <div className="p-3 border border-yellow-200 bg-yellow-50 text-yellow-800 rounded">Please set your Home Location in your Profile to see issues within 5 km of you.</div>
        <div className="mt-3"><Link to="/profile" className="text-indigo-700 hover:underline">Go to Profile</Link></div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen app-auth-bg py-8">
      <div className="max-w-5xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Local Concerns (within 5 km)</h1>
        {error && <div className="mb-3 p-3 border border-red-200 bg-red-50 text-red-700 rounded">{error}</div>}
        {loading ? (
          <div className="card p-6">Loading...</div>
        ) : issues.length === 0 ? (
          <div className="card p-6">No open issues nearby.</div>
        ) : (
          <div className="card">
            <div className="divide-y divide-gray-200">
              {issues.map((i) => (
                <div key={i.id} className="p-4 flex items-start justify-between">
                  <div className="pr-4">
                    <Link to={`/issues/${i.id}`} className="text-sm font-medium text-gray-900 hover:underline">{i.title}</Link>
                    <div className="text-sm text-gray-600 mt-1 flex items-center gap-3">
                      <span className="inline-flex items-center gap-1"><MapPin className="w-4 h-4" /> {i.address || `${i.latitude?.toFixed?.(4)}, ${i.longitude?.toFixed?.(4)}`}</span>
                      <span className="px-2 py-0.5 rounded bg-gray-100">{i.status.replace('_',' ')}</span>
                      <span className="px-2 py-0.5 rounded bg-gray-100">Priority: {i.priority}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button disabled={votes[i.id]?.hasUpvoted} onClick={() => upvote(i.id)} className={`inline-flex items-center px-3 py-2 rounded ${votes[i.id]?.hasUpvoted ? 'bg-gray-200 cursor-not-allowed' : 'btn-outline-indigo'}`}>
                      <ThumbsUp className="w-4 h-4 mr-1" /> {votes[i.id]?.hasUpvoted ? 'Upvoted' : 'Upvote'}
                    </button>
                    <span className="text-sm text-gray-700">{votes[i.id]?.count || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CitizenLocalConcernsPage;
