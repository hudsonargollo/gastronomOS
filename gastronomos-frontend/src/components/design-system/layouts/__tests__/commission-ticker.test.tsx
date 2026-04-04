/**
 * Commission Ticker Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommissionTicker, CommissionTickerCompact, CommissionEntry } from '../commission-ticker';

const mockRecentEarnings: CommissionEntry[] = [
  { id: '1', amount: 12.50, timestamp: new Date(), orderNumber: '1234' },
  { id: '2', amount: 8.75, timestamp: new Date(), orderNumber: '1233' },
];

describe('CommissionTicker', () => {
  it('renders current commission amount', () => {
    render(<CommissionTicker currentCommission={245.50} />);
    expect(screen.getByText(/245\.50/)).toBeInTheDocument();
  });

  it('displays currency symbol', () => {
    render(<CommissionTicker currentCommission={100} currency="$" />);
    expect(screen.getByText(/\$/)).toBeInTheDocument();
  });

  it('shows target commission when provided', () => {
    render(
      <CommissionTicker 
        currentCommission={245.50} 
        targetCommission={500} 
      />
    );
    expect(screen.getByText(/Meta: R\$ 500\.00/)).toBeInTheDocument();
  });

  it('calculates and displays progress percentage', () => {
    render(
      <CommissionTicker 
        currentCommission={250} 
        targetCommission={500} 
      />
    );
    expect(screen.getByText(/50% alcançado/)).toBeInTheDocument();
  });

  it('shows progress bar when showProgress is true', () => {
    const { container } = render(
      <CommissionTicker 
        currentCommission={250} 
        targetCommission={500}
        showProgress={true}
      />
    );
    
    const progressBar = container.querySelector('.bg-white\\/20');
    expect(progressBar).toBeInTheDocument();
  });

  it('displays recent earnings in detailed variant', () => {
    render(
      <CommissionTicker 
        currentCommission={245.50}
        variant="detailed"
        recentEarnings={mockRecentEarnings}
      />
    );
    
    expect(screen.getByText(/Últimas Comissões/)).toBeInTheDocument();
    expect(screen.getByText(/#1234/)).toBeInTheDocument();
    expect(screen.getByText(/\+R\$ 12\.50/)).toBeInTheDocument();
  });

  it('applies correct variant classes', () => {
    const { container: container1 } = render(
      <CommissionTicker currentCommission={100} variant="compact" />
    );
    const { container: container2 } = render(
      <CommissionTicker currentCommission={100} variant="detailed" />
    );
    
    const ticker1 = container1.firstChild as HTMLElement;
    const ticker2 = container2.firstChild as HTMLElement;
    
    expect(ticker1).toHaveClass('p-2');
    expect(ticker2).toHaveClass('p-6');
  });

  it('limits recent earnings to 5 items', () => {
    const manyEarnings: CommissionEntry[] = Array.from({ length: 10 }, (_, i) => ({
      id: `${i}`,
      amount: 10,
      timestamp: new Date(),
      orderNumber: `${1000 + i}`,
    }));
    
    render(
      <CommissionTicker 
        currentCommission={100}
        variant="detailed"
        recentEarnings={manyEarnings}
      />
    );
    
    // Should only show first 5
    expect(screen.getByText(/#1000/)).toBeInTheDocument();
    expect(screen.getByText(/#1004/)).toBeInTheDocument();
    expect(screen.queryByText(/#1005/)).not.toBeInTheDocument();
  });

  it('handles commission without animation', () => {
    render(
      <CommissionTicker 
        currentCommission={100} 
        animateChanges={false}
      />
    );
    expect(screen.getByText(/100\.00/)).toBeInTheDocument();
  });
});

describe('CommissionTickerCompact', () => {
  it('renders current commission', () => {
    render(<CommissionTickerCompact currentCommission={150.75} />);
    expect(screen.getByText(/150\.75/)).toBeInTheDocument();
  });

  it('displays currency symbol', () => {
    render(<CommissionTickerCompact currentCommission={100} currency="$" />);
    expect(screen.getByText(/\$/)).toBeInTheDocument();
  });

  it('renders with icon', () => {
    const { container } = render(
      <CommissionTickerCompact currentCommission={100} />
    );
    
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <CommissionTickerCompact 
        currentCommission={100} 
        className="custom-class"
      />
    );
    
    const ticker = container.firstChild as HTMLElement;
    expect(ticker).toHaveClass('custom-class');
  });
});
