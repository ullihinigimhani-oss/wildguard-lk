import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { createHash, randomUUID } from 'node:crypto';
jest.mock('expo-crypto',()=>({ randomUUID:()=>require('node:crypto').randomUUID(),CryptoDigestAlgorithm:{SHA256:'SHA256'},digestStringAsync:async(_,text)=>require('node:crypto').createHash('sha256').update(text).digest('hex') }));
let mockProvider = null;
jest.mock('../../src/services/offlineMapProvider',()=>({get approvedOfflineMapProvider(){return mockProvider;}}));
const mockFiles = new Map();
let mockSpace = 1000000000;
jest.mock('expo-file-system',()=>({
 Paths:{document:'file:///owned/',get availableDiskSpace(){return mockSpace;}},
 Directory:class{constructor(parent,name){this.uri=(parent.uri||parent)+name+'/';}create(){}},
 File:class{constructor(parent,name){this.uri=(parent.uri||parent)+(name||'');}get exists(){return mockFiles.has(this.uri);}get size(){return (mockFiles.get(this.uri)||'').length;}write(text){mockFiles.set(this.uri,text);}async text(){return mockFiles.get(this.uri);}move(destination){mockFiles.set(destination.uri,mockFiles.get(this.uri));mockFiles.delete(this.uri);this.uri=destination.uri;}delete(){mockFiles.delete(this.uri);}}
}));
jest.mock("expo-sqlite", () => {
  const { DatabaseSync } = require("node:sqlite");
  const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "wildguard-isolated-sqlite-"));
  let handles = [];
  return {
    openDatabaseAsync: async () => {
      const raw = new DatabaseSync(path.join(directory, "test.db")); handles.push(raw);
      const db = {
        execAsync: async sql => raw.exec(sql),
        getFirstAsync: async (sql, ...args) => raw.prepare(sql).get(...args),
        getAllAsync: async (sql, ...args) => raw.prepare(sql).all(...args),
        runAsync: async (sql, ...args) => raw.prepare(sql).run(...args),
        withExclusiveTransactionAsync: async callback => {
          raw.exec("BEGIN IMMEDIATE");
          try { const result = await callback(db); raw.exec("COMMIT"); return result; }
          catch (error) { raw.exec("ROLLBACK"); throw error; }
        },
      }; return db;
    },
    close: () => { handles.forEach(db => db.close()); handles = []; },
    cleanup: () => {
      if (!path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(directory).startsWith("wildguard-isolated-sqlite-")) throw new Error("Unsafe isolated test path");
      fs.rmSync(directory, { recursive: true });
    },
  };
});

