/**
 * Converts relative image URLs to absolute URLs using the API base URL
 * @param {string} imageUrl - The image URL (can be relative or absolute)
 * @returns {string} - Absolute URL to the image
 */
export function getImageUrl(imageUrl) {
  if (!imageUrl) return "/default-avatar.png";
  
  // If it's a data URL (base64), return as is (for previews)
  if (imageUrl.startsWith("data:")) {
    return imageUrl;
  }
  
  // If already an absolute URL (starts with http:// or https://), return as is
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }
  
  // If it's a relative path starting with /uploads, prepend API base URL
  if (imageUrl.startsWith("/uploads")) {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.darkunde.in/api";
    // Remove /api from the end if present, since /uploads is served at root level
    const baseUrl = apiBaseUrl.replace(/\/api$/, "");
    return `${baseUrl}${imageUrl}`;
  }
  
  // For other relative paths (like /default-avatar.png), return as is
  return imageUrl;
}

