import React from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';

export interface MapPickerProps {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  height?: number | string;
  zoom?: number;
}

const ClickHandler: React.FC<{ onChange: (lat: number, lng: number) => void } & { position: [number, number] | null }> = ({ onChange }) => {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const MapPicker: React.FC<MapPickerProps> = ({ lat, lng, onChange, height = 280, zoom = 13 }) => {
  const center: [number, number] = [lat ?? 20.5937, lng ?? 78.9629]; // Default center (India) when empty

  // Pan map to new location when lat/lng changes
  const MapAutoPan: React.FC = () => {
    const map = useMapEvents({});
    React.useEffect(() => {
      if (lat != null && lng != null) {
        map.setView([lat, lng], map.getZoom(), { animate: true });
      }
    }, [lat, lng]);
    return null;
  };

  return (
    <div style={{ height, borderRadius: 12, overflow: 'hidden' }}>
      <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={process.env.REACT_APP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
        />
        {lat != null && lng != null && <Marker position={[lat, lng]} />}
        <MapAutoPan />
        <ClickHandler onChange={onChange} position={lat != null && lng != null ? [lat, lng] : null} />
      </MapContainer>
    </div>
  );
};

export default MapPicker;
