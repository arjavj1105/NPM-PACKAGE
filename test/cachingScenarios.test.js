'use strict';

const { test, describe, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const express = require('express');
const cache = require('../src');
const demoApp = require('../examples/server');

describe('Commit 02 — Core Caching Comprehensive Scenarios', () => {
  // Scenario 1: GET /products first request
  test('Scenario 1: GET /products first request produces a cache MISS', async () => {
    // Unique query param to ensure fresh key in demoApp
    const res = await request(demoApp).get('/products?s=s1');
    assert.equal(res.status, 200);
    assert.equal(res.headers['x-cache'], 'MISS');
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
  });

  // Scenario 2: GET /products repeated request
  test('Scenario 2: GET /products repeated request produces a cache HIT', async () => {
    const res1 = await request(demoApp).get('/products?s=s2');
    assert.equal(res1.headers['x-cache'], 'MISS');

    const res2 = await request(demoApp).get('/products?s=s2');
    assert.equal(res2.status, 200);
    assert.equal(res2.headers['x-cache'], 'HIT');
    assert.ok(res2.headers['x-cache-timestamp']);
    assert.deepEqual(res2.body, res1.body);
  });

  // Scenario 3: GET /products/:id first request
  test('Scenario 3: GET /products/:id first request produces a cache MISS', async () => {
    const res = await request(demoApp).get('/products/2?s=s3');
    assert.equal(res.status, 200);
    assert.equal(res.headers['x-cache'], 'MISS');
    assert.equal(res.body.data.id, 2);
  });

  // Scenario 4: GET /products/:id repeated request
  test('Scenario 4: GET /products/:id repeated request produces a cache HIT', async () => {
    const res1 = await request(demoApp).get('/products/2?s=s4');
    assert.equal(res1.headers['x-cache'], 'MISS');

    const res2 = await request(demoApp).get('/products/2?s=s4');
    assert.equal(res2.status, 200);
    assert.equal(res2.headers['x-cache'], 'HIT');
    assert.deepEqual(res2.body, res1.body);
  });

  // Scenario 5: Different product IDs have separate cache entries
  test('Scenario 5: Different product IDs maintain separate cache entries', async () => {
    const resProduct1 = await request(demoApp).get('/products/1?s=s5');
    const resProduct2 = await request(demoApp).get('/products/2?s=s5');

    assert.equal(resProduct1.body.data.id, 1);
    assert.equal(resProduct2.body.data.id, 2);
    assert.notEqual(resProduct1.body.data.name, resProduct2.body.data.name);

    // Repeated calls both HIT their respective distinct cache entries
    const hit1 = await request(demoApp).get('/products/1?s=s5');
    const hit2 = await request(demoApp).get('/products/2?s=s5');

    assert.equal(hit1.headers['x-cache'], 'HIT');
    assert.equal(hit2.headers['x-cache'], 'HIT');
    assert.equal(hit1.body.data.id, 1);
    assert.equal(hit2.body.data.id, 2);
  });

  // Scenario 6: Different query parameters generate appropriate distinct cache entries
  test('Scenario 6: Different query parameters generate separate cache entries', async () => {
    const resElectronics = await request(demoApp).get('/products?category=Electronics');
    const resLifestyle = await request(demoApp).get('/products?category=Lifestyle');

    assert.equal(resElectronics.status, 200);
    assert.equal(resLifestyle.status, 200);

    assert.ok(resElectronics.body.data.every((p) => p.category === 'Electronics'));
    assert.ok(resLifestyle.body.data.every((p) => p.category === 'Lifestyle'));
    assert.notEqual(resElectronics.body.count, resLifestyle.body.count);

    // Repeated query for Electronics is a HIT
    const hitElectronics = await request(demoApp).get('/products?category=Electronics');
    assert.equal(hitElectronics.headers['x-cache'], 'HIT');
    assert.deepEqual(hitElectronics.body, resElectronics.body);
  });

  // Scenario 7: Query parameter ordering does not create duplicate entries
  test('Scenario 7: Query parameter ordering normalizes to identical cache entry', async () => {
    // Query order A
    const resA = await request(demoApp).get('/products?category=Electronics&inStock=true');
    assert.equal(resA.headers['x-cache'], 'MISS');

    // Query order B (reversed params)
    const resB = await request(demoApp).get('/products?inStock=true&category=Electronics');
    assert.equal(resB.headers['x-cache'], 'HIT');
    assert.deepEqual(resB.body, resA.body);
  });

  // Scenario 8: Default 60-second TTL configuration
  test('Scenario 8: Default 60-second TTL configuration via controlled clock', () => {
    const store = new cache.CacheStore({ cleanupIntervalMs: 0 });
    const fixedNow = 1700000000000;

    mock.timers.enable({ apis: ['Date'] });
    mock.timers.setTime(fixedNow);

    store.set('default-ttl-test', { msg: 'default-ttl' });
    const meta = store.getMetadata('default-ttl-test');

    assert.equal(meta.ttl, 60);
    assert.equal(meta.createdAt, fixedNow);
    assert.equal(meta.expiresAt, fixedNow + 60000);

    // Advance 59 seconds: entry must still be valid
    mock.timers.tick(59000);
    assert.ok(store.get('default-ttl-test'));

    // Advance 1 more second (total 60s): entry must expire
    mock.timers.tick(1000);
    assert.equal(store.get('default-ttl-test'), null);

    mock.timers.reset();
    store.clear();
  });

  // Scenario 9: Custom TTL configuration
  test('Scenario 9: Custom TTL configuration via controlled clock', () => {
    const store = new cache.CacheStore({ cleanupIntervalMs: 0 });
    const fixedNow = 1700000000000;

    mock.timers.enable({ apis: ['Date'] });
    mock.timers.setTime(fixedNow);

    // Custom TTL = 15 seconds
    store.set('custom-ttl-test', { msg: 'custom-ttl' }, 15);
    const meta = store.getMetadata('custom-ttl-test');

    assert.equal(meta.ttl, 15);
    assert.equal(meta.createdAt, fixedNow);
    assert.equal(meta.expiresAt, fixedNow + 15000);

    // At 14 seconds: still valid
    mock.timers.tick(14000);
    assert.ok(store.get('custom-ttl-test'));

    // At 15 seconds: expired
    mock.timers.tick(1000);
    assert.equal(store.get('custom-ttl-test'), null);

    mock.timers.reset();
    store.clear();
  });

  // Scenario 10: Cache expiration causes automatic removal and refetch
  test('Scenario 10: Cache expiration serves fresh MISS after TTL expires', () => {
    const app = express();
    const { middleware, store } = cache.createCache({ ttl: 10 });
    let runCount = 0;

    app.get('/expiring-endpoint', middleware, (req, res) => {
      runCount++;
      res.status(200).json({ run: runCount });
    });

    const fixedNow = 1700000000000;
    mock.timers.enable({ apis: ['Date'] });
    mock.timers.setTime(fixedNow);

    return (async () => {
      // 1. Initial request -> MISS
      const res1 = await request(app).get('/expiring-endpoint');
      assert.equal(res1.headers['x-cache'], 'MISS');
      assert.equal(res1.body.run, 1);

      // 2. Request at +5s -> HIT
      mock.timers.tick(5000);
      const res2 = await request(app).get('/expiring-endpoint');
      assert.equal(res2.headers['x-cache'], 'HIT');
      assert.equal(res2.body.run, 1);

      // 3. Advance past TTL (+11s total) -> Expired and refetched (MISS)
      mock.timers.tick(6000);
      const res3 = await request(app).get('/expiring-endpoint');
      assert.equal(res3.headers['x-cache'], 'MISS');
      assert.equal(res3.body.run, 2);

      mock.timers.reset();
      store.stopCleanup();
    })();
  });

  // Scenario 11: Cache metadata timestamps accuracy
  test('Scenario 11: Cache metadata stores accurate timestamps in consistent format', () => {
    const store = new cache.CacheStore({ cleanupIntervalMs: 0 });
    const now = Date.now();
    store.set('meta:check', { text: 'hello' }, 30);

    const meta = store.getMetadata('meta:check');
    assert.ok(meta);
    assert.equal(meta.key, 'meta:check');
    assert.equal(typeof meta.createdAt, 'number');
    assert.equal(typeof meta.expiresAt, 'number');
    assert.equal(typeof meta.ttl, 'number');
    assert.ok(meta.createdAt >= now);
    assert.equal(meta.expiresAt, meta.createdAt + 30000);
    assert.equal(meta.ttl, 30);

    store.clear();
  });

  // Scenario 12: Cache replacement refreshes timestamps
  test('Scenario 12: Cache replacement updates payload and timestamps correctly', async () => {
    const store = new cache.CacheStore({ cleanupIntervalMs: 0 });
    store.set('key:replace', 'v1', 20);
    const meta1 = store.getMetadata('key:replace');

    await new Promise((resolve) => setTimeout(resolve, 15));

    store.set('key:replace', 'v2', 40);
    const meta2 = store.getMetadata('key:replace');

    assert.equal(store.get('key:replace'), 'v2');
    assert.ok(meta2.createdAt > meta1.createdAt);
    assert.ok(meta2.expiresAt > meta1.expiresAt);
    assert.equal(meta2.ttl, 40);

    store.clear();
  });

  // Scenario 13: Cache HIT and MISS headers verification
  test('Scenario 13: Cache response headers strictly set X-Cache and X-Cache-Timestamp', async () => {
    const app = express();
    app.get('/headers-check', cache({ ttl: 20 }), (req, res) => {
      res.status(200).send('plain text response');
    });

    const res1 = await request(app).get('/headers-check');
    assert.equal(res1.headers['x-cache'], 'MISS');
    assert.equal(res1.headers['x-cache-timestamp'], undefined);

    const res2 = await request(app).get('/headers-check');
    assert.equal(res2.headers['x-cache'], 'HIT');
    assert.ok(res2.headers['x-cache-timestamp']);
    assert.equal(new Date(res2.headers['x-cache-timestamp']).toString() !== 'Invalid Date', true);
  });

  // Scenario 14: Error responses (4xx, 5xx) are never cached
  test('Scenario 14: Error responses (4xx, 5xx) are never cached', async () => {
    const app = express();
    let codeToReturn = 400;

    app.get('/error-route', cache({ ttl: 60 }), (req, res) => {
      res.status(codeToReturn).json({ status: codeToReturn });
    });

    // 400 Bad Request
    const res400A = await request(app).get('/error-route');
    assert.equal(res400A.status, 400);
    assert.equal(res400A.headers['x-cache'], 'MISS');

    const res400B = await request(app).get('/error-route');
    assert.equal(res400B.status, 400);
    assert.equal(res400B.headers['x-cache'], 'MISS');

    // 500 Server Error
    codeToReturn = 500;
    const res500A = await request(app).get('/error-route');
    assert.equal(res500A.status, 500);
    assert.equal(res500A.headers['x-cache'], 'MISS');

    const res500B = await request(app).get('/error-route');
    assert.equal(res500B.status, 500);
    assert.equal(res500B.headers['x-cache'], 'MISS');
  });

  // Scenario 15: Cache-disabled configuration
  test('Scenario 15: Cache-disabled configuration bypasses caching completely', async () => {
    const app = express();
    let hits = 0;

    app.get('/disabled-test', cache({ enabled: false }), (req, res) => {
      hits++;
      res.status(200).json({ hits });
    });

    const res1 = await request(app).get('/disabled-test');
    assert.equal(res1.headers['x-cache'], undefined);
    assert.equal(res1.body.hits, 1);

    const res2 = await request(app).get('/disabled-test');
    assert.equal(res2.headers['x-cache'], undefined);
    assert.equal(res2.body.hits, 2);
    assert.equal(hits, 2);
  });

  // Scenario 16: Concurrent requests where relevant
  test('Scenario 16: Concurrent requests execute safely without corrupted state', async () => {
    const app = express();
    let counter = 0;

    app.get('/concurrent-scenario', cache({ ttl: 30 }), (req, res) => {
      counter++;
      setTimeout(() => {
        res.status(200).json({ counter });
      }, 10);
    });

    // Fire 5 requests simultaneously
    const requests = await Promise.all([
      request(app).get('/concurrent-scenario'),
      request(app).get('/concurrent-scenario'),
      request(app).get('/concurrent-scenario'),
      request(app).get('/concurrent-scenario'),
      request(app).get('/concurrent-scenario'),
    ]);

    for (const r of requests) {
      assert.equal(r.status, 200);
      assert.ok(r.body.counter >= 1);
    }

    // Following request immediately hits cache
    const finalReq = await request(app).get('/concurrent-scenario');
    assert.equal(finalReq.status, 200);
    assert.equal(finalReq.headers['x-cache'], 'HIT');
  });
});
