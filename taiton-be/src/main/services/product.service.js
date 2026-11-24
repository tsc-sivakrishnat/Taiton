const { pool } = require('../../resources/connection');
const PRODUCT_QUERIES = require('../queries/product.queries');

class ProductService {
  async getProducts(orgCode) {
    const cleanOrg = orgCode ?? null;
    const [rows] = await pool.execute(PRODUCT_QUERIES.GET_ALL_PRODUCTS, [cleanOrg, cleanOrg]);
    return rows;
  }

  async getProductById(id, orgCode) {
    const cleanOrg = orgCode ?? null;
    const [rows] = await pool.execute(PRODUCT_QUERIES.GET_PRODUCT_BY_ID, [id, cleanOrg, cleanOrg]);
    if (rows.length === 0) return null;

    const product = rows[0];
    const [variants] = await pool.execute(PRODUCT_QUERIES.GET_VARIANTS_BY_PDT_ID, [id]);
    product.variants = variants;
    return product;
  }

  async createProduct(orgCode, data) {
    const cleanOrg = orgCode ?? null;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const {
        parent_id = null,
        cat_id = null,
        sub_id = null,
        sub_sub_cat_id = null,
        pdt_code,
        product,
        primary_img = null,
        status = 'draft',
        desc = null,
        price = 0.0,
        features = null,
        specs = null,
        addl_features = null,
        pdt_imgs = null,
        acces = null,
        related_pdts = null,
      } = data;

      const resolvedParentId = parent_id || sub_sub_cat_id || sub_id || cat_id || null;

      const [pdtResult] = await connection.execute(PRODUCT_QUERIES.INSERT_PRODUCT, [
        cleanOrg,
        resolvedParentId,
        pdt_code,
        product,
        primary_img,
        status,
      ]);

      const pdtId = pdtResult.insertId;

      await connection.execute(PRODUCT_QUERIES.INSERT_PRODUCT_INFO, [
        pdtId,
        desc,
        price,
        features ? JSON.stringify(features) : null,
        specs ? JSON.stringify(specs) : null,
        addl_features ? JSON.stringify(addl_features) : null,
        pdt_imgs ? JSON.stringify(pdt_imgs) : null,
        acces ? JSON.stringify(acces) : null,
        related_pdts ? JSON.stringify(related_pdts) : null,
      ]);

      await connection.commit();

      return {
        id: pdtId,
        org_code: cleanOrg,
        pdt_code,
        product,
        status,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async updateProduct(id, data) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const {
        parent_id = null,
        cat_id = null,
        sub_id = null,
        sub_sub_cat_id = null,
        product = null,
        primary_img = null,
        status = null,
        desc = null,
        price = null,
        features = null,
        specs = null,
        addl_features = null,
        pdt_imgs = null,
        acces = null,
        related_pdts = null,
      } = data;

      const resolvedParentId = parent_id || sub_sub_cat_id || sub_id || cat_id || null;

      await connection.execute(PRODUCT_QUERIES.UPDATE_PRODUCT, [
        resolvedParentId,
        product,
        primary_img,
        status,
        id,
      ]);

      await connection.execute(PRODUCT_QUERIES.UPDATE_PRODUCT_INFO, [
        desc,
        price,
        features ? JSON.stringify(features) : null,
        specs ? JSON.stringify(specs) : null,
        addl_features ? JSON.stringify(addl_features) : null,
        pdt_imgs ? JSON.stringify(pdt_imgs) : null,
        acces ? JSON.stringify(acces) : null,
        related_pdts ? JSON.stringify(related_pdts) : null,
        id,
      ]);

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async deleteProduct(id, orgCode) {
    const cleanOrg = orgCode ?? null;
    const [result] = await pool.execute(PRODUCT_QUERIES.DELETE_PRODUCT, [id, cleanOrg, cleanOrg]);
    return result.affectedRows > 0;
  }
}

module.exports = new ProductService();
