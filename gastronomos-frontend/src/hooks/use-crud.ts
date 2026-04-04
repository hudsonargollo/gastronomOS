// @ts-nocheck
import useSWR, { mutate } from 'swr';
import useSWRMutation from 'swr/mutation';
import { apiClient, PaginationParams, SearchParams } from '../lib/api';
import { cacheKeys, mutationOptions } from '../lib/swr-config';
import { useCallback, useMemo, useState, useRef } from 'react';
import { toast } from 'sonner';

// Animation action types for CRUD operations
export interface AnimationAction {
  id: string;
  type: 'create' | 'update' | 'delete' | 'reorder' | 'bulk-delete';
  target: string;
  duration: number;
  priority: number;
  timestamp: number;
}

// Enhanced CRUD hook interface with animation states
export interface EnhancedCRUDHook<T, CreateData = Partial<T>, UpdateData = Partial<T>> {
  // Data and loading states
  data: T[] | undefined;
  loading: boolean;
  error: Error | undefined;
  
  // Animation states
  isAnimating: boolean;
  animationQueue: AnimationAction[];
  pendingOperations: Set<string>;
  
  // Pagination info
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  
  // Enhanced CRUD operations
  create: (data: CreateData) => Promise<T>;
  update: (id: string, data: UpdateData) => Promise<T>;
  delete: (id: string) => Promise<void>;
  bulkDelete?: (ids: string[]) => Promise<void>;
  bulkUpdate?: (items: { id: string; data: UpdateData }[]) => Promise<T[]>;
  duplicate?: (id: string) => Promise<T>;
  
  // Wizard integration
  startWizard?: (type: 'create' | 'edit' | 'bulk') => void;
  
  // Export functionality
  exportData?: (format: 'csv' | 'json' | 'pdf', selectedIds?: string[]) => Promise<void>;
  
  // Utility functions
  refresh: () => Promise<void>;
  mutate: (data?: T[] | Promise<T[]>, shouldRevalidate?: boolean) => Promise<T[] | undefined>;
  clearAnimationQueue: () => void;
}

// Legacy CRUD hook interface for backward compatibility
export interface CRUDHook<T, CreateData = Partial<T>, UpdateData = Partial<T>> {
  // Data and loading states
  data: T[] | undefined;
  loading: boolean;
  error: Error | undefined;
  
  // Pagination info
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  
  // CRUD operations
  create: (data: CreateData) => Promise<T>;
  update: (id: string, data: UpdateData) => Promise<T>;
  delete: (id: string) => Promise<void>;
  bulkDelete?: (ids: string[]) => Promise<void>;
  
  // Utility functions
  refresh: () => Promise<void>;
  mutate: (data?: T[] | Promise<T[]>, shouldRevalidate?: boolean) => Promise<T[] | undefined>;
}

