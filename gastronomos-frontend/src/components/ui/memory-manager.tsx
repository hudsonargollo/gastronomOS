/**
 * MemoryManager Component
 * Provides memory management and cleanup strategies
 */

'use client';

import React, { createContext, useContext, useEffect, useRef, useCallback, useState } from 'react';

// Memory management configuration
export interface MemoryManagerConfig {
  maxMemoryUsage: number; // MB
  cleanupInterval: number; // ms
  enableAutoCleanup: boolean;
  enableMemoryMonitoring: boolean;
  gcThreshold: number; // MB
  warningThreshold: number; // MB
}

// Memory usage information
export interface MemoryUsage {
  used: number; // MB
  total: number; // MB
  percentage: number;
  isHigh: boolean;
  isCritical: boolean;
}

// Cleanup strategy interface
export interface CleanupStrategy {
  id: string;
  priority: number;
  cleanup: () => void | Promise<void>;
  description: string;
}

// Memory manager context
interface MemoryManagerContextType {
  config: MemoryManagerConfig;
  memoryUsage: MemoryUsage;
  registerCleanupStrategy: (strategy: CleanupStrategy) => void;
  unregisterCleanupStrategy: (id: string) => void;
  forceCleanup: () => Promise<void>;
  requestGarbageCollection: () => void;
  isMemoryPressure: boolean;
}

const MemoryManagerContext = createContext<MemoryManagerContextType | null>(null);

// Default configuration
const defaultConfig: MemoryManagerConfig = {
  maxMemoryUsage: 200, // 200MB
  cleanupInterval: 30000, // 30 seconds
  enableAutoCleanup: true,
  enableMemoryMonitoring: true,
  gcThreshold: 150, // 150MB
  warningThreshold: 100, // 100MB
};

export interface MemoryManagerProps {
  children: React.ReactNode;
  config?: Partial<MemoryManagerConfig>;
  onMemoryWarning?: (usage: MemoryUsage) => void;
  onMemoryCritical?: (usage: MemoryUsage) => void;
}

