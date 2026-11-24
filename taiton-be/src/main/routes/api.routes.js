const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth.middleware');

const authRoutes = require('./auth.routes');
const customerRoutes = require('./customer.routes');
const dashboardRoutes = require('./dashboard.routes');
const categoryRoutes = require('./category.routes');
const productRoutes = require('./product.routes');
const contentRoutes = require('./content.routes');
const orgRoutes = require('./org.routes');
const supportRoutes = require('./support.routes');
const permissionsRoutes = require('./permissions.routes');
const brandingRoutes = require('./branding.routes');
const notificationsRoutes = require('./notifications.routes');
const navigationRoutes = require('./navigation.routes');
const userRoutes = require('./userRoutes');
const adminRoutes = require('./admin.routes');

const releaseSyncRoutes = require('./releaseSync.routes');
const spacesRoutes = require('./spaces.routes');
const spacesController = require('../controllers/spaces.controller');
const uiLayoutRoutes = require('./uiLayout.routes');
const uiLayoutController = require('../controllers/uiLayout.controller');

// Public auth routes (login, forgot-password, reset-password, onboard)
router.use('/', authRoutes);
router.use('/', customerRoutes);
router.get('/public/spaces', (req, res) => spacesController.getPublicSpaces(req, res));
router.get('/public/ui-layouts/page/:pageSlug', (req, res) => uiLayoutController.getPublishedPageConfig(req, res));
router.get('/public/ui-layouts/page', (req, res) => uiLayoutController.getPublishedPageConfig(req, res));

// Apply token & database active status check to EVERY query & API endpoint
router.use(verifyToken);

// Mount module sub-routers
router.use('/', dashboardRoutes);
router.use('/', categoryRoutes);
router.use('/', productRoutes);
router.use('/', contentRoutes);
router.use('/', spacesRoutes);
router.use('/', uiLayoutRoutes);
router.use('/', orgRoutes);
router.use('/', supportRoutes);
router.use('/', permissionsRoutes);
router.use('/', brandingRoutes);
router.use('/', notificationsRoutes);
router.use('/', navigationRoutes);
router.use('/', releaseSyncRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
