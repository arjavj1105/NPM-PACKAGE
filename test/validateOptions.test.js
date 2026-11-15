'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { validateOptions } = require('../src/utils/validateOptions');
const { defaultKeyGenerator } = require('../src/cache/cacheKey');

describe('ValidateOptions - Unit Tests', () => {
  test('returns default options when empty object provided', () => {
    const opts = validateOptions({}, defaultKeyGenerator);
    assert.equal(opts.ttl, 60);
    assert.equal(opts.enabled, true);
    assert.equal(opts.keyGenerator, defaultKeyGenerator);
  });

  test('validates and accepts custom valid options', () => {
    const customKeyGen = (req) => `custom:${req.url}`;
    const opts = validateOptions(
      {
        ttl: 120,
        enabled: false,
        keyGenerator: customKeyGen,
      },
      defaultKeyGenerator
    );

    assert.equal(opts.ttl, 120);
    assert.equal(opts.enabled, false);
    assert.equal(opts.keyGenerator, customKeyGen);
  });

  test('throws TypeError if options is not a plain object', () => {
    assert.throws(() => validateOptions(null, defaultKeyGenerator), TypeError);
    assert.throws(() => validateOptions('string', defaultKeyGenerator), TypeError);
    assert.throws(() => validateOptions([1, 2], defaultKeyGenerator), TypeError);
  });

  test('throws RangeError if ttl is invalid', () => {
    assert.throws(() => validateOptions({ ttl: 0 }, defaultKeyGenerator), RangeError);
    assert.throws(() => validateOptions({ ttl: -10 }, defaultKeyGenerator), RangeError);
    assert.throws(() => validateOptions({ ttl: NaN }, defaultKeyGenerator), RangeError);
    assert.throws(() => validateOptions({ ttl: Infinity }, defaultKeyGenerator), RangeError);
    assert.throws(() => validateOptions({ ttl: '60' }, defaultKeyGenerator), RangeError);
  });

  test('throws TypeError if enabled is not a boolean', () => {
    assert.throws(() => validateOptions({ enabled: 'yes' }, defaultKeyGenerator), TypeError);
    assert.throws(() => validateOptions({ enabled: 1 }, defaultKeyGenerator), TypeError);
  });

  test('throws TypeError if keyGenerator is not a function', () => {
    assert.throws(() => validateOptions({ keyGenerator: 'func' }, defaultKeyGenerator), TypeError);
    assert.throws(() => validateOptions({ keyGenerator: {} }, defaultKeyGenerator), TypeError);
  });

  test('validates tags configuration', () => {
    // String tag normalized to array
    const opts1 = validateOptions({ tags: 'products' }, defaultKeyGenerator);
    assert.deepEqual(opts1.tags, ['products']);

    // Array of string tags
    const opts2 = validateOptions({ tags: ['products', 'item:1'] }, defaultKeyGenerator);
    assert.deepEqual(opts2.tags, ['products', 'item:1']);

    // Function tag resolver
    const fn = (req) => ['products'];
    const opts3 = validateOptions({ tags: fn }, defaultKeyGenerator);
    assert.equal(opts3.tags, fn);

    // Default is empty array
    const opts4 = validateOptions({}, defaultKeyGenerator);
    assert.deepEqual(opts4.tags, []);

    // Invalid tag types throw TypeError
    assert.throws(() => validateOptions({ tags: 123 }, defaultKeyGenerator), TypeError);
    assert.throws(() => validateOptions({ tags: [123] }, defaultKeyGenerator), TypeError);
  });

  test('validates methods configuration', () => {
    const opts = validateOptions({ methods: ['post', 'delete'] }, defaultKeyGenerator);
    assert.deepEqual(opts.methods, ['POST', 'DELETE']);

    const defaultOpts = validateOptions({}, defaultKeyGenerator);
    assert.deepEqual(defaultOpts.methods, ['POST', 'PUT', 'PATCH', 'DELETE']);

    assert.throws(() => validateOptions({ methods: 'POST' }, defaultKeyGenerator), TypeError);
    assert.throws(() => validateOptions({ methods: [123] }, defaultKeyGenerator), TypeError);
  });
});
