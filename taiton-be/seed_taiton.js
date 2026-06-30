import { pool } from './src/config/db.js';

const items = [
  // 1. Categories
  {
    org_id: 25,
    content_type: 'category',
    title: 'Architectural Hardware',
    summary: 'High quality hinges, handles, and locks for doors and windows.',
    status: 'live',
    created_by: 29,
    approved_by: 29,
    payload: {
      cat_id: 'cat-architectural',
      seo_meta_title: 'Architectural Hardware Solutions',
      seo_meta_description: 'Discover high quality hinges, handles, and locks for doors and windows.',
      focus_keyword: 'architectural hardware',
      secondary_keywords: 'hinges, handles, locks',
      category_image: '',
      image_alt_text: 'Architectural Hardware Category image',
      related_products: ''
    }
  },
  {
    org_id: 25,
    content_type: 'category',
    title: 'Glass Fittings',
    summary: 'Premium brackets, clamps, and patch fittings for glass doors and panels.',
    status: 'live',
    created_by: 29,
    approved_by: 29,
    payload: {
      cat_id: 'cat-glass-fittings',
      seo_meta_title: 'Premium Glass Fittings',
      seo_meta_description: 'Explore premium brackets, clamps, and patch fittings for glass doors and panels.',
      focus_keyword: 'glass fittings',
      secondary_keywords: 'brackets, clamps, patch fittings',
      category_image: '',
      image_alt_text: 'Glass Fittings Category image',
      related_products: ''
    }
  },

  // 2. Subcategories
  {
    org_id: 25,
    content_type: 'subcategory',
    title: 'Brass Hinges',
    summary: 'Solid brass hinges for doors.',
    status: 'live',
    created_by: 29,
    approved_by: 29,
    payload: {
      sub_cat_id: 'subcat-brass-hinges',
      parent_cat_id: 'cat-architectural',
      url: '/products/brass-hinges',
      seo_meta_title: 'Solid Brass Hinges',
      seo_meta_description: 'Buy solid brass hinges for heavy doors.',
      focus_keyword: 'brass hinges',
      secondary_keywords: 'door hinges, brass',
      related_products: '',
      image_alt_text: 'Solid Brass Hinges'
    }
  },
  {
    org_id: 25,
    content_type: 'subcategory',
    title: 'Shower Clamps',
    summary: 'Heavy duty shower glass clamps.',
    status: 'live',
    created_by: 29,
    approved_by: 29,
    payload: {
      sub_cat_id: 'subcat-shower-clamps',
      parent_cat_id: 'cat-glass-fittings',
      url: '/products/shower-clamps',
      seo_meta_title: 'Heavy Duty Shower Clamps',
      seo_meta_description: 'Find heavy duty shower glass clamps in chrome and matte black.',
      focus_keyword: 'shower clamps',
      secondary_keywords: 'glass clamps, shower',
      related_products: '',
      image_alt_text: 'Shower glass clamps'
    }
  },

  // 3. Products
  {
    org_id: 25,
    content_type: 'product',
    title: 'Premium Brass Hinge 4-inch',
    summary: 'Heavy-duty 4-inch brass hinge with ball bearings.',
    status: 'live',
    created_by: 29,
    approved_by: 29,
    payload: {
      prd_id: 'prd-brass-hinge-4',
      cat_id: 'cat-architectural',
      sub_cat_id: 'subcat-brass-hinges',
      productCode: 'TT-BH-04',
      url: '/product/brass-hinge-4-inch',
      seo_meta_title: 'Premium Brass Hinge 4-inch - Taiton',
      seo_meta_description: 'Heavy-duty 4-inch brass hinge with ball bearings for smooth operation.',
      focus_keyword: '4-inch brass hinge',
      secondary_keywords: 'premium hinge, taiton hinges',
      productDescription: 'Designed for luxury residential and commercial doors, our 4-inch brass hinge offers unmatched durability and smooth motion.',
      product_features: ['Solid brass body', 'Double ball bearings', 'Screws included'],
      product_specifications: {
        Material: 'Solid Brass',
        Size: '4 inches',
        Finish: 'Antique Brass'
      },
      canonical_url: 'https://taiton.in/product/brass-hinge-4-inch'
    }
  },
  {
    org_id: 25,
    content_type: 'product',
    title: 'Square Glass Shower Clamp',
    summary: 'Solid brass square shower screen wall-to-glass clamp.',
    status: 'live',
    created_by: 29,
    approved_by: 29,
    payload: {
      prd_id: 'prd-sq-shower-clamp',
      cat_id: 'cat-glass-fittings',
      sub_cat_id: 'subcat-shower-clamps',
      productCode: 'TT-SC-SQ',
      url: '/product/square-shower-clamp',
      seo_meta_title: 'Square Glass Shower Clamp - Taiton',
      seo_meta_description: 'Solid brass square shower screen wall-to-glass clamp for 8-10mm glass.',
      focus_keyword: 'shower glass clamp',
      secondary_keywords: 'square clamp, wall to glass',
      productDescription: 'Square design wall-to-glass clamp for shower enclosures. Made of premium rust-proof solid brass.',
      product_features: ['Wall-to-glass 90 degrees', 'Suitable for 8mm to 10mm glass', 'Corrosion resistant'],
      product_specifications: {
        Material: 'Solid Brass',
        'Glass Thickness': '8mm to 10mm',
        Finish: 'Chrome Plated'
      },
      canonical_url: 'https://taiton.in/product/square-shower-clamp'
    }
  },

  // 4. Blogs
  {
    org_id: 25,
    content_type: 'blog',
    title: 'Modern Door Hardware Trends for 2026',
    summary: 'Explore the latest trends in architectural door hardware, from matte black finishes to smart lock integrations.',
    status: 'live',
    created_by: 29,
    approved_by: 29,
    payload: {
      blog_id: 'blog-hardware-trends-2026',
      url: '/blog/door-hardware-trends-2026',
      url_slug: 'door-hardware-trends-2026',
      h1_tag: 'Modern Door Hardware Trends for 2026',
      seo_meta_title: 'Modern Door Hardware Trends for 2026',
      seo_meta_description: 'Explore the latest trends in architectural door hardware, from matte black finishes to smart lock integrations.',
      focus_keyword: 'door hardware trends',
      secondary_keywords: 'modern hardware, matte black handles',
      canonical_url: 'https://taiton.in/blog/door-hardware-trends-2026',
      og_title: 'Modern Door Hardware Trends for 2026',
      og_description: 'Explore the latest trends in architectural door hardware.',
      og_image: '',
      schema_type: 'Article',
      robots_tag: 'index, follow',
      image_alt_text: 'Modern door handle design',
      blog_content: '<p>As we head into 2026, door hardware is no longer just functional; it is a major design statement. Modern residential designs are focusing heavily on finishes like matte black, satin brass, and architectural bronze...</p>',
      author_name: 'Karthik Kumar',
      blog_category: 'Design & Architecture',
      reading_time: '4 mins',
      featured_image: '',
      publish_date: '2026-06-28 09:00:00',
      modified_date: '2026-06-28 09:00:00',
      faq_section: [
        {
          question: 'What is the most popular hardware finish in 2026?',
          answer: 'Matte black and satin brass continue to lead modern design preferences.'
        }
      ],
      internal_linking_targets: '/products, /about',
      related_products: 'prd-brass-hinge-4',
      redirect_url_301: '',
      last_updated_date: '2026-06-28 09:00:00',
      status: 'live'
    }
  },
  {
    org_id: 25,
    content_type: 'blog',
    title: 'Choosing the Right Glass Fittings for Your Bathroom',
    summary: 'A comprehensive guide on selecting high quality glass shower clamps and hinges for a safe and stylish bathroom.',
    status: 'live',
    created_by: 29,
    approved_by: 29,
    payload: {
      blog_id: 'blog-choose-glass-fittings',
      url: '/blog/choose-glass-fittings',
      url_slug: 'choose-glass-fittings',
      h1_tag: 'Choosing the Right Glass Fittings for Your Bathroom',
      seo_meta_title: 'Choosing the Right Glass Fittings for Your Bathroom',
      seo_meta_description: 'A comprehensive guide on selecting high quality glass shower clamps and hinges.',
      focus_keyword: 'choose glass fittings',
      secondary_keywords: 'bathroom glass clamps, shower fittings',
      canonical_url: 'https://taiton.in/blog/choose-glass-fittings',
      og_title: 'Choosing the Right Glass Fittings for Your Bathroom',
      og_description: 'Guide on selecting high quality glass shower clamps and hinges.',
      og_image: '',
      schema_type: 'Article',
      robots_tag: 'index, follow',
      image_alt_text: 'Glass shower enclosure',
      blog_content: '<p>When planning a frameless glass shower enclosure, selecting the correct glass fittings is crucial for both aesthetic appeal and structural safety. Clamps must be rated for the thickness of the glass...</p>',
      author_name: 'Sridhar',
      blog_category: 'Hardware Guide',
      reading_time: '5 mins',
      featured_image: '',
      publish_date: '2026-06-28 09:10:00',
      modified_date: '2026-06-28 09:10:00',
      faq_section: [
        {
          question: 'Can I use standard clamps on 10mm glass?',
          answer: 'You must verify that the clamp is specifically rated for 10mm glass thickness to ensure a secure grip.'
        }
      ],
      internal_linking_targets: '/products',
      related_products: 'prd-sq-shower-clamp',
      redirect_url_301: '',
      last_updated_date: '2026-06-28 09:10:00',
      status: 'live'
    }
  }
];

async function seed() {
  try {
    console.log('Seeding items for Taiton Hardware (org_id: 25)...');
    
    // Clear previous seed data for Taiton to avoid duplicates on re-run
    await pool.query('DELETE FROM tb_csd_content_items WHERE org_id = 25;');
    console.log('Previous items deleted.');

    for (const item of items) {
      const payloadJson = JSON.stringify(item.payload);
      await pool.query(
        `INSERT INTO tb_csd_content_items 
         (org_id, content_type, title, summary, payload_json, status, created_by, approved_by, approved_at, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP());`,
        [
          item.org_id,
          item.content_type,
          item.title,
          item.summary,
          payloadJson,
          item.status,
          item.created_by,
          item.approved_by
        ]
      );
      console.log(`Inserted ${item.content_type}: "${item.title}"`);
    }

    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding:', err);
    process.exit(1);
  }
}

seed();
