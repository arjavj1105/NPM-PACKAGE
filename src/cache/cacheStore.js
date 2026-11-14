'use strict';

/**
 * Represents an individual cached entry with metadata.
 *
 * @typedef {Object} CacheEntry
 * @property {*} value - The cached data payload
 * @property {number} createdAt - Epoch timestamp in milliseconds when stored
 * @property {number} expiresAt - Epoch timestamp in milliseconds when entry expires
 * @property {number} ttl - Original time-to-live in seconds
 */

class CacheStore {
  /**
   * Initializes the in-memory cache store.
   *
   * @param {Object} [options={}] - Store configuration options
   * @param {number} [options.defaultTtl=60] - Default TTL in seconds if not specified per entry
   * @param {number} [options.cleanupIntervalMs=60000] - Interval in ms for background sweeps (0 to disable)
   */
  constructor(options = {}) {
    this.defaultTtl = options.defaultTtl && options.defaultTtl > 0 ? options.defaultTtl : 60;
    this.storage = new Map();

    const cleanupIntervalMs = options.cleanupIntervalMs !== undefined
      ? options.cleanupIntervalMs
      : 60000;

    // Start background sweep to prevent memory leaks from unread expired entries
    if (cleanupIntervalMs > 0) {
      this.cleanupTimer = setInterval(() => {
        this.pruneExpired();
      }, cleanupIntervalMs);

      // unref() allows the Node.js process to exit naturally without waiting for this timer
      if (typeof this.cleanupTimer.unref === 'function') {
        this.cleanupTimer.unref();
      }
    } else {
      this.cleanupTimer = null;
    }
  }

  /**
   * Stores a value in the cache with a specified TTL.
   *
   * @param {string} key - Cache identifier
   * @param {*} value - The value to store
   * @param {number} [ttl] - Time-to-live in seconds (falls back to defaultTtl)
   * @returns {CacheEntry} The stored entry metadata
   */
  set(key, value, ttl) {
    if (typeof key !== 'string' || key.trim() === '') {
      throw new TypeError('Cache key must be a non-empty string.');
    }

    const effectiveTtl = (typeof ttl === 'number' && ttl > 0) ? ttl : this.defaultTtl;
    const now = Date.now();
    const expiresAt = now + (effectiveTtl * 1000);

    const entry = {
      value,
      createdAt: now,
      expiresAt,
      ttl: effectiveTtl,
    };

    this.storage.set(key, entry);
    return entry;
  }

  /**
   * Retrieves a value from the cache.
   * If the entry exists but has expired, it is lazily deleted and null is returned.
   *
   * @param {string} key - Cache identifier
   * @returns {*|null} Stored value, or null if missing or expired
   */
  get(key) {
    const entry = this.storage.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() >= entry.expiresAt) {
      this.storage.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Retrieves the raw cache entry including timestamps, or null if expired/not found.
   * Useful for middleware reading createdAt or expiresAt metadata.
   *
   * @param {string} key - Cache identifier
   * @returns {CacheEntry|null}
   */
  getEntry(key) {
    const entry = this.storage.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() >= entry.expiresAt) {
      this.storage.delete(key);
      return null;
    }

    return entry;
  }

  /**
   * Checks whether a valid (non-expired) key exists in the cache.
   *
   * @param {string} key - Cache identifier
   * @returns {boolean} True if key exists and is not expired
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Deletes a specific key from the cache.
   *
   * @param {string} key - Cache identifier
   * @returns {boolean} True if key was deleted, false otherwise
   */
  delete(key) {
    return this.storage.delete(key);
  }

  /**
   * Clears all entries from the store.
   */
  clear() {
    this.storage.clear();
  }

  /**
   * Returns the count of active (valid and unpruned) entries.
   *
   * @returns {number}
   */
  size() {
    return this.storage.size;
  }

  /**
   * Returns an array of all active keys currently in storage.
   *
   * @returns {string[]}
   */
  keys() {
    return Array.from(this.storage.keys());
  }

  /**
   * Sweeps the storage to prune any expired entries that haven't been accessed.
   *
   * @returns {number} The number of expired entries removed
   */
  pruneExpired() {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.storage.entries()) {
      if (now >= entry.expiresAt) {
        this.storage.delete(key);
        removedCount++;
      }
    }

    return removedCount;
  }

  /**
   * Stops the background cleanup interval timer.
   */
  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

module.exports = {
  CacheStore,
};
