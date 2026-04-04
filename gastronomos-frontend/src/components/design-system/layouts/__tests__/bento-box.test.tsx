/**
 * Bento Box Layout Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { BentoBox, BentoItem } from '../bento-box';

describe('BentoBox', () => {
  it('renders children correctly', () => {
    render(
      <BentoBox>
        <BentoItem>
          <div>Test Item</div>
        </BentoItem>
      </BentoBox>
    );
    
    expect(screen.getByText('Test Item')).toBeInTheDocument();
  });

  it('applies correct column classes', () => {
    const { container } = render(
      <BentoBox columns={4}>
        <BentoItem>Item</BentoItem>
      </BentoBox>
    );
    
    const bentoBox = container.firstChild as HTMLElement;
    expect(bentoBox).toHaveClass('grid-cols-4');
  });

  it('applies correct gap classes', () => {
    const { container } = render(
      <BentoBox gap="lg">
        <BentoItem>Item</BentoItem>
      </BentoBox>
    );
    
    const bentoBox = container.firstChild as HTMLElement;
    expect(bentoBox).toHaveClass('gap-6');
  });

  it('applies custom className', () => {
    const { container } = render(
      <BentoBox className="custom-class">
        <BentoItem>Item</BentoItem>
      </BentoBox>
    );
    
    const bentoBox = container.firstChild as HTMLElement;
    expect(bentoBox).toHaveClass('custom-class');
  });
});

describe('BentoItem', () => {
  it('renders children correctly', () => {
    render(
      <BentoItem>
        <div>Test Content</div>
      </BentoItem>
    );
    
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('applies correct span classes', () => {
    const { container } = render(
      <BentoItem span={3}>Item</BentoItem>
    );
    
    const item = container.firstChild as HTMLElement;
    expect(item).toHaveClass('col-span-3');
  });

  it('applies correct rowSpan classes', () => {
    const { container } = render(
      <BentoItem rowSpan={2}>Item</BentoItem>
    );
    
    const item = container.firstChild as HTMLElement;
    expect(item).toHaveClass('row-span-2');
  });

  it('applies correct variant classes', () => {
    const { container: container1 } = render(
      <BentoItem variant="elevated">Item 1</BentoItem>
    );
    const { container: container2 } = render(
      <BentoItem variant="outlined">Item 2</BentoItem>
    );
    
    const item1 = container1.firstChild as HTMLElement;
    const item2 = container2.firstChild as HTMLElement;
    
    expect(item1).toHaveClass('shadow-md');
    expect(item2).toHaveClass('border-2');
  });

  it('applies custom className', () => {
    const { container } = render(
      <BentoItem className="custom-item">Item</BentoItem>
    );
    
    const item = container.firstChild as HTMLElement;
    expect(item).toHaveClass('custom-item');
  });

  it('combines multiple props correctly', () => {
    const { container } = render(
      <BentoItem span={2} rowSpan={2} variant="elevated" className="custom">
        Item
      </BentoItem>
    );
    
    const item = container.firstChild as HTMLElement;
    expect(item).toHaveClass('col-span-2');
    expect(item).toHaveClass('row-span-2');
    expect(item).toHaveClass('shadow-md');
    expect(item).toHaveClass('custom');
  });
});
