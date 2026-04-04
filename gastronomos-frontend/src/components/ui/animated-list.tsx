/**
 * AnimatedList Component
 * Provides smooth animations for list operations including add, remove, and reorder
 */

'use client';

import React from 'react';
import { motion, AnimatePresence, Reorder, MotionProps } from 'framer-motion';
import { listItemVariants, staggerContainer, transitions } from '@/lib/animation-utils';
import { cn } from '@/lib/utils';

export interface AnimatedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string | number;
  className?: string;
  itemClassName?: string;
  onReorder?: (newOrder: T[]) => void;
  reorderable?: boolean;
  staggered?: boolean;
  direction?: 'vertical' | 'horizontal';
  spacing?: 'none' | 'sm' | 'md' | 'lg';
}

export function AnimatedList<T>({
  items,
  renderItem,
  keyExtractor,
  className,
  itemClassName,
  onReorder,
  reorderable = false,
  staggered = true,
  direction = 'vertical',
  spacing = 'md',
}: AnimatedListProps<T>) {
  const spacingClasses = {
    none: '',
    sm: direction === 'vertical' ? 'space-y-2' : 'space-x-2',
    md: direction === 'vertical' ? 'space-y-4' : 'space-x-4',
    lg: direction === 'vertical' ? 'space-y-6' : 'space-x-6',
  };

  const containerClasses = cn(
    'w-full',
    direction === 'horizontal' ? 'flex' : 'flex flex-col',
    spacingClasses[spacing],
    className
  );

  if (reorderable && onReorder) {
    return (
      <Reorder.Group
        axis={direction === 'vertical' ? 'y' : 'x'}
        values={items}
        onReorder={onReorder}
        className={containerClasses}
        variants={staggered ? staggerContainer : undefined}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <AnimatePresence mode="popLayout">
          {items.map((item, index) => (
            <Reorder.Item
              key={keyExtractor(item, index)}
              value={item}
              variants={listItemVariants}
              transition={transitions.spring}
              className={cn(
                'cursor-grab active:cursor-grabbing',
                itemClassName
              )}
              whileDrag={{ scale: 1.02, zIndex: 10 }}
            >
              {renderItem(item, index)}
            </Reorder.Item>
          ))}
        </AnimatePresence>
      </Reorder.Group>
    );
  }

  return (
    <motion.div
      className={containerClasses}
      variants={staggered ? staggerContainer : undefined}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <AnimatePresence mode="popLayout">
        {items.map((item, index) => (
          <motion.div
            key={keyExtractor(item, index)}
            variants={listItemVariants}
            transition={transitions.spring}
            className={itemClassName}
            layout
          >
            {renderItem(item, index)}
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

// Specialized list components for common use cases
export interface SimpleAnimatedListProps {
  items: string[];
  className?: string;
  itemClassName?: string;
  onItemClick?: (item: string, index: number) => void;
  staggered?: boolean;
}

export function SimpleAnimatedList({
  items,
  className,
  itemClassName,
  onItemClick,
  staggered = true,
}: SimpleAnimatedListProps) {
  return (
    <AnimatedList
      items={items}
      keyExtractor={(item, index) => `${item}-${index}`}
      renderItem={(item, index) => (
        <div
          className={cn(
            'p-3 bg-background border rounded-lg cursor-pointer hover:bg-accent transition-colors',
            itemClassName
          )}
          onClick={() => onItemClick?.(item, index)}
        >
          {item}
        </div>
      )}
      className={className}
      staggered={staggered}
    />
  );
}

// Grid layout animated list
export interface AnimatedGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string | number;
  columns?: number;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
  itemClassName?: string;
}

export function AnimatedGrid<T>({
  items,
  renderItem,
  keyExtractor,
  columns = 3,
  gap = 'md',
  className,
  itemClassName,
}: AnimatedGridProps<T>) {
  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
  };

  return (
    <motion.div
      className={cn(
        'grid',
        `grid-cols-${columns}`,
        gapClasses[gap],
        className
      )}
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <AnimatePresence mode="popLayout">
        {items.map((item, index) => (
          <motion.div
            key={keyExtractor(item, index)}
            variants={listItemVariants}
            transition={transitions.spring}
            className={itemClassName}
            layout
          >
            {renderItem(item, index)}
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

// Masonry layout animated list
export interface AnimatedMasonryProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string | number;
  columns?: number;
  gap?: number;
  className?: string;
}

export function AnimatedMasonry<T>({
  items,
  renderItem,
  keyExtractor,
  columns = 3,
  gap = 16,
  className,
}: AnimatedMasonryProps<T>) {
  const columnWrappers: T[][] = Array.from({ length: columns }, () => []);
  
  // Distribute items across columns
  items.forEach((item, index) => {
    columnWrappers[index % columns].push(item);
  });

  return (
    <motion.div
      className={cn('flex', className)}
      style={{ gap }}
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {columnWrappers.map((column, columnIndex) => (
        <motion.div
          key={columnIndex}
          className="flex-1 flex flex-col"
          style={{ gap }}
        >
          <AnimatePresence mode="popLayout">
            {column.map((item, itemIndex) => {
              const originalIndex = items.findIndex(originalItem => originalItem === item);
              return (
                <motion.div
                  key={keyExtractor(item, originalIndex)}
                  variants={listItemVariants}
                  transition={transitions.spring}
                  layout
                >
                  {renderItem(item, originalIndex)}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      ))}
    </motion.div>
  );
}