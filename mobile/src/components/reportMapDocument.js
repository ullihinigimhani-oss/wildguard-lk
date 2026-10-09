/**
 * Builds an isolated Leaflet HTML document to preview and adjust the incident location on a map.
 * Reuses the same OpenStreetMap + Leaflet pattern as PatrolMapSurface.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @param {boolean} [interactive=true] - If true, clicking on the map adjusts the pinned coordinate.
 * @returns {string} HTML string for WebView
 */
export function buildReportMapDocument(latitude, longitude, interactive = true) {
  const lat = typeof latitude === "number" ? latitude : 6.842;
  const lon = typeof longitude === "number" ? longitude : 81.3328;
  const hasPin = Boolean(latitude && longitude);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https://unpkg.com; style-src 'unsafe-inline' https://unpkg.com; img-src https://tile.openstreetmap.org data:; connect-src 'none'; base-uri 'none'; form-action 'none'" />
  <title>Incident Location</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="anonymous" />
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #edf3ed; font-family: system-ui, -apple-system, sans-serif; }
    .incident-marker {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background: #245b44;
      border: 2px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      color: #ffffff;
      font-size: 13px;
      font-weight: 700;
    }
    #badge {
      position: absolute;
      z-index: 600;
      top: 8px;
      left: 8px;
      background: rgba(255,255,255,0.92);
      border: 1px solid #bed0c3;
      border-radius: 6px;
      padding: 5px 9px;
      font-size: 11px;
      font-weight: 600;
      color: #245b44;
      box-shadow: 0 1px 4px rgba(0,0,0,0.1);
    }
    #hint {
      position: absolute;
      z-index: 600;
      bottom: 8px;
      left: 8px;
      right: 8px;
      background: rgba(255,255,255,0.92);
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 10px;
      text-align: center;
      color: #435e4b;
    }
  </style>
</head>
<body>
  <div id="map" aria-label="Incident location map preview"></div>
  <div id="badge">${hasPin ? lat.toFixed(4) + ", " + lon.toFixed(4) : "Tap map to set point"}</div>
  ${interactive ? '<div id="hint">Tap on map to adjust pinned location</div>' : ""}

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin="anonymous"></script>
  <script>
    (function() {
      try {
        if (typeof L === 'undefined') return;

        var initialLat = ${lat};
        var initialLon = ${lon};
        var hasInitialPin = ${hasPin};
        var interactive = ${interactive};

        var map = L.map('map', {
          zoomControl: false,
          attributionControl: false,
          scrollWheelZoom: false,
          dragging: true,
          tap: true
        }).setView([initialLat, initialLon], hasInitialPin ? 14 : 11);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        }).addTo(map);

        var marker = null;

        function setMarker(lat, lon, notify) {
          if (marker) {
            marker.setLatLng([lat, lon]);
          } else {
            var icon = L.divIcon({
              className: 'incident-marker-wrap',
              html: '<div class="incident-marker">&#10003;</div>',
              iconSize: [28, 28],
              iconAnchor: [14, 14]
            });
            marker = L.marker([lat, lon], { icon: icon }).addTo(map);
          }

          document.getElementById('badge').textContent = lat.toFixed(4) + ', ' + lon.toFixed(4);

          if (notify && window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'location-adjusted',
              latitude: Number(lat.toFixed(6)),
              longitude: Number(lon.toFixed(6))
            }));
          }
        }

        if (hasInitialPin) {
          setMarker(initialLat, initialLon, false);
        }

        if (interactive) {
          map.on('click', function(e) {
            setMarker(e.latlng.lat, e.latlng.lng, true);
          });
        }
      } catch (e) {
        /* Ignore map render errors in test/offline */
      }
    })();
  </script>
</body>
</html>`;
}
