'use strict';

const { CacheStore } = require('../cache/cacheStore');
const { validateOptions } = require('../utils/validateOptions');
const { defaultKeyGenerator } = require('../cache/cacheKey');

/**
 * Resolves tags to invalidate from configuration and runtime request/response.
 *
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {string[]|Function} tagConfig - Tag configuration
 * @returns {string[]} Normalized array of tags
 */
function resolveInvalidationTags(req, res, tagConfig) {
  if (typeof tagConfig === 'function') {
    try {
      const result = tagConfig(req, res);
      if (typeof result === 'string') {
        return result.trim() ? [result.trim()] : [];
      }
      if (Array.isArray(result)) {
        return result
          .filter((t) => typeof t === 'string' && t.trim() !== '')
          .map((t) => t.trim());
      }
      return [];
    } catch (err) {
      return [];
    }
  }

  if (Array.isArray(tagConfig)) {
    return tagConfig;
  }

  return [];
}

/**
 * Creates an Express invalidation middleware instance.
 * Automatically purges related cached responses when mutation requests succeed (HTTP 2xx).
 *
 * @param {Object} options - Invalidation options
 * @param {string|string[]|Function} options.tags - Resource tags to invalidate or dynamic resolver function
 * @param {string[]} [options.methods=['POST', 'PUT', 'PATCH', 'DELETE']] - HTTP methods to monitor
 * @param {boolean} [options.enabled=true] - Toggle invalidation on or off
 * @param {CacheStore} [options.store] - CacheStore instance to invalidate from
 * @returns {import('express').RequestHandler}
 */
function createInvalidationMiddleware(options = {}) {
  const config = validateOptions(options, defaultKeyGenerator);

  if (!config.tags || (Array.isArray(config.tags) && config.tags.length === 0 && typeof options.tags !== 'function')) {
    throw new TypeError('Option "tags" is required for invalidation middleware and must not be empty.');
  }

  const store = options.store instanceof CacheStore
    ? options.store
    : null; // If null, handled dynamically by caller/shared store

  return function invalidationMiddleware(req, res, next) {
    // 1. Bypass if invalidation is disabled
    if (!config.enabled) {
      return next();
    }

    // 2. Only monitor configured mutation methods
    const method = (req.method || '').toUpperCase();
    if (!config.methods.includes(method)) {
      return next();
    }

    // Determine target store (provided or attached on request/default)
    const targetStore = store || req.app?.locals?.cacheStore;

    // 3. Listen to response finish event to ensure operation completed successfully
    res.on('finish', () => {
      try {
        // Only invalidate on successful HTTP 2xx responses
        const isSuccess = res.statusCode >= 200 && res.statusCode < 300;
        if (!isSuccess) {
          return;
        }

        const tagsToInvalidate = resolveInvalidationTags(req, res, config.tags);
        if (tagsToInvalidate.length > 0 && targetStore) {
          targetStore.invalidateTags(tagsToInvalidate);
        }
      } catch (err) {
        // Invalidation failures must never interrupt the response or crash Express
      }
    });

    return next();
  };
}

module.exports = {
  createInvalidationMiddleware,
  resolveInvalidationTags,
};
