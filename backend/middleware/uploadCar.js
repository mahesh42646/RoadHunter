const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads/cars');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    try {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      // Get extension from original filename, sanitize it
      const originalExt = path.extname(file.originalname || '');
      // Remove any special characters from extension, keep only alphanumeric and dots
      const sanitizedExt = originalExt.replace(/[^a-zA-Z0-9.]/g, '') || '.jpg';
      // Ensure extension starts with a dot
      const ext = sanitizedExt.startsWith('.') ? sanitizedExt : '.' + sanitizedExt;
      cb(null, `car-${uniqueSuffix}${ext}`);
    } catch (error) {
      console.error('[Upload Car] Error generating filename:', error);
      // Fallback filename
      cb(null, `car-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`);
    }
  },
});

// No file filter - accept any file type
// No size limits - accept any size
const upload = multer({
  storage,
  // No fileFilter - accept all files
  // No limits - accept any size
});

module.exports = upload;

