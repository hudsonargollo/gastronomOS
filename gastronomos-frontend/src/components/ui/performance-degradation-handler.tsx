/**
 * Performance Degradation Handler
 * Implements graceful degradation for performance issues
 */

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAnimationPerformance } from '@/hooks/use-animation-performance';
import { useAnimation } from '@/contexts/animation-context';
import { AlertTriangle, Zap, Settings } from 'lucide-react';
import { Button } from './button';
import { Card } from './card';
import { Badge } from './badge';
import { Switch } from './switch';

// Performance degradation levels
export type PerformanceDegradationLevel = 'none' | 'minimal' | 'moderate' | 'severe';

// Performance thresholds for degradation
export interface PerformanceThresholds {
  fps: {
    minimal: number;    // Below this, apply minimal degradation
    moderate: number;   // Below this, apply moderate degradation
    severe: number;     // Below this, apply severe degradation
  };
  memory: {
    minimal: number;    // Above this, apply minimal degradation (MB)
    moderate: number;   // Above this, apply moderate degradation (MB)
    severe: number;     // Above this, apply severe degradation (MB)
  };
  renderTime: {
    minimal: number;    // Above this, apply minimal degradation (ms)
    moderate: number;   // Above this, apply moderate degradation (ms)
    severe: number;     // Above this, apply severe degradation (ms)
  };
}

const defaultThresholds: PerformanceThresholds = {
  fps: { minimal: 50, moderate: 30, severe: 15 },
  memory: { minimal: 100, moderate: 200, severe: 300 },
  renderTime: { minimal: 20, moderate: 50, severe: 100 },
};

// Degradation strategies for different levels
export interface DegradationStrategies {
  minimal: {
    reduceAnimationDuration: boolean;
    simplifyTransitions: boolean;
    disableParallax: boolean;
  };
  moderate: {
    disableComplexAnimations: boolean;
    reduceParticleEffects: boolean;
    limitConcurrentAnimations: boolean;
    enableVirtualScrolling: boolean;
  };
  severe: {
    disableAllAnimations: boolean;
    staticFallbacks: boolean;
    aggressiveCleanup: boolean;
    minimalRendering: boolean;
  };
}

const defaultStrategies: DegradationStrategies = {
  minimal: {
    reduceAnimationDuration: true,
    simplifyTransitions: true,
    disableParallax: true,
  },
  moderate: {
    disableComplexAnimations: true,
    reduceParticleEffects: true,
    limitConcurrentAnimations: true,
    enableVirtualScrolling: true,
  },
  severe: {
    disableAllAnimations: true,
    staticFallbacks: true,
    aggressiveCleanup: true,
    minimalRendering: true,
  },
};

// Performance degradation state
interface PerformanceDegradationState {
  level: PerformanceDegradationLevel;
  isActive: boolean;
  strategies: DegradationStrategies;
  thresholds: PerformanceThresholds;
  metrics: {
    fps: number;
    memory: number;
    renderTime: number;
  };
  history: Array<{
    timestamp: number;
    level: PerformanceDegradationLevel;
    trigger: string;
  }>;
  userOverride: boolean;
}

// Context for performance degradation
interface PerformanceDegradationContextType {
  state: PerformanceDegradationState;
  actions: {
    setLevel: (level: PerformanceDegradationLevel) => void;
    setUserOverride: (override: boolean) => void;
    updateThresholds: (thresholds: Partial<PerformanceThresholds>) => void;
    updateStrategies: (strategies: Partial<DegradationStrategies>) => void;
    reset: () => void;
  };
  utils: {
    shouldDegrade: (feature: string) => boolean;
    getDegradedValue: <T>(normal: T, degraded: T, feature?: string) => T;
    isFeatureEnabled: (feature: string) => boolean;
  };
}

const PerformanceDegradationContext = createContext<PerformanceDegradationContextType | undefined>(undefined);

export function usePerformanceDegradation() {
  const context = useContext(PerformanceDegradationContext);
  if (!context) {
    throw new Error('usePerformanceDegradation must be used within a PerformanceDegradationProvider');
  }
  return context;
}

interface PerformanceDegradationProviderProps {
  children: ReactNode;
  thresholds?: Partial<PerformanceThresholds>;
  strategies?: Partial<DegradationStrategies>;
  autoDegrade?: boolean;
  showNotifications?: boolean;
}

