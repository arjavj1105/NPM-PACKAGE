'use strict';

const { CacheStore } = require('../cache/cacheStore');
const { defaultKeyGenerator } = require('../cache/cacheKey');
const { validateOptions } = require('../utils/validateOptions');

/**
 * Creates an Express caching middleware instance.
 *
 * @param {Object} [options={}] - Configuration options for caching.
 * @param {number} [options.ttl=60] - Expiration time in seconds.
 * @param {boolean} [options.enabled=true] - Toggle caching on or off.
 * @param {Function} [options.keyGenerator] - Custom request-to-key mapping function.
 * @param {CacheStore} [options.store] - Optional custom CacheStore instance.
 * @returns {import('express').RequestHandler} Express middleware function.
 */
function createCacheMiddleware(options = {}) {
  const store = options.store instanceof CacheStore
    ? options.store
    : new CacheStore({ defaultTtl: options.ttl || 60 });

  const config = validateOptions(options, defaultKeyGenerator);

  /**
   * Express middleware handler.
   */
  return function cacheMiddleware(req, res, next) {
    // 1. Bypass if caching is disabled
    if (!config.enabled) {
      return next();
    }

    // 2. Only cache eligible GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // 3. Derive cache key safely
    let key;
    try {
      key = config.keyGenerator(req);
    } catch (err) {
      // If key generation fails, fall back to next handler safely without crashing
      return next();
    }

    // 4. Check for cache HIT
    try {
      const cached = store.getEntry(key);

      if (cached && cached.value) {
        const { body, statusCode, headers } = cached.value;

        // Add cache indicator headers
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Timestamp', new Date(cached.createdAt).toISOString());

        // Restore cached content-type if present
        if (headers && headers['content-type']) {
          res.setHeader('Content-Type', headers['content-type']);
        }

        // Return cached status and response body
        return res.status(statusCode || 200).send(body);
      }
    } catch (err) {
      // Safe fallback if retrieval encounters an unexpected issue
      return next();
    }

    // 5. Handle cache MISS: Mark MISS header and intercept response
    res.setHeader('X-Cache', 'MISS');

    const originalSend = res.send;

    res.send = function interceptSend(body) {
      // Restore original res.send to prevent duplicate interceptions
      res.send = originalSend;

      try {
        // Only cache successful HTTP 2xx responses
        const isSuccess = res.statusCode >= 200 && res.statusCode < 300;

        if (isSuccess && body !== undefined) {
          const contentType = res.getHeader('content-type');
          store.set(
            key,
            {
              body,
              statusCode: res.statusCode,
              headers: {
                'content-type': contentType,
              },
            },
            config.ttl
          );
        }
      } catch (err) {
        // Cache storage failures must never interrupt delivering response to client
      }

      return originalSend.call(this, body);
    };

    return next();
  };
}

module.exports = {
  createCacheMiddleware,
};
