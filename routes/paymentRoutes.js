const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { verifyToken } = require('../middleware/authMiddleware');

router.post('/create-order', verifyToken, paymentController.createRazorpayOrder);
router.post('/verify-payment', verifyToken, paymentController.verifyPayment);

module.exports = router;
