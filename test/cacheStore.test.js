'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { CacheStore } = require('../src/cache/cacheStore');

describe('CacheStore - Unit Tests', () => {
  test('1. Cache storage: stores values and exposes correct size', () => {
    const store = new CacheStore({ cleanupIntervalMs: 0 });
    assert.equal(store.size(), 0);

    const entry = store.set('user:1', { name: 'Alice' }, 10);
    assert.equal(store.size(), 1);
    assert.equal(entry.value.name, 'Alice');
    assert.ok(entry.createdAt <= Date.now());
    assert.ok(entry.expiresAt > Date.now());
    assert.equal(entry.ttl, 10);

    store.clear();
    assert.equal(store.size(), 0);
  });

  test('2. Cache retrieval: retrieves stored items and metadata correctly', () => {
    const store = new CacheStore({ cleanupIntervalMs: 0 });
    store.set('item:42', { title: 'Book' }, 60);

    const val = store.get('item:42');
    assert.deepEqual(val, { title: 'Book' });
    assert.equal(store.has('item:42'), true);

    const entry = store.getEntry('item:42');
    assert.ok(entry);
    assert.deepEqual(entry.value, { title: 'Book' });
    assert.equal(typeof entry.createdAt, 'number');
    assert.equal(typeof entry.expiresAt, 'number');

    // Non-existent key
    assert.equal(store.get('missing-key'), null);
    assert.equal(store.has('missing-key'), false);
    assert.equal(store.getEntry('missing-key'), null);

    store.clear();
  });

  test('3. TTL expiration: entry expires when TTL elapsed', async () => {
    const store = new CacheStore({ cleanupIntervalMs: 0 });
    // Set TTL of 0.05 seconds (50ms)
    store.set('quick:expire', 'temporary-data', 0.05);

    assert.equal(store.get('quick:expire'), 'temporary-data');

    // Wait 70ms for it to expire
    await new Promise((resolve) => setTimeout(resolve, 70));

    // Should return null after expiration
    assert.equal(store.get('quick:expire'), null);
    assert.equal(store.has('quick:expire'), false);
    assert.equal(store.getEntry('quick:expire'), null);

    store.clear();
  });

  test('4. Expired entry handling: lazy removal on access and manual pruning', async () => {
    const store = new CacheStore({ cleanupIntervalMs: 0 });
    store.set('k1', 'val1', 0.04);
    store.set('k2', 'val2', 10); // Not expired

    assert.equal(store.size(), 2);

    await new Promise((resolve) => setTimeout(resolve, 60));

    // Lazy removal: accessing k1 deletes it
    assert.equal(store.get('k1'), null);
    assert.equal(store.storage.has('k1'), false);

    // Add another expired entry without calling get()
    store.set('k3', 'val3', 0.02);
    await new Promise((resolve) => setTimeout(resolve, 40));

    // Periodic/manual sweep pruneExpired
    const pruned = store.pruneExpired();
    assert.equal(pruned, 1);
    assert.equal(store.storage.has('k3'), false);
    assert.equal(store.has('k2'), true); // Still present

    store.clear();
  });

  test('5. Cache deletion, keys, and validation', () => {
    const store = new CacheStore({ cleanupIntervalMs: 0 });
    store.set('a', 1);
    store.set('b', 2);

    assert.deepEqual(store.keys().sort(), ['a', 'b']);
    assert.equal(store.delete('a'), true);
    assert.equal(store.delete('a'), false);
    assert.equal(store.size(), 1);

    // Invalid key validation
    assert.throws(() => store.set('', 'val'), TypeError);
    assert.throws(() => store.set(123, 'val'), TypeError);

    store.clear();
  });

  test('6. Background sweep timer stops cleanly', () => {
    const store = new CacheStore({ cleanupIntervalMs: 500 });
    assert.ok(store.cleanupTimer);
    store.stopCleanup();
    assert.equal(store.cleanupTimer, null);
  });

  test('7. Cache metadata API: provides accurate timestamps and key information', () => {
    const store = new CacheStore({ cleanupIntervalMs: 0 });
    const startTime = Date.now();
    store.set('meta:key:1', { data: 'test' }, 45);

    const metadata = store.getMetadata('meta:key:1');
    assert.ok(metadata);
    assert.equal(metadata.key, 'meta:key:1');
    assert.ok(metadata.createdAt >= startTime);
    assert.equal(metadata.expiresAt, metadata.createdAt + (45 * 1000));
    assert.equal(metadata.ttl, 45);

    // Non-existent key returns null
    assert.equal(store.getMetadata('nonexistent'), null);

    store.clear();
  });

  test('8. Cache replacement: overwriting key updates value, TTL, and refreshed timestamps', async () => {
    const store = new CacheStore({ cleanupIntervalMs: 0 });
    store.set('replace:key', 'initial-value', 10);
    const meta1 = store.getMetadata('replace:key');

    // Wait a tiny bit (10ms) to ensure distinct millisecond timestamps
    await new Promise((resolve) => setTimeout(resolve, 15));

    store.set('replace:key', 'updated-value', 30);
    const meta2 = store.getMetadata('replace:key');

    assert.equal(store.get('replace:key'), 'updated-value');
    assert.ok(meta2.createdAt > meta1.createdAt);
    assert.ok(meta2.expiresAt > meta1.expiresAt);
    assert.equal(meta2.ttl, 30);
    assert.equal(store.size(), 1);

    store.clear();
  });

  test('9. Default 60-second TTL applies when TTL parameter is omitted', () => {
    const store = new CacheStore({ cleanupIntervalMs: 0 });
    store.set('default:ttl:key', 'default-val');

    const meta = store.getMetadata('default:ttl:key');
    assert.equal(meta.ttl, 60);
    assert.equal(meta.expiresAt, meta.createdAt + 60000);

    store.clear();
  });
});
