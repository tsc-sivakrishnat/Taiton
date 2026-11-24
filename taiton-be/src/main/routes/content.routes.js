const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const contentController = require('../controllers/content.controller');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../../public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

router.get('/blogs', (req, res) => contentController.getBlogs(req, res));
router.post('/blogs', (req, res) => contentController.createBlog(req, res));
router.get('/careers', (req, res) => contentController.getCareers(req, res));
router.post('/careers', (req, res) => contentController.createCareer(req, res));
router.get('/catalogs', (req, res) => contentController.getCatalogs(req, res));
router.post('/catalogs', (req, res) => contentController.createCatalog(req, res));

// Image Upload Endpoint
router.post('/content/upload-image', upload.single('file'), (req, res) => contentController.uploadImage(req, res));
router.post('/upload-image', upload.single('file'), (req, res) => contentController.uploadImage(req, res));

// Commons Endpoints (Colors & Kits)
router.get('/commons/colors', (req, res) => contentController.getCommonsColors(req, res));
router.post('/commons/colors', (req, res) => contentController.createCommonsColor(req, res));
router.put('/commons/colors/:id', (req, res) => contentController.updateCommonsColor(req, res));
router.delete('/commons/colors/:id', (req, res) => contentController.deleteCommonsColor(req, res));

router.get('/commons/kits', (req, res) => contentController.getCommonsKits(req, res));
router.post('/commons/kits', (req, res) => contentController.createCommonsKit(req, res));
router.put('/commons/kits/:id', (req, res) => contentController.updateCommonsKit(req, res));
router.delete('/commons/kits/:id', (req, res) => contentController.deleteCommonsKit(req, res));

router.get('/commons/brands', (req, res) => contentController.getCommonsBrands(req, res));
router.post('/commons/brands', (req, res) => contentController.createCommonsBrand(req, res));
router.put('/commons/brands/:id', (req, res) => contentController.updateCommonsBrand(req, res));
router.delete('/commons/brands/:id', (req, res) => contentController.deleteCommonsBrand(req, res));

// Product Bulk Export & Template
router.get('/content/products/export-template', (req, res) => contentController.exportProductsTemplate(req, res));
router.post('/content/products/bulk-upload', upload.any(), (req, res) => contentController.bulkUploadProducts(req, res));

// Pending Approvals & Actions
router.get('/content/pending', (req, res) => contentController.getPendingApprovals(req, res));
router.get('/content/pending_approval', (req, res) => contentController.getPendingApprovals(req, res));
router.post('/content/pending/:id/approve', (req, res) => contentController.approveContent(req, res));
router.post('/content/approve/:id', (req, res) => contentController.approveContent(req, res));
router.post('/content/:type/:id/approve', (req, res) => contentController.approveContent(req, res));

// Dynamic /content CRUD routes
router.post('/content/reorder', (req, res) => contentController.reorderContent(req, res));
router.put('/content/reorder', (req, res) => contentController.reorderContent(req, res));
router.post('/content/:type/reorder', (req, res) => contentController.reorderContent(req, res));

router.get('/content/:type', (req, res) => contentController.getContentByType(req, res));
router.get('/content/:type/:id', (req, res) => contentController.getContentDetail(req, res));
router.post('/content/:type', (req, res) => contentController.createContent(req, res));
router.put('/content/:type/:id', (req, res) => contentController.updateContent(req, res));
router.patch('/content/:type/:id', (req, res) => contentController.updateContent(req, res));
router.delete('/content/:type/:id', (req, res) => contentController.deleteContent(req, res));

module.exports = router;
