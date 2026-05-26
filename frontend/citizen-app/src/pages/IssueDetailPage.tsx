import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const API_BASE = 'http://localhost:5000';

const IssueDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [issue, setIssue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ title?: string; description?: string; priority?: string; address?: string; latitude?: number; longitude?: number; categoryId?: string; newFiles?: File[] }>({});
  const [categories, setCategories] = useState<any[]>([]);

  const token = localStorage.getItem('token');
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  }, []);

  const isOwner = user && issue && user.id === issue.reporter_id;
  const isAdmin = user && user.role === 'admin';

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/issues/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load issue');
        setIssue(data.data);
        const cats = await fetch(`${API_BASE}/api/categories`).then(r => r.json());
        if (cats?.success) setCategories(cats.data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, token]);

  const save = async () => {
    try {
      if (!token) throw new Error('Not authenticated');
      const payload: any = {};
      if (editing.title !== undefined) payload.title = editing.title;
      if (editing.description !== undefined) payload.description = editing.description;
      if (editing.priority) payload.priority = editing.priority;
      if (editing.categoryId) payload.categoryId = editing.categoryId;
      if (editing.address !== undefined) payload.address = editing.address;
      if (editing.latitude !== undefined) payload.latitude = editing.latitude;
      if (editing.longitude !== undefined) payload.longitude = editing.longitude;
      const res = await fetch(`${API_BASE}/api/issues/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to save');

      // Upload new photos if any
      if (editing.newFiles && editing.newFiles.length > 0) {
        const fd = new FormData();
        editing.newFiles.forEach(f => fd.append('files', f));
        const up = await fetch(`${API_BASE}/api/issues/${id}/attachments`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
        const upData = await up.json();
        if (!up.ok) throw new Error(upData?.error || 'Failed to upload photos');
        setIssue(upData.data);
      } else {
        setIssue(data.data);
      }

      setEditing({});
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>;
  if (!issue) return null;

  return (
    <div className="min-h-screen app-auth-bg py-8">
      <div className="max-w-3xl mx-auto card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            {isOwner ? (
              <input className="text-2xl font-bold mb-2 w-full border rounded p-2" value={editing.title ?? issue.title} onChange={(e) => setEditing(prev => ({ ...prev, title: e.target.value }))} />
            ) : (
              <h1 className="text-2xl font-bold mb-2">{issue.title}</h1>
            )}
            <p className="text-sm text-gray-600 mb-4">Category: {issue.category_name} | Department: {issue.department_name} | Status: {issue.status} | Priority: {issue.priority}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <div><span className="font-medium">Address:</span> {issue.address || '—'}</div>
            <div className="mt-2">
              {React.createElement(require('../components/MapView').default, { lat: issue.latitude, lng: issue.longitude, height: 220, label: issue.title })}
            </div>
            <div className="mt-2"><span className="font-medium">Created:</span> {issue.created_at ? new Date(issue.created_at).toLocaleString() : '—'}</div>
            <div><span className="font-medium">Resolved:</span> {issue.resolved_at ? new Date(issue.resolved_at).toLocaleString() : '—'}</div>
          </div>
          <div>
            <div><span className="font-medium">Reporter:</span> {issue.reporter_first_name ? `${issue.reporter_first_name} ${issue.reporter_last_name}` : '—'}</div>
            <div><span className="font-medium">Assigned To:</span> {issue.assigned_first_name ? `${issue.assigned_first_name} ${issue.assigned_last_name}` : '—'}</div>
            {(() => {
              const isOwnerView = !!(user && issue && user.id === issue.reporter_id);
              if (!isOwnerView) return null;
              if (!issue.assigned_first_name && !issue.assigned_email && !issue.assigned_phone && !issue.department_contact_email) return null;
              if (issue.assigned_first_name || issue.assigned_email || issue.assigned_phone) {
                return (
                  <div className="mt-2 p-2 rounded border border-indigo-200 bg-white/70">
                    <div className="text-sm font-medium text-gray-900">Assigned Admin Contact</div>
                    <div className="text-sm text-gray-700">
                      {issue.assigned_first_name ? `${issue.assigned_first_name} ${issue.assigned_last_name || ''}` : ''}
                      {issue.assigned_email ? (<div>Email: <a className="text-indigo-700 hover:underline" href={`mailto:${issue.assigned_email}`}>{issue.assigned_email}</a></div>) : null}
                      {issue.assigned_phone ? (<div>Phone: <a className="text-indigo-700 hover:underline" href={`tel:${issue.assigned_phone}`}>{issue.assigned_phone}</a></div>) : null}
                    </div>
                  </div>
                );
              }
              // Fallback to department contact if no individual assigned yet
              if (issue.department_contact_email) {
                return (
                  <div className="mt-2 p-2 rounded border border-indigo-200 bg-white/70">
                    <div className="text-sm font-medium text-gray-900">Department Contact</div>
                    <div className="text-sm text-gray-700">
                      <div>Email: <a className="text-indigo-700 hover:underline" href={`mailto:${issue.department_contact_email}`}>{issue.department_contact_email}</a></div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>

        {isOwner ? (
          <>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea className="w-full p-2 border rounded mb-2" rows={4} value={editing.description ?? issue.description} onChange={(e) => setEditing(prev => ({ ...prev, description: e.target.value }))} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Priority</label>
                <select className="w-full p-2 border rounded mb-2" value={editing.priority ?? issue.priority} onChange={(e) => setEditing(prev => ({ ...prev, priority: e.target.value }))}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select className="w-full p-2 border rounded mb-2" value={editing.categoryId ?? issue.category_id} onChange={(e) => setEditing(prev => ({ ...prev, categoryId: e.target.value }))}>
                  <option value="">Select category</option>
                  {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Address (optional)</label>
                <input className="w-full p-2 border rounded" value={editing.address ?? issue.address ?? ''} onChange={(e) => setEditing(prev => ({ ...prev, address: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Location</label>
                <div className="mt-1">
                  {React.createElement(require('../components/MapPicker').default, { lat: editing.latitude ?? issue.latitude ?? null, lng: editing.longitude ?? issue.longitude ?? null, onChange: (lat: number, lng: number) => setEditing(prev => ({ ...prev, latitude: lat, longitude: lng })), height: 220 })}
                </div>
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium mb-1">Add Photos</label>
              <input type="file" multiple accept="image/png, image/jpeg, image/jpg, image/gif" onChange={(e) => setEditing(prev => ({ ...prev, newFiles: Array.from(e.target.files || []) }))} />
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
              <button onClick={() => setEditing({})} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold mb-1">Description</h2>
            <p className="mb-4">{issue.description}</p>
          </>
        )}

        {issue.attachments && issue.attachments.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">Photos</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {issue.attachments.map((a: any) => (
                <img key={a.id} src={a.file_path.replace('\\', '/').replace(/\\/g, '/')} alt={a.file_name} className="w-full h-40 object-cover rounded border" />
              ))}
            </div>
          </div>
        )}

        <div className="mt-6">
          <button onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-200 rounded">Back</button>
        </div>
      </div>
    </div>
  );
};

export default IssueDetailPage;
