import axios from "axios";

// Separate API client for admin - no user auth interceptors
const adminApiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5030/api",
  withCredentials: true,
  timeout: 15000,
});

// Only add admin token if provided manually
adminApiClient.interceptors.request.use((config) => {
  // Admin token is added manually in each request
  return config;
});

export default adminApiClient;

