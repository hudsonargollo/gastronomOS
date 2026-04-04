/**
 * Insumos Bar Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { InsumosBar, Ingredient } from '../insumos-bar';

const mockIngredients: Ingredient[] = [
  { id: '1', name: 'Tomate', quantity: 2, unit: 'un', color: '#ef4444' },
  { id: '2', name: 'Alface', quantity: 100, unit: 'g', color: '#22c55e' },
  { id: '3', name: 'Queijo', quantity: 50, unit: 'g' },
];

describe('InsumosBar', () => {
  it('renders all ingredients', () => {
    render(<InsumosBar ingredients={mockIngredients} />);
    
    expect(screen.getByText('Tomate')).toBeInTheDocument();
    expect(screen.getByText('Alface')).toBeInTheDocument();
    expect(screen.getByText('Queijo')).toBeInTheDocument();
  });

  it('displays "Insumos" label', () => {
    render(<InsumosBar ingredients={mockIngredients} />);
    expect(screen.getByText('Insumos')).toBeInTheDocument();
  });

  it('shows quantities by default', () => {
    render(<InsumosBar ingredients={mockIngredients} />);
    
    expect(screen.getByText('2un')).toBeInTheDocument();
    expect(screen.getByText('100g')).toBeInTheDocument();
  });

  it('hides quantities when showQuantities is false', () => {
    render(<InsumosBar ingredients={mockIngredients} showQuantities={false} />);
    
    expect(screen.queryByText('2un')).not.toBeInTheDocument();
    expect(screen.queryByText('100g')).not.toBeInTheDocument();
  });

  it('applies correct variant classes', () => {
    const { container: container1 } = render(
      <InsumosBar ingredients={mockIngredients} variant="compact" />
    );
    const { container: container2 } = render(
      <InsumosBar ingredients={mockIngredients} variant="detailed" />
    );
    
    const bar1 = container1.firstChild as HTMLElement;
    const bar2 = container2.firstChild as HTMLElement;
    
    expect(bar1).toHaveClass('p-2');
    expect(bar2).toHaveClass('p-4');
  });

  it('renders ingredient with icon', () => {
    const ingredientsWithIcon: Ingredient[] = [
      { 
        id: '1', 
        name: 'Tomate', 
        icon: <span data-testid="tomato-icon">🍅</span> 
      },
    ];
    
    render(<InsumosBar ingredients={ingredientsWithIcon} />);
    expect(screen.getByTestId('tomato-icon')).toBeInTheDocument();
  });

  it('handles empty ingredients array', () => {
    render(<InsumosBar ingredients={[]} />);
    expect(screen.getByText('Insumos')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <InsumosBar ingredients={mockIngredients} className="custom-class" />
    );
    
    const bar = container.firstChild as HTMLElement;
    expect(bar).toHaveClass('custom-class');
  });
});
