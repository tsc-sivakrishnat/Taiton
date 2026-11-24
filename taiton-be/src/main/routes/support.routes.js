const express = require('express');
const router = express.Router();
const supportController = require('../controllers/support.controller');

// Support tickets routes (both /support-tickets and /support/tickets aliases)
router.get('/support-tickets', (req, res) => supportController.getTickets(req, res));
router.post('/support-tickets', (req, res) => supportController.createTicket(req, res));

router.get('/support/tickets', (req, res) => supportController.getTickets(req, res));
router.post('/support/tickets', (req, res) => supportController.createTicket(req, res));
router.get('/support/tickets/:id', (req, res) => supportController.getTicketById(req, res));
router.patch('/support/tickets/:id/status', (req, res) => supportController.updateTicketStatus(req, res));
router.post('/support/tickets/:id/comments', (req, res) => supportController.addComment(req, res));

// Orders & customer requests
router.get('/orders', (req, res) => supportController.getOrders(req, res));
router.post('/orders', (req, res) => supportController.createOrder(req, res));
router.get('/customer-requests', (req, res) => supportController.getWebResponses(req, res));
router.post('/customer-requests', (req, res) => supportController.createWebResponse(req, res));

module.exports = router;
