const Razorpay = require('razorpay');
const crypto = require('crypto');
const { db } = require('../firebase/firebaseAdmin');
const { generateCustomOrderId } = require('../utils/orderUtils');
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
    const { amount, currency = 'INR', receipt } = req.body;

    if (!razorpay) {
      console.log("Using Dummy Payment Mode (Keys missing or placeholders)");
      // Return a dummy order object that follows Razorpay structure
      return res.status(200).json({
        id: `dummy_order_${Date.now()}`,
        amount: amount * 100,
        currency,
        receipt,
        status: 'created',
        isDummy: true // Flag for client to skip Razorpay modal
      });
    }

    const options = {
      amount: amount * 100, 
      currency,
      receipt,
    };

    const order = await razorpay.orders.create(options);
    res.status(200).json(order);
  } catch (error) {
    console.error("Razorpay Order Creation Error:", error);
    res.status(500).json({ error: error.message });
  }
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

    if (isVerified) {
      // Generate custom sequential Order ID
      const customOrderId = await generateCustomOrderId();

      // Payment verified, save order to Firestore
      const orderData = {
        ...orderDetails,
        userId: req.user.uid,
        customOrderId, // Store for easy reference
        razorpay_order_id,
        razorpay_payment_id,
        transactionId: razorpay_payment_id, // Explicit transaction ID
        paymentAt: new Date(), // Transaction timestamp
        status: 'Confirmed',
        paymentStatus: 'Paid',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Use customOrderId as the document key as well
      await db.collection('orders').doc(customOrderId).set(orderData);
      
      // Record coupon usage for one-time coupons
      if (orderDetails.appliedCoupon && orderDetails.appliedCoupon.id) {
        // Find if coupon already has usage limit set
        // Actually, the validate step already checked this, but we record here on success
        await db.collection('couponUsage').add({
          couponId: orderDetails.appliedCoupon.id,
          userId: req.user.uid,
          orderId: customOrderId,
          usedAt: new Date()
        });
      }

      return res.status(200).json({ 
        message: "Payment verified successfully", 
        orderId: customOrderId 
      });
    } else {
      return res.status(400).json({ message: "Invalid signature sent!" });
    }
  } catch (error) {
    console.error("Razorpay Verification Error:", error);
    res.status(500).json({ error: error.message });
  }
};
