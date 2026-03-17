const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

// We need to parse the private key string to handle literal "\n"s
let privateKey = process.env.FIREBASE_PRIVATE_KEY;
if (privateKey) {
  privateKey = privateKey.replace(/\\n/g, '\n');
}

// Ensure you have these variables in your .env file
let db = null;
let auth = null;

if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      });
      console.log("Firebase Admin Initialized successfully.");
      db = admin.firestore();
      auth = admin.auth();
    } else {
      console.error("CRITICAL: Firebase credentials missing in .env! Logging into Firebase will fail.");
      // Initialize with dummy values or just leave null to prevent crash
    }
  } catch (error) {
    console.error("Firebase admin initialization error:", error.message);
  }
}

module.exports = { admin, db, auth };
