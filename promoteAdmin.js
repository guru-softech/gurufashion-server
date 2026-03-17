const { admin, db } = require('./firebase/firebaseAdmin');

/**
 * Script to promote a user to Super Admin by setting custom claims and updating Firestore.
 * Usage: 
 *   node promoteAdmin.js <UID>
 *   node promoteAdmin.js <PHONE_NUMBER> (e.g. 9043006167)
 */

let identifier = process.argv[2];

if (!identifier) {
  console.error('Please provide a User UID or Phone Number as an argument.');
  console.log('Example: node promoteAdmin.js 9043006167');
  process.exit(1);
}

const promoteUser = async (input) => {
  try {
    let user;
    
    // Check if input looks like a phone number (10 digits)
    if (/^\d{10}$/.test(input)) {
        const phoneNumber = `+91${input}`;
        console.log(`Looking up user by phone number: ${phoneNumber}...`);
        user = await admin.auth().getUserByPhoneNumber(phoneNumber);
    } else {
        console.log(`Looking up user by UID: ${input}...`);
        try {
            user = await admin.auth().getUser(input);
        } catch (e) {
            // If direct UID lookup fails, try it as a phone number string if it starts with +
            if (input.startsWith('+')) {
                console.log(`UID lookup failed, trying as phone number...`);
                user = await admin.auth().getUserByPhoneNumber(input);
            } else {
                throw e;
            }
        }
    }

    if (!user) {
        console.error('User not found.');
        process.exit(1);
    }

    // 1. Set custom user claims in Firebase Auth (for API middleware)
    await admin.auth().setCustomUserClaims(user.uid, { super_admin: true });
    console.log(`- Custom claim 'super_admin: true' set in Firebase Auth.`);
    
    // 2. Update Firestore document (for visibility and rules)
    await db.collection('users').doc(user.uid).set({
        super_admin: true,
        role: 'admin'
    }, { merge: true });
    console.log(`- Firestore document updated with super_admin: true.`);

    console.log(`\nSuccessfully promoted user ${user.displayName || user.phoneNumber || user.uid} to Super Admin.`);
    console.log('IMPORTANT: The user MUST log out and log back in for the changes to take effect.');
    process.exit(0);
  } catch (error) {
    console.error('Error promoting user:', error);
    process.exit(1);
  }
};

promoteUser(identifier);
