const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { verifyToken, verifySuperAdmin } = require('../middleware/authMiddleware');

// Public routes
router.get('/', settingsController.getSettings);

// Protected Admin routes
router.post('/', verifyToken, verifySuperAdmin, settingsController.updateSettings);

module.exports = router;
