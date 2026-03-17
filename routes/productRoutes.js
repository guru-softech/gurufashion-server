const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { verifyToken, verifySuperAdmin } = require('../middleware/authMiddleware');

// Public routes
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);

// Protected Admin routes
router.post('/', verifyToken, verifySuperAdmin, productController.createProduct);
router.put('/:id', verifyToken, verifySuperAdmin, productController.updateProduct);
router.delete('/:id', verifyToken, verifySuperAdmin, productController.deleteProduct);

module.exports = router;
