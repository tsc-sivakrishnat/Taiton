const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.get('/roles', verifyToken, (req, res) => adminController.getRoles(req, res));
router.get('/actors/export', verifyToken, (req, res) => adminController.exportActorsCsv(req, res));
router.get('/actors', verifyToken, (req, res) => adminController.getActors(req, res));
router.post('/actors', verifyToken, (req, res) => adminController.registerActor(req, res));
router.patch('/actors/:id', verifyToken, (req, res) => adminController.updateActor(req, res));
router.put('/actors/:id', verifyToken, (req, res) => adminController.updateActor(req, res));
router.delete('/actors/:id', verifyToken, (req, res) => adminController.deleteActor(req, res));

module.exports = router;
