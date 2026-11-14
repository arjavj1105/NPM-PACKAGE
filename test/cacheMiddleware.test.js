'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const express = require('express');
const cache = require('../src');
const demoApp = require('../examples/server');

describe('CacheMiddleware - Integration Tests', () => {
  test('6. Cache MISS: sets X-Cache MISS on first request and caches response', async () => {
    const app = express();
    let handlerExecutionCount = 0;

    app.get(
      '/test-cache',
      cache({ ttl: 10 }),
      (req, res) => {
        handlerExecutionCount++;
        res.status(200).json({ timestamp: Date.now(), count: handlerExecutionCount });
      }
    );

    const res1 = await request(app).get('/test-cache');

    assert.equal(res1.status, 200);
    assert.equal(res1.headers['x-cache'], 'MISS');
    assert.equal(res1.body.count, 1);
    assert.equal(handlerExecutionCount, 1);
  });

  test('7. Cache HIT: returns cached body, headers, and sets X-Cache HIT on subsequent request', async () => {
    const app = express();
    let handlerExecutionCount = 0;

    app.get(
      '/test-hit',
      cache({ ttl: 10 }),
      (req, res) => {
        handlerExecutionCount++;
        res.status(200).json({ execution: handlerExecutionCount });
      }
    );

    // First request: MISS
    const res1 = await request(app).get('/test-hit');
    assert.equal(res1.headers['x-cache'], 'MISS');
    assert.equal(res1.body.execution, 1);
    assert.equal(handlerExecutionCount, 1);

    // Second request: HIT
    const res2 = await request(app).get('/test-hit');
    assert.equal(res2.headers['x-cache'], 'HIT');
    assert.ok(res2.headers['x-cache-timestamp']);
    assert.equal(res2.body.execution, 1); // Exact cached body returned
    assert.equal(handlerExecutionCount, 1); // Handler was NOT executed again!
  });

  test('does not cache non-GET requests', async () => {
    const app = express();
    app.use(express.json());
    let postExecutionCount = 0;

    app.post(
      '/test-post',
      cache({ ttl: 10 }),
      (req, res) => {
        postExecutionCount++;
        res.status(201).json({ created: true, count: postExecutionCount });
      }
    );

    const res1 = await request(app).post('/test-post').send({ name: 'Widget' });
    assert.equal(res1.status, 201);
    assert.equal(res1.headers['x-cache'], undefined);

    const res2 = await request(app).post('/test-post').send({ name: 'Widget' });
    assert.equal(res2.status, 201);
    assert.equal(res2.headers['x-cache'], undefined);
    assert.equal(postExecutionCount, 2); // Executed both times
  });

  test('does not cache error or non-2xx responses (e.g. 404, 500)', async () => {
    const app = express();
    let count404 = 0;

    app.get(
      '/not-found',
      cache({ ttl: 10 }),
      (req, res) => {
        count404++;
        res.status(404).json({ error: 'Item not found', attempt: count404 });
      }
    );

    const res1 = await request(app).get('/not-found');
    assert.equal(res1.status, 404);
    assert.equal(res1.headers['x-cache'], 'MISS');
    assert.equal(res1.body.attempt, 1);

    const res2 = await request(app).get('/not-found');
    assert.equal(res2.status, 404);
    assert.equal(res2.headers['x-cache'], 'MISS'); // Still MISS because 404 was not saved
    assert.equal(res2.body.attempt, 2);
    assert.equal(count404, 2);
  });

  test('bypasses cache when enabled: false', async () => {
    const app = express();
    let callCount = 0;

    app.get(
      '/disabled',
      cache({ enabled: false }),
      (req, res) => {
        callCount++;
        res.status(200).json({ call: callCount });
      }
    );

    const res1 = await request(app).get('/disabled');
    assert.equal(res1.headers['x-cache'], undefined);
    assert.equal(res1.body.call, 1);

    const res2 = await request(app).get('/disabled');
    assert.equal(res2.headers['x-cache'], undefined);
    assert.equal(res2.body.call, 2);
    assert.equal(callCount, 2);
  });

  test('supports custom keyGenerator', async () => {
    const app = express();
    let callCount = 0;

    // Custom key generator that keys off a header rather than query string
    const customKeyGen = (req) => `auth-user:${req.headers['x-user-id'] || 'anonymous'}`;

    app.get(
      '/custom-key-test',
      cache({ keyGenerator: customKeyGen }),
      (req, res) => {
        callCount++;
        res.status(200).json({ call: callCount });
      }
    );

    // First request with user-123 -> MISS
    const res1 = await request(app).get('/custom-key-test').set('x-user-id', 'user-123');
    assert.equal(res1.headers['x-cache'], 'MISS');
    assert.equal(res1.body.call, 1);

    // Second request with same user-123 -> HIT
    const res2 = await request(app).get('/custom-key-test').set('x-user-id', 'user-123');
    assert.equal(res2.headers['x-cache'], 'HIT');
    assert.equal(res2.body.call, 1);

    // Third request with different user -> MISS
    const res3 = await request(app).get('/custom-key-test').set('x-user-id', 'user-456');
    assert.equal(res3.headers['x-cache'], 'MISS');
    assert.equal(res3.body.call, 2);
  });

  test('works seamlessly with demonstration application', async () => {
    // 1. GET /products (First call -> MISS)
    const resProducts1 = await request(demoApp).get('/products');
    assert.equal(resProducts1.status, 200);
    assert.equal(resProducts1.headers['x-cache'], 'MISS');
    assert.ok(Array.isArray(resProducts1.body.data));

    // 2. GET /products (Second call -> HIT)
    const resProducts2 = await request(demoApp).get('/products');
    assert.equal(resProducts2.status, 200);
    assert.equal(resProducts2.headers['x-cache'], 'HIT');
    assert.deepEqual(resProducts2.body, resProducts1.body);

    // 3. GET /products/1 (First call -> MISS)
    const resItem1 = await request(demoApp).get('/products/1');
    assert.equal(resItem1.status, 200);
    assert.equal(resItem1.headers['x-cache'], 'MISS');
    assert.equal(resItem1.body.data.id, 1);

    // 4. GET /products/1 (Second call -> HIT)
    const resItem2 = await request(demoApp).get('/products/1');
    assert.equal(resItem2.status, 200);
    assert.equal(resItem2.headers['x-cache'], 'HIT');
    assert.deepEqual(resItem2.body, resItem1.body);

    // 5. GET /products/999 (Non-existent -> 404 MISS and not cached)
    const resNotFound1 = await request(demoApp).get('/products/999');
    assert.equal(resNotFound1.status, 404);
    assert.equal(resNotFound1.headers['x-cache'], 'MISS');

    const resNotFound2 = await request(demoApp).get('/products/999');
    assert.equal(resNotFound2.status, 404);
    assert.equal(resNotFound2.headers['x-cache'], 'MISS');
  });
});
