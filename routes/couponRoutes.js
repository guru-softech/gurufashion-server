const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const { verifyToken, verifySuperAdmin, maybeVerifyToken } = require('../middleware/authMiddleware');

// Public routes
router.get('/active', couponController.getActiveCoupons);
router.post('/validate', maybeVerifyToken, couponController.validateCoupon);

// Protected Admin routes
router.get('/', verifyToken, verifySuperAdmin, couponController.getAllCoupons);
router.post('/', verifyToken, verifySuperAdmin, couponController.createCoupon);
router.put('/:id', verifyToken, verifySuperAdmin, couponController.updateCoupon);
router.delete('/:id', verifyToken, verifySuperAdmin, couponController.deleteCoupon);

module.exports = router;
