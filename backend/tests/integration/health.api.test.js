const request = require('supertest');

jest.mock('../../src/config/database', () => ({ $queryRaw: jest.fn() }));

const prisma = require('../../src/config/database');
const app = require('../../src/app');

beforeEach(() => prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]));

test('GET /api/health returns HTTP 200 and the expected healthy JSON structure', async () => {
  const response = await request(app).get('/api/health').expect(200).expect('Content-Type', /json/);
  expect(response.body).toEqual({
    success: true,
    message: 'WildGuard LK API is running',
    database: 'connected',
  });
  expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  expect(prisma.$queryRaw.mock.calls[0][0]).toEqual(['SELECT 1']);
});

test('database failure returns HTTP 503 without leaking error details', async () => {
  prisma.$queryRaw.mockRejectedValueOnce(new Error('sensitive database connection details'));
  const response = await request(app).get('/api/health').expect(503);
  expect(response.body).toEqual({
    success: false,
    message: 'WildGuard LK API is running, but database connectivity is unavailable',
    database: 'disconnected',
  });
  expect(response.text).not.toContain('sensitive');
  await request(app).get('/api/health').expect(200);
});

test('CORS headers are enabled', async () => {
  await request(app).get('/api/health').set('Origin', 'http://localhost:5173')
    .expect('Access-Control-Allow-Origin', '*').expect(200);
});

test('unknown routes return a JSON 404', async () => {
  const response = await request(app).get('/api/unknown').expect(404);
  expect(response.body).toEqual({ success: false, message: 'Route not found' });
});

test('malformed JSON is handled centrally', async () => {
  const response = await request(app).post('/api/health')
    .set('Content-Type', 'application/json').send('{broken').expect(400);
  expect(response.body).toEqual({ success: false, message: 'Invalid request body' });
});
