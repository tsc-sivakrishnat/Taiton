const { pool } = require('../../resources/connection');
const SUPPORT_QUERIES = require('../queries/support.queries');

class SupportService {
  // Fetch all tickets for org from tb_cs_tickets
  async getTickets(orgCode) {
    const cleanOrg = orgCode ?? null;
    const [tickets] = await pool.execute(SUPPORT_QUERIES.GET_ALL_TICKETS, [cleanOrg, cleanOrg]);
    for (const t of tickets) {
      try {
        const [atts] = await pool.execute(SUPPORT_QUERIES.GET_ATTACHMENTS_BY_TICKET, [t.id]);
        const [comments] = await pool.execute(SUPPORT_QUERIES.GET_COMMENTS_BY_TICKET, [t.id]);
        const [history] = await pool.execute(SUPPORT_QUERIES.GET_HISTORY_BY_TICKET, [t.id]);
        t.attachments = atts || [];
        t.comments = comments || [];
        t.history = history || [];
      } catch (e) {
        t.attachments = [];
        t.comments = [];
        t.history = [];
      }
    }
    return tickets;
  }

  // Fetch ticket detail by ID from tb_cs_tickets
  async getTicketById(id, orgCode) {
    const cleanOrg = orgCode ?? null;
    const [rows] = await pool.execute(SUPPORT_QUERIES.GET_TICKET_BY_ID, [id, cleanOrg, cleanOrg]);
    if (rows.length === 0) return null;
    const ticket = rows[0];
    try {
      const [atts] = await pool.execute(SUPPORT_QUERIES.GET_ATTACHMENTS_BY_TICKET, [ticket.id]);
      const [comments] = await pool.execute(SUPPORT_QUERIES.GET_COMMENTS_BY_TICKET, [ticket.id]);
      const [history] = await pool.execute(SUPPORT_QUERIES.GET_HISTORY_BY_TICKET, [ticket.id]);
      ticket.attachments = atts || [];
      ticket.comments = comments || [];
      ticket.history = history || [];
    } catch (e) {
      ticket.attachments = [];
      ticket.comments = [];
      ticket.history = [];
    }
    return ticket;
  }

  // Create new ticket in tb_cs_tickets
  async createTicket(orgCode, data) {
    const cleanOrg = orgCode ?? null;
    const {
      web_ticket_id = Date.now() + Math.floor(Math.random() * 1000),
      request_type = 'Issue',
      customer_name = 'Customer',
      raised_by = 'Customer',
      email = '',
      mobile = '',
      subject = 'Support Request',
      message = '',
      status = 'raised',
      priority = 'normal',
      assigned_to = 'Techtrole Support Team',
    } = data;

    const [result] = await pool.execute(SUPPORT_QUERIES.INSERT_TICKET, [
      web_ticket_id,
      cleanOrg,
      request_type,
      customer_name,
      raised_by,
      email,
      mobile,
      subject,
      message,
      status,
      priority,
      assigned_to,
    ]);

    const ticketId = result.insertId;

    // Log initial history entry
    await pool.execute(SUPPORT_QUERIES.INSERT_HISTORY, [
      ticketId,
      'Created',
      raised_by,
      `Ticket #${web_ticket_id} submitted`,
    ]);

    return {
      id: ticketId,
      web_ticket_id,
      org_code: cleanOrg,
      request_type,
      customer_name,
      raised_by,
      email,
      mobile,
      subject,
      message,
      status,
      priority,
      assigned_to,
    };
  }

  // Update status (e.g. in_progress, resolved, closed)
  async updateStatus(id, orgCode, status, updatedBy = 'Admin') {
    const cleanOrg = orgCode ?? null;
    const [result] = await pool.execute(SUPPORT_QUERIES.UPDATE_TICKET_STATUS, [status, id, cleanOrg, cleanOrg]);
    if (result.affectedRows > 0) {
      await pool.execute(SUPPORT_QUERIES.INSERT_HISTORY, [
        id,
        'Status Change',
        updatedBy,
        `Status updated to '${status}'`,
      ]);
    }
    return result.affectedRows > 0;
  }

