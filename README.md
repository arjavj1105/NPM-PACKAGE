# express-response-cache

A lightweight, zero-runtime-dependency in-memory response caching and automatic invalidation middleware for Express.js applications.

Designed to eliminate redundant database queries and API calls by transparently caching eligible `GET` responses, while automatically invalidating affected cache entries when successful mutations (`POST`, `PUT`, `PATCH`, `DELETE`) modify application resources.

---

## Features

- **GET Response Caching**: Seamlessly caches successful HTTP 2xx responses while bypassing non-GET methods and error responses (4xx/5xx).
- **Automatic Cache Invalidation**: Automatically clears related cached responses following successful mutation requests (`POST`, `PUT`, `PATCH`, `DELETE`).
- **Resource Tagging System**: Group cache entries under logical resource tags (e.g., `'products'`, `'product:1'`) for targeted, granular invalidation without clearing unrelated caches.
- **In-Memory Storage**: High-performance key-value store with sub-millisecond lookups and secondary tag indexing (`O(1)` access).
- **Configurable TTL**: Defaults to 60 seconds with simple per-route or global customization.
- **Intelligent Query Normalization**: Eliminates cache misses caused by differing query parameter orders (e.g., `?sort=asc&limit=10` and `?limit=10&sort=asc` share the same cache key).
- **Header Preservation**: Safely preserves application headers (e.g., `Content-Type`, `Cache-Control`, `ETag`, and custom app headers) across cache hits while excluding transient transport headers.
- **Cache Status Headers**: Inspect responses with `X-Cache: HIT` or `X-Cache: MISS` alongside `X-Cache-Timestamp`.
- **Public & Internal Metadata API**: Inspect timestamps (`createdAt`, `expiresAt`, `ttl`), tags, and programmatic invalidation (`invalidateByTag`, `invalidateTags`).
- **Zero Runtime Dependencies**: Uses Node.js built-ins (`Map`, `Set`, `URLSearchParams`, `setInterval`), keeping your production bundle footprint minimal.

---

## Installation

```bash
npm install express-response-cache
```

*(Requires Node.js >= 18.0.0 and Express 4.x or 5.x)*

---

## Core Concepts: Resource Tags & Invalidation

### What is Cache Invalidation?
When client applications perform write operations (mutations like creating, updating, or deleting data), previously cached GET responses become **stale**. Automatic cache invalidation ensures that as soon as a mutation succeeds, the outdated cached responses are purged so subsequent reads fetch fresh data immediately.

### How Resource Tags Work
Instead of hardcoding endpoint paths, `express-response-cache` uses **Resource Tags**:
1. When caching a `GET` route, you attach one or more tags (static string or dynamic resolver function).
2. When configuring a mutation route (`POST`, `PUT`, `PATCH`, `DELETE`), you specify which tags should be invalidated upon success.
3. When the mutation completes with an HTTP 2xx status, all cache entries associated with those tags are evicted.

### Precision & Resource Isolation
- Creating a product (`POST /products`) invalidates the collection tag (`'products'`), purging `/products` and all its query variants (`/products?category=Electronics`), while leaving individual product detail caches (`'product:1'`) intact.
- Updating product 1 (`PUT /products/1`) invalidates `'products'` and `'product:1'`, but **does not touch** `'product:10'` or unrelated resources like `'users'`.

---

## Complete Express.js Example

```javascript
const express = require('express');
const cache = require('express-response-cache');

const app = express();
app.use(express.json());

// ----------------------------------------------------
// 1. GET Endpoints (Cached with Tags)
// ----------------------------------------------------

// Cache list of products under the 'products' tag
app.get(
  '/api/products',
  cache({ ttl: 30, tags: ['products'] }),
  (req, res) => {
    res.json({ data: [{ id: 1, name: 'Headphones' }] });
  }
);

// Cache individual product under 'product:<id>' tag
app.get(
  '/api/products/:id',
  cache({
    ttl: 60,
    tags: (req) => [`product:${req.params.id}`],
  }),
  (req, res) => {
    res.json({ id: req.params.id, name: 'Headphones' });
  }
);

// ----------------------------------------------------
// 2. Mutation Endpoints (Automatic Invalidation)
// ----------------------------------------------------

// POST: Create product -> Invalidates 'products' collection
app.post(
  '/api/products',
  cache.invalidate({ tags: ['products'] }),
  (req, res) => {
    res.status(201).json({ success: true, created: req.body });
  }
);

// PUT: Full update -> Invalidates collection & specific product
app.put(
  '/api/products/:id',
  cache.invalidate({
    tags: (req) => ['products', `product:${req.params.id}`],
  }),
  (req, res) => {
    res.status(200).json({ success: true, updated: req.params.id });
  }
);

// PATCH: Partial update -> Invalidates collection & specific product
app.patch(
  '/api/products/:id',
  cache.invalidate({
    tags: (req) => ['products', `product:${req.params.id}`],
  }),
  (req, res) => {
    res.status(200).json({ success: true, patched: req.params.id });
  }
);

// DELETE: Remove product -> Invalidates collection & specific product
app.delete(
  '/api/products/:id',
  cache.invalidate({
    tags: (req) => ['products', `product:${req.params.id}`],
  }),
  (req, res) => {
    res.status(200).json({ success: true, message: 'Deleted' });
  }
);

app.listen(3000, () => console.log('Server running on port 3000'));
```

