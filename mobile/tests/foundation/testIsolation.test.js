const http = require('node:http');
const net = require('node:net');

test('mobile fetch is blocked before contacting a service', async () => {
  await expect(fetch('https://example.test')).rejects.toThrow('TEST_NETWORK_BLOCKED');
});
test('mobile native XHR is blocked', () => {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', 'http://127.0.0.1:5000/api');
  expect(() => xhr.send()).toThrow('TEST_NETWORK_BLOCKED');
});
test('mobile Node transports cannot bypass isolation', () => {
  expect(() => http.get('http://example.test')).toThrow('TEST_NETWORK_BLOCKED');
  expect(() => net.connect(5432, '127.0.0.1')).toThrow('TEST_NETWORK_BLOCKED');
});
test('explicit mobile network mocks remain usable', async () => {
  const original = global.fetch;
  try {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    expect(await fetch('https://example.test')).toEqual({ ok: true });
  } finally { global.fetch = original; }
});
