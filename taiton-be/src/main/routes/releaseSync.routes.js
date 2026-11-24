const express = require('express');
const router = express.Router();
const releaseSyncController = require('../controllers/releaseSync.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.get('/release/ready-items', verifyToken, (req, res) => releaseSyncController.getReadyItems(req, res));
router.post('/release/go-live', verifyToken, (req, res) => releaseSyncController.goLive(req, res));
router.post('/release/rollback', verifyToken, (req, res) => releaseSyncController.rollback(req, res));
router.get('/release/history', verifyToken, (req, res) => releaseSyncController.getHistory(req, res));
router.get('/release/status', verifyToken, (req, res) => releaseSyncController.getStatus(req, res));

module.exports = router;
