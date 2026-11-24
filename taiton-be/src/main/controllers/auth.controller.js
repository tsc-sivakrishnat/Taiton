const authService = require('../services/auth.service');

class AuthController {
  // POST /cpanel-api/auth/login or /api/auth/login
  async login(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required',
          message: 'Email and password are required',
        });
      }

      const result = await authService.login(email, password);
      if (!result) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password',
          message: 'Invalid email or password',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        token: result.token,
        user: result.user,
        activeOrganization: result.activeOrganization,
        branding: result.branding,
        data: result.user,
      });
    } catch (error) {
      console.error('[AuthController.login] Error:', error);
      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to process login',
        message: error.message || 'Failed to process login',
      });
    }
  }

  // GET /cpanel-api/auth/session or /api/auth/session
  async getSession(req, res) {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.query.token;

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Authorization token required',
        });
      }

      const session = await authService.getSession(token);
      if (!session) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired session',
        });
      }

      return res.status(200).json({
        success: true,
        user: session.user,
        activeOrganization: session.activeOrganization,
        branding: session.branding,
      });
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session',
        error: error.message,
      });
    }
  }

  // POST /cpanel-api/auth/logout or /api/auth/logout
  async logout(req, res) {
    try {
      const authHeader = req.headers.authorization || req.headers.Authorization;
      const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body?.token;
      let userId = req.user?.id || req.body?.userId;

      if (!userId && token) {
        try {
          const secret = process.env.JWT_SECRET || 'dev-only-change-in-production';
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, secret);
          userId = decoded?.id;
        } catch {
          /* ignore token decode failure on logout */
        }
      }

      if (userId) {
        await authService.logout(userId);
      }

      return res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      console.error('[AuthController.logout] Error during logout:', error);
      return res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    }
  }

  // POST /cpanel-api/onboard
  async onboard(req, res) {
    try {
      const { org_code, org_name, full_name, email, password } = req.body;
      if (!org_code || !org_name || !full_name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields for organization onboarding',
        });
      }

      const result = await authService.onboard(req.body);
      return res.status(201).json({
        success: true,
        message: 'Organization and admin account onboarded successfully',
        data: result,
      });
    } catch (error) {
      console.error('[AuthController.onboard] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to complete onboarding',
        error: error.message,
      });
    }
  }

  // GET /cpanel-api/auth/me
  async getProfile(req, res) {
    try {
      const userId = req.query.userId || req.user?.id;
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required',
        });
      }

      const user = await authService.getUserById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      return res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      console.error('[AuthController.getProfile] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve profile',
        error: error.message,
      });
    }
  }

  // POST /cpanel-api/auth/forgot-password
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      const result = await authService.forgotPassword(email);
      return res.status(200).json(result);
    } catch (error) {
      console.error('[AuthController.forgotPassword] Error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to process forgot password request',
      });
    }
  }

  // POST /cpanel-api/auth/reset-password
  async resetPassword(req, res) {
    try {
      const { token, password } = req.body;
      const result = await authService.resetPassword(token, password);
      return res.status(200).json(result);
    } catch (error) {
      console.error('[AuthController.resetPassword] Error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to reset password',
      });
    }
  }

  // POST /cpanel-api/auth/change-password
  async changePassword(req, res) {
    try {
      const userId = req.user?.id || req.body?.userId;
      const { oldPassword, newPassword } = req.body;
      const result = await authService.changePassword(userId, oldPassword, newPassword);
      return res.status(200).json(result);
    } catch (error) {
      console.error('[AuthController.changePassword] Error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to change password',
      });
    }
  }
}

module.exports = new AuthController();
