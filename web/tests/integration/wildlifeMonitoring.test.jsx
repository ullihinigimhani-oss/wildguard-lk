import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
const api = vi.hoisted(() => ({ getAllAnimals: vi.fn(), getDensityZones: vi.fn(), getAnimalsNearHighRiskZones: vi.fn(), getAnimalLocationsByDateRange: vi.fn(), getAnimalsWithLatestLocations: vi.fn() }));
const zones = vi.hoisted(() => ({ getAllRiskZones: vi.fn() }));
vi.mock('../../src/services/sensorApi', () => api);
vi.mock('../../src/services/riskZoneApi', () => zones);
vi.mock('../../src/services/incidentApi', () => ({ getVerifiedIncidentsCount: vi.fn(async () => 4) }));
vi.mock('leaflet', () => ({ default: { divIcon: vi.fn(options => options) } }));
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <section data-testid="map">{children}</section>, TileLayer: () => null,
  Marker: ({ children, position, icon }) => <div data-testid="marker" data-position={JSON.stringify(position)} data-icon={icon.html}>{children}</div>,
  Popup: ({ children }) => <details><summary>Open map popup</summary>{children}</details>,
  Circle: ({ children, center, radius, pathOptions }) => <div data-testid="circle" data-center={JSON.stringify(center)} data-radius={radius} data-color={pathOptions.color}>{children}</div>,
  CircleMarker: ({ children, center }) => <div data-testid="point" data-center={JSON.stringify(center)}>{children}</div>,
  Polyline: ({ positions }) => <output data-testid="route">{JSON.stringify(positions)}</output>,
}));
import WildlifeMonitoring from '../../src/pages/WildlifeMonitoring/WildlifeMonitoring';
import FieldMap from '../../src/pages/FieldMap/FieldMap';
const location = { latitude: 7.5, longitude: 80.7, recordedAt: '2026-01-01T00:00:00Z', heartRate: 60, temperature: 37.5, activityLevel: 'WALKING' };
const animals = [{ id: 'a', animalCode: 'ELE001', species: 'elephant', name: 'Nila', locations: [location] }, { id: 'b', animalCode: 'LEO001', species: 'Leopard', locations: [] }];
const density = { species: 'Elephant', center: { latitude: 7.5, longitude: 80.7 }, radius: 300, animalCount: 3, animalCodes: ['ELE001', 'ELE002', 'ELE003'] };
const zone = { id: 'z', name: 'Waterhole', riskLevel: 'HIGH', isActive: true, centerLatitude: 7.5, centerLongitude: 80.7, radiusMeters: 100 };
beforeEach(() => {
  vi.resetAllMocks(); api.getAllAnimals.mockResolvedValue({ data: animals }); api.getDensityZones.mockResolvedValue({ data: [density] });
  api.getAnimalsNearHighRiskZones.mockResolvedValue({ data: { count: 1 } }); api.getAnimalLocationsByDateRange.mockResolvedValue({ data: [] });
  api.getAnimalsWithLatestLocations.mockResolvedValue({ data: animals }); zones.getAllRiskZones.mockResolvedValue({ data: [zone] });
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
const changeAnimal = value => fireEvent.change(screen.getByRole('combobox'), { target: { value } });
async function monitoring() { const result = render(<WildlifeMonitoring />); await screen.findByText('Total Animals'); return result; }
test('[B2-WILD-01] loading remains visible while an API request is pending', async () => {
  let resolve; api.getAllAnimals.mockReturnValue(new Promise(r => { resolve = r; })); render(<WildlifeMonitoring />);
  expect(screen.getByText('Loading monitoring data...')).toBeInTheDocument();
  await act(async () => resolve({ data: animals })); expect(screen.queryByText('Loading monitoring data...')).not.toBeInTheDocument();
});
test('[B2-WILD-02] statistics and density popup agree with API response', async () => {
  await monitoring(); expect(screen.getByText('Total Animals').parentElement).toHaveTextContent('2');
  expect(screen.getByText('Animals Near High Risk Zones').parentElement).toHaveTextContent('1');
  expect(screen.getByText('Verified Incidents Reported').parentElement).toHaveTextContent('4');
  expect(screen.getByTestId('circle')).toHaveAttribute('data-radius', '300');
  fireEvent.click(screen.getAllByText('Open map popup')[0]);
  expect(screen.getByText('ELE001, ELE002, ELE003')).toBeVisible(); expect(screen.getByText(/Animals in area/)).toHaveTextContent('3');
});
test('[B2-WILD-03] empty datasets show implemented empty density and animal selector states', async () => {
  api.getAllAnimals.mockResolvedValue({ data: [] }); api.getDensityZones.mockResolvedValue({ data: [] }); await monitoring();
  expect(screen.getByText(/No density zones found/)).toBeInTheDocument(); expect(screen.getAllByRole('option')).toHaveLength(1);
});
test('[B2-WILD-04] three-day request bounds and default density radius are deterministic', async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-01-04T00:00:00Z')); await monitoring();
  expect(api.getDensityZones).toHaveBeenCalledWith('2026-01-01T00:00:00.000Z', '2026-01-04T00:00:00.000Z', 300);
});
test('[B2-WILD-05] selected animal route displays returned ordered positions and scoped request', async () => {
  api.getAnimalLocationsByDateRange.mockResolvedValue({ data: [location, { ...location, latitude: 7.6, longitude: 80.8 }] });
  await monitoring(); changeAnimal('a'); await screen.findByTestId('route');
  expect(screen.getByTestId('route')).toHaveTextContent('[[7.5,80.7],[7.6,80.8]]');
  expect(api.getAnimalLocationsByDateRange).toHaveBeenCalledWith('a', expect.any(String), expect.any(String));
  expect(screen.getAllByTestId('point')).toHaveLength(2);
});
test('[B2-WILD-06] selected animal without history displays missing-location message', async () => {
  await monitoring(); changeAnimal('b'); await waitFor(() => expect(api.getAnimalLocationsByDateRange).toHaveBeenCalled());
  expect(screen.getByText('No location data available for this animal in the last 3 days')).toBeInTheDocument(); expect(screen.queryByTestId('route')).not.toBeInTheDocument();
});
test('[B2-WILD-07] route failure leaves monitoring statistics available and logs diagnostic', async () => {
  const error = new Error('history offline'), diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {});
  api.getAnimalLocationsByDateRange.mockRejectedValue(error); await monitoring(); changeAnimal('a');
  await waitFor(() => expect(diagnostic).toHaveBeenCalledWith('Error loading animal route:', error));
  expect(screen.getByText('Total Animals')).toBeInTheDocument(); expect(screen.queryByText('Failed to load data')).not.toBeInTheDocument();
});
test('[B2-WILD-08] partial initial API failure shows aggregate error rather than invented statistics', async () => {
  const error = new Error('density offline'), diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {});
  api.getDensityZones.mockRejectedValue(error); render(<WildlifeMonitoring />); await screen.findByText('Failed to load data');
  expect(screen.queryByText('Total Animals')).not.toBeInTheDocument(); expect(diagnostic).toHaveBeenCalledWith('Error loading data:', error);
});
test('[B2-WILD-09] older animal history response cannot overwrite current selection', async () => {
  let resolveOld; api.getAnimalLocationsByDateRange.mockImplementation(id => id === 'a' ? new Promise(r => { resolveOld = r; }) : Promise.resolve({ data: [{ ...location, latitude: 8 }] }));
  await monitoring(); changeAnimal('a'); changeAnimal('b'); await screen.findByTestId('route');
  expect(screen.getByTestId('route')).toHaveTextContent('[[8,80.7]]');
  await act(async () => resolveOld({ data: [location] })); expect(screen.getByTestId('route')).toHaveTextContent('[[8,80.7]]');
});
test('[B2-WILD-10] clearing animal selection removes previous route', async () => {
  api.getAnimalLocationsByDateRange.mockResolvedValue({ data: [location] }); await monitoring(); changeAnimal('a'); await screen.findByTestId('route');
  changeAnimal(''); expect(screen.queryByTestId('route')).not.toBeInTheDocument();
});
test('[B2-MAP-01] only animals with locations produce markers, with latest position and popup data', async () => {
  render(<FieldMap />); await screen.findByTestId('marker'); expect(screen.getAllByTestId('marker')).toHaveLength(1);
  expect(screen.getByTestId('marker')).toHaveAttribute('data-position', '[7.5,80.7]');
  expect(screen.getByTestId('marker').getAttribute('data-icon')).toContain('🐘');
  fireEvent.click(within(screen.getByTestId('marker')).getByText('Open map popup'));
  expect(screen.getByText('Heart Rate: 60 BPM')).toBeVisible(); expect(screen.getByText('Activity: WALKING')).toBeVisible();
});
test('[B2-MAP-02] risk geometry and risk level color are passed to map circle', async () => {
  render(<FieldMap />); await screen.findByTestId('circle');
  expect(screen.getByTestId('circle')).toHaveAttribute('data-center', '[7.5,80.7]'); expect(screen.getByTestId('circle')).toHaveAttribute('data-radius', '100');
  expect(screen.getByTestId('circle')).toHaveAttribute('data-color', '#e74c3c'); expect(screen.getByText('Waterhole')).toBeInTheDocument();
});
test('[B2-MAP-03] no fixes shows empty location state without marker', async () => {
  api.getAnimalsWithLatestLocations.mockResolvedValue({ data: [{ ...animals[1], locations: undefined }] }); render(<FieldMap />);
  await screen.findByText('No animal locations found'); expect(screen.queryByTestId('marker')).not.toBeInTheDocument();
});
test('[B2-MAP-04] pending map load hides stale map contents until complete', async () => {
  let resolve; zones.getAllRiskZones.mockReturnValue(new Promise(r => { resolve = r; })); render(<FieldMap />);
  expect(screen.getByText('Loading animal locations...')).toBeInTheDocument(); expect(screen.queryByTestId('map')).not.toBeInTheDocument();
  await act(async () => resolve({ data: [] })); expect(screen.getByTestId('map')).toBeInTheDocument();
});
test('[B2-MAP-05] partial risk API failure renders error and no map', async () => {
  const error = new Error('risk offline'), diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {});
  zones.getAllRiskZones.mockRejectedValue(error); render(<FieldMap />); await screen.findByText('Failed to load data');
  expect(screen.queryByTestId('map')).not.toBeInTheDocument(); expect(diagnostic).toHaveBeenCalledWith('Error loading data:', error);
});
test('[B2-MAP-06] malformed animal envelope fails safely instead of rendering misleading positions', async () => {
  const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {}); api.getAnimalsWithLatestLocations.mockResolvedValue({ data: {} });
  render(<FieldMap />); await screen.findByText('Failed to load data'); expect(screen.queryByTestId('marker')).not.toBeInTheDocument();
  expect(diagnostic).toHaveBeenCalledWith('Error loading data:', expect.any(TypeError));
});
