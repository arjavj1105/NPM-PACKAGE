'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const express = require('express');
const cache = require('../src');
const demoApp = require('../examples/server');
const productDatabase = require('../examples/database/productDatabase');

describe('InvalidationMiddleware - Comprehensive Tests', () => {
  beforeEach(() => {
    cache.clear();
    productDatabase.reset();
  });

  // A. SUCCESSFUL MUTATION TESTS
  describe('A. Successful Mutations', () => {
    test('1. Successful POST invalidates collection cache', async () => {
      const app = express();
      app.use(express.json());
      const { middleware, invalidate } = cache.createCache();
      let getCount = 0;

      app.get('/items', middleware({ tags: ['items'] }), (req, res) => {
        getCount++;
        res.status(200).json({ list: ['a', 'b'], fetchCount: getCount });
      });

      app.post('/items', invalidate({ tags: ['items'] }), (req, res) => {
        res.status(201).json({ created: true });
      });

      // 1. Initial GET -> MISS
      const res1 = await request(app).get('/items');
      assert.equal(res1.status, 200);
      assert.equal(res1.headers['x-cache'], 'MISS');
      assert.equal(res1.body.fetchCount, 1);

      // 2. Repeated GET -> HIT
      const res2 = await request(app).get('/items');
      assert.equal(res2.headers['x-cache'], 'HIT');
      assert.equal(res2.body.fetchCount, 1);

      // 3. Successful POST mutation
      const postRes = await request(app).post('/items').send({ name: 'c' });
      assert.equal(postRes.status, 201);

      // 4. GET after POST -> MISS (invalidated!)
      const res3 = await request(app).get('/items');
      assert.equal(res3.status, 200);
      assert.equal(res3.headers['x-cache'], 'MISS');
      assert.equal(res3.body.fetchCount, 2);
    });

    test('2. Successful PUT invalidates collection and target detail cache', async () => {
      const app = express();
      app.use(express.json());
      const { middleware, invalidate } = cache.createCache();
      let listCount = 0;
      let detailCount = 0;

      app.get('/items', middleware({ tags: ['items'] }), (req, res) => {
        listCount++;
        res.status(200).json({ count: listCount });
      });

      app.get('/items/:id', middleware({ tags: (req) => [`item:${req.params.id}`] }), (req, res) => {
        detailCount++;
        res.status(200).json({ id: req.params.id, count: detailCount });
      });

      app.put('/items/:id', invalidate({ tags: (req) => ['items', `item:${req.params.id}`] }), (req, res) => {
        res.status(200).json({ updated: true });
      });

      // Populate caches
      await request(app).get('/items');
      await request(app).get('/items/1');
      assert.equal((await request(app).get('/items')).headers['x-cache'], 'HIT');
      assert.equal((await request(app).get('/items/1')).headers['x-cache'], 'HIT');

      // Successful PUT /items/1
      const putRes = await request(app).put('/items/1').send({ name: 'updated' });
      assert.equal(putRes.status, 200);

      // Both collection and item:1 must be invalidated
      const getList = await request(app).get('/items');
      assert.equal(getList.headers['x-cache'], 'MISS');
      assert.equal(listCount, 2);

      const getItem = await request(app).get('/items/1');
      assert.equal(getItem.headers['x-cache'], 'MISS');
      assert.equal(detailCount, 2);
    });

    test('3. Successful PATCH invalidates collection and target detail cache', async () => {
      const app = express();
      app.use(express.json());
      const { middleware, invalidate } = cache.createCache();
      let listCalls = 0;
      let itemCalls = 0;

      app.get('/items', middleware({ tags: ['items'] }), (req, res) => {
        listCalls++;
        res.status(200).json({ calls: listCalls });
      });

      app.get('/items/:id', middleware({ tags: (req) => [`item:${req.params.id}`] }), (req, res) => {
        itemCalls++;
        res.status(200).json({ id: req.params.id, calls: itemCalls });
      });

      app.patch('/items/:id', invalidate({ tags: (req) => ['items', `item:${req.params.id}`] }), (req, res) => {
        res.status(200).json({ patched: true });
      });

      // Warm cache
      await request(app).get('/items');
      await request(app).get('/items/5');
      assert.equal((await request(app).get('/items')).headers['x-cache'], 'HIT');
      assert.equal((await request(app).get('/items/5')).headers['x-cache'], 'HIT');

      // PATCH /items/5
      const patchRes = await request(app).patch('/items/5').send({ inStock: false });
      assert.equal(patchRes.status, 200);

      // Verify invalidation
      assert.equal((await request(app).get('/items')).headers['x-cache'], 'MISS');
      assert.equal((await request(app).get('/items/5')).headers['x-cache'], 'MISS');
      assert.equal(listCalls, 2);
      assert.equal(itemCalls, 2);
    });

    test('4. Successful DELETE invalidates collection and target detail cache', async () => {
      const app = express();
      const { middleware, invalidate } = cache.createCache();
      let listCalls = 0;
      let itemCalls = 0;

      app.get('/items', middleware({ tags: ['items'] }), (req, res) => {
        listCalls++;
        res.status(200).json({ calls: listCalls });
      });

      app.get('/items/:id', middleware({ tags: (req) => [`item:${req.params.id}`] }), (req, res) => {
        itemCalls++;
        res.status(200).json({ id: req.params.id, calls: itemCalls });
      });

      app.delete('/items/:id', invalidate({ tags: (req) => ['items', `item:${req.params.id}`] }), (req, res) => {
        res.status(200).json({ deleted: true });
      });

      // Warm cache
      await request(app).get('/items');
      await request(app).get('/items/3');
      assert.equal((await request(app).get('/items')).headers['x-cache'], 'HIT');
      assert.equal((await request(app).get('/items/3')).headers['x-cache'], 'HIT');

      // DELETE /items/3
      const delRes = await request(app).delete('/items/3');
      assert.equal(delRes.status, 200);

      // Verify invalidation
      assert.equal((await request(app).get('/items')).headers['x-cache'], 'MISS');
      assert.equal((await request(app).get('/items/3')).headers['x-cache'], 'MISS');
    });
  });

  // B. FAILED MUTATION TESTS
  describe('B. Failed Mutations Do Not Invalidate', () => {
    test('POST returning 400 Bad Request does not invalidate cache', async () => {
      const app = express();
      app.use(express.json());
      const { middleware, invalidate } = cache.createCache();
      let getCount = 0;

      app.get('/items', middleware({ tags: ['items'] }), (req, res) => {
        getCount++;
        res.status(200).json({ count: getCount });
      });

      app.post('/items', invalidate({ tags: ['items'] }), (req, res) => {
        if (!req.body.name) {
          return res.status(400).json({ error: 'Name is required' });
        }
        res.status(201).json({ created: true });
      });

      // Warm cache
      await request(app).get('/items');
      assert.equal((await request(app).get('/items')).headers['x-cache'], 'HIT');

      // Failed POST
      const postRes = await request(app).post('/items').send({});
      assert.equal(postRes.status, 400);

      // GET must remain a HIT!
      const afterRes = await request(app).get('/items');
      assert.equal(afterRes.headers['x-cache'], 'HIT');
      assert.equal(afterRes.body.count, 1);
      assert.equal(getCount, 1);
    });

    test('PUT returning 404 Not Found does not invalidate cache', async () => {
      const app = express();
      app.use(express.json());
      const { middleware, invalidate } = cache.createCache();
      let getCount = 0;

      app.get('/items/99', middleware({ tags: ['item:99'] }), (req, res) => {
        getCount++;
        res.status(200).json({ id: 99, count: getCount });
      });

      app.put('/items/:id', invalidate({ tags: (req) => [`item:${req.params.id}`] }), (req, res) => {
        res.status(404).json({ error: 'Item not found' });
      });

      // Warm cache
      await request(app).get('/items/99');
      assert.equal((await request(app).get('/items/99')).headers['x-cache'], 'HIT');

      // Failed PUT
      const putRes = await request(app).put('/items/99').send({ name: 'new' });
      assert.equal(putRes.status, 404);

      // Cache must stay intact
      const afterRes = await request(app).get('/items/99');
      assert.equal(afterRes.headers['x-cache'], 'HIT');
      assert.equal(getCount, 1);
    });

    test('PATCH returning 500 Server Error does not invalidate cache', async () => {
      const app = express();
      const { middleware, invalidate } = cache.createCache();
      let getCount = 0;

      app.get('/items', middleware({ tags: ['items'] }), (req, res) => {
        getCount++;
        res.status(200).json({ count: getCount });
      });

      app.patch('/items/:id', invalidate({ tags: ['items'] }), (req, res) => {
        res.status(500).json({ error: 'Database connection failed' });
      });

      // Warm cache
      await request(app).get('/items');
      assert.equal((await request(app).get('/items')).headers['x-cache'], 'HIT');

      // 500 error on PATCH
      const patchRes = await request(app).patch('/items/1');
      assert.equal(patchRes.status, 500);

      // Cache remains HIT
      const afterRes = await request(app).get('/items');
      assert.equal(afterRes.headers['x-cache'], 'HIT');
      assert.equal(getCount, 1);
    });

    test('DELETE throwing an unhandled exception does not invalidate cache', async () => {
      const app = express();
      const { middleware, invalidate } = cache.createCache();
      let getCount = 0;

      app.get('/items', middleware({ tags: ['items'] }), (req, res) => {
        getCount++;
        res.status(200).json({ count: getCount });
      });

      app.delete('/items/:id', invalidate({ tags: ['items'] }), (req, res, next) => {
        return next(new Error('Unexpected database crash during deletion'));
      });

      // Error handler sends 500
      app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
        res.status(500).json({ error: err.message });
      });

      // Warm cache
      await request(app).get('/items');
      assert.equal((await request(app).get('/items')).headers['x-cache'], 'HIT');

      // Crashed DELETE
      const delRes = await request(app).delete('/items/1');
      assert.equal(delRes.status, 500);

      // Cache remains HIT
      const afterRes = await request(app).get('/items');
      assert.equal(afterRes.headers['x-cache'], 'HIT');
      assert.equal(getCount, 1);
    });
  });

  // C. RESOURCE ISOLATION TESTS
  describe('C. Resource Isolation', () => {
    test('Updating product 1 does NOT invalidate product 10', async () => {
      const app = express();
      app.use(express.json());
      const { middleware, invalidate } = cache.createCache();

      app.get('/products/:id', middleware({ tags: (req) => [`product:${req.params.id}`] }), (req, res) => {
        res.status(200).json({ id: req.params.id, time: Date.now() });
      });

      app.put('/products/:id', invalidate({ tags: (req) => [`product:${req.params.id}`] }), (req, res) => {
        res.status(200).json({ updated: req.params.id });
      });

      // Cache product 1 and product 10
      const p1Original = await request(app).get('/products/1');
      const p10Original = await request(app).get('/products/10');

      assert.equal((await request(app).get('/products/1')).headers['x-cache'], 'HIT');
      assert.equal((await request(app).get('/products/10')).headers['x-cache'], 'HIT');

      // Update product 1
      await request(app).put('/products/1').send({ name: 'P1 updated' });

      // Product 1 must be invalidated (MISS)
      const p1After = await request(app).get('/products/1');
      assert.equal(p1After.headers['x-cache'], 'MISS');

      // Product 10 must STILL be a HIT with exact original payload!
      const p10After = await request(app).get('/products/10');
      assert.equal(p10After.headers['x-cache'], 'HIT');
      assert.deepEqual(p10After.body, p10Original.body);
    });

    test('Updating products does NOT invalidate unrelated user-resource entries', async () => {
      const app = express();
      app.use(express.json());
      const { middleware, invalidate } = cache.createCache();

      app.get('/products', middleware({ tags: ['products'] }), (req, res) => {
        res.status(200).json({ products: [1, 2] });
      });

      app.get('/users', middleware({ tags: ['users'] }), (req, res) => {
        res.status(200).json({ users: ['alice', 'bob'] });
      });

      app.post('/products', invalidate({ tags: ['products'] }), (req, res) => {
        res.status(201).json({ created: true });
      });

      // Warm caches
      await request(app).get('/products');
      await request(app).get('/users');
      assert.equal((await request(app).get('/products')).headers['x-cache'], 'HIT');
      assert.equal((await request(app).get('/users')).headers['x-cache'], 'HIT');

      // Mutate products
      await request(app).post('/products').send({ name: 'Widget' });

      // Products is invalidated
      assert.equal((await request(app).get('/products')).headers['x-cache'], 'MISS');

      // Users remains HIT!
      assert.equal((await request(app).get('/users')).headers['x-cache'], 'HIT');
    });

    test('Collection query variants are all invalidated when collection tag is purged', async () => {
      const app = express();
      app.use(express.json());
      const { middleware, invalidate } = cache.createCache();

      app.get('/products', middleware({ tags: ['products'] }), (req, res) => {
        res.status(200).json({ query: req.query });
      });

      app.post('/products', invalidate({ tags: ['products'] }), (req, res) => {
        res.status(201).json({ created: true });
      });

      // Warm various queries
      await request(app).get('/products?page=1&limit=10');
      await request(app).get('/products?page=2&limit=10');
      await request(app).get('/products?category=Electronics');
      await request(app).get('/products');

      // Verify they are all cached
      assert.equal((await request(app).get('/products?page=1&limit=10')).headers['x-cache'], 'HIT');
      assert.equal((await request(app).get('/products?page=2&limit=10')).headers['x-cache'], 'HIT');
      assert.equal((await request(app).get('/products?category=Electronics')).headers['x-cache'], 'HIT');
      assert.equal((await request(app).get('/products')).headers['x-cache'], 'HIT');

      // Mutate collection
      await request(app).post('/products').send({ name: 'Keyboard' });

      // All query variants must now be cache MISS!
      assert.equal((await request(app).get('/products?page=1&limit=10')).headers['x-cache'], 'MISS');
      assert.equal((await request(app).get('/products?page=2&limit=10')).headers['x-cache'], 'MISS');
      assert.equal((await request(app).get('/products?category=Electronics')).headers['x-cache'], 'MISS');
      assert.equal((await request(app).get('/products')).headers['x-cache'], 'MISS');
    });

    test('Multi-tag entries are correctly invalidated by either tag', async () => {
      const app = express();
      app.use(express.json());
      const { middleware, invalidate } = cache.createCache();

      app.get(
        '/tagged-both',
        middleware({ tags: ['tag-alpha', 'tag-beta'] }),
        (req, res) => res.status(200).json({ ok: true })
      );

      app.post('/invalidate-alpha', invalidate({ tags: ['tag-alpha'] }), (req, res) => {
        res.status(200).json({ purged: 'alpha' });
      });

      // 1. Invalidate via alpha
      await request(app).get('/tagged-both');
      assert.equal((await request(app).get('/tagged-both')).headers['x-cache'], 'HIT');

      await request(app).post('/invalidate-alpha');
      assert.equal((await request(app).get('/tagged-both')).headers['x-cache'], 'MISS');
    });
  });

  // D. DEMONSTRATION APPLICATION INTEGRATION
  describe('D. Demonstration Application Mutation Lifecycle', () => {
    test('POST /products invalidates product collection while preserving details', async () => {
      // Warm collection and product 1 & 2
      await request(demoApp).get('/products');
      await request(demoApp).get('/products/1');
      await request(demoApp).get('/products/2');

      assert.equal((await request(demoApp).get('/products')).headers['x-cache'], 'HIT');
      assert.equal((await request(demoApp).get('/products/1')).headers['x-cache'], 'HIT');
      assert.equal((await request(demoApp).get('/products/2')).headers['x-cache'], 'HIT');

      // Create new product
      const createRes = await request(demoApp)
        .post('/products')
        .send({ name: 'New Smart Watch', category: 'Electronics', price: 149.99 });
      assert.equal(createRes.status, 201);
      assert.ok(createRes.body.data.id);

      // GET /products is invalidated (MISS) and contains newly created product
      const collectionAfter = await request(demoApp).get('/products');
      assert.equal(collectionAfter.headers['x-cache'], 'MISS');
      assert.ok(collectionAfter.body.data.some((p) => p.name === 'New Smart Watch'));

      // Product 1 and 2 detail caches remain HIT!
      assert.equal((await request(demoApp).get('/products/1')).headers['x-cache'], 'HIT');
      assert.equal((await request(demoApp).get('/products/2')).headers['x-cache'], 'HIT');
    });

    test('PUT /products/1 invalidates collection and product 1 detail, leaving product 2 intact', async () => {
      // Warm caches
      await request(demoApp).get('/products');
      await request(demoApp).get('/products/1');
      await request(demoApp).get('/products/2');

      // Update product 1
      const updateRes = await request(demoApp)
        .put('/products/1')
        .send({ name: 'Upgraded Wireless Headphones', price: 249.99 });
      assert.equal(updateRes.status, 200);

      // Collection is invalidated
      assert.equal((await request(demoApp).get('/products')).headers['x-cache'], 'MISS');

      // Product 1 detail is invalidated
      const p1After = await request(demoApp).get('/products/1');
      assert.equal(p1After.headers['x-cache'], 'MISS');
      assert.equal(p1After.body.data.name, 'Upgraded Wireless Headphones');

      // Product 2 detail is UNTOUCHED (HIT)
      assert.equal((await request(demoApp).get('/products/2')).headers['x-cache'], 'HIT');
    });

    test('DELETE /products/2 invalidates collection and product 2 detail', async () => {
      // Warm caches
      await request(demoApp).get('/products');
      await request(demoApp).get('/products/2');

      // Delete product 2
      const delRes = await request(demoApp).delete('/products/2');
      assert.equal(delRes.status, 200);

      // Collection is invalidated
      assert.equal((await request(demoApp).get('/products')).headers['x-cache'], 'MISS');

      // Product 2 is invalidated (subsequent GET returns 404 MISS)
      const p2After = await request(demoApp).get('/products/2');
      assert.equal(p2After.status, 404);
      assert.equal(p2After.headers['x-cache'], 'MISS');
    });

    test('Failed mutation on demoApp (POST invalid data) does not invalidate cache', async () => {
      // Warm collection
      await request(demoApp).get('/products');
      assert.equal((await request(demoApp).get('/products')).headers['x-cache'], 'HIT');

      // Send invalid payload (missing name)
      const badPost = await request(demoApp).post('/products').send({ price: 10 });
      assert.equal(badPost.status, 400);

      // Collection remains cached
      assert.equal((await request(demoApp).get('/products')).headers['x-cache'], 'HIT');
    });
  });

  // E. EDGE CASES & CONFIGURATION
  describe('E. Edge Cases & Configuration', () => {
    test('Invalidation middleware validates options properly', () => {
      assert.throws(() => cache.invalidate({ tags: [] }), TypeError);
      assert.throws(() => cache.invalidate({ tags: null }), TypeError);
      assert.throws(() => cache.invalidate({ tags: 123 }), TypeError);
    });

    test('Bypasses invalidation when enabled: false', async () => {
      const app = express();
      const { middleware, invalidate } = cache.createCache();

      app.get('/items', middleware({ tags: ['items'] }), (req, res) => {
        res.status(200).json({ ok: true });
      });

      app.post('/items', invalidate({ tags: ['items'], enabled: false }), (req, res) => {
        res.status(201).json({ created: true });
      });

      await request(app).get('/items');
      assert.equal((await request(app).get('/items')).headers['x-cache'], 'HIT');

      // POST with enabled: false does NOT invalidate
      await request(app).post('/items');
      assert.equal((await request(app).get('/items')).headers['x-cache'], 'HIT');
    });

    test('Bypasses methods not configured in options.methods', async () => {
      const app = express();
      const { middleware, invalidate } = cache.createCache();

      app.get('/items', middleware({ tags: ['items'] }), (req, res) => {
        res.status(200).json({ ok: true });
      });

      // Only monitors DELETE, ignores POST
      app.post('/items', invalidate({ tags: ['items'], methods: ['DELETE'] }), (req, res) => {
        res.status(201).json({ created: true });
      });

      await request(app).get('/items');
      assert.equal((await request(app).get('/items')).headers['x-cache'], 'HIT');

      // POST is ignored
      await request(app).post('/items');
      assert.equal((await request(app).get('/items')).headers['x-cache'], 'HIT');
    });
  });
});
