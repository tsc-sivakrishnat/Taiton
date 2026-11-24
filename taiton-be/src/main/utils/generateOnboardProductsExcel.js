const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

/**
 * Builds the comprehensive Onboard Products Excel workbook with dynamic data validations and dropdowns.
 * @param {string} outputPath - File destination path
 * @param {object} dbData - Optional dynamic database records: { categories, products, catalogs, brands, colours, skipDbQuery }
 */
async function buildOnboardProductsExcel(outputPath, dbData = {}) {
  // If dbData is not provided or incomplete, attempt to query the pool if available
  let categories = dbData.categories || [];
  let products = dbData.products || [];
  let catalogs = dbData.catalogs || [];
  let brands = dbData.brands || [];
  let colours = dbData.colours || [];

  if ((!categories.length || !products.length) && !dbData.skipDbQuery) {
    try {
      const { pool } = require('../../resources/connection');
      if (pool) {
        if (!categories.length) {
          const [catRows] = await pool.execute(
            `SELECT id, type, parent_id, category FROM tb_pdt_categories WHERE LOWER(status) != 'deleted' ORDER BY id ASC`
          );
          categories = catRows || [];
        }
        if (!products.length) {
          const [pdtRows] = await pool.execute(
            `SELECT id, pdt_code, product FROM tb_pdt_products WHERE LOWER(status) != 'deleted' ORDER BY id ASC`
          );
          products = pdtRows || [];
        }
        if (!catalogs.length) {
          const [catlRows] = await pool.execute(
            `SELECT id, catalog_id, name FROM tb_web_catalogs WHERE LOWER(status) != 'deleted' ORDER BY id ASC`
          );
          catalogs = catlRows || [];
        }
        if (!brands.length) {
          const [brandRows] = await pool.execute(
            `SELECT id, name FROM tb_pdt_commons_brands WHERE LOWER(status) != 'deleted' ORDER BY name ASC`
          );
          brands = brandRows || [];
        }
        if (!colours.length) {
          const [colorRows] = await pool.execute(
            `SELECT id, name FROM tb_pdt_commons_colors WHERE LOWER(status) != 'deleted' ORDER BY name ASC`
          );
          colours = colorRows || [];
        }
      }
    } catch (dbErr) {
      // Graceful fallback if database is not reachable during offline generation
    }
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Taiton CPanel System';
  workbook.lastModifiedBy = 'Taiton Admin';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Color constants
  const headerFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '1F497D' }, // Navy Blue
  };
  const seoHeaderFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '6D28D9' }, // Deep Purple / Violet for SEO & Linked Features
  };
  const headerFont = {
    name: 'Calibri',
    size: 11,
    bold: true,
    color: { argb: 'FFFFFF' },
  };
  const headerAlignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  const borderStyle = {
    top: { style: 'thin', color: { argb: 'D9D9D9' } },
    left: { style: 'thin', color: { argb: 'D9D9D9' } },
    bottom: { style: 'thin', color: { argb: 'D9D9D9' } },
    right: { style: 'thin', color: { argb: 'D9D9D9' } },
  };

  // Helper to style header row
  function styleHeader(sheet, columns) {
    sheet.columns = columns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width || 22,
    }));

    const headerRow = sheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      const headerText = String(cell.value || '').toLowerCase();
      const isSeoHeader =
        headerText.includes('seo') ||
        headerText.includes('focus keyword') ||
        headerText.includes('secondary keywords') ||
        headerText.includes('robots') ||
        headerText.includes('image alt') ||
        headerText.includes('related products') ||
        headerText.includes('accessories');

      cell.fill = isSeoHeader ? seoHeaderFill : headerFill;
      cell.font = headerFont;
      cell.alignment = headerAlignment;
      cell.border = borderStyle;
    });
  }

  // Build formatted dropdown options for the Reference Sheet
  // 1. Parent Categories: Starts with 0 - Top Level (No Parent), followed by all categories/subcategories from DB
  const parentCategoriesList = ['0 - Top Level (No Parent)'];
  if (categories && categories.length > 0) {
    categories.forEach((c) => {
      let prefix = 'cat_';
      const rawType = String(c.type || '').toLowerCase();
      if (rawType === 'sc' || rawType === 'sub category' || (c.parent_id > 0 && (!c.parent_parent_id || c.parent_parent_id === 0))) {
        prefix = 'sc_';
      } else if (rawType === 's2c' || rawType === 'sub sub category' || (c.parent_id > 0 && c.parent_parent_id > 0)) {
        prefix = 's2c_';
      }
      const label = `${prefix}${c.id} - ${c.category}`;
      if (!parentCategoriesList.includes(label)) {
        parentCategoriesList.push(label);
      }
    });
  } else {
    // Realistic fallback items
    parentCategoriesList.push('cat_1 - Glass Fittings');
    parentCategoriesList.push('sc_2 - Shower Hinges');
    parentCategoriesList.push('s2c_3 - 90 Degree Glass to Wall Hinges');
  }

  // 2. Products List: Formatted as `${id} - ${name} (${code})`
  const productsList = [];
  if (products && products.length > 0) {
    products.forEach((p) => {
      const codePart = p.pdt_code ? ` (${p.pdt_code})` : '';
      const label = `${p.id} - ${p.product}${codePart}`;
      if (!productsList.includes(label)) {
        productsList.push(label);
      }
    });
  } else {
    productsList.push('501 - Heavy Duty 90 Deg Glass Hinge (TT-GH-901)');
    productsList.push('502 - Standard Glass Hinge (TT-GH-902)');
  }

  // 3. Catalogs List: Starts with 0 - None, followed by catalogs from DB
  const catalogsList = ['0 - None'];
  if (catalogs && catalogs.length > 0) {
    catalogs.forEach((cat) => {
      const cId = cat.catalog_id || cat.id;
      catalogsList.push(`${cId} - ${cat.name || `Catalog #${cId}`}`);
    });
  } else {
    catalogsList.push('1 - Architectural Hardware 2026');
  }

  // 4. Brands List: From commons brands
  const brandsList = [];
  if (brands && brands.length > 0) {
    brands.forEach((b) => {
      if (b.name && !brandsList.includes(b.name)) brandsList.push(b.name);
    });
  }
  if (!brandsList.length) {
    brandsList.push('Taiton Core', 'Taiton Prime', 'Taiton Luxury');
  }

  // 5. Colours List: From commons colours
  const coloursList = [];
  if (colours && colours.length > 0) {
    colours.forEach((c) => {
      if (c.name && !coloursList.includes(c.name)) coloursList.push(c.name);
    });
  }
  if (!coloursList.length) {
    coloursList.push('Satin Stainless Steel', 'Matte Black', 'Rose Gold Mirror PVD', 'Brushed Gold', 'Polished Chrome', 'Antique Brass');
  }

  // 6. Block Types
  const blockTypesList = ['bullets', 'keyval', 'table'];

  // 7. Component Types
  const componentTypesList = ['Feature', 'Specification', 'Additional'];

  // 8. Robots Directives
  const robotsList = ['index, follow', 'noindex, follow', 'index, nofollow', 'noindex, nofollow'];

  const catEndRow = parentCategoriesList.length + 1;
  const pdtEndRow = productsList.length + 1;
  const catlEndRow = catalogsList.length + 1;
  const brandEndRow = brandsList.length + 1;
  const colourEndRow = coloursList.length + 1;
  const blockEndRow = blockTypesList.length + 1;
  const compEndRow = componentTypesList.length + 1;
  const robotsEndRow = robotsList.length + 1;

  // -------------------------------------------------------------
  // 1. Single Categories Sheet
  // -------------------------------------------------------------
  const catSheet = workbook.addWorksheet('categories');
  styleHeader(catSheet, [
    { header: 'Category ID', key: 'id', width: 16 },
    { header: 'Parent Category ID', key: 'parent_id', width: 34 },
    { header: 'Category Name', key: 'name', width: 28 },
    { header: 'Category Description', key: 'desc', width: 38 },
    { header: 'Category Image Name', key: 'img', width: 25 },
    { header: 'Banner Image', key: 'banner_img', width: 25 },
    { header: 'Catalog ID', key: 'catalog_id', width: 28 },
    { header: 'SEO Meta Title', key: 'seo_title', width: 25 },
    { header: 'SEO Meta Description', key: 'seo_desc', width: 35 },
    { header: 'Focus Keyword', key: 'focus_kw', width: 20 },
    { header: 'Secondary Keywords ( , seperated )', key: 'sec_kw', width: 30 },
    { header: 'Robots(inder / no index)', key: 'robots', width: 22 },
  ]);

  // Sample Rows
  catSheet.addRow({
    id: 1,
    parent_id: '0 - Top Level (No Parent)',
    name: 'Glass Fittings',
    desc: 'High precision architectural glass fittings and hardware',
    img: 'glass-fittings.jpg',
    banner_img: 'glass-fittings-banner.jpg',
    catalog_id: catalogsList[1] || '1 - Architectural Hardware 2026',
    seo_title: 'Glass Fittings - Premium Architectural Hardware',
    seo_desc: 'Explore high-grade glass fitting solutions for commercial and residential applications.',
    focus_kw: 'Glass Fittings',
    sec_kw: 'patch fittings, glass connectors, spider fittings',
    robots: 'index, follow',
  });

  catSheet.addRow({
    id: 2,
    parent_id: 'cat_1 - Glass Fittings',
    name: 'Shower Hinges',
    desc: 'Heavy duty stainless steel shower door hinges (Sub Category referencing Row 1)',
    img: 'shower-hinge-sub.jpg',
    seo_title: 'Shower Hinges - Glass Door Hardware',
    seo_desc: 'Durable and corrosion-resistant glass shower door hinges.',
    focus_kw: 'Shower Hinges',
    sec_kw: 'brass hinges, glass to wall hinge, 90 degree hinge',
    robots: 'index, follow',
  });

  catSheet.addRow({
    id: 3,
    parent_id: 'sc_2 - Shower Hinges',
    name: '90 Degree Glass to Wall Hinges',
    desc: 'Precision engineered 90 degree mounting hinges (Sub Sub Category referencing Row 2)',
    img: 'glass-wall-90.jpg',
    seo_title: '90 Degree Glass to Wall Shower Hinges',
    seo_desc: 'Premium 90 degree glass to wall mounting hinges for frameless glass enclosures.',
    focus_kw: '90 Degree Shower Hinge',
    sec_kw: 'frameless shower hinge, 90 degree glass hinge',
    robots: 'index, follow',
  });

  // Data Validation for categories sheet (rows 2 to 500)
  for (let r = 2; r <= 500; r++) {
    // Column B: Parent Category ID dropdown
    catSheet.getCell(`B${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Reference_Data!$A$2:$A$${catEndRow}`],
      showErrorMessage: true,
      errorTitle: 'Invalid Selection',
      error: 'Please select a valid parent category from the dropdown or select "0 - Top Level (No Parent)".',
    };

    // Column G: Catalog ID dropdown
    catSheet.getCell(`G${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Reference_Data!$C$2:$C$${catlEndRow}`],
      showErrorMessage: true,
      errorTitle: 'Invalid Selection',
      error: 'Please select a catalog from the dropdown list.',
    };

    // Column L: Robots dropdown
    catSheet.getCell(`L${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Reference_Data!$H$2:$H$${robotsEndRow}`],
    };
  }

  // -------------------------------------------------------------
  // 2. Products Sheet
  // -------------------------------------------------------------
  const pdtSheet = workbook.addWorksheet('products');
  styleHeader(pdtSheet, [
    { header: 'Parent Category ID', key: 'parent_id', width: 34 },
    { header: 'Product ID', key: 'pdt_id', width: 14 },
    { header: 'Product Main Image Name (.webp / .jpg /.png)', key: 'img', width: 32 },
    { header: 'Product Other Image Names (.webp / .jpg /.png)', key: 'other_imgs', width: 35 },
    { header: 'Product Name', key: 'name', width: 30 },
    { header: 'Product Code', key: 'code', width: 18 },
    { header: 'Product Description', key: 'desc', width: 35 },
    { header: 'Price', key: 'price', width: 14 },
    { header: 'Feature Type', key: 'feature_type', width: 18 },
    { header: 'Specifications Type', key: 'specs_type', width: 20 },
    { header: 'Additional Type', key: 'addl_type', width: 18 },
    { header: 'Related Products', key: 'rel_pdts', width: 20 },
    { header: 'Accessories (comma separated Product IDs or Codes)', key: 'accessories', width: 35 },
    { header: 'Product Brand', key: 'brand', width: 22 },
    { header: 'Default Colour', key: 'default_colour', width: 24 },
    { header: 'Colours (comma separated)', key: 'colours', width: 30 },
    { header: 'SEO Meta Title', key: 'seo_title', width: 25 },
    { header: 'SEO Meta Description', key: 'seo_desc', width: 35 },
    { header: 'Focus Keyword', key: 'focus_kw', width: 20 },
    { header: 'Secondary Keywords ( , seperated )', key: 'sec_kw', width: 30 },
    { header: 'Robots(inder / no index)', key: 'robots', width: 22 },
  ]);

  pdtSheet.addRow({
    parent_id: parentCategoriesList[2] || 'sc_2 - Shower Hinges',
    pdt_id: 501,
    img: 'pdt-501-main.webp',
    other_imgs: 'pdt-501-side.webp, pdt-501-back.webp',
    name: 'Heavy Duty 90 Deg Glass Hinge',
    code: 'TT-GH-901',
    desc: 'Heavy duty solid brass 90 degree glass to wall hinge.',
    price: 1450.0,
    feature_type: 'bullets',
    specs_type: 'keyval',
    addl_type: 'table',
    rel_pdts: '502',
    accessories: 'ACC-01, ACC-02',
    brand: brandsList[0] || 'Taiton Core',
    default_colour: coloursList[0] || 'Satin Stainless Steel',
    colours: `${coloursList[0] || 'Satin Stainless Steel'}, ${coloursList[1] || 'Matte Black'}`,
    seo_title: 'Heavy Duty 90 Deg Glass Hinge - TT-GH-901',
    seo_desc: 'Buy heavy duty brass 90 degree glass hinge with satin finish.',
    focus_kw: 'Glass Hinge 90 Deg',
    sec_kw: 'heavy duty glass hinge, frameless shower hinge',
    robots: 'index, follow',
  });

  pdtSheet.addRow({
    parent_id: parentCategoriesList[1] || 'cat_1 - Glass Fittings',
    pdt_id: 502,
    img: 'pdt-502-main.webp',
    other_imgs: '',
    name: 'Standard Glass Hinge',
    code: 'TT-GH-902',
    desc: 'Standard glass to wall hinge.',
    price: 1200.0,
    feature_type: 'bullets',
    specs_type: 'keyval',
    addl_type: 'bullets',
    rel_pdts: '501',
    brand: brandsList[0] || 'Taiton Core',
    default_colour: coloursList[0] || 'Satin Stainless Steel',
    colours: coloursList[0] || 'Satin Stainless Steel',
    seo_title: 'Standard Glass Hinge',
    seo_desc: 'Standard glass hinge for shower enclosures.',
    focus_kw: 'Glass Hinge',
    sec_kw: 'shower hinge, glass hardware',
    robots: 'index, follow',
  });

  // Data Validation for products sheet (rows 2 to 500)
  for (let r = 2; r <= 500; r++) {
    // Column A: Parent Category ID dropdown
    pdtSheet.getCell(`A${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Reference_Data!$A$2:$A$${catEndRow}`],
      showErrorMessage: true,
      errorTitle: 'Invalid Selection',
      error: 'Please select a valid Category or Subcategory from the dropdown list.',
    };

    // Columns I, J, K: Feature / Specs / Additional Type
    ['I', 'J', 'K'].forEach((colLetter) => {
      pdtSheet.getCell(`${colLetter}${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`Reference_Data!$F$2:$F$${blockEndRow}`],
        showErrorMessage: true,
        errorTitle: 'Invalid Selection',
        error: 'Please select bullets, keyval, or table.',
      };
    });

    // Column N: Product Brand dropdown
    pdtSheet.getCell(`N${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Reference_Data!$D$2:$D$${brandEndRow}`],
    };

    // Column O: Default Colour dropdown
    pdtSheet.getCell(`O${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Reference_Data!$E$2:$E$${colourEndRow}`],
    };

    // Column U: Robots dropdown
    pdtSheet.getCell(`U${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Reference_Data!$H$2:$H$${robotsEndRow}`],
    };
  }

  // -------------------------------------------------------------
  // 3. Varients Sheet
  // -------------------------------------------------------------
  const varSheet = workbook.addWorksheet('varients');
  styleHeader(varSheet, [
    { header: 'Product ID', key: 'pdt_id', width: 34 },
    { header: 'Varient ID', key: 'var_id', width: 14 },
    { header: 'Varient Primary Image Name', key: 'img', width: 30 },
    { header: 'Varient Other Image Names  ( comma Seperated)', key: 'other_imgs', width: 35 },
    { header: 'Image Alt Texts (comma separated)', key: 'alts', width: 30 },
    { header: 'Varient Name', key: 'name', width: 25 },
    { header: 'Varient Code', key: 'code', width: 18 },
    { header: 'Colour / Finish Name', key: 'colour', width: 24 },
    { header: 'SKU', key: 'sku', width: 18 },
    { header: 'Price', key: 'price', width: 14 },
    { header: 'Discount', key: 'discount', width: 14 },
    { header: 'Sort Order', key: 'sort', width: 14 },
    { header: 'SEO Meta Title', key: 'seo_title', width: 25 },
    { header: 'SEO Meta Description', key: 'seo_desc', width: 35 },
    { header: 'Focus Keyword', key: 'focus_kw', width: 20 },
    { header: 'Secondary Keywords ( , seperated )', key: 'sec_kw', width: 30 },
    { header: 'Robots(inder / no index)', key: 'robots', width: 22 },
  ]);

  varSheet.addRow({
    pdt_id: productsList[0] || '501 - Heavy Duty 90 Deg Glass Hinge (TT-GH-901)',
    var_id: 9001,
    img: 'var_satin_nickel.jpg',
    other_imgs: 'prod_dimension_spec.jpg, prod_heavy_duty_hinge.jpg',
    alts: 'Satin Stainless Steel Finish 90 Deg Hinge, Dimensional Drawing',
    name: 'Satin Stainless Steel',
    code: 'TT-GH-901-SSS',
    colour: coloursList[0] || 'Satin Stainless Steel',
    sku: 'SKU-GH901-SSS',
    price: 1450.0,
    discount: 50.0,
    sort: 1,
    seo_title: 'Satin Finish 90 Deg Hinge | Taiton',
    seo_desc: 'Satin Stainless Steel variant for 90 deg glass hinge.',
    focus_kw: 'Satin Glass Hinge',
    sec_kw: 'SSS hinge, satin stainless steel',
    robots: 'index, follow',
  });

  varSheet.addRow({
    pdt_id: productsList[0] || '501 - Heavy Duty 90 Deg Glass Hinge (TT-GH-901)',
    var_id: 9002,
    img: 'var_matte_black.jpg',
    other_imgs: 'prod_dimension_spec.jpg, var_gunmetal.jpg',
    alts: 'Matte Black Finish 90 Deg Hinge, Architectural Profile',
    name: 'Matte Black',
    code: 'TT-GH-901-MB',
    colour: coloursList[1] || 'Matte Black',
    sku: 'SKU-GH901-MB',
    price: 1600.0,
    sort: 2,
    seo_title: 'Matte Black 90 Deg Hinge | Taiton',
    seo_desc: 'Matte Black variant for 90 deg glass hinge.',
    focus_kw: 'Matte Black Glass Hinge',
    sec_kw: 'black hinge, matte architectural fitting',
    robots: 'index, follow',
  });

  // Data Validation for varients sheet (rows 2 to 500)
  for (let r = 2; r <= 500; r++) {
    // Column A: Product ID dropdown
    varSheet.getCell(`A${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Reference_Data!$B$2:$B$${pdtEndRow}`],
      showErrorMessage: true,
      errorTitle: 'Invalid Selection',
      error: 'Please select an existing Product from the dropdown list or specify a valid Product ID/Code.',
    };

    // Column H: Colour / Finish Name dropdown
    varSheet.getCell(`H${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Reference_Data!$E$2:$E$${colourEndRow}`],
    };

    // Column Q: Robots dropdown
    varSheet.getCell(`Q${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Reference_Data!$H$2:$H$${robotsEndRow}`],
    };
  }

  // -------------------------------------------------------------
  // 4. Type Bullets Sheet
  // -------------------------------------------------------------
  const bulletsSheet = workbook.addWorksheet('Type Bullets');
  styleHeader(bulletsSheet, [
    { header: 'Type (Feaute / Specification / Additional )', key: 'type', width: 32 },
    { header: 'Product ID', key: 'pdt_id', width: 34 },
    { header: 'Label', key: 'label', width: 25 },
    { header: 'Bullets', key: 'bullets', width: 45 },
  ]);
  bulletsSheet.addRow({
    type: 'Feature',
    pdt_id: productsList[0] || '501 - Heavy Duty 90 Deg Glass Hinge (TT-GH-901)',
    label: 'Key Features',
    bullets: 'Made from high grade SS 304, Self-closing from 25 degrees, Tested for 100,000 cycles',
  });

  for (let r = 2; r <= 300; r++) {
    bulletsSheet.getCell(`A${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Reference_Data!$G$2:$G$${compEndRow}`],
    };
    bulletsSheet.getCell(`B${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Reference_Data!$B$2:$B$${pdtEndRow}`],
    };
  }

  // -------------------------------------------------------------
  // 5. Type KeyVal Sheet
  // -------------------------------------------------------------
  const keyValSheet = workbook.addWorksheet('Type KeyVal');
  styleHeader(keyValSheet, [
    { header: 'Type (Feaute / Specification / Additional )', key: 'type', width: 32 },
    { header: 'Product ID', key: 'pdt_id', width: 34 },
    { header: 'Feature Key', key: 'key', width: 25 },
    { header: 'Feature Value', key: 'val', width: 35 },
  ]);
  keyValSheet.addRow({
    type: 'Specification',
    pdt_id: productsList[0] || '501 - Heavy Duty 90 Deg Glass Hinge (TT-GH-901)',
    key: 'Material',
    val: 'Solid Brass / Stainless Steel 304',
  });

  for (let r = 2; r <= 300; r++) {
    keyValSheet.getCell(`A${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Reference_Data!$G$2:$G$${compEndRow}`],
    };
    keyValSheet.getCell(`B${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Reference_Data!$B$2:$B$${pdtEndRow}`],
    };
  }

  // -------------------------------------------------------------
  // 6. Type Table Sheet
  // -------------------------------------------------------------
  const tableSheet = workbook.addWorksheet('Type Table');
  styleHeader(tableSheet, [
    { header: 'Type (Feaute / Specification / Additional )', key: 'type', width: 32 },
    { header: 'Product ID', key: 'pdt_id', width: 34 },
    { header: 'Column Header (Top Headers with comma seperated)', key: 'col_headers', width: 38 },
    { header: 'ROW Headers ( Left Side Headers with comma seperated )', key: 'row_headers', width: 38 },
    { header: 'ROW Flow (comma sepearated - all data continuesly)', key: 'row_flow', width: 42 },
  ]);
  tableSheet.addRow({
    type: 'Additional',
    pdt_id: productsList[0] || '501 - Heavy Duty 90 Deg Glass Hinge (TT-GH-901)',
    col_headers: 'Max Weight, Max Door Width, Glass Cutout Required',
    row_headers: 'Specs',
    row_flow: '45 kg per pair, 800 mm, Standard H-Cutout',
  });

  for (let r = 2; r <= 300; r++) {
    tableSheet.getCell(`A${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Reference_Data!$G$2:$G$${compEndRow}`],
    };
    tableSheet.getCell(`B${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Reference_Data!$B$2:$B$${pdtEndRow}`],
    };
  }

  // -------------------------------------------------------------
  // 7. Reference_Data Sheet (Dynamic Lookup Repository)
  // Placed at the end so categories / products remain the default view
  // -------------------------------------------------------------
  const refSheet = workbook.addWorksheet('Reference_Data');
  refSheet.columns = [
    { header: 'Parent Categories (Category ID & Name)', key: 'parent_cats', width: 44 },
    { header: 'Products (Product ID & Name)', key: 'pdts', width: 48 },
    { header: 'Catalogs (Catalog ID & Name)', key: 'catalogs', width: 34 },
    { header: 'Brands (From Commons)', key: 'brands', width: 26 },
    { header: 'Colours (From Commons)', key: 'colours', width: 30 },
    { header: 'Content Block Types', key: 'block_types', width: 20 },
    { header: 'Component Types', key: 'comp_types', width: 22 },
    { header: 'Robots Directives', key: 'robots', width: 22 },
  ];

  const refHeaderRow = refSheet.getRow(1);
  refHeaderRow.height = 28;
  refHeaderRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F172A' } }; // Dark Slate
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const maxRows = Math.max(
    parentCategoriesList.length,
    productsList.length,
    catalogsList.length,
    brandsList.length,
    coloursList.length,
    blockTypesList.length,
    componentTypesList.length,
    robotsList.length
  );

  for (let i = 0; i < maxRows; i++) {
    const row = refSheet.addRow({
      parent_cats: parentCategoriesList[i] || '',
      pdts: productsList[i] || '',
      catalogs: catalogsList[i] || '',
      brands: brandsList[i] || '',
      colours: coloursList[i] || '',
      block_types: blockTypesList[i] || '',
      comp_types: componentTypesList[i] || '',
      robots: robotsList[i] || '',
    });
    row.eachCell((c) => {
      c.border = borderStyle;
      c.alignment = { vertical: 'middle', horizontal: 'left' };
    });
  }

  // Adjust column widths across all worksheets
  workbook.worksheets.forEach((ws) => {
    ws.columns.forEach((col) => {
      let maxLen = 0;
      col.eachCell({ includeEmpty: true }, (cell) => {
        const valStr = String(cell.value || '');
        if (valStr.length > maxLen) {
          maxLen = valStr.length;
        }
      });
      col.width = Math.max(maxLen + 4, col.width || 18);
    });
  });

  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}

module.exports = { buildOnboardProductsExcel };

if (require.main === module) {
  const fileDest = process.argv[2] || path.join(__dirname, '../../../../Onboard Products.xlsx');
  buildOnboardProductsExcel(fileDest, { skipDbQuery: true })
    .then(() => {
      console.log('Successfully generated Excel template with dynamic dropdown validation at:', fileDest);
    })
    .catch((err) => {
      console.error('Error generating Excel template:', err);
    });
}
