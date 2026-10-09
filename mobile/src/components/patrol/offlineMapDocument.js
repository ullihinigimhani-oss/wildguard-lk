// Local canvas renderer: no CDN scripts, network fetches, remote tiles or file access.
export function buildOfflineMapDocument(points) {
  const data = JSON.stringify({ points:points.map(p => ({ latitude:p.latitude,longitude:p.longitude,type:p.type,label:p.label })) }).replace(/</g,'\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'"><style>html,body{margin:0;height:100%;background:#edf3ed;font:13px system-ui;color:#174d3a}canvas{width:100%;height:100%;touch-action:none}#controls{position:absolute;top:10px;right:10px;display:grid;gap:8px}button{min-height:44px;padding:10px;border:1px solid #bed0c3;border-radius:8px;background:white;color:#174d3a}#note{position:absolute;bottom:0;background:#fffE;padding:6px;pointer-events:none}</style></head><body><canvas id="map" aria-label="Offline patrol coordinates"></canvas><div id="controls"><button id="fit">Fit Route</button><button id="centre">Re-centre</button><button id="plus">+</button><button id="minus">−</button></div><div id="note"></div><script>
  (function(){var data=${data},canvas=document.getElementById('map'),ctx=canvas.getContext('2d'),payload={},center=[0,0],zoom=14,drag=null,ready=false;
  function valid(p){return p&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180;}
  function world(lng,lat){var size=256*Math.pow(2,zoom),safe=Math.max(-85,Math.min(85,lat));return [(lng+180)/360*size,(1-Math.asinh(Math.tan(safe*Math.PI/180))/Math.PI)/2*size];}
  function xy(p){var w=world(p.longitude,p.latitude),c=world(center[0],center[1]);return [w[0]-c[0]+canvas.width/2,w[1]-c[1]+canvas.height/2];}
  function geo(w){var size=256*Math.pow(2,zoom);return [w[0]/size*360-180,Math.atan(Math.sinh(Math.PI*(1-2*w[1]/size)))*180/Math.PI];}
  function line(coords,color,width,fill){if(!Array.isArray(coords)||coords.length<2)return;ctx.beginPath();coords.forEach(function(p,i){var q=xy({longitude:p[0],latitude:p[1]});if(i)ctx.lineTo(q[0],q[1]);else ctx.moveTo(q[0],q[1]);});ctx.strokeStyle=color;ctx.lineWidth=width;if(fill){ctx.closePath();ctx.fillStyle=fill;ctx.fill();}ctx.stroke();}
  function marker(p,color,label){if(!valid(p))return;var q=xy(p);ctx.beginPath();ctx.arc(q[0],q[1],label?13:8,0,2*Math.PI);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='white';ctx.lineWidth=3;ctx.stroke();if(label){ctx.fillStyle='white';ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillText(label,q[0],q[1]+4);}}
  function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#edf3ed';ctx.fillRect(0,0,canvas.width,canvas.height);
    // Grid follows Web Mercator coordinates; it is not a road or walking-route layer.
    var scale=256*Math.pow(2,zoom),c=world(center[0],center[1]),spacing=64;
    ctx.strokeStyle='#d6e2d8';ctx.lineWidth=1;ctx.beginPath();
    for(var x=((canvas.width/2-c[0])%spacing+spacing)%spacing;x<canvas.width;x+=spacing){ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);}
    for(var y=((canvas.height/2-c[1])%spacing+spacing)%spacing;y<canvas.height;y+=spacing){ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);}
    ctx.stroke();
    (payload.riskZones||[]).forEach(function(z){line(z.geometry.coordinates[0],'#B63B3B',2,'#B63B3B33');});
    if(payload.fullRoute)line(payload.fullRoute.geometry.coordinates,'#16804A',5);
    line((payload.trail||[]).filter(valid).map(function(p){return [p.longitude,p.latitude];}),'#EF8F24',4);
    data.points.forEach(function(p){marker(p,p.type==='HIGH_RISK'?'#B63B3B':'#174d3a',p.type==='START'?'S':p.type==='END'?'E':p.type==='CHECKPOINT'?'C':'O');});
    marker(payload.currentLocation,'#1976D2',null);
  }
  function fit(){var coords=payload.fullRoute?payload.fullRoute.geometry.coordinates:data.points.filter(valid).map(function(p){return [p.longitude,p.latitude];});if(!coords.length)return;var lng=coords.map(function(p){return p[0];}),lat=coords.map(function(p){return p[1];});center=[(Math.min.apply(null,lng)+Math.max.apply(null,lng))/2,(Math.min.apply(null,lat)+Math.max.apply(null,lat))/2];for(zoom=15;zoom>1;zoom--){var a=world(Math.min.apply(null,lng),Math.min.apply(null,lat)),b=world(Math.max.apply(null,lng),Math.max.apply(null,lat));if(Math.abs(a[0]-b[0])<canvas.width-80&&Math.abs(a[1]-b[1])<canvas.height-100)break;}draw();}
  window.updatePatrolNavigation=function(value){payload=value||{};if(!ready){ready=true;fit();}else draw();};
  document.getElementById('fit').onclick=fit;
  document.getElementById('centre').onclick=function(){if(valid(payload.currentLocation)){center=[payload.currentLocation.longitude,payload.currentLocation.latitude];draw();}};
  document.getElementById('plus').onclick=function(){zoom=Math.min(19,zoom+1);draw();};
  document.getElementById('minus').onclick=function(){zoom=Math.max(1,zoom-1);draw();};
  canvas.onpointerdown=function(e){drag=[e.clientX,e.clientY,world(center[0],center[1])];canvas.setPointerCapture(e.pointerId);};
  canvas.onpointermove=function(e){if(!drag)return;center=geo([drag[2][0]+drag[0]-e.clientX,drag[2][1]+drag[1]-e.clientY]);draw();};canvas.onpointerup=function(){drag=null;};canvas.onpointercancel=function(){drag=null;};
  function resize(){canvas.width=canvas.clientWidth;canvas.height=canvas.clientHeight;fit();}window.onresize=resize;resize();
  document.getElementById('note').textContent='Offline Patrol View — No Basemap';
  if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:'map-ready'}));
  })();</script></body></html>`;
}
