'use strict';

/**
 * Represents an individual cached entry with metadata and resource tags.
 *
 * @typedef {Object} CacheEntry
 * @property {string} key - The unique cache identifier
 * @property {*} value - The cached data payload
 * @property {number} createdAt - Epoch timestamp in milliseconds when stored
 * @property {number} expiresAt - Epoch timestamp in milliseconds when entry expires
 * @property {number} ttl - Original time-to-live in seconds
 * @property {string[]} tags - Resource tags associated with this entry
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
    this.tagIndex = new Map(); // Map<string, Set<string>>: tag -> Set of keys

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
   * Normalizes tags input into an array of unique non-empty strings.
   *
   * @private
   * @param {string|string[]} [tags]
   * @returns {string[]}
   */
  _normalizeTags(tags) {
    if (!tags) {
      return [];
    }

    const raw = Array.isArray(tags) ? tags : [tags];
    const normalized = [];

    for (const t of raw) {
      if (typeof t === 'string' && t.trim() !== '') {
        normalized.push(t.trim());
      }
    }

    return Array.from(new Set(normalized));
  }

  /**
   * Removes a key from the tag index for the specified tags.
   *
   * @private
   * @param {string} key
   * @param {string[]} [tags]
   */
  _removeKeyFromTagIndex(key, tags) {
    if (!tags || !Array.isArray(tags)) {
      return;
    }

    for (const tag of tags) {
      const keySet = this.tagIndex.get(tag);
      if (keySet) {
        keySet.delete(key);
        if (keySet.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }
  }

  /**
   * Stores a value in the cache with a specified TTL and optional resource tags.
   *
   * @param {string} key - Cache identifier
   * @param {*} value - The value to store
   * @param {number} [ttl] - Time-to-live in seconds (falls back to defaultTtl)
   * @param {string|string[]} [tags=[]] - Resource tags to associate with this entry
   * @returns {CacheEntry} The stored entry metadata
   */
  set(key, value, ttl, tags = []) {
    if (typeof key !== 'string' || key.trim() === '') {
      throw new TypeError('Cache key must be a non-empty string.');
    }

    // Clean up existing tags if key is being replaced
    const existing = this.storage.get(key);
    if (existing && existing.tags) {
      this._removeKeyFromTagIndex(key, existing.tags);
    }

    const effectiveTtl = (typeof ttl === 'number' && ttl > 0) ? ttl : this.defaultTtl;
    const now = Date.now();
    const expiresAt = now + (effectiveTtl * 1000);
    const normalizedTags = this._normalizeTags(tags);

    const entry = {
      key,
      value,
      createdAt: now,
      expiresAt,
      ttl: effectiveTtl,
      tags: normalizedTags,
    };

    this.storage.set(key, entry);

    // Index key under each tag
    for (const tag of normalizedTags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag).add(key);
    }

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
      this._removeKeyFromTagIndex(key, entry.tags);
      this.storage.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Retrieves the raw cache entry including timestamps, or null if expired/not found.
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
      this._removeKeyFromTagIndex(key, entry.tags);
      this.storage.delete(key);
      return null;
    }

    return entry;
  }

  /**
   * Retrieves metadata for an active entry without exposing internal structure.
   *
   * @param {string} key - Cache identifier
   * @returns {{ key: string, createdAt: number, expiresAt: number, ttl: number, tags: string[] }|null}
   */
  getMetadata(key) {
    const entry = this.getEntry(key);

    if (!entry) {
      return null;
    }

    return {
      key: entry.key,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt,
      ttl: entry.ttl,
      tags: [...entry.tags],
    };
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
    const entry = this.storage.get(key);
    if (entry) {
      this._removeKeyFromTagIndex(key, entry.tags);
      return this.storage.delete(key);
    }
    return false;
  }

  /**
   * Clears all entries and tag mappings from the store.
   */
  clear() {
    this.storage.clear();
    this.tagIndex.clear();
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
   * Returns the tags associated with an active cache key.
   *
   * @param {string} key - Cache identifier
   * @returns {string[]}
   */
  getTags(key) {
    const entry = this.getEntry(key);
    return entry && entry.tags ? [...entry.tags] : [];
  }

  /**
   * Checks whether a resource tag is currently associated with active entries.
   *
   * @param {string} tag - Resource tag
   * @returns {boolean}
   */
  hasTag(tag) {
    if (typeof tag !== 'string') {
      return false;
    }
    const keySet = this.tagIndex.get(tag.trim());
    return Boolean(keySet && keySet.size > 0);
  }

  /**
   * Invalidates all cache entries associated with the specified tag.
   *
   * @param {string} tag - Resource tag
   * @returns {number} The count of invalidated entries
   */
  invalidateByTag(tag) {
    if (typeof tag !== 'string' || tag.trim() === '') {
      return 0;
    }

    const normalizedTag = tag.trim();
    const keySet = this.tagIndex.get(normalizedTag);

    if (!keySet || keySet.size === 0) {
      return 0;
    }

    // Clone keys to avoid mutation issues during iteration
    const keysToRemove = Array.from(keySet);
    for (const key of keysToRemove) {
      this.delete(key);
    }

    return keysToRemove.length;
  }

  /**
   * Invalidates all cache entries associated with any of the specified tags.
   *
   * @param {string|string[]} tags - Single tag or array of tags
   * @returns {number} The count of unique invalidated entries
   */
  invalidateTags(tags) {
    const normalizedTags = this._normalizeTags(tags);
    if (normalizedTags.length === 0) {
      return 0;
    }

    const keysToRemove = new Set();
    for (const tag of normalizedTags) {
      const keySet = this.tagIndex.get(tag);
      if (keySet) {
        for (const key of keySet) {
          keysToRemove.add(key);
        }
      }
    }

    for (const key of keysToRemove) {
      this.delete(key);
    }

    return keysToRemove.size;
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
        this._removeKeyFromTagIndex(key, entry.tags);
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
