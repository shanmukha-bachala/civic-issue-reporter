// Geo helper utilities

// Predefined zones (normalized to ensure min <= max)
const rawZones = [
  { lat_min: 16.2801, lat_max: 16.2734, lng_min: 80.3013, lng_max: 80.3030 },
  { lat_min: 16.2757, lat_max: 16.2726, lng_min: 80.2948, lng_max: 80.3004 },
  { lat_min: 16.2951, lat_max: 16.2929, lng_min: 80.3012, lng_max: 80.2939 },
  { lat_min: 16.2656, lat_max: 16.2635, lng_min: 80.3428, lng_max: 80.3518 },
  { lat_min: 16.3055, lat_max: 16.3043, lng_min: 80.3043, lng_max: 80.3049 }
];

const normalizeZone = (z) => ({
  lat_min: Math.min(z.lat_min, z.lat_max),
  lat_max: Math.max(z.lat_min, z.lat_max),
  lng_min: Math.min(z.lng_min, z.lng_max),
  lng_max: Math.max(z.lng_min, z.lng_max),
});

const zones = rawZones.map(normalizeZone);

// Check whether a point lies inside a rectangular zone
// lat_min <= lat <= lat_max && lng_min <= lng <= lng_max
function isPointInZone(lat, lng, zone) {
  return (
    lat >= zone.lat_min && lat <= zone.lat_max &&
    lng >= zone.lng_min && lng <= zone.lng_max
  );
}

function findZoneForPoint(lat, lng) {
  for (let i = 0; i < zones.length; i++) {
    if (isPointInZone(lat, lng, zones[i])) {
      return { index: i, zone: zones[i] };
    }
  }
  return null;
}

module.exports = { zones, isPointInZone, findZoneForPoint };