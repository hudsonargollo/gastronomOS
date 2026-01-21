/**
 * Design Tokens
 * Centralized design system tokens for colors, typography, spacing, and more
 */

// Color tokens
export const colors = {
  // Primary colors
  primary: {
    50: 'oklch(0.985 0.002 285.885)',
    100: 'oklch(0.967 0.004 286.375)',
    200: 'oklch(0.92 0.008 286.32)',
    300: 'oklch(0.828 0.016 286.067)',
    400: 'oklch(0.705 0.024 285.938)',
    500: 'oklch(0.552 0.032 285.938)', // Base primary
    600: 'oklch(0.398 0.024 285.885)',
    700: 'oklch(0.274 0.016 286.033)',
    800: 'oklch(0.21 0.008 285.885)',
    900: 'oklch(0.141 0.004 285.823)',
    950: 'oklch(0.08 0.002 285.823)',
  },
  
  // Semantic colors
  semantic: {
    success: {
      light: 'oklch(0.828 0.189 84.429)',
      base: 'oklch(0.646 0.222 41.116)',
      dark: 'oklch(0.498 0.189 41.116)',
    },
    warning: {
      light: 'oklch(0.869 0.188 70.08)',
      base: 'oklch(0.769 0.188 70.08)',
      dark: 'oklch(0.669 0.188 70.08)',
    },
    error: {
      light: 'oklch(0.704 0.191 22.216)',
      base: 'oklch(0.577 0.245 27.325)',
      dark: 'oklch(0.477 0.245 27.325)',
    },
    info: {
      light: 'oklch(0.696 0.17 162.48)',
      base: 'oklch(0.6 0.118 184.704)',
      dark: 'oklch(0.5 0.118 184.704)',
    },
  },
  
  // Neutral colors
  neutral: {
    0: 'oklch(1 0 0)', // Pure white
    50: 'oklch(0.985 0 0)',
    100: 'oklch(0.967 0.001 286.375)',
    200: 'oklch(0.92 0.004 286.32)',
    300: 'oklch(0.828 0.008 286.067)',
    400: 'oklch(0.705 0.015 286.067)',
    500: 'oklch(0.552 0.016 285.938)',
    600: 'oklch(0.398 0.012 285.885)',
    700: 'oklch(0.274 0.006 286.033)',
    800: 'oklch(0.21 0.006 285.885)',
    900: 'oklch(0.141 0.005 285.823)',
    950: 'oklch(0.08 0.003 285.823)',
    1000: 'oklch(0 0 0)', // Pure black
  },
  
  // Chart colors
  chart: {
    1: 'oklch(0.646 0.222 41.116)',
    2: 'oklch(0.6 0.118 184.704)',
    3: 'oklch(0.398 0.07 227.392)',
    4: 'oklch(0.828 0.189 84.429)',
    5: 'oklch(0.769 0.188 70.08)',
  },
} as const;

// Typography tokens
export const typography = {
  fontFamily: {
    sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
    mono: ['var(--font-geist-mono)', 'Menlo', 'Monaco', 'monospace'],
  },
  
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }],
    xl: ['1.25rem', { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem', { lineHeight: '2rem' }],
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
    '5xl': ['3rem', { lineHeight: '1' }],
    '6xl': ['3.75rem', { lineHeight: '1' }],
  },
  
  fontWeight: {
    thin: '100',
    extralight: '200',
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
    black: '900',
  },
  
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0em',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
  
  lineHeight: {
    none: '1',
    tight: '1.25',
    snug: '1.375',
    normal: '1.5',
    relaxed: '1.625',
    loose: '2',
  },
} as const;

// Spacing tokens
export const spacing = {
  0: '0px',
  px: '1px',
  0.5: '0.125rem',
  1: '0.25rem',
  1.5: '0.375rem',
  2: '0.5rem',
  2.5: '0.625rem',
  3: '0.75rem',
  3.5: '0.875rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  7: '1.75rem',
  8: '2rem',
  9: '2.25rem',
  10: '2.5rem',
  11: '2.75rem',
  12: '3rem',
  14: '3.5rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
  28: '7rem',
  32: '8rem',
  36: '9rem',
  40: '10rem',
  44: '11rem',
  48: '12rem',
  52: '13rem',
  56: '14rem',
  60: '15rem',
  64: '16rem',
  72: '18rem',
  80: '20rem',
  96: '24rem',
} as const;

