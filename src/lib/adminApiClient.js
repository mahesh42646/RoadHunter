import axios from "axios";

// Separate API client for admin - no user auth interceptors
const adminApiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.darkunde.in/api",
  withCredentials: true,
  timeout: 300000, // 300 seconds (5 minutes) default timeout for large file uploads up to 100MB
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
});

// Only add admin token if provided manually
adminApiClient.interceptors.request.use((config) => {
  // Admin token is added manually in each request
  // Don't set Content-Type for FormData, let browser set it with boundary
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

// Response interceptor for better error logging
adminApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log errors for debugging
    if (error.config?.url?.includes('/cars/upload')) {
      console.error('[AdminApiClient] Upload error:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
        requestUrl: error.config?.url,
        timeout: error.config?.timeout
      });
    }
    return Promise.reject(error);
  }
);

export default adminApiClient;

