const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Define directories to optimize
const dirsToOptimize = [
  {
    name: 'Custom Theme Images',
    path: path.join(__dirname, '../../gurufashions-client/public/images/custom')
  },
  {
    name: 'Uploaded Product Images',
    path: path.join(__dirname, '../../gurufashions-client/public/images/Products')
  },
  {
    name: 'General Public Images',
    path: path.join(__dirname, '../../gurufashions-client/public/images')
  }
];

async function optimizeImages() {
  console.log('--- Guru Fashions Image Optimization Utility ---');
  let totalSavedBytes = 0;
  let totalFilesProcessed = 0;

  for (const dirInfo of dirsToOptimize) {
    if (!fs.existsSync(dirInfo.path)) {
      console.log(`\nDirectory not found, skipping: ${dirInfo.name} (${dirInfo.path})`);
      continue;
    }

    console.log(`\nProcessing: ${dirInfo.name}...`);
    const files = fs.readdirSync(dirInfo.path);

    for (const file of files) {
      const filePath = path.join(dirInfo.path, file);
      const stat = fs.statSync(filePath);

      // Skip directories
      if (stat.isDirectory()) continue;

      const ext = path.extname(file).toLowerCase();
      if (['.png', '.jpg', '.jpeg'].includes(ext)) {
        const baseName = path.basename(file, ext);
        const webpFilename = `${baseName}.webp`;
        const webpPath = path.join(dirInfo.path, webpFilename);

        // Skip if webp version already exists to avoid redundant processing
        if (fs.existsSync(webpPath)) continue;

        const originalSize = stat.size;

        try {
          console.log(`Optimizing: ${file} (${(originalSize / 1024 / 1024).toFixed(2)} MB)`);
          
          // Use sharp to compress and convert to webp
          await sharp(filePath)
            .resize(1200, 1200, {
              fit: 'inside',
              withoutEnlargement: true
            })
            .webp({ quality: 80 })
            .toFile(webpPath);

          const newStat = fs.statSync(webpPath);
          const newSize = newStat.size;
          const savedBytes = originalSize - newSize;
          totalSavedBytes += savedBytes;
          totalFilesProcessed++;

          console.log(`  └─> Created: ${webpFilename} (${(newSize / 1024).toFixed(1)} KB) | Saved: ${(savedBytes / 1024 / 1024).toFixed(2)} MB (${((savedBytes / originalSize) * 100).toFixed(1)}% reduction)`);

          // OPTIONAL: Delete original file (commented out for safety)
          // fs.unlinkSync(filePath);
        } catch (err) {
          console.error(`  Error optimizing ${file}:`, err.message);
        }
      }
    }
  }

  console.log(`\n--- Optimization Complete! ---`);
  console.log(`Total files optimized: ${totalFilesProcessed}`);
  console.log(`Total bandwidth saved: ${(totalSavedBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Note: To use the new images, update your codebase or database to link to .webp filenames instead of .png/.jpg.`);
}

optimizeImages();
