const express = require('express');
const router = express.Router();
const uiLayoutController = require('../controllers/uiLayout.controller');

// Authenticated cPanel UI Layout Endpoints
router.get('/ui-layouts/pages', (req, res) => uiLayoutController.getPages(req, res));
router.get('/ui-layouts/pages/:pageId/components', (req, res) => uiLayoutController.getComponentsByPage(req, res));
router.get('/ui-layouts/components/:componentId/layouts', (req, res) => uiLayoutController.getComponentLayouts(req, res));
router.get('/ui-layouts/pages/:pageId/components/:componentId/config', (req, res) => uiLayoutController.getComponentConfig(req, res));
router.post('/ui-layouts/pages/:pageId/components/:componentId/config', (req, res) => uiLayoutController.saveDraft(req, res));
router.post('/ui-layouts/pages/:pageId/components/:componentId/publish', (req, res) => uiLayoutController.publish(req, res));

module.exports = router;

