'use strict';

/**
 * Normalizes query parameters into a deterministically sorted query string.
 * This ensures requests like `/products?b=2&a=1` and `/products?a=1&b=2`
 * map to the identical cache key.
 *
 * @param {string} queryString - Raw query string (with or without leading '?')
 * @returns {string} Deterministically sorted query string (prefixed with '?' if non-empty)
 */
function normalizeQueryString(queryString) {
  if (!queryString) {
    return '';
  }

  const searchParams = new URLSearchParams(queryString);
  const entries = Array.from(searchParams.entries());

  if (entries.length === 0) {
    return '';
  }

  // Sort parameters alphabetically by key, then by value for duplicates
  entries.sort(([keyA, valA], [keyB, valB]) => {
    if (keyA === keyB) {
      return valA.localeCompare(valB);
    }
    return keyA.localeCompare(keyB);
  });

  const sortedParams = new URLSearchParams();
  for (const [key, value] of entries) {
    sortedParams.append(key, value);
  }

  const result = sortedParams.toString();
  return result ? `?${result}` : '';
}

/**
 * Default cache key generator.
 * Creates a unique string key based on HTTP method, path, and sorted query parameters.
 *
 * Format: `<METHOD>:<PATH><SORTED_QUERY>`
 * Example: `GET:/api/products?limit=10&page=1`
 *
 * @param {import('express').Request} req - Express request object
 * @returns {string} Canonical cache key
 */
function defaultKeyGenerator(req) {
  if (!req || typeof req !== 'object') {
    throw new TypeError('Request object is required to generate a cache key.');
  }

  const method = (req.method || 'GET').toUpperCase();
  const rawUrl = req.originalUrl || req.url || '/';

  const queryIndex = rawUrl.indexOf('?');
  let pathname = rawUrl;
  let rawQuery = '';

  if (queryIndex !== -1) {
    pathname = rawUrl.slice(0, queryIndex);
    rawQuery = rawUrl.slice(queryIndex + 1);
  }

  const normalizedQuery = normalizeQueryString(rawQuery);
  return `${method}:${pathname}${normalizedQuery}`;
}

module.exports = {
  defaultKeyGenerator,
  normalizeQueryString,
};
