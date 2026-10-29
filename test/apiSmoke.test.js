const test = require('node:test');
const assert = require('node:assert/strict');
const session = require('express-session');
const { createApp } = require('../backend/server');

test('API reports session state and protects personal journal routes', async (t) => {
  assert.equal(createApp.length, 1, 'createApp should accept an isolated session-store option');
  const app = createApp({ sessionStore: new session.MemoryStore() });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const health = await fetch(`${baseUrl}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });

  const auth = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(auth.status, 200);
  assert.deepEqual(await auth.json(), { authenticated: false, user: null });

  const protectedRequest = await fetch(`${baseUrl}/api/entries`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(protectedRequest.status, 401);
  assert.equal((await protectedRequest.json()).error.code, 'AUTH_REQUIRED');

  for (const path of ['/api/community/users?q=mai', '/api/community/draft', '/api/community/events']) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 401, `${path} requires authentication`);
    assert.equal((await response.json()).error.code, 'AUTH_REQUIRED');
  }

  const invalidRegister = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'a', password: '123' })
  });
  assert.equal(invalidRegister.status, 400);
  assert.equal((await invalidRegister.json()).error.code, 'VALIDATION_ERROR');

  const invalidLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  assert.equal(invalidLogin.status, 400);
  assert.equal((await invalidLogin.json()).error.code, 'VALIDATION_ERROR');
});
