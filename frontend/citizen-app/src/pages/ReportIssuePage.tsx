import React from 'react';
import { MapPin, Send, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CameraCapture from '../components/CameraCapture';

const API_BASE = 'http://localhost:5000';

const ReportIssuePage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [captureMeta, setCaptureMeta] = React.useState<{ lat: number | null; lng: number | null; timestamp: number } | null>(null);
  const [categories, setCategories] = React.useState<any[]>([]);
  const [form, setForm] = React.useState({ title: '', description: '', categoryId: '', address: '' });
  const [coords, setCoords] = React.useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [customCategory, setCustomCategory] = React.useState('');

  React.useEffect(() => {
    fetch(`${API_BASE}/api/categories`).then(r => r.json()).then(json => {
      if (json?.success) setCategories(json.data);
    }).catch(() => {});
  }, []);

  const user = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  }, []);

  const computePriorityFromCategory = (name: string): 'low' | 'medium' | 'high' | 'urgent' => {
    const n = (name || '').toLowerCase();
    const matchAny = (arr: string[]) => arr.some(k => n.includes(k));
    if (matchAny(['water', 'power line', 'powerline', 'power', 'electric', 'safety', 'hazard'])) return 'urgent';
    if (matchAny(['storm drain', 'sewer', 'pothole', 'manhole', 'garbage', 'trash', 'street light', 'street lighting'])) return 'high';
    if (matchAny(['illegal dumping', 'dumping', 'road sign', 'traffic signal', 'noise', 'building violation'])) return 'medium';
    if (matchAny(['sports facility', 'recycling', 'park', 'playground', 'parking'])) return 'low';
    // default to medium if not matched
    return 'medium';
  };

  // Photo is captured via camera; no file upload input anymore
  const onPhotoCaptured = (file: File, meta: { lat: number | null; lng: number | null; timestamp: number }) => {
    setSelectedFile(file);
    setCaptureMeta(meta);
    // If we have capture coordinates, override form coordinates to enforce on-spot capture
    if (meta.lat != null && meta.lng != null) setCoords({ lat: meta.lat, lng: meta.lng });
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setError(null);
      },
      () => setError('Unable to retrieve your location. Please allow location access.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }
  if (!form.title || form.title.trim().length < 5) { setError('Title must be at least 5 characters.'); return; }
  if (!form.description || form.description.trim().length < 10) { setError('Description must be at least 10 characters.'); return; }
  if (!selectedFile) { setError('A live geotagged photo is required. Please capture a photo.'); return; }
  if (coords.lat == null || coords.lng == null) { setError('Location is required and will be set from the captured photo. Please capture a photo with location enabled.'); return; }
  // Address is optional, do not require it

    // Determine category (must be an existing category)
    let chosenCategoryId = form.categoryId;
    let chosenCategoryName = '';
    if (!chosenCategoryId) { setError('Please select a category.'); return; }
    if (chosenCategoryId === 'other') {
      if (!customCategory.trim()) { setError('Please specify the issue category.'); return; }
      chosenCategoryName = customCategory.trim();
      chosenCategoryId = 'other';
    } else {
      const found = categories.find((c: any) => String(c.id) === String(chosenCategoryId));
      if (!found) { setError('Selected category is invalid. Please choose an existing category.'); return; }
      chosenCategoryName = found.name || '';
    }

    // Compute priority from category name (typed or existing)
    const computedPriority = computePriorityFromCategory(chosenCategoryName);

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('description', form.description);
      fd.append('categoryId', chosenCategoryId);
      fd.append('priority', computedPriority);
      fd.append('address', form.address);
      fd.append('latitude', String(coords.lat));
      fd.append('longitude', String(coords.lng));
      if (selectedFile) fd.append('files', selectedFile);
      // Include capture coordinates for server-side logging (non-breaking if ignored)
      if (captureMeta?.lat != null && captureMeta?.lng != null) {
  // Optionally log capture coordinates for debugging, but do not send to backend
  // fd.append('capture_timestamp', String(captureMeta.timestamp));
      }

      const res = await fetch(`${API_BASE}/api/issues`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to submit issue');
      setSuccess('Issue reported successfully! Redirecting...');
      setTimeout(() => navigate('/citizen/dashboard', { state: { justReported: true } }), 800);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen app-auth-bg py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="card p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Report a Civic Issue</h1>
            <p className="text-lg text-gray-600">Help improve your community by reporting issues that need attention.</p>
          </div>

          {success && (
            <div className="mb-4 p-3 border border-green-200 bg-green-50 text-green-700 rounded flex items-center gap-2">
              <CheckCircle className="w-5 h-5" /> {success}
            </div>
          )}
          {error && (
            <div className="mb-4 p-3 border border-red-200 bg-red-50 text-red-700 rounded">{error}</div>
          )}

          <form className="space-y-6" onSubmit={submit}>
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Issue Category</label>
              <select className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
                <option value="">Select a category</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                <option value="other">Other</option>
              </select>
              {form.categoryId === 'other' && (
                <input
                  type="text"
                  className="mt-2 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Please specify the issue category"
                  value={customCategory}
                  onChange={e => setCustomCategory(e.target.value)}
                  required
                />
              )}
              <p className="text-xs text-gray-500 mt-2">Priority will be assigned automatically based on the category.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Issue Title</label>
              <input type="text" placeholder="Brief description of the issue" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Detailed Description</label>
              <textarea rows={4} placeholder="Provide more details about the issue..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Live Geo‑tagged Photo (required)</label>
              <div className="rounded-lg p-4 border border-indigo-200 bg-white/70">
                <CameraCapture onCapture={onPhotoCaptured} label="Capture photo now" />
                <p className="mt-2 text-xs text-gray-600">Enable camera and location when prompted. Your current location will be attached and used as the report location.</p>
                {selectedFile && captureMeta?.lat != null && captureMeta?.lng != null && (
                  <p className="mt-1 text-xs text-gray-600">Captured at: {captureMeta.lat.toFixed(5)}, {captureMeta.lng.toFixed(5)}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input type="text" placeholder="Address or landmark (optional)" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <button type="button" onClick={useMyLocation} disabled={!!selectedFile} className={`mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium ${selectedFile ? 'opacity-50 cursor-not-allowed' : ''}`}>Use my current location</button>
              {coords.lat && coords.lng && (
                <div className="text-xs text-gray-600 mt-1">Lat: {coords.lat.toFixed(5)}, Lng: {coords.lng.toFixed(5)}</div>
              )}
              <div className="mt-3 opacity-100">
                {React.createElement(require('../components/MapPicker').default, { lat: coords.lat, lng: coords.lng, onChange: (lat: number, lng: number) => !selectedFile && setCoords({ lat, lng }), height: 280 })}
                {selectedFile && <p className="mt-1 text-xs text-gray-600">Location locked to capture location. Retake photo to update.</p>}
              </div>
            </div>

            {/* Priority removed: set automatically based on category */}

            <div className="pt-6">
              <button type="submit" disabled={submitting} className={`w-full flex items-center justify-center px-6 py-3 font-semibold btn-gradient ${submitting ? 'opacity-80 cursor-not-allowed' : ''}`}>
                <Send className="w-5 h-5 mr-2" />
                {submitting ? 'Submitting...' : 'Submit Issue Report'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ReportIssuePage;
