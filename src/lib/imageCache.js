// Image caching utility using IndexedDB and browser cache
// Stores car images to avoid reloading from database

const DB_NAME = 'RoadHunterImageCache';
const DB_VERSION = 1;
const STORE_NAME = 'carImages';

// Initialize IndexedDB
const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'url' });
        store.createIndex('carId', 'carId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
};

// Get cached image blob
export const getCachedImage = async (imageUrl) => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(imageUrl);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const result = request.result;
        if (result && result.blob) {
          // Check if cache is still valid (7 days)
          const cacheAge = Date.now() - result.timestamp;
          const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
          
          if (cacheAge < maxAge) {
            const blobUrl = URL.createObjectURL(result.blob);
            resolve(blobUrl);
          } else {
            // Cache expired, remove it
            removeCachedImage(imageUrl);
            resolve(null);
          }
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null); // Return null on error, don't block
    });
  } catch (error) {
    console.warn('[ImageCache] Error getting cached image:', error);
    return null;
  }
};

// Cache image blob
export const cacheImage = async (imageUrl, blob, carId = null) => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const data = {
      url: imageUrl,
      blob: blob,
      carId: carId,
      timestamp: Date.now(),
    };
    
    store.put(data);
    
    // Clean up old entries (keep only last 100 images)
    const index = store.index('timestamp');
    const getAllRequest = index.getAll();
    getAllRequest.onsuccess = () => {
      const allEntries = getAllRequest.result;
      if (allEntries.length > 100) {
        // Sort by timestamp and remove oldest
        allEntries.sort((a, b) => a.timestamp - b.timestamp);
        const toRemove = allEntries.slice(0, allEntries.length - 100);
        toRemove.forEach(entry => {
          store.delete(entry.url);
        });
      }
    };
  } catch (error) {
    console.warn('[ImageCache] Error caching image:', error);
  }
};

// Remove cached image
export const removeCachedImage = async (imageUrl) => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete(imageUrl);
  } catch (error) {
    console.warn('[ImageCache] Error removing cached image:', error);
  }
};

// Load image with caching
export const loadImageWithCache = async (imageUrl, carId = null) => {
  // First check cache
  const cachedUrl = await getCachedImage(imageUrl);
  if (cachedUrl) {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => {
        URL.revokeObjectURL(cachedUrl);
        // Cache might be corrupted, try fetching fresh
        loadImageFromNetwork(imageUrl, carId).then(resolve).catch(reject);
      };
      img.src = cachedUrl;
    });
  }
  
  // Not in cache, fetch from network
  return loadImageFromNetwork(imageUrl, carId);
};

// Load image from network and cache it
const loadImageFromNetwork = async (imageUrl, carId = null) => {
  try {
    const response = await fetch(imageUrl, {
      cache: 'force-cache', // Use browser cache
      mode: 'cors',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    
    // Cache the blob
    await cacheImage(imageUrl, blob, carId);
    
    // Create object URL from blob
    const blobUrl = URL.createObjectURL(blob);
    
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error('Failed to load image'));
      };
      img.src = blobUrl;
    });
  } catch (error) {
    console.warn('[ImageCache] Error loading image from network:', error);
    throw error;
  }
};

// Clear all cached images
export const clearImageCache = async () => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
  } catch (error) {
    console.warn('[ImageCache] Error clearing cache:', error);
  }
};

