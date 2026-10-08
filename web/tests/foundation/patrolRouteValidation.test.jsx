import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CreatePatrolForm from '../../src/pages/PatrolManagement/CreatePatrolForm';
import usePatrolRouteValidation from '../../src/hooks/usePatrolRouteValidation';
import { validatePatrolRoute, createPatrol } from '../../src/services/patrolApi';
vi.mock('../../src/services/patrolApi', () => ({ validatePatrolRoute: vi.fn(), createPatrol: vi.fn(), updatePatrol: vi.fn() }));
vi.mock('../../src/components/common/ParkSelect', () => ({default:()=>null}));
vi.mock('../../src/components/common/RangerSelect', () => ({default:()=>null}));
vi.mock('../../src/components/patrol/PatrolMap', () => ({default:({walkingRoute,invalidIndex,onMove,points})=><div><output data-testid="preview">{JSON.stringify({walkingRoute,invalidIndex})}</output><button type="button" onClick={()=>onMove(points[0].id,{lat:7.51,lng:80.71})}>Reposition START</button></div>}));
const route = {geometry:{type:'LineString',coordinates:[[80.7,7.5],[80.72,7.52],[80.8,7.6]]},distanceMeters:1550,durationSeconds:1200};
const values = {patrol_title:'Boundary patrol',park_ranger_area:'park',assigned_ranger:'ranger',patrol_date:'2026-10-10',start_time:'08:00',expected_end_time:'10:00',patrol_type:'ROUTINE',priority:'MEDIUM',latitude:'',longitude:'',start_location:'',instructions_notes:'',plannedRoute:[{id:'s',type:'START',order:0,latitude:7.5,longitude:80.7},{id:'e',type:'END',order:1,latitude:7.6,longitude:80.8}]};
const mount = () => render(<MemoryRouter><CreatePatrolForm initialValues={values}/></MemoryRouter>);
const validate = () => fireEvent.click(screen.getByRole('button',{name:'Validate walking route'}));
beforeEach(()=>{vi.resetAllMocks();validatePatrolRoute.mockResolvedValue(route);createPatrol.mockResolvedValue({success:true,patrol:{id:'created'}});});
test('blocks unvalidated save; shows real geometry and metrics; allows successful creation',async()=>{
  mount();expect(screen.getByRole('button',{name:'Create Patrol'})).toBeDisabled();validate();
  await screen.findByText(/Walking route verified/);
  expect(screen.getByTestId('preview').textContent).toContain(JSON.stringify(route.geometry));
  expect(screen.getByText(/1.55 km.*20 min/)).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Create Patrol'}));await waitFor(()=>expect(createPatrol).toHaveBeenCalledTimes(1));
});
test.each([[0,'START'],[1,'END']])('unmapped %s highlights the exact marker and repositioning needs revalidation',async(index,type)=>{
  validatePatrolRoute.mockRejectedValueOnce({response:{data:{code:'PATROL_POINT_UNMAPPED',message:'No walking connection.',routingPoint:{index,type}}}});
  mount();validate();await screen.findByText(new RegExp(`Waypoint ${index+1}`));
  expect(JSON.parse(screen.getByTestId('preview').textContent).invalidIndex).toBe(index);
  expect(screen.getByRole('button',{name:'Create Patrol'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Reposition START'}));validate();await screen.findByText(/Walking route verified/);
  expect(validatePatrolRoute.mock.calls.at(-1)[0].plannedRoute[0].latitude).toBe(7.51);
});
test('moving a validated waypoint immediately clears green preview and disables save',async()=>{
  mount();validate();await screen.findByText(/Walking route verified/);fireEvent.click(screen.getByRole('button',{name:'Reposition START'}));
  expect(screen.getByRole('button',{name:'Create Patrol'})).toBeDisabled();expect(JSON.parse(screen.getByTestId('preview').textContent).walkingRoute).toBeUndefined();
});
test.each(['NO_WALKING_ROUTE','ROUTING_UNAVAILABLE','NO_RISK_AVOIDING_ROUTE'])('%s never permits saving',async code=>{
  validatePatrolRoute.mockRejectedValue({response:{data:{code,message:'Cannot verify this route.'}}});mount();validate();await screen.findByText('Cannot verify this route.');
  expect(screen.getByRole('button',{name:'Create Patrol'})).toBeDisabled();expect(createPatrol).not.toHaveBeenCalled();
});
test('loading blocks saves and stale results cannot validate a changed route',async()=>{
  let resolve;validatePatrolRoute.mockReturnValueOnce(new Promise(r=>resolve=r));mount();validate();
  expect(screen.getByRole('button',{name:'Create Patrol'})).toBeDisabled();expect(screen.getByRole('button',{name:'Validating walking route…'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Reposition START'}));await act(async()=>resolve(route));
  expect(screen.queryByText(/Walking route verified/)).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Create Patrol'})).toBeDisabled();
});
function Harness({park='park'}) { const state=usePatrolRouteValidation({park_ranger_area:park,plannedRoute:values.plannedRoute});return <><button onClick={state.validate}>Validate</button><output>{state.route?'valid':state.error||'not valid'}</output></>; }
test('park changes invalidate validation and unmount aborts pending requests',async()=>{
  const view=render(<Harness/>);fireEvent.click(screen.getByText('Validate'));await screen.findByText('valid');view.rerender(<Harness park="other"/>);
  expect(screen.getByText('not valid')).toBeVisible();fireEvent.click(screen.getByText('Validate'));view.unmount();expect(validatePatrolRoute.mock.calls.at(-1)[1].aborted).toBe(true);
});
test('successful validation expires before saving',async()=>{
  vi.useFakeTimers();try {render(<Harness/>);await act(async()=>fireEvent.click(screen.getByText('Validate')));expect(screen.getByText('valid')).toBeVisible();act(()=>vi.advanceTimersByTime(120000));expect(screen.getByText(/expired/)).toBeVisible();} finally {vi.useRealTimers();}
});
