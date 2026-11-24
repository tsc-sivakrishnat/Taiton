const customerService = require('../services/customer.service');

class CustomerController {
  async googleAuth(req, res) {
    try {
      const { credential } = req.body;
      if (!credential) {
        return res.status(400).json({
          success: false,
          message: 'Google credential is required',
        });
      }
      const result = await customerService.handleGoogleAuth(credential);
      return res.status(200).json({
        success: true,
        message: 'Google authentication successful',
        token: result.token,
        user: result.user,
      });
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: err.message || 'Google authentication failed',
      });
    }
  }

  async getProfile(req, res) {
    try {
      const user = await customerService.getProfile(req.customer.id);
      return res.status(200).json({ success: true, user });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  async updateProfile(req, res) {
    try {
      const { name, mobile } = req.body;
      const user = await customerService.updateProfile(req.customer.id, { name, mobile });
      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        user,
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  async getCart(req, res) {
    try {
      const cart = await customerService.getCart(req.customer.id);
      return res.status(200).json({ success: true, cart });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  async addToCart(req, res) {
    try {
      const { pdt_id, variant_id, qty } = req.body;
      const cart = await customerService.addToCart(req.customer.id, { pdt_id, variant_id, qty });
      return res.status(200).json({ success: true, cart });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  async updateCartItem(req, res) {
    try {
      const { id } = req.params;
      const { qty } = req.body;
      const cart = await customerService.updateCartItem(req.customer.id, id, qty);
      return res.status(200).json({ success: true, cart });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  async removeFromCart(req, res) {
    try {
      const { id } = req.params;
      const cart = await customerService.removeFromCart(req.customer.id, id);
      return res.status(200).json({ success: true, cart });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  async clearCart(req, res) {
    try {
      await customerService.clearCart(req.customer.id);
      return res.status(200).json({ success: true, cart: [] });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  async getWishlist(req, res) {
    try {
      const wishlist = await customerService.getWishlist(req.customer.id);
      return res.status(200).json({ success: true, wishlist });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  async addToWishlist(req, res) {
    try {
      const { pdt_id, variant_id } = req.body;
      const wishlist = await customerService.addToWishlist(req.customer.id, { pdt_id, variant_id });
      return res.status(200).json({ success: true, wishlist });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  async removeFromWishlist(req, res) {
    try {
      const { id } = req.params;
      const wishlist = await customerService.removeFromWishlist(req.customer.id, id);
      return res.status(200).json({ success: true, wishlist });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  async getRecentlyViewed(req, res) {
    try {
      const recentlyViewed = await customerService.getRecentlyViewed(req.customer.id);
      return res.status(200).json({ success: true, recentlyViewed });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  async addRecentlyViewed(req, res) {
    try {
      const { pdt_id } = req.body;
      const recentlyViewed = await customerService.addRecentlyViewed(req.customer.id, pdt_id);
      return res.status(200).json({ success: true, recentlyViewed });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  async clearRecentlyViewed(req, res) {
    try {
      await customerService.clearRecentlyViewed(req.customer.id);
      return res.status(200).json({ success: true, recentlyViewed: [] });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
}

module.exports = new CustomerController();

