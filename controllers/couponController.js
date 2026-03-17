const { db } = require('../firebase/firebaseAdmin');

const collectionName = 'coupons';

exports.getAllCoupons = async (req, res) => {
  try {
    const snapshot = await db.collection(collectionName).orderBy('createdAt', 'desc').get();
    const coupons = [];
    snapshot.forEach(doc => {
      coupons.push({ id: doc.id, ...doc.data() });
    });
    res.status(200).json(coupons);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getActiveCoupons = async (req, res) => {
  try {
    const snapshot = await db.collection(collectionName).where('isActive', '==', true).get();
    const coupons = [];
    snapshot.forEach(doc => {
      coupons.push({ id: doc.id, ...doc.data() });
    });
    res.status(200).json(coupons);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createCoupon = async (req, res) => {
  try {
    const newCoupon = {
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const docRef = await db.collection(collectionName).add(newCoupon);
    res.status(201).json({ id: docRef.id, ...newCoupon });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };
    await db.collection(collectionName).doc(id).update(updateData);
    res.status(200).json({ message: 'Coupon updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection(collectionName).doc(id).delete();
    res.status(200).json({ message: 'Coupon deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.validateCoupon = async (req, res) => {
  try {
    const { code, amount } = req.body;
    const userId = req.user ? req.user.uid : null;

    const snapshot = await db.collection(collectionName)
      .where('code', '==', code.toUpperCase())
      .where('isActive', '==', true)
      .limit(1).get();
    
    if (snapshot.empty) {
      return res.status(404).json({ error: 'Invalid or inactive coupon code' });
    }

    const couponDoc = snapshot.docs[0];
    const coupon = couponDoc.data();
    
    if (amount < coupon.minAmount) {
      return res.status(400).json({ error: `Minimum order amount for this coupon is Rs. ${coupon.minAmount}` });
    }

    // Check usage limit
    if (coupon.usageLimit === 'once') {
      if (!userId) {
        return res.status(401).json({ error: 'Please login to use this one-time coupon' });
      }

      const usageSnapshot = await db.collection('couponUsage')
        .where('couponId', '==', couponDoc.id)
        .where('userId', '==', userId)
        .limit(1).get();

      if (!usageSnapshot.empty) {
        return res.status(400).json({ error: 'You have already used this coupon' });
      }
    }

    res.status(200).json({ 
      id: couponDoc.id, 
      code: coupon.code, 
      discountAmount: coupon.discountAmount,
      usageLimit: coupon.usageLimit
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
