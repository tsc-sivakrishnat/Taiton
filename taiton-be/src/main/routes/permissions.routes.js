const express = require('express');
const router = express.Router();
const permissionsController = require('../controllers/permissions.controller');

router.get('/permissions/me', (req, res) => permissionsController.getMyPermissions(req, res));
router.get('/permissions/audit', (req, res) => permissionsController.getAuditLog(req, res));

module.exports = router;
