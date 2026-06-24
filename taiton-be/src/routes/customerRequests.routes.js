import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as customerRequestsService from '../services/customerRequests.service.js';

export const customerRequestsRouter = Router();

customerRequestsRouter.get('/', requireAuth, async (req, res) => {
  try {
    const data = await customerRequestsService.listCustomerRequests({
      organizationId: req.auth.organizationId,
      roleCode: req.auth.role,
      limit: req.query.limit,
      offset: req.query.offset,
      status: req.query.status,
      requestType: req.query.requestType,
    });
    res.json(data);
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});

customerRequestsRouter.post('/', requireAuth, async (req, res) => {
  try {
    const item = await customerRequestsService.createCustomerRequest({
      organizationId: req.auth.organizationId,
      requestType: req.body?.requestType,
      customerName: req.body?.customerName,
      email: req.body?.email,
      phone: req.body?.phone,
      subject: req.body?.subject,
      message: req.body?.message,
      callerAuth: req.auth,
    });
    res.status(201).json({ item });
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});

customerRequestsRouter.patch('/:id', requireAuth, async (req, res) => {
  try {
    const item = await customerRequestsService.updateCustomerRequestStatus({
      organizationId: req.auth.organizationId,
      id: Number(req.params.id),
      status: req.body?.status,
      assignedUserId: req.body?.assignedUserId,
      callerAuth: req.auth,
    });
    res.json({ item });
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'Server error' });
  }
});