// Enhanced CRUD hook implementation
export function useEnhancedCRUD<T extends { id: string }, CreateData = Partial<T>, UpdateData = Partial<T>>(
  cacheKeyFn: (params?: any) => string[],
  apiMethods: {
    list: (params?: any) => Promise<{ data: { [key: string]: T[]; pagination?: any } }>;
    create: (data: CreateData) => Promise<{ data: { [key: string]: T } }>;
    update: (id: string, data: UpdateData) => Promise<{ data: { [key: string]: T } }>;
    delete: (id: string) => Promise<void>;
    bulkDelete?: (ids: string[]) => Promise<void>;
    bulkUpdate?: (items: { id: string; data: UpdateData }[]) => Promise<{ data: { [key: string]: T[] } }>;
  },
  dataKey: string,
  params?: any
): EnhancedCRUDHook<T, CreateData, UpdateData> {
  const [animationQueue, setAnimationQueue] = useState<AnimationAction[]>([]);
  const [pendingOperations, setPendingOperations] = useState<Set<string>>(new Set());
  const animationTimeoutRef = useRef<NodeJS.Timeout>();
  
  const cacheKey = cacheKeyFn(params);
  
  const { data, error, isLoading, mutate: swrMutate } = useSWR(
    cacheKey,
    () => apiMethods.list(params)
  );
  
  const { trigger: createTrigger } = useSWRMutation(
    cacheKeyFn(),
    (_, { arg }: { arg: CreateData }) => apiMethods.create(arg)
  );
  
  const { trigger: updateTrigger } = useSWRMutation(
    cacheKey,
    (_, { arg }: { arg: { id: string; data: UpdateData } }) => apiMethods.update(arg.id, arg.data),
    mutationOptions.optimisticUpdate(arg => ({ id: arg.id, ...arg.data }))
  );
  
  const { trigger: deleteTrigger } = useSWRMutation(
    cacheKey,
    (_, { arg }: { arg: string }) => apiMethods.delete(arg),
    mutationOptions.optimisticDelete(arg)
  );
  
  const { trigger: bulkDeleteTrigger } = useSWRMutation(
    cacheKey,
    (_, { arg }: { arg: string[] }) => apiMethods.bulkDelete?.(arg)
  );
  
  const { trigger: bulkUpdateTrigger } = useSWRMutation(
    cacheKey,
    (_, { arg }: { arg: { id: string; data: UpdateData }[] }) => apiMethods.bulkUpdate?.(arg)
  );
  
  // Animation queue management
  const addAnimationAction = useCallback((action: Omit<AnimationAction, 'timestamp'>) => {
    const fullAction: AnimationAction = {
      ...action,
      timestamp: Date.now(),
    };
    
    setAnimationQueue(prev => [...prev, fullAction]);
    
    // Auto-clear animation after duration
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }
    
    animationTimeoutRef.current = setTimeout(() => {
      setAnimationQueue(prev => prev.filter(a => a.id !== fullAction.id));
    }, action.duration + 100);
  }, []);
  
  const clearAnimationQueue = useCallback(() => {
    setAnimationQueue([]);
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }
  }, []);
  
  // Enhanced CRUD operations with animations
  const create = useCallback(async (data: CreateData) => {
    const operationId = `create-${Date.now()}`;
    setPendingOperations(prev => new Set(prev).add(operationId));
    
    try {
      addAnimationAction({
        id: operationId,
        type: 'create',
        target: 'new-item',
        duration: 300,
        priority: 1,
      });
      
      const result = await createTrigger(data);
      toast.success('Item created successfully');
      return result.data[dataKey];
    } catch (error) {
      toast.error('Failed to create item');
      throw error;
    } finally {
      setPendingOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(operationId);
        return newSet;
      });
    }
  }, [createTrigger, dataKey, addAnimationAction]);
  
  const update = useCallback(async (id: string, data: UpdateData) => {
    const operationId = `update-${id}`;
    setPendingOperations(prev => new Set(prev).add(operationId));
    
    try {
      addAnimationAction({
        id: operationId,
        type: 'update',
        target: id,
        duration: 250,
        priority: 2,
      });
      
      const result = await updateTrigger({ id, data });
      toast.success('Item updated successfully');
      return result.data[dataKey];
    } catch (error) {
      toast.error('Failed to update item');
      throw error;
    } finally {
      setPendingOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(operationId);
        return newSet;
      });
    }
  }, [updateTrigger, dataKey, addAnimationAction]);
  
  const deleteItem = useCallback(async (id: string) => {
    const operationId = `delete-${id}`;
    setPendingOperations(prev => new Set(prev).add(operationId));
    
    try {
      addAnimationAction({
        id: operationId,
        type: 'delete',
        target: id,
        duration: 300,
        priority: 3,
      });
      
      await deleteTrigger(id);
      toast.success('Item deleted successfully');
    } catch (error) {
      toast.error('Failed to delete item');
      throw error;
    } finally {
      setPendingOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(operationId);
        return newSet;
      });
    }
  }, [deleteTrigger, addAnimationAction]);
  
  const bulkDelete = useCallback(async (ids: string[]) => {
    if (!apiMethods.bulkDelete) {
      throw new Error('Bulk delete not supported');
    }
    
    const operationId = `bulk-delete-${Date.now()}`;
    setPendingOperations(prev => new Set(prev).add(operationId));
    
    try {
      addAnimationAction({
        id: operationId,
        type: 'bulk-delete',
        target: ids.join(','),
        duration: 400,
        priority: 4,
      });
      
      await bulkDeleteTrigger(ids);
      toast.success(`${ids.length} items deleted successfully`);
    } catch (error) {
      toast.error('Failed to delete items');
      throw error;
    } finally {
      setPendingOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(operationId);
        return newSet;
      });
    }
  }, [bulkDeleteTrigger, addAnimationAction]);
  
  const bulkUpdate = useCallback(async (items: { id: string; data: UpdateData }[]) => {
    if (!apiMethods.bulkUpdate) {
      throw new Error('Bulk update not supported');
    }
    
    const operationId = `bulk-update-${Date.now()}`;
    setPendingOperations(prev => new Set(prev).add(operationId));
    
    try {
      addAnimationAction({
        id: operationId,
        type: 'update',
        target: items.map(i => i.id).join(','),
        duration: 350,
        priority: 2,
      });
      
      const result = await bulkUpdateTrigger(items);
      toast.success(`${items.length} items updated successfully`);
      return result.data[dataKey];
    } catch (error) {
      toast.error('Failed to update items');
      throw error;
    } finally {
      setPendingOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(operationId);
        return newSet;
      });
    }
  }, [bulkUpdateTrigger, dataKey, addAnimationAction]);
  
  const duplicate = useCallback(async (id: string) => {
    const item = data?.data?.[dataKey]?.find((item: T) => item.id === id);
    if (!item) {
      throw new Error('Item not found');
    }
    
    // Create a copy without the id
    const { id: _, ...itemData } = item;
    return create(itemData as CreateData);
  }, [data, dataKey, create]);
  
  const exportData = useCallback(async (format: 'csv' | 'json' | 'pdf', selectedIds?: string[]) => {
    const itemsToExport = selectedIds 
      ? data?.data?.[dataKey]?.filter((item: T) => selectedIds.includes(item.id))
      : data?.data?.[dataKey];
    
    if (!itemsToExport || itemsToExport.length === 0) {
      toast.error('No data to export');
      return;
    }
    
    // Simple export implementation
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(itemsToExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'csv') {
      // Basic CSV export
      const headers = Object.keys(itemsToExport[0]).join(',');
      const rows = itemsToExport.map((item: T) => Object.values(item).join(','));
      const csv = [headers, ...rows].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    
    toast.success(`Exported ${itemsToExport.length} items as ${format.toUpperCase()}`);
  }, [data, dataKey]);
  
  const refresh = useCallback(async () => {
    await swrMutate();
  }, [swrMutate]);
  
  const isAnimating = animationQueue.length > 0 || pendingOperations.size > 0;
  
  return {
    data: data?.data?.[dataKey],
    pagination: data?.data?.pagination,
    loading: isLoading,
    error,
    isAnimating,
    animationQueue,
    pendingOperations,
    create,
    update,
    delete: deleteItem,
    bulkDelete: apiMethods.bulkDelete ? bulkDelete : undefined,
    bulkUpdate: apiMethods.bulkUpdate ? bulkUpdate : undefined,
    duplicate,
    exportData,
    refresh,
    mutate: swrMutate,
    clearAnimationQueue,
  };
}