---

## How Failed Mutations Are Handled

`express-response-cache` hooks into the final response `'finish'` event and checks the actual HTTP status code:

- **HTTP 200–299 (Success)**: Invalidation occurs safely.
- **HTTP 4xx (Client Errors, e.g. 400 Bad Request, 404 Not Found)**: Invalidation is **skipped**; cached responses remain preserved.
- **HTTP 5xx (Server Errors)**: Invalidation is **skipped**.
- **Unhandled Exceptions / Disconnected Requests**: Invalidation is **skipped**.

---

## Configuration Reference

### Caching Options: `cache(options)`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `ttl` | `number` | `60` | Time to live in seconds. Must be a positive finite number. |
| `tags` | `string \| string[] \| Function` | `[]` | Resource tags to assign. Can be a function: `(req) => string[]`. |
| `enabled` | `boolean` | `true` | Toggle caching dynamically. |
| `keyGenerator` | `Function` | `defaultKeyGenerator` | Custom function receiving `(req)` that returns a unique string key. |
| `store` | `CacheStore` | Default shared store | Custom `CacheStore` instance if isolating caches. |

### Invalidation Options: `cache.invalidate(options)`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `tags` | `string \| string[] \| Function` | *(Required)* | Tags to invalidate. Function receives `(req, res)`. |
| `methods` | `string[]` | `['POST', 'PUT', 'PATCH', 'DELETE']` | HTTP methods that trigger invalidation. |
| `enabled` | `boolean` | `true` | Toggle invalidation dynamically. |
| `store` | `CacheStore` | Default shared store | CacheStore instance to invalidate from. |

---

## Programmatic Cache API

If you need to manually clear caches or inspect metadata outside route middleware:

```javascript
const cache = require('express-response-cache');

// Invalidate all entries tagged with 'products'
cache.invalidateByTag('products');

// Invalidate multiple tags at once
cache.invalidateTags(['products', 'categories']);

// Clear the entire default cache
cache.clear();
```

### Isolated Store Instances: `cache.createCache()`

For modular microservices or tests requiring completely isolated stores:

```javascript
const { createCache } = require('express-response-cache');

const { middleware, invalidate, store } = createCache({ ttl: 45 });

app.get('/reports', middleware({ tags: ['reports'] }), handler);
app.post('/reports', invalidate({ tags: ['reports'] }), handler);

// Inspect metadata
const meta = store.getMetadata('GET:/reports');
// Manual purge
store.invalidateByTag('reports');
```

---

## Response Headers

The caching middleware automatically injects diagnostic HTTP response headers:

- `X-Cache: MISS` — The response was generated by the downstream route handler and stored in cache.
- `X-Cache: HIT` — The response was served directly from in-memory cache.
- `X-Cache-Timestamp` — ISO-8601 timestamp representing when the response was captured.

---

## Limitations

- **In-Memory Storage**: Caching and tag indexes reside in process memory. If running multiple clustered Node.js worker processes without sticky sessions, each worker maintains its own independent in-memory store.
- **Process Restarts**: Because entries are in-memory, restarting the Node.js process clears the cache.

---

## Demonstration Application

A fully structured example app following `Route → Middleware → Controller → Service → Database` is included in the `examples/` directory.

Run the demonstration server:

```bash
npm run start:example
```

Test caching and invalidation using `curl`:

```bash
# 1. First fetch (MISS ~ 200ms)
curl -i http://localhost:3000/products

# 2. Repeated fetch (HIT < 2ms)
curl -i http://localhost:3000/products

# 3. Create a new product (Mutate collection)
curl -i -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -d '{"name": "Ultra-Wide Monitor", "price": 499.99}'

# 4. Collection fetch is immediately invalidated (MISS ~ 200ms) with new data!
curl -i http://localhost:3000/products
```

---

## Running Automated Tests

Run the built-in test suite:

```bash
npm test
```

---

## Roadmap

- **Commit 01 (15 Nov)**: Foundation — in-memory cache store, query normalization, Express middleware, configuration validation, example app, test suite. *(Completed)*
- **Commit 02 (16 Nov)**: Core caching enhancement — response header preservation, metadata API, thorough TTL and scenario verification. *(Completed)*
- **Commit 03 (16 Nov)**: Automatic cache invalidation — tag indexing, mutation invalidation (POST, PUT, PATCH, DELETE), resource isolation, failure guards, and comprehensive tests. *(Completed)*
- **Commit 04 (17 Nov)**: Documentation polish & package release.

---

## License

MIT © 2026 Arjav Jain
