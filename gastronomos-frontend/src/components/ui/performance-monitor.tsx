/**
 * Performance Monitor Component
 * Displays real-time animation performance metrics and provides comprehensive performance tracking
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAnimationPerformance, useFrameRate, useMemoryMonitoring } from '@/hooks/use-animation-performance';
import { Card } from './card';
import { Badge } from './badge';

// Performance monitoring interface
export interface PerformanceMetrics {
  fps: number;
  frameDrops: number;
  memoryUsage: number;
  renderTime: number;
  componentCount: number;
  animationCount: number;
  timestamp: number;
}

// Performance history for trending
export interface PerformanceHistory {
  metrics: PerformanceMetrics[];
  maxHistory: number;
}

// Performance thresholds
export interface PerformanceThresholds {
  fps: { good: number; warning: number; critical: number };
  memory: { good: number; warning: number; critical: number };
  renderTime: { good: number; warning: number; critical: number };
}

const defaultThresholds: PerformanceThresholds = {
  fps: { good: 55, warning: 30, critical: 15 },
  memory: { good: 50, warning: 100, critical: 150 },
  renderTime: { good: 16, warning: 33, critical: 50 },
};

export interface PerformanceMonitorProps {
  visible?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  compact?: boolean;
  className?: string;
  showHistory?: boolean;
  thresholds?: Partial<PerformanceThresholds>;
  onPerformanceIssue?: (metrics: PerformanceMetrics) => void;
}

export function PerformanceMonitor({
  visible = false,
  position = 'top-right',
  compact = false,
  className = '',
  showHistory = false,
  thresholds: userThresholds = {},
  onPerformanceIssue,
}: PerformanceMonitorProps) {
  const thresholds = { ...defaultThresholds, ...userThresholds };
  const { performance, isMonitoring, performanceIssues, isPerformanceGood } = useAnimationPerformance();
  const { frameRate, isLowFrameRate } = useFrameRate();
  const { memoryUsage, isHighMemory } = useMemoryMonitoring();
  
  const [performanceHistory, setPerformanceHistory] = useState<PerformanceHistory>({
    metrics: [],
    maxHistory: 60, // Keep 60 data points (1 minute at 1 second intervals)
  });
  const [renderTime, setRenderTime] = useState(0);
  const [componentCount, setComponentCount] = useState(0);
  const [animationCount, setAnimationCount] = useState(0);

  // Track render performance
  const trackRenderPerformance = useCallback(() => {
    const startTime = Date.now();
    
    return () => {
      const endTime = Date.now();
      setRenderTime(endTime - startTime);
    };
  }, []);

  // Update performance history
  useEffect(() => {
    const interval = setInterval(() => {
      const currentMetrics: PerformanceMetrics = {
        fps: frameRate,
        frameDrops: performance.frameDrops || 0,
        memoryUsage,
        renderTime,
        componentCount,
        animationCount,
        timestamp: Date.now(),
      };

      setPerformanceHistory(prev => {
        const newMetrics = [...prev.metrics, currentMetrics];
        if (newMetrics.length > prev.maxHistory) {
          newMetrics.shift();
        }
        return { ...prev, metrics: newMetrics };
      });

      // Check for performance issues
      const hasIssues = 
        frameRate < thresholds.fps.warning ||
        memoryUsage > thresholds.memory.warning ||
        renderTime > thresholds.renderTime.warning;

      if (hasIssues && onPerformanceIssue) {
        onPerformanceIssue(currentMetrics);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [frameRate, memoryUsage, renderTime, componentCount, animationCount, performance.frameDrops, thresholds, onPerformanceIssue]);

  // Count React components (approximation)
  useEffect(() => {
    const countComponents = () => {
      const reactElements = document.querySelectorAll('[data-reactroot], [data-react-component]');
      setComponentCount(reactElements.length);
    };

    countComponents();
    const interval = setInterval(countComponents, 5000);
    return () => clearInterval(interval);
  }, []);

  // Count active animations (approximation)
  useEffect(() => {
    const countAnimations = () => {
      const animatedElements = document.querySelectorAll('[data-framer-motion], .animate-*');
      setAnimationCount(animatedElements.length);
    };

    countAnimations();
    const interval = setInterval(countAnimations, 2000);
    return () => clearInterval(interval);
  }, []);

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  };

  if (!isMonitoring) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          className={`fixed ${positionClasses[position]} z-50 ${className}`}
        >
          <Card className="p-3 bg-white/95 backdrop-blur-sm border shadow-lg">
            {compact ? (
              <CompactPerformanceDisplay
                frameRate={frameRate}
                memoryUsage={memoryUsage}
                renderTime={renderTime}
                isPerformanceGood={isPerformanceGood}
                isLowFrameRate={isLowFrameRate}
                isHighMemory={isHighMemory}
                thresholds={thresholds}
              />
            ) : (
              <DetailedPerformanceDisplay
                performance={performance}
                frameRate={frameRate}
                memoryUsage={memoryUsage}
                renderTime={renderTime}
                componentCount={componentCount}
                animationCount={animationCount}
                performanceIssues={performanceIssues}
                performanceHistory={showHistory ? performanceHistory : undefined}
                isPerformanceGood={isPerformanceGood}
                isLowFrameRate={isLowFrameRate}
                isHighMemory={isHighMemory}
                thresholds={thresholds}
              />
            )}
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface CompactPerformanceDisplayProps {
  frameRate: number;
  memoryUsage: number;
  renderTime: number;
  isPerformanceGood: boolean;
  isLowFrameRate: boolean;
  isHighMemory: boolean;
  thresholds: PerformanceThresholds;
}

function CompactPerformanceDisplay({
  frameRate,
  memoryUsage,
  renderTime,
  isPerformanceGood,
  isLowFrameRate,
  isHighMemory,
  thresholds,
}: CompactPerformanceDisplayProps) {
  const getRenderTimeColor = () => {
    if (renderTime > thresholds.renderTime.critical) return 'text-red-600';
    if (renderTime > thresholds.renderTime.warning) return 'text-orange-600';
    return 'text-green-600';
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <Badge variant={isPerformanceGood ? 'default' : 'destructive'}>
        {isPerformanceGood ? '✓' : '⚠'}
      </Badge>
      <span className={isLowFrameRate ? 'text-red-600' : 'text-green-600'}>
        {Math.round(frameRate)} FPS
      </span>
      <span className={isHighMemory ? 'text-red-600' : 'text-gray-600'}>
        {Math.round(memoryUsage)}MB
      </span>
      <span className={getRenderTimeColor()}>
        {Math.round(renderTime)}ms
      </span>
    </div>
  );
}

interface DetailedPerformanceDisplayProps {
  performance: any;
  frameRate: number;
  memoryUsage: number;
  renderTime: number;
  componentCount: number;
  animationCount: number;
  performanceIssues: string[];
  performanceHistory?: PerformanceHistory;
  isPerformanceGood: boolean;
  isLowFrameRate: boolean;
  isHighMemory: boolean;
  thresholds: PerformanceThresholds;
}

function DetailedPerformanceDisplay({
  performance,
  frameRate,
  memoryUsage,
  renderTime,
  componentCount,
  animationCount,
  performanceIssues,
  performanceHistory,
  isPerformanceGood,
  isLowFrameRate,
  isHighMemory,
  thresholds,
}: DetailedPerformanceDisplayProps) {
  const getRenderTimeColor = () => {
    if (renderTime > thresholds.renderTime.critical) return 'text-red-600';
    if (renderTime > thresholds.renderTime.warning) return 'text-orange-600';
    return 'text-green-600';
  };

  const getAverageMetric = (key: keyof PerformanceMetrics) => {
    if (!performanceHistory || performanceHistory.metrics.length === 0) return 0;
    const sum = performanceHistory.metrics.reduce((acc, metric) => acc + (metric[key] as number), 0);
    return sum / performanceHistory.metrics.length;
  };

  return (
    <div className="space-y-2 min-w-[250px]">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Performance Monitor</h3>
        <Badge variant={isPerformanceGood ? 'default' : 'destructive'}>
          {isPerformanceGood ? 'Good' : 'Issues'}
        </Badge>
      </div>
      
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span>Frame Rate:</span>
          <span className={isLowFrameRate ? 'text-red-600 font-medium' : 'text-green-600'}>
            {Math.round(frameRate)} FPS
            {performanceHistory && (
              <span className="text-gray-500 ml-1">
                (avg: {Math.round(getAverageMetric('fps'))})
              </span>
            )}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>Render Time:</span>
          <span className={getRenderTimeColor()}>
            {Math.round(renderTime)}ms
            {performanceHistory && (
              <span className="text-gray-500 ml-1">
                (avg: {Math.round(getAverageMetric('renderTime'))})
              </span>
            )}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>Frame Drops:</span>
          <span className={performance.frameDrops > 5 ? 'text-orange-600' : 'text-gray-600'}>
            {performance.frameDrops}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>Memory:</span>
          <span className={isHighMemory ? 'text-red-600 font-medium' : 'text-gray-600'}>
            {Math.round(memoryUsage)}MB
            {performanceHistory && (
              <span className="text-gray-500 ml-1">
                (avg: {Math.round(getAverageMetric('memoryUsage'))})
              </span>
            )}
          </span>
        </div>

        <div className="flex justify-between">
          <span>Components:</span>
          <span className="text-gray-600">{componentCount}</span>
        </div>

        <div className="flex justify-between">
          <span>Animations:</span>
          <span className="text-gray-600">{animationCount}</span>
        </div>
      </div>

      {performanceHistory && performanceHistory.metrics.length > 0 && (
        <div className="mt-2 pt-2 border-t">
          <h4 className="text-xs font-medium mb-1">Performance Trend</h4>
          <PerformanceChart history={performanceHistory} thresholds={thresholds} />
        </div>
      )}

      {performanceIssues.length > 0 && (
        <div className="mt-2 pt-2 border-t">
          <h4 className="text-xs font-medium text-red-600 mb-1">Issues:</h4>
          <ul className="text-xs text-red-600 space-y-0.5">
            {performanceIssues.map((issue, index) => (
              <li key={index}>• {issue}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Simple performance chart component
interface PerformanceChartProps {
  history: PerformanceHistory;
  thresholds: PerformanceThresholds;
}

function PerformanceChart({ history, thresholds }: PerformanceChartProps) {
  const maxPoints = 20; // Show last 20 data points
  const recentMetrics = history.metrics.slice(-maxPoints);
  
  if (recentMetrics.length === 0) return null;

  const maxFps = Math.max(...recentMetrics.map(m => m.fps));
  const maxMemory = Math.max(...recentMetrics.map(m => m.memoryUsage));

  return (
    <div className="space-y-2">
      {/* FPS Chart */}
      <div>
        <div className="text-xs text-gray-600 mb-1">FPS Trend</div>
        <div className="flex items-end h-8 gap-0.5">
          {recentMetrics.map((metric, index) => {
            const height = (metric.fps / maxFps) * 100;
            const color = metric.fps < thresholds.fps.critical ? 'bg-red-500' :
                         metric.fps < thresholds.fps.warning ? 'bg-orange-500' : 'bg-green-500';
            
            return (
              <div
                key={index}
                className={`w-1 ${color} opacity-70`}
                style={{ height: `${height}%` }}
                title={`${Math.round(metric.fps)} FPS`}
              />
            );
          })}
        </div>
      </div>

      {/* Memory Chart */}
      <div>
        <div className="text-xs text-gray-600 mb-1">Memory Trend</div>
        <div className="flex items-end h-8 gap-0.5">
          {recentMetrics.map((metric, index) => {
            const height = (metric.memoryUsage / maxMemory) * 100;
            const color = metric.memoryUsage > thresholds.memory.critical ? 'bg-red-500' :
                         metric.memoryUsage > thresholds.memory.warning ? 'bg-orange-500' : 'bg-blue-500';
            
            return (
              <div
                key={index}
                className={`w-1 ${color} opacity-70`}
                style={{ height: `${height}%` }}
                title={`${Math.round(metric.memoryUsage)} MB`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Performance optimization suggestions
export function PerformanceOptimizationSuggestions({ 
  metrics, 
  thresholds 
}: { 
  metrics: PerformanceMetrics; 
  thresholds: PerformanceThresholds; 
}) {
  const suggestions: string[] = [];

  if (metrics.fps < thresholds.fps.warning) {
    suggestions.push('Consider reducing animation complexity or enabling performance mode');
  }

  if (metrics.memoryUsage > thresholds.memory.warning) {
    suggestions.push('High memory usage detected - consider implementing cleanup strategies');
  }

  if (metrics.renderTime > thresholds.renderTime.warning) {
    suggestions.push('Slow render times - consider virtualizing large lists or optimizing components');
  }

  if (metrics.animationCount > 10) {
    suggestions.push('Many active animations - consider limiting concurrent animations');
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 pt-2 border-t">
      <h4 className="text-xs font-medium text-blue-600 mb-1">Optimization Suggestions:</h4>
      <ul className="text-xs text-blue-600 space-y-0.5">
        {suggestions.map((suggestion, index) => (
          <li key={index}>• {suggestion}</li>
        ))}
      </ul>
    </div>
  );
}

// Development-only performance monitor
export function DevPerformanceMonitor() {
  const [visible, setVisible] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Toggle with Ctrl/Cmd + Shift + P
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setVisible(prev => !prev);
      }
      // Toggle history with Ctrl/Cmd + Shift + H
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'H') {
        e.preventDefault();
        setShowHistory(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <PerformanceMonitor 
      visible={visible} 
      position="top-right" 
      showHistory={showHistory}
      onPerformanceIssue={(metrics) => {
        console.warn('Performance issue detected:', metrics);
      }}
    />
  );
}

// Hook for performance monitoring
export function usePerformanceMonitoring(options: {
  onPerformanceIssue?: (metrics: PerformanceMetrics) => void;
  thresholds?: Partial<PerformanceThresholds>;
} = {}) {
  const [currentMetrics, setCurrentMetrics] = useState<PerformanceMetrics | null>(null);
  const [isOptimal, setIsOptimal] = useState(true);
  
  const thresholds = { ...defaultThresholds, ...options.thresholds };

  const checkPerformance = useCallback((metrics: PerformanceMetrics) => {
    setCurrentMetrics(metrics);
    
    const optimal = 
      metrics.fps >= thresholds.fps.good &&
      metrics.memoryUsage <= thresholds.memory.good &&
      metrics.renderTime <= thresholds.renderTime.good;
    
    setIsOptimal(optimal);
    
    if (!optimal && options.onPerformanceIssue) {
      options.onPerformanceIssue(metrics);
    }
  }, [thresholds, options.onPerformanceIssue]);

  return {
    currentMetrics,
    isOptimal,
    checkPerformance,
    thresholds,
  };
}