const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { verifyToken, verifySuperAdmin } = require('../middleware/authMiddleware');

// Ensure the upload directory exists
const uploadDir = path.join(__dirname, '../../gurufashions-client/public/images/Products');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique name: timestamp + original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter (images only)
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Upload endpoint
router.post('/', verifyToken, verifySuperAdmin, (req, res) => {
  upload.single('image')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      console.error("Multer error:", err);
      return res.status(500).json({ error: 'Multer error: ' + err.message });
    } else if (err) {
      console.error("Unknown upload error:", err);
      return res.status(500).json({ error: 'Upload error: ' + err.message });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Please upload a file' });
      }
      
      // Return the relative path that the client can use
      const filePath = `/images/Products/${req.file.filename}`;
      res.status(200).json({ 
        message: 'File uploaded successfully',
        url: filePath 
      });
    } catch (error) {
      console.error("Server upload post-processing error:", error);
      res.status(500).json({ error: error.message });
    }
  });
});


// Delete image endpoint
router.delete('/', verifyToken, verifySuperAdmin, (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    // Extract filename from URL (e.g., /images/Products/123.jpg -> 123.jpg)
    const filename = path.basename(url);
    const filePath = path.join(uploadDir, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.status(200).json({ message: 'File deleted successfully' });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
