/** Muted roadmap styling for the landing view; satellite takes over in the editor. */
export const ROADMAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#e8f0f8' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c8ddf0' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#d8e4ee' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#c4d4e4' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

export const FRANCE_CENTER = { lat: 46.7, lng: 2.3 };
export const FRANCE_ZOOM = 6;
export const ROOF_ZOOM = 19;
