import { render, fireEvent } from '@testing-library/react';
import PatrolMap from '../../src/components/patrol/PatrolMap';
const mocks=vi.hoisted(()=>({polyline:vi.fn(),divIcon:vi.fn(),fitBounds:vi.fn(),remove:vi.fn()}));
vi.mock('leaflet',()=>{
  const layer=()=>({addTo:vi.fn().mockReturnThis(),bindTooltip:vi.fn().mockReturnThis(),on:vi.fn().mockReturnThis(),clearLayers:vi.fn()});
  mocks.polyline.mockImplementation(layer);mocks.divIcon.mockImplementation(x=>x);
  return {default:{map:()=>({setView:vi.fn().mockReturnThis(),on:vi.fn(),fitBounds:mocks.fitBounds,invalidateSize:vi.fn(),remove:mocks.remove}),tileLayer:layer,layerGroup:layer,polyline:mocks.polyline,divIcon:mocks.divIcon,marker:layer,latLngBounds:x=>x}};
});
const points=[{id:'s',type:'START',order:0,latitude:7.5,longitude:80.7},{id:'e',type:'END',order:1,latitude:7.6,longitude:80.8}];
beforeEach(()=>vi.clearAllMocks());
test('real GeoJSON is converted lng/lat to Leaflet lat/lng, rendered green, and fitted including bends',()=>{
 const geometry={type:'LineString',coordinates:[[80.7,7.5],[80.9,7.7],[80.8,7.6]]};
 const view=render(<PatrolMap points={points} walkingRoute={{geometry}} invalidIndex={1}/>);
 expect(mocks.polyline).toHaveBeenCalledWith([[7.5,80.7],[7.7,80.9],[7.6,80.8]],expect.objectContaining({color:'#174D3A',weight:5}));
 expect(mocks.polyline).toHaveBeenCalledTimes(1);
 expect(mocks.fitBounds).toHaveBeenCalledWith(expect.arrayContaining([[7.7,80.9]]),expect.anything());
 expect(mocks.divIcon.mock.calls[1][0].html).toContain('is-unmapped');
 fireEvent.click(view.getByText('Fit route'));expect(mocks.fitBounds).toHaveBeenCalledTimes(2);
 view.unmount();expect(mocks.remove).toHaveBeenCalledTimes(1);
});
test('unvalidated geometry is only a grey dashed planning guide',()=>{
 render(<PatrolMap points={points}/>);
 expect(mocks.polyline).toHaveBeenCalledWith([[7.5,80.7],[7.6,80.8]],expect.objectContaining({color:'#747e78',dashArray:'7 5'}));
});
