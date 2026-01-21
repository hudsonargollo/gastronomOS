/**
 * Animation Configuration System
 * Provides centralized animation settings and performance monitoring
 */

import { Transition, Variants } from 'framer-motion';

// Performance monitoring interface
export interface AnimationPerformance {
  fps: number;
  frameDrops: number;
  memoryUsage: number;
  lastMeasurement: number;
  renderTime?: number;
}

// Animation configuration interface
export interface AnimationConfig {
  duration: number;
  easing: string;
  stiffness?: number;
  damping?: number;
  mass?: number;
  reducedMotion: boolean;
  performanceMode: 'high' | 'medium' | 'low';
  maxConcurrentAnimations?: number;
}

// Global animation configuration
export const defaultAnimationConfig: AnimationConfig = {
  duration: 0.3,
  easing: 'easeInOut',
  stiffness: 100,
  damping: 15,
  mass: 1,
  reducedMotion: false,
  performanceMode: 'high',
  maxConcurrentAnimations: 10,
};

// Performance monitoring state
let performanceState: AnimationPerformance = {
  fps: 60,
  frameDrops: 0,
  memoryUsage: 0,
  lastMeasurement: Date.now(),
  renderTime: 0,
};

// Performance monitoring utilities
export class AnimationPerformanceMonitor {
  private frameCount = 0;
  private lastTime = performance.now();
  private animationFrame: number | null = null;
  private isMonitoring = false;

  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.measureFrameRate();
  }

  stopMonitoring() {
    this.isMonitoring = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  private measureFrameRate = () => {
    if (!this.isMonitoring) return;

    const currentTime = performance.now();
    this.frameCount++;

    // Calculate FPS every second
    if (currentTime - this.lastTime >= 1000) {
      const fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
      
      performanceState = {
        ...performanceState,
        fps,
        frameDrops: fps < 55 ? performanceState.frameDrops + 1 : performanceState.frameDrops,
        lastMeasurement: currentTime,
      };

      // Auto-adjust performance mode based on FPS
      if (fps < 30) {
        this.adjustPerformanceMode('low');
      } else if (fps < 50) {
        this.adjustPerformanceMode('medium');
      }

      this.frameCount = 0;
      this.lastTime = currentTime;
    }

    this.animationFrame = requestAnimationFrame(this.measureFrameRate);
  };

  private adjustPerformanceMode(mode: 'high' | 'medium' | 'low') {
    defaultAnimationConfig.performanceMode = mode;
    
    // Adjust animation settings based on performance
    switch (mode) {
      case 'low':
        defaultAnimationConfig.duration = 0.15;
        break;
      case 'medium':
        defaultAnimationConfig.duration = 0.2;
        break;
      case 'high':
        defaultAnimationConfig.duration = 0.3;
        break;
    }
  }

  getPerformanceState(): AnimationPerformance {
    return { ...performanceState };
  }
}

// Global performance monitor instance
export const performanceMonitor = new AnimationPerformanceMonitor();

// Utility to get optimized transition based on performance
export function getOptimizedTransition(customDuration?: number): Transition {
  const config = defaultAnimationConfig;
  
  if (config.reducedMotion) {
    return { duration: 0 };
  }

  const duration = customDuration || config.duration;
  
  return {
    duration,
    ease: config.easing,
    type: 'tween',
  };
}

// Utility to get spring transition
export function getSpringTransition(customConfig?: Partial<AnimationConfig>): Transition {
  const config = { ...defaultAnimationConfig, ...customConfig };
  
  if (config.reducedMotion) {
    return { duration: 0 };
  }

  return {
    type: 'spring',
    stiffness: config.stiffness,
    damping: config.damping,
    mass: config.mass,
  };
}

// Check for reduced motion preference
export function checkReducedMotionPreference(): boolean {
  if (typeof window === 'undefined') return false;
  
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  return mediaQuery.matches;
}

// Initialize animation system
export function initializeAnimationSystem() {
  if (typeof window === 'undefined') return;
  
  // Check for reduced motion preference
  defaultAnimationConfig.reducedMotion = checkReducedMotionPreference();
  
  // Listen for changes in motion preference
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  mediaQuery.addEventListener('change', (e) => {
    defaultAnimationConfig.reducedMotion = e.matches;
  });

  // Start performance monitoring
  performanceMonitor.startMonitoring();
}