/**
 * Wizard Integration Tests
 * Tests for wizard integration in transfer and allocation pages
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import TransfersPage from '@/app/transfers/page';
import AllocationsPage from '@/app/allocations/page';

// Mock the wizard components
vi.mock('@/components/wizards/inventory-transfer-wizard', () => ({
  InventoryTransferWizard: ({ onComplete, onCancel }: any) => (
    <div data-testid="inventory-transfer-wizard">
      <button data-testid="wizard-complete" onClick={() => onComplete({ test: 'data' })}>
        Complete
      </button>
      <button data-testid="wizard-cancel" onClick={onCancel}>
        Cancel
      </button>
    </div>
  ),
}));

vi.mock('@/components/wizards/allocation-rules-wizard', () => ({
  AllocationRulesWizard: ({ onComplete, onCancel }: any) => (
    <div data-testid="allocation-rules-wizard">
      <button data-testid="wizard-complete" onClick={() => onComplete({ name: 'Test Rule', isActive: true })}>
        Complete
      </button>
      <button data-testid="wizard-cancel" onClick={onCancel}>
        Cancel
      </button>
    </div>
  ),
}));

// Mock the animated modal
vi.mock('@/components/ui/animated-modal', () => ({
  AnimatedModal: ({ open, children, onOpenChange }: any) => (
    open ? (
      <div data-testid="animated-modal">
        <button data-testid="modal-close" onClick={() => onOpenChange?.(false)}>Close</button>
        {children}
      </div>
    ) : null
  ),
  AnimatedModalContent: ({ children, className, size }: any) => (
    <div data-testid="animated-modal-content" className={className}>
      {children}
    </div>
  ),
  AnimatedModalHeader: ({ children, className }: any) => (
    <div data-testid="animated-modal-header" className={className}>
      {children}
    </div>
  ),
  AnimatedModalTitle: ({ children, className }: any) => (
    <h2 data-testid="animated-modal-title" className={className}>
      {children}
    </h2>
  ),
  AnimatedModalDescription: ({ children, className }: any) => (
    <p data-testid="animated-modal-description" className={className}>
      {children}
    </p>
  ),
  AnimatedModalFooter: ({ children, className }: any) => (
    <div data-testid="animated-modal-footer" className={className}>
      {children}
    </div>
  ),
  AnimatedModalClose: ({ children, onClick }: any) => (
    <button data-testid="animated-modal-close" onClick={onClick}>
      {children}
    </button>
  ),
}));

// Mock the translations hook
vi.mock('@/hooks/use-translations', () => ({
  useTranslations: () => ({
    t: (key: string) => key,
  }),
}));

// Mock the toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
  },
}));

describe('Wizard Integration', () => {
  describe('TransfersPage', () => {
    it('should render transfer wizard button', () => {
      render(<TransfersPage />);
      
      const wizardButton = screen.getByText('Transfer Wizard');
      expect(wizardButton).toBeInTheDocument();
    });

    it('should open transfer wizard modal when button is clicked', async () => {
      render(<TransfersPage />);
      
      const wizardButton = screen.getByText('Transfer Wizard');
      fireEvent.click(wizardButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('animated-modal')).toBeInTheDocument();
        expect(screen.getByTestId('inventory-transfer-wizard')).toBeInTheDocument();
      });
    });

    it('should close wizard modal when cancelled', async () => {
      render(<TransfersPage />);
      
      // Open wizard
      const wizardButton = screen.getByText('Transfer Wizard');
      fireEvent.click(wizardButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('animated-modal')).toBeInTheDocument();
      });
      
      // Cancel wizard
      const cancelButton = screen.getByTestId('wizard-cancel');
      fireEvent.click(cancelButton);
      
      await waitFor(() => {
        expect(screen.queryByTestId('animated-modal')).not.toBeInTheDocument();
      });
    });

    it('should close wizard modal when completed', async () => {
      render(<TransfersPage />);
      
      // Open wizard
      const wizardButton = screen.getByText('Transfer Wizard');
      fireEvent.click(wizardButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('animated-modal')).toBeInTheDocument();
      });
      
      // Complete wizard
      const completeButton = screen.getByTestId('wizard-complete');
      fireEvent.click(completeButton);
      
      await waitFor(() => {
        expect(screen.queryByTestId('animated-modal')).not.toBeInTheDocument();
      });
    });
  });

  describe('AllocationsPage', () => {
    it('should render allocation wizard button', () => {
      render(<AllocationsPage />);
      
      const wizardButton = screen.getByText('Allocation Wizard');
      expect(wizardButton).toBeInTheDocument();
    });

    it('should open allocation wizard modal when button is clicked', async () => {
      render(<AllocationsPage />);
      
      const wizardButton = screen.getByText('Allocation Wizard');
      fireEvent.click(wizardButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('animated-modal')).toBeInTheDocument();
        expect(screen.getByTestId('allocation-rules-wizard')).toBeInTheDocument();
      });
    });

    it('should close wizard modal when cancelled', async () => {
      render(<AllocationsPage />);
      
      // Open wizard
      const wizardButton = screen.getByText('Allocation Wizard');
      fireEvent.click(wizardButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('animated-modal')).toBeInTheDocument();
      });
      
      // Cancel wizard
      const cancelButton = screen.getByTestId('wizard-cancel');
      fireEvent.click(cancelButton);
      
      await waitFor(() => {
        expect(screen.queryByTestId('animated-modal')).not.toBeInTheDocument();
      });
    });

    it('should close wizard modal when completed', async () => {
      render(<AllocationsPage />);
      
      // Open wizard
      const wizardButton = screen.getByText('Allocation Wizard');
      fireEvent.click(wizardButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('animated-modal')).toBeInTheDocument();
      });
      
      // Complete wizard
      const completeButton = screen.getByTestId('wizard-complete');
      fireEvent.click(completeButton);
      
      await waitFor(() => {
        expect(screen.queryByTestId('animated-modal')).not.toBeInTheDocument();
      });
    });
  });
});