'use strict';

const express = require('express');
const productController = require('../controllers/productController');
const cache = require('../../src');

const router = express.Router();

/**
 * Route definitions:
 * - GET    /products     : Cached for 30 seconds with tag 'products'
 * - GET    /products/:id : Cached for 60 seconds with tag 'product:<id>'
 * - POST   /products     : Creates product, invalidates 'products' collection cache
 * - PUT    /products/:id : Replaces product, invalidates 'products' collection & 'product:<id>'
 * - PATCH  /products/:id : Patches product, invalidates 'products' collection & 'product:<id>'
 * - DELETE /products/:id : Deletes product, invalidates 'products' collection & 'product:<id>'
 */

// Cache collection responses for 30 seconds
router.get(
  '/',
  cache({ ttl: 30, tags: ['products'] }),
  (req, res, next) => productController.getAllProducts(req, res, next)
);

// Cache individual product lookups for 60 seconds
router.get(
  '/:id',
  cache({
    ttl: 60,
    tags: (req) => [`product:${req.params.id}`],
  }),
  (req, res, next) => productController.getProductById(req, res, next)
);

// Create product -> Invalidates collection queries
router.post(
  '/',
  cache.invalidate({ tags: ['products'] }),
  (req, res, next) => productController.createProduct(req, res, next)
);

// Fully update product -> Invalidates collection queries and affected product detail
router.put(
  '/:id',
  cache.invalidate({
    tags: (req) => ['products', `product:${req.params.id}`],
  }),
  (req, res, next) => productController.updateProduct(req, res, next)
);

// Partially update product -> Invalidates collection queries and affected product detail
router.patch(
  '/:id',
  cache.invalidate({
    tags: (req) => ['products', `product:${req.params.id}`],
  }),
  (req, res, next) => productController.patchProduct(req, res, next)
);

// Delete product -> Invalidates collection queries and affected product detail
router.delete(
  '/:id',
  cache.invalidate({
    tags: (req) => ['products', `product:${req.params.id}`],
  }),
  (req, res, next) => productController.deleteProduct(req, res, next)
);

module.exports = router;
