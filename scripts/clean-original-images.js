const fs = require('fs');
const path = require('path');

const dirsToClean = [
  path.join(__dirname, '../../gurufashions-client/public/images/custom'),
  path.join(__dirname, '../../gurufashions-client/public/images/Products'),
  path.join(__dirname, '../../gurufashions-client/public/images')
];

function cleanOriginalImages() {
  console.log('--- Guru Fashions Original Image Clean Up ---');
  let totalFreedBytes = 0;
  let totalFilesDeleted = 0;

  for (const dirPath of dirsToClean) {
    if (!fs.existsSync(dirPath)) {
      console.log(`\nDirectory not found, skipping: ${dirPath}`);
      continue;
    }

    console.log(`\nChecking directory: ${dirPath}...`);
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) continue;

      const ext = path.extname(file).toLowerCase();
      if (['.png', '.jpg', '.jpeg'].includes(ext)) {
        const baseName = path.basename(file, ext);
        const webpFilename = `${baseName}.webp`;
        const webpPath = path.join(dirPath, webpFilename);

        // Check if WebP equivalent exists
        if (fs.existsSync(webpPath)) {
          const fileSize = stat.size;
          try {
            fs.unlinkSync(filePath);
            totalFreedBytes += fileSize;
            totalFilesDeleted++;
            console.log(`Deleted original: ${file} (Freed: ${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
          } catch (err) {
            console.error(`Error deleting ${file}:`, err.message);
          }
        }
      }
    }
  }

  console.log(`\n--- Clean Up Complete ---`);
  console.log(`Total original files deleted: ${totalFilesDeleted}`);
  console.log(`Total storage space freed: ${(totalFreedBytes / 1024 / 1024).toFixed(2)} MB`);
}

cleanOriginalImages();