export function MemoryManager({
  children,
  config: userConfig = {},
  onMemoryWarning,
  onMemoryCritical,
}: MemoryManagerProps) {
  const config = { ...defaultConfig, ...userConfig };
  const [memoryUsage, setMemoryUsage] = useState<MemoryUsage>({
    used: 0,
    total: 0,
    percentage: 0,
    isHigh: false,
    isCritical: false,
  });
  const [isMemoryPressure, setIsMemoryPressure] = useState(false);

  const cleanupStrategies = useRef<Map<string, CleanupStrategy>>(new Map());
  const monitoringInterval = useRef<NodeJS.Timeout | null>(null);
  const cleanupInterval = useRef<NodeJS.Timeout | null>(null);

  // Get memory usage
  const getMemoryUsage = useCallback((): MemoryUsage => {
    if (typeof window === 'undefined' || !('performance' in window)) {
      return { used: 0, total: 0, percentage: 0, isHigh: false, isCritical: false };
    }

    // @ts-ignore - memory API might not be available in all browsers
    const memory = (performance as any).memory;
    if (!memory) {
      return { used: 0, total: 0, percentage: 0, isHigh: false, isCritical: false };
    }

    const used = memory.usedJSHeapSize / (1024 * 1024); // Convert to MB
    const total = memory.totalJSHeapSize / (1024 * 1024); // Convert to MB
    const percentage = total > 0 ? (used / total) * 100 : 0;
    const isHigh = used > config.warningThreshold;
    const isCritical = used > config.gcThreshold;

    return { used, total, percentage, isHigh, isCritical };
  }, [config.warningThreshold, config.gcThreshold]);

  // Register cleanup strategy
  const registerCleanupStrategy = useCallback((strategy: CleanupStrategy) => {
    cleanupStrategies.current.set(strategy.id, strategy);
  }, []);

  // Unregister cleanup strategy
  const unregisterCleanupStrategy = useCallback((id: string) => {
    cleanupStrategies.current.delete(id);
  }, []);

  // Force cleanup
  const forceCleanup = useCallback(async () => {
    const strategies = Array.from(cleanupStrategies.current.values())
      .sort((a, b) => b.priority - a.priority); // Higher priority first

    for (const strategy of strategies) {
      try {
        await strategy.cleanup();
      } catch (error) {
        console.warn(`Cleanup strategy ${strategy.id} failed:`, error);
      }
    }

    // Request garbage collection if available
    requestGarbageCollection();
  }, []);

  // Request garbage collection
  const requestGarbageCollection = useCallback(() => {
    if (typeof window !== 'undefined' && 'gc' in window) {
      try {
        // @ts-ignore - gc is not in standard window interface
        window.gc();
      } catch (error) {
        // Silently handle if gc is not available
      }
    }
  }, []);

  // Monitor memory usage
  useEffect(() => {
    if (!config.enableMemoryMonitoring) return;

    const monitor = () => {
      const usage = getMemoryUsage();
      setMemoryUsage(usage);

      // Check for memory pressure
      const pressure = usage.isCritical || usage.percentage > 80;
      setIsMemoryPressure(pressure);

      // Trigger callbacks
      if (usage.isCritical && onMemoryCritical) {
        onMemoryCritical(usage);
      } else if (usage.isHigh && onMemoryWarning) {
        onMemoryWarning(usage);
      }

      // Auto cleanup if enabled and memory is high
      if (config.enableAutoCleanup && usage.isCritical) {
        forceCleanup();
      }
    };

    // Initial check
    monitor();

    // Set up monitoring interval
    monitoringInterval.current = setInterval(monitor, 5000); // Check every 5 seconds

    return () => {
      if (monitoringInterval.current) {
        clearInterval(monitoringInterval.current);
      }
    };
  }, [config.enableMemoryMonitoring, config.enableAutoCleanup, getMemoryUsage, forceCleanup, onMemoryWarning, onMemoryCritical]);

  // Set up cleanup interval
  useEffect(() => {
    if (!config.enableAutoCleanup) return;

    cleanupInterval.current = setInterval(() => {
      const usage = getMemoryUsage();
      if (usage.isHigh) {
        forceCleanup();
      }
    }, config.cleanupInterval);

    return () => {
      if (cleanupInterval.current) {
        clearInterval(cleanupInterval.current);
      }
    };
  }, [config.enableAutoCleanup, config.cleanupInterval, getMemoryUsage, forceCleanup]);

  const contextValue: MemoryManagerContextType = {
    config,
    memoryUsage,
    registerCleanupStrategy,
    unregisterCleanupStrategy,
    forceCleanup,
    requestGarbageCollection,
    isMemoryPressure,
  };

  return (
    <MemoryManagerContext.Provider value={contextValue}>
      {children}
    </MemoryManagerContext.Provider>
  );
}

// Hook to use memory manager
export function useMemoryManager() {
  const context = useContext(MemoryManagerContext);
  if (!context) {
    throw new Error('useMemoryManager must be used within a MemoryManager');
  }
  return context;
}

