import { api } from '../../src/services/api';
import { validatePatrolRoute } from '../../src/services/patrolApi';
vi.mock('../../src/services/api',()=>({api:{post:vi.fn()}}));
const route=()=>({geometry:{type:'LineString',coordinates:[[80.7,7.5],[80.8,7.6]]},distanceMeters:1000,durationSeconds:900});
test('read-only validation uses existing authenticated client and preserves GeoJSON coordinate order',async()=>{
 const payload={park_ranger_area:'park',plannedRoute:[]},controller=new AbortController();api.post.mockResolvedValue({data:{success:true,route:route()}});
 const result=await validatePatrolRoute(payload,controller.signal);
 expect(api.post).toHaveBeenCalledWith('/patrols/validate-route',payload,{signal:controller.signal});expect(result.geometry.coordinates[0]).toEqual([80.7,7.5]);
});
test.each(['empty','nonfinite','invalid latitude','negative distance','negative duration'])('invalid provider response (%s) cannot enable creation',async kind=>{
 const invalid=route();if(kind==='empty')invalid.geometry.coordinates=[];
 if(kind==='nonfinite')invalid.geometry.coordinates[0][0]=NaN;
 if(kind==='invalid latitude')invalid.geometry.coordinates[0][1]=100;
 if(kind==='negative distance')invalid.distanceMeters=-1;
 if(kind==='negative duration')invalid.durationSeconds=-1;
 api.post.mockResolvedValue({data:{success:true,route:invalid}});await expect(validatePatrolRoute({})).rejects.toThrow('Invalid walking route response.');
});