// Enhanced Categories CRUD hook
export function useCategories(params?: PaginationParams & SearchParams & { parentId?: string }) {
  return useEnhancedCRUD(
    cacheKeys.categories,
    {
      list: apiClient.getCategories.bind(apiClient),
      create: apiClient.createCategory.bind(apiClient),
      update: apiClient.updateCategory.bind(apiClient),
      delete: apiClient.deleteCategory.bind(apiClient),
      bulkDelete: apiClient.bulkDeleteCategories?.bind(apiClient),
    },
    'categories',
    params
  );
}

// Enhanced Products CRUD hook
export function useProducts(params?: PaginationParams & SearchParams & { 
  categoryId?: string; 
  minPrice?: number; 
  maxPrice?: number; 
}) {
  return useEnhancedCRUD(
    cacheKeys.products,
    {
      list: apiClient.getProducts.bind(apiClient),
      create: apiClient.createProduct.bind(apiClient),
      update: apiClient.updateProduct.bind(apiClient),
      delete: apiClient.deleteProduct.bind(apiClient),
      bulkDelete: apiClient.bulkDeleteProducts?.bind(apiClient),
    },
    'products',
    params
  );
}

// Enhanced Locations CRUD hook
export function useLocations(params?: PaginationParams & SearchParams & { 
  type?: string; 
  managerId?: string; 
}) {
  return useEnhancedCRUD(
    cacheKeys.locations,
    {
      list: apiClient.getLocations.bind(apiClient),
      create: apiClient.createLocation.bind(apiClient),
      update: apiClient.updateLocation.bind(apiClient),
      delete: apiClient.deleteLocation.bind(apiClient),
    },
    'locations',
    params
  );
}

