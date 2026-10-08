jest.mock('../../../src/services/auth.service', () => ({ authenticate: jest.fn() }));
const service = require('../../../src/services/auth.service');
const authenticate = require('../../../src/middleware/auth.middleware');

describe('authentication middleware secret-safe logging', () => {
  let logs;
  beforeEach(() => {
    jest.clearAllMocks();
    service.authenticate.mockReset();
    logs = ['log', 'info', 'warn', 'error', 'debug'].map(method =>
      jest.spyOn(console, method).mockImplementation(() => {}));
  });
  afterEach(() => jest.restoreAllMocks());

  test.each(['success', 'missing', 'failure'])('%s never logs headers, tokens or raw authentication errors', async outcome => {
    const token = 'sensitive-test-token';
    const headers = { Authorization: `Bearer ${token}`, Cookie: 'sensitive-test-cookie' };
    const req = { method: 'GET', path: '/me', headers,
      get: jest.fn(() => outcome === 'missing' ? undefined : headers.Authorization) };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    const error = new Error(`Untrusted authentication error containing ${token}`);
    if (outcome === 'failure') service.authenticate.mockRejectedValueOnce(error);
    else service.authenticate.mockResolvedValueOnce({ id: 'ranger-test' });
    await authenticate(req, res, next);
    for (const logger of logs) expect(logger).not.toHaveBeenCalled();
    if (outcome === 'missing') {
      expect(res.status).toHaveBeenCalledWith(401);
      expect(service.authenticate).not.toHaveBeenCalled();
    } else if (outcome === 'failure') expect(next).toHaveBeenCalledWith(error);
    else {
      expect(service.authenticate).toHaveBeenCalledWith(token);
      expect(req.user).toEqual({ id: 'ranger-test' });
      expect(next).toHaveBeenCalledWith();
    }
  });
});
