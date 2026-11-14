import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSatiExpressApp } from '../../../backend/geminiProxyServer.js';

describe('Tier 2 - Feature 3: Server & Configuration Resilience', () => {
  it('T2-F3-01: Express app handles 20 concurrent requests without socket hangup', async () => {
    const app = createSatiExpressApp();
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const requests = Array.from({ length: 20 }, () =>
        fetch(`http://127.0.0.1:${port}/api/sati/health`).then(res => res.json())
      );
      const results = await Promise.all(requests);
      assert.equal(results.length, 20);
      results.forEach(res => assert.equal(res.ok, true));
    } finally {
      server.close();
    }
  });

  it('T2-F3-02: Malformed JSON payload to /api/sati/state is safely handled', async () => {
    const app = createSatiExpressApp();
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/sati/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ "invalid_json": '
      });
      // Should handle with 400 Bad Request
      assert.ok(res.status >= 400 && res.status < 500, 'Server should respond with client error');
    } finally {
      server.close();
    }
  });

  it('T2-F3-03: Missing GEMINI_API_KEY environment variable fallback resilience', async () => {
    const app = createSatiExpressApp();
    const server = app.listen(0);
    const port = server.address().port;
    const origKey = process.env.GEMINI_API_KEY;

    try {
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_API_KEY;
      const res = await fetch(`http://127.0.0.1:${port}/api/sati/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: 'ทดสอบ', cards: [] })
      });
      const data = await res.json();
      assert.equal(data.fallback, true, 'Must indicate offline fallback mode');
    } finally {
      if (origKey !== undefined) process.env.GEMINI_API_KEY = origKey;
      server.close();
    }
  });

  it('T2-F3-04: Server state endpoint GET and POST persists and retrieves user record', async () => {
    const app = createSatiExpressApp();
    const server = app.listen(0);
    const port = server.address().port;
    const testEmail = 'boundary_test@example.com';

    try {
      // POST state with record object
      const postRes = await fetch(`http://127.0.0.1:${port}/api/sati/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          record: {
            user: { fullname: 'ทดสอบ' },
            coins: 42
          }
        })
      });
      const postData = await postRes.json();
      assert.equal(postData.ok, true);

      // GET state
      const getRes = await fetch(`http://127.0.0.1:${port}/api/sati/state?email=${encodeURIComponent(testEmail)}`);
      const getData = await getRes.json();
      assert.ok(getData.record, 'Record should exist in db');
      assert.equal(getData.record.coins, 42);
    } finally {
      server.close();
    }
  });

  it('T2-F3-05: Missing email parameter on GET /api/sati/state returns 400', async () => {
    const app = createSatiExpressApp();
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/sati/state`);
      assert.equal(res.status, 400, 'Missing email query should return 400');
    } finally {
      server.close();
    }
  });
});
