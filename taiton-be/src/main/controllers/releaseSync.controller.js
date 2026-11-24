const releaseSyncService = require('../services/releaseSync.service');

class ReleaseSyncController {
  // GET /cpanel-api/release/ready-items
  async getReadyItems(req, res) {
    try {
      const orgCode = req.query.org_code || req.user?.org_code;
      const result = await releaseSyncService.getReadyToLiveItems(orgCode);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('[ReleaseSyncController.getReadyItems] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch items ready for release',
        error: error.message,
      });
    }
  }

  // POST /cpanel-api/release/go-live
  async goLive(req, res) {
    try {
      const orgCode = req.body.org_code || req.user?.org_code;
      const userId = req.user?.id || 0;
      const userName = req.user?.full_name || req.user?.name || 'Organization Admin';
      const releaseNote = req.body.release_note || req.body.releaseNote || '';
      const selectedItemKeys = req.body.selected_items || req.body.selectedItems || [];

      const result = await releaseSyncService.executeGoLiveRelease({
        orgCode,
        userId,
        userName,
        releaseNote,
        selectedItemKeys,
      });

      return res.status(200).json({
        success: true,
        message: 'Production Website Release completed successfully',
        data: result,
      });
    } catch (error) {
      console.error('[ReleaseSyncController.goLive] Error:', error);
      const errMsg = error.message || 'An unexpected error occurred during Go Live.';
      const failureText = errMsg.startsWith('Go to Live is failed') ? errMsg : `Go to Live is failed: ${errMsg}`;
      return res.status(500).json({
        success: false,
        message: failureText,
        error: failureText,
      });
    }
  }

  // POST /cpanel-api/release/rollback
  async rollback(req, res) {
    try {
      const orgCode = req.body.org_code || req.user?.org_code;
      const userId = req.user?.id || 0;
      const userName = req.user?.full_name || req.user?.name || 'Organization Admin';
      const batchId = req.body.batch_id || req.body.batchId || null;

      const result = await releaseSyncService.rollbackLastRelease({
        orgCode,
        userId,
        userName,
        batchId,
      });

      return res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      console.error('[ReleaseSyncController.rollback] Error:', error);
      const errMsg = error.message || 'An unexpected error occurred during Revert.';
      const failureText = errMsg.startsWith('Revert is failed') ? errMsg : `Revert is failed: ${errMsg}`;
      return res.status(500).json({
        success: false,
        message: failureText,
        error: failureText,
      });
    }
  }

  // GET /cpanel-api/release/history
  async getHistory(req, res) {
    try {
      const orgCode = req.query.org_code || req.user?.org_code;
      const history = await releaseSyncService.getReleaseHistory(orgCode);
      return res.status(200).json({
        success: true,
        data: history,
      });
    } catch (error) {
      console.error('[ReleaseSyncController.getHistory] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch release history',
        error: error.message,
      });
    }
  }

  // GET /cpanel-api/release/status
  async getStatus(req, res) {
    try {
      const orgCode = req.query.org_code || req.user?.org_code;
      const status = await releaseSyncService.getLiveStatus(orgCode);
      return res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      console.error('[ReleaseSyncController.getStatus] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch live release status',
        error: error.message,
      });
    }
  }
}

module.exports = new ReleaseSyncController();