  // Update assigned person/team
  async assignTicket(id, orgCode, assignedTo, assignedBy = 'Admin') {
    const cleanOrg = orgCode ?? null;
    const [result] = await pool.execute(SUPPORT_QUERIES.UPDATE_TICKET_ASSIGNED, [assignedTo, id, cleanOrg, cleanOrg]);
    if (result.affectedRows > 0) {
      await pool.execute(SUPPORT_QUERIES.INSERT_HISTORY, [
        id,
        'Assigned',
        assignedBy,
        `Assigned to '${assignedTo}'`,
      ]);
    }
    return result.affectedRows > 0;
  }

  // Add comment/reply to ticket
  async addComment(ticketId, { userName, userRole, message }) {
    const [result] = await pool.execute(SUPPORT_QUERIES.INSERT_COMMENT, [
      ticketId,
      userName || 'Support Agent',
      userRole || 'agent',
      message,
    ]);
    return result.insertId;
  }

  // Add attachment to ticket
  async addAttachment(ticketId, { filePath, fileName, uploadedBy }) {
    const [result] = await pool.execute(SUPPORT_QUERIES.INSERT_ATTACHMENT, [
      ticketId,
      filePath,
      fileName,
      uploadedBy || 'User',
    ]);
    return result.insertId;
  }

  // Web contact form responses
  async getWebResponses(orgCode) {
    const cleanOrg = orgCode ?? null;
    try {
      const [rows] = await pool.execute(SUPPORT_QUERIES.GET_ALL_WEB_RESPONSES, [cleanOrg, cleanOrg]);
      return rows;
    } catch (e) {
      if (e.code === 'ER_NO_SUCH_TABLE') {
        try {
          await pool.execute(`
            CREATE TABLE IF NOT EXISTS tb_web_contact (
              id INT AUTO_INCREMENT PRIMARY KEY,
              org_code VARCHAR(100) NULL,
              full_name VARCHAR(255) NULL,
              email VARCHAR(255) NULL,
              phone VARCHAR(100) NULL,
              subject VARCHAR(255) NULL,
              message TEXT NULL,
              is_read TINYINT(1) DEFAULT 0,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
          `);
          const [rows] = await pool.execute(SUPPORT_QUERIES.GET_ALL_WEB_RESPONSES, [cleanOrg, cleanOrg]);
          return rows;
        } catch (createErr) {
          console.error('[getWebResponses] Auto-create table failed:', createErr.message);
          return [];
        }
      }
      console.error('[getWebResponses] Error:', e.message);
      return [];
    }
  }

  async createWebResponse(orgCode, data) {
    const cleanOrg = orgCode ?? null;
    const { full_name, email, phone = null, subject = null, message } = data;
    try {
      const [result] = await pool.execute(SUPPORT_QUERIES.INSERT_WEB_RESPONSE, [
        cleanOrg,
        full_name,
        email,
        phone,
        subject,
        message,
      ]);
      return result.insertId;
    } catch (e) {
      if (e.code === 'ER_NO_SUCH_TABLE') {
        await pool.execute(`
          CREATE TABLE IF NOT EXISTS tb_web_contact (
            id INT AUTO_INCREMENT PRIMARY KEY,
            org_code VARCHAR(100) NULL,
            full_name VARCHAR(255) NULL,
            email VARCHAR(255) NULL,
            phone VARCHAR(100) NULL,
            subject VARCHAR(255) NULL,
            message TEXT NULL,
            is_read TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        const [result] = await pool.execute(SUPPORT_QUERIES.INSERT_WEB_RESPONSE, [
          cleanOrg,
          full_name,
          email,
          phone,
          subject,
          message,
        ]);
        return result.insertId;
      }
      throw e;
    }
  }

  async markWebResponseRead(id, orgCode) {
    const cleanOrg = orgCode ?? null;
    const [result] = await pool.execute(SUPPORT_QUERIES.MARK_WEB_RESPONSE_READ, [id, cleanOrg, cleanOrg]);
    return result.affectedRows > 0;
  }
}

module.exports = new SupportService();