// Border radius tokens
export const borderRadius = {
  none: '0px',
  sm: 'calc(var(--radius) - 4px)',
  base: 'calc(var(--radius) - 2px)',
  md: 'var(--radius)',
  lg: 'calc(var(--radius) + 2px)',
  xl: 'calc(var(--radius) + 4px)',
  '2xl': 'calc(var(--radius) + 8px)',
  '3xl': 'calc(var(--radius) + 12px)',
  full: '9999px',
} as const;

// Shadow tokens
export const shadows = {
  xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  base: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  md: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  lg: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  xl: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  '2xl': '0 50px 100px -20px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
} as const;

// Animation tokens
export const animation = {
  duration: {
    fast: '150ms',
    normal: '250ms',
    slow: '350ms',
    slower: '500ms',
  },
  
  easing: {
    linear: 'linear',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    elastic: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  },
  
  spring: {
    gentle: { stiffness: 120, damping: 14 },
    wobbly: { stiffness: 180, damping: 12 },
    stiff: { stiffness: 400, damping: 30 },
    slow: { stiffness: 280, damping: 60 },
    molasses: { stiffness: 280, damping: 120 },
  },
} as const;

// Breakpoint tokens
export const breakpoints = {
  xs: '475px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// Z-index tokens
export const zIndex = {
  hide: -1,
  auto: 'auto',
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  skipLink: 1600,
  toast: 1700,
  tooltip: 1800,
} as const;

// Component size tokens
export const componentSizes = {
  button: {
    sm: { height: '2rem', padding: '0 0.75rem', fontSize: '0.875rem' },
    base: { height: '2.25rem', padding: '0 1rem', fontSize: '0.875rem' },
    lg: { height: '2.5rem', padding: '0 1.5rem', fontSize: '1rem' },
    xl: { height: '3rem', padding: '0 2rem', fontSize: '1.125rem' },
  },
  
  input: {
    sm: { height: '2rem', padding: '0 0.75rem', fontSize: '0.875rem' },
    base: { height: '2.25rem', padding: '0 0.75rem', fontSize: '0.875rem' },
    lg: { height: '2.5rem', padding: '0 1rem', fontSize: '1rem' },
    xl: { height: '3rem', padding: '0 1rem', fontSize: '1.125rem' },
  },
  
  avatar: {
    xs: '1.5rem',
    sm: '2rem',
    base: '2.5rem',
    lg: '3rem',
    xl: '4rem',
    '2xl': '5rem',
  },
  
  icon: {
    xs: '0.75rem',
    sm: '1rem',
    base: '1.25rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '2.5rem',
  },
} as const;

// Accessibility tokens
export const accessibility = {
  focusRing: {
    width: '3px',
    offset: '2px',
    color: 'var(--ring)',
    style: 'solid',
  },
  
  minTouchTarget: '44px',
  
  contrast: {
    aa: 4.5,
    aaa: 7,
  },
  
  motion: {
    reducedMotion: 'prefers-reduced-motion: reduce',
  },
} as const;

// Export all tokens as a single object for easy access
export const designTokens = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  animation,
  breakpoints,
  zIndex,
  componentSizes,
  accessibility,
} as const;

// Type exports for TypeScript support
export type ColorToken = keyof typeof colors.primary;
export type SpacingToken = keyof typeof spacing;
export type FontSizeToken = keyof typeof typography.fontSize;
export type FontWeightToken = keyof typeof typography.fontWeight;
export type BorderRadiusToken = keyof typeof borderRadius;
export type ShadowToken = keyof typeof shadows;
export type BreakpointToken = keyof typeof breakpoints;
export type ZIndexToken = keyof typeof zIndex;