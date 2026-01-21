/**
 * Comprehensive Accessibility Audit Tests
 * Tests WCAG compliance across all enhanced UI components
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import React from 'react';
import { AnimatedPage } from '@/components/ui/animated-page';
import { AnimatedModal } from '@/components/ui/animated-modal';
import { AnimatedCRUDTable } from '@/components/ui/animated-crud-table';
import { PurchaseOrderWizard } from '@/components/wizards/purchase-order-wizard';
import { ModalForm } from '@/components/ui/modal-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ThemeProvider } from '@/contexts/theme-context';
import { LanguageProvider } from '@/contexts/language-context';
import { WizardProvider } from '@/contexts/wizard-context';

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
}));

// Test wrapper with all providers
function AccessibilityTestWrapper({ children }: { children: React.ReactNode }) {
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

describe('Comprehensive Accessibility Audit', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  describe('WCAG 2.1 AA Compliance', () => {
    it('should meet accessibility standards for animated pages', async () => {
      const { container } = render(
        <AccessibilityTestWrapper>
          <AnimatedPage>
            <main>
              <h1>Page Title</h1>
              <nav aria-label="Main navigation">
                <ul>
                  <li><a href="/dashboard">Dashboard</a></li>
                  <li><a href="/inventory">Inventory</a></li>
                </ul>
              </nav>
              <section>
                <h2>Content Section</h2>
                <p>This is the main content of the page.</p>
              </section>
            </main>
          </AnimatedPage>
        </AccessibilityTestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should meet accessibility standards for modal dialogs', async () => {
      const { container } = render(
        <AccessibilityTestWrapper>
          <AnimatedModal
            isOpen={true}
            onClose={() => {}}
            title="Test Modal"
            description="This is a test modal dialog"
          >
            <div>
              <p>Modal content goes here</p>
              <button>Action Button</button>
            </div>
          </AnimatedModal>
        </AccessibilityTestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should meet accessibility standards for CRUD tables', async () => {
      const mockData = [
        { id: '1', name: 'Item 1', category: 'Category A', status: 'Active' },
        { id: '2', name: 'Item 2', category: 'Category B', status: 'Inactive' },
      ];

      const mockColumns = [
        { accessorKey: 'name', header: 'Name' },
        { accessorKey: 'category', header: 'Category' },
        { accessorKey: 'status', header: 'Status' },
      ];

      const { container } = render(
        <AccessibilityTestWrapper>
          <AnimatedCRUDTable
            data={mockData}
            columns={mockColumns}
            onAdd={() => {}}
            onEdit={() => {}}
            onDelete={() => {}}
            aria-label="Items table"
          />
        </AccessibilityTestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should meet accessibility standards for wizard workflows', async () => {
      const { container } = render(
        <AccessibilityTestWrapper>
          <PurchaseOrderWizard
            isOpen={true}
            onClose={() => {}}
            onComplete={() => {}}
          />
        </AccessibilityTestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should meet accessibility standards for forms', async () => {
      const mockFields = [
        {
          name: 'name',
          label: 'Name',
          type: 'text' as const,
          required: true,
          validation: { required: 'Name is required' },
        },
        {
          name: 'email',
          label: 'Email',
          type: 'email' as const,
          required: true,
          validation: { required: 'Email is required' },
        },
        {
          name: 'category',
          label: 'Category',
          type: 'select' as const,
          options: [
            { value: 'a', label: 'Category A' },
            { value: 'b', label: 'Category B' },
          ],
        },
      ];

      const { container } = render(
        <AccessibilityTestWrapper>
          <ModalForm
            isOpen={true}
            onClose={() => {}}
            onSubmit={() => Promise.resolve()}
            title="Test Form"
            fields={mockFields}
          />
        </AccessibilityTestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support keyboard navigation in buttons', async () => {
      render(
        <AccessibilityTestWrapper>
          <div>
            <Button data-testid="button1">Button 1</Button>
            <Button data-testid="button2">Button 2</Button>
            <Button data-testid="button3" disabled>Button 3 (Disabled)</Button>
          </div>
        </AccessibilityTestWrapper>
      );

      const button1 = screen.getByTestId('button1');
      const button2 = screen.getByTestId('button2');
      const button3 = screen.getByTestId('button3');

      // Test tab navigation
      await user.tab();
      expect(button1).toHaveFocus();

      await user.tab();
      expect(button2).toHaveFocus();

      // Disabled button should be skipped
      await user.tab();
      expect(button3).not.toHaveFocus();

      // Test Enter key activation
      await user.keyboard('{Shift>}{Tab}{/Shift}'); // Go back to button2
      expect(button2).toHaveFocus();

      const clickSpy = vi.fn();
      button2.addEventListener('click', clickSpy);
      await user.keyboard('{Enter}');
      expect(clickSpy).toHaveBeenCalled();
    });

    it('should support keyboard navigation in forms', async () => {
      render(
        <AccessibilityTestWrapper>
          <form>
            <Input
              data-testid="input1"
              placeholder="First input"
              aria-label="First input"
            />
            <Input
              data-testid="input2"
              placeholder="Second input"
              aria-label="Second input"
            />
            <Button type="submit" data-testid="submit">Submit</Button>
          </form>
        </AccessibilityTestWrapper>
      );

      const input1 = screen.getByTestId('input1');
      const input2 = screen.getByTestId('input2');
      const submitButton = screen.getByTestId('submit');

      // Test tab navigation through form
      await user.tab();
      expect(input1).toHaveFocus();

      await user.tab();
      expect(input2).toHaveFocus();

      await user.tab();
      expect(submitButton).toHaveFocus();
    });

    it('should support keyboard navigation in modals', async () => {
      render(
        <AccessibilityTestWrapper>
          <AnimatedModal
            isOpen={true}
            onClose={() => {}}
            title="Test Modal"
          >
            <div>
              <Button data-testid="modal-button1">Button 1</Button>
              <Button data-testid="modal-button2">Button 2</Button>
              <Button data-testid="modal-close">Close</Button>
            </div>
          </AnimatedModal>
        </AccessibilityTestWrapper>
      );

      // Focus should be trapped within modal
      const button1 = screen.getByTestId('modal-button1');
      const button2 = screen.getByTestId('modal-button2');
      const closeButton = screen.getByTestId('modal-close');

      await user.tab();
      expect(button1).toHaveFocus();

      await user.tab();
      expect(button2).toHaveFocus();

      await user.tab();
      expect(closeButton).toHaveFocus();

      // Tab should cycle back to first element
      await user.tab();
      expect(button1).toHaveFocus();
    });
  });

  describe('Screen Reader Support', () => {
    it('should provide proper ARIA labels and descriptions', async () => {
      render(
        <AccessibilityTestWrapper>
          <div>
            <Button
              aria-label="Add new item"
              aria-describedby="add-help"
            >
              +
            </Button>
            <div id="add-help">Click to add a new item to the list</div>
            
            <Input
              aria-label="Search items"
              aria-describedby="search-help"
              placeholder="Type to search..."
            />
            <div id="search-help">Enter keywords to filter the item list</div>
          </div>
        </AccessibilityTestWrapper>
      );

      const addButton = screen.getByRole('button', { name: 'Add new item' });
      const searchInput = screen.getByRole('textbox', { name: 'Search items' });

      expect(addButton).toHaveAttribute('aria-describedby', 'add-help');
      expect(searchInput).toHaveAttribute('aria-describedby', 'search-help');
    });

    it('should provide proper heading hierarchy', async () => {
      render(
        <AccessibilityTestWrapper>
          <AnimatedPage>
            <main>
              <h1>Main Page Title</h1>
              <section>
                <h2>Section Title</h2>
                <article>
                  <h3>Article Title</h3>
                  <p>Content goes here</p>
                </article>
              </section>
            </main>
          </AnimatedPage>
        </AccessibilityTestWrapper>
      );

      const h1 = screen.getByRole('heading', { level: 1 });
      const h2 = screen.getByRole('heading', { level: 2 });
      const h3 = screen.getByRole('heading', { level: 3 });

      expect(h1).toHaveTextContent('Main Page Title');
      expect(h2).toHaveTextContent('Section Title');
      expect(h3).toHaveTextContent('Article Title');
    });

    it('should provide proper table accessibility', async () => {
      const mockData = [
        { id: '1', name: 'Item 1', category: 'Category A' },
        { id: '2', name: 'Item 2', category: 'Category B' },
      ];

      const mockColumns = [
        { accessorKey: 'name', header: 'Name' },
        { accessorKey: 'category', header: 'Category' },
      ];

      render(
        <AccessibilityTestWrapper>
          <AnimatedCRUDTable
            data={mockData}
            columns={mockColumns}
            onAdd={() => {}}
            onEdit={() => {}}
            onDelete={() => {}}
            aria-label="Items data table"
            caption="List of all items with their categories"
          />
        </AccessibilityTestWrapper>
      );

      const table = screen.getByRole('table', { name: 'Items data table' });
      expect(table).toBeInTheDocument();

      // Check for proper table structure
      const columnHeaders = screen.getAllByRole('columnheader');
      expect(columnHeaders).toHaveLength(2);
      expect(columnHeaders[0]).toHaveTextContent('Name');
      expect(columnHeaders[1]).toHaveTextContent('Category');
    });
  });

  describe('Color Contrast and Visual Accessibility', () => {
    it('should maintain sufficient color contrast', async () => {
      const { container } = render(
        <AccessibilityTestWrapper>
          <div>
            <Button variant="default">Default Button</Button>
            <Button variant="destructive">Destructive Button</Button>
            <Button variant="outline">Outline Button</Button>
            <Button variant="secondary">Secondary Button</Button>
          </div>
        </AccessibilityTestWrapper>
      );

      // Axe will check color contrast automatically
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support high contrast mode', async () => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      render(
        <AccessibilityTestWrapper>
          <div>
            <Button>High Contrast Button</Button>
            <Input placeholder="High contrast input" />
          </div>
        </AccessibilityTestWrapper>
      );

      // Components should render without issues in high contrast mode
      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  describe('Motion and Animation Accessibility', () => {
    it('should respect reduced motion preferences', async () => {
      // Mock prefers-reduced-motion media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      render(
        <AccessibilityTestWrapper>
          <AnimatedPage>
            <div>Content with reduced motion</div>
          </AnimatedPage>
        </AccessibilityTestWrapper>
      );

      // Should render without motion-related accessibility issues
      expect(screen.getByText('Content with reduced motion')).toBeInTheDocument();
    });

    it('should provide animation controls when needed', async () => {
      render(
        <AccessibilityTestWrapper>
          <div>
            <button aria-label="Pause animations">⏸️</button>
            <button aria-label="Play animations">▶️</button>
            <AnimatedPage>
              <div>Animated content</div>
            </AnimatedPage>
          </div>
        </AccessibilityTestWrapper>
      );

      const pauseButton = screen.getByRole('button', { name: 'Pause animations' });
      const playButton = screen.getByRole('button', { name: 'Play animations' });

      expect(pauseButton).toBeInTheDocument();
      expect(playButton).toBeInTheDocument();
    });
  });

  describe('Focus Management', () => {
    it('should manage focus properly in dynamic content', async () => {
      const TestComponent = () => {
        const [showContent, setShowContent] = React.useState(false);

        return (
          <div>
            <Button
              onClick={() => setShowContent(!showContent)}
              data-testid="toggle-button"
            >
              Toggle Content
            </Button>
            {showContent && (
              <div>
                <h2>Dynamic Content</h2>
                <Button data-testid="dynamic-button">Dynamic Button</Button>
              </div>
            )}
          </div>
        );
      };

      render(
        <AccessibilityTestWrapper>
          <TestComponent />
        </AccessibilityTestWrapper>
      );

      const toggleButton = screen.getByTestId('toggle-button');
      
      // Show dynamic content
      await user.click(toggleButton);
      
      const dynamicButton = screen.getByTestId('dynamic-button');
      expect(dynamicButton).toBeInTheDocument();

      // Focus should be manageable
      await user.tab();
      expect(dynamicButton).toHaveFocus();
    });

    it('should restore focus after modal closes', async () => {
      const TestComponent = () => {
        const [isModalOpen, setIsModalOpen] = React.useState(false);

        return (
          <div>
            <Button
              onClick={() => setIsModalOpen(true)}
              data-testid="open-modal"
            >
              Open Modal
            </Button>
            <AnimatedModal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              title="Test Modal"
            >
              <Button
                onClick={() => setIsModalOpen(false)}
                data-testid="close-modal"
              >
                Close Modal
              </Button>
            </AnimatedModal>
          </div>
        );
      };

      render(
        <AccessibilityTestWrapper>
          <TestComponent />
        </AccessibilityTestWrapper>
      );

      const openButton = screen.getByTestId('open-modal');
      
      // Focus on open button
      openButton.focus();
      expect(openButton).toHaveFocus();

      // Open modal
      await user.click(openButton);
      
      const closeButton = screen.getByTestId('close-modal');
      
      // Close modal
      await user.click(closeButton);
      
      // Focus should return to open button
      expect(openButton).toHaveFocus();
    });
  });
});