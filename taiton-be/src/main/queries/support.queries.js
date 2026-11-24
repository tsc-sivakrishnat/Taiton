/**
 * Centralized SQL Queries for Customer Support (tb_cs_tickets, tb_cs_attachments, tb_cs_comments, tb_cs_history), Orders, & Web Responses.
 */

const SUPPORT_QUERIES = {
  // Support Tickets
  GET_ALL_TICKETS: `
    SELECT id, web_ticket_id, org_code, request_type, customer_name, raised_by, email, mobile, subject, message, status, priority, assigned_to, created_at, updated_at
    FROM tb_cs_tickets
    WHERE (LOWER(org_code) = LOWER(?) OR ? IS NULL)
    ORDER BY id DESC
  `,

  GET_TICKET_BY_ID: `
    SELECT id, web_ticket_id, org_code, request_type, customer_name, raised_by, email, mobile, subject, message, status, priority, assigned_to, created_at, updated_at
    FROM tb_cs_tickets
    WHERE id = ? AND (LOWER(org_code) = LOWER(?) OR ? IS NULL)
  `,

  INSERT_TICKET: `
    INSERT INTO tb_cs_tickets (web_ticket_id, org_code, request_type, customer_name, raised_by, email, mobile, subject, message, status, priority, assigned_to)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,

  UPDATE_TICKET_STATUS: `
    UPDATE tb_cs_tickets
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND (LOWER(org_code) = LOWER(?) OR ? IS NULL)
  `,

  UPDATE_TICKET_ASSIGNED: `
    UPDATE tb_cs_tickets
    SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND (LOWER(org_code) = LOWER(?) OR ? IS NULL)
  `,

  // Attachments (tb_cs_attachments)
  INSERT_ATTACHMENT: `
    INSERT INTO tb_cs_attachments (ticket_id, file_path, file_name, uploaded_by)
    VALUES (?, ?, ?, ?)
  `,

  GET_ATTACHMENTS_BY_TICKET: `
    SELECT id, ticket_id, file_path, file_name, uploaded_by, created_at
    FROM tb_cs_attachments
    WHERE ticket_id = ?
    ORDER BY id ASC
  `,

  // Comments (tb_cs_comments)
  INSERT_COMMENT: `
    INSERT INTO tb_cs_comments (ticket_id, user_name, user_role, message)
    VALUES (?, ?, ?, ?)
  `,

  GET_COMMENTS_BY_TICKET: `
    SELECT id, ticket_id, user_name, user_role, message, created_at
    FROM tb_cs_comments
    WHERE ticket_id = ?
    ORDER BY id ASC
  `,

  // History (tb_cs_history)
  INSERT_HISTORY: `
    INSERT INTO tb_cs_history (ticket_id, action, performed_by, note)
    VALUES (?, ?, ?, ?)
  `,

  GET_HISTORY_BY_TICKET: `
    SELECT id, ticket_id, action, performed_by, note, created_at
    FROM tb_cs_history
    WHERE ticket_id = ?
    ORDER BY id ASC
  `,

  // Web Contact Form Responses (tb_web_contact)
  GET_ALL_WEB_RESPONSES: `
    SELECT id, org_code, full_name, email, phone, subject, message, is_read, created_at
    FROM tb_web_contact
    WHERE (LOWER(org_code) = LOWER(?) OR ? IS NULL)
    ORDER BY id DESC
  `,

  INSERT_WEB_RESPONSE: `
    INSERT INTO tb_web_contact (org_code, full_name, email, phone, subject, message, is_read)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `,

  MARK_WEB_RESPONSE_READ: `
    UPDATE tb_web_contact
    SET is_read = 1
    WHERE id = ? AND (LOWER(org_code) = LOWER(?) OR ? IS NULL)
  `,
};

module.exports = SUPPORT_QUERIES;
