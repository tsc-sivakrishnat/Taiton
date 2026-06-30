import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import XLSX from 'xlsx';
import { requireAuth } from '../middleware/auth.js';
import * as contentService from '../services/content.service.js';

export const contentRouter = Router();

// Multer memory storage for parsing Excel and matching images in memory
const memoryStorage = multer.memoryStorage();

const upload = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // limit 10MB
});

// Endpoint to upload a single image individually
contentRouter.post('/upload-image', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
    const ext = path.extname(req.file.originalname).toLowerCase();
    const filename = `img-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const destDir = path.join(process.cwd(), 'uploads', 'images');
    await fs.mkdir(destDir, { recursive: true });
    await fs.writeFile(path.join(destDir, filename), req.file.buffer);

    res.json({
      url: `/uploads/images/${filename}`
    });
  } catch (e) {
    res.status(500).json({ error: e.message ?? 'Image upload failed' });
  }
});

// Products Template Export
contentRouter.get('/products/export-template', requireAuth, (req, res) => {
  try {
    const wb = XLSX.utils.book_new();

    const categoriesHeaders = [['cat_id', 'category_name', 'seo_meta_title', 'seo_meta_description', 'focus_keyword', 'secondary_keywords', 'related_products']];
    categoriesHeaders.push(['sample-cat-1', 'Electronics', 'Electronics SEO Title', 'Electronics SEO Desc', 'electronics', 'gadgets, devices', '']);

    const subCategoriesHeaders = [['sub_cat_id', 'parent_cat_id', 'sub_category_name', 'url', 'seo_meta_title', 'seo_meta_description', 'focus_keyword', 'secondary_keywords', 'related_products']];
    subCategoriesHeaders.push(['sample-subcat-1', 'sample-cat-1', 'Smartphones', 'smartphones', 'Smartphones SEO Title', 'Smartphones SEO Desc', 'smartphones', 'iphones, androids', '']);

    const productsHeaders = [['prd_id', 'cat_id', 'sub_cat_id', 'product_name', 'product_code', 'url', 'seo_meta_title', 'seo_meta_description', 'focus_keyword', 'secondary_keywords', 'product_description', 'product_features', 'product_specifications', 'canonical_url', 'product_image']];
    productsHeaders.push(['sample-prd-1', 'sample-cat-1', 'sample-subcat-1', 'iPhone 15 Pro', 'IPH15P', 'iphone-15-pro', 'iPhone 15 Pro Meta Title', 'iPhone 15 Pro Meta Desc', 'iphone 15 pro', 'apple phone, smartphone', 'Latest Apple iPhone with titanium frame.', 'Feature 1; Feature 2', 'Spec1: Val1; Spec2: Val2', 'https://example.com/iphone-15-pro', 'iphone-15-pro.png']);

    const variantsHeaders = [['variant_id', 'product_id', 'variant_name', 'variant_slug', 'variant_code', 'color_finish', 'sku', 'image_url', 'image_alt_text', 'variant_title', 'variant_order']];
    variantsHeaders.push(['sample-var-1', 'sample-prd-1', 'iPhone 15 Pro Titanium', 'iphone-15-pro-titanium', 'IPH15P-TITAN', 'Titanium Gray', 'SKU-TITAN-128', 'titanium.png', 'iPhone Titanium Frame', 'iPhone 15 Pro Titanium Finish', 0]);

    const ws1 = XLSX.utils.aoa_to_sheet(categoriesHeaders);
    const ws2 = XLSX.utils.aoa_to_sheet(subCategoriesHeaders);
    const ws3 = XLSX.utils.aoa_to_sheet(productsHeaders);
    const ws4 = XLSX.utils.aoa_to_sheet(variantsHeaders);

    // Apply auto-column-width mapping for spaces
    const applyColWidths = (ws, headers) => {
      ws['!cols'] = headers[0].map((h) => ({
        wch: Math.max(String(h).length + 4, 18)
      }));
    };
    applyColWidths(ws1, categoriesHeaders);
    applyColWidths(ws2, subCategoriesHeaders);
    applyColWidths(ws3, productsHeaders);
    applyColWidths(ws4, variantsHeaders);

    XLSX.utils.book_append_sheet(wb, ws1, 'Categories');
    XLSX.utils.book_append_sheet(wb, ws2, 'SubCategories');
    XLSX.utils.book_append_sheet(wb, ws3, 'Products');
    XLSX.utils.book_append_sheet(wb, ws4, 'Variants');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="products_template.xlsx"');
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: e.message ?? 'Export failed' });
  }
});

// Products Bulk Upload (Excel + Images)
contentRouter.post('/products/bulk-upload', requireAuth, upload.fields([
  { name: 'excelFile', maxCount: 1 },
  { name: 'images', maxCount: 100 }
]), async (req, res) => {
  try {
    const excelFile = req.files['excelFile']?.[0];
    const images = req.files['images'] || [];

    if (!excelFile) {
      return res.status(400).json({ error: 'Excel file is required.' });
    }

    // Save and map images
    const imageMap = {};
    const destDir = path.join(process.cwd(), 'uploads', 'images');
    await fs.mkdir(destDir, { recursive: true });

    for (const img of images) {
      const ext = path.extname(img.originalname).toLowerCase();
      const filename = `img-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      await fs.writeFile(path.join(destDir, filename), img.buffer);
      imageMap[img.originalname] = `/uploads/images/${filename}`;
    }

    const workbook = XLSX.read(excelFile.buffer, { type: 'buffer' });

    let createdCats = 0;
    let createdSubs = 0;
    let createdPrds = 0;

    // 1. Process Categories
    if (workbook.Sheets['Categories']) {
      const catRows = XLSX.utils.sheet_to_json(workbook.Sheets['Categories']);
      for (const row of catRows) {
        if (!row.cat_id || !row.category_name) continue;
        let imgPath = row.category_image || null;
        if (imgPath && imageMap[imgPath]) {
          imgPath = imageMap[imgPath];
        }
        const payload = {
          cat_id: String(row.cat_id).trim(),
          seo_meta_title: row.seo_meta_title || null,
          seo_meta_description: row.seo_meta_description || null,
          focus_keyword: row.focus_keyword || null,
          secondary_keywords: row.secondary_keywords || null,
          category_image: imgPath,
          image_alt_text: row.image_alt_text || null,
          related_products: row.related_products || null,
        };
        await contentService.createContent({
          organizationId: req.auth.organizationId,
          contentType: 'category',
          title: String(row.category_name).trim(),
          payload,
          callerAuth: req.auth
        });
        createdCats++;
      }
    }

    // 2. Process SubCategories
    if (workbook.Sheets['SubCategories']) {
      const subRows = XLSX.utils.sheet_to_json(workbook.Sheets['SubCategories']);
      for (const row of subRows) {
        if (!row.sub_cat_id || !row.sub_category_name) continue;
        const payload = {
          sub_cat_id: String(row.sub_cat_id).trim(),
          parent_cat_id: String(row.parent_cat_id || '').trim(),
          url: row.url || null,
          seo_meta_title: row.seo_meta_title || null,
          seo_meta_description: row.seo_meta_description || null,
          focus_keyword: row.focus_keyword || null,
          secondary_keywords: row.secondary_keywords || null,
          related_products: row.related_products || null,
          image_alt_text: row.image_alt_text || null,
        };
        await contentService.createContent({
          organizationId: req.auth.organizationId,
          contentType: 'subcategory',
          title: String(row.sub_category_name).trim(),
          payload,
          callerAuth: req.auth
        });
        createdSubs++;
      }
    }

    // 3. Process Products
    if (workbook.Sheets['Products']) {
      const prdRows = XLSX.utils.sheet_to_json(workbook.Sheets['Products']);
      for (const row of prdRows) {
        if (!row.prd_id || !row.product_name) continue;

        let features = [];
        if (row.product_features) {
          const str = String(row.product_features).trim();
          if (str.startsWith('[') || str.startsWith('{')) {
            try { features = JSON.parse(str); } catch {}
          } else {
            features = str.split(';').map(x => x.trim()).filter(Boolean);
          }
        }

        let specs = {};
        if (row.product_specifications) {
          const str = String(row.product_specifications).trim();
          if (str.startsWith('{')) {
            try { specs = JSON.parse(str); } catch {}
          } else {
            str.split(';').forEach(part => {
              const [k, v] = part.split(':').map(x => x.trim());
              if (k) specs[k] = v || '';
            });
          }
        }

        let prdImgPath = row.product_image || null;
        if (prdImgPath && imageMap[prdImgPath]) {
          prdImgPath = imageMap[prdImgPath];
        }

        const payload = {
          prd_id: String(row.prd_id).trim(),
          cat_id: String(row.cat_id || '').trim(),
          sub_cat_id: String(row.sub_cat_id || '').trim(),
          productCode: row.product_code || null,
          url: row.url || null,
          seo_meta_title: row.seo_meta_title || null,
          seo_meta_description: row.seo_meta_description || null,
          focus_keyword: row.focus_keyword || null,
          secondary_keywords: row.secondary_keywords || null,
          productDescription: row.product_description || null,
          product_features: features,
          product_specifications: specs,
          canonical_url: row.canonical_url || null,
          product_image: prdImgPath,
        };

        await contentService.createContent({
          organizationId: req.auth.organizationId,
          contentType: 'product',
          title: String(row.product_name).trim(),
          payload,
          callerAuth: req.auth
        });
        createdPrds++;
      }
    }

    // 4. Process Variants
    let createdVariants = 0;
    if (workbook.Sheets['Variants']) {
      const variantRows = XLSX.utils.sheet_to_json(workbook.Sheets['Variants']);
      for (const row of variantRows) {
        if (!row.variant_id || !row.variant_name) continue;
        let imgPath = row.image_url || null;
        if (imgPath && imageMap[imgPath]) {
          imgPath = imageMap[imgPath];
        }
        const payload = {
          variant_id: String(row.variant_id).trim(),
          product_id: String(row.product_id || '').trim(),
          variant_name: String(row.variant_name).trim(),
          variant_slug: String(row.variant_slug || '').trim(),
          variant_code: row.variant_code || null,
          color_finish: row.color_finish || null,
          sku: row.sku || null,
          image_url: imgPath,
          image_alt_text: row.image_alt_text || null,
          variant_title: row.variant_title || null,
          variant_seo_title: row.variant_seo_title || null,
          variant_seo_description: row.variant_seo_description || null,
          related_products: row.related_products || null,
        };
        const itemObj = await contentService.createContent({
          organizationId: req.auth.organizationId,
          contentType: 'variant',
          title: String(row.variant_name).trim(),
          payload,
          callerAuth: req.auth
        });
        createdVariants++;
        
        // If live directly, sync variant flags on parent product
        if (itemObj && itemObj.status === 'live') {
          try {
            await contentService.updateProductVariantsFlag(req.auth.organizationId, payload.product_id);
          } catch (e) {}
        }
      }
    }

    res.json({
      ok: true,
      message: `Bulk upload successful. Imported ${createdCats} Categories, ${createdSubs} Sub Categories, ${createdPrds} Products, and ${createdVariants} Variants.`
    });
  } catch (e) {
    res.status(500).json({ error: e.message ?? 'Bulk upload failed' });
  }
});

