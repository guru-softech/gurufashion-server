const { admin, db } = require('../firebase/firebaseAdmin');

const fs = require('fs');
const path = require('path');
const logFile = path.join(__dirname, 'sync_results.log');

function log(msg) {
  console.log(msg);
  fs.appendFileSync(logFile, msg + '\n');
}

async function syncUsers() {
  if (!db || !admin) {
    log("Firebase Admin not initialized. Check your .env file.");
    return;
  }

  fs.writeFileSync(logFile, `Sync started at ${new Date().toISOString()}\n`);
  log("Starting user synchronization...");

  try {
    const listUsersResult = await admin.auth().listUsers();
    const users = listUsersResult.users;

    log(`Found ${users.length} authenticated users.`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      const uid = user.uid; // This is the phoneNumber if created via our verifyOtp
      const phoneNumber = user.phoneNumber || uid; // Fallback to uid if phoneNumber field is missing

      const userDocRef = db.collection('users').doc(uid);
      const userDoc = await userDocRef.get();

      if (!userDoc.exists) {
        log(`Creating document for user: ${uid}`);
        await userDocRef.set({
          phoneNumber: phoneNumber,
          role: 'user',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          addresses: []
        });
        createdCount++;
      } else {
        const data = userDoc.data();
        if (!data.role) {
          log(`Updating role for user: ${uid}`);
          await userDocRef.update({ role: 'user' });
          createdCount++; // Counting updates as "created/updated"
        } else {
          skippedCount++;
        }
      }
    }

    log("-----------------------------------");
    log(`Synchronization complete.`);
    log(`New users created: ${createdCount}`);
    log(`Existing users skipped: ${skippedCount}`);
    log("-----------------------------------");

  } catch (error) {
    log("Error during synchronization: " + error.message);
  } finally {
    process.exit(0);
  }
}

syncUsers();
