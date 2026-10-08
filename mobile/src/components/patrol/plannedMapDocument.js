// Leaflet runs inside an isolated map document, not directly in React Native.
// Only validated presentation data enters this document. No session or ORS secret.
export function buildPlannedMapDocument(points, segments, live = false) {
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
    map.createPane('riskAreas');map.getPane('riskAreas').style.zIndex=350;
    var riskLayer=L.layerGroup().addTo(map),fullRouteLayer=L.layerGroup().addTo(map),currentLayer=L.layerGroup().addTo(map),navigationLayer=L.layerGroup().addTo(map),actualLayer=L.layerGroup().addTo(map),currentPosition=null,riskSignature=null;
    var live=${Boolean(live)},initialNavigationFitted=false,activeRoutePositions=[],activeDestination=null,fullPositions=[],fullSignature=null;
    function valid(p){return p && Number.isFinite(p.latitude)&&Math.abs(p.latitude)<=90&&Number.isFinite(p.longitude)&&Math.abs(p.longitude)<=180;}
    function validLine(g){return g && g.type==='LineString' && Array.isArray(g.coordinates) && g.coordinates.length>1 && g.coordinates.every(function(p){return Array.isArray(p)&&valid({longitude:p[0],latitude:p[1]});});}
    window.updatePatrolNavigation=function(payload){
      if(!live || !payload || typeof payload!=='object')return;
      currentLayer.clearLayers();navigationLayer.clearLayers();actualLayer.clearLayers();currentPosition=null;
      var nextRiskSignature=JSON.stringify(payload.riskZones||[]);
      if(nextRiskSignature!==riskSignature){riskSignature=nextRiskSignature;riskLayer.clearLayers();
      if(Array.isArray(payload.riskZones))payload.riskZones.forEach(function(zone){
        var geometry=zone && zone.geometry,ring=geometry && geometry.coordinates && geometry.coordinates[0];
        if(!geometry||geometry.type!=='Polygon'||!Array.isArray(ring)||ring.length<4||ring.length>33||!ring.every(function(p){return Array.isArray(p)&&p.length===2&&valid({longitude:p[0],latitude:p[1]});})||ring[0][0]!==ring[ring.length-1][0]||ring[0][1]!==ring[ring.length-1][1])return;
        var popup=document.createElement('div');var title=document.createElement('div');title.className='popup-risk';title.textContent='Risk Zone';popup.appendChild(title);
        [zone.name,zone.riskLevel,zone.description].forEach(function(value){if(typeof value==='string'&&value){var field=document.createElement('div');field.textContent=value;field.className='popup-note';popup.appendChild(field);}});
        L.geoJSON(geometry,{pane:'riskAreas',style:{color:'#b42332',weight:2,fillColor:'#d83140',fillOpacity:0.22}}).bindPopup(popup).addTo(riskLayer);
      });}
      if(valid(payload.currentLocation)){
        currentPosition=[payload.currentLocation.latitude,payload.currentLocation.longitude];
        L.circleMarker(currentPosition,{radius:9,color:'white',weight:3,fillColor:'#1679dc',fillOpacity:1}).bindTooltip('Your location · Current Ranger GPS location').addTo(currentLayer);
        if(Number.isFinite(payload.currentLocation.accuracy))L.circle(currentPosition,{radius:Math.min(100,payload.currentLocation.accuracy),color:'#1679dc',weight:1,fillOpacity:0.08}).addTo(currentLayer);
      }
      var geometry=payload.geometry;
      activeRoutePositions=[];activeDestination=valid(payload.destination)?[payload.destination.latitude,payload.destination.longitude]:null;
      var nextFullSignature=JSON.stringify({route:payload.fullRoute||null,reached:payload.reachedWaypointIds||[]});
      if(nextFullSignature!==fullSignature){fullSignature=nextFullSignature;fullRouteLayer.clearLayers();fullPositions=[];
        var full=payload.fullRoute,reached=Array.isArray(payload.reachedWaypointIds)?payload.reachedWaypointIds:[];
        if(full && validLine(full.geometry) && Array.isArray(full.legs))full.legs.forEach(function(leg){
          if(!validLine(leg.geometry))return;
          var positions=leg.geometry.coordinates.map(function(p){return[p[1],p[0]];}),done=reached.indexOf(leg.destinationWaypointId)!==-1;
          L.polyline(positions,{color:'#27804b',weight:4,opacity:done?0.3:0.8}).bindTooltip('Planned Patrol Navigation').addTo(fullRouteLayer);
          if(!done)fullPositions=fullPositions.concat(positions);
        });
      }
      if(validLine(geometry)){
        activeRoutePositions=geometry.coordinates.map(function(p){return[p[1],p[0]];});
        var approaching=payload.approaching!==false;
        L.polyline(activeRoutePositions,{color:approaching?'#1679dc':'#145b34',weight:approaching?5:7}).bindTooltip(approaching?'Route to Patrol Start':'Active Patrol Leg · foot-walking').addTo(navigationLayer);
      }
      if(Array.isArray(payload.trail)){var trail=payload.trail.filter(valid).map(function(p){return[p.latitude,p.longitude];});if(trail.length>1)L.polyline(trail,{color:'#c76b19',weight:3,dashArray:'3 5'}).bindTooltip('Recorded GPS trail').addTo(actualLayer);}
      var recenter=document.getElementById('recenter');if(recenter)recenter.disabled=!currentPosition;
      if(!initialNavigationFitted && currentPosition && activeRoutePositions.length){fit();initialNavigationFitted=true;}
    };
    window.addEventListener('message',function(event){if(event.source!==window.parent)return;if(event.data && event.data.type==='navigation-update')window.updatePatrolNavigation(event.data.payload);});
    if(live){var recenter=document.createElement('button');recenter.id='recenter';recenter.textContent='Re-centre';recenter.disabled=true;recenter.style.cssText='position:absolute;z-index:600;right:10px;top:58px;background:white;border:1px solid #bed0c3;border-radius:8px;padding:11px 14px;color:#245b44;font:600 13px system-ui';recenter.onclick=function(){if(currentPosition)map.setView(currentPosition,16);};document.body.appendChild(recenter);}
    var tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}).addTo(map);
    var failedTiles=false;
    tiles.on('loading',function(){failedTiles=false;});
    tiles.on('tileerror',function(){failedTiles=true;document.getElementById('status').hidden=false;document.getElementById('status').textContent='Map tiles are unavailable. Saved route points remain visible.';notify('tile-error');});
    tiles.on('load',function(){if(!failedTiles){document.getElementById('status').hidden=true;notify('tiles-ready');}});
    if(!live)data.segments.forEach(function(segment){if(segment.length>1)L.polyline(segment,{color:'#245b44',weight:4,dashArray:'8 6'}).addTo(plannedLayer);});
    data.points.forEach(function(point){
      var iconNode=document.createElement('span');iconNode.className='point-marker point-'+point.type.toLowerCase();iconNode.style.backgroundColor=point.color;iconNode.textContent=point.symbol;
      var marker=L.marker([point.latitude,point.longitude],{icon:L.divIcon({html:iconNode,className:'planned-marker',iconSize:[32,32],iconAnchor:[16,16]}),title:(point.order+1)+'. '+point.typeLabel+': '+point.label,keyboard:true}).addTo(plannedLayer);
      var popup=document.createElement('div'),kind=document.createElement('div'),label=document.createElement('div');kind.textContent=point.typeLabel;kind.className=point.type==='HIGH_RISK'?'popup-risk':'';label.textContent=point.label;label.className='popup-label';popup.appendChild(kind);popup.appendChild(label);
      if(point.note){var note=document.createElement('div');note.textContent=point.note;note.className='popup-note';popup.appendChild(note);}
      marker.bindPopup(popup);marker.on('click',function(){notify('point-selected',{order:point.order});});
    });
    function fit(){map.invalidateSize();var positions=live && (activeRoutePositions.length || fullPositions.length)?activeRoutePositions.concat(fullPositions):data.points.map(function(p){return[p.latitude,p.longitude];});if(live && currentPosition)positions.push(currentPosition);if(live && activeDestination)positions.push(activeDestination);if(positions.length===1){map.setView(positions[0],15);}else{map.fitBounds(L.latLngBounds(positions),{padding:[38,38],maxZoom:16});}}
    document.getElementById('fit').onclick=fit;fit();
    window.addEventListener('resize',function(){map.invalidateSize();});
    notify('map-ready');
  }catch(e){mapFailure();}})();
  </script></body></html>`;
}
