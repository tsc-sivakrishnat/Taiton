const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');

router.get('/getProducts', (req, res) => productController.getProducts(req, res));
router.get('/products/:id', (req, res) => productController.getProductById(req, res));
router.post('/createProduct', (req, res) => productController.createProduct(req, res));
router.post('/createVariant', (req, res) => productController.createVariant(req, res));
router.delete('/products/:id', (req, res) => productController.deleteProduct(req, res));

module.exports = router;
