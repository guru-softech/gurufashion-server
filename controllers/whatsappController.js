const axios = require('axios');
const { db, auth } = require('../firebase/firebaseAdmin');

const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const COLLECTION_NAME = 'whatsapp_contacts';

/**
 * Fetch all WhatsApp contacts from Firestore.
 */
exports.getContacts = async (req, res) => {
  try {
    const snapshot = await db.collection(COLLECTION_NAME).orderBy('importedAt', 'asc').get();
    const contacts = [];
    snapshot.forEach(doc => {
      contacts.push({ id: doc.id, ...doc.data() });
    });
    res.json(contacts);
  } catch (error) {
    console.error("Error fetching contacts from Firestore:", error);
    res.status(500).json({ error: "Failed to fetch contacts: " + error.message });
  }
};

/**
 * Sync Firebase Authentication phone numbers to WhatsApp CRM contacts.
 */
exports.syncAuthUsers = async (req, res) => {
  try {
    const now = new Date();
    const candidatePhones = new Map(); // normalizedPhone -> metadata

    // 1. Fetch from Firestore 'users' collection (where registered customer profiles are stored)
    const usersSnapshot = await db.collection('users').get();
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      const rawPhone = data.phoneNumber || doc.id; // doc.id is usually the phone number e.g. +91XXXXXXXXXX
      if (rawPhone) {
        const cleaned = rawPhone.replace(/[^0-9]/g, '');
        let normalized = cleaned;
        if (cleaned.length === 10) {
          normalized = '91' + cleaned;
        }
        if (normalized.length === 12 && normalized.startsWith('91')) {
          candidatePhones.set(normalized, {
            Name: data.name || 'Registered Customer',
            Email: data.email || 'N/A',
            Source: 'Firestore Users'
          });
        }
      }
    });

    // 2. Fetch from Firebase Auth user pool (as backup/fallback)
    try {
      let nextPageToken;
      do {
        const listUsersResult = await auth.listUsers(1000, nextPageToken);
        for (const user of listUsersResult.users) {
          const rawPhone = user.phoneNumber || user.uid; // uid might be the phone number in custom token flow
          if (rawPhone) {
            const cleaned = rawPhone.replace(/[^0-9]/g, '');
            let normalized = cleaned;
            if (cleaned.length === 10) {
              normalized = '91' + cleaned;
            }
            if (normalized.length === 12 && normalized.startsWith('91')) {
              if (!candidatePhones.has(normalized)) {
                candidatePhones.set(normalized, {
                  Name: user.displayName || 'Auth User',
                  Email: user.email || 'N/A',
                  Source: 'Firebase Auth'
                });
              }
            }
          }
        }
        nextPageToken = listUsersResult.nextPageToken;
      } while (nextPageToken);
    } catch (authErr) {
      console.warn("Firebase Auth listUsers warning (skipping auth pool fallback):", authErr.message);
    }

    // 3. Fetch existing CRM contacts to prevent duplicate inserts
    const snapshot = await db.collection(COLLECTION_NAME).get();
    const existingPhones = new Set();
    snapshot.forEach(doc => {
      existingPhones.add(doc.data().phoneNumber);
    });

    let batch = db.batch();
    let count = 0;
    const promises = [];
    let syncedCount = 0;

    for (const [normalized, meta] of candidatePhones.entries()) {
      if (!existingPhones.has(normalized)) {
        const docRef = db.collection(COLLECTION_NAME).doc();
        batch.set(docRef, {
          phoneNumber: normalized,
          rawData: {
            Name: meta.Name,
            Email: meta.Email,
            Source: meta.Source
          },
          status: 'pending',
          errorMessage: '',
          importedAt: now,
          updatedAt: now
        });
        
        syncedCount++;
        count++;
        if (count === 400) {
          promises.push(batch.commit());
          batch = db.batch();
          count = 0;
        }
      }
    }

    if (count > 0) {
      promises.push(batch.commit());
    }
    await Promise.all(promises);

    res.json({ success: true, count: syncedCount });
  } catch (error) {
    console.error("Error syncing Firebase users:", error);
    res.status(500).json({ error: "Failed to sync users: " + error.message });
  }
};