export function PerformanceDegradationProvider({
  children,
  thresholds: customThresholds = {},
  strategies: customStrategies = {},
  autoDegrade = true,
  showNotifications = true,
}: PerformanceDegradationProviderProps) {
  const { performance } = useAnimationPerformance();
  const { updateConfig } = useAnimation();

  const [state, setState] = useState<PerformanceDegradationState>({
    level: 'none',
    isActive: false,
    strategies: { ...defaultStrategies, ...customStrategies },
    thresholds: { ...defaultThresholds, ...customThresholds },
    metrics: { fps: 60, memory: 0, renderTime: 0 },
    history: [],
    userOverride: false,
  });

  // Determine degradation level based on current metrics
  const calculateDegradationLevel = useCallback((
    fps: number,
    memory: number,
    renderTime: number
  ): PerformanceDegradationLevel => {
    const { thresholds } = state;

    // Check severe conditions first
    if (
      fps < thresholds.fps.severe ||
      memory > thresholds.memory.severe ||
      renderTime > thresholds.renderTime.severe
    ) {
      return 'severe';
    }

    // Check moderate conditions
    if (
      fps < thresholds.fps.moderate ||
      memory > thresholds.memory.moderate ||
      renderTime > thresholds.renderTime.moderate
    ) {
      return 'moderate';
    }

    // Check minimal conditions
    if (
      fps < thresholds.fps.minimal ||
      memory > thresholds.memory.minimal ||
      renderTime > thresholds.renderTime.minimal
    ) {
      return 'minimal';
    }

    return 'none';
  }, [state.thresholds]);

  // Apply degradation strategies
  const applyDegradationStrategies = useCallback((level: PerformanceDegradationLevel) => {
    const { strategies } = state;

    switch (level) {
      case 'minimal':
        if (strategies.minimal.reduceAnimationDuration) {
          updateConfig({ duration: 0.15 });
        }
        if (strategies.minimal.simplifyTransitions) {
          updateConfig({ easing: 'linear' });
        }
        break;

      case 'moderate':
        if (strategies.moderate.disableComplexAnimations) {
          updateConfig({ performanceMode: 'low' });
        }
        if (strategies.moderate.limitConcurrentAnimations) {
          updateConfig({ maxConcurrentAnimations: 3 });
        }
        break;

      case 'severe':
        if (strategies.severe.disableAllAnimations) {
          updateConfig({ reducedMotion: true, duration: 0 });
        }
        break;

      case 'none':
        // Reset to normal performance
        updateConfig({ 
          performanceMode: 'high',
          reducedMotion: false,
          duration: 0.3,
          easing: 'easeInOut',
        });
        break;
    }
  }, [state.strategies, updateConfig]);

  // Update performance metrics and degradation level
  useEffect(() => {
    if (!autoDegrade || state.userOverride) return;

    const fps = performance.fps || 60;
    const memory = performance.memoryUsage || 0;
    const renderTime = performance.renderTime || 0;

    const newLevel = calculateDegradationLevel(fps, memory, renderTime);
    
    setState(prevState => {
      if (newLevel !== prevState.level) {
        const newHistory = [
          ...prevState.history.slice(-9), // Keep last 9 entries
          {
            timestamp: Date.now(),
            level: newLevel,
            trigger: `fps: ${fps}, memory: ${memory}MB, render: ${renderTime}ms`,
          },
        ];

        return {
          ...prevState,
          level: newLevel,
          isActive: newLevel !== 'none',
          metrics: { fps, memory, renderTime },
          history: newHistory,
        };
      }

      return {
        ...prevState,
        metrics: { fps, memory, renderTime },
      };
    });

    // Apply strategies for the new level
    if (newLevel !== state.level) {
      applyDegradationStrategies(newLevel);
    }
  }, [performance, autoDegrade, state.userOverride, state.level, calculateDegradationLevel, applyDegradationStrategies]);

  // Context actions
  const actions = {
    setLevel: (level: PerformanceDegradationLevel) => {
      setState(prev => ({
        ...prev,
        level,
        isActive: level !== 'none',
        userOverride: true,
      }));
      applyDegradationStrategies(level);
    },

    setUserOverride: (override: boolean) => {
      setState(prev => ({ ...prev, userOverride: override }));
    },

    updateThresholds: (newThresholds: Partial<PerformanceThresholds>) => {
      setState(prev => ({
        ...prev,
        thresholds: { ...prev.thresholds, ...newThresholds },
      }));
    },

    updateStrategies: (newStrategies: Partial<DegradationStrategies>) => {
      setState(prev => ({
        ...prev,
        strategies: { ...prev.strategies, ...newStrategies },
      }));
    },

    reset: () => {
      setState(prev => ({
        ...prev,
        level: 'none',
        isActive: false,
        userOverride: false,
      }));
      applyDegradationStrategies('none');
    },
  };

  // Context utilities
  const utils = {
    shouldDegrade: (feature: string): boolean => {
      const { level, strategies } = state;
      
      switch (level) {
        case 'minimal':
          return (
            (feature === 'animations' && strategies.minimal.reduceAnimationDuration) ||
            (feature === 'transitions' && strategies.minimal.simplifyTransitions) ||
            (feature === 'parallax' && strategies.minimal.disableParallax)
          );
        
        case 'moderate':
          return (
            (feature === 'complex-animations' && strategies.moderate.disableComplexAnimations) ||
            (feature === 'particles' && strategies.moderate.reduceParticleEffects) ||
            (feature === 'concurrent-animations' && strategies.moderate.limitConcurrentAnimations) ||
            (feature === 'virtual-scrolling' && strategies.moderate.enableVirtualScrolling)
          );
        
        case 'severe':
          return (
            (feature === 'all-animations' && strategies.severe.disableAllAnimations) ||
            (feature === 'static-fallbacks' && strategies.severe.staticFallbacks) ||
            (feature === 'cleanup' && strategies.severe.aggressiveCleanup) ||
            (feature === 'minimal-rendering' && strategies.severe.minimalRendering)
          );
        
        default:
          return false;
      }
    },

    getDegradedValue: (normal: any, degraded: any, feature?: string): any => {
      if (state.level === 'none') return normal;
      if (feature && !utils.shouldDegrade(feature)) return normal;
      return degraded;
    },

    isFeatureEnabled: (feature: string): boolean => {
      return !utils.shouldDegrade(feature);
    },
  };

  const contextValue: PerformanceDegradationContextType = {
    state,
    actions,
    utils,
  };

  return (
    <PerformanceDegradationContext.Provider value={contextValue}>
      {children}
      {showNotifications && <PerformanceDegradationNotification />}
    </PerformanceDegradationContext.Provider>
  );
}

// Notification component for performance degradation
function PerformanceDegradationNotification() {
  const { state, actions } = usePerformanceDegradation();
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed state when degradation level changes
  useEffect(() => {
    setDismissed(false);
  }, [state.level]);

  if (!state.isActive || dismissed || state.userOverride) {
    return null;
  }

  const getLevelColor = (level: PerformanceDegradationLevel) => {
    switch (level) {
      case 'minimal': return 'text-yellow-600 border-yellow-500';
      case 'moderate': return 'text-orange-600 border-orange-500';
      case 'severe': return 'text-red-600 border-red-500';
      default: return 'text-gray-600 border-gray-500';
    }
  };

  const getLevelIcon = (level: PerformanceDegradationLevel) => {
    switch (level) {
      case 'minimal': return <Zap className="h-4 w-4" />;
      case 'moderate': return <Settings className="h-4 w-4" />;
      case 'severe': return <AlertTriangle className="h-4 w-4" />;
      default: return null;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed bottom-4 right-4 z-50 max-w-sm"
      >
        <Card className={`border-l-4 ${getLevelColor(state.level)}`}>
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className={`${getLevelColor(state.level)} mt-0.5`}>
                {getLevelIcon(state.level)}
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-sm">
                  Performance Mode: {state.level.charAt(0).toUpperCase() + state.level.slice(1)}
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Animations have been {state.level === 'severe' ? 'disabled' : 'reduced'} to improve performance.
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {Math.round(state.metrics.fps)} FPS
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {Math.round(state.metrics.memory)}MB
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDismissed(true)}
                className="h-6 text-xs"
              >
                Dismiss
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => actions.setUserOverride(true)}
                className="h-6 text-xs"
              >
                Keep Current
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

// Hook for conditional rendering based on performance
export function usePerformanceConditional() {
  const { utils } = usePerformanceDegradation();

  return {
    shouldRender: (feature: string) => utils.isFeatureEnabled(feature),
    getValue: (normal: any, degraded: any, feature?: string) => 
      utils.getDegradedValue(normal, degraded, feature),
    isEnabled: (feature: string) => utils.isFeatureEnabled(feature),
  };
}

// Component wrapper for performance-conditional rendering
interface PerformanceConditionalProps {
  children: ReactNode;
  feature: string;
  fallback?: ReactNode;
  degradedProps?: Record<string, any>;
}

export function PerformanceConditional({
  children,
  feature,
  fallback = null,
  degradedProps = {},
}: PerformanceConditionalProps) {
  const { utils } = usePerformanceDegradation();

  if (!utils.isFeatureEnabled(feature)) {
    return fallback;
  }

  // If children is a React element, clone it with degraded props
  if (React.isValidElement(children) && Object.keys(degradedProps).length > 0) {
    return React.cloneElement(children, degradedProps);
  }

  return <>{children}</>;
}

// Higher-order component for performance degradation
export function withPerformanceDegradation<P extends object>(
  Component: React.ComponentType<P>,
  feature: string,
  degradedProps?: Partial<P>
) {
  const WrappedComponent = (props: P) => {
    const { utils } = usePerformanceDegradation();

    if (!utils.isFeatureEnabled(feature)) {
      return null;
    }

    const finalProps = degradedProps 
      ? { ...props, ...degradedProps }
      : props;

    return <Component {...finalProps} />;
  };

  WrappedComponent.displayName = `withPerformanceDegradation(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}