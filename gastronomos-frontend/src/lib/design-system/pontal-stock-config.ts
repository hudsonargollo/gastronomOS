/**
 * Pontal Stock Branding Configuration
 * Maraú Sunset Design System
 * 
 * Inspired by the natural elements of Barra Grande:
 * - Deep forest greens (Palm Trees)
 * - Warm beach sands (Maraú Beaches)
 * - Signature sunset orange (Branding)
 */

import { ThemeName, ColorPalette, TypographyConfig, BannerDefaults } from './types';
import { PONTAL_STOCK_PALETTE } from './palettes';
import { typographyPresets } from './typography';

/**
 * Pontal Stock Color Palette
 */
export const pontalStockColors = {
  primary: '#2d5016',        // Deep Forest Green (Palm Trees)
  secondary: '#ea580c',      // Sunset Orange (Branding Signature)
  accent: '#f4a460',         // Sandy Brown (Maraú Beaches)
  background: '#faf8f3',     // Warm Sea Foam (Off-white background)
  surface: '#ffffff',        // Pure White (Clean containers)
  text: '#1c2912',           // Dark Earth (High contrast text)
  textSecondary: '#5a6b3d',  // Muted Olive (Subtle text)
};

/**
 * Semantic Token Mapping for Pontal Stock
 */
export const pontalStockSemanticTokens = {
  '--token-action-primary': pontalStockColors.primary,
  '--token-interactive-focus': pontalStockColors.accent,
  '--token-surface-base': pontalStockColors.background,
  '--token-text-primary': pontalStockColors.text,
  '--font-heading': "'Syne', sans-serif",
  '--font-body': "'JetBrains Mono', monospace",
};

/**
 * Typography Configuration for Pontal Stock
 * Uses Syne for headings (premium, architectural feel)
 * Uses JetBrains Mono for body (precision for inventory tracking)
 */
export const pontalStockTypography: TypographyConfig = {
  headingFont: 'Syne',
  bodyFont: 'JetBrains Mono',
};

/**
 * Banner Defaults for Pontal Stock
 */
export const pontalStockBannerDefaults: BannerDefaults = {
  backgroundType: 'solid',
  backgroundColor: pontalStockColors.background,
  textColor: pontalStockColors.text,
  overlayOpacity: 0.6,
};

/**
 * Branding Configuration for Pontal Stock
 */
export const pontalStockBrandingConfig = {
  tenantId: 'pontal-carapitangui',
  businessName: 'Pontal Stock',
  logo: '/logos/pontal-carapitangui.webp',
  theme: ThemeName.PONTAL_STOCK,
  palette: PONTAL_STOCK_PALETTE,
  typography: pontalStockTypography,
  bannerDefaults: pontalStockBannerDefaults,
};

/**
 * Apply Pontal Stock branding to the document
 */
export function applyPontalStockBranding(): void {
  const root = document.documentElement;
  
  // Apply color palette
  Object.entries(pontalStockColors).forEach(([key, value]) => {
    root.style.setProperty(`--color-${key}`, value);
  });
  
  // Apply semantic tokens
  Object.entries(pontalStockSemanticTokens).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  
  // Set theme attribute
  root.setAttribute('data-theme', 'pontal-stock');
}

/**
 * Status indicators for Pontal Stock
 * Used for inventory alerts and emergency transfers
 */
export const pontalStockStatusIndicators = {
  lowStock: {
    color: pontalStockColors.accent,      // Sandy Brown
    label: 'Estoque Baixo',
  },
  emergency: {
    color: '#dc2626',                      // Red
    label: 'Transferência de Emergência',
  },
  normal: {
    color: pontalStockColors.primary,      // Forest Green
    label: 'Normal',
  },
  success: {
    color: '#16a34a',                      // Green
    label: 'Sucesso',
  },
};
