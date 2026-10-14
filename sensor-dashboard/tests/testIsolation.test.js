import net from 'node:net';
test('sensor test fetch cannot reach the real backend', async () => {
  await expect(fetch('http://127.0.0.1:5000/api/sensors')).rejects.toThrow('TEST_NETWORK_BLOCKED');
});
test('sensor test XMLHttpRequest cannot reach the real backend', () => {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', 'http://127.0.0.1:5000/api/sensors');
  expect(() => xhr.send('{}')).toThrow('TEST_NETWORK_BLOCKED');
});
test('sensor tests cannot open database sockets', () => {
  expect(() => net.connect(5432, '127.0.0.1')).toThrow('TEST_NETWORK_BLOCKED');
});
