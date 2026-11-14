'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const cache = require('../src');

describe('Package Exports - Smoke Tests', () => {
  test('exports middleware factory as main function and named exports', () => {
    assert.equal(typeof cache, 'function');
    assert.equal(typeof cache.createCacheMiddleware, 'function');
    assert.equal(typeof cache.CacheStore, 'function');
    assert.equal(typeof cache.defaultKeyGenerator, 'function');
    assert.equal(typeof cache.createCache, 'function');
  });

  test('cache.createCache returns both middleware and store instance', () => {
    const { middleware, store } = cache.createCache({ ttl: 45 });
    assert.equal(typeof middleware, 'function');
    assert.ok(store instanceof cache.CacheStore);
    assert.equal(store.defaultTtl, 45);
    store.stopCleanup();
  });
});
