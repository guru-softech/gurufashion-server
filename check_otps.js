const { admin, db } = require('./firebase/firebaseAdmin');

async function check() {
  try {
    const snapshot = await db.collection('temp_otps').get();
    console.log('Active OTPs in DB:');
    snapshot.forEach(doc => {
      console.log(`${doc.id} =>`, doc.data());
    });
  } catch (e) {
    console.error(e);
  }
}
check();
