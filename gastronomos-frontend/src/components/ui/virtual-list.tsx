/**
 * VirtualizedList Component
 * Efficiently renders large datasets using virtualization
 */

'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string | number;
  overscan?: number;
  className?: string;
  onScroll?: (scrollTop: number) => void;
  animated?: boolean;
  loadingComponent?: React.ReactNode;
  emptyComponent?: React.ReactNode;
}

export function VirtualizedList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  keyExtractor,
  overscan = 5,
  className = '',
  onScroll,
  animated = true,
  loadingComponent,
  emptyComponent,
}: VirtualizedListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );
    return { startIndex, endIndex };
  }, [scrollTop, itemHeight, containerHeight, overscan, items.length]);

  // Get visible items
  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1);
  }, [items, visibleRange]);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    onScroll?.(newScrollTop);
  }, [onScroll]);

  // Scroll to index
  const scrollToIndex = useCallback((index: number) => {
    if (!scrollElementRef.current) return;
    
    const targetScrollTop = index * itemHeight;
    scrollElementRef.current.scrollTop = targetScrollTop;
    setScrollTop(targetScrollTop);
  }, [itemHeight]);

  // Scroll to top
  const scrollToTop = useCallback(() => {
    scrollToIndex(0);
  }, [scrollToIndex]);

  // Total height for scrollbar
  const totalHeight = items.length * itemHeight;

  // Offset for visible items
  const offsetY = visibleRange.startIndex * itemHeight;

  // Handle empty state
  if (items.length === 0) {
    return (
      <div 
        ref={containerRef}
        className={`relative overflow-hidden ${className}`}
        style={{ height: containerHeight }}
      >
        {emptyComponent || (
          <div className="flex items-center justify-center h-full text-gray-500">
            No items to display
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={{ height: containerHeight }}
    >
      <div
        ref={scrollElementRef}
        className="h-full overflow-auto"
        onScroll={handleScroll}
      >
        {/* Spacer for total height */}
        <div style={{ height: totalHeight, position: 'relative' }}>
          {/* Visible items container */}
          <div
            style={{
              transform: `translateY(${offsetY}px)`,
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
            }}
          >
            {animated ? (
              <AnimatePresence mode="popLayout">
                {visibleItems.map((item, index) => {
                  const actualIndex = visibleRange.startIndex + index;
                  const key = keyExtractor(item, actualIndex);
                  
                  return (
                    <motion.div
                      key={key}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.2 }}
                      style={{ height: itemHeight }}
                      className="flex items-center"
                    >
                      {renderItem(item, actualIndex)}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            ) : (
              visibleItems.map((item, index) => {
                const actualIndex = visibleRange.startIndex + index;
                const key = keyExtractor(item, actualIndex);
                
                return (
                  <div
                    key={key}
                    style={{ height: itemHeight }}
                    className="flex items-center"
                  >
                    {renderItem(item, actualIndex)}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      
      {/* Loading overlay */}
      {loadingComponent && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
          {loadingComponent}
        </div>
      )}
    </div>
  );
}

// Hook for virtualized list management
export function useVirtualizedList<T>(items: T[], itemHeight: number) {
  const [containerHeight, setContainerHeight] = useState(400);
  const [scrollTop, setScrollTop] = useState(0);
  
  const scrollToIndex = useCallback((index: number) => {
    setScrollTop(index * itemHeight);
  }, [itemHeight]);

  const scrollToTop = useCallback(() => {
    setScrollTop(0);
  }, []);

  const getVisibleRange = useCallback((overscan = 5) => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );
    return { startIndex, endIndex };
  }, [scrollTop, itemHeight, containerHeight, items.length]);

  return {
    containerHeight,
    setContainerHeight,
    scrollTop,
    setScrollTop,
    scrollToIndex,
    scrollToTop,
    getVisibleRange,
    totalHeight: items.length * itemHeight,
  };
}

// Performance-optimized virtualized table
export interface VirtualizedTableProps<T> {
  items: T[];
  columns: Array<{
    key: string;
    title: string;
    width?: number;
    render?: (item: T, index: number) => React.ReactNode;
  }>;
  rowHeight?: number;
  containerHeight: number;
  keyExtractor: (item: T, index: number) => string | number;
  className?: string;
  onRowClick?: (item: T, index: number) => void;
}

export function VirtualizedTable<T>({
  items,
  columns,
  rowHeight = 50,
  containerHeight,
  keyExtractor,
  className = '',
  onRowClick,
}: VirtualizedTableProps<T>) {
  const renderRow = useCallback((item: T, index: number) => {
    return (
      <div
        className={`flex border-b hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`}
        onClick={() => onRowClick?.(item, index)}
      >
        {columns.map((column) => (
          <div
            key={column.key}
            className="px-4 py-2 flex items-center"
            style={{ width: column.width || `${100 / columns.length}%` }}
          >
            {column.render ? column.render(item, index) : String((item as any)[column.key])}
          </div>
        ))}
      </div>
    );
  }, [columns, onRowClick]);

  return (
    <div className={`border rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex bg-gray-50 border-b font-medium">
        {columns.map((column) => (
          <div
            key={column.key}
            className="px-4 py-3"
            style={{ width: column.width || `${100 / columns.length}%` }}
          >
            {column.title}
          </div>
        ))}
      </div>
      
      {/* Virtualized rows */}
      <VirtualizedList
        items={items}
        itemHeight={rowHeight}
        containerHeight={containerHeight - 50} // Account for header
        renderItem={renderRow}
        keyExtractor={keyExtractor}
        animated={false} // Disable animations for better table performance
      />
    </div>
  );
}