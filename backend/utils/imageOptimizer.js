const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * Optimize image to 800px width while keeping aspect ratio
 * @param {string} inputPath - Path to input image
 * @param {string} outputPath - Path to save optimized image
 * @returns {Promise<string>} - Path to optimized image
 */
async function optimizeImage(inputPath, outputPath) {
  try {
    await sharp(inputPath)
      .resize(800, null, {
        withoutEnlargement: true,
        fit: 'inside',
      })
      .jpeg({ quality: 85, mozjpeg: true })
      .toFile(outputPath);

    // Delete original file after optimization
    if (fs.existsSync(inputPath) && inputPath !== outputPath) {
      fs.unlinkSync(inputPath);
    }

    return outputPath;
  } catch (error) {
    console.error('Error optimizing image:', error);
    // If optimization fails, return original path
    return inputPath;
  }
}

/**
 * Get optimized filename
 * @param {string} originalPath - Original file path
 * @returns {string} - Optimized file path
 */
function getOptimizedPath(originalPath) {
  const dir = path.dirname(originalPath);
  const base = path.basename(originalPath, path.extname(originalPath));
  // Always use .jpg for optimized images since we convert everything to JPEG
  return path.join(dir, `${base}-optimized.jpg`);
}

module.exports = {
  optimizeImage,
  getOptimizedPath,
};

