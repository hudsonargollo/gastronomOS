/**
 * Floating Stack Component Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FloatingStack, StackItem } from '../floating-stack';

describe('FloatingStack', () => {
  it('renders children correctly', () => {
    render(
      <FloatingStack>
        <StackItem>Item 1</StackItem>
        <StackItem>Item 2</StackItem>
      </FloatingStack>
    );
    
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('applies horizontal orientation by default', () => {
    const { container } = render(
      <FloatingStack>
        <StackItem>Item</StackItem>
      </FloatingStack>
    );
    
    const stack = container.firstChild as HTMLElement;
    expect(stack).toHaveClass('flex-row');
  });

  it('applies vertical orientation when specified', () => {
    const { container } = render(
      <FloatingStack orientation="vertical">
        <StackItem>Item</StackItem>
      </FloatingStack>
    );
    
    const stack = container.firstChild as HTMLElement;
    expect(stack).toHaveClass('flex-col');
  });

  it('applies correct spacing classes', () => {
    const { container } = render(
      <FloatingStack spacing="relaxed">
        <StackItem>Item</StackItem>
      </FloatingStack>
    );
    
    const stack = container.firstChild as HTMLElement;
    expect(stack).toHaveClass('gap-4');
  });
});

describe('StackItem', () => {
  it('renders children correctly', () => {
    render(<StackItem>Test Item</StackItem>);
    expect(screen.getByText('Test Item')).toBeInTheDocument();
  });

  it('applies active state styling', () => {
    const { container } = render(<StackItem active>Active Item</StackItem>);
    const button = container.firstChild as HTMLElement;
    expect(button).toHaveClass('bg-[var(--token-action-primary)]');
  });

  it('handles click events', () => {
    const handleClick = jest.fn();
    render(<StackItem onClick={handleClick}>Clickable</StackItem>);
    
    const button = screen.getByText('Clickable');
    fireEvent.click(button);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders icon when provided', () => {
    render(
      <StackItem icon={<span data-testid="test-icon">🍕</span>}>
        With Icon
      </StackItem>
    );
    
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('renders badge when provided', () => {
    render(<StackItem badge={5}>With Badge</StackItem>);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders string badge', () => {
    render(<StackItem badge="NEW">With Badge</StackItem>);
    expect(screen.getByText('NEW')).toBeInTheDocument();
  });

  it('combines icon and badge', () => {
    render(
      <StackItem 
        icon={<span data-testid="icon">🍕</span>}
        badge={3}
      >
        Full Item
      </StackItem>
    );
    
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Full Item')).toBeInTheDocument();
  });
});
