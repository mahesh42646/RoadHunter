/**
 * Converts relative image URLs to absolute URLs using the API base URL
 * ONLY accepts /uploads/ URLs from api.darkunde.in - rejects Google and other external URLs
 * @param {string} imageUrl - The image URL (can be relative or absolute)
 * @returns {string|null} - Absolute URL to the image, or null if no valid image
 */
export function getImageUrl(imageUrl) {
  if (!imageUrl) return null;
  
  // If it's a data URL (base64), return as is (for previews during upload)
  if (imageUrl.startsWith("data:")) {
    return imageUrl;
  }
  
  // REJECT Google photos and any external URLs - only use api.darkunde.in uploads
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    // Only allow api.darkunde.in URLs
    if (imageUrl.includes("api.darkunde.in") || imageUrl.includes("darkunde.in")) {
      return imageUrl;
    }
    // Reject all other external URLs (Google, etc.)
    return null;
  }
  
  // If it's a relative path starting with /uploads, prepend API base URL
  if (imageUrl.startsWith("/uploads")) {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.darkunde.in/api";
    // Remove /api from the end if present, since /uploads is served at root level
    const baseUrl = apiBaseUrl.replace(/\/api$/, "");
    return `${baseUrl}${imageUrl}`;
  }
  
  // For any other paths, return null (don't use them)
  return null;
}

/**
 * Gets the initial letter(s) from a name for avatar fallback
 * @param {string} name - The name to get initials from
 * @returns {string} - Initial letter(s) in uppercase
 */
export function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name[0]?.toUpperCase() || "?";
}

