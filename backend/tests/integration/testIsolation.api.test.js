const request = require('supertest');
const express = require('express');
const net = require('node:net');
const http = require('node:http');

test('Supertest can exercise a server opened in this test process', async () => {
  const app = express();
  app.get('/isolation', (_, res) => res.json({ isolated: true }));
  const result = await request(app).get('/isolation').expect(200);
  expect(result.body).toEqual({ isolated: true });
});
test('integration tests cannot access arbitrary localhost services or external hosts', () => {
  expect(() => net.connect(5432, '127.0.0.1')).toThrow('TEST_NETWORK_BLOCKED');
  expect(() => http.get('http://127.0.0.1:5000/api')).toThrow('TEST_NETWORK_BLOCKED');
  expect(() => http.get('http://example.test')).toThrow('TEST_NETWORK_BLOCKED');
});
test('integration fetch remains blocked even for localhost', async () => {
  await expect(fetch('http://127.0.0.1:5000/api')).rejects.toThrow('TEST_NETWORK_BLOCKED');
});
