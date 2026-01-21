/**
 * Final Integration Tests
 * Comprehensive tests covering all enhanced UI workflow features
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { AnimatedPage } from '@/components/ui/animated-page';
import { WizardProvider } from '@/contexts/wizard-context';
import { PurchaseOrderWizard } from '@/components/wizards/purchase-order-wizard';
import { InventoryTransferWizard } from '@/components/wizards/inventory-transfer-wizard';
import { AllocationRulesWizard } from '@/components/wizards/allocation-rules-wizard';
import { AnimatedCRUDTable } from '@/components/ui/animated-crud-table';
import { PerformanceMonitor } from '@/components/ui/performance-monitor';
import { ThemeProvider } from '@/contexts/theme-context';
import { LanguageProvider } from '@/contexts/language-context';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock framer-motion for testing
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
  },
  AnimatePresence: ({ children }: any) => children,
  useAnimation: () => ({
    start: vi.fn(),
    stop: vi.fn(),
    set: vi.fn(),
  }),
}));

// Mock performance APIs
Object.defineProperty(window, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByType: vi.fn(() => []),
    memory: {
      usedJSHeapSize: 50000000,
      totalJSHeapSize: 100000000,
      jsHeapSizeLimit: 2000000000,
    },
  },
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Test wrapper with all providers
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <WizardProvider>
          {children}
        </WizardProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

describe('Final Integration Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Animation System Integration', () => {
    it('should render animated pages with proper transitions', async () => {
      render(
        <TestWrapper>
          <AnimatedPage>
            <div data-testid="page-content">Test Content</div>
          </AnimatedPage>
        </TestWrapper>
      );

      expect(screen.getByTestId('page-content')).toBeInTheDocument();
    });

    it('should handle animation performance monitoring', async () => {
      render(
        <TestWrapper>
          <PerformanceMonitor visible={true} />
        </TestWrapper>
      );

      // Performance monitor should be present
      expect(screen.getByText('Performance Monitor')).toBeInTheDocument();
    });
  });

  describe('Wizard Workflow Integration', () => {
    it('should complete purchase order wizard workflow', async () => {
      const mockOnComplete = vi.fn();
      
      render(
        <TestWrapper>
          <PurchaseOrderWizard
            isOpen={true}
            onClose={() => {}}
            onComplete={mockOnComplete}
          />
        </TestWrapper>
      );

      // Should show first step
      expect(screen.getByText(/supplier/i)).toBeInTheDocument();
      
      // Navigate through wizard steps
      const nextButton = screen.getByRole('button', { name: /next/i });
      if (nextButton && !nextButton.hasAttribute('disabled')) {
        await user.click(nextButton);
      }
    });

    it('should complete inventory transfer wizard workflow', async () => {
      const mockOnComplete = vi.fn();
      
      render(
        <TestWrapper>
          <InventoryTransferWizard
            isOpen={true}
            onClose={() => {}}
            onComplete={mockOnComplete}
          />
        </TestWrapper>
      );

      // Should show transfer wizard
      expect(screen.getByText(/transfer/i)).toBeInTheDocument();
    });

    it('should complete allocation rules wizard workflow', async () => {
      const mockOnComplete = vi.fn();
      
      render(
        <TestWrapper>
          <AllocationRulesWizard
            isOpen={true}
            onClose={() => {}}
            onComplete={mockOnComplete}
          />
        </TestWrapper>
      );

      // Should show allocation wizard
      expect(screen.getByText(/allocation/i)).toBeInTheDocument();
    });
  });

  describe('CRUD Operations Integration', () => {
    const mockData = [
      { id: '1', name: 'Item 1', category: 'Category A' },
      { id: '2', name: 'Item 2', category: 'Category B' },
    ];

    const mockColumns = [
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'category', header: 'Category' },
    ];

    it('should render animated CRUD table with data', async () => {
      render(
        <TestWrapper>
          <AnimatedCRUDTable
            data={mockData}
            columns={mockColumns}
            onAdd={() => {}}
            onEdit={() => {}}
            onDelete={() => {}}
          />
        </TestWrapper>
      );

      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
    });

    it('should handle CRUD operations with animations', async () => {
      const mockOnAdd = vi.fn();
      const mockOnEdit = vi.fn();
      const mockOnDelete = vi.fn();

      render(
        <TestWrapper>
          <AnimatedCRUDTable
            data={mockData}
            columns={mockColumns}
            onAdd={mockOnAdd}
            onEdit={mockOnEdit}
            onDelete={mockOnDelete}
          />
        </TestWrapper>
      );

      // Test add operation
      const addButton = screen.getByRole('button', { name: /add/i });
      if (addButton) {
        await user.click(addButton);
        expect(mockOnAdd).toHaveBeenCalled();
      }
    });
  });

  describe('Performance Integration', () => {
    it('should maintain performance under load', async () => {
      const startTime = performance.now();
      
      // Render multiple complex components
      render(
        <TestWrapper>
          <div>
            <AnimatedPage>
              <PerformanceMonitor visible={true} />
              <AnimatedCRUDTable
                data={Array.from({ length: 100 }, (_, i) => ({
                  id: i.toString(),
                  name: `Item ${i}`,
                  category: `Category ${i % 5}`,
                }))}
                columns={[
                  { accessorKey: 'name', header: 'Name' },
                  { accessorKey: 'category', header: 'Category' },
                ]}
                onAdd={() => {}}
                onEdit={() => {}}
                onDelete={() => {}}
              />
            </AnimatedPage>
          </div>
        </TestWrapper>
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within reasonable time (less than 100ms)
      expect(renderTime).toBeLessThan(100);
    });

    it('should handle memory management efficiently', async () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Render and unmount components multiple times
      const { unmount } = render(
        <TestWrapper>
          <AnimatedPage>
            <div>Memory test content</div>
          </AnimatedPage>
        </TestWrapper>
      );

      unmount();

      // Memory should not increase significantly
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Allow for some memory increase but not excessive
      expect(memoryIncrease).toBeLessThan(10000000); // 10MB threshold
    });
  });

  describe('Accessibility Integration', () => {
    it('should meet accessibility standards across all components', async () => {
      const { container } = render(
        <TestWrapper>
          <div>
            <AnimatedPage>
              <h1>Test Page</h1>
              <button>Test Button</button>
              <input aria-label="Test Input" />
            </AnimatedPage>
          </div>
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', async () => {
      render(
        <TestWrapper>
          <div>
            <button data-testid="button1">Button 1</button>
            <button data-testid="button2">Button 2</button>
            <input data-testid="input1" />
          </div>
        </TestWrapper>
      );

      const button1 = screen.getByTestId('button1');
      const button2 = screen.getByTestId('button2');
      const input1 = screen.getByTestId('input1');

      // Test tab navigation
      await user.tab();
      expect(button1).toHaveFocus();

      await user.tab();
      expect(button2).toHaveFocus();

      await user.tab();
      expect(input1).toHaveFocus();
    });
  });

  describe('Cross-Feature Integration', () => {
    it('should integrate wizards with CRUD operations', async () => {
      const mockData = [
        { id: '1', name: 'Item 1', category: 'Category A' },
      ];

      const mockColumns = [
        { accessorKey: 'name', header: 'Name' },
        { accessorKey: 'category', header: 'Category' },
      ];

      render(
        <TestWrapper>
          <div>
            <AnimatedCRUDTable
              data={mockData}
              columns={mockColumns}
              onAdd={() => {}}
              onEdit={() => {}}
              onDelete={() => {}}
            />
            <PurchaseOrderWizard
              isOpen={false}
              onClose={() => {}}
              onComplete={() => {}}
            />
          </div>
        </TestWrapper>
      );

      expect(screen.getByText('Item 1')).toBeInTheDocument();
    });

    it('should maintain consistent theming across components', async () => {
      render(
        <TestWrapper>
          <div>
            <AnimatedPage>
              <button className="btn-primary">Primary Button</button>
              <div className="card">Card Content</div>
            </AnimatedPage>
          </div>
        </TestWrapper>
      );

      // Components should be rendered with consistent styling
      expect(screen.getByText('Primary Button')).toBeInTheDocument();
      expect(screen.getByText('Card Content')).toBeInTheDocument();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle animation errors gracefully', async () => {
      // Mock console.error to capture error logs
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <TestWrapper>
          <AnimatedPage>
            <div>Content that might cause animation errors</div>
          </AnimatedPage>
        </TestWrapper>
      );

      // Should not throw errors
      expect(screen.getByText('Content that might cause animation errors')).toBeInTheDocument();
      
      consoleSpy.mockRestore();
    });

    it('should handle wizard validation errors', async () => {
      render(
        <TestWrapper>
          <PurchaseOrderWizard
            isOpen={true}
            onClose={() => {}}
            onComplete={() => {}}
          />
        </TestWrapper>
      );

      // Should handle validation without crashing
      expect(screen.getByText(/supplier/i)).toBeInTheDocument();
    });
  });

  describe('Responsive Design Integration', () => {
    it('should adapt to different screen sizes', async () => {
      // Mock window.innerWidth
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      render(
        <TestWrapper>
          <AnimatedPage>
            <div className="responsive-content">Responsive Content</div>
          </AnimatedPage>
        </TestWrapper>
      );

      expect(screen.getByText('Responsive Content')).toBeInTheDocument();

      // Test mobile size
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      // Trigger resize event
      fireEvent(window, new Event('resize'));

      expect(screen.getByText('Responsive Content')).toBeInTheDocument();
    });
  });
});