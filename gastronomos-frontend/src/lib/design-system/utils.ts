/**
 * Design System Utilities
 * Helper functions for working with the design system
 */

import { ColorPalette, ThemeName } from './types';

/**
 * Convert hex color to RGB values
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Calculate relative luminance for WCAG contrast calculations
 */
export function getRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((val) => {
    const normalized = val / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getRelativeLuminance(color1);
  const lum2 = getRelativeLuminance(color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if color combination meets WCAG AA standards
 */
export function meetsWCAGAA(foreground: string, background: string): boolean {
  const ratio = getContrastRatio(foreground, background);
  return ratio >= 4.5; // WCAG AA for normal text
}

/**
 * Check if color combination meets WCAG AAA standards
 */
export function meetsWCAGAAA(foreground: string, background: string): boolean {
  const ratio = getContrastRatio(foreground, background);
  return ratio >= 7; // WCAG AAA for normal text
}

/**
 * Validate color palette for accessibility
 */
export function validatePaletteAccessibility(palette: ColorPalette): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check text on background
  if (!meetsWCAGAA(palette.text, palette.background)) {
    issues.push('Text color does not meet WCAG AA contrast on background');
  }

  // Check text on surface
  if (!meetsWCAGAA(palette.text, palette.surface)) {
    issues.push('Text color does not meet WCAG AA contrast on surface');
  }

  // Check primary on background
  if (!meetsWCAGAA(palette.primary, palette.background)) {
    issues.push('Primary color may have insufficient contrast on background');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Get theme display name
 */
export function getThemeDisplayName(theme: ThemeName): string {
  const names: Record<ThemeName, string> = {
    [ThemeName.BISTRO_NOIR]: 'Bistro Noir',
    [ThemeName.NEON_DINER]: 'Neon Diner',
    [ThemeName.ORGANIC_GARDEN]: 'Organic Garden',
    [ThemeName.SIGNATURE]: 'Signature',
  };
  return names[theme];
}

/**
 * Get theme description
 */
export function getThemeDescription(theme: ThemeName): string {
  const descriptions: Record<ThemeName, string> = {
    [ThemeName.BISTRO_NOIR]: 'Elegant and sophisticated with deep charcoals and gold accents',
    [ThemeName.NEON_DINER]: 'Bold and vibrant with electric colors on dark backgrounds',
    [ThemeName.ORGANIC_GARDEN]: 'Natural and earthy with forest greens and warm tones',
    [ThemeName.SIGNATURE]: 'Classic and versatile with orange and red accents',
  };
  return descriptions[theme];
}

/**
 * Lighten a color by a percentage
 */
export function lightenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const r = Math.min(255, Math.floor(rgb.r + (255 - rgb.r) * (percent / 100)));
  const g = Math.min(255, Math.floor(rgb.g + (255 - rgb.g) * (percent / 100)));
  const b = Math.min(255, Math.floor(rgb.b + (255 - rgb.b) * (percent / 100)));

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Darken a color by a percentage
 */
export function darkenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const r = Math.max(0, Math.floor(rgb.r * (1 - percent / 100)));
  const g = Math.max(0, Math.floor(rgb.g * (1 - percent / 100)));
  const b = Math.max(0, Math.floor(rgb.b * (1 - percent / 100)));

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Generate a color with specific opacity
 */
export function withOpacity(hex: string, opacity: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}

/**
 * Check if a theme is dark
 */
export function isDarkTheme(theme: ThemeName): boolean {
  return theme === ThemeName.NEON_DINER;
}

/**
 * Get recommended text color for a background
 */
export function getRecommendedTextColor(backgroundColor: string): string {
  const luminance = getRelativeLuminance(backgroundColor);
  return luminance > 0.5 ? '#000000' : '#ffffff';
}
