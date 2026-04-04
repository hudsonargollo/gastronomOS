'use client';

import useSWR from 'swr';
import { apiClient } from '@/lib/api';
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
    async () => {
      const response = await apiClient.getLocations();
      return response.data.locations;
    }
  );

  const createLocation = async (input: CreateLocationInput) => {
    try {
      const response = await apiClient.createLocation(input);
      await mutate();
      toast.success('Location created successfully');
      return response.data.location;
    } catch (error: any) {
      const message = error.message || 'Failed to create location';
      toast.error(message);
      throw error;
    }
  };

  const updateLocation = async (id: string, input: UpdateLocationInput) => {
    try {
      const response = await apiClient.updateLocation(id, input);
      await mutate();
      toast.success('Location updated successfully');
      return response.data.location;
    } catch (error: any) {
      const message = error.message || 'Failed to update location';
      toast.error(message);
      throw error;
    }
  };

  const deleteLocation = async (id: string) => {
    try {
      await apiClient.deleteLocation(id);
      await mutate();
      toast.success('Location deleted successfully');
    } catch (error: any) {
      const message = error.message || 'Failed to delete location';
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
    async () => {
      if (!id) return null;
      const response = await apiClient.getLocation(id);
      return response.data.location;
    }
  );

  return {
    location: data,
    isLoading,
    error,
    mutate,
  };
}
