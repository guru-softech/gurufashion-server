/**
 * googleSheetUtils.js
 * --------------------------------------------------
 * Synchronizes order data with a Google Sheet via Apps Script.
 * --------------------------------------------------
 */

const axios = require('axios');

const GOOGLE_SHEET_SYNC_URL = process.env.GOOGLE_SHEET_SYNC_URL;

/**
 * Formats and sends order data to Google Sheets.
 * @param {object} orderData - The complete order object
 * @param {string} userEmail - User's email from Auth
 */
async function syncOrderToGoogleSheets(orderData, userEmail) {
  if (!GOOGLE_SHEET_SYNC_URL) {
    console.warn('⚠️  GOOGLE_SHEET_SYNC_URL not set in .env — skipping sync');
    return null;
  }

  try {
    const now = new Date();
    const formattedDate = now.toISOString().replace('T', ' ').split('.')[0];

    const invoice = {
      orderid: orderData.customOrderId,
      useremail: userEmail || 'gurusoftech.chennai@gmail.com',
      orderdate: formattedDate,
      name: orderData.deliveryDetails?.name || 'Customer',
      instalink: 'Website Order',
      address: orderData.deliveryDetails?.address || '',
      city: orderData.deliveryDetails?.city || '',
      state: orderData.deliveryDetails?.state || '',
      pincode: orderData.deliveryDetails?.pincode || '',
      mobilenumber: orderData.deliveryDetails?.phone || '',
      altermobil: '',
      prepaid_cod: orderData.paymentMethod === 'cod' ? 'COD' : 'Pre-paid',
      totalamount: orderData.totalAmount?.toString() || '0',
      codamount: orderData.paymentMethod === 'cod' ? orderData.balanceDue?.toString() : '',
      paidamount: orderData.advancePaid?.toString() || '0',
      balanceamount: orderData.balanceDue?.toString() || '0',
      shippingamount: orderData.shippingCost?.toString() || '',
      paymentmethod: orderData.paymentMethod === 'cod' ? 'COD' : 'Full Paid',
      noofitems: orderData.cartItems?.length || 0,
      billedby: 'Guru',
      orderconfirmation: 'TRUE',
      waybillstatus: 'Order Confirmed',
      couriername: '',
      gf_status: 'Pending',
      logistic: 'ICARRY'
    };

    const orderArray = (orderData.cartItems || []).map(item => ({
      orderid: orderData.customOrderId,
      orderdate: formattedDate,
      orderemail: userEmail || 'gurusoftech.chennai@gmail.com',
      color: item.selectedColor || 'N/A',
      size: `${item.length ? item.length + '-' : ''}${item.selectedSize || 'N/A'}`,
      quantity: item.quantity || 1,
      gf_status: 'Pending'
    }));

    const orderjson = {
      add: {
        invoice: invoice,
        order: orderArray
      },
      update: null
    };

    const payload = {
      path: 'createupdateorder',
      orderjson: orderjson
    };

    const response = await axios.post(GOOGLE_SHEET_SYNC_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    console.log(`✅ Google Sheet Sync Success:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`❌ Google Sheet Sync Failed:`, error.response?.data || error.message);
    return null;
  }
}

module.exports = { syncOrderToGoogleSheets };
