/**
 * Comprehensive Performance Monitoring System
 * Provides real-time performance tracking and optimization suggestions
 */

import React from 'react';

// Performance metrics interface
export interface PerformanceMetrics {
  // Core Web Vitals
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  fcp?: number; // First Contentful Paint
  ttfb?: number; // Time to First Byte
  
  // Runtime metrics
  fps: number;
  frameDrops: number;
  memoryUsage: number;
  renderTime: number;
  componentCount: number;
  animationCount: number;
  
  // Bundle metrics
  bundleSize?: number;
  loadTime: number;
  cacheHitRate?: number;
  
  // User experience metrics
  interactionLatency: number;
  scrollPerformance: number;
  
  timestamp: number;
}

// Performance thresholds based on industry standards
export const PERFORMANCE_THRESHOLDS = {
  // Core Web Vitals (Google standards)
  lcp: { good: 2500, needsImprovement: 4000 },
  fid: { good: 100, needsImprovement: 300 },
  cls: { good: 0.1, needsImprovement: 0.25 },
  fcp: { good: 1800, needsImprovement: 3000 },
  ttfb: { good: 800, needsImprovement: 1800 },
  
  // Runtime performance
  fps: { good: 55, warning: 30, critical: 15 },
  memory: { good: 50, warning: 100, critical: 150 }, // MB
  renderTime: { good: 16, warning: 33, critical: 50 }, // ms
  
  // Loading performance
  loadTime: { good: 1000, warning: 3000, critical: 5000 }, // ms
  bundleSize: { good: 250, warning: 500, critical: 1000 }, // KB
  
  // Interaction performance
  interactionLatency: { good: 50, warning: 100, critical: 200 }, // ms
  scrollPerformance: { good: 16, warning: 33, critical: 50 }, // ms
} as const;

