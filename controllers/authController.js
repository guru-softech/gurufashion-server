const axios = require('axios');
const { admin, db } = require('../firebase/firebaseAdmin');

const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY;

const WHATSAPP_MESSAGE_ID = process.env.WHATSAPP_MESSAGE_ID;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

const sendOtp = async (req, res) => {
  const { phoneNumber } = req.body;
  console.log('Incoming OTP request for:', phoneNumber);

  if (!phoneNumber || phoneNumber.length !== 13) {
    return res.status(400).json({ error: 'Valid 10-digit mobile number with +91 is required.' });
  }

  if (!WHATSAPP_MESSAGE_ID || !WHATSAPP_PHONE_NUMBER_ID) {
    console.error('WhatsApp Credentials Missing in .env');
    return res.status(500).json({ error: 'WhatsApp OTP service not configured. Please check server settings.' });
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    // 1. Send via Fast2SMS WhatsApp API
    // Ensure number is in 91XXXXXXXXXX format (without +)
    const formattedNumber = '91' + phoneNumber.replace('+91', '');
    
    console.log('Sending WhatsApp OTP to:', formattedNumber);
    console.log('Using IDs:', { WHATSAPP_MESSAGE_ID, WHATSAPP_PHONE_NUMBER_ID });

    const response = await axios.post('https://www.fast2sms.com/dev/whatsapp', {
      message_id: WHATSAPP_MESSAGE_ID,
      phone_number_id: WHATSAPP_PHONE_NUMBER_ID,
      numbers: formattedNumber,
      variables_values: otp
    }, {
      headers: {
        'authorization': FAST2SMS_API_KEY
      }
    });

    console.log('Fast2SMS WhatsApp Response:', response.data);

    if (!response.data.return) {
      console.error('Fast2SMS WhatsApp Error Detail:', response.data);
      throw new Error(response.data.message || 'Fast2SMS failed to send WhatsApp OTP');
    }

    // 2. Store OTP in Firestore (temporary)
    if (!db) {
      throw new Error('Database connection not available. Check Firebase credentials in .env');
    }

    await db.collection('temp_otps').doc(phoneNumber).set({
      otp,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
    });

    res.status(200).json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Fast2SMS Error:', error.message);
    res.status(500).json({ error: 'Failed to send OTP. Please try again later.' });
  }
};

const verifyOtp = async (req, res) => {
  const phoneNumber = req.body.phoneNumber?.trim();
  const otp = req.body.otp?.trim();

  if (!phoneNumber || !otp) {
    return res.status(400).json({ error: 'Phone number and OTP are required.' });
  }

  try {
    const otpDoc = await db.collection('temp_otps').doc(phoneNumber).get();

    if (!otpDoc.exists) {
      return res.status(400).json({ error: 'OTP not found or expired.' });
    }

    const data = otpDoc.data();
    console.log('Verification Debug:', {
      lookingUp: phoneNumber,
      storedOtp: data.otp,
      receivedOtp: otp,
      match: data.otp === otp
    });

    // Check expiry
    if (Date.now() > data.expiresAt) {
      await db.collection('temp_otps').doc(phoneNumber).delete();
      return res.status(400).json({ error: 'OTP has expired.' });
    }

    // Check match
    if (data.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP.' });
    }

    // OTP is valid!
    // 3. Clear the OTP
    await db.collection('temp_otps').doc(phoneNumber).delete();

    // 4. Generate Firebase Custom Token
    // We use the phoneNumber as the UID for simplicity if they aren't fully registered yet, 
    // or we could look up the user. Firebase handles merging if the UID matches.
    const customToken = await admin.auth().createCustomToken(phoneNumber);

    res.status(200).json({ success: true, customToken });
  } catch (error) {
    console.error('Verify OTP Error:', error.message);
    res.status(500).json({ error: 'Verification failed.' });
  }
};

module.exports = {
  sendOtp,
  verifyOtp
};
