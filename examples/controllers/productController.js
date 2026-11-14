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
}

module.exports = new ProductController();
