const { pool } = require('../../resources/connection');
const CONTENT_QUERIES = require('../queries/content.queries');

class ContentService {
  // Blogs
  async getBlogs(orgCode) {
    const cleanOrg = orgCode ?? null;
    const [rows] = await pool.execute(CONTENT_QUERIES.GET_ALL_BLOGS, [cleanOrg, cleanOrg]);
    return rows;
  }

  async getBlogById(id, orgCode) {
    const cleanOrg = orgCode ?? null;
    const [rows] = await pool.execute(CONTENT_QUERIES.GET_BLOG_BY_ID, [id, cleanOrg, cleanOrg]);
    return rows.length > 0 ? rows[0] : null;
  }

  async createBlog(orgCode, data) {
    const cleanOrg = orgCode ?? null;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const {
        highlighter = null,
        title,
        description = null,
        written_by = null,
        status = 'draft',
        primary_image = null,
        post_content = null,
        related_links = null,
        related_posts = null,
      } = data;

      const [blogResult] = await connection.execute(CONTENT_QUERIES.INSERT_BLOG, [
        cleanOrg,
        highlighter,
        title,
        description,
        written_by,
        status,
      ]);

      const blogId = blogResult.insertId;

      await connection.execute(CONTENT_QUERIES.INSERT_BLOG_CONTENT, [
        blogId,
        primary_image,
        post_content,
        related_links ? JSON.stringify(related_links) : null,
        related_posts ? JSON.stringify(related_posts) : null,
      ]);

      await connection.commit();

      return {
        id: blogId,
        org_code: cleanOrg,
        title,
        status,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async deleteBlog(id, orgCode) {
    const cleanOrg = orgCode ?? null;
    const [result] = await pool.execute(CONTENT_QUERIES.DELETE_BLOG, [id, cleanOrg, cleanOrg]);
    return result.affectedRows > 0;
  }

  // Careers
  async getCareers(orgCode) {
    const cleanOrg = orgCode ?? null;
    const [rows] = await pool.execute(CONTENT_QUERIES.GET_ALL_CAREERS, [cleanOrg, cleanOrg]);
    return rows;
  }

  async createCareer(orgCode, data) {
    const cleanOrg = orgCode ?? null;
    const {
      title,
      department = null,
      location = null,
      employment_type = null,
      description = null,
      requirements = null,
      apply_link = null,
      status = 'draft',
    } = data;

    const [result] = await pool.execute(CONTENT_QUERIES.INSERT_CAREER, [
      cleanOrg,
      title,
      department,
      location,
      employment_type,
      description,
      requirements,
      apply_link,
      status,
    ]);

    return {
      id: result.insertId,
      org_code: cleanOrg,
      title,
      status,
    };
  }

  async deleteCareer(id, orgCode) {
    const cleanOrg = orgCode ?? null;
    const [result] = await pool.execute(CONTENT_QUERIES.DELETE_CAREER, [id, cleanOrg, cleanOrg]);
    return result.affectedRows > 0;
  }

  // Catalogs
  async getCatalogs(orgCode) {
    const cleanOrg = orgCode ?? null;
    const [rows] = await pool.execute(CONTENT_QUERIES.GET_ALL_CATALOGS, [cleanOrg, cleanOrg]);
    return rows;
  }

  async createCatalog(orgCode, data) {
    const cleanOrg = orgCode ?? null;
    const {
      name,
      category = null,
      file_url = '#',
      thumbnail_img = null,
      publish_year = null,
      product_page_thumbnail = null,
      page_name = null,
      image_1 = null,
      image_2 = null,
      page_groups = null,
      status = 'draft',
    } = data;

    const [result] = await pool.execute(CONTENT_QUERIES.INSERT_CATALOG, [
      cleanOrg,
      name,
      category,
      file_url,
      thumbnail_img,
      publish_year,
      product_page_thumbnail,
      page_name,
      image_1,
      image_2,
      page_groups ? (typeof page_groups === 'object' ? JSON.stringify(page_groups) : String(page_groups)) : null,
      status,
    ]);

    return {
      id: result.insertId,
      org_code: cleanOrg,
      name,
      status,
    };
  }

  async deleteCatalog(id, orgCode) {
    const cleanOrg = orgCode ?? null;
    const [result] = await pool.execute(CONTENT_QUERIES.DELETE_CATALOG, [id, cleanOrg, cleanOrg]);
    return result.affectedRows > 0;
  }
}

module.exports = new ContentService();
