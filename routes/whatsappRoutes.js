const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');
const { verifyToken, verifySuperAdmin } = require('../middleware/authMiddleware');

// Fetch all imported WhatsApp marketing contacts from Firestore
router.get('/contacts', verifyToken, verifySuperAdmin, whatsappController.getContacts);

// Sync Firebase Authentication users with CRM contacts
router.post('/contacts/sync-auth', verifyToken, verifySuperAdmin, whatsappController.syncAuthUsers);

// Bulk store imported WhatsApp marketing contacts in Firestore
router.post('/contacts', verifyToken, verifySuperAdmin, whatsappController.saveContacts);

// Delete all WhatsApp marketing contacts from Firestore
router.delete('/contacts', verifyToken, verifySuperAdmin, whatsappController.clearContacts);

// Delete a specific WhatsApp marketing contact from Firestore
router.delete('/contacts/:id', verifyToken, verifySuperAdmin, whatsappController.deleteContact);

// Update status of a single WhatsApp marketing contact in Firestore
router.patch('/contacts/:id/status', verifyToken, verifySuperAdmin, whatsappController.updateContactStatus);

// Fetch WhatsApp marketing settings (daily limit)
router.get('/settings', verifyToken, verifySuperAdmin, whatsappController.getSettings);

// Update WhatsApp marketing settings
router.post('/settings', verifyToken, verifySuperAdmin, whatsappController.saveSettings);

// Get count of messages successfully sent today
router.get('/stats/today', verifyToken, verifySuperAdmin, whatsappController.getTodayStats);

// Send single WhatsApp template message via Fast2SMS
router.post('/send-single', verifyToken, verifySuperAdmin, whatsappController.sendSingle);

module.exports = router;
