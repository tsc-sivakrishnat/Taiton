const { pool } = require('../../resources/connection');

/**
 * Log an audit entry to tb_board_audit_logs table.
 */
async function logAudit({ orgCode, tableName, recordId, action, maker, message, oldVal, newVal, createdBy }) {
  try {
    const cleanOrg = orgCode;
    const cleanTable = tableName || 'general';
    const cleanRecId = Number(recordId || 0);
    const cleanAction = action || 'update';
    const makerStr = String(maker || createdBy || 'Admin').slice(0, 190);
    const creatorId = Number(createdBy || 0);

    const oldValStr = oldVal ? (typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal)) : null;
    const newValStr = newVal ? (typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal)) : null;
    const msgStr = message ? String(message).slice(0, 500) : null;

    await pool.execute(
      `INSERT INTO tb_board_audit_logs (org_code, table_name, record_id, action, maker, message, old_val, new_val, synced, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [cleanOrg, cleanTable, cleanRecId, cleanAction, makerStr, msgStr, oldValStr, newValStr, creatorId]
    );
  } catch (err) {
    console.error('[AuditLogger] Error writing audit log:', err.message);
  }
}

module.exports = { logAudit };