/**
 * Bulk save/upsert contacts to Firestore.
 * Handles duplicate numbers in the CSV, validates format, skips digit mismatches,
 * and upserts (updates existing instead of deleting).
 */
exports.saveContacts = async (req, res) => {
  const { contacts } = req.body;

  if (!contacts || !Array.isArray(contacts)) {
    return res.status(400).json({ error: "Contacts array is required." });
  }

  try {
    console.log(`Starting bulk import validation and upsert of ${contacts.length} contacts...`);
    const now = new Date();
    
    // Fetch all existing contacts' phone numbers to do in-memory lookup
    const snapshot = await db.collection(COLLECTION_NAME).get();
    const existingContactsMap = {}; // phoneNumber -> docId
    snapshot.forEach(doc => {
      existingContactsMap[doc.data().phoneNumber] = doc.id;
    });

    let batch = db.batch();
    let batchCount = 0;
    const promises = [];
    let importedCount = 0;
    let skippedCount = 0;
    
    // Set to deduplicate within the uploaded CSV itself
    const seenInCSV = new Set();

    for (const contact of contacts) {
      const rawPhone = contact.phoneNumber || '';
      const cleaned = rawPhone.toString().replace(/[^0-9]/g, '');
      let normalized = cleaned;
      
      if (cleaned.length === 10) {
        normalized = '91' + cleaned;
      }
      
      // Validation: digit mismatch check (must be 12 digits starting with 91)
      if (normalized.length !== 12 || !normalized.startsWith('91')) {
        skippedCount++;
        continue;
      }

      // Deduplicate within the CSV file
      if (seenInCSV.has(normalized)) {
        continue; 
      }
      seenInCSV.add(normalized);

      const existingDocId = existingContactsMap[normalized];
      
      if (existingDocId) {
        // Upsert: Update existing document with new variables/rawData
        const docRef = db.collection(COLLECTION_NAME).doc(existingDocId);
        batch.update(docRef, {
          rawData: contact.rawData || {},
          status: 'pending', // reset to pending for new campaigns
          errorMessage: '',
          updatedAt: now
        });
      } else {
        // Insert new document
        const docRef = db.collection(COLLECTION_NAME).doc();
        batch.set(docRef, {
          phoneNumber: normalized,
          rawData: contact.rawData || {},
          status: 'pending',
          errorMessage: '',
          importedAt: now,
          updatedAt: now
        });
      }

      importedCount++;
      batchCount++;
      
      if (batchCount === 400) {
        promises.push(batch.commit());
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      promises.push(batch.commit());
    }
    
    await Promise.all(promises);
    console.log(`Bulk import complete. Upserted: ${importedCount}, Skipped/Mismatched: ${skippedCount}`);

    res.json({ 
      success: true, 
      count: importedCount,
      skipped: skippedCount
    });
  } catch (error) {
    console.error("Error bulk saving contacts to Firestore:", error);
    res.status(500).json({ error: "Failed to save contacts: " + error.message });
  }
};

/**
 * Delete all WhatsApp contacts from Firestore.
 */
exports.clearContacts = async (req, res) => {
  try {
    const snapshot = await db.collection(COLLECTION_NAME).get();
    const deletePromises = [];
    let batch = db.batch();
    let count = 0;

    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
      count++;
      if (count === 400) {
        deletePromises.push(batch.commit());
        batch = db.batch();
        count = 0;
      }
    }
    if (count > 0) {
      deletePromises.push(batch.commit());
    }
    await Promise.all(deletePromises);

    res.json({ success: true, message: "Cleared all contacts from database." });
  } catch (error) {
    console.error("Error clearing contacts from Firestore:", error);
    res.status(500).json({ error: "Failed to clear contacts: " + error.message });
  }
};

/**
 * Delete a specific contact from Firestore.
 */
