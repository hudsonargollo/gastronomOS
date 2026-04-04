'use client';

import useSWR from 'swr';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

export type UserRole = 'ADMIN' | 'MANAGER' | 'STAFF';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  locationId?: string;
  location?: {
    id: string;
    name: string;
  };
  tenantId: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  locationId?: string;
}

export interface UpdateUserInput {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  locationId?: string;
}

export function useUsers() {
  const { data, error, isLoading, mutate} = useSWR<User[]>(
    '/users',
    async () => {
      const response = await apiClient.getUsers();
      return response.data.users;
    }
  );

  const createUser = async (input: CreateUserInput) => {
    try {
      const response = await apiClient.createUser(input);
      await mutate();
      toast.success('User created successfully');
      return response.data.user;
    } catch (error: any) {
      const message = error.message || 'Failed to create user';
      toast.error(message);
      throw error;
    }
  };

  const updateUser = async (id: string, input: UpdateUserInput) => {
    try {
      const response = await apiClient.updateUser(id, input);
      await mutate();
      toast.success('User updated successfully');
      return response.data.user;
    } catch (error: any) {
      const message = error.message || 'Failed to update user';
      toast.error(message);
      throw error;
    }
  };

  const deleteUser = async (id: string) => {
    try {
      await apiClient.deleteUser(id);
      await mutate();
      toast.success('User deleted successfully');
    } catch (error: any) {
      const message = error.message || 'Failed to delete user';
      toast.error(message);
      throw error;
    }
  };

  return {
    users: data || [],
    isLoading,
    error,
    createUser,
    updateUser,
    deleteUser,
    mutate,
  };
}

export function useUser(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<User>(
    id ? `/users/${id}` : null,
    async () => {
      if (!id) return null;
      const response = await apiClient.getUser(id);
      return response.data.user;
    }
  );

  return {
    user: data,
    isLoading,
    error,
    mutate,
  };
}
