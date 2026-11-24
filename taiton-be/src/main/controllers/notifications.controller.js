const { pool } = require('../../resources/connection');

class NotificationsController {
  // GET /cpanel-api/notifications
  async getNotifications(req, res) {
    try {
      const orgCode = req.query.org_code || req.user?.org_code;
      const userId = req.user?.id || 0;

      const [rows] = await pool.execute(
        `SELECT n.id, n.org_code, n.sent_by, n.sent_to, n.message, n.created_at,
                (CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END) as is_read,
                r.read_at
         FROM tb_org_notifications n
         LEFT JOIN tb_org_readrecepits r ON n.id = r.notification_id AND r.read_by = ?
         WHERE (LOWER(n.org_code) = LOWER(?) OR ? IS NULL) AND (n.sent_to = ? OR n.sent_to = 0 OR n.sent_to = 'all' OR n.sent_to IS NULL)
         ORDER BY n.id DESC LIMIT 100`,
        [userId, orgCode, orgCode, userId]
      );

      const notifications = rows.map((r) => ({
        id: r.id,
        title: r.message,
        message: r.message,
        body: r.message,
        read: Boolean(r.is_read),
        is_read: Boolean(r.is_read),
        readAt: r.is_read ? (r.read_at || r.created_at) : null,
        read_at: r.is_read ? (r.read_at || r.created_at) : null,
        createdAt: r.created_at,
        created_at: r.created_at,
      }));

      return res.status(200).json({
        success: true,
        notifications,
        items: notifications,
        data: notifications,
        total: notifications.length,
      });
    } catch (error) {
      console.error('[NotificationsController.getNotifications] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch notifications',
        error: error.message,
      });
    }
  }

  // PATCH /cpanel-api/notifications/:id/read
  async markRead(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || 0;

      const [existing] = await pool.execute(
        `SELECT id FROM tb_org_readrecepits WHERE notification_id = ? AND read_by = ?`,
        [id, userId]
      );
      if (existing.length === 0) {
        await pool.execute(
          `INSERT INTO tb_org_readrecepits (notification_id, read_by) VALUES (?, ?)`,
          [id, userId]
        );
      }

      return res.status(200).json({
        success: true,
        message: 'Notification marked as read',
      });
    } catch (error) {
      console.error('[NotificationsController.markRead] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read',
        error: error.message,
      });
    }
  }

  // POST /cpanel-api/notifications/read-all
  async markAllRead(req, res) {
    try {
      const orgCode = req.query.org_code || req.user?.org_code;
      const userId = req.user?.id || 0;

      const [unreadRows] = await pool.execute(
        `SELECT n.id FROM tb_org_notifications n
         LEFT JOIN tb_org_readrecepits r ON n.id = r.notification_id AND r.read_by = ?
         WHERE LOWER(n.org_code) = LOWER(?) AND (n.sent_to = ? OR n.sent_to = 0) AND r.id IS NULL`,
        [userId, orgCode, userId]
      );

      for (const n of unreadRows) {
        await pool.execute(
          `INSERT IGNORE INTO tb_org_readrecepits (notification_id, read_by) VALUES (?, ?)`,
          [n.id, userId]
        );
      }

      return res.status(200).json({
        success: true,
        message: 'All notifications marked as read',
      });
    } catch (error) {
      console.error('[NotificationsController.markAllRead] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to mark all as read',
        error: error.message,
      });
    }
  }
}

module.exports = new NotificationsController();
