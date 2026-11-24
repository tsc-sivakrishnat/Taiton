const express = require('express');
const router = express.Router();
const navigationController = require('../controllers/navigation.controller');

router.get('/navigation', (req, res) => navigationController.getNavigation(req, res));

module.exports = router;
