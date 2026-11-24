const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');

router.get('/dashboard/summary', (req, res) => dashboardController.getSummary(req, res));
router.get('/dashboard/hosting-metrics', (req, res) => dashboardController.getHostingMetrics(req, res));

module.exports = router;
