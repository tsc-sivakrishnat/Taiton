const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');
const { requireCustomerAuth } = require('../../utils/customerAuth');

// Public Google Authentication
router.post('/auth/google', (req, res) => customerController.googleAuth(req, res));

// Protected Customer Profile
router.get('/customer/profile', requireCustomerAuth, (req, res) => customerController.getProfile(req, res));
router.put('/customer/profile', requireCustomerAuth, (req, res) => customerController.updateProfile(req, res));

// Protected Cart Endpoints
router.get('/customer/cart', requireCustomerAuth, (req, res) => customerController.getCart(req, res));
router.post('/customer/cart', requireCustomerAuth, (req, res) => customerController.addToCart(req, res));
router.put('/customer/cart/:id', requireCustomerAuth, (req, res) => customerController.updateCartItem(req, res));
router.delete('/customer/cart/:id', requireCustomerAuth, (req, res) => customerController.removeFromCart(req, res));
router.delete('/customer/cart', requireCustomerAuth, (req, res) => customerController.clearCart(req, res));

// Protected Wishlist Endpoints
router.get('/customer/wishlist', requireCustomerAuth, (req, res) => customerController.getWishlist(req, res));
router.post('/customer/wishlist', requireCustomerAuth, (req, res) => customerController.addToWishlist(req, res));
router.delete('/customer/wishlist/:id', requireCustomerAuth, (req, res) => customerController.removeFromWishlist(req, res));

// Protected Recently Viewed Endpoints (strictly last 10)
router.get('/customer/recently-viewed', requireCustomerAuth, (req, res) => customerController.getRecentlyViewed(req, res));
router.post('/customer/recently-viewed', requireCustomerAuth, (req, res) => customerController.addRecentlyViewed(req, res));
router.delete('/customer/recently-viewed', requireCustomerAuth, (req, res) => customerController.clearRecentlyViewed(req, res));

module.exports = router;

