/**
 * Demo UI Integration Tests
 * 
 * Tests the demo button functionality and credential loading
 * Requirements: 8.2, 8.3 - Demo UI integration and credential loading
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LoginPage from '../app/page';
import { apiClient } from '../lib/api';

// Mock the API client
vi.mock('../lib/api', () => ({
  apiClient: {
    getDemoCredentials: vi.fn(),
    login: vi.fn(),
    setToken: vi.fn(),
  },
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock translations hook
vi.mock('../hooks/use-translations', () => ({
  useTranslations: () => ({
    t: (key: string) => key,
  }),
}));

describe('Demo UI Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load demo credentials when demo button is clicked', async () => {
    // Mock the API response
    const mockDemoCredentials = {
      success: true,
      data: {
        accounts: [
          {
            role: 'admin',
            email: 'demo@gastronomos.com',
            password: 'demo123',
            description: 'Full system access with all permissions',
          },
        ],
        defaultAccount: {
          role: 'admin',
          email: 'demo@gastronomos.com',
          password: 'demo123',
          description: 'Full system access with all permissions',
        },
        message: 'Demo credentials retrieved successfully',
      },
    };

    vi.mocked(apiClient.getDemoCredentials).mockResolvedValue(mockDemoCredentials);

    render(<LoginPage />);

    // Find and click the demo button
    const demoButton = screen.getByText('auth.tryDemo');
    fireEvent.click(demoButton);

    // Wait for the API call to complete
    await waitFor(() => {
      expect(apiClient.getDemoCredentials).toHaveBeenCalled();
    });

    // Check that the form fields are populated
    await waitFor(() => {
      const emailInput = screen.getByPlaceholderText('seu@email.com') as HTMLInputElement;
      const passwordInput = screen.getByPlaceholderText('••••••••') as HTMLInputElement;

      expect(emailInput.value).toBe('demo@gastronomos.com');
      expect(passwordInput.value).toBe('demo123');
    });
  });

  it('should show loading state while fetching demo credentials', async () => {
    // Mock a delayed API response
    vi.mocked(apiClient.getDemoCredentials).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({
        success: true,
        data: {
          accounts: [],
          defaultAccount: {
            role: 'admin',
            email: 'demo@gastronomos.com',
            password: 'demo123',
            description: 'Full system access',
          },
          message: 'Success',
        },
      }), 100))
    );

    render(<LoginPage />);

    const demoButton = screen.getByText('auth.tryDemo');
    fireEvent.click(demoButton);

    // Check for loading state
    await waitFor(() => {
      expect(screen.getByText('Loading demo...')).toBeInTheDocument();
    });
  });

  it('should handle demo credentials API error gracefully', async () => {
    // Mock an API error
    vi.mocked(apiClient.getDemoCredentials).mockRejectedValue(
      new Error('Failed to load demo credentials')
    );

    render(<LoginPage />);

    const demoButton = screen.getByText('auth.tryDemo');
    fireEvent.click(demoButton);

    // Wait for error handling
    await waitFor(() => {
      expect(apiClient.getDemoCredentials).toHaveBeenCalled();
    });

    // The form should not be populated with credentials
    const emailInput = screen.getByPlaceholderText('seu@email.com') as HTMLInputElement;
    expect(emailInput.value).toBe('');
  });

  it('should disable demo button while loading', async () => {
    vi.mocked(apiClient.getDemoCredentials).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({
        success: true,
        data: {
          accounts: [],
          defaultAccount: {
            role: 'admin',
            email: 'demo@gastronomos.com',
            password: 'demo123',
            description: 'Full system access',
          },
          message: 'Success',
        },
      }), 100))
    );

    render(<LoginPage />);

    const demoButton = screen.getByText('auth.tryDemo');
    fireEvent.click(demoButton);

    // Button should be disabled while loading
    await waitFor(() => {
      expect(demoButton).toBeDisabled();
    });
  });
});
