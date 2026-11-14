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
});
