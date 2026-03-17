const { db } = require('../firebase/firebaseAdmin');

const collectionName = 'settings';
const docId = 'global';

exports.getSettings = async (req, res) => {
  try {
    const doc = await db.collection(collectionName).doc(docId).get();
    if (!doc.exists) {
      // Default settings if none exist
      return res.status(200).json({ freeDeliveryThreshold: 499 });
    }
    res.status(200).json(doc.data());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const updateData = req.body;
    updateData.updatedAt = new Date();
    await db.collection(collectionName).doc(docId).set(updateData, { merge: true });
    res.status(200).json({ message: 'Settings updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
