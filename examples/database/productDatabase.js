'use strict';

/**
 * In-memory Mock Database for Demonstration.
 * Simulates a real database with seeded product records and CRUD operations.
 */
class ProductDatabase {
  constructor() {
    this.reset();
  }

  /**
   * Resets database to initial seeded records.
   */
  reset() {
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
    return this.products.map((p) => ({ ...p }));
  }

  /**
   * Finds a product by its numeric ID.
   * @param {number|string} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const numericId = Number(id);
    const product = this.products.find((p) => p.id === numericId);
    return product ? { ...product } : null;
  }

  /**
   * Inserts a new product into the database.
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async create(data) {
    const nextId = this.products.length > 0
      ? Math.max(...this.products.map((p) => p.id)) + 1
      : 1;

    const newProduct = {
      id: nextId,
      name: data.name,
      category: data.category || 'General',
      price: Number(data.price) || 0,
      inStock: data.inStock !== undefined ? Boolean(data.inStock) : true,
      description: data.description || '',
    };

    this.products.push(newProduct);
    return { ...newProduct };
  }

  /**
   * Fully updates an existing product.
   * @param {number|string} id
   * @param {Object} data
   * @returns {Promise<Object|null>}
   */
  async update(id, data) {
    const numericId = Number(id);
    const index = this.products.findIndex((p) => p.id === numericId);
    if (index === -1) {
      return null;
    }

    const updated = {
      id: numericId,
      name: data.name !== undefined ? data.name : this.products[index].name,
      category: data.category !== undefined ? data.category : this.products[index].category,
      price: data.price !== undefined ? Number(data.price) : this.products[index].price,
      inStock: data.inStock !== undefined ? Boolean(data.inStock) : this.products[index].inStock,
      description: data.description !== undefined ? data.description : this.products[index].description,
    };

    this.products[index] = updated;
    return { ...updated };
  }

  /**
   * Partially updates (patches) an existing product.
   * @param {number|string} id
   * @param {Object} partialData
   * @returns {Promise<Object|null>}
   */
  async patch(id, partialData) {
    const numericId = Number(id);
    const product = this.products.find((p) => p.id === numericId);
    if (!product) {
      return null;
    }

    Object.assign(product, partialData, { id: numericId });
    return { ...product };
  }

  /**
   * Deletes a product by ID.
   * @param {number|string} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    const numericId = Number(id);
    const index = this.products.findIndex((p) => p.id === numericId);
    if (index === -1) {
      return false;
    }

    this.products.splice(index, 1);
    return true;
  }
}

module.exports = new ProductDatabase();
