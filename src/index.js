'use strict';

const { createCacheMiddleware, extractCachableHeaders } = require('./middleware/cacheMiddleware');
const { createInvalidationMiddleware, resolveInvalidationTags } = require('./middleware/invalidationMiddleware');
const { CacheStore } = require('./cache/cacheStore');
const { defaultKeyGenerator, normalizeQueryString } = require('./cache/cacheKey');
const { validateOptions } = require('./utils/validateOptions');

// Shared default store used when custom store instance is not explicitly provided
let defaultStore = new CacheStore();

/**
 * Primary package export.
 * Calling `cache(options)` returns an Express caching middleware function.
 *
 * @param {Object} [options={}] - Cache options
 * @returns {import('express').RequestHandler}
 */
function cache(options = {}) {
  const store = options.store instanceof CacheStore ? options.store : defaultStore;
  return createCacheMiddleware({ ...options, store });
}

// Named exports attached to main function for flexible import styles
cache.cache = cache;
cache.createCacheMiddleware = createCacheMiddleware;
cache.createInvalidationMiddleware = createInvalidationMiddleware;
cache.CacheStore = CacheStore;
cache.defaultKeyGenerator = defaultKeyGenerator;
cache.normalizeQueryString = normalizeQueryString;
cache.validateOptions = validateOptions;
cache.extractCachableHeaders = extractCachableHeaders;
cache.resolveInvalidationTags = resolveInvalidationTags;

/**
 * Creates an invalidation middleware function using the default or provided CacheStore.
 *
 * @param {Object} options - Invalidation options
 * @param {string|string[]|Function} options.tags - Resource tags to invalidate on successful mutation
 * @param {string[]} [options.methods] - HTTP mutation methods
 * @param {CacheStore} [options.store] - Optional custom CacheStore
 * @returns {import('express').RequestHandler}
 */
cache.invalidate = function invalidate(options = {}) {
  const store = options.store instanceof CacheStore ? options.store : defaultStore;
  return createInvalidationMiddleware({ ...options, store });
};

/**
 * Programmatically invalidates all cache entries matching a tag from the default store.
 *
 * @param {string} tag - Resource tag to invalidate
 * @returns {number} Count of invalidated entries
 */
cache.invalidateByTag = function invalidateByTag(tag) {
  return defaultStore.invalidateByTag(tag);
};

/**
 * Programmatically invalidates all cache entries matching any of the specified tags from the default store.
 *
 * @param {string|string[]} tags - Single tag or array of tags
 * @returns {number} Total count of invalidated entries
 */
cache.invalidateTags = function invalidateTags(tags) {
  return defaultStore.invalidateTags(tags);
};

/**
 * Clears all entries and tags from the default cache store.
 */
cache.clear = function clear() {
  defaultStore.clear();
};

/**
 * Returns the current default CacheStore instance.
 *
 * @returns {CacheStore}
 */
cache.getDefaultStore = function getDefaultStore() {
  return defaultStore;
};

/**
 * Resets or replaces the default CacheStore instance.
 *
 * @param {CacheStore} [newStore]
 * @returns {CacheStore}
 */
cache.resetDefaultStore = function resetDefaultStore(newStore) {
  if (defaultStore && typeof defaultStore.stopCleanup === 'function') {
    defaultStore.stopCleanup();
  }
  defaultStore = newStore instanceof CacheStore ? newStore : new CacheStore();
  return defaultStore;
};

/**
 * Helper factory that creates an isolated CacheStore and returns bound caching and invalidation middleware.
 *
 * @param {Object} [options={}] - Cache options
 * @returns {{ middleware: Function, invalidate: Function, store: CacheStore }}
 */
cache.createCache = function createCache(options = {}) {
  const config = validateOptions(options, defaultKeyGenerator);

  const store = new CacheStore({
    defaultTtl: config.ttl,
    cleanupIntervalMs: options.cleanupIntervalMs,
  });

  const directMiddleware = createCacheMiddleware({ ...options, store });

  // Bound middleware can be passed directly as (req, res, next) OR called as a factory (options)
  function boundMiddleware(reqOrOptions, res, next) {
    if (
      reqOrOptions &&
      typeof reqOrOptions === 'object' &&
      (!res || typeof res.send !== 'function')
    ) {
      return createCacheMiddleware({ ...options, ...reqOrOptions, store });
    }
    return directMiddleware(reqOrOptions, res, next);
  }

  // Invalidation middleware bound to this isolated store
  function boundInvalidate(invOptions = {}) {
    return createInvalidationMiddleware({ ...invOptions, store });
  }

  return {
    middleware: boundMiddleware,
    invalidate: boundInvalidate,
    store,
  };
};

module.exports = cache;
