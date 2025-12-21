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
      // Get car name from form data if available
      const carName = req.body?.carName || '';
      const imageType = req.body?.imageType || 'image'; // "top", "side", or "image"
      
      // Sanitize car name for filename (remove special chars, keep alphanumeric and spaces, convert spaces to hyphens)
      let sanitizedCarName = '';
      if (carName && carName.trim()) {
        sanitizedCarName = carName
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .replace(/-+/g, '-') // Replace multiple hyphens with single
          .substring(0, 50); // Limit length
      }
      
      // Get extension from original filename, sanitize it
      const originalExt = path.extname(file.originalname || '') || '';
      const sanitizedExt = originalExt.replace(/[^a-zA-Z0-9.]/g, '') || '.jpg';
      const ext = sanitizedExt.startsWith('.') ? sanitizedExt : '.' + sanitizedExt;
      
      // Build filename: carname-imagetype-timestamp.ext or car-timestamp.ext
      let filename;
      if (sanitizedCarName) {
        filename = `${sanitizedCarName}-${imageType}-${Date.now()}${ext}`;
      } else {
        filename = `car-${imageType}-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
      }
      
      cb(null, filename);
    } catch (error) {
      console.error('[Upload Car] Error generating filename:', error);
      // Fallback filename
      cb(null, `car-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`);
    }
  },
});

// No file filter - accept any file type
// Set high limit for large files (100MB)
const upload = multer({
  storage,
  // No fileFilter - accept all files
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
    fieldSize: 10 * 1024 * 1024, // 10MB max field size
    fields: 20, // Max number of non-file fields
    fieldNameSize: 100, // Max field name size
    files: 1, // Max number of files
  },
});

module.exports = upload;

