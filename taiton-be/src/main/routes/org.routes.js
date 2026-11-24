const express = require('express');
const router = express.Router();
const orgController = require('../controllers/org.controller');
const navigationController = require('../controllers/navigation.controller');

// Direct /organizations routes
router.get('/organizations', (req, res) => orgController.getOrganizations(req, res));
router.post('/organizations', (req, res) => orgController.createOrganization(req, res));
router.get('/organizations/:code', (req, res) => orgController.getOrgByCode(req, res));

// Platform aliases
router.get('/platform/organizations', (req, res) => orgController.getOrganizations(req, res));
router.post('/platform/organizations', (req, res) => orgController.createOrganization(req, res));
router.get('/platform/organizations/:code', (req, res) => orgController.getOrgByCode(req, res));

// Organization Roles
router.get('/org/roles', (req, res) => orgController.getOrgRoles(req, res));
router.get('/platform/organizations/:orgId/roles', (req, res) => orgController.getOrgRoles(req, res));
router.post('/platform/organizations/:orgId/roles', (req, res) => orgController.createOrgRole(req, res));
router.delete('/platform/organizations/:orgId/roles/:roleCode', (req, res) => orgController.deleteOrgRole(req, res));
router.get('/platform/organizations/:orgId/assignable-roles', (req, res) => orgController.getOrgRoles(req, res));
router.get('/platform/roles', (req, res) => orgController.getOrgRoles(req, res));
router.post('/platform/roles', (req, res) => orgController.createOrgRole(req, res));

// Organization Administrators & Members
router.get('/platform/organizations/:orgId/org-admins', (req, res) => orgController.getOrgAdmins(req, res));
router.post('/platform/organizations/:orgId/org-admin', (req, res) => orgController.createOrgAdmin(req, res));
router.post('/platform/organizations/:orgId/org-admins', (req, res) => orgController.createOrgAdmin(req, res));
router.patch('/platform/organizations/:orgId/org-admins/:userId', (req, res) => orgController.updateOrgAdmin(req, res));
router.put('/platform/organizations/:orgId/org-admins/:userId', (req, res) => orgController.updateOrgAdmin(req, res));
router.delete('/platform/organizations/:orgId/org-admins/:userId', (req, res) => orgController.deleteOrgAdmin(req, res));
router.get('/platform/organizations/:orgId/members', (req, res) => orgController.getOrgAdmins(req, res));
router.post('/platform/organizations/:orgId/members', (req, res) => orgController.createOrgAdmin(req, res));
router.patch('/platform/organizations/:orgId/members/:userId', (req, res) => orgController.updateOrgAdmin(req, res));
router.put('/platform/organizations/:orgId/members/:userId', (req, res) => orgController.updateOrgAdmin(req, res));
router.delete('/platform/organizations/:orgId/members/:userId', (req, res) => orgController.deleteOrgAdmin(req, res));

// Navigation & Config
router.get('/org/navigation', (req, res) => navigationController.getNavigation(req, res));
router.get('/platform/organizations/:orgId/nav', (req, res) => navigationController.getNavigation(req, res));
router.post('/platform/organizations/:orgId/nav', (req, res) => orgController.createNavigation(req, res));
router.post('/platform/organizations/:orgId/nav/reorder', (req, res) => orgController.reorderNavigation(req, res));
router.delete('/platform/organizations/:orgId/nav/:navId', (req, res) => orgController.deleteNavigation(req, res));
router.get('/platform/nav-icons', (req, res) => orgController.getNavIcons(req, res));
router.get('/platform/routes', (req, res) => orgController.getConfigRoutes(req, res));
router.get('/platform/config-routes', (req, res) => orgController.getConfigRoutes(req, res));
router.get('/platform/nav-items', (req, res) => navigationController.getNavigation(req, res));

// Navigation & Audit routes
router.get('/navigation', (req, res) => navigationController.getNavigation(req, res));
router.post('/navigation', (req, res) => orgController.createNavigation(req, res));
router.get('/audit-logs', (req, res) => orgController.getAuditLogs(req, res));

// Approval Rules CRUD
router.get('/org/approval-rules', (req, res) => orgController.getApprovalRules(req, res));
router.post('/org/approval-rules', (req, res) => orgController.upsertApprovalRule(req, res));
router.delete('/org/approval-rules/:id', (req, res) => orgController.deleteApprovalRule(req, res));

module.exports = router;
