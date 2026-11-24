const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const brandingController = require('../controllers/branding.controller');

// Ensure branding uploads directory exists
const brandingUploadsDir = path.join(__dirname, '../../../publi/uploads/branding');
if (!fs.existsSync(brandingUploadsDir)) {
  fs.mkdirSync(brandingUploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, brandingUploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    const uniqueName = `logo-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

router.get('/public/branding', (req, res) => brandingController.getPublicBranding(req, res));
router.get('/org/branding', (req, res) => brandingController.getOrgBranding(req, res));
router.patch('/org/branding', (req, res) => brandingController.updateOrgBranding(req, res));
router.post('/org/branding/logo', upload.single('file'), (req, res) => brandingController.uploadLogo(req, res));

module.exports = router;
