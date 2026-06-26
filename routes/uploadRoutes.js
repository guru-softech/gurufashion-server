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

// Configure Storage to memory (so we can process it with sharp)
const storage = multer.memoryStorage();

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
  upload.single('image')(req, res, async function (err) {
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
      
      // Generate unique name: timestamp + random number + .webp extension
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const filename = uniqueSuffix + '.webp';
      const destPath = path.join(uploadDir, filename);

      // Compress and resize using sharp to WebP format
      const sharpBuffer = sharp(req.file.buffer)
        .resize(1200, 1200, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({ quality: 80 });

      // Save to client public/ (development source)
      await sharpBuffer.toFile(destPath);

      // Also save to client dist/ (production build) if it exists
      const distDir = path.join(__dirname, '../../gurufashions-client/dist/images/Products');
      if (fs.existsSync(path.join(__dirname, '../../gurufashions-client/dist'))) {
        if (!fs.existsSync(distDir)) {
          fs.mkdirSync(distDir, { recursive: true });
        }
        const distPath = path.join(distDir, filename);
        // We reuse the buffer to write to distPath
        await sharp(req.file.buffer)
          .resize(1200, 1200, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .webp({ quality: 80 })
          .toFile(distPath);
      }

      // Return the relative path that the client can use
      const filePath = `/images/Products/${filename}`;
      res.status(200).json({ 
        message: 'File uploaded and optimized successfully',
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
    const ext = path.extname(filename);
    const baseName = path.basename(filename, ext);

    // Development paths (public/)
    const devFilePath = path.join(uploadDir, filename);
    const devWebpPath = path.join(uploadDir, `${baseName}.webp`);

    // Production paths (dist/)
    const distDir = path.join(__dirname, '../../gurufashions-client/dist/images/Products');
    const distFilePath = path.join(distDir, filename);
    const distWebpPath = path.join(distDir, `${baseName}.webp`);

    let deleted = false;

    // Delete dev files
    if (fs.existsSync(devFilePath)) {
      fs.unlinkSync(devFilePath);
      deleted = true;
    }
    if (fs.existsSync(devWebpPath)) {
      fs.unlinkSync(devWebpPath);
      deleted = true;
    }

    // Delete production files
    if (fs.existsSync(distFilePath)) {
      fs.unlinkSync(distFilePath);
      deleted = true;
    }
    if (fs.existsSync(distWebpPath)) {
      fs.unlinkSync(distWebpPath);
      deleted = true;
    }

    if (deleted) {
      res.status(200).json({ message: 'File deleted successfully' });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
