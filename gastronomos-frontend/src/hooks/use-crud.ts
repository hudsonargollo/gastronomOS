// @ts-nocheck
import useSWR, { mutate } from 'swr';
import useSWRMutation from 'swr/mutation';
import { apiClient, PaginationParams, SearchParams } from '../lib/api';
import { cacheKeys, mutationOptions } from '../lib/swr-config';
import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';

// Generic CRUD hook interface
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

// Categories CRUD hook
export function useCategories(params?: PaginationParams & SearchParams & { parentId?: string }) {
  const cacheKey = cacheKeys.categories(params);
  
  const { data, error, isLoading, mutate: swrMutate } = useSWR(
    cacheKey,
    () => apiClient.getCategories(params)
  );
  
  const { trigger: createTrigger } = useSWRMutation(
    cacheKeys.categories(),
    (_, { arg }: { arg: any }) => apiClient.createCategory(arg)
  );
  
  const { trigger: updateTrigger } = useSWRMutation(
    cacheKey,
    (_, { arg }: { arg: { id: string; data: any } }) => apiClient.updateCategory(arg.id, arg.data),
    mutationOptions.optimisticUpdate(arg => ({ id: arg.id, ...arg.data }))
  );
  
  const { trigger: deleteTrigger } = useSWRMutation(
    cacheKey,
    (_, { arg }: { arg: string }) => apiClient.deleteCategory(arg),
    mutationOptions.optimisticDelete(arg)
  );
  
  const { trigger: bulkDeleteTrigger } = useSWRMutation(
    cacheKey,
    (_, { arg }: { arg: string[] }) => apiClient.bulkDeleteCategories(arg)
  );
  
  const create = useCallback(async (data: any) => {
    try {
      const result = await createTrigger(data);
      toast.success('Category created successfully');
      return result.data.category;
    } catch (error) {
      toast.error('Failed to create category');
      throw error;
    }
  }, [createTrigger]);
  
  const update = useCallback(async (id: string, data: any) => {
    try {
      const result = await updateTrigger({ id, data });
      toast.success('Category updated successfully');
      return result.data.category;
    } catch (error) {
      toast.error('Failed to update category');
      throw error;
    }
  }, [updateTrigger]);
  
  const deleteItem = useCallback(async (id: string) => {
    await deleteTrigger(id);
  }, [deleteTrigger]);
  
  const bulkDelete = useCallback(async (ids: string[]) => {
    await bulkDeleteTrigger(ids);
  }, [bulkDeleteTrigger]);
  
  const refresh = useCallback(async () => {
    await swrMutate();
  }, [swrMutate]);
  
  return {
    data: data?.data?.categories,
    pagination: data?.data?.pagination,
    loading: isLoading,
    error,
    create,
    update,
    delete: deleteItem,
    bulkDelete,
    refresh,
    mutate: swrMutate,
  };
}

// Products CRUD hook
export function useProducts(params?: PaginationParams & SearchParams & { 
  categoryId?: string; 
  minPrice?: number; 
  maxPrice?: number; 
}) {
  const cacheKey = cacheKeys.products(params);
  
  const { data, error, isLoading, mutate: swrMutate } = useSWR(
    cacheKey,
    () => apiClient.getProducts(params)
  );
  
  const { trigger: createTrigger } = useSWRMutation(
    cacheKeys.products(),
    (_, { arg }: { arg: any }) => apiClient.createProduct(arg)
  );
  
  const { trigger: updateTrigger } = useSWRMutation(
    cacheKey,
    (_, { arg }: { arg: { id: string; data: any } }) => apiClient.updateProduct(arg.id, arg.data),
    mutationOptions.optimisticUpdate(arg => ({ id: arg.id, ...arg.data }))
  );
  
  const { trigger: deleteTrigger } = useSWRMutation(
    cacheKey,
    (_, { arg }: { arg: string }) => apiClient.deleteProduct(arg),
    mutationOptions.optimisticDelete(arg)
  );
  
  const { trigger: bulkDeleteTrigger } = useSWRMutation(
    cacheKey,
    (_, { arg }: { arg: string[] }) => apiClient.bulkDeleteProducts(arg)
  );
  
  const create = useCallback(async (data: any) => {
    const result = await createTrigger(data);
    return result.data.product;
  }, [createTrigger]);
  
  const update = useCallback(async (id: string, data: any) => {
    const result = await updateTrigger({ id, data });
    return result.data.product;
  }, [updateTrigger]);
  
  const deleteItem = useCallback(async (id: string) => {
    await deleteTrigger(id);
  }, [deleteTrigger]);
  
  const bulkDelete = useCallback(async (ids: string[]) => {
    await bulkDeleteTrigger(ids);
  }, [bulkDeleteTrigger]);
  
  const refresh = useCallback(async () => {
    await swrMutate();
  }, [swrMutate]);
  
  return {
    data: data?.data?.products,
    pagination: data?.data?.pagination,
    loading: isLoading,
    error,
    create,
    update,
    delete: deleteItem,
    bulkDelete,
    refresh,
    mutate: swrMutate,
  };
}

