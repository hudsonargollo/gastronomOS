import { SWRConfiguration } from 'swr';
import { apiClient } from './api';

// Default SWR configuration
export const swrConfig: SWRConfiguration = {
  // Revalidate on focus
  revalidateOnFocus: true,
  
  // Revalidate on reconnect
  revalidateOnReconnect: true,
  
  // Revalidate on mount if data is stale
  revalidateIfStale: true,
  
  // Dedupe requests within 2 seconds
  dedupingInterval: 2000,
  
  // Focus throttle interval
  focusThrottleInterval: 5000,
  
  // Error retry count
  errorRetryCount: 3,
  
  // Error retry interval
  errorRetryInterval: 5000,
  
  // Keep previous data when key changes
  keepPreviousData: true,
  
  // Default fetcher function
  fetcher: async (url: string) => {
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Network error' }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      return data.data || data; // Handle both wrapped and unwrapped responses
    } catch (error) {
      console.error('SWR fetch error:', error);
      throw error;
    }
  },
  
  // Global error handler
  onError: (error, key) => {
    console.error('SWR error:', error, 'for key:', key);
    
    // Handle authentication errors
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      // Clear token and redirect to login
      apiClient.clearToken();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  },
  
  // Global success handler
  onSuccess: (data, key) => {
    // Optional: Log successful requests in development
    if (process.env.NODE_ENV === 'development') {
      console.log('SWR success:', key, data);
    }
  },
};

// Cache key generators for consistent key naming
export const cacheKeys = {
  // Users
  users: (params?: Record<string, any>) => 
    params ? ['users', params] : ['users'],
  user: (id: string) => ['users', id],
  
  // Locations
  locations: (params?: Record<string, any>) => 
    params ? ['locations', params] : ['locations'],
  location: (id: string) => ['locations', id],
  
  // Categories
  categories: (params?: Record<string, any>) => 
    params ? ['categories', params] : ['categories'],
  category: (id: string) => ['categories', id],
  
  // Products
  products: (params?: Record<string, any>) => 
    params ? ['products', params] : ['products'],
  product: (id: string) => ['products', id],
  productAnalytics: (id: string, days?: number) => 
    days ? ['products', id, 'analytics', days] : ['products', id, 'analytics'],
  productPurchaseHistory: (id: string, limit?: number) => 
    limit ? ['products', id, 'purchase-history', limit] : ['products', id, 'purchase-history'],
  productVariants: (productId: string) => ['products', productId, 'variants'],
  productRelationships: (productId: string) => ['products', productId, 'relationships'],
  productTemplates: () => ['products', 'templates'],
  lowStockProducts: (threshold?: number) => 
    threshold ? ['products', 'low-stock', threshold] : ['products', 'low-stock'],
  topProducts: (metric: string, limit?: number) => 
    limit ? ['products', 'top', metric, limit] : ['products', 'top', metric],
  searchProducts: (query: string, limit?: number) => 
    limit ? ['products', 'search', query, limit] : ['products', 'search', query],
  
  // Inventory
  inventory: (params?: Record<string, any>) => 
    params ? ['inventory', params] : ['inventory'],
  inventoryItem: (id: string) => ['inventory', id],
  lowStock: (threshold?: number) => 
    threshold ? ['inventory', 'low-stock', threshold] : ['inventory', 'low-stock'],
  
  // Purchase Orders
  purchaseOrders: (params?: Record<string, any>) => 
    params ? ['purchase-orders', params] : ['purchase-orders'],
  purchaseOrder: (id: string) => ['purchase-orders', id],
  
  // Transfers
  transfers: (params?: Record<string, any>) => 
    params ? ['transfers', params] : ['transfers'],
  transfer: (id: string) => ['transfers', id],
  
  // Allocations
  allocations: (params?: Record<string, any>) => 
    params ? ['allocations', params] : ['allocations'],
  allocation: (id: string) => ['allocations', id],
  
  // Analytics
  analytics: (type: string, params?: Record<string, any>) => 
    params ? ['analytics', type, params] : ['analytics', type],
};

// Mutation options for optimistic updates
export const mutationOptions = {
  // Optimistic update for creating items
  optimisticCreate: <T>(newItem: T) => ({
    optimisticData: (currentData: T[] | undefined) => 
      currentData ? [...currentData, newItem] : [newItem],
    rollbackOnError: true,
    populateCache: true,
    revalidate: false,
  }),
  
  // Optimistic update for updating items
  optimisticUpdate: <T extends { id: string }>(updatedItem: T) => ({
    optimisticData: (currentData: T[] | undefined) => 
      currentData ? currentData.map(item => 
        item.id === updatedItem.id ? { ...item, ...updatedItem } : item
      ) : [updatedItem],
    rollbackOnError: true,
    populateCache: true,
    revalidate: false,
  }),
  
  // Optimistic update for deleting items
  optimisticDelete: <T extends { id: string }>(deletedId: string) => ({
    optimisticData: (currentData: T[] | undefined) => 
      currentData ? currentData.filter(item => item.id !== deletedId) : [],
    rollbackOnError: true,
    populateCache: true,
    revalidate: false,
  }),
  
  // Standard mutation without optimistic updates
  standard: {
    rollbackOnError: true,
    populateCache: true,
    revalidate: true,
  },
};

// Helper function to build query strings for cache keys
export const buildCacheKey = (baseKey: string[], params?: Record<string, any>) => {
  if (!params) return baseKey;
  
  // Filter out undefined/null values and sort for consistent keys
  const cleanParams = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
  
  return Object.keys(cleanParams).length > 0 ? [...baseKey, cleanParams] : baseKey;
};

// Preload function for prefetching data
export const preload = (key: string | string[], fetcher?: (key: string) => Promise<any>) => {
  const keyString = Array.isArray(key) ? key.join('/') : key;
  
  if (typeof window !== 'undefined') {
    // Use the default fetcher if none provided
    const fetcherFn = fetcher || swrConfig.fetcher;
    
    if (fetcherFn) {
      fetcherFn(keyString).catch(error => {
        console.warn('Preload failed for key:', keyString, error);
      });
    }
  }
};

export default swrConfig;