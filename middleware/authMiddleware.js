const { admin } = require('../firebase/firebaseAdmin');

// Middleware to verify Firebase token
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying auth token', error);
    res.status(403).json({ error: 'Unauthorized: Invalid token' });
  }
};

// Middleware to verify Super Admin role
const verifySuperAdmin = async (req, res, next) => {
  // We assume super admins either have a custom claim `super_admin: true`
  // OR their uid is in a specific Firestore collection.
  // For simplicity, we check custom claims here.
  if (req.user && req.user.super_admin === true) {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden: Super Admin access required' });
  }
};

// Middleware to maybe verify token (doesn't block if missing)
const maybeVerifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    // Continue without user if token is invalid
    next();
  }
};

module.exports = { verifyToken, maybeVerifyToken, verifySuperAdmin };
