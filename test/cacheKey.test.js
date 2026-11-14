'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { defaultKeyGenerator, normalizeQueryString } = require('../src/cache/cacheKey');

describe('CacheKey - Unit Tests', () => {
  test('generates cache keys from method and URL', () => {
    const req = { method: 'GET', originalUrl: '/api/users' };
    const key = defaultKeyGenerator(req);
    assert.equal(key, 'GET:/api/users');
  });

  test('normalizes query parameter order deterministically', () => {
    const reqA = { method: 'GET', originalUrl: '/products?sort=asc&limit=10&page=2' };
    const reqB = { method: 'GET', originalUrl: '/products?limit=10&page=2&sort=asc' };
    const reqC = { method: 'GET', originalUrl: '/products?page=2&sort=asc&limit=10' };

    const keyA = defaultKeyGenerator(reqA);
    const keyB = defaultKeyGenerator(reqB);
    const keyC = defaultKeyGenerator(reqC);

    assert.equal(keyA, 'GET:/products?limit=10&page=2&sort=asc');
    assert.equal(keyA, keyB);
    assert.equal(keyB, keyC);
  });

  test('normalizes standalone query strings', () => {
    assert.equal(normalizeQueryString(''), '');
    assert.equal(normalizeQueryString(null), '');
    assert.equal(normalizeQueryString('b=2&a=1'), '?a=1&b=2');
    assert.equal(normalizeQueryString('?b=2&a=1'), '?a=1&b=2');
  });

  test('falls back to req.url or default when originalUrl is missing', () => {
    const req1 = { method: 'get', url: '/items' };
    assert.equal(defaultKeyGenerator(req1), 'GET:/items');

    const req2 = {};
    assert.equal(defaultKeyGenerator(req2), 'GET:/');
  });

  test('throws TypeError on invalid request object', () => {
    assert.throws(() => defaultKeyGenerator(null), TypeError);
    assert.throws(() => defaultKeyGenerator(undefined), TypeError);
    assert.throws(() => defaultKeyGenerator('string'), TypeError);
  });
});
