const { prodPool, pool } = require('../../resources/connection');
const queries = require('../queries/customer.queries');
const { createToken, base64UrlDecode } = require('../../utils/customerAuth');

class CustomerService {
  getDb() {
    return prodPool || pool;
  }

  async handleGoogleAuth(credential) {
    if (!credential || typeof credential !== 'string') {
      throw new Error('Valid Google credential is required');
    }

    let tokenData = null;

    try {
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        tokenData = await response.json();
      }
    } catch {
      // Fallback to JWT payload parse
    }

    if (!tokenData || !tokenData.email) {
      try {
        const parts = credential.split('.');
        if (parts.length === 3) {
          const payloadJson = base64UrlDecode(parts[1]);
          tokenData = JSON.parse(payloadJson);
        }
      } catch (decodeErr) {
        throw new Error('Invalid Google credential structure');
      }
    }

    if (!tokenData || !tokenData.email) {
      throw new Error('Unable to extract verified email from Google credential');
    }

    const email = String(tokenData.email).trim().toLowerCase();
    const name = tokenData.name || tokenData.given_name || email.split('@')[0];
    const picture = tokenData.picture || null;
    const googleId = tokenData.sub || null;

    const db = this.getDb();
    let [customer] = await db.query(queries.getCustomerByEmail, [email]);

    if (!customer) {
      const [insertResult] = await db.query(queries.createCustomer, [
        email,
        name,
        picture || null,
        googleId || null,
      ]);

      const [newCustomer] = await db.query(queries.getCustomerById, [insertResult.insertId]);
      customer = newCustomer;
    } else {
      if (picture || googleId) {
        await db.query(queries.updateCustomerAvatarAndGoogleId, [
          picture || null,
          googleId || null,
          customer.id,
        ]);
        if (picture) customer.avatar = picture;
      }
    }

    const safeUser = {
      id: customer.id,
      name: customer.name || '',
      email: customer.email,
      mobile: customer.mobile || '',
      avatar: customer.avatar || null,
      type: customer.type || 'Regular',
    };

    const token = createToken(safeUser, 30);
    return { token, user: safeUser };
  }

  async getProfile(customerId) {
    const db = this.getDb();
    const [customer] = await db.query(queries.getCustomerById, [customerId]);
    if (!customer) throw new Error('Customer not found');
    return {
      id: customer.id,
      name: customer.name || '',
      email: customer.email,
      mobile: customer.mobile || '',
      avatar: customer.avatar || null,
      type: customer.type || 'Regular',
    };
  }

  async updateProfile(customerId, { name, mobile }) {
    const db = this.getDb();
    await db.query(queries.updateCustomerProfile, [
      name ? String(name).trim() : null,
      mobile ? String(mobile).trim() : null,
      customerId,
    ]);
    return this.getProfile(customerId);
  }

  async getCart(customerId) {
    const db = this.getDb();
    const rows = await db.query(queries.getCartItems, [customerId]);
    return rows.map((r) => ({
      id: r.cart_id,
      pdt_id: r.pdt_id,
      variant_id: r.variant_id,
      qty: r.qty,
      code: r.product_code,
      name: r.product_name,
      price: r.variant_price || r.product_price || 0,
      image: r.variant_image || r.product_image || '',
      variantName: r.variant_name || r.variant_colour || null,
      addedAt: r.created_at,
    }));
  }

  async addToCart(customerId, { pdt_id, variant_id = null, qty = 1 }) {
    if (!pdt_id) throw new Error('Product ID is required');
    const db = this.getDb();
    await db.query(queries.upsertCartItem, [
      customerId,
      pdt_id,
      variant_id || null,
      Math.max(1, parseInt(qty, 10) || 1),
    ]);
    return this.getCart(customerId);
  }

  async updateCartItem(customerId, cartItemId, qty) {
    const db = this.getDb();
    const quantity = parseInt(qty, 10);
    if (quantity <= 0) {
      await db.query(queries.removeCartItem, [cartItemId, customerId]);
    } else {
      await db.query(queries.updateCartQty, [quantity, cartItemId, customerId]);
    }
    return this.getCart(customerId);
  }

  async removeFromCart(customerId, cartItemId) {
    const db = this.getDb();
    await db.query(queries.removeCartItem, [cartItemId, customerId]);
    return this.getCart(customerId);
  }

  async clearCart(customerId) {
    const db = this.getDb();
    await db.query(queries.clearCart, [customerId]);
    return [];
  }

  async getWishlist(customerId) {
    const db = this.getDb();
    const rows = await db.query(queries.getWishlistItems, [customerId]);
    return rows.map((r) => ({
      id: r.wishlist_id,
      pdt_id: r.pdt_id,
      variant_id: r.variant_id,
      code: r.product_code,
      name: r.product_name,
      price: r.product_price || 0,
      image: r.variant_image || r.product_image || '',
      variantName: r.variant_name || r.variant_colour || null,
      addedAt: r.created_at,
    }));
  }

  async addToWishlist(customerId, { pdt_id, variant_id = null }) {
    if (!pdt_id) throw new Error('Product ID is required');
    const db = this.getDb();
    await db.query(queries.addToWishlist, [customerId, pdt_id, variant_id || null]);
    return this.getWishlist(customerId);
  }

  async removeFromWishlist(customerId, idOrPdtId) {
    const db = this.getDb();
    await db.query(queries.removeFromWishlist, [idOrPdtId, idOrPdtId, customerId]);
    return this.getWishlist(customerId);
  }

  async getRecentlyViewed(customerId) {
    const db = this.getDb();
    const rows = await db.query(queries.getRecentlyViewed, [customerId]);
    return rows.slice(0, 10).map((r) => ({
      id: r.rv_id || r.id,
      pdt_id: r.pdt_id,
      code: r.product_code,
      name: r.product_name,
      fullname: r.product_name,
      price: r.product_price || 0,
      image: r.product_image || '',
      product_code: r.product_code,
      product_name: r.product_name,
      product_image: r.product_image || '',
      viewed_at: r.viewed_at,
      product: {
        code: r.product_code,
        name: r.product_name,
        fullname: r.product_name,
        price: r.product_price || 0,
        image: r.product_image || '',
      },
    }));
  }

  async addRecentlyViewed(customerId, pdt_id) {
    if (!pdt_id) throw new Error('Product ID is required');
    const db = this.getDb();
    await db.query(queries.upsertRecentlyViewed, [customerId, pdt_id]);
    await db.query(queries.trimRecentlyViewed, [customerId, customerId]);
    return this.getRecentlyViewed(customerId);
  }

  async clearRecentlyViewed(customerId) {
    const db = this.getDb();
    await db.query(queries.clearRecentlyViewed, [customerId]);
    return [];
  }
}

module.exports = new CustomerService();

