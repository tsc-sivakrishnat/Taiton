const { pool } = require('../../resources/connection');
const CATEGORY_QUERIES = require('../queries/category.queries');
const { logAudit } = require('../utils/auditLogger');

class CategoryService {
  async getCategories(orgCode) {
    const [rows] = await pool.execute(CATEGORY_QUERIES.GET_ALL_CATEGORIES, [orgCode]);
    return rows;
  }

  async getCategoryById(id, orgCode) {
    const [rows] = await pool.execute(CATEGORY_QUERIES.GET_CATEGORY_BY_ID, [id, orgCode]);
    return rows.length > 0 ? rows[0] : null;
  }

  async createCategory(orgCode, { category, img = null, status = 'draft' }) {
    const [result] = await pool.execute(CATEGORY_QUERIES.INSERT_CATEGORY, [orgCode, category, img, status]);
    
    await logAudit({
      orgCode,
      tableName: 'tb_cpanel_categories',
      recordId: result.insertId,
      action: 'insert',
      message: `Created Category "${category}"`,
      newVal: { category, img, status }
    });

    return {
      id: result.insertId,
      org_code: orgCode,
      category,
      img,
      status,
    };
  }

  async updateCategory(id, orgCode, { category = null, img = null, status = null }) {
    const [oldRows] = await pool.execute(CATEGORY_QUERIES.GET_CATEGORY_BY_ID, [id, orgCode]);
    const oldVal = oldRows[0] || null;

    const [result] = await pool.execute(CATEGORY_QUERIES.UPDATE_CATEGORY, [category, img, status, id, orgCode]);
    
    if (result.affectedRows > 0) {
      await logAudit({
        orgCode,
        tableName: 'tb_cpanel_categories',
        recordId: id,
        action: 'update',
        message: `Updated Category ID #${id}`,
        oldVal,
        newVal: { category, img, status }
      });
    }

    return result.affectedRows > 0;
  }

  async deleteCategory(id, orgCode) {
    const [oldRows] = await pool.execute(CATEGORY_QUERIES.GET_CATEGORY_BY_ID, [id, orgCode]);
    const oldVal = oldRows[0] || null;

    const [result] = await pool.execute(CATEGORY_QUERIES.DELETE_CATEGORY, [id, orgCode]);
    
    if (result.affectedRows > 0) {
      await logAudit({
        orgCode,
        tableName: 'tb_cpanel_categories',
        recordId: id,
        action: 'delete',
        message: `Deleted Category ID #${id}`,
        oldVal
      });
    }

    return result.affectedRows > 0;
  }

  async getSubCategories(orgCode) {
    const [rows] = await pool.execute(CATEGORY_QUERIES.GET_ALL_SUB_CATEGORIES, [orgCode]);
    return rows;
  }

  async getSubCategoriesByCatId(catId) {
    const [rows] = await pool.execute(CATEGORY_QUERIES.GET_SUB_CATEGORIES_BY_CAT_ID, [catId]);
    return rows;
  }

  async createSubCategory({ orgCode, cat_id, sub_category, img = null, status = 'draft' }) {
    const targetOrg = orgCode;
    const [result] = await pool.execute(CATEGORY_QUERIES.INSERT_SUB_CATEGORY, [targetOrg, cat_id, sub_category, img, status]);
    
    await logAudit({
      orgCode: targetOrg,
      tableName: 'tb_cpanel_sub_categories',
      recordId: result.insertId,
      action: 'insert',
      message: `Created Sub-Category "${sub_category}" under Category ID #${cat_id}`,
      newVal: { cat_id, sub_category, img, status }
    });

    return {
      id: result.insertId,
      cat_id,
      sub_category,
      img,
      status,
    };
  }

  async updateSubCategory(id, { orgCode, sub_category = null, img = null, status = null }) {
    const [result] = await pool.execute(CATEGORY_QUERIES.UPDATE_SUB_CATEGORY, [sub_category, img, status, id]);
    
    if (result.affectedRows > 0) {
      await logAudit({
        orgCode: orgCode || null,
        tableName: 'tb_cpanel_sub_categories',
        recordId: id,
        action: 'update',
        message: `Updated Sub-Category ID #${id}`,
        newVal: { sub_category, img, status }
      });
    }

    return result.affectedRows > 0;
  }

  async deleteSubCategory(id, orgCode = null) {
    const [result] = await pool.execute(CATEGORY_QUERIES.DELETE_SUB_CATEGORY, [id]);
    
    if (result.affectedRows > 0) {
      await logAudit({
        orgCode: orgCode || null,
        tableName: 'tb_cpanel_sub_categories',
        recordId: id,
        action: 'delete',
        message: `Deleted Sub-Category ID #${id}`
      });
    }

    return result.affectedRows > 0;
  }
}

module.exports = new CategoryService();
