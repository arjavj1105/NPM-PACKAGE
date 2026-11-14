'use strict';

const productDatabase = require('../database/productDatabase');

/**
 * Helper to simulate network/query latency typical of real production databases.
 * @param {number} ms - Milliseconds to delay.
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Product Service.
 * Implements business operations for products.
 */
class ProductService {
  /**
   * Retrieves all products.
   * Simulates a 200ms database query to demonstrate caching speedups.
   *
   * @param {Object} [filter={}] - Query filters (e.g., category, inStock)
   * @returns {Promise<Array>}
   */
  async getAllProducts(filter = {}) {
    // Simulate database lookup latency
    await delay(200);

    let products = await productDatabase.findAll();

    if (filter.category) {
      products = products.filter(
        (p) => p.category.toLowerCase() === filter.category.toLowerCase()
      );
    }

    if (filter.inStock !== undefined) {
      const isStock = filter.inStock === 'true' || filter.inStock === true;
      products = products.filter((p) => p.inStock === isStock);
    }

    return products;
  }

  /**
   * Retrieves a single product by ID.
   * Simulates a 150ms database query.
   *
   * @param {number|string} id - Product ID
   * @returns {Promise<Object|null>}
   */
  async getProductById(id) {
    // Simulate database lookup latency
    await delay(150);

    return productDatabase.findById(id);
  }
}

module.exports = new ProductService();
