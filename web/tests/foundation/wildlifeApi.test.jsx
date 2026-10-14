const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('axios', () => ({ default: { create: vi.fn(() => client) } }));
import * as sensors from '../../src/services/sensorApi';
import * as risks from '../../src/services/riskZoneApi';
beforeEach(() => vi.clearAllMocks());
test.each([
  ['01', sensors.getAllAnimals, '/sensors/animals'],
  ['02', sensors.getAnimalsWithLatestLocations, '/sensors/animals/locations'],
  ['03', sensors.getAnimalsNearHighRiskZones, '/sensors/animals/near-high-risk-zones'],
  ['04', risks.getAllRiskZones, '/risk-zones'],
])('[B2-WAPI-%s] read wrapper preserves its endpoint and unwraps response envelope', async (_id, method, path) => {
  const data = { success: true, data: [] }; client.get.mockResolvedValue({ data });
  expect(await method()).toBe(data); expect(client.get).toHaveBeenCalledWith(path);
});
test('[B2-WAPI-05] animal history preserves ID and date params', async () => {
  client.get.mockResolvedValue({ data: { data: [] } }); await sensors.getAnimalLocationsByDateRange('a', 'from', 'to');
  expect(client.get).toHaveBeenCalledWith('/sensors/animals/a/locations', { params: { startDate: 'from', endDate: 'to' } });
});
test('[B2-WAPI-06] all history preserves both dates', async () => {
  client.get.mockResolvedValue({ data: { data: [] } }); await sensors.getAllLocationsByDateRange('from', 'to');
  expect(client.get).toHaveBeenCalledWith('/sensors/locations', { params: { startDate: 'from', endDate: 'to' } });
});
test('[B2-WAPI-07] density defaults radius to 300 and preserves explicit radius', async () => {
  client.get.mockResolvedValue({ data: { data: [] } }); await sensors.getDensityZones('from', 'to'); await sensors.getDensityZones('from', 'to', 500);
  expect(client.get).toHaveBeenNthCalledWith(1, '/sensors/zones/density', { params: { startDate: 'from', endDate: 'to', radius: 300 } });
  expect(client.get).toHaveBeenNthCalledWith(2, '/sensors/zones/density', { params: { startDate: 'from', endDate: 'to', radius: 500 } });
});
test.each([
  ['08', risks.createRiskZone, 'post', '/risk-zones', [{ name: 'Waterhole' }]],
  ['09', risks.updateRiskZone, 'put', '/risk-zones/z', ['z', { riskLevel: 'CRITICAL' }]],
  ['10', risks.deleteRiskZone, 'delete', '/risk-zones/z', ['z']],
])('[B2-WAPI-%s] risk mutation preserves endpoint, payload and response envelope', async (_id, method, verb, path, args) => {
  const data = { success: true }; client[verb].mockResolvedValue({ data }); expect(await method(...args)).toBe(data);
  const body = verb === 'post' ? args[0] : verb === 'put' ? args[1] : null;
  expect(client[verb]).toHaveBeenCalledWith(...(body ? [path, body] : [path]));
});
test('[B2-WAPI-11] risk write failure propagates to form caller', async () => {
  const error = new Error('network denied'); client.post.mockRejectedValue(error); await expect(risks.createRiskZone({ name: 'Waterhole' })).rejects.toBe(error);
});
test('[B2-WAPI-12] wildlife query failure propagates without fabricated empty records', async () => {
  const error = new Error('timeout'); client.get.mockRejectedValue(error); await expect(sensors.getAllAnimals()).rejects.toBe(error);
});
