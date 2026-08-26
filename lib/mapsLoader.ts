let loadPromise: Promise<typeof google.maps> | null = null;

/**
 * Injects the Maps JavaScript API once per page. The browser key is public by
 * necessity — restrict it to HTTP referrers + Maps JavaScript API in Google
 * Cloud Console. Everything billable beyond map tiles goes through /api.
 */
export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Google Maps ne peut être chargé que côté navigateur.'));
      return;
    }
    if (window.google?.maps) {
      resolve(window.google.maps);
      return;
    }

    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
    if (!key) {
      reject(new Error('NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY est absente.'));
      return;
    }

    const callbackName = '__solarSizerMapsReady';
    (window as unknown as Record<string, unknown>)[callbackName] = () => {
      resolve(window.google.maps);
    };

    const script = document.createElement('script');
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${key}` +
      `&callback=${callbackName}&language=fr&region=FR&loading=async`;
    script.async = true;
    script.onerror = () => reject(new Error('Chargement de Google Maps impossible.'));
    document.head.appendChild(script);
  });

  return loadPromise;
}
