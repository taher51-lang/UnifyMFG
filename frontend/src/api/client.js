// frontend/src/api/client.js
// Axios instance pointing to the Flask backend with automatic token refresh and 401 retry

import axios from 'axios';
import { supabase } from './supabase';

export const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }
  const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
  return `http://${host}:5005/api`;
};

const client = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Get a valid Supabase access token.
 * If the current token is expired or expiring within 60 seconds, refresh it automatically.
 */
const getValidAccessToken = async () => {
  try {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const now = Math.floor(Date.now() / 1000);
    if (session.expires_at && now >= session.expires_at - 60) {
      console.log('[API] Access token expired or expiring soon; refreshing session...');
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && refreshData?.session?.access_token) {
        return refreshData.session.access_token;
      }
    }
    return session.access_token;
  } catch (err) {
    console.warn('[API] Could not verify access token:', err);
    return null;
  }
};

// Request interceptor: attach valid Supabase JWT token and ensure dynamic baseURL
client.interceptors.request.use(async (config) => {
  config.baseURL = getApiBaseUrl();
  const token = await getValidAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: unwrap envelopes and automatically retry once on 401 Unauthorized
client.interceptors.response.use(
  (response) => {
    // If the backend returns our envelope, unwrap it
    // Skip unwrapping for binary responses (Blob, ArrayBuffer, etc.)
    if (response.data && typeof response.data === 'object' && !(response.data instanceof Blob) && 'data' in response.data && 'error' in response.data) {
      if (response.data.error) {
        return Promise.reject(new Error(response.data.error));
      }
      return { ...response, data: response.data.data };
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // If 401 UNAUTHORIZED from backend and this request hasn't already been retried:
    // Force a fresh session refresh from Supabase and retry once.
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        console.log('[API] 401 received — attempting token refresh and retry...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshData?.session?.access_token) {
          originalRequest.headers.Authorization = `Bearer ${refreshData.session.access_token}`;
          originalRequest.baseURL = getApiBaseUrl();
          return client(originalRequest);
        }
      } catch (refreshErr) {
        console.error('[API] 401 refresh attempt failed:', refreshErr);
      }
    }

    const message = error.response?.data?.error || error.message || 'Unknown error';
    return Promise.reject(new Error(message));
  }
);

export default client;
