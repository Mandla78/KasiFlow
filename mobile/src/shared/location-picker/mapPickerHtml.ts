/**
 * The ONE place that knows a map library exists. The map screens just
 * hand this HTML to a WebView (native) or an iframe (web).
 *
 * THE PIN NEVER MOVES: it's a CSS element fixed to the centre, drawn over
 * the map. The map pans underneath (Uber's pickup-pin pattern). On
 * `moveend` the page posts map.getCenter() back. That coordinate is the
 * user's own map interaction, never a geocoding result, which keeps us
 * inside Mapbox's rules about storing search results.
 *
 * With a Mapbox token: Mapbox GL JS (version as verified in TruConnect).
 * Without one (development): MapLibre GL + OpenStreetMap raster tiles,
 * with attribution, so the pin can still be tested. Production sets the
 * token.
 *
 * Rotation and tilt are off: a trader dropping a pin needs "pan to the
 * right spot", not 3D controls.
 */
import { brand } from '@/shared/theme/tokens';

export function buildMapPickerHtml(token: string, latitude: number, longitude: number, zoom: number): string {
  const mapbox = token.length > 0;
  const lib = mapbox
    ? `<script src="https://api.mapbox.com/mapbox-gl-js/v3.18.1/mapbox-gl.js"></script>
<link href="https://api.mapbox.com/mapbox-gl-js/v3.18.1/mapbox-gl.css" rel="stylesheet" />`
    : `<script src="https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<link href="https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />`;

  const create = mapbox
    ? `mapboxgl.accessToken = ${JSON.stringify(token)};
  const map = new mapboxgl.Map({ container: 'map', style: 'mapbox://styles/mapbox/streets-v12',
    center: [${longitude}, ${latitude}], zoom: ${zoom}, dragRotate: false, pitchWithRotate: false, touchPitch: false });`
    : `const map = new maplibregl.Map({ container: 'map',
    style: { version: 8, sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256, attribution: '&copy; OpenStreetMap contributors' } },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }] },
    center: [${longitude}, ${latitude}], zoom: ${zoom}, dragRotate: false, pitchWithRotate: false, touchPitch: false });`;

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
${lib}
<style>
  html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
  #pin { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -100%);
         width: 38px; height: 38px; pointer-events: none; z-index: 10; }
  #pin svg { width: 100%; height: 100%; filter: drop-shadow(0 2px 2px rgba(0,0,0,.35)); }
</style>
</head>
<body>
<div id="map"></div>
<div id="pin">
  <svg viewBox="0 0 24 24"><path d="M12 22s8-6 8-12a8 8 0 1 0-16 0c0 6 8 12 8 12z" fill="${brand.navy}"/>
  <circle cx="12" cy="10" r="3.2" fill="${brand.amber}"/></svg>
</div>
<script>
  ${create}
  map.touchZoomRotate.disableRotation();
  function post(msg) {
    const text = JSON.stringify(msg);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(text);
    else if (window.parent) window.parent.postMessage(text, '*');
  }
  function postCenter() { const c = map.getCenter(); post({ type: 'center', latitude: c.lat, longitude: c.lng }); }
  map.on('load', postCenter);
  map.on('moveend', postCenter);
  map.on('error', function () { post({ type: 'error' }); });
</script>
</body>
</html>`;
}