// Hook for component cleanup
export function useComponentCleanup(
  cleanupFn: () => void | Promise<void>,
  dependencies: React.DependencyList = [],
  options: { priority?: number; description?: string } = {}
) {
  const { registerCleanupStrategy, unregisterCleanupStrategy } = useMemoryManager();
  const cleanupId = useRef<string>(`cleanup-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    const strategy: CleanupStrategy = {
      id: cleanupId.current,
      priority: options.priority || 1,
      cleanup: cleanupFn,
      description: options.description || 'Component cleanup',
    };

    registerCleanupStrategy(strategy);

    return () => {
      unregisterCleanupStrategy(cleanupId.current);
    };
  }, [registerCleanupStrategy, unregisterCleanupStrategy, cleanupFn, options.priority, options.description, ...dependencies]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupFn();
    };
  }, []);
}

// Hook for cache management
export function useCacheCleanup<T>(
  cache: Map<string, T> | Set<T>,
  maxSize: number = 100,
  options: { priority?: number } = {}
) {
  const { registerCleanupStrategy, unregisterCleanupStrategy } = useMemoryManager();
  const cleanupId = useRef<string>(`cache-cleanup-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    const strategy: CleanupStrategy = {
      id: cleanupId.current,
      priority: options.priority || 2,
      cleanup: () => {
        if (cache instanceof Map) {
          if (cache.size > maxSize) {
            const keysToDelete = Array.from(cache.keys()).slice(0, cache.size - maxSize);
            keysToDelete.forEach(key => cache.delete(key));
          }
        } else if (cache instanceof Set) {
          if (cache.size > maxSize) {
            const itemsToDelete = Array.from(cache).slice(0, cache.size - maxSize);
            itemsToDelete.forEach(item => cache.delete(item));
          }
        }
      },
      description: `Cache cleanup (max size: ${maxSize})`,
    };

    registerCleanupStrategy(strategy);

    return () => {
      unregisterCleanupStrategy(cleanupId.current);
    };
  }, [cache, maxSize, registerCleanupStrategy, unregisterCleanupStrategy, options.priority]);
}

// Hook for animation cleanup
export function useAnimationCleanup() {
  const { registerCleanupStrategy, unregisterCleanupStrategy } = useMemoryManager();
  const animationRefs = useRef<Set<number>>(new Set());
  const cleanupId = useRef<string>(`animation-cleanup-${Math.random().toString(36).substr(2, 9)}`);

  const addAnimationFrame = useCallback((id: number) => {
    animationRefs.current.add(id);
  }, []);

  const removeAnimationFrame = useCallback((id: number) => {
    animationRefs.current.delete(id);
  }, []);

  useEffect(() => {
    const strategy: CleanupStrategy = {
      id: cleanupId.current,
      priority: 3,
      cleanup: () => {
        // Cancel all pending animation frames
        animationRefs.current.forEach(id => {
          cancelAnimationFrame(id);
        });
        animationRefs.current.clear();
      },
      description: 'Animation frame cleanup',
    };

    registerCleanupStrategy(strategy);

    return () => {
      unregisterCleanupStrategy(cleanupId.current);
      // Cleanup on unmount
      animationRefs.current.forEach(id => {
        cancelAnimationFrame(id);
      });
      animationRefs.current.clear();
    };
  }, [registerCleanupStrategy, unregisterCleanupStrategy]);

  return {
    addAnimationFrame,
    removeAnimationFrame,
  };
}

// Memory usage display component
export interface MemoryUsageDisplayProps {
  className?: string;
  showDetails?: boolean;
}

export function MemoryUsageDisplay({ className = '', showDetails = false }: MemoryUsageDisplayProps) {
  const { memoryUsage, forceCleanup } = useMemoryManager();

  const getStatusColor = () => {
    if (memoryUsage.isCritical) return 'text-red-600';
    if (memoryUsage.isHigh) return 'text-orange-600';
    return 'text-green-600';
  };

  return (
    <div className={`p-2 border rounded ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Memory Usage</span>
        <span className={`text-sm ${getStatusColor()}`}>
          {Math.round(memoryUsage.used)}MB
        </span>
      </div>
      
      {showDetails && (
        <div className="mt-2 space-y-1 text-xs text-gray-600">
          <div>Total: {Math.round(memoryUsage.total)}MB</div>
          <div>Percentage: {Math.round(memoryUsage.percentage)}%</div>
          {memoryUsage.isHigh && (
            <button
              onClick={forceCleanup}
              className="mt-1 px-2 py-1 bg-blue-500 text-white rounded text-xs"
            >
              Force Cleanup
            </button>
          )}
        </div>
      )}
    </div>
  );
}