'use client';

import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

export interface Location {
  id: string;
  name: string;
  type: 'RESTAURANT' | 'COMMISSARY' | 'POP_UP' | 'WAREHOUSE';
  address: string;
  status: 'active' | 'inactive' | 'seasonal';
  managerId?: string;
  manager?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLocationInput {
  name: string;
  type: 'RESTAURANT' | 'COMMISSARY' | 'POP_UP' | 'WAREHOUSE';
  address: string;
  managerId?: string;
}

export interface UpdateLocationInput {
  name?: string;
  type?: 'RESTAURANT' | 'COMMISSARY' | 'POP_UP' | 'WAREHOUSE';
  address?: string;
  managerId?: string;
  status?: 'active' | 'inactive' | 'seasonal';
}

export function useLocations() {
  const { data, error, isLoading, mutate } = useSWR<Location[]>(
    '/locations',
    async (url) => {
      const response = await apiClient.get(url);
      return response.data.data;
    }
  );

  const createLocation = async (input: CreateLocationInput) => {
    try {
      const response = await apiClient.post('/locations', input);
      await mutate();
      toast.success('Location created successfully');
      return response.data.data;
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to create location';
      toast.error(message);
      throw error;
    }
  };

  const updateLocation = async (id: string, input: UpdateLocationInput) => {
    try {
      const response = await apiClient.put(`/locations/${id}`, input);
      await mutate();
      toast.success('Location updated successfully');
      return response.data.data;
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to update location';
      toast.error(message);
      throw error;
    }
  };

  const deleteLocation = async (id: string) => {
    try {
      await apiClient.delete(`/locations/${id}`);
      await mutate();
      toast.success('Location deleted successfully');
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to delete location';
      toast.error(message);
      throw error;
    }
  };

  return {
    locations: data || [],
    isLoading,
    error,
    createLocation,
    updateLocation,
    deleteLocation,
    mutate,
  };
}

export function useLocation(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Location>(
    id ? `/locations/${id}` : null,
    async (url) => {
      const response = await apiClient.get(url);
      return response.data.data;
    }
  );

  return {
    location: data,
    isLoading,
    error,
    mutate,
  };
}
