import React from 'react';
import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react';
import { vi } from 'vitest';
const api = vi.hoisted(() => ({ getAllAnimals: vi.fn(), createAnimal: vi.fn(), updateAnimal: vi.fn(), deleteAnimal: vi.fn(), addSensorData: vi.fn() }));
const map = vi.hoisted(() => ({ events: {} }));
vi.mock('../src/services/api', () => api);
vi.mock('leaflet', () => { class Default { static mergeOptions() {} } return { default: { Icon: { Default } } }; });
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div><button type="button" onClick={() => map.events.click({ latlng: { lat: 7.5, lng: 80.7 } })}>Select map position</button>{children}</div>,
  TileLayer: () => null, Marker: ({ position }) => <output data-testid="marker">{position.join(',')}</output>,
  useMapEvents: events => { map.events = events; },
}));
import App from '../src/App';
const elephant = { id: 'a', species: 'Elephant', animalCode: 'ELE009', name: 'Nila', sex: 'Female', notes: 'note', locations: [{ latitude: 7.5, longitude: 80.7 }] };
const leopard = { id: 'b', species: 'Leopard', animalCode: 'LEO002', locations: [] };
const change = (el, value) => fireEvent.change(el, { target: { value } });
const formFor = text => screen.getByRole('button', { name: text, exact: true }).closest('form');
const registration = () => formFor('Register Animal');
const sensorForm = () => formFor('Add Sensor Data');
async function ready(rows = [elephant, leopard]) {
  api.getAllAnimals.mockResolvedValue({ data: rows }); const result = render(<App />);
  await screen.findByText(`Animals (${rows.length})`); return result;
}
function fillTelemetry() {
  const form = sensorForm(), selects = within(form).getAllByRole('combobox');
  change(selects[0], 'Elephant'); change(selects[1], 'ELE009');
  fireEvent.click(within(form).getByRole('button', { name: 'Select map position' }));
  change(screen.getByPlaceholderText('e.g., 60'), '60'); change(screen.getByPlaceholderText('e.g., 37.5'), '37.5');
  change(selects[2], 'WALKING'); change(form.querySelector('[type="datetime-local"]'), '2026-01-01T12:00');
  return form;
}
beforeEach(() => { vi.resetAllMocks(); map.events = {}; });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
test('[B2-SUI-01] populated cards display latest coordinates and missing location safely', async () => {
  await ready(); expect(screen.getByText('Last location: 7.5000, 80.7000')).toBeInTheDocument();
  expect(screen.getByText('LEO002')).toBeInTheDocument(); expect(screen.getAllByText(/Last location:/)).toHaveLength(1);
});
test('[B2-SUI-02] generated code uses highest matching number of selected species', async () => {
  await ready([elephant, { ...elephant, id: 'c', animalCode: 'ELE002' }, { ...elephant, id: 'd', animalCode: 'custom' }, leopard]);
  change(within(registration()).getAllByRole('combobox')[0], 'Elephant');
  expect(screen.getByPlaceholderText('Auto-generated when species selected')).toHaveValue('ELE010');
  change(within(registration()).getAllByRole('combobox')[0], 'Leopard');
  expect(screen.getByPlaceholderText('Auto-generated when species selected')).toHaveValue('LEO003');
});
test('[B2-SUI-03] first animal starts at 001 and unselected species clears generated code', async () => {
  await ready([]); const species = within(registration()).getAllByRole('combobox')[0];
  change(species, 'Elephant'); expect(screen.getByPlaceholderText('Auto-generated when species selected')).toHaveValue('ELE001');
  change(species, ''); expect(screen.getByPlaceholderText('Auto-generated when species selected')).toHaveValue('');
});
test('[B2-SUI-04] native required validation prevents empty registration', async () => {
  await ready(); expect(registration().checkValidity()).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Register Animal' })); expect(api.createAnimal).not.toHaveBeenCalled();
});
test('[B2-SUI-05] registration shows pending state, submits metadata, resets and reloads', async () => {
  await ready(); let resolve; api.createAnimal.mockReturnValue(new Promise(r => { resolve = r; }));
  api.getAllAnimals.mockResolvedValueOnce({ data: [elephant, leopard, { id: 'new', species: 'Elephant', animalCode: 'ELE010', name: 'New', locations: [] }] });
  change(within(registration()).getAllByRole('combobox')[0], 'Elephant');
  change(screen.getByPlaceholderText('Optional name'), 'New'); change(screen.getByPlaceholderText('Additional notes about the animal'), 'tracked');
  fireEvent.click(screen.getByRole('button', { name: 'Register Animal' }));
  expect(screen.getAllByRole('button', { name: 'Adding...' })[0]).toBeDisabled();
  expect(api.createAnimal).toHaveBeenCalledWith({ animalCode: 'ELE010', species: 'Elephant', name: 'New', sex: '', notes: 'tracked' });
  await act(async () => resolve({ success: true }));
  expect(await screen.findByText('Animal added successfully!')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Optional name')).toHaveValue(''); expect(api.getAllAnimals).toHaveBeenCalledTimes(2);
  expect(screen.getByText('ELE010')).toBeInTheDocument(); expect(screen.getByText('Animals (3)')).toBeInTheDocument();
});
test('[B2-SUI-06] registration API failure preserves values and re-enables retry', async () => {
  await ready(); api.createAnimal.mockRejectedValue({ response: { data: { message: 'Duplicate code' } } });
  change(within(registration()).getAllByRole('combobox')[0], 'Elephant');
  fireEvent.click(screen.getByRole('button', { name: 'Register Animal' }));
  await screen.findByText('Failed to add animal: Duplicate code');
  expect(screen.getByPlaceholderText('Auto-generated when species selected')).toHaveValue('ELE010');
  expect(screen.getByRole('button', { name: 'Register Animal' })).toBeEnabled(); expect(api.getAllAnimals).toHaveBeenCalledTimes(1);
});
test('[B2-SUI-07] species selection limits collar choices and clears prior animal', async () => {
  await ready(); const [species, code] = within(sensorForm()).getAllByRole('combobox'); expect(code).toBeDisabled();
  change(species, 'Elephant'); expect(within(code).getAllByRole('option').map(o => o.value)).toEqual(['', 'ELE009']);
  change(code, 'ELE009'); change(species, 'Leopard'); expect(code).toHaveValue('');
  expect(within(code).getAllByRole('option').map(o => o.value)).toEqual(['', 'LEO002']);
});
test('[B2-SUI-08] map selection enables valid telemetry, normalizes numbers and clears after success', async () => {
  await ready(); expect(screen.getByRole('button', { name: 'Add Sensor Data', exact: true })).toBeDisabled();
  const form = fillTelemetry(); expect(form.checkValidity()).toBe(true);
  expect(screen.getByText('Selected: 7.5000, 80.7000')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Add Sensor Data', exact: true }));
  await screen.findByText('Sensor data added successfully!');
  expect(api.addSensorData).toHaveBeenCalledWith({ animalCode: 'ELE009', latitude: 7.5, longitude: 80.7, heartRate: 60, temperature: 37.5, activityLevel: 'WALKING', recordedAt: new Date('2026-01-01T12:00').toISOString() });
  expect(screen.queryByTestId('marker')).not.toBeInTheDocument(); expect(screen.getByPlaceholderText('e.g., 60')).toHaveValue(null);
  expect(screen.getByRole('button', { name: 'Add Sensor Data', exact: true })).toBeDisabled(); expect(api.getAllAnimals).toHaveBeenCalledTimes(2);
});
test('[B2-SUI-09] telemetry failure keeps map and measurements for retry', async () => {
  await ready(); api.addSensorData.mockRejectedValue(new Error('offline')); fillTelemetry();
  fireEvent.click(screen.getByRole('button', { name: 'Add Sensor Data', exact: true }));
  await screen.findByText('Failed to add sensor data: offline'); expect(screen.getByTestId('marker')).toHaveTextContent('7.5,80.7');
  expect(screen.getByPlaceholderText('e.g., 60')).toHaveValue(60); expect(api.getAllAnimals).toHaveBeenCalledTimes(1);
});
test('[B2-SUI-10] telemetry requires measurements and activity even after collar/map selection', async () => {
  await ready(); const form = fillTelemetry(); change(screen.getByPlaceholderText('e.g., 60'), '');
  expect(form.checkValidity()).toBe(false); fireEvent.click(screen.getByRole('button', { name: 'Add Sensor Data', exact: true }));
  expect(api.addSensorData).not.toHaveBeenCalled();
});
test('[B2-SUI-11] edit sends changed metadata without animalCode and closes on success', async () => {
  const { container } = await ready(); fireEvent.click(screen.getByText('ELE009'));
  api.getAllAnimals.mockResolvedValueOnce({ data: [{ ...elephant, name: 'Updated' }, leopard] });
  const form = container.querySelectorAll('form')[2]; expect(within(form).getByDisplayValue('ELE009')).toBeDisabled();
  change(within(form).getByDisplayValue('Nila'), 'Updated'); fireEvent.click(within(form).getByRole('button', { name: 'Update', exact: true }));
  await screen.findByText('Animal updated successfully!');
  expect(api.updateAnimal).toHaveBeenCalledWith('a', { species: 'Elephant', name: 'Updated', sex: 'Female', notes: 'note' });
  expect(screen.queryByText('Update Animal')).not.toBeInTheDocument();
  expect(screen.getByText('Name: Updated')).toBeInTheDocument();
});
test('[B2-SUI-12] failed edit remains open with user input', async () => {
  await ready(); api.updateAnimal.mockRejectedValue(new Error('offline')); fireEvent.click(screen.getByText('ELE009'));
  fireEvent.click(screen.getByRole('button', { name: 'Update', exact: true })); await screen.findByText('Failed to update animal: offline');
  expect(screen.getByText('Update Animal')).toBeInTheDocument(); expect(api.getAllAnimals).toHaveBeenCalledTimes(1);
});
test('[B2-SUI-13] cancelled edit issues no request', async () => {
  await ready(); fireEvent.click(screen.getByText('ELE009')); fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(api.updateAnimal).not.toHaveBeenCalled(); expect(screen.queryByText('Update Animal')).not.toBeInTheDocument();
});
test('[B2-SUI-14] cancelled deletion issues no request or edit action', async () => {
  await ready(); const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]); expect(confirm).toHaveBeenCalledOnce();
  expect(api.deleteAnimal).not.toHaveBeenCalled(); expect(screen.queryByText('Update Animal')).not.toBeInTheDocument();
});
test('[B2-SUI-15] confirmed delete reloads list and success message expires', async () => {
  await ready(); vi.useFakeTimers(); vi.spyOn(window, 'confirm').mockReturnValue(true);
  api.getAllAnimals.mockResolvedValueOnce({ data: [leopard] });
  await act(async () => fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]));
  expect(api.deleteAnimal).toHaveBeenCalledWith('a'); expect(api.getAllAnimals).toHaveBeenCalledTimes(2);
  expect(screen.getByText('Animal deleted successfully!')).toBeInTheDocument();
  expect(screen.queryByText('ELE009')).not.toBeInTheDocument(); expect(screen.getByText('Animals (1)')).toBeInTheDocument();
  await act(async () => vi.advanceTimersByTime(3000)); expect(screen.queryByText('Animal deleted successfully!')).not.toBeInTheDocument();
});
test('[B2-SUI-16] failed delete retains card and displays server message', async () => {
  await ready(); vi.spyOn(window, 'confirm').mockReturnValue(true); api.deleteAnimal.mockRejectedValue(new Error('constraint'));
  fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]); await screen.findByText('Failed to delete animal: constraint');
  expect(screen.getByText('ELE009')).toBeInTheDocument(); expect(api.getAllAnimals).toHaveBeenCalledTimes(1);
});
test('[B2-SUI-17] malformed non-array animal response shows a load error without crashing', async () => {
  const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {});
  api.getAllAnimals.mockResolvedValue({ data: {} }); render(<App />);
  expect(await screen.findByText('Failed to load animals')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Register Animal' })).toBeEnabled();
  expect(diagnostic).toHaveBeenCalledWith('Failed to load animals:', expect.any(Error));
});
test('[B2-SUI-18] list API failure is visible and does not invent animal cards', async () => {
  const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {}); const error = new Error('offline');
  api.getAllAnimals.mockRejectedValue(error); render(<App />); await screen.findByText('Failed to load animals');
  expect(screen.getByText('No animals registered yet')).toBeInTheDocument(); expect(diagnostic).toHaveBeenCalledWith('Failed to load animals:', error);
});
test('[B2-SUI-19] missing animal code fails safely before code generation can crash', async () => {
  const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {});
  api.getAllAnimals.mockResolvedValue({ data: [{ ...elephant, animalCode: null }] }); render(<App />);
  await screen.findByText('Failed to load animals');
  change(within(registration()).getAllByRole('combobox')[0], 'Elephant');
  expect(screen.getByPlaceholderText('Auto-generated when species selected')).toHaveValue('ELE001');
  expect(diagnostic).toHaveBeenCalledWith('Failed to load animals:', expect.any(Error));
});
test('[B2-SUI-20] malformed location coordinates show load error instead of toFixed crash', async () => {
  const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {});
  api.getAllAnimals.mockResolvedValue({ data: [{ ...elephant, locations: [{ latitude: null, longitude: 'invalid' }] }] }); render(<App />);
  await screen.findByText('Failed to load animals'); expect(screen.getByRole('button', { name: 'Register Animal' })).toBeEnabled();
  expect(diagnostic).toHaveBeenCalledWith('Failed to load animals:', expect.any(Error));
});
