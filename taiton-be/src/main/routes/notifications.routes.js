const express = require('express');
const router = express.Router();
const notificationsController = require('../controllers/notifications.controller');

router.get('/notifications', (req, res) => notificationsController.getNotifications(req, res));
router.patch('/notifications/:id/read', (req, res) => notificationsController.markRead(req, res));
router.post('/notifications/read-all', (req, res) => notificationsController.markAllRead(req, res));

module.exports = router;
