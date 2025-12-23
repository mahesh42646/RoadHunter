import axios from "axios";

// Separate API client for payment admin
const paymentAdminApiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.darkunde.in/api",
  withCredentials: true,
  timeout: 300000,
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
});

// Request interceptor
paymentAdminApiClient.interceptors.request.use((config) => {
  // Payment admin token is added manually in each request
  // Don't set Content-Type for FormData, let browser set it with boundary
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

// Response interceptor for better error logging
paymentAdminApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[PaymentAdminApiClient] Error:', {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText,
      requestUrl: error.config?.url,
    });
    return Promise.reject(error);
  }
);

export default paymentAdminApiClient;

