/**
 * Pontal Stock Component Design System
 * Consolidated button, spacing, and layout utilities
 */

/**
 * Spacing Scale (in rem)
 * Based on 4px base unit
 */
export const spacing = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '2.5rem', // 40px
  '3xl': '3rem',   // 48px
  '4xl': '4rem',   // 64px
} as const;

/**
 * Button Styles - Consolidated
 */
export const buttonStyles = {
  base: `
    inline-flex items-center justify-center
    font-medium rounded-lg
    transition-all duration-200 ease-in-out
    focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
  `,
  
  // Size variants
  sizes: {
    sm: `px-3 py-1.5 text-sm gap-2`,
    md: `px-4 py-2 text-base gap-2`,
    lg: `px-6 py-3 text-lg gap-2`,
    xl: `px-8 py-4 text-xl gap-3`,
  },
  
  // Color variants
  variants: {
    primary: `
      bg-[#2d5016] text-white
      hover:bg-[#1f3810] active:bg-[#152609]
      focus:ring-[#2d5016]
      shadow-sm hover:shadow-md
    `,
    secondary: `
      bg-[#ea580c] text-white
      hover:bg-[#d14a08] active:bg-[#b83c06]
      focus:ring-[#ea580c]
      shadow-sm hover:shadow-md
    `,
    accent: `
      bg-[#f4a460] text-white
      hover:bg-[#e89450] active:bg-[#dc8440]
      focus:ring-[#f4a460]
      shadow-sm hover:shadow-md
    `,
    outline: `
      border-2 border-[#2d5016] text-[#2d5016]
      hover:bg-[#2d5016] hover:text-white
      active:bg-[#1f3810]
      focus:ring-[#2d5016]
    `,
    ghost: `
      text-[#2d5016]
      hover:bg-[#2d501610]
      active:bg-[#2d501620]
      focus:ring-[#2d5016]
    `,
    danger: `
      bg-red-600 text-white
      hover:bg-red-700 active:bg-red-800
      focus:ring-red-600
      shadow-sm hover:shadow-md
    `,
  },
} as const;

/**
 * Card Styles - Consolidated
 */
export const cardStyles = {
  base: `
    bg-white rounded-lg
    border border-gray-200
    shadow-sm hover:shadow-md
    transition-shadow duration-200
  `,
  
  padding: {
    sm: `p-3`,
    md: `p-4`,
    lg: `p-6`,
    xl: `p-8`,
  },
} as const;

/**
 * Modal/Dialog Styles
 */
export const modalStyles = {
  overlay: `
    fixed inset-0
    bg-black/50 backdrop-blur-sm
    z-40
    transition-opacity duration-200
  `,
  
  content: `
    fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
    bg-white rounded-xl
    shadow-2xl
    z-50
    max-w-2xl w-full mx-4
    max-h-[90vh] overflow-y-auto
  `,
  
  header: `
    flex items-center justify-between
    p-6 border-b border-gray-200
  `,
  
  body: `
    p-6
  `,
  
  footer: `
    flex items-center justify-end gap-3
    p-6 border-t border-gray-200
    bg-gray-50
  `,
} as const;

/**
 * Input Styles - Consolidated
 */
export const inputStyles = {
  base: `
    w-full px-4 py-2
    border border-gray-300 rounded-lg
    font-medium text-base
    transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2d5016]
    focus:border-[#2d5016]
    disabled:bg-gray-100 disabled:cursor-not-allowed
    placeholder:text-gray-400
  `,
  
  error: `
    border-red-500 focus:ring-red-500 focus:border-red-500
  `,
  
  success: `
    border-green-500 focus:ring-green-500 focus:border-green-500
  `,
} as const;

/**
 * Layout Utilities
 */
export const layout = {
  container: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`,
  
  flexCenter: `flex items-center justify-center`,
  flexBetween: `flex items-center justify-between`,
  flexCol: `flex flex-col`,
  
  gridCols: {
    1: `grid grid-cols-1`,
    2: `grid grid-cols-1 sm:grid-cols-2`,
    3: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`,
    4: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`,
  },
  
  gap: {
    sm: `gap-2`,
    md: `gap-4`,
    lg: `gap-6`,
    xl: `gap-8`,
  },
} as const;

/**
 * Typography Utilities
 */
export const typography = {
  h1: `text-4xl font-bold text-[#1c2912]`,
  h2: `text-3xl font-bold text-[#1c2912]`,
  h3: `text-2xl font-bold text-[#1c2912]`,
  h4: `text-xl font-bold text-[#1c2912]`,
  h5: `text-lg font-bold text-[#1c2912]`,
  h6: `text-base font-bold text-[#1c2912]`,
  
  body: `text-base text-[#1c2912]`,
  bodySmall: `text-sm text-[#5a6b3d]`,
  bodyXSmall: `text-xs text-[#5a6b3d]`,
  
  label: `text-sm font-medium text-[#1c2912]`,
  caption: `text-xs text-[#5a6b3d]`,
} as const;

/**
 * Shadow Utilities
 */
export const shadows = {
  sm: `shadow-sm`,
  md: `shadow-md`,
  lg: `shadow-lg`,
  xl: `shadow-xl`,
  '2xl': `shadow-2xl`,
  none: `shadow-none`,
} as const;

/**
 * Border Radius Utilities
 */
export const borderRadius = {
  sm: `rounded-sm`,
  md: `rounded-md`,
  lg: `rounded-lg`,
  xl: `rounded-xl`,
  '2xl': `rounded-2xl`,
  full: `rounded-full`,
} as const;

/**
 * Transition Utilities
 */
export const transitions = {
  fast: `transition-all duration-150 ease-in-out`,
  normal: `transition-all duration-200 ease-in-out`,
  slow: `transition-all duration-300 ease-in-out`,
} as const;

/**
 * Utility function to combine button classes
 */
export function getButtonClasses(
  size: keyof typeof buttonStyles.sizes = 'md',
  variant: keyof typeof buttonStyles.variants = 'primary'
): string {
  return `${buttonStyles.base} ${buttonStyles.sizes[size]} ${buttonStyles.variants[variant]}`;
}

/**
 * Utility function to combine card classes
 */
export function getCardClasses(
  padding: keyof typeof cardStyles.padding = 'md'
): string {
  return `${cardStyles.base} ${cardStyles.padding[padding]}`;
}

/**
 * Utility function to combine input classes
 */
export function getInputClasses(
  hasError: boolean = false,
  hasSuccess: boolean = false
): string {
  let classes = inputStyles.base;
  if (hasError) classes += ` ${inputStyles.error}`;
  if (hasSuccess) classes += ` ${inputStyles.success}`;
  return classes;
}
