/**
 * whatsappUtils.js
 * --------------------------------------------------
 * Sends WhatsApp order confirmation via Fast2SMS.
 *
 * Template variables (pipe-separated):
 *   {{1}} = Order ID          e.g. GFO180301
 *   {{2}} = Total Amount      e.g. 1500
 *   {{3}} = Discount Amount   e.g. 50
 *   {{4}} = Coupon Code       e.g. WELCOME50
 *   {{5}} = Balance at delivery e.g. 1450
 * --------------------------------------------------
 */

const axios = require('axios');

const FAST2SMS_API_KEY      = process.env.FAST2SMS_API_KEY;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_ORDER_MESSAGE_ID = process.env.WHATSAPP_ORDER_MESSAGE_ID;
const ADMIN_PHONE = '919043006811';

/**
 * Send a WhatsApp template message via Fast2SMS.
 */
async function sendWhatsApp(phoneNumber, variablesValues) {
  const cleaned    = phoneNumber.toString().replace(/[^0-9]/g, '');
  const normalized = cleaned.startsWith('91') ? cleaned : '91' + cleaned;

  if (!WHATSAPP_ORDER_MESSAGE_ID || WHATSAPP_ORDER_MESSAGE_ID === 'REPLACE_WITH_ORDER_TEMPLATE_ID') {
    console.warn('⚠️  WHATSAPP_ORDER_MESSAGE_ID not configured — skipping WhatsApp notification');
    return null;
  }

  try {
    const response = await axios.post(
      'https://www.fast2sms.com/dev/whatsapp',
      {
        message_id:       WHATSAPP_ORDER_MESSAGE_ID,
        phone_number_id:  WHATSAPP_PHONE_NUMBER_ID,
        numbers:          normalized,
        variables_values: variablesValues
      },
      {
        headers: { authorization: FAST2SMS_API_KEY },
        timeout: 8000
      }
    );
    console.log(`✅ WhatsApp sent to ${normalized}:`, response.data);
    return response.data;
  } catch (error) {
    // Never crash the order flow
    console.error(`❌ WhatsApp failed for ${normalized}:`, error.response?.data || error.message);
    return null;
  }
}

/**
 * Send order confirmation to customer + admin.
 *
 * Template text (Fast2SMS):
 *   📦 Your order {{1}} is placed successfully.
 *
 *   Total Order Amount : ₹ {{2}}
 *   Applied Offer amount: ₹ {{3}}
 *   Applied Coupon Code: {{4}}
 *   Pay ₹ {{5}} at delivery
 *
 *   🚚 Delivery in 3–4 days
 *   Thank you! ❤️
 *
 * @param {object} orderData     - Full order saved to Firestore
 * @param {string} customerPhone - Customer phone from deliveryDetails
 */
async function sendOrderConfirmationMessages(orderData, customerPhone) {
  const orderId        = orderData.customOrderId || 'N/A';
  const subtotal       = orderData.subtotal       || orderData.totalAmount || 0;
  const discount       = orderData.discountAmount  || 0;
  const couponCode     = orderData.appliedCoupon?.code || 'NIL';
  const balanceAtDoor  = orderData.balanceDue      || 0;

  // Pipe-separated variables matching {{1}}|{{2}}|{{3}}|{{4}}|{{5}}
  const variables = `${orderId}|${subtotal}|${discount}|${couponCode}|${balanceAtDoor}`;

  const tasks = [];

  if (customerPhone) {
    tasks.push(sendWhatsApp(customerPhone, variables));
  }

  tasks.push(sendWhatsApp(ADMIN_PHONE, variables));

  await Promise.allSettled(tasks);
}

module.exports = { sendOrderConfirmationMessages, sendWhatsApp };