exports.deleteContact = async (req, res) => {
  const { id } = req.params;
  try {
    await db.collection(COLLECTION_NAME).doc(id).delete();
    res.json({ success: true, message: `Contact ${id} deleted successfully.` });
  } catch (error) {
    console.error(`Error deleting contact ${id}:`, error);
    res.status(500).json({ error: "Failed to delete contact: " + error.message });
  }
};

/**
 * Update the status of a single contact in Firestore.
 */
exports.updateContactStatus = async (req, res) => {
  const { id } = req.params;
  const { status, errorMessage } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Status is required." });
  }

  try {
    await db.collection(COLLECTION_NAME).doc(id).update({
      status,
      errorMessage: errorMessage || '',
      updatedAt: new Date()
    });
    res.json({ success: true });
  } catch (error) {
    console.error(`Error updating contact status for doc ${id}:`, error);
    res.status(500).json({ error: "Failed to update status: " + error.message });
  }
};

/**
 * Sends a single WhatsApp template message via Fast2SMS.
 */
exports.sendSingle = async (req, res) => {
  const { phoneNumber, messageId, variablesValues } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ error: "Phone number is required." });
  }
  if (!messageId) {
    return res.status(400).json({ error: "Message (Template) ID is required." });
  }

  // Clean and normalize the phone number to 91XXXXXXXXXX
  const cleaned = phoneNumber.toString().replace(/[^0-9]/g, '');
  const normalized = cleaned.startsWith('91') ? cleaned : '91' + cleaned;

  if (normalized.length !== 12) {
    return res.status(400).json({ 
      error: `Invalid phone number format: '${phoneNumber}'. Normalized as '${normalized}' (expected 12 digits starting with 91).` 
    });
  }

  if (!FAST2SMS_API_KEY || !WHATSAPP_PHONE_NUMBER_ID) {
    return res.status(500).json({ 
      error: "Fast2SMS credentials (FAST2SMS_API_KEY, WHATSAPP_PHONE_NUMBER_ID) are missing from server configuration." 
    });
  }

  try {
    console.log(`Sending WhatsApp marketing to ${normalized} (Template ID: ${messageId}, Vars: '${variablesValues || ""}')`);
    
    const response = await axios.post(
      'https://www.fast2sms.com/dev/whatsapp',
      {
        message_id: messageId,
        phone_number_id: WHATSAPP_PHONE_NUMBER_ID,
        numbers: normalized,
        variables_values: variablesValues || ""
      },
      {
        headers: { authorization: FAST2SMS_API_KEY },
        timeout: 10000
      }
    );

    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error(`Fast2SMS Send WhatsApp Error for ${normalized}:`, error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
};

/**
 * Fetch WhatsApp Marketing Settings (e.g. Daily limit)
 */
exports.getSettings = async (req, res) => {
  try {
    const doc = await db.collection('whatsapp_settings').doc('config').get();
    if (!doc.exists) {
      return res.json({ dailyLimit: 500 });
    }
    res.json(doc.data());
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({ error: "Failed to fetch settings: " + error.message });
  }
};

/**
 * Save WhatsApp Marketing Settings
 */
exports.saveSettings = async (req, res) => {
  const { dailyLimit } = req.body;
  
  if (dailyLimit === undefined || isNaN(dailyLimit)) {
    return res.status(400).json({ error: "Valid daily limit value is required." });
  }

  try {
    await db.collection('whatsapp_settings').doc('config').set({
      dailyLimit: parseInt(dailyLimit, 10),
      updatedAt: new Date()
    }, { merge: true });
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error saving settings:", error);
    res.status(500).json({ error: "Failed to save settings: " + error.message });
  }
};

/**
 * Get count of messages successfully sent today
 */
exports.getTodayStats = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0); // start of today in server local time
    
    const snapshot = await db.collection(COLLECTION_NAME)
      .where('updatedAt', '>=', startOfDay)
      .get();
      
    let sentToday = 0;
    snapshot.forEach(doc => {
      if (doc.data().status === 'success') {
        sentToday++;
      }
    });
      
    res.json({ sentToday });
  } catch (error) {
    console.error("Error fetching today's stats:", error);
    res.status(500).json({ error: "Failed to fetch stats: " + error.message });
  }
};