// SEO Template Export
contentRouter.get('/seo/export-template', requireAuth, (req, res) => {
  try {
    const wb = XLSX.utils.book_new();
    const headers = [['page_url', 'seo_meta_title', 'seo_meta_description', 'focus_keyword', 'secondary_keywords', 'canonical_url', 'og_title', 'og_description', 'og_image']];
    headers.push(['/home', 'Home Page Title', 'Home Page Meta Description', 'home, main', 'welcome, homepage', 'https://example.com/home', 'Home OG Title', 'Home OG Description', 'home-og.jpg']);

    const ws = XLSX.utils.aoa_to_sheet(headers);
    XLSX.utils.book_append_sheet(wb, ws, 'SEO Pages');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="seo_template.xlsx"');
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: e.message ?? 'Export failed' });
  }
});

// SEO Bulk Upload
contentRouter.post('/seo/bulk-upload', requireAuth, upload.fields([
  { name: 'excelFile', maxCount: 1 },
  { name: 'images', maxCount: 100 }
]), async (req, res) => {
  try {
    const excelFile = req.files['excelFile']?.[0];
    const images = req.files['images'] || [];

    if (!excelFile) {
      return res.status(400).json({ error: 'Excel file is required.' });
    }

    const imageMap = {};
    const destDir = path.join(process.cwd(), 'uploads', 'images');
    await fs.mkdir(destDir, { recursive: true });

    for (const img of images) {
      const ext = path.extname(img.originalname).toLowerCase();
      const filename = `img-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      await fs.writeFile(path.join(destDir, filename), img.buffer);
      imageMap[img.originalname] = `/uploads/images/${filename}`;
    }

    const workbook = XLSX.read(excelFile.buffer, { type: 'buffer' });
    let imported = 0;

    if (workbook.Sheets['SEO Pages']) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets['SEO Pages']);
      for (const row of rows) {
        if (!row.page_url) continue;

        let ogImgPath = row.og_image || null;
        if (ogImgPath && imageMap[ogImgPath]) {
          ogImgPath = imageMap[ogImgPath];
        }

        const payload = {
          page_url: String(row.page_url).trim(),
          seo_meta_title: row.seo_meta_title || null,
          seo_meta_description: row.seo_meta_description || null,
          focus_keyword: row.focus_keyword || null,
          secondary_keywords: row.secondary_keywords || null,
          canonical_url: row.canonical_url || null,
          og_title: row.og_title || null,
          og_description: row.og_description || null,
          og_image: ogImgPath,
        };

        await contentService.createContent({
          organizationId: req.auth.organizationId,
          contentType: 'seo_page',
          title: String(row.page_url).trim(),
          payload,
          callerAuth: req.auth
        });
        imported++;
      }
    }

    res.json({
      ok: true,
      message: `Bulk upload successful. Imported ${imported} SEO configurations.`
    });
  } catch (e) {
    res.status(500).json({ error: e.message ?? 'Bulk upload failed' });
  }
});

// Blog Template Export
contentRouter.get('/blogs/export-template', requireAuth, (req, res) => {
  try {
    const wb = XLSX.utils.book_new();
    const headers = [[
      'blog_id', 'blog_title', 'url', 'url_slug', 'h1_tag', 
      'seo_meta_title', 'seo_meta_description', 'focus_keyword', 'secondary_keywords', 
      'canonical_url', 'og_title', 'og_description', 'og_image', 
      'schema_type', 'robots_tag', 'image_alt_text', 'blog_content', 
      'author_name', 'blog_category', 'reading_time', 'featured_image', 
      'publish_date', 'modified_date', 'faq_section', 'internal_linking_targets', 
      'related_products', 'redirect_url_301', 'last_updated_date', 'status'
    ]];
    headers.push([
      'blog-1', 'My First Blog Post', '/blog/my-first-post', 'my-first-post', 'Welcome to Taiton',
      'Meta title here', 'Meta description here', 'taiton', 'blog, article',
      'https://example.com/blog/my-first-post', 'OG Title', 'OG Description', 'featured.jpg',
      'Article', 'index, follow', 'Featured Image Alt', '<p>This is the blog content HTML...</p>',
      'John Doe', 'Hardware', '5 mins', 'featured.jpg',
      '2026-06-25 12:00:00', '2026-06-25 12:00:00', 'Q: What is Taiton?; A: It is premium hardware.', 'home',
      'prd-1, prd-2', '', '2026-06-25 12:00:00', 'draft'
    ]);

    const ws = XLSX.utils.aoa_to_sheet(headers);
    XLSX.utils.book_append_sheet(wb, ws, 'Blog Posts');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="blogs_template.xlsx"');
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: e.message ?? 'Export failed' });
  }
});

// Blog Bulk Upload
contentRouter.post('/blogs/bulk-upload', requireAuth, upload.fields([
  { name: 'excelFile', maxCount: 1 },
  { name: 'images', maxCount: 100 }
]), async (req, res) => {
  try {
    const excelFile = req.files['excelFile']?.[0];
    const images = req.files['images'] || [];

    if (!excelFile) {
      return res.status(400).json({ error: 'Excel file is required.' });
    }

    const imageMap = {};
    const destDir = path.join(process.cwd(), 'uploads', 'images');
    await fs.mkdir(destDir, { recursive: true });

    for (const img of images) {
      const ext = path.extname(img.originalname).toLowerCase();
      const filename = `img-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      await fs.writeFile(path.join(destDir, filename), img.buffer);
      imageMap[img.originalname] = `/uploads/images/${filename}`;
    }

    const workbook = XLSX.read(excelFile.buffer, { type: 'buffer' });
    let imported = 0;

    if (workbook.Sheets['Blog Posts']) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Blog Posts']);
      for (const row of rows) {
        if (!row.blog_id || !row.blog_title) continue;

        let ogImgPath = row.og_image || null;
        if (ogImgPath && imageMap[ogImgPath]) {
          ogImgPath = imageMap[ogImgPath];
        }
        let featImgPath = row.featured_image || null;
        if (featImgPath && imageMap[featImgPath]) {
          featImgPath = imageMap[featImgPath];
        }

        let faqs = [];
        if (row.faq_section) {
          const str = String(row.faq_section).trim();
          if (str.startsWith('[') || str.startsWith('{')) {
            try { faqs = JSON.parse(str); } catch {}
          } else {
            str.split(';').forEach(part => {
              const [q, a] = part.split(':').map(x => x.trim());
              if (q) faqs.push({ question: q.replace(/^Q\s*:\s*/i, ''), answer: a || '' });
            });
          }
        }

        const payload = {
          blog_id: String(row.blog_id).trim(),
          url: row.url || null,
          url_slug: String(row.url_slug || '').trim(),
          h1_tag: row.h1_tag || null,
          seo_meta_title: row.seo_meta_title || null,
          seo_meta_description: row.seo_meta_description || null,
          focus_keyword: row.focus_keyword || null,
          secondary_keywords: row.secondary_keywords || null,
          canonical_url: row.canonical_url || null,
          og_title: row.og_title || null,
          og_description: row.og_description || null,
          og_image: ogImgPath,
          schema_type: row.schema_type || null,
          robots_tag: row.robots_tag || null,
          image_alt_text: row.image_alt_text || null,
          blog_content: row.blog_content || null,
          author_name: row.author_name || null,
          blog_category: row.blog_category || null,
          reading_time: row.reading_time || null,
          featured_image: featImgPath,
          publish_date: row.publish_date || null,
          modified_date: row.modified_date || null,
          faq_section: faqs,
          internal_linking_targets: row.internal_linking_targets || null,
          related_products: row.related_products || null,
          redirect_url_301: row.redirect_url_301 || null,
          last_updated_date: row.last_updated_date || null,
          status: row.status || 'draft',
        };

        await contentService.createContent({
          organizationId: req.auth.organizationId,
          contentType: 'blog',
          title: String(row.blog_title).trim(),
          payload,
          callerAuth: req.auth
        });
        imported++;
      }
    }

    res.json({
      ok: true,
      message: `Bulk upload successful. Imported ${imported} blog posts.`
    });
  } catch (e) {
    res.status(500).json({ error: e.message ?? 'Bulk upload failed' });
  }
});

