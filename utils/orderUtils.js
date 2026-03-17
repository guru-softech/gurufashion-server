const { db } = require('../firebase/firebaseAdmin');

/**
 * Generates a custom sequential Order ID in the format: GFO + DD + MM + SSS
 * DD: Day of Month (01-31)
 * MM: Month (01-12)
 * SSS: 3-digit serial number, resets every month
 */
exports.generateCustomOrderId = async () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  
  // Counter document ID based on Year and Month
  const counterId = `orders_${year}_${month}`;
  const counterRef = db.collection('counters').doc(counterId);
  
  try {
    const nextSerial = await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      let newCount = 1;
      if (counterDoc.exists) {
        newCount = (counterDoc.data().count || 0) + 1;
      }
      
      transaction.set(counterRef, { count: newCount }, { merge: true });
      return newCount;
    });
    
    // Format SSS to be at least 3 digits
    const serialStr = nextSerial.toString().padStart(3, '0');
    
    // Final Order ID: GFO + DD + MM + SSS
    return `GFO${day}${month}${serialStr}`;
  } catch (error) {
    console.error("Error generating custom order ID:", error);
    // Fallback: Use timestamp if transaction fails (to prevent order blocking)
    return `GFO${day}${month}ERR${Date.now().toString().slice(-3)}`;
  }
};
