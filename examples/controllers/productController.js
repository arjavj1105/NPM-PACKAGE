'use strict';

const productService = require('../services/productService');

/**
 * Product Controller.
 * Handles incoming HTTP requests and delegates to ProductService.
 */
class ProductController {
  /**
   * GET /products
   * Returns list of products matching optional query filters.
   */
  async getAllProducts(req, res, next) {
    try {
      const { category, inStock } = req.query;
      const products = await productService.getAllProducts({ category, inStock });

      return res.status(200).json({
        success: true,
        count: products.length,
        data: products,
      });
    } catch (err) {
      return next(err);
    }
  }

  /**
   * GET /products/:id
   * Returns a single product by ID or 404 if not found.
   */
  async getProductById(req, res, next) {
    try {
      const { id } = req.params;
      const product = await productService.getProductById(id);

      if (!product) {
        return res.status(404).json({
          success: false,
          error: `Product with ID ${id} not found.`,
        });
      }

      return res.status(200).json({
        success: true,
        data: product,
      });
    } catch (err) {
      return next(err);
    }
  }

  /**
   * POST /products
   * Creates a new product.
   */
  async createProduct(req, res, next) {
    try {
      const { name, category, price, inStock, description } = req.body || {};

      if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Validation Error: "name" is required and must be a non-empty string.',
        });
      }

      if (price === undefined || isNaN(Number(price)) || Number(price) < 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error: "price" must be a non-negative number.',
        });
      }

      const created = await productService.createProduct({
        name: name.trim(),
        category,
        price,
        inStock,
        description,
      });

      return res.status(201).json({
        success: true,
        data: created,
      });
    } catch (err) {
      return next(err);
    }
  }

  /**
   * PUT /products/:id
   * Fully replaces/updates a product.
   */
  async updateProduct(req, res, next) {
    try {
      const { id } = req.params;
      const { name, category, price, inStock, description } = req.body || {};

      if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Validation Error: "name" is required.',
        });
      }

      const updated = await productService.updateProduct(id, {
        name: name.trim(),
        category,
        price,
        inStock,
        description,
      });

      if (!updated) {
        return res.status(404).json({
          success: false,
          error: `Product with ID ${id} not found.`,
        });
      }

      return res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (err) {
      return next(err);
    }
  }

  /**
   * PATCH /products/:id
   * Partially updates a product.
   */
  async patchProduct(req, res, next) {
    try {
      const { id } = req.params;
      const partialData = req.body || {};

      const patched = await productService.patchProduct(id, partialData);

      if (!patched) {
        return res.status(404).json({
          success: false,
          error: `Product with ID ${id} not found.`,
        });
      }

      return res.status(200).json({
        success: true,
        data: patched,
      });
    } catch (err) {
      return next(err);
    }
  }

  /**
   * DELETE /products/:id
   * Deletes a product.
   */
  async deleteProduct(req, res, next) {
    try {
      const { id } = req.params;
      const deleted = await productService.deleteProduct(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: `Product with ID ${id} not found.`,
        });
      }

      return res.status(200).json({
        success: true,
        message: `Product ${id} deleted successfully.`,
      });
    } catch (err) {
      return next(err);
    }
  }
}

module.exports = new ProductController();
