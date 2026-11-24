const express = require('express');
const router = express.Router();
const spacesController = require('../controllers/spaces.controller');

// Public route for spaces (used by external site or showroom)
router.get('/public/spaces', (req, res) => spacesController.getPublicSpaces(req, res));

// Explore Spaces CRUD endpoints
router.get('/spaces', (req, res) => spacesController.getSpaces(req, res));
router.get('/spaces/:id', (req, res) => spacesController.getSpaceById(req, res));
router.post('/spaces', (req, res) => spacesController.createSpace(req, res));
router.put('/spaces/:id', (req, res) => spacesController.updateSpace(req, res));
router.patch('/spaces/:id', (req, res) => spacesController.updateSpace(req, res));
router.delete('/spaces/:id', (req, res) => spacesController.deleteSpace(req, res));
router.patch('/spaces/:id/view', (req, res) => spacesController.toggleView(req, res));

module.exports = router;