import * as SQLite from 'expo-sqlite';
import { database, resetOfflineConnection, enqueueGps, localTrail } from '../../src/storage/offlineStorage';
import { cacheNavigation,readNavigation,packagePlan,downloadPackage,readPackage,deletePackage,packageStatus,verifyProvider,validateBundle,pointIdentity } from '../../src/services/offlineMaps';
import { buildOfflineMapDocument } from '../../src/components/patrol/offlineMapDocument';
import { useOffline } from '../../src/hooks/useOffline';
import useLiveNavigation from '../../src/hooks/useLiveNavigation';
import { getMyPatrol,getPatrolRiskZones,getPatrolLocations,requestWalkingRoute } from '../../src/services/patrolApi';
jest.mock('../../src/hooks/useOffline',()=>({useOffline:jest.fn()}));
jest.mock('../../src/services/patrolApi',()=>({getMyPatrol:jest.fn(),getPatrolRiskZones:jest.fn(),getPatrolLocations:jest.fn(),requestWalkingRoute:jest.fn()}));
const patrol={id:'p',parkId:'park',rangerId:'r',status:'IN_PROGRESS',actualStartTime:'session',plannedRoute:[{id:'s',type:'START',order:0,latitude:7,longitude:80},{id:'e',type:'END',order:1,latitude:7.001,longitude:80.001}]};
const route={geometry:{type:'LineString',coordinates:[[80,7],[80.001,7.001]]},distanceMeters:160,durationSeconds:120,riskZones:[]};
const zone={id:'z',riskLevel:'HIGH',geometry:{type:'Polygon',coordinates:[[[80.002,7.002],[80.003,7.002],[80.003,7.003],[80.002,7.002]]]}};
function bundle(plan){const tiles=[];for(let z=plan.minZoom;z<=plan.maxZoom;z++){const x=lng=>Math.floor((lng+180)/360*2**z),y=lat=>Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*2**z);for(let i=x(plan.bounds[0]);i<=x(plan.bounds[2]);i++)for(let j=y(plan.bounds[3]);j<=y(plan.bounds[1]);j++)tiles.push({z,x:i,y:j,data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='});}return {version:1,format:'wildguard-raster-v1',minZoom:plan.minZoom,maxZoom:plan.maxZoom,tiles};}
const provider=()=>({id:'isolated-test',offlineAllowed:true,licenseReference:'isolated mocked license',attribution:'Isolated fixture',download:jest.fn(async(plan,{onProgress})=>{onProgress?.(.5);const text=JSON.stringify(bundle(plan));return {text,sha256:createHash('sha256').update(text).digest('hex')};})});
async function snapshot(){await cacheNavigation('r',patrol,[],route);return readNavigation('r',patrol);}
beforeEach(async()=>{mockProvider=null;mockSpace=1000000000;mockFiles.clear();useOffline.mockReturnValue(null);const db=await database();await db.execAsync('DELETE FROM gps;');await cacheNavigation('r',patrol,[],route);await db.execAsync('DELETE FROM navigation_cache;DELETE FROM map_packages;');jest.clearAllMocks();getMyPatrol.mockResolvedValue(patrol);getPatrolRiskZones.mockResolvedValue([]);});
afterAll(()=>{SQLite.close();SQLite.cleanup();resetOfflineConnection();});
test('no configured or unlicensed provider can download; unauthorized Ranger rejected',async()=>{expect(()=>verifyProvider(null)).toThrow('prohibited');expect(()=>verifyProvider({...provider(),offlineAllowed:false})).toThrow();await expect(downloadPackage('other',patrol,await snapshot())).rejects.toThrow('assigned');await expect(downloadPackage('r',patrol,await snapshot())).rejects.toThrow('prohibited');});
test('cached green geometry and hazards persist across SQLite restart and accounts are isolated',async()=>{await cacheNavigation('r',patrol,[zone],{...route,riskZones:[zone]});SQLite.close();resetOfflineConnection();const saved=await readNavigation('r',patrol);expect(saved.route.geometry).toEqual(route.geometry);expect(saved.zones).toEqual([zone]);expect(saved.warning).toMatch(/changed/);await expect(readNavigation('other',patrol)).rejects.toThrow();});
test('changed waypoints/session invalidate green and changed hazards invalidate old route',async()=>{await snapshot();expect((await readNavigation('r',{...patrol,plannedRoute:patrol.plannedRoute.map(p=>({...p,longitude:p.longitude+.01}))})).route).toBeNull();expect((await readNavigation('r',{...patrol,actualStartTime:'new'})).route).toBeNull();await cacheNavigation('r',patrol,[zone]);expect((await readNavigation('r',patrol)).route).toBeNull();});
test('missing/invalid hazards and corrupt snapshot cannot be called safe',async()=>{expect((await readNavigation('r',patrol)).warning).toMatch(/missing/);await expect(cacheNavigation('r',patrol,[{...zone,geometry:null}],route)).rejects.toThrow();await snapshot();await(await database()).runAsync('UPDATE navigation_cache SET digest=?','bad');await expect(readNavigation('r',patrol)).rejects.toThrow('integrity');});
test('approved isolated adapter downloads complete verified scoped package with progress and survives restart',async()=>{mockProvider=provider();const progress=jest.fn();await downloadPackage('r',patrol,await snapshot(),{onProgress:progress});expect(progress).toHaveBeenCalledWith(1);SQLite.close();resetOfflineConnection();const pack=await readPackage('r',patrol);expect(pack.status).toBe('READY');expect(pack.bundle.tiles.length).toBe(pack.tileCount);await expect(readPackage('other',patrol)).rejects.toThrow();});
test('pending field data and insufficient disk stop download before provider request',async()=>{mockProvider=provider();const saved=await snapshot();await expect(downloadPackage('r',patrol,saved,{fieldDataPending:true})).rejects.toThrow('field data');mockSpace=1;await expect(downloadPackage('r',patrol,saved)).rejects.toThrow('storage');expect(mockProvider.download).not.toHaveBeenCalled();expect((await packageStatus('r','p')).status).toBe('FAILED');});
test('cancelled download never becomes ready and supports retry with the same scoped patrol',async()=>{const saved=await snapshot();mockProvider=provider();const controller=new AbortController();mockProvider.download.mockImplementation(async()=>{controller.abort();throw new Error('cancel');});await expect(downloadPackage('r',patrol,saved,{signal:controller.signal})).rejects.toThrow();expect((await packageStatus('r','p')).status).toBe('CANCELLED');mockProvider=provider();await downloadPackage('r',patrol,saved);expect(await readPackage('r',patrol)).toBeTruthy();});
test('interrupted and corrupt packages never render ready',async()=>{mockProvider=provider();await downloadPackage('r',patrol,await snapshot());const metadata=await packageStatus('r','p');mockFiles.set(metadata.uri,'corrupt');expect(await readPackage('r',patrol)).toBeNull();expect((await packageStatus('r','p')).status).toBe('CORRUPT');await(await database()).runAsync("UPDATE map_packages SET status='DOWNLOADING'");expect(await readPackage('r',patrol)).toBeNull();expect((await packageStatus('r','p')).status).toBe('INTERRUPTED');});
test('deleting a package leaves GPS, navigation and unrelated files intact',async()=>{mockProvider=provider();await downloadPackage('r',patrol,await snapshot());await enqueueGps('r','p',{latitude:7,longitude:80,accuracy:5,recordedAt:new Date().toISOString()});mockFiles.set('file:///owned/evidence.jpg','evidence');await deletePackage('r','p');expect(await packageStatus('r','p')).toBeNull();expect(await localTrail('r','p')).toHaveLength(1);expect((await readNavigation('r',patrol)).route).toBeTruthy();expect(mockFiles.get('file:///owned/evidence.jpg')).toBe('evidence');});
test('bounded coverage and unsupported/incomplete/remote tiles fail closed',()=>{expect(()=>packagePlan(patrol,{...route,geometry:{type:'LineString',coordinates:[[80,7],[81,8]]}})).toThrow();const plan=packagePlan(patrol,route);expect(()=>validateBundle({version:1,format:'mbtiles',tiles:[]},plan)).toThrow();const data=bundle(plan);data.tiles[0].data='https://tile.openstreetmap.org/0/0/0.png';expect(()=>validateBundle(data,plan)).toThrow();});
test('local renderer has no remote dependencies or blue directions and distinguishes no basemap from downloaded map',()=>{const html=buildOfflineMapDocument(patrol.plannedRoute);expect(html).toContain("connect-src 'none'");expect(html).not.toMatch(/https:|unpkg|tileLayer|payload.geometry/);expect(html).toContain('Offline Patrol View — No Basemap');expect(html).toContain('payload.fullRoute.geometry.coordinates');expect(html).toContain('payload.trail');expect(html).toContain('payload.currentLocation');expect(html).toContain('Fit Route');});
test('offline navigation has one existing GPS path, cached hazards and no ORS/history API requests',async()=>{await cacheNavigation('r',patrol,[zone],{...route,riskZones:[zone]});useOffline.mockReturnValue({owner:'r',online:false});const hook=renderHook(()=>useLiveNavigation(patrol,patrol.plannedRoute.map(p=>({...p,waypointId:p.id})),'r',{active:true,position:null}));await waitFor(()=>expect(hook.result.current.riskZones).toEqual([zone]));expect(hook.result.current.riskReady).toBe(false);expect(hook.result.current.route).toBeNull();expect(getPatrolRiskZones).not.toHaveBeenCalled();expect(getPatrolLocations).not.toHaveBeenCalled();expect(requestWalkingRoute).not.toHaveBeenCalled();hook.unmount();});

test('changed server ownership or risk snapshot blocks download before provider transfer',async()=>{mockProvider=provider();const saved=await snapshot();getMyPatrol.mockResolvedValue({...patrol,rangerId:'other'});await expect(downloadPackage('r',patrol,saved)).rejects.toThrow('assigned');getMyPatrol.mockResolvedValue(patrol);getPatrolRiskZones.mockResolvedValue([zone]);await expect(downloadPackage('r',patrol,saved)).rejects.toThrow('changed');expect(mockProvider.download).not.toHaveBeenCalled();});
test('changed patrol makes a downloaded package stale without deleting its file',async()=>{mockProvider=provider();await downloadPackage('r',patrol,await snapshot());const prior=await packageStatus('r','p');expect(await readPackage('r',{...patrol,actualStartTime:'changed'})).toBeNull();expect((await packageStatus('r','p')).status).toBe('STALE');expect(mockFiles.has(prior.uri)).toBe(true);});

test('bad provider digest fails completion and leaves no partial/ready package',async()=>{mockProvider=provider();mockProvider.download.mockResolvedValue({text:'{}',sha256:'bad'});await expect(downloadPackage('r',patrol,await snapshot())).rejects.toThrow('integrity');expect(await readPackage('r',patrol)).toBeNull();expect(mockFiles.size).toBe(0);});
test('offline watcher still records real GPS and appends the orange trail without backend calls',async()=>{await snapshot();useOffline.mockReturnValue({owner:'r',online:false});const pts=patrol.plannedRoute.map(p=>({...p,waypointId:p.id}));const hook=renderHook(({position})=>useLiveNavigation(patrol,pts,'r',{active:true,position}),{initialProps:{position:null}});await waitFor(()=>expect(hook.result.current.riskError).toMatch(/Cached/));hook.rerender({position:{latitude:7.0001,longitude:80.0001,accuracy:5,timestamp:Date.now()}});await waitFor(()=>expect(hook.result.current.trail).toHaveLength(1));expect(await localTrail('r','p')).toHaveLength(1);expect(requestWalkingRoute).not.toHaveBeenCalled();hook.unmount();});
test('offline canvas executes green/risk/orange/GPS rendering, route fit and recenter without network',()=>{const strokes=[],fills=[],arcs=[],elements={};const context={clearRect(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){fills.push(this.fillStyle);},stroke(){strokes.push(this.strokeStyle);},fillText(){},arc(...args){arcs.push(args);},drawImage(){}};const canvas={clientWidth:360,clientHeight:440,getContext:()=>context,setPointerCapture(){}};elements.map=canvas;['fit','centre','plus','minus','note'].forEach(id=>elements[id]={});const bridge={postMessage:jest.fn()};const window={ReactNativeWebView:bridge};require('node:vm').runInNewContext(buildOfflineMapDocument(patrol.plannedRoute).match(/<script>([\s\S]*?)<\/script>/)[1],{window,document:{getElementById:id=>elements[id]},Image:class{}});window.updatePatrolNavigation({fullRoute:route,riskZones:[zone],trail:[{latitude:7,longitude:80},{latitude:7.0005,longitude:80.0005}],currentLocation:{latitude:6.5,longitude:79.9},geometry:route.geometry});expect(strokes).toContain('#16804A');expect(strokes).toContain('#EF8F24');expect(strokes).toContain('#B63B3B');expect(fills).toContain('#1976D2');elements.centre.onclick();expect(arcs.at(-1).slice(0,2)).toEqual([180,220]);elements.fit.onclick();expect(arcs.at(-1).slice(0,2)).not.toEqual([180,220]);expect(bridge.postMessage).toHaveBeenCalledWith(JSON.stringify({type:'map-ready'}));});

test('connectivity changes stop offline ORS and reconnect performs one live request, preserving GPS history',async()=>{
  await snapshot();
  getPatrolLocations.mockResolvedValue([]);
  requestWalkingRoute.mockResolvedValue({...route,destination:{waypointId:'s'},riskZones:[]});
  const position={latitude:7.002,longitude:80.002,accuracy:5,timestamp:Date.now()};
  const pts=patrol.plannedRoute.map(p=>({...p,waypointId:p.id}));
  useOffline.mockReturnValue({owner:'r',online:true});
  const hook=renderHook(()=>useLiveNavigation(patrol,pts,'r',{active:true,position}));
  await waitFor(()=>expect(requestWalkingRoute).toHaveBeenCalledTimes(1));
  await waitFor(()=>expect(hook.result.current.trail.length).toBeGreaterThan(0));
  useOffline.mockReturnValue({owner:'r',online:false});hook.rerender();
  await waitFor(()=>expect(hook.result.current.riskReady).toBe(false));
  expect(requestWalkingRoute).toHaveBeenCalledTimes(1);
  expect(hook.result.current.trail.length).toBeGreaterThan(0);
  hook.rerender();expect(requestWalkingRoute).toHaveBeenCalledTimes(1);
  useOffline.mockReturnValue({owner:'r',online:true});hook.rerender();
  await waitFor(()=>expect(requestWalkingRoute).toHaveBeenCalledTimes(2));
  hook.rerender();expect(requestWalkingRoute).toHaveBeenCalledTimes(2);
  expect(hook.result.current.trail.length).toBeGreaterThan(0);
  hook.unmount();
});
