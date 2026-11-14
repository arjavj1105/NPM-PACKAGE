'use strict';

const express = require('express');
const productController = require('../controllers/productController');
const cache = require('../../src');

const router = express.Router();

/**
 * Route definitions:
 * - GET /products: Cached for 30 seconds
 * - GET /products/:id: Cached for 60 seconds
 */

// Cache collection responses for 30 seconds
router.get(
  '/',
  cache({ ttl: 30 }),
  (req, res, next) => productController.getAllProducts(req, res, next)
);

// Cache individual product lookups for 60 seconds
router.get(
  '/:id',
  cache({ ttl: 60 }),
  (req, res, next) => productController.getProductById(req, res, next)
);

module.exports = router;
