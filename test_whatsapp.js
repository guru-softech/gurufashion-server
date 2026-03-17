const axios = require('axios');
require('dotenv').config();

const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY;
const WHATSAPP_MESSAGE_ID = process.env.WHATSAPP_MESSAGE_ID;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

console.log('Testing with:');
console.log('API KEY:', FAST2SMS_API_KEY ? 'Present' : 'MISSING');
console.log('WABA ID:', WHATSAPP_PHONE_NUMBER_ID);
console.log('MSG ID:', WHATSAPP_MESSAGE_ID);

async function test() {
  try {
    const response = await axios.post('https://www.fast2sms.com/dev/whatsapp', {
      message_id: WHATSAPP_MESSAGE_ID,
      phone_number_id: WHATSAPP_PHONE_NUMBER_ID,
      numbers: '919043006167', // User's number
      variables_values: '123456'
    }, {
      headers: {
        'authorization': FAST2SMS_API_KEY
      }
    });
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    if (error.response) {
      console.error('API Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

test();
