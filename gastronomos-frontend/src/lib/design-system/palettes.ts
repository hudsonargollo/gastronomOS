/**
 * Color Palettes
 * Adaptive Gastronomy Design System - Five Signature Palettes
 */

import { ColorPalette, ThemeName } from './types';

export const colorPalettes: Record<ThemeName, ColorPalette> = {
  [ThemeName.BISTRO_NOIR]: {
    primary: '#1a1a1a',        // Deep charcoal
    secondary: '#4a4a4a',      // Warm gray
    accent: '#d4af37',         // Gold accent
    background: '#f5f5f0',     // Warm off-white
    surface: '#ffffff',        // Pure white
    text: '#1a1a1a',          // Deep charcoal
    textSecondary: '#6b6b6b', // Medium gray
  },
  
  [ThemeName.NEON_DINER]: {
    primary: '#ff006e',        // Hot pink
    secondary: '#8338ec',      // Electric purple
    accent: '#00f5ff',         // Cyan neon
    background: '#0a0a0a',     // Near black
    surface: '#1a1a1a',        // Dark surface
    text: '#ffffff',           // White text
    textSecondary: '#b0b0b0',  // Light gray
  },
  
  [ThemeName.ORGANIC_GARDEN]: {
    primary: '#2d5016',        // Deep forest green
    secondary: '#6b8e23',      // Olive green
    accent: '#f4a460',         // Sandy brown
    background: '#faf8f3',     // Cream
    surface: '#ffffff',        // White
    text: '#2d3319',          // Dark olive
    textSecondary: '#5a6b3d', // Muted green
  },
  
  [ThemeName.SIGNATURE]: {
    primary: '#ea580c',        // Orange (default)
    secondary: '#dc2626',      // Red
    accent: '#f97316',         // Light orange
    background: '#f8fafc',     // Slate
    surface: '#ffffff',        // White
    text: '#0f172a',          // Slate 900
    textSecondary: '#64748b', // Slate 500
  },

  // Pontal Stock - Maraú Sunset Palette
  [ThemeName.PONTAL_STOCK]: {
    primary: '#2d5016',        // Deep Forest Green (Palm Trees)
    secondary: '#ea580c',      // Sunset Orange (Branding Signature)
    accent: '#f4a460',         // Sandy Brown (Maraú Beaches)
    background: '#faf8f3',     // Warm Sea Foam (Off-white background)
    surface: '#ffffff',        // Pure White (Clean containers)
    text: '#1c2912',           // Dark Earth (High contrast text)
    textSecondary: '#5a6b3d',  // Muted Olive (Subtle text)
  },
};

/**
 * Pontal Stock Palette - Maraú Sunset
 * Inspired by the natural elements of Barra Grande
 */
export const PONTAL_STOCK_PALETTE: ColorPalette = colorPalettes[ThemeName.PONTAL_STOCK];

/**
 * Get palette by theme name
 */
export function getPalette(theme: ThemeName | string): ColorPalette {
  return colorPalettes[theme as ThemeName] || colorPalettes[ThemeName.PONTAL_STOCK];
}

/**
 * Merge custom colors with base palette
 */
export function mergeCustomColors(
  basePalette: ColorPalette,
  customColors?: Partial<ColorPalette>
): ColorPalette {
  if (!customColors) return basePalette;
  
  return {
    ...basePalette,
    ...customColors,
  };
}
