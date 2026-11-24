const productService = require('../services/product.service');

class ProductController {
  // GET /cpanel-api/getProducts
  async getProducts(req, res) {
    try {
      const orgCode = req.user?.org_code || req.query.org_code || req.body?.org_code || null;
      const products = await productService.getProducts(orgCode);
      return res.status(200).json({
        success: true,
        data: products,
      });
    } catch (error) {
      console.error('[ProductController.getProducts] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch products',
        error: error.message,
      });
    }
  }

  // GET /cpanel-api/products/:id
  async getProductById(req, res) {
    try {
      const { id } = req.params;
      const orgCode = req.user?.org_code || req.query.org_code || req.body?.org_code || null;
      const product = await productService.getProductById(id, orgCode);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found',
        });
      }
      return res.status(200).json({
        success: true,
        data: product,
      });
    } catch (error) {
      console.error('[ProductController.getProductById] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch product detail',
        error: error.message,
      });
    }
  }

  // POST /cpanel-api/createProduct
  async createProduct(req, res) {
    try {
      const orgCode = req.user?.org_code || req.body?.org_code || req.query?.org_code || null;
      const { cat_id, pdt_code, product } = req.body;

      if (!cat_id || !pdt_code || !product) {
        return res.status(400).json({
          success: false,
          message: 'cat_id, pdt_code, and product name are required',
        });
      }

      const newProduct = await productService.createProduct(orgCode, req.body);
      return res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: newProduct,
      });
    } catch (error) {
      console.error('[ProductController.createProduct] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create product',
        error: error.message,
      });
    }
  }

  // POST /cpanel-api/createVariant
  async createVariant(req, res) {
    try {
      const { pdt_id, var_code, name, sku } = req.body;
      if (!pdt_id || !var_code || !name || !sku) {
        return res.status(400).json({
          success: false,
          message: 'pdt_id, var_code, name, and sku are required for variant creation',
        });
      }

      const variant = await productService.createVariant(req.body);
      return res.status(201).json({
        success: true,
        message: 'Variant created successfully',
        data: variant,
      });
    } catch (error) {
      console.error('[ProductController.createVariant] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create product variant',
        error: error.message,
      });
    }
  }

  // DELETE /cpanel-api/products/:id
  async deleteProduct(req, res) {
    try {
      const { id } = req.params;
      const orgCode = req.user?.org_code || req.query.org_code || req.body?.org_code || null;
      const deleted = await productService.deleteProduct(id, orgCode);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: `Product with ID ${id} not found`,
        });
      }
      return res.status(200).json({
        success: true,
        message: 'Product archived successfully',
      });
    } catch (error) {
      console.error('[ProductController.deleteProduct] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete product',
        error: error.message,
      });
    }
  }
}

module.exports = new ProductController();
