import http from 'node:http';
import net from 'node:net';
import axios from 'axios';

test('frontend fetch is rejected before sending a request', async () => {
  await expect(fetch('https://example.test')).rejects.toThrow('TEST_NETWORK_BLOCKED');
});
test('frontend XMLHttpRequest and Axios cannot reach even localhost', async () => {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', 'http://127.0.0.1:5000/api');
  expect(() => xhr.send()).toThrow('TEST_NETWORK_BLOCKED');
  await expect(axios.get('http://127.0.0.1:5000/api')).rejects.toThrow('TEST_NETWORK_BLOCKED');
});
test('frontend Node transports cannot bypass the browser guard', () => {
  expect(() => http.get('https://example.test')).toThrow('TEST_NETWORK_BLOCKED');
  expect(() => net.connect(5432, '127.0.0.1')).toThrow('TEST_NETWORK_BLOCKED');
});
test('explicit fetch mocks still support deterministic success scenarios', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = vi.fn().mockResolvedValue({ json: async () => ({ success: true }) });
    expect(await (await fetch('https://example.test')).json()).toEqual({ success: true });
  } finally { globalThis.fetch = original; }
});