// Original routes maintained
contentRouter.get('/pending', requireAuth, async (req, res) => {
  try {
    const data = await contentService.listPendingContent({
      organizationId: req.auth.organizationId,
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

contentRouter.post('/approve/:id', requireAuth, async (req, res) => {
  try {
    const item = await contentService.approveContent({
      organizationId: req.auth.organizationId,
      id: Number(req.params.id),
      approve: req.body?.approve !== false,
      rejectionNote: req.body?.rejectionNote,
      callerAuth: req.auth,
    });
    res.json({ item });
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});

contentRouter.get('/:contentType', requireAuth, async (req, res) => {
  try {
    const data = await contentService.listContent({
      organizationId: req.auth.organizationId,
      roleCode: req.auth.role,
      contentType: req.params.contentType,
      limit: req.query.limit,
      offset: req.query.offset,
      status: req.query.status,
    });
    res.json(data);
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});

contentRouter.post('/:contentType', requireAuth, async (req, res) => {
  try {
    const item = await contentService.createContent({
      organizationId: req.auth.organizationId,
      contentType: req.params.contentType,
      title: req.body?.title,
      summary: req.body?.summary,
      payload: req.body?.payload,
      callerAuth: req.auth,
    });
    res.status(201).json({ item });
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});

contentRouter.patch('/:contentType/:id', requireAuth, async (req, res) => {
  try {
    const item = await contentService.updateContent({
      organizationId: req.auth.organizationId,
      contentType: req.params.contentType,
      id: Number(req.params.id),
      title: req.body?.title,
      summary: req.body?.summary,
      payload: req.body?.payload,
      callerAuth: req.auth,
    });
    res.json({ item });
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});

contentRouter.post('/:contentType/:id/approve', requireAuth, async (req, res) => {
  try {
    const item = await contentService.approveContent({
      organizationId: req.auth.organizationId,
      id: Number(req.params.id),
      approve: req.body?.approve !== false,
      rejectionNote: req.body?.rejectionNote,
      callerAuth: req.auth,
    });
    res.json({ item });
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});
