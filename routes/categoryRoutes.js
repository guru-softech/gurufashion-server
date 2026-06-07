const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { verifyToken, verifySuperAdmin } = require('../middleware/authMiddleware');

// Public routes
router.get('/', categoryController.getAllCategories);

// Protected Admin routes
router.post('/', verifyToken, verifySuperAdmin, categoryController.createCategory);
router.put('/:id', verifyToken, verifySuperAdmin, categoryController.updateCategory);
router.delete('/:id', verifyToken, verifySuperAdmin, categoryController.deleteCategory);

module.exports = router;
