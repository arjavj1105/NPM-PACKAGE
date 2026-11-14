'use strict';

/**
 * Validates and normalizes user-provided configuration options.
 *
 * @param {Object} [options={}] - Configuration options for cache middleware.
 * @param {number} [options.ttl=60] - Time to live in seconds.
 * @param {boolean} [options.enabled=true] - Whether caching is globally enabled.
 * @param {Function} [options.keyGenerator] - Custom function to derive cache keys from Express request.
 * @param {Function} defaultKeyGenerator - Fallback key generator function.
 * @returns {Object} Normalized options object.
 */
function validateOptions(options = {}, defaultKeyGenerator) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Configuration options must be a plain object.');
  }

  const normalized = {};

  // Validate 'ttl' (time to live in seconds)
  if (options.ttl !== undefined) {
    if (typeof options.ttl !== 'number' || !Number.isFinite(options.ttl) || options.ttl <= 0) {
      throw new RangeError('Option "ttl" must be a positive finite number greater than 0.');
    }
    normalized.ttl = Math.floor(options.ttl);
  } else {
    normalized.ttl = 60; // Default: 60 seconds
  }

  // Validate 'enabled' (boolean toggle)
  if (options.enabled !== undefined) {
    if (typeof options.enabled !== 'boolean') {
      throw new TypeError('Option "enabled" must be a boolean.');
    }
    normalized.enabled = options.enabled;
  } else {
    normalized.enabled = true; // Default: enabled
  }

  // Validate 'keyGenerator'
  if (options.keyGenerator !== undefined) {
    if (typeof options.keyGenerator !== 'function') {
      throw new TypeError('Option "keyGenerator" must be a function.');
    }
    normalized.keyGenerator = options.keyGenerator;
  } else {
    normalized.keyGenerator = defaultKeyGenerator;
  }

  return normalized;
}

module.exports = {
  validateOptions,
};