// Locations CRUD hook
export function useLocations(params?: PaginationParams & SearchParams & { 
  type?: string; 
  managerId?: string; 
}) {
  const cacheKey = cacheKeys.locations(params);
  
  const { data, error, isLoading, mutate: swrMutate } = useSWR(
    cacheKey,
    () => apiClient.getLocations(params)
  );
  
  const { trigger: createTrigger } = useSWRMutation(
    cacheKeys.locations(),
    (_, { arg }: { arg: any }) => apiClient.createLocation(arg)
  );
  
  const { trigger: updateTrigger } = useSWRMutation(
    cacheKey,
    (_, { arg }: { arg: { id: string; data: any } }) => apiClient.updateLocation(arg.id, arg.data),
    mutationOptions.optimisticUpdate(arg => ({ id: arg.id, ...arg.data }))
  );
  
  const { trigger: deleteTrigger } = useSWRMutation(
    cacheKey,
    (_, { arg }: { arg: string }) => apiClient.deleteLocation(arg),
    mutationOptions.optimisticDelete(arg)
  );
  
  const create = useCallback(async (data: any) => {
    const result = await createTrigger(data);
    return result.data.location;
  }, [createTrigger]);
  
  const update = useCallback(async (id: string, data: any) => {
    const result = await updateTrigger({ id, data });
    return result.data.location;
  }, [updateTrigger]);
  
  const deleteItem = useCallback(async (id: string) => {
    await deleteTrigger(id);
  }, [deleteTrigger]);
  
  const refresh = useCallback(async () => {
    await swrMutate();
  }, [swrMutate]);
  
  return {
    data: data?.data?.locations,
    pagination: data?.data?.pagination,
    loading: isLoading,
    error,
    create,
    update,
    delete: deleteItem,
    refresh,
    mutate: swrMutate,
  };
}

// Users CRUD hook
export function useUsers(params?: PaginationParams & SearchParams & { 
  role?: string; 
  locationId?: string; 
}) {
  const cacheKey = cacheKeys.users(params);
  
  const { data, error, isLoading, mutate: swrMutate } = useSWR(
    cacheKey,
    () => apiClient.getUsers(params)
  );
  
  const { trigger: createTrigger } = useSWRMutation(
    cacheKeys.users(),
    (_, { arg }: { arg: any }) => apiClient.createUser(arg)
  );
  
  const { trigger: updateTrigger } = useSWRMutation(
    cacheKey,
    (_, { arg }: { arg: { id: string; data: any } }) => apiClient.updateUser(arg.id, arg.data),
    mutationOptions.optimisticUpdate(arg => ({ id: arg.id, ...arg.data }))
  );
  
  const { trigger: deleteTrigger } = useSWRMutation(
    cacheKey,
    (_, { arg }: { arg: string }) => apiClient.deleteUser(arg),
    mutationOptions.optimisticDelete(arg)
  );
  
  const create = useCallback(async (data: any) => {
    const result = await createTrigger(data);
    return result.data.user;
  }, [createTrigger]);
  
  const update = useCallback(async (id: string, data: any) => {
    const result = await updateTrigger({ id, data });
    return result.data.user;
  }, [updateTrigger]);
  
  const deleteItem = useCallback(async (id: string) => {
    await deleteTrigger(id);
  }, [deleteTrigger]);
  
  const refresh = useCallback(async () => {
    await swrMutate();
  }, [swrMutate]);
  
  return {
    data: data?.data?.users,
    pagination: data?.data?.pagination,
    loading: isLoading,
    error,
    create,
    update,
    delete: deleteItem,
    refresh,
    mutate: swrMutate,
  };
}

// Inventory CRUD hook
export function useInventory(params?: PaginationParams & SearchParams & { 
  productId?: string; 
  locationId?: string; 
  minQuantity?: number; 
  maxQuantity?: number; 
}) {
  const cacheKey = cacheKeys.inventory(params);
  
  const { data, error, isLoading, mutate: swrMutate } = useSWR(
    cacheKey,
    () => apiClient.getInventory(params)
  );
  
  const { trigger: createTrigger } = useSWRMutation(
    cacheKeys.inventory(),
    (_, { arg }: { arg: any }) => apiClient.createInventoryItem(arg)
  );
  
  const { trigger: updateTrigger } = useSWRMutation(
    cacheKey,
    (_, { arg }: { arg: { id: string; data: any } }) => apiClient.updateInventoryItem(arg.id, arg.data),
    mutationOptions.optimisticUpdate(arg => ({ id: arg.id, ...arg.data }))
  );
  
  const { trigger: deleteTrigger } = useSWRMutation(
    cacheKey,
    (_, { arg }: { arg: string }) => apiClient.deleteInventoryItem(arg),
    mutationOptions.optimisticDelete(arg)
  );
  
  const create = useCallback(async (data: any) => {
    const result = await createTrigger(data);
    return result.data.inventory;
  }, [createTrigger]);
  
  const update = useCallback(async (id: string, data: any) => {
    const result = await updateTrigger({ id, data });
    return result.data.inventory;
  }, [updateTrigger]);
  
  const deleteItem = useCallback(async (id: string) => {
    await deleteTrigger(id);
  }, [deleteTrigger]);
  
  const refresh = useCallback(async () => {
    await swrMutate();
  }, [swrMutate]);
  
  return {
    data: data?.data?.inventory,
    pagination: data?.data?.pagination,
    loading: isLoading,
    error,
    create,
    update,
    delete: deleteItem,
    refresh,
    mutate: swrMutate,
  };
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