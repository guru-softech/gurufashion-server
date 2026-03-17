const { db } = require('../firebase/firebaseAdmin');
const { generateCustomOrderId } = require('../utils/orderUtils');

const collectionName = 'orders';

exports.getAllOrders = async (req, res) => {
  try {
    const snapshot = await db.collection(collectionName)
      .orderBy('createdAt', 'desc')
      .get();
    const orders = [];
    snapshot.forEach(doc => {
      orders.push({ id: doc.id, ...doc.data() });
    });
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const ordersSnapshot = await db.collection(collectionName).get();
    const usersSnapshot = await db.collection('users').get();
    
    let totalRevenue = 0;
    let activeOrdersCount = 0;
    const recentOrders = [];

    ordersSnapshot.forEach(doc => {
      const data = doc.data();
      
      // Total Revenue: sum of advancePaid for all orders (or totalAmount if fully paid)
      // Since our flow uses advancePaid + balanceDue, we sum advancePaid for revenue confirmed so far
      if (data.status !== 'Cancelled') {
        totalRevenue += (data.advancePaid || 0);
        // If full payment was made online at checkout
        if (data.paymentMethod === 'online' && data.balanceDue === 0) {
          // totalRevenue already includes advancePaid which would be the full amount
        }
      }

      // Active Orders: Pending, Processing, Shipped
      if (['Pending', 'Processing', 'Shipped'].includes(data.status)) {
        activeOrdersCount++;
      }
    });

    // Get 5 most recent orders
    const recentSnapshot = await db.collection(collectionName)
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
    
    recentSnapshot.forEach(doc => {
      recentOrders.push({ id: doc.id, ...doc.data() });
    });

    const stats = {
      totalRevenue: totalRevenue,
      activeOrders: activeOrdersCount,
      totalCustomers: usersSnapshot.size,
      recentOrders: recentOrders
    };

    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getUserOrders = async (req, res) => {
  try {
    const snapshot = await db.collection(collectionName)
      .where('userId', '==', req.user.uid)
      .get();
    
    const orders = [];
    snapshot.forEach(doc => {
      orders.push({ id: doc.id, ...doc.data() });
    });
    
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection(collectionName).doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }
    // Only super admins or the user who created it should see this
    if (!req.user.super_admin && req.user.uid !== doc.data().userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.status(200).json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createOrder = async (req, res) => {
  try {
    const newOrder = req.body;
    // ensure the order is tied to the authenticated user
    newOrder.userId = req.user.uid;
    newOrder.createdAt = new Date();
    newOrder.status = 'Pending';
    
    // Generate custom sequential Order ID
    const customOrderId = await generateCustomOrderId();
    newOrder.customOrderId = customOrderId;
    
    // Use customOrderId as the document key
    await db.collection(collectionName).doc(customOrderId).set(newOrder);
    res.status(201).json({ id: customOrderId, ...newOrder });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const docRef = db.collection(collectionName).doc(id);
    await docRef.update({ status, updatedAt: new Date() });
    res.status(200).json({ message: 'Order status updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
