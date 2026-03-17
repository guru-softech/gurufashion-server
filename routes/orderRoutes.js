const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { verifyToken, verifySuperAdmin } = require('../middleware/authMiddleware');

// Get all orders (Admin only)
router.get('/', verifyToken, verifySuperAdmin, orderController.getAllOrders);

// Get dashboard stats (Admin only)
router.get('/dashboard/stats', verifyToken, verifySuperAdmin, orderController.getDashboardStats);

// Get user specific orders
router.get('/my-orders', verifyToken, orderController.getUserOrders);

// Get specific order
router.get('/:id', verifyToken, orderController.getOrderById);

// Create order
router.post('/', verifyToken, orderController.createOrder);

// Update order status (Admin only)
router.patch('/:id/status', verifyToken, verifySuperAdmin, orderController.updateOrderStatus);

module.exports = router;
