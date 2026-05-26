import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';

const API_BASE = 'http://localhost:5000';

const SolvedIssuesMap: React.FC<{ height?: number }> = ({ height = 420 }) => {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/issues?limit=500&sortBy=created_at&sortOrder=DESC`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load');
        const all = data?.data?.issues || [];
        const solved = all.filter((i: any) => i.status === 'resolved' || i.status === 'closed');
        setIssues(solved);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const center = useMemo<[number, number]>(() => {
    const withCoords = issues.filter(i => i.latitude && i.longitude);
    if (withCoords.length > 0) return [withCoords[0].latitude, withCoords[0].longitude];
    return [20.5937, 78.9629];
  }, [issues]);

  if (loading) return <div className="card p-6">Loading map...</div>;
  if (error) return <div className="card p-6 text-red-600">{error}</div>;

  return (
    <div className="rounded-xl overflow-hidden border border-white/70 bg-white/70">
      <MapContainer center={center} zoom={12} style={{ height, width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={process.env.REACT_APP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
        />
        {issues.filter(i => i.latitude && i.longitude).map((i) => (
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
  );
};

export default SolvedIssuesMap;
