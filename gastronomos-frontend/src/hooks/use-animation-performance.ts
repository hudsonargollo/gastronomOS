/**
 * Animation Performance Hook
 * Provides performance monitoring and optimization for animations
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { performanceMonitor, AnimationPerformance } from '@/lib/animation-config';

export interface UseAnimationPerformanceOptions {
  autoStart?: boolean;
  monitoringInterval?: number;
  fpsThreshold?: number;
  onPerformanceChange?: (performance: AnimationPerformance) => void;
}

export function useAnimationPerformance(options: UseAnimationPerformanceOptions = {}) {
  const {
    autoStart = true,
    monitoringInterval = 1000,
    fpsThreshold = 30,
    onPerformanceChange,
  } = options;

  const [performance, setPerformance] = useState<AnimationPerformance>(() => 
    performanceMonitor.getPerformanceState()
  );
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [performanceIssues, setPerformanceIssues] = useState<string[]>([]);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    if (!isMonitoring) {
      performanceMonitor.startMonitoring();
      setIsMonitoring(true);
    }
  }, [isMonitoring]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    if (isMonitoring) {
      performanceMonitor.stopMonitoring();
      setIsMonitoring(false);
    }
  }, [isMonitoring]);

  // Get current performance state
  const getPerformanceState = useCallback(() => {
    return performanceMonitor.getPerformanceState();
  }, []);

  // Check for performance issues
  const checkPerformanceIssues = useCallback((perf: AnimationPerformance) => {
    const issues: string[] = [];
    
    if (perf.fps < fpsThreshold) {
      issues.push(`Low FPS: ${perf.fps} (threshold: ${fpsThreshold})`);
    }
    
    if (perf.frameDrops > 10) {
      issues.push(`High frame drops: ${perf.frameDrops}`);
    }
    
    if (perf.memoryUsage > 100) { // MB
      issues.push(`High memory usage: ${perf.memoryUsage}MB`);
    }
    
    return issues;
  }, [fpsThreshold]);

  // Update performance state periodically
  useEffect(() => {
    if (!isMonitoring) return;

    const interval = setInterval(() => {
      const currentPerf = getPerformanceState();
      setPerformance(currentPerf);
      
      const issues = checkPerformanceIssues(currentPerf);
      setPerformanceIssues(issues);
      
      onPerformanceChange?.(currentPerf);
    }, monitoringInterval);

    return () => clearInterval(interval);
  }, [isMonitoring, monitoringInterval, getPerformanceState, checkPerformanceIssues, onPerformanceChange]);

  // Auto-start monitoring if enabled
  useEffect(() => {
    if (autoStart) {
      startMonitoring();
    }

    return () => {
      if (autoStart) {
        stopMonitoring();
      }
    };
  }, [autoStart, startMonitoring, stopMonitoring]);

  return {
    performance,
    isMonitoring,
    performanceIssues,
    startMonitoring,
    stopMonitoring,
    getPerformanceState,
    // Computed values
    isPerformanceGood: performance.fps >= fpsThreshold && performanceIssues.length === 0,
    averageFps: performance.fps,
    hasPerformanceIssues: performanceIssues.length > 0,
  };
}

// Hook for frame rate monitoring specifically
export function useFrameRate(options: { threshold?: number; onLowFrameRate?: () => void } = {}) {
  const { threshold = 30, onLowFrameRate } = options;
  const [frameRate, setFrameRate] = useState(60);
  const [isLowFrameRate, setIsLowFrameRate] = useState(false);

  const { performance, isMonitoring, startMonitoring, stopMonitoring } = useAnimationPerformance({
    onPerformanceChange: (perf) => {
      setFrameRate(perf.fps);
      const lowFps = perf.fps < threshold;
      
      if (lowFps && !isLowFrameRate) {
        setIsLowFrameRate(true);
        onLowFrameRate?.();
      } else if (!lowFps && isLowFrameRate) {
        setIsLowFrameRate(false);
      }
    },
  });

  return {
    frameRate,
    isLowFrameRate,
    threshold,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
  };
}

// Hook for memory monitoring
export function useMemoryMonitoring(options: { threshold?: number; onHighMemory?: () => void } = {}) {
  const { threshold = 100, onHighMemory } = options;
  const [memoryUsage, setMemoryUsage] = useState(0);
  const [isHighMemory, setIsHighMemory] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('performance' in window)) return;

    const checkMemory = () => {
      // @ts-ignore - memory API might not be available in all browsers
      if (performance.memory) {
        // @ts-ignore
        const usage = performance.memory.usedJSHeapSize / (1024 * 1024); // Convert to MB
        setMemoryUsage(usage);
        
        const highMem = usage > threshold;
        if (highMem && !isHighMemory) {
          setIsHighMemory(true);
          onHighMemory?.();
        } else if (!highMem && isHighMemory) {
          setIsHighMemory(false);
        }
      }
    };

    const interval = setInterval(checkMemory, 2000);
    checkMemory(); // Initial check

    return () => clearInterval(interval);
  }, [threshold, isHighMemory, onHighMemory]);

  return {
    memoryUsage,
    isHighMemory,
    threshold,
  };
}