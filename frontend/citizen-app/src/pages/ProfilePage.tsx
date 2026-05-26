import React, { useEffect, useState } from 'react';

const API_BASE = 'http://localhost:5000';

const ProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [workLat, setWorkLat] = useState<number | null>(null);
  const [workLng, setWorkLng] = useState<number | null>(null);
  const [homeLat, setHomeLat] = useState<number | null>(null);
  const [homeLng, setHomeLng] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) { setError('Not logged in'); setLoading(false); return; }
        const res = await fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load profile');
        setProfile(data.data);
        const p = data.data || {};
        const lat = p.workLatitude ?? p.work_latitude ?? p.latitude ?? null;
        const lng = p.workLongitude ?? p.work_longitude ?? p.longitude ?? null;
        setWorkLat(lat);
        setWorkLng(lng);
        const hlat = p.homeLatitude ?? p.home_latitude ?? null;
        const hlng = p.homeLongitude ?? p.home_longitude ?? null;
        setHomeLat(hlat);
        setHomeLng(hlng);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const useMyLocation = () => {
    if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      setWorkLat(pos.coords.latitude);
      setWorkLng(pos.coords.longitude);
    }, () => alert('Unable to fetch location'));
  };

  const useMyHomeLocation = () => {
    if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      setHomeLat(pos.coords.latitude);
      setHomeLng(pos.coords.longitude);
    }, () => alert('Unable to fetch location'));
  };

  const save = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          firstName: profile.firstName,
          lastName: profile.lastName,
          phone: profile.phone,
          ...(profile.role === 'admin' ? { latitude: workLat, longitude: workLng } : {}),
          homeLatitude: homeLat,
          homeLongitude: homeLng
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to save');
      try { localStorage.setItem('user', JSON.stringify(data.data)); } catch {}
      alert('Profile updated');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>;

  return (
    <div className="min-h-screen app-auth-bg py-8">
      <div className="max-w-2xl mx-auto card p-6">
        <h1 className="text-2xl font-bold mb-4">Profile</h1>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium">First Name</label>
            <input className="mt-1 p-2 border rounded w-full" value={profile.firstName || ''} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium">Last Name</label>
            <input className="mt-1 p-2 border rounded w-full" value={profile.lastName || ''} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium">Email</label>
            <input className="mt-1 p-2 border rounded w-full bg-gray-100" value={profile.email} disabled />
          </div>
          <div>
            <label className="block text-sm font-medium">Phone</label>
            <input className="mt-1 p-2 border rounded w-full" value={profile.phone || ''} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium">Role</label>
            <input className="mt-1 p-2 border rounded w-full bg-gray-100" value={profile.role} disabled />
          </div>

          {/* Home Location for all users */}
          <div className="mt-2">
            <label className="block text-sm font-medium mb-1">Home Location</label>
            <div className="mb-2">
              {React.createElement(require('../components/MapPicker').default, { lat: homeLat, lng: homeLng, onChange: (lat: number, lng: number) => { setHomeLat(lat); setHomeLng(lng); }, height: 220 })}
            </div>
            <div className="text-xs text-gray-600">Click on the map to set your home location, or <button type="button" onClick={useMyHomeLocation} className="text-blue-600 hover:text-blue-700">use my current location</button>.</div>
            {homeLat != null && homeLng != null && (
              <div className="text-xs text-gray-600 mt-1">Lat: {typeof homeLat === 'number' ? homeLat.toFixed(5) : homeLat}, Lng: {typeof homeLng === 'number' ? homeLng.toFixed(5) : homeLng}</div>
            )}
          </div>

          {profile.role === 'admin' && (
            <div className="mt-2">
              <label className="block text-sm font-medium mb-1">Work Area Location</label>
              <div className="mb-2">
                {React.createElement(require('../components/MapPicker').default, { lat: workLat, lng: workLng, onChange: (lat: number, lng: number) => { setWorkLat(lat); setWorkLng(lng); }, height: 220 })}
              </div>
              <div className="text-xs text-gray-600">Click on the map to set the work area center, or <button type="button" onClick={useMyLocation} className="text-blue-600 hover:text-blue-700">use my current location</button>.</div>
              {workLat != null && workLng != null && (
                <div className="text-xs text-gray-600 mt-1">
                  Lat: {typeof workLat === 'number' ? workLat.toFixed(5) : workLat}, Lng: {typeof workLng === 'number' ? workLng.toFixed(5) : workLng}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="mt-6">
          <button onClick={save} disabled={saving} className={`px-4 py-2 text-white rounded ${saving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
