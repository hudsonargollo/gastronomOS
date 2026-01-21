/**
 * Theme Context and Provider
 * Provides unified theming system with consistent styling rules
 */

'use client';

import * as React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { ThemeProvider as NextThemeProvider } from 'next-themes';
import { designTokens } from '@/lib/design-tokens';

// Theme configuration interface
interface ThemeConfig {
  colors: typeof designTokens.colors;
  typography: typeof designTokens.typography;
  spacing: typeof designTokens.spacing;
  borderRadius: typeof designTokens.borderRadius;
  shadows: typeof designTokens.shadows;
  animation: typeof designTokens.animation;
  breakpoints: typeof designTokens.breakpoints;
  zIndex: typeof designTokens.zIndex;
  componentSizes: typeof designTokens.componentSizes;
  accessibility: typeof designTokens.accessibility;
}

// Theme context interface
interface ThemeContextType {
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  resolvedTheme: 'light' | 'dark';
  tokens: ThemeConfig;
  // Utility functions
  getColor: (path: string) => string;
  getSpacing: (size: keyof typeof designTokens.spacing) => string;
  getFontSize: (size: keyof typeof designTokens.typography.fontSize) => readonly [string, { readonly lineHeight: string }];
  getShadow: (size: keyof typeof designTokens.shadows) => string;
  // Responsive utilities
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  // Animation preferences
  prefersReducedMotion: boolean;
}

// Create theme context
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Theme provider props
interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: 'light' | 'dark' | 'system';
  storageKey?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}

// Custom hook to use theme context
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Utility function to get nested object values by path
function getNestedValue(obj: any, path: string): string {
  return path.split('.').reduce((current, key) => current?.[key], obj) || '';
}

// Hook for responsive breakpoints
function useResponsive() {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowSize.width < parseInt(designTokens.breakpoints.md);
  const isTablet = windowSize.width >= parseInt(designTokens.breakpoints.md) && 
                   windowSize.width < parseInt(designTokens.breakpoints.lg);
  const isDesktop = windowSize.width >= parseInt(designTokens.breakpoints.lg);

  return { isMobile, isTablet, isDesktop };
}

// Hook for motion preferences
function useMotionPreferences() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return { prefersReducedMotion };
}

// Theme provider component
export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'gastronomos-theme',
  enableSystem = true,
  disableTransitionOnChange = false,
  ...props
}: ThemeProviderProps) {
  const [mounted, setMounted] = useState(false);
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const { prefersReducedMotion } = useMotionPreferences();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Utility functions for accessing design tokens
  const getColor = (path: string): string => {
    return getNestedValue(designTokens.colors, path);
  };

  const getSpacing = (size: keyof typeof designTokens.spacing): string => {
    return designTokens.spacing[size];
  };

  const getFontSize = (size: keyof typeof designTokens.typography.fontSize): readonly [string, { readonly lineHeight: string }] => {
    return designTokens.typography.fontSize[size];
  };

  const getShadow = (size: keyof typeof designTokens.shadows): string => {
    return designTokens.shadows[size];
  };

  if (!mounted) {
    return null;
  }

  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme={defaultTheme}
      storageKey={storageKey}
      enableSystem={enableSystem}
      disableTransitionOnChange={disableTransitionOnChange}
      {...props}
    >
      <ThemeProviderInner
        getColor={getColor}
        getSpacing={getSpacing}
        getFontSize={getFontSize}
        getShadow={getShadow}
        isMobile={isMobile}
        isTablet={isTablet}
        isDesktop={isDesktop}
        prefersReducedMotion={prefersReducedMotion}
      >
        {children}
      </ThemeProviderInner>
    </NextThemeProvider>
  );
}

// Inner theme provider to access next-themes context
function ThemeProviderInner({
  children,
  getColor,
  getSpacing,
  getFontSize,
  getShadow,
  isMobile,
  isTablet,
  isDesktop,
  prefersReducedMotion,
}: {
  children: React.ReactNode;
  getColor: (path: string) => string;
  getSpacing: (size: keyof typeof designTokens.spacing) => string;
  getFontSize: (size: keyof typeof designTokens.typography.fontSize) => readonly [string, { readonly lineHeight: string }];
  getShadow: (size: keyof typeof designTokens.shadows) => string;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  prefersReducedMotion: boolean;
}) {
  const [theme, setTheme] = React.useState<'light' | 'dark' | 'system'>('system');
  const [resolvedTheme, setResolvedTheme] = React.useState<'light' | 'dark'>('light');

  // Simple theme resolution for now - in production, this would use next-themes
  React.useEffect(() => {
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');
      
      const handleChange = (e: MediaQueryListEvent) => {
        setResolvedTheme(e.matches ? 'dark' : 'light');
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      setResolvedTheme(theme as 'light' | 'dark');
    }
  }, [theme]);

  const contextValue: ThemeContextType = {
    theme,
    setTheme,
    resolvedTheme,
    tokens: designTokens,
    getColor,
    getSpacing,
    getFontSize,
    getShadow,
    isMobile,
    isTablet,
    isDesktop,
    prefersReducedMotion,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

// CSS-in-JS style generator utilities
export const createStyles = {
  // Generate responsive styles
  responsive: (styles: {
    mobile?: React.CSSProperties;
    tablet?: React.CSSProperties;
    desktop?: React.CSSProperties;
  }) => {
    return {
      [`@media (max-width: ${designTokens.breakpoints.md})`]: styles.mobile || {},
      [`@media (min-width: ${designTokens.breakpoints.md}) and (max-width: ${designTokens.breakpoints.lg})`]: styles.tablet || {},
      [`@media (min-width: ${designTokens.breakpoints.lg})`]: styles.desktop || {},
    };
  },

  // Generate focus styles
  focus: (color: string = 'var(--ring)') => ({
    outline: 'none',
    boxShadow: `0 0 0 ${designTokens.accessibility.focusRing.width} ${color}`,
  }),

  // Generate hover styles with animation
  hover: (styles: React.CSSProperties, duration: string = designTokens.animation.duration.fast) => ({
    transition: `all ${duration} ${designTokens.animation.easing.out}`,
    '&:hover': styles,
  }),

  // Generate disabled styles
  disabled: () => ({
    opacity: 0.6,
    pointerEvents: 'none' as const,
    cursor: 'not-allowed',
  }),

  // Generate loading styles
  loading: () => ({
    opacity: 0.7,
    pointerEvents: 'none' as const,
    cursor: 'wait',
  }),
};

// Theme-aware component wrapper
export function withTheme<P extends object>(
  Component: React.ComponentType<P & { theme: ThemeContextType }>
) {
  return function ThemedComponent(props: P) {
    const theme = useTheme();
    return <Component {...props} theme={theme} />;
  };
}

// Export design tokens for direct access
export { designTokens };