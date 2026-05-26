import React, { useEffect, useRef, useState } from 'react';

interface CaptureMeta {
  lat: number | null;
  lng: number | null;
  timestamp: number;
}

interface Props {
  onCapture: (file: File, meta: CaptureMeta) => void;
  label?: string;
}

const CameraCapture: React.FC<Props> = ({ onCapture, label = 'Capture live photo' }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    };
  }, [stream, capturedUrl]);

  const startCamera = async () => {
    setError(null);
    setBusy(true);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      setStream(media);
      if (videoRef.current) {
        videoRef.current.srcObject = media;
        await videoRef.current.play();
      }
    } catch (e: any) {
      setError(e.message || 'Unable to access camera');
    } finally {
      setBusy(false);
    }
  };

  const capture = async () => {
    if (!videoRef.current) return;
    try {
      setBusy(true);
      // 1) Snapshot from video
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      const w = video.videoWidth;
      const h = video.videoHeight;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');
      ctx.drawImage(video, 0, 0, w, h);

      // 2) Ask for current geolocation
      const coords = await new Promise<{ lat: number | null; lng: number | null }>((resolve) => {
        if (!navigator.geolocation) return resolve({ lat: null, lng: null });
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve({ lat: null, lng: null }),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });

      // 3) Convert to blob/file
      const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => b ? res(b) : rej(new Error('Failed to capture image')), 'image/jpeg', 0.92));
      const ts = Date.now();
      const file = new File([blob], `capture-${ts}.jpg`, { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      setCapturedUrl((old) => { if (old) URL.revokeObjectURL(old); return url; });

      // Stop camera stream after capture to save resources
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        setStream(null);
      }

      onCapture(file, { lat: coords.lat, lng: coords.lng, timestamp: ts });
    } catch (e: any) {
      setError(e.message || 'Failed to capture photo');
    } finally {
      setBusy(false);
    }
  };

  const retake = () => {
    setCapturedUrl(null);
    startCamera();
  };

  return (
    <div>
      {error && <div className="mb-2 p-2 border border-red-200 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
      {!capturedUrl ? (
        <div className="space-y-2">
          <div className="aspect-video w-full bg-black/10 rounded overflow-hidden flex items-center justify-center">
            <video ref={videoRef} className="w-full h-full object-contain" playsInline muted />
          </div>
          <div className="flex gap-2">
            {!stream ? (
              <button type="button" onClick={startCamera} disabled={busy} className={`px-4 py-2 btn-outline-indigo ${busy ? 'opacity-80 cursor-not-allowed' : ''}`}>Enable Camera</button>
            ) : (
              <button type="button" onClick={capture} disabled={busy} className={`px-4 py-2 btn-gradient ${busy ? 'opacity-80 cursor-not-allowed' : ''}`}>{label}</button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <img src={capturedUrl} alt="Captured" className="w-full rounded border" />
          <div className="flex gap-2">
            <button type="button" onClick={retake} className="px-4 py-2 border rounded hover:bg-gray-100">Retake</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraCapture;
