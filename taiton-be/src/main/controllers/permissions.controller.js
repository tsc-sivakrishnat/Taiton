class PermissionsController {
  // GET /api/permissions/me or /cpanel-api/permissions/me
  async getMyPermissions(req, res) {
    return res.status(200).json({
      success: true,
      permissions: ['*'],
    });
  }

  // GET /api/permissions/audit or /cpanel-api/permissions/audit
  async getAuditLog(req, res) {
    return res.status(200).json({
      success: true,
      logs: [],
    });
  }
}

module.exports = new PermissionsController();
