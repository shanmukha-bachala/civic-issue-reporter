import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

export interface MapViewProps {
  lat: number;
  lng: number;
  height?: number | string;
  zoom?: number;
  label?: string;
}

const MapView: React.FC<MapViewProps> = ({ lat, lng, height = 280, zoom = 15, label }) => {
  if (lat == null || lng == null) return null;
  return (
    <div style={{ height, borderRadius: 12, overflow: 'hidden' }}>
      <MapContainer center={[lat, lng]} zoom={zoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={process.env.REACT_APP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
        />
        <Marker position={[lat, lng]}>{label && <Popup>{label}</Popup>}</Marker>
      </MapContainer>
    </div>
  );
};

export default MapView;
