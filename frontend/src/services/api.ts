import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/authStore';

// Relative base URL: the Vite dev proxy forwards /api to the backend, and in
// production the SPA is served same-origin with the API.
export const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Expired/invalid JWT — drop the session. 401s from Drive endpoints for
    // dev-login users carry a "Google account not connected" message and
    // should not log the user out.
    if (error.response?.status === 401) {
      const message = (error.response.data as any)?.message || '';
      if (!message.includes('Google account not connected')) {
        useAuthStore.getState().logout();
      }
    }
    return Promise.reject(error);
  }
);

export const apiErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as any)?.message || error.message;
  }
  return error instanceof Error ? error.message : 'Something went wrong';
};
