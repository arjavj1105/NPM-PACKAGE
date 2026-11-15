'use strict';

const { createCacheMiddleware, extractCachableHeaders } = require('./middleware/cacheMiddleware');
const { CacheStore } = require('./cache/cacheStore');
const { defaultKeyGenerator, normalizeQueryString } = require('./cache/cacheKey');
const { validateOptions } = require('./utils/validateOptions');

/**
 * Primary package export.
 * Calling `cache(options)` returns an Express middleware function.
 */
const cache = createCacheMiddleware;

// Named exports attached to main function for flexible import styles
cache.cache = createCacheMiddleware;
cache.createCacheMiddleware = createCacheMiddleware;
cache.CacheStore = CacheStore;
cache.defaultKeyGenerator = defaultKeyGenerator;
cache.normalizeQueryString = normalizeQueryString;
cache.validateOptions = validateOptions;
cache.extractCachableHeaders = extractCachableHeaders;

/**
 * Helper factory that creates and returns both the middleware and its underlying store instance.
 * Useful when an application needs manual cache management (e.g., store.clear() or inspections).
 *
 * @param {Object} [options={}] - Cache options
 * @returns {{ middleware: Function, store: CacheStore }}
 */
cache.createCache = function createCache(options = {}) {
  const config = validateOptions(options, defaultKeyGenerator);

  const store = new CacheStore({
    defaultTtl: config.ttl,
    cleanupIntervalMs: options.cleanupIntervalMs,
  });

  const middleware = createCacheMiddleware({ ...options, store });

  return {
    middleware,
    store,
  };
};

module.exports = cache;
