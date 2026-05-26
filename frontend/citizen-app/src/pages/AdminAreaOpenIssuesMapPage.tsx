import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, Circle } from 'react-leaflet';

const API_BASE = 'http://localhost:5000';

const AdminAreaOpenIssuesMapPage: React.FC = () => {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [admin, setAdmin] = useState<any>(null);

  useEffect(() => {
    try { setAdmin(JSON.parse(localStorage.getItem('user') || 'null')); } catch {}
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem('token') || undefined;
        const params = new URLSearchParams({ limit: '500', sortBy: 'created_at', sortOrder: 'DESC' });
        if (admin?.workLatitude != null && admin?.workLongitude != null) {
          params.set('center', `${admin.workLatitude},${admin.workLongitude}`);
          params.set('radius_m', '5000');
        }
        const res = await fetch(`${API_BASE}/api/issues?${params.toString()}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load');
        const all = data?.data?.issues || [];
        const open = all.filter((i: any) => !(i.status === 'resolved' || i.status === 'closed'));
        setIssues(open);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [admin?.workLatitude, admin?.workLongitude]);

  const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const adminLat = admin?.workLatitude ?? admin?.work_latitude ?? admin?.latitude ?? null;
  const adminLng = admin?.workLongitude ?? admin?.work_longitude ?? admin?.longitude ?? null;

  const inArea = useMemo(() => {
    if (adminLat == null || adminLng == null) return [] as any[];
    return issues.filter((i) => i.latitude != null && i.longitude != null && haversine(adminLat, adminLng, i.latitude, i.longitude) <= 5000);
  }, [issues, adminLat, adminLng]);

  const center = useMemo<[number, number]>(() => {
    if (adminLat != null && adminLng != null) return [adminLat, adminLng];
    if (inArea.length > 0) return [inArea[0].latitude, inArea[0].longitude];
    return [20.5937, 78.9629];
  }, [adminLat, adminLng, inArea]);

  return (
    <div className="min-h-screen app-auth-bg py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">My Area — Open Issues Map</h1>
        </div>
        {error && <div className="mb-3 text-red-600">{error}</div>}
        {(adminLat == null || adminLng == null) && (
          <div className="mb-3 p-3 border border-yellow-200 bg-yellow-50 text-yellow-800 rounded">No work area set on your profile. Set your work area to see the map filtered to your 5km radius.</div>
        )}
        {loading ? (
          <div className="card p-6">Loading map...</div>
        ) : (
          <div className="rounded-xl overflow-hidden border border-white/70 bg-white/70">
            <MapContainer center={center} zoom={12} style={{ height: 600, width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url={process.env.REACT_APP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
              />
              {(adminLat != null && adminLng != null) && (
                <Circle center={[adminLat as any, adminLng as any]} radius={5000} pathOptions={{ color: '#2563eb', fillColor: '#60a5fa', fillOpacity: 0.12 }} />
              )}
              {inArea.map((i) => (
                <Marker key={i.id} position={[i.latitude, i.longitude]}>
                  <Popup>
                    <div className="text-sm">
                      <div className="font-semibold">{i.title}</div>
                      <div className="text-gray-600">{i.category_name || 'Category'}</div>
                      <a className="text-indigo-700 underline" href={`/issues/${i.id}`}>View</a>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAreaOpenIssuesMapPage;
