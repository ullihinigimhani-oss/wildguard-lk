import { walkingRouteError } from "../../src/utils/walkingRouteError";
test("full error identifies saved START without upstream messages",()=>{
 expect(walkingRouteError({code:"PATROL_POINT_UNMAPPED",routingPoint:{index:0,type:"START"},message:"secret"})).toContain("Start Point (waypoint 1)");
 expect(walkingRouteError({code:"PATROL_POINT_UNMAPPED",routingPoint:{index:0,type:"START"},message:"secret"})).not.toContain("secret");
});
test("GPS failure stays distinct from a saved waypoint",()=>{
 expect(walkingRouteError({code:"CURRENT_LOCATION_UNMAPPED"})).toContain("current GPS");
 expect(walkingRouteError({code:"ROUTING_REQUEST_INVALID"})).toContain("rejected");
 expect(walkingRouteError({code:"UNRELATED"})).toBeNull();
});
