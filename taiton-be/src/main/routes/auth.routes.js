const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const customerController = require('../controllers/customer.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.post('/auth/google', (req, res) => customerController.googleAuth(req, res));
router.post('/auth/login', (req, res) => authController.login(req, res));
router.get('/auth/session', (req, res) => authController.getSession(req, res));
router.post('/auth/logout', (req, res) => authController.logout(req, res));
router.post('/onboard', (req, res) => authController.onboard(req, res));
router.get('/auth/me', verifyToken, (req, res) => authController.getProfile(req, res));
router.post('/auth/forgot-password', (req, res) => authController.forgotPassword(req, res));
router.post('/auth/reset-password', (req, res) => authController.resetPassword(req, res));
router.post('/auth/change-password', verifyToken, (req, res) => authController.changePassword(req, res));

module.exports = router;
