import axios from "axios";

import useAuthStore from "@/store/useAuthStore";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.darkunde.in/api",
  withCredentials: true,
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    // eslint-disable-next-line no-param-reassign
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Don't set Content-Type for FormData, let browser set it with boundary
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    // Only clear session on actual authentication failures, not token expiration
    // Since tokens never expire now, 401/403 only occur on real auth failures
    // But we'll be selective - only clear if it's a clear auth error
    if (status === 401 || status === 403) {
      const errorMessage = error.response?.data?.error || '';
      // Only clear session if it's a clear authentication failure (not just any 401)
      // This prevents clearing on temporary network issues
      if (errorMessage.includes('Invalid token') || 
          errorMessage.includes('Unauthorized') || 
          errorMessage.includes('Forbidden') ||
          errorMessage.includes('Authentication')) {
        // Only clear if it's a persistent auth error, not a one-time failure
        console.warn('[API Client] Authentication error detected, clearing session');
        useAuthStore.getState().clearSession();
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;

