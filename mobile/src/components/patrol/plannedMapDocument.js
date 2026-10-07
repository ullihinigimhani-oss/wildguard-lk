// Leaflet runs inside an isolated map document, not directly in React Native.
// Only validated presentation data enters this document. No session or ORS secret.
export function buildPlannedMapDocument(points, segments) {
  const mapPoints = points.map(
    ({
      type,
      order,
      latitude,
      longitude,
      label,
      note,
      typeLabel,
      symbol,
      color,
    }) => ({
      type,
      order,
      latitude,
      longitude,
      label,
      note,
      typeLabel,
      symbol,
      color,
    }),
  );
  const data = JSON.stringify({
    points: mapPoints,
    segments: segments.map((segment) =>
      segment.map((point) => [point.latitude, point.longitude]),
    ),
  })
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https://unpkg.com; style-src 'unsafe-inline' https://unpkg.com; img-src https://tile.openstreetmap.org data:; connect-src 'none'; base-uri 'none'; form-action 'none'" />
  <title>Planned Patrol Route</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="anonymous" />
  <style>
  html,body,#map{height:100%;width:100%;margin:0;background:#edf3ed;font-family:system-ui,sans-serif}
  .point-marker{display:flex;align-items:center;justify-content:center;width:32px;height:32px;border:2px solid white;box-shadow:0 2px 6px #0006;color:white;font-size:16px;font-weight:700;border-radius:50%;box-sizing:border-box}
  .point-start{border-radius:7px}.point-end{border-radius:4px;border-style:double}.point-high_risk{border-radius:4px}.point-observation{border-radius:12px 3px}
  #fit{position:absolute;z-index:600;right:10px;top:10px;background:white;border:1px solid #bed0c3;border-radius:8px;padding:11px 14px;color:#245b44;font:600 13px system-ui;box-shadow:0 2px 5px #0002}
  #fit:focus-visible{outline:3px solid #245b44}#status{position:absolute;z-index:600;bottom:28px;left:10px;right:10px;padding:9px;background:white;border-radius:6px;font-size:12px;color:#435e4b}
  .leaflet-popup-content{font-size:13px;line-height:1.5;overflow-wrap:anywhere}.popup-risk{color:#b42332;font-weight:700}.popup-label{font-weight:600}.popup-note{white-space:pre-wrap;margin-top:6px}
  </style></head><body><div id="map" aria-label="Saved planned patrol route map"></div><button id="fit" type="button">Fit Route</button><div id="status" role="status">Loading map…</div>
  <script>
  function notify(type,extra){var message=Object.assign({type:type},extra||{});if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(JSON.stringify(message));}else if(window.parent!==window){window.parent.postMessage(message,'*');}}
  function mapFailure(){document.getElementById('status').textContent='Unable to load the map. Check your connection and retry.';notify('map-error');}
  </script>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin="anonymous" onerror="mapFailure()"></script>
  <script>
  (function(){try{
    if(typeof L==='undefined'){mapFailure();return;}
    var data=${data};
    if(!data.points.length){document.getElementById('status').textContent='No planned route points are available.';notify('map-error');return;}
    var map=L.map('map',{zoomControl:true,scrollWheelZoom:false});
    var plannedLayer=L.layerGroup().addTo(map);
    // Future current location and actual GPS layers must remain separate.
    var tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}).addTo(map);
    var failedTiles=false;
    tiles.on('loading',function(){failedTiles=false;});
    tiles.on('tileerror',function(){failedTiles=true;document.getElementById('status').hidden=false;document.getElementById('status').textContent='Map tiles are unavailable. Saved route points remain visible.';notify('tile-error');});
    tiles.on('load',function(){if(!failedTiles){document.getElementById('status').hidden=true;notify('tiles-ready');}});
    data.segments.forEach(function(segment){if(segment.length>1)L.polyline(segment,{color:'#245b44',weight:4,dashArray:'8 6'}).addTo(plannedLayer);});
    data.points.forEach(function(point){
      var iconNode=document.createElement('span');iconNode.className='point-marker point-'+point.type.toLowerCase();iconNode.style.backgroundColor=point.color;iconNode.textContent=point.symbol;
      var marker=L.marker([point.latitude,point.longitude],{icon:L.divIcon({html:iconNode,className:'planned-marker',iconSize:[32,32],iconAnchor:[16,16]}),title:(point.order+1)+'. '+point.typeLabel+': '+point.label,keyboard:true}).addTo(plannedLayer);
      var popup=document.createElement('div'),kind=document.createElement('div'),label=document.createElement('div');kind.textContent=point.typeLabel;kind.className=point.type==='HIGH_RISK'?'popup-risk':'';label.textContent=point.label;label.className='popup-label';popup.appendChild(kind);popup.appendChild(label);
      if(point.note){var note=document.createElement('div');note.textContent=point.note;note.className='popup-note';popup.appendChild(note);}
      marker.bindPopup(popup);marker.on('click',function(){notify('point-selected',{order:point.order});});
    });
    function fit(){map.invalidateSize();var positions=data.points.map(function(p){return[p.latitude,p.longitude];});if(positions.length===1){map.setView(positions[0],15);}else{map.fitBounds(L.latLngBounds(positions),{padding:[38,38],maxZoom:16});}}
    document.getElementById('fit').onclick=fit;fit();
    window.addEventListener('resize',function(){map.invalidateSize();});
    notify('map-ready');
  }catch(e){mapFailure();}})();
  </script></body></html>`;
}
