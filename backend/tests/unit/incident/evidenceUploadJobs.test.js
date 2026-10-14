let jobs, uuid;
beforeEach(() => {
  jest.useFakeTimers(); jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  let sequence = 0;
  uuid = jest.spyOn(require('node:crypto'), 'randomUUID')
    .mockImplementation(() => '00000000-0000-4000-8000-' + String(++sequence).padStart(12, '0'));
  jest.isolateModules(() => { jobs = require('../../../src/services/evidenceUploadJobs'); });
});
afterEach(() => { uuid.mockRestore(); jest.useRealTimers(); });
test('[B1-JOB-01] receipt starts processing and binds incident, owner and request', () => {
  const job = jobs.create('i', 'r', 'request');
  expect(job).toMatchObject({ incidentId: 'i', ownerId: 'r', requestId: 'request', status: 'PROCESSING', stage: 'media_validated' });
  expect(jobs.find(job.id, 'i', 'r')).toBe(job);
});
test.each([['B1-JOB-02', 'other', 'r'], ['B1-JOB-03', 'i', 'other']])(
  '[%s] receipt cannot be read through incident %s and owner %s', (_id, incident, owner) => {
    const job = jobs.create('i', 'r', 'request');
    expect(() => jobs.find(job.id, incident, owner)).toThrow(expect.objectContaining({ status: 404, code: 'UPLOAD_RECEIPT_UNAVAILABLE' }));
  });
test('[B1-JOB-04] unknown receipt returns the same unavailable error', () => {
  expect(() => jobs.find('missing', 'i', 'r')).toThrow(expect.objectContaining({ status: 404, code: 'UPLOAD_RECEIPT_UNAVAILABLE' }));
});
test('[B1-JOB-05] 100 receipts are accepted and receipt 101 is rejected', () => {
  const receipts = Array.from({ length: 100 }, () => jobs.create('i', 'r', 'request'));
  expect(new Set(receipts.map(row => row.id)).size).toBe(100);
  expect(() => jobs.create('i', 'r', 'request')).toThrow(expect.objectContaining({ status: 429, code: 'UPLOAD_BUSY' }));
  expect(jobs.find(receipts[99].id, 'i', 'r')).toBe(receipts[99]);
});
test('[B1-JOB-06] completed receipt lives exactly ten minutes and expires one ms later', () => {
  const job = jobs.create('i', 'r', 'request'); jobs.complete(job, { id: 'e', fileUrl: null });
  jest.advanceTimersByTime(600000);
  expect(jobs.find(job.id, 'i', 'r')).toMatchObject({ status: 'COMPLETE', evidence: { id: 'e', fileUrl: null } });
  jest.advanceTimersByTime(1);
  expect(() => jobs.find(job.id, 'i', 'r')).toThrow('Upload receipt expired');
});
test('[B1-JOB-07] pruning finished receipts frees capacity without expiring processing jobs', () => {
  const rows = Array.from({ length: 100 }, () => jobs.create('i', 'r', 'request'));
  jobs.complete(rows[0], { id: 'e' }); jest.advanceTimersByTime(600001);
  expect(jobs.create('i', 'r', 'new')).toMatchObject({ status: 'PROCESSING' });
  expect(jobs.find(rows[1].id, 'i', 'r').status).toBe('PROCESSING');
});
test('[B1-JOB-08] unknown error becomes a safe retryable failure without provider details', () => {
  const job = jobs.create('i', 'r', 'request'); jobs.fail(job, new Error('fixture-private-provider-url'));
  expect(job).toMatchObject({ status: 'FAILED', error: { status: 503, code: 'EVIDENCE_SAVE_FAILED' } });
  expect(JSON.stringify(job)).not.toContain('fixture-private-provider-url');
  expect(job.error.message).toContain('incident remains saved');
});
test('[B1-JOB-09] known errors retain status and code but never raw messages', () => {
  const job = jobs.create('i', 'r', 'request');
  jobs.fail(job, Object.assign(new Error('fixture-sensitive'), { evidenceError: true, status: 409, code: 'INCIDENT_WITHDRAWN' }));
  expect(job.error).toMatchObject({ status: 409, code: 'INCIDENT_WITHDRAWN' });
  expect(JSON.stringify(job)).not.toContain('fixture-sensitive');
  jest.advanceTimersByTime(600001);
  expect(() => jobs.find(job.id, 'i', 'r')).toThrow('Upload receipt expired');
});
