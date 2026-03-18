/**
 * resetCollections.js
 * -------------------------------------------------
 * Deletes ALL documents from the specified Firestore
 * collections, then seeds the orders counter to 0
 * so the first real order starts at serial 001.
 *
 * Run with: node scripts/resetCollections.js
 * -------------------------------------------------
 */

const { db } = require('../firebase/firebaseAdmin');

// ✏️ Collections to wipe
const COLLECTIONS_TO_RESET = [
  'counters',
  'coupons',
  'orders',
];

async function deleteCollection(collectionName) {
  const collectionRef = db.collection(collectionName);
  const snapshot = await collectionRef.get();

  if (snapshot.empty) {
    console.log(`  ⚠️  "${collectionName}" is already empty, skipping.`);
    return 0;
  }

  const BATCH_SIZE = 400;
  let totalDeleted = 0;
  let docs = snapshot.docs;

  while (docs.length > 0) {
    const batch = db.batch();
    const chunk = docs.splice(0, BATCH_SIZE);
    chunk.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    totalDeleted += chunk.length;
  }

  return totalDeleted;
}

async function seedOrderCounter() {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const counterId = `orders_${year}_${month}`;

  // Seed count to 0 so the first real order transaction sets it to 1 → "001"
  await db.collection('counters').doc(counterId).set({ count: 0 });
  console.log(`  ✅ Counter "${counterId}" seeded to 0 (first order will be 001).`);
}

async function main() {
  console.log('\n========================================');
  console.log('   Firestore Collection Reset Script');
  console.log('========================================\n');

  if (!db) {
    console.error('❌ Firebase Admin DB not initialized. Check your .env file.');
    process.exit(1);
  }

  for (const col of COLLECTIONS_TO_RESET) {
    console.log(`🔄 Resetting collection: "${col}"`);
    try {
      const count = await deleteCollection(col);
      if (count > 0) {
        console.log(`  ✅ ${count} documents deleted from "${col}".`);
      }
    } catch (err) {
      console.error(`  ❌ Error resetting "${col}":`, err.message);
    }
  }

  console.log('\n🔢 Seeding orders counter...');
  await seedOrderCounter();

  console.log('\n========================================');
  console.log('  ✅ Reset complete! First order → GFO...001');
  console.log('========================================\n');
  process.exit(0);
}

main();