// Performance monitoring class
export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private observers: PerformanceObserver[] = [];
  private isMonitoring = false;
  private callbacks: ((metrics: PerformanceMetrics) => void)[] = [];
  
  constructor() {
    this.setupPerformanceObservers();
  }

  // Start monitoring
  start(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.startCoreWebVitalsMonitoring();
    this.startRuntimeMonitoring();
    this.startInteractionMonitoring();
  }

  // Stop monitoring
  stop(): void {
    this.isMonitoring = false;
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }

  // Add callback for performance updates
  onMetricsUpdate(callback: (metrics: PerformanceMetrics) => void): () => void {
    this.callbacks.push(callback);
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  // Get current metrics
  getCurrentMetrics(): PerformanceMetrics {
    const now = performance.now();
    
    return {
      fps: this.getCurrentFPS(),
      frameDrops: this.getFrameDrops(),
      memoryUsage: this.getMemoryUsage(),
      renderTime: this.getRenderTime(),
      componentCount: this.getComponentCount(),
      animationCount: this.getAnimationCount(),
      loadTime: now,
      interactionLatency: this.getInteractionLatency(),
      scrollPerformance: this.getScrollPerformance(),
      timestamp: Date.now(),
    };
  }

  // Get performance history
  getMetricsHistory(limit = 100): PerformanceMetrics[] {
    return this.metrics.slice(-limit);
  }

  // Get performance score (0-100)
  getPerformanceScore(): number {
    const current = this.getCurrentMetrics();
    let score = 100;
    
    // Deduct points for poor performance
    if (current.fps < PERFORMANCE_THRESHOLDS.fps.good) {
      score -= 20;
    }
    if (current.memoryUsage > PERFORMANCE_THRESHOLDS.memory.warning) {
      score -= 15;
    }
    if (current.renderTime > PERFORMANCE_THRESHOLDS.renderTime.warning) {
      score -= 15;
    }
    if (current.interactionLatency > PERFORMANCE_THRESHOLDS.interactionLatency.warning) {
      score -= 20;
    }
    if (current.loadTime > PERFORMANCE_THRESHOLDS.loadTime.warning) {
      score -= 15;
    }
    
    return Math.max(0, score);
  }

  // Get optimization suggestions
  getOptimizationSuggestions(): string[] {
    const current = this.getCurrentMetrics();
    const suggestions: string[] = [];

    if (current.fps < PERFORMANCE_THRESHOLDS.fps.warning) {
      suggestions.push('Consider reducing animation complexity or enabling performance mode');
    }

    if (current.memoryUsage > PERFORMANCE_THRESHOLDS.memory.warning) {
      suggestions.push('High memory usage detected - implement cleanup strategies');
    }

    if (current.renderTime > PERFORMANCE_THRESHOLDS.renderTime.warning) {
      suggestions.push('Slow render times - consider virtualizing large lists');
    }

    if (current.animationCount > 10) {
      suggestions.push('Many active animations - consider limiting concurrent animations');
    }

    if (current.interactionLatency > PERFORMANCE_THRESHOLDS.interactionLatency.warning) {
      suggestions.push('High interaction latency - optimize event handlers');
    }

    if (current.componentCount > 100) {
      suggestions.push('Many components rendered - consider code splitting');
    }

    return suggestions;
  }

  // Private methods
  private setupPerformanceObservers(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return;
    }

    // Observe navigation timing
    try {
      const navObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'navigation') {
            this.updateMetrics({
              loadTime: entry.duration,
              ttfb: (entry as PerformanceNavigationTiming).responseStart,
            });
          }
        });
      });
      navObserver.observe({ entryTypes: ['navigation'] });
      this.observers.push(navObserver);
    } catch (error) {
      console.warn('Navigation timing observer not supported:', error);
    }

    // Observe paint timing
    try {
      const paintObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name === 'first-contentful-paint') {
            this.updateMetrics({ fcp: entry.startTime });
          }
        });
      });
      paintObserver.observe({ entryTypes: ['paint'] });
      this.observers.push(paintObserver);
    } catch (error) {
      console.warn('Paint timing observer not supported:', error);
    }
  }

  private startCoreWebVitalsMonitoring(): void {
    // Monitor LCP
    this.observeLCP();
    
    // Monitor FID
    this.observeFID();
    
    // Monitor CLS
    this.observeCLS();
  }

  private observeLCP(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.updateMetrics({ lcp: lastEntry.startTime });
      });
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(observer);
    } catch (error) {
      console.warn('LCP observer not supported:', error);
    }
  }

  private observeFID(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          this.updateMetrics({ fid: (entry as any).processingStart - entry.startTime });
        });
      });
      observer.observe({ entryTypes: ['first-input'] });
      this.observers.push(observer);
    } catch (error) {
      console.warn('FID observer not supported:', error);
    }
  }

  private observeCLS(): void {
    try {
      let clsValue = 0;
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
            this.updateMetrics({ cls: clsValue });
          }
        });
      });
      observer.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(observer);
    } catch (error) {
      console.warn('CLS observer not supported:', error);
    }
  }

  private startRuntimeMonitoring(): void {
    let frameCount = 0;
    let lastTime = performance.now();
    let frameDrops = 0;

    const measureFrame = () => {
      if (!this.isMonitoring) return;

      const currentTime = performance.now();
      const deltaTime = currentTime - lastTime;
      
      frameCount++;
      
      // Calculate FPS every second
      if (deltaTime >= 1000) {
        const fps = (frameCount * 1000) / deltaTime;
        
        // Count frame drops (below 55fps)
        if (fps < 55) {
          frameDrops++;
        }

        this.updateMetrics({
          fps,
          frameDrops,
          renderTime: deltaTime / frameCount,
        });

        frameCount = 0;
        lastTime = currentTime;
      }

      requestAnimationFrame(measureFrame);
    };

    requestAnimationFrame(measureFrame);
  }

  private startInteractionMonitoring(): void {
    let interactionStart = 0;

    // Monitor click interactions
    document.addEventListener('click', () => {
      interactionStart = performance.now();
    });

    // Monitor interaction completion
    document.addEventListener('click', () => {
      if (interactionStart) {
        const latency = performance.now() - interactionStart;
        this.updateMetrics({ interactionLatency: latency });
      }
    }, true);

    // Monitor scroll performance
    let scrollStart = 0;
    document.addEventListener('scroll', () => {
      scrollStart = performance.now();
    });

    document.addEventListener('scroll', () => {
      if (scrollStart) {
        const scrollTime = performance.now() - scrollStart;
        this.updateMetrics({ scrollPerformance: scrollTime });
      }
    }, true);
  }

  private getCurrentFPS(): number {
    // This would be updated by the frame monitoring
    const recent = this.metrics.slice(-5);
    if (recent.length === 0) return 60;
    
    const avgFps = recent.reduce((sum, m) => sum + m.fps, 0) / recent.length;
    return avgFps;
  }

  private getFrameDrops(): number {
    const recent = this.metrics.slice(-10);
    return recent.reduce((sum, m) => sum + m.frameDrops, 0);
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    return 0;
  }

  private getRenderTime(): number {
    const recent = this.metrics.slice(-5);
    if (recent.length === 0) return 16;
    
    const avgRenderTime = recent.reduce((sum, m) => sum + m.renderTime, 0) / recent.length;
    return avgRenderTime;
  }

  private getComponentCount(): number {
    // Approximate component count
    const reactElements = document.querySelectorAll('[data-reactroot], [data-react-component]');
    return reactElements.length;
  }

  private getAnimationCount(): number {
    // Approximate animation count
    const animatedElements = document.querySelectorAll('[data-framer-motion], .animate-*');
    return animatedElements.length;
  }

  private getInteractionLatency(): number {
    const recent = this.metrics.slice(-5);
    if (recent.length === 0) return 50;
    
    const avgLatency = recent.reduce((sum, m) => sum + m.interactionLatency, 0) / recent.length;
    return avgLatency;
  }

  private getScrollPerformance(): number {
    const recent = this.metrics.slice(-5);
    if (recent.length === 0) return 16;
    
    const avgScroll = recent.reduce((sum, m) => sum + m.scrollPerformance, 0) / recent.length;
    return avgScroll;
  }

  private updateMetrics(partialMetrics: Partial<PerformanceMetrics>): void {
    const currentMetrics = this.getCurrentMetrics();
    const updatedMetrics = { ...currentMetrics, ...partialMetrics };
    
    this.metrics.push(updatedMetrics);
    
    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    // Notify callbacks
    this.callbacks.forEach(callback => callback(updatedMetrics));
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for performance monitoring
export function usePerformanceMonitoring() {
  const [metrics, setMetrics] = React.useState<PerformanceMetrics | null>(null);
  const [isOptimal, setIsOptimal] = React.useState(true);

  React.useEffect(() => {
    performanceMonitor.start();
    
    const unsubscribe = performanceMonitor.onMetricsUpdate((newMetrics) => {
      setMetrics(newMetrics);
      
      // Check if performance is optimal
      const score = performanceMonitor.getPerformanceScore();
      setIsOptimal(score >= 80);
    });

    return () => {
      unsubscribe();
      performanceMonitor.stop();
    };
  }, []);

  return {
    metrics,
    isOptimal,
    score: performanceMonitor.getPerformanceScore(),
    suggestions: performanceMonitor.getOptimizationSuggestions(),
    history: performanceMonitor.getMetricsHistory(),
  };
}