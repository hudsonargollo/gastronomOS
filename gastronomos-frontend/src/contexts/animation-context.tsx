/**
 * Animation Context
 * Provides animation configuration and performance monitoring throughout the app
 */

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeAnimationSystem, AnimationConfig, defaultAnimationConfig } from '@/lib/animation-config';
import { useAnimationPerformance } from '@/hooks/use-animation-performance';

interface AnimationContextType {
  config: AnimationConfig;
  updateConfig: (newConfig: Partial<AnimationConfig>) => void;
  performance: ReturnType<typeof useAnimationPerformance>;
  isInitialized: boolean;
}

const AnimationContext = createContext<AnimationContextType | undefined>(undefined);

export function useAnimation() {
  const context = useContext(AnimationContext);
  if (!context) {
    throw new Error('useAnimation must be used within an AnimationProvider');
  }
  return context;
}

interface AnimationProviderProps {
  children: React.ReactNode;
  initialConfig?: Partial<AnimationConfig>;
}

export function AnimationProvider({ children, initialConfig }: AnimationProviderProps) {
  const [config, setConfig] = useState<AnimationConfig>(() => ({
    ...defaultAnimationConfig,
    ...initialConfig,
  }));
  const [isInitialized, setIsInitialized] = useState(false);

  const performance = useAnimationPerformance({
    autoStart: true,
    onPerformanceChange: (perf) => {
      // Auto-adjust configuration based on performance
      if (perf.fps < 30 && config.performanceMode !== 'low') {
        updateConfig({ performanceMode: 'low', duration: 0.15 });
      } else if (perf.fps > 50 && config.performanceMode === 'low') {
        updateConfig({ performanceMode: 'medium', duration: 0.2 });
      } else if (perf.fps > 55 && config.performanceMode === 'medium') {
        updateConfig({ performanceMode: 'high', duration: 0.3 });
      }
    },
  });

  const updateConfig = (newConfig: Partial<AnimationConfig>) => {
    setConfig(prev => {
      const updated = { ...prev, ...newConfig };
      
      // Update the global config
      Object.assign(defaultAnimationConfig, updated);
      
      return updated;
    });
  };

  useEffect(() => {
    // Initialize the animation system
    initializeAnimationSystem();
    setIsInitialized(true);

    // Listen for reduced motion changes
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e: MediaQueryListEvent) => {
      updateConfig({ reducedMotion: e.matches });
    };

    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  // Update global config when local config changes
  useEffect(() => {
    Object.assign(defaultAnimationConfig, config);
  }, [config]);

  const contextValue: AnimationContextType = {
    config,
    updateConfig,
    performance,
    isInitialized,
  };

  return (
    <AnimationContext.Provider value={contextValue}>
      {children}
    </AnimationContext.Provider>
  );
}

// Hook for accessing animation configuration
export function useAnimationConfig() {
  const { config, updateConfig } = useAnimation();
  return { config, updateConfig };
}

// Hook for accessing performance monitoring
export function useAnimationPerformanceContext() {
  const { performance } = useAnimation();
  return performance;
}

// Hook for checking if animations should be reduced
export function useReducedMotion() {
  const { config } = useAnimation();
  return config.reducedMotion;
}