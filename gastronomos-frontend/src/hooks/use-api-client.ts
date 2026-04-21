import { useEffect } from 'react';
import { apiClient } from '@/lib/api';

/**
 * Hook to ensure API client is properly initialized on the client side
 * This loads the JWT token from localStorage if it exists
 */
export function useApiClient() {
  useEffect(() => {
    // On client side, reload token from localStorage
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token) {
        apiClient.setToken(token);
      }
    }
  }, []);

  return apiClient;
}
