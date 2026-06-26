const Razorpay = require('razorpay');
const crypto = require('crypto');
const { db } = require('../firebase/firebaseAdmin');
const { generateCustomOrderId } = require('../utils/orderUtils');
const { sendOrderConfirmationMessages } = require('../utils/whatsappUtils');
const { syncOrderToGoogleSheets } = require('../utils/googleSheetUtils');
require('dotenv').config();

const getRazorpayInstance = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret || keyId === 'YOUR_RAZORPAY_KEY_ID' || keySecret === 'YOUR_RAZORPAY_KEY_SECRET') {
    console.error("Payment keys are missing or placeholders. Using dummy mode.");
    return null;
  }
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

exports.createRazorpayOrder = async (req, res) => {
  try {
    const razorpay = getRazorpayInstance();
    const { amount, currency = 'INR', receipt, orderDetails } = req.body;

    // Generate custom sequential Order ID first
    const customOrderId = await generateCustomOrderId();

    // Pre-create the order in Firestore as Pending
    if (orderDetails) {
      const orderData = {
        ...orderDetails,
        userId: req.user.uid,
        userEmail: req.user?.email || '', // Store for Google Sheet sync
        customOrderId,
        status: 'Pending',
        paymentStatus: 'Unpaid',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.collection('orders').doc(customOrderId).set(orderData);
    }

    if (!razorpay) {
      console.log("Using Dummy Payment Mode (Keys missing or placeholders)");
      const dummyOrderId = `dummy_order_${Date.now()}`;
      if (orderDetails) {
        await db.collection('orders').doc(customOrderId).update({
          razorpay_order_id: dummyOrderId
        });
      }
      return res.status(200).json({
        id: dummyOrderId,
        amount: amount * 100,
        currency,
        receipt: customOrderId,
        status: 'created',
        isDummy: true, // Flag for client to skip Razorpay modal
        customOrderId
      });
    }

    const options = {
      amount: amount * 100, 
      currency,
      receipt: customOrderId, // Link Razorpay order to our customOrderId
      notes: {
        customOrderId
      }
    };

    const order = await razorpay.orders.create(options);
    
    // Save the razorpay order ID to our Pending order
    if (orderDetails) {
      await db.collection('orders').doc(customOrderId).update({
        razorpay_order_id: order.id
      });
    }

    res.status(200).json({
      ...order,
      customOrderId
    });
  } catch (error) {
    console.error("Razorpay Order Creation Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Helper function to confirm order and trigger all notifications
const confirmOrderFulfillment = async (orderDoc, razorpay_payment_id, transactionId, paymentAt) => {
  const customOrderId = orderDoc.id;
  const orderData = orderDoc.data();

  if (orderData.status === 'Confirmed') {
    console.log(`ℹ️ Order ${customOrderId} is already Confirmed. Skipping double-fulfillment.`);
    return orderData;
  }

  const updateData = {
    status: 'Confirmed',
    paymentStatus: 'Paid',
    razorpay_payment_id: razorpay_payment_id || orderData.razorpay_payment_id || '',
    transactionId: transactionId || razorpay_payment_id || orderData.transactionId || '',
    paymentAt: paymentAt || new Date(),
    updatedAt: new Date(),
  };

  // Update in Firestore
  await db.collection('orders').doc(customOrderId).update(updateData);
  console.log(`✅ Order ${customOrderId} status updated to Confirmed.`);

  // Record coupon usage for one-time coupons
  if (orderData.appliedCoupon && orderData.appliedCoupon.id) {
    try {
      await db.collection('couponUsage').add({
        couponId: orderData.appliedCoupon.id,
        userId: orderData.userId,
        orderId: customOrderId,
        usedAt: new Date()
      });
      console.log(`Recorded coupon usage for ${orderData.appliedCoupon.id}`);
    } catch (err) {
      console.error('Coupon record error:', err.message);
    }
  }

  const fullOrderData = { ...orderData, ...updateData, customOrderId };

  // 🔔 Send WhatsApp notifications to customer + admin (non-blocking)
  const customerPhone = orderData.deliveryDetails?.phone || '';
  sendOrderConfirmationMessages(fullOrderData, customerPhone).catch(err =>
    console.error('WhatsApp notification error:', err.message)
  );

  // 📊 Sync with Google Sheets (non-blocking)
  const userEmail = orderData.userEmail || '';
  syncOrderToGoogleSheets(fullOrderData, userEmail).catch(err =>
    console.error('Google Sheet Sync error:', err.message)
  );

  return fullOrderData;
};

exports.verifyPayment = async (req, res) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      orderDetails 
    } = req.body;

    let isVerified = false;

    if (razorpay_signature === 'dummy_signature') {
      console.log("Verified via Dummy Signature");
      isVerified = true;
    } else {
      if (!process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET === 'YOUR_RAZORPAY_KEY_SECRET') {
        throw new Error("Razorpay secret missing or invalid in .env");
      }

      const sign = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSign = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(sign.toString())
        .digest("hex");
      
      isVerified = (razorpay_signature === expectedSign);
    }

    if (!isVerified) {
      return res.status(400).json({ message: "Invalid signature sent!" });
    }

    // signature is verified. Find and fulfill the order
    let orderDoc = null;
    let customOrderId = null;

    if (razorpay_order_id) {
      const snapshot = await db.collection('orders')
        .where('razorpay_order_id', '==', razorpay_order_id)
        .limit(1)
        .get();
      if (!snapshot.empty) {
        orderDoc = snapshot.docs[0];
        customOrderId = orderDoc.id;
      }
    }

    if (orderDoc) {
      // Pre-created order found! Fulfill it
      await confirmOrderFulfillment(orderDoc, razorpay_payment_id, razorpay_payment_id, new Date());
    } else {
      // Fallback: If for some reason the pre-created order wasn't found, create it from scratch
      console.warn("⚠️ Pre-created order not found. Creating a new one as fallback.");
      customOrderId = await generateCustomOrderId();
      const orderData = {
        ...orderDetails,
        userId: req.user.uid,
        userEmail: req.user?.email || '',
        customOrderId,
        razorpay_order_id,
        razorpay_payment_id,
        transactionId: razorpay_payment_id,
        paymentAt: new Date(),
        status: 'Confirmed',
        paymentStatus: 'Paid',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.collection('orders').doc(customOrderId).set(orderData);

      // Record coupon usage
      if (orderDetails.appliedCoupon && orderDetails.appliedCoupon.id) {
        await db.collection('couponUsage').add({
          couponId: orderDetails.appliedCoupon.id,
          userId: req.user.uid,
          orderId: customOrderId,
          usedAt: new Date()
        });
      }

      // Trigger alerts
      const customerPhone = orderDetails.deliveryDetails?.phone || '';
      sendOrderConfirmationMessages(orderData, customerPhone).catch(err =>
        console.error('WhatsApp notification error:', err.message)
      );
      syncOrderToGoogleSheets(orderData, req.user?.email || '').catch(err =>
        console.error('Google Sheet Sync error:', err.message)
      );
    }

    return res.status(200).json({ 
      message: "Payment verified successfully", 
      orderId: customOrderId 
    });
  } catch (error) {
    console.error("Razorpay Verification Error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.razorpayWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (secret) {
      const shasum = crypto.createHmac('sha256', secret);
      shasum.update(JSON.stringify(req.body));
      const digest = shasum.digest('hex');

      if (digest !== signature) {
        console.error("❌ Invalid signature for Razorpay Webhook");
        return res.status(400).json({ error: "Invalid signature" });
      }
    } else {
      console.warn("⚠️ RAZORPAY_WEBHOOK_SECRET is not set in .env. Signature check bypassed.");
    }

    const event = req.body.event;
    console.log(`ℹ️ Received Razorpay Webhook Event: ${event}`);

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = req.body.payload?.payment?.entity;
      const orderEntity = req.body.payload?.order?.entity;

      const razorpay_order_id = paymentEntity?.order_id || orderEntity?.id;
      const razorpay_payment_id = paymentEntity?.id || '';

      if (!razorpay_order_id) {
        console.warn("⚠️ Webhook event missing order ID. Skipping.");
        return res.status(200).json({ status: "skipped", message: "No order ID found" });
      }

      // Find order by razorpay_order_id
      const snapshot = await db.collection('orders')
        .where('razorpay_order_id', '==', razorpay_order_id)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const orderDoc = snapshot.docs[0];
        await confirmOrderFulfillment(
          orderDoc, 
          razorpay_payment_id, 
          razorpay_payment_id, 
          paymentEntity?.created_at ? new Date(paymentEntity.created_at * 1000) : new Date()
        );
        return res.status(200).json({ status: "success", orderId: orderDoc.id });
      } else {
        console.warn(`⚠️ Webhook order not found in database for razorpay_order_id: ${razorpay_order_id}`);
        return res.status(200).json({ status: "not_found", message: "Order document not found" });
      }
    }

    return res.status(200).json({ status: "ignored" });
  } catch (error) {
    console.error("Razorpay Webhook Error:", error);
    res.status(500).json({ error: error.message });
  }
};
