'use strict';

/**
 * In-memory Mock Database for Demonstration.
 * Simulates a real database with seeded product records.
 */
class ProductDatabase {
  constructor() {
    this.products = [
      {
        id: 1,
        name: 'Wireless Noise-Canceling Headphones',
        category: 'Electronics',
        price: 199.99,
        inStock: true,
        description: 'Premium over-ear headphones with active noise cancellation.',
      },
      {
        id: 2,
        name: 'Mechanical Gaming Keyboard',
        category: 'Electronics',
        price: 89.99,
        inStock: true,
        description: 'RGB tactile mechanical switches with detachable USB-C cable.',
      },
      {
        id: 3,
        name: 'Ergonomic Desk Chair',
        category: 'Furniture',
        price: 299.5,
        inStock: false,
        description: 'Adjustable lumbar support and breathable mesh back.',
      },
      {
        id: 4,
        name: 'Stainless Steel Water Bottle',
        category: 'Lifestyle',
        price: 24.0,
        inStock: true,
        description: 'Vacuum-insulated bottle that keeps drinks cold for 24 hours.',
      },
      {
        id: 5,
        name: 'USB-C Multi-Port Hub',
        category: 'Accessories',
        price: 45.0,
        inStock: true,
        description: '7-in-1 hub supporting 4K HDMI, SD reader, and 100W PD charging.',
      },
    ];
  }

  /**
   * Returns all products from the mock database.
   * @returns {Promise<Array>}
   */
  async findAll() {
    // Return a shallow clone of the products to simulate DB query isolation
    return [...this.products];
  }

  /**
   * Finds a product by its numeric ID.
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const numericId = Number(id);
    const product = this.products.find((p) => p.id === numericId);
    return product ? { ...product } : null;
  }
}

module.exports = new ProductDatabase();