// Enhanced Users CRUD hook
export function useUsers(params?: PaginationParams & SearchParams & { 
  role?: string; 
  locationId?: string; 
}) {
  return useEnhancedCRUD(
    cacheKeys.users,
    {
      list: apiClient.getUsers.bind(apiClient),
      create: apiClient.createUser.bind(apiClient),
      update: apiClient.updateUser.bind(apiClient),
      delete: apiClient.deleteUser.bind(apiClient),
    },
    'users',
    params
  );
}

// Enhanced Inventory CRUD hook
export function useInventory(params?: PaginationParams & SearchParams & { 
  productId?: string; 
  locationId?: string; 
  minQuantity?: number; 
  maxQuantity?: number; 
}) {
  return useEnhancedCRUD(
    cacheKeys.inventory,
    {
      list: apiClient.getInventory.bind(apiClient),
      create: apiClient.createInventoryItem.bind(apiClient),
      update: apiClient.updateInventoryItem.bind(apiClient),
      delete: apiClient.deleteInventoryItem.bind(apiClient),
    },
    'inventory',
    params
  );
}

// Low stock items hook
export function useLowStockItems(threshold?: number) {
  const cacheKey = cacheKeys.lowStock(threshold);
  
  const { data, error, isLoading, mutate: swrMutate } = useSWR(
    cacheKey,
    () => apiClient.getLowStockItems(threshold)
  );
  
  const refresh = useCallback(async () => {
    await swrMutate();
  }, [swrMutate]);
  
  return {
    data: data?.data?.lowStockItems,
    threshold: data?.data?.threshold,
    loading: isLoading,
    error,
    refresh,
    mutate: swrMutate,
  };
}

// Generic single item hook
export function useItem<T>(
  cacheKeyFn: (id: string) => string[],
  fetchFn: (id: string) => Promise<{ data: { [key: string]: T } }>,
  id: string,
  dataKey: string
) {
  const cacheKey = cacheKeyFn(id);
  
  const { data, error, isLoading, mutate: swrMutate } = useSWR(
    id ? cacheKey : null,
    () => fetchFn(id)
  );
  
  const refresh = useCallback(async () => {
    await swrMutate();
  }, [swrMutate]);
  
  return {
    data: data?.data?.[dataKey],
    loading: isLoading,
    error,
    refresh,
    mutate: swrMutate,
  };
}

// Specific single item hooks
export const useCategory = (id: string) => 
  useItem(cacheKeys.category, apiClient.getCategory.bind(apiClient), id, 'category');

export const useProduct = (id: string) => 
  useItem(cacheKeys.product, apiClient.getProduct.bind(apiClient), id, 'product');

export const useLocation = (id: string) => 
  useItem(cacheKeys.location, apiClient.getLocation.bind(apiClient), id, 'location');

export const useUser = (id: string) => 
  useItem(cacheKeys.user, apiClient.getUser.bind(apiClient), id, 'user');

export const useInventoryItem = (id: string) => 
  useItem(cacheKeys.inventoryItem, apiClient.getInventoryItem.bind(apiClient), id, 'inventory');