const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');

router.get('/getCategories', (req, res) => categoryController.getCategories(req, res));
router.post('/createCategory', (req, res) => categoryController.createCategory(req, res));
router.get('/getSubCategories', (req, res) => categoryController.getSubCategories(req, res));
router.post('/createSubCategory', (req, res) => categoryController.createSubCategory(req, res));
router.delete('/categories/:id', (req, res) => categoryController.deleteCategory(req, res));

module.exports = router;
