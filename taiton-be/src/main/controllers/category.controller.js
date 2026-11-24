const categoryService = require('../services/category.service');

class CategoryController {
  // GET /cpanel-api/getCategories
  async getCategories(req, res) {
    try {
      const orgCode = req.query.org_code || process.env.DEFAULT_PUBLIC_ORG_CODE || 'techtrole';
      const categories = await categoryService.getCategories(orgCode);
      return res.status(200).json({
        success: true,
        data: categories,
      });
    } catch (error) {
      console.error('[CategoryController.getCategories] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch categories',
        error: error.message,
      });
    }
  }

  // POST /cpanel-api/createCategory
  async createCategory(req, res) {
    try {
      const orgCode = req.body.org_code || req.query.org_code || 'techtrole';
      const { category, img, status } = req.body;

      if (!category) {
        return res.status(400).json({
          success: false,
          message: 'Category name is required',
        });
      }

      const newCategory = await categoryService.createCategory(orgCode, { category, img, status });
      return res.status(201).json({
        success: true,
        message: 'Category created successfully',
        data: newCategory,
      });
    } catch (error) {
      console.error('[CategoryController.createCategory] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create category',
        error: error.message,
      });
    }
  }

  // GET /cpanel-api/getSubCategories
  async getSubCategories(req, res) {
    try {
      const orgCode = req.query.org_code || 'techtrole';
      const subCategories = await categoryService.getSubCategories(orgCode);
      return res.status(200).json({
        success: true,
        data: subCategories,
      });
    } catch (error) {
      console.error('[CategoryController.getSubCategories] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch sub-categories',
        error: error.message,
      });
    }
  }

  // POST /cpanel-api/createSubCategory
  async createSubCategory(req, res) {
    try {
      const { cat_id, sub_category, img, status } = req.body;
      if (!cat_id || !sub_category) {
        return res.status(400).json({
          success: false,
          message: 'Category ID (cat_id) and sub_category name are required',
        });
      }

      const newSubCategory = await categoryService.createSubCategory({ cat_id, sub_category, img, status });
      return res.status(201).json({
        success: true,
        message: 'Sub-category created successfully',
        data: newSubCategory,
      });
    } catch (error) {
      console.error('[CategoryController.createSubCategory] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create sub-category',
        error: error.message,
      });
    }
  }

  // DELETE /cpanel-api/categories/:id
  async deleteCategory(req, res) {
    try {
      const { id } = req.params;
      const orgCode = req.query.org_code || 'techtrole';
      const deleted = await categoryService.deleteCategory(id, orgCode);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: `Category with ID ${id} not found`,
        });
      }
      return res.status(200).json({
        success: true,
        message: 'Category archived successfully',
      });
    } catch (error) {
      console.error('[CategoryController.deleteCategory] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete category',
        error: error.message,
      });
    }
  }
}

module.exports = new CategoryController();
