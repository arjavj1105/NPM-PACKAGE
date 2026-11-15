'use strict';

/**
 * Validates and normalizes user-provided configuration options.
 *
 * @param {Object} [options={}] - Configuration options for cache or invalidation middleware.
 * @param {number} [options.ttl=60] - Time to live in seconds.
 * @param {boolean} [options.enabled=true] - Whether caching/invalidation is enabled.
 * @param {Function} [options.keyGenerator] - Custom function to derive cache keys from Express request.
 * @param {string|string[]|Function} [options.tags=[]] - Resource tags or tag resolver function.
 * @param {string[]} [options.methods] - HTTP methods to target (for invalidation middleware).
 * @param {Function} defaultKeyGenerator - Fallback key generator function.
 * @returns {Object} Normalized options object.
 */
function validateOptions(options = {}, defaultKeyGenerator) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Configuration options must be a plain object.');
  }

  const normalized = {};

  // 1. Validate 'ttl' (time to live in seconds)
  if (options.ttl !== undefined) {
    if (typeof options.ttl !== 'number' || !Number.isFinite(options.ttl) || options.ttl <= 0) {
      throw new RangeError('Option "ttl" must be a positive finite number greater than 0.');
    }
    normalized.ttl = Math.floor(options.ttl);
  } else {
    normalized.ttl = 60; // Default: 60 seconds
  }

  // 2. Validate 'enabled' (boolean toggle)
  if (options.enabled !== undefined) {
    if (typeof options.enabled !== 'boolean') {
      throw new TypeError('Option "enabled" must be a boolean.');
    }
    normalized.enabled = options.enabled;
  } else {
    normalized.enabled = true; // Default: enabled
  }

  // 3. Validate 'keyGenerator'
  if (options.keyGenerator !== undefined) {
    if (typeof options.keyGenerator !== 'function') {
      throw new TypeError('Option "keyGenerator" must be a function.');
    }
    normalized.keyGenerator = options.keyGenerator;
  } else {
    normalized.keyGenerator = defaultKeyGenerator;
  }

  // 4. Validate 'tags' (can be string, array of strings, or a function)
  if (options.tags !== undefined) {
    if (typeof options.tags === 'string') {
      normalized.tags = options.tags.trim() ? [options.tags.trim()] : [];
    } else if (Array.isArray(options.tags)) {
      for (const t of options.tags) {
        if (typeof t !== 'string') {
          throw new TypeError('Each element in "tags" must be a string.');
        }
      }
      normalized.tags = options.tags.map((t) => t.trim()).filter(Boolean);
    } else if (typeof options.tags === 'function') {
      normalized.tags = options.tags;
    } else {
      throw new TypeError('Option "tags" must be a string, array of strings, or a resolver function.');
    }
  } else {
    normalized.tags = [];
  }

  // 5. Validate 'methods' (applicable for invalidation middleware)
  if (options.methods !== undefined) {
    if (!Array.isArray(options.methods)) {
      throw new TypeError('Option "methods" must be an array of HTTP method strings.');
    }
    for (const m of options.methods) {
      if (typeof m !== 'string' || !m.trim()) {
        throw new TypeError('Each element in "methods" must be a non-empty string.');
      }
    }
    normalized.methods = options.methods.map((m) => m.trim().toUpperCase());
  } else {
    normalized.methods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  }

  return normalized;
}

module.exports = {
  validateOptions,
};
