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
    // Check if directory exists and is writable
    try {
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      // Test write permissions
      const testFile = path.join(uploadsDir, '.write-test');
      try {
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
      } catch (writeError) {
        console.error('[Upload Car] Directory not writable:', uploadsDir, writeError);
        return cb(new Error('Upload directory is not writable. Check server permissions.'));
      }
      cb(null, uploadsDir);
    } catch (error) {
      console.error('[Upload Car] Error setting destination:', error);
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    try {
      // Note: req.body may not be populated yet when filename is called during multer processing
      // We'll use a simple timestamp-based name and rename later if needed
      // This prevents hanging if req.body access fails
      
      // Get extension from original filename, sanitize it
      const originalExt = path.extname(file.originalname || '') || '';
      const sanitizedExt = originalExt.replace(/[^a-zA-Z0-9.]/g, '') || '.jpg';
      const ext = sanitizedExt.startsWith('.') ? sanitizedExt : '.' + sanitizedExt;
      
      // Use simple timestamp-based filename to avoid any req.body dependencies
      const timestamp = Date.now();
      const random = Math.round(Math.random() * 1E9);
      const filename = `car-${timestamp}-${random}${ext}`;
      
      cb(null, filename);
    } catch (error) {
      console.error('[Upload Car] Error generating filename:', error);
      // Fallback filename - always succeeds
      const timestamp = Date.now();
      const random = Math.round(Math.random() * 1E9);
      cb(null, `car-${timestamp}-${random}.jpg`);
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

