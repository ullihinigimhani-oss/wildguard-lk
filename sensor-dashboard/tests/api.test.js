import { vi } from 'vitest';
const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('axios', () => ({ default: { create: vi.fn(() => client) } }));
import { addSensorData, createAnimal, getAllAnimals, updateAnimal, deleteAnimal } from '../src/services/api';
beforeEach(() => vi.clearAllMocks());
test.each([
  ['01', addSensorData, 'post', '/sensors', [{ animalCode: 'ELE001', latitude: 7.5, longitude: 80.7 }]],
  ['02', createAnimal, 'post', '/sensors/animals', [{ animalCode: 'ELE001', species: 'Elephant' }]],
  ['03', getAllAnimals, 'get', '/sensors/animals', []],
  ['04', updateAnimal, 'put', '/sensors/animals/a', ['a', { name: 'Nila' }]],
  ['05', deleteAnimal, 'delete', '/sensors/animals/a', ['a']],
])('[B2-SAPI-%s] actual API wrapper preserves route, payload and response envelope', async (_id, method, verb, path, args) => {
  const envelope = { success: true, data: { id: 'a' } }; client[verb].mockResolvedValue({ data: envelope });
  expect(await method(...args)).toBe(envelope);
  const body = verb === 'post' ? args[0] : verb === 'put' ? args[1] : undefined;
  expect(client[verb]).toHaveBeenCalledWith(...(body ? [path, body] : [path]));
});
test('[B2-SAPI-06] network failure propagates to dashboard rather than inventing success', async () => {
  const error = new Error('timeout'); client.post.mockRejectedValue(error);
  await expect(addSensorData({ animalCode: 'ELE001' })).rejects.toBe(error);
});
test('[B2-SAPI-07] malformed payload stays visible to UI validation', async () => {
  client.get.mockResolvedValue({ data: { data: {} } }); expect(await getAllAnimals()).toEqual({ data: {} });
});
