const supportService = require('../services/support.service');

const formatTicketObj = (t) => {
  if (!t) return null;
  return {
    id: t.id,
    webTicketId: t.web_ticket_id || t.id,
    requestType: t.request_type || 'Issue',
    title: t.subject || 'Support Ticket',
    subject: t.subject || 'Support Ticket',
    description: t.message || '',
    message: t.message || '',
    raisedBy: t.raised_by || t.customer_name || 'Customer',
    customerName: t.customer_name || t.raised_by || 'Customer',
    assignedTo: t.assigned_to || 'Techtrole Support Team',
    email: t.email || '',
    mobile: t.mobile || '',
    phone: t.mobile || '',
    urgency: t.priority || 'normal',
    priority: t.priority || 'normal',
    status: t.status || 'raised',
    createdAt: t.created_at || new Date().toISOString(),
    updatedAt: t.updated_at || new Date().toISOString(),
    attachments: t.attachments || [],
    comments: t.comments || [],
    history: t.history || []
  };
};

class SupportController {
  // GET /cpanel-api/support/tickets or /cpanel-api/support-tickets
  async getTickets(req, res) {
    try {
      const orgCode = req.user?.org_code || req.query.org_code || req.body?.org_code || null;
      const tickets = await supportService.getTickets(orgCode);
      const items = (tickets || []).map(formatTicketObj);
      return res.status(200).json({
        success: true,
        items,
        tickets: items,
        data: items,
        total: items.length
      });
    } catch (error) {
      console.error('[SupportController.getTickets] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch support tickets',
        error: error.message,
      });
    }
  }

  // GET /cpanel-api/support/tickets/:id
  async getTicketById(req, res) {
    try {
      const { id } = req.params;
      const orgCode = req.user?.org_code || req.query.org_code || req.body?.org_code || null;
      const ticket = await supportService.getTicketById(id, orgCode);
      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: `Ticket #${id} not found`,
        });
      }
      const data = formatTicketObj(ticket);
      return res.status(200).json({
        success: true,
        ticket: data,
        data,
      });
    } catch (error) {
      console.error('[SupportController.getTicketById] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch ticket detail',
        error: error.message,
      });
    }
  }

  // POST /cpanel-api/support/tickets or /cpanel-api/support-tickets
  async createTicket(req, res) {
    try {
      const orgCode = req.user?.org_code || req.body?.org_code || req.query?.org_code || null;
      const ticket = await supportService.createTicket(orgCode, req.body);
      return res.status(201).json({
        success: true,
        message: 'Support ticket created successfully',
        ticket,
        data: ticket,
      });
    } catch (error) {
      console.error('[SupportController.createTicket] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create support ticket',
        error: error.message,
      });
    }
  }

  // PATCH /cpanel-api/support/tickets/:id/status
  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const orgCode = req.user?.org_code || req.query.org_code || req.body?.org_code || null;
      const updatedBy = req.user?.fullName || req.user?.full_name || 'Admin';

      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status is required',
        });
      }

      const ok = await supportService.updateStatus(id, orgCode, status, updatedBy);
      return res.status(200).json({
        success: ok,
        message: ok ? 'Ticket status updated' : 'Ticket not found',
      });
    } catch (error) {
      console.error('[SupportController.updateStatus] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update ticket status',
        error: error.message,
      });
    }
  }

  // PATCH /cpanel-api/support/tickets/:id/assign
  async assignTicket(req, res) {
    try {
      const { id } = req.params;
      const { assignedTo } = req.body;
      const orgCode = req.user?.org_code || req.query.org_code || req.body?.org_code || null;
      const assignedBy = req.user?.fullName || req.user?.full_name || 'Admin';

      if (!assignedTo) {
        return res.status(400).json({
          success: false,
          message: 'assignedTo is required',
        });
      }

      const ok = await supportService.assignTicket(id, orgCode, assignedTo, assignedBy);
      return res.status(200).json({
        success: ok,
        message: ok ? 'Ticket assignment updated' : 'Ticket not found',
      });
    } catch (error) {
      console.error('[SupportController.assignTicket] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to assign ticket',
        error: error.message,
      });
    }
  }

  // POST /cpanel-api/support/tickets/:id/comments
  async addComment(req, res) {
    try {
      const { id } = req.params;
      const { message } = req.body;
      const userName = req.user?.fullName || req.user?.full_name || req.body.userName || 'Support Agent';
      const userRole = req.user?.role || req.body.userRole || 'agent';

      if (!message) {
        return res.status(400).json({
          success: false,
          message: 'Message is required',
        });
      }

      const commentId = await supportService.addComment(id, { userName, userRole, message });
      return res.status(201).json({
        success: true,
        message: 'Comment added',
        commentId,
      });
    } catch (error) {
      console.error('[SupportController.addComment] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to add comment',
        error: error.message,
      });
    }
  }

  // GET /cpanel-api/web-responses or /cpanel-api/customer-requests
  async getWebResponses(req, res) {
    try {
      const orgCode = req.user?.org_code || req.query.org_code || req.body?.org_code || null;
      const rows = await supportService.getWebResponses(orgCode);
      return res.status(200).json({
        success: true,
        items: rows,
        responses: rows,
        data: rows,
        total: rows.length,
      });
    } catch (error) {
      console.error('[SupportController.getWebResponses] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch web responses',
        error: error.message,
      });
    }
  }

  // POST /cpanel-api/web-responses
  async createWebResponse(req, res) {
    try {
      const orgCode = req.user?.org_code || req.body?.org_code || req.query?.org_code || null;
      const id = await supportService.createWebResponse(orgCode, req.body);
      return res.status(201).json({
        success: true,
        message: 'Web response submitted',
        id,
      });
    } catch (error) {
      console.error('[SupportController.createWebResponse] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to submit response',
        error: error.message,
      });
    }
  }

  // Alias methods for customer requests / web responses
  async getResponses(req, res) {
    return this.getWebResponses(req, res);
  }

  async createResponse(req, res) {
    return this.createWebResponse(req, res);
  }
}

module.exports = new SupportController();
