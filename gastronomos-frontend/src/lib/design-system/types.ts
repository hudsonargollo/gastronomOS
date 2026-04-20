/**
 * Design System Types
 * Adaptive Gastronomy Design System - Core Type Definitions
 */

export enum ThemeName {
  BISTRO_NOIR = 'bistro-noir',
  NEON_DINER = 'neon-diner',
  ORGANIC_GARDEN = 'organic-garden',
  SIGNATURE = 'signature',
  PONTAL_STOCK = 'pontal-stock'
}

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
}

export interface TypographyConfig {
  headingFont: 'Syne' | 'Clash Display';
  bodyFont: 'JetBrains Mono' | 'Space Grotesk';
  customFontUrls?: string[];
}

export interface BannerDefaults {
  backgroundType: 'solid' | 'gradient' | 'image';
  backgroundColor?: string;
  gradientColors?: [string, string];
  defaultImageUrl?: string;
  textColor: string;
  overlayOpacity: number;
}

export interface ThemeConfig {
  tenantId: string;
  theme: ThemeName;
  palette: ColorPalette;
  customColors?: Partial<ColorPalette>;
  typography: TypographyConfig;
  bannerDefaults: BannerDefaults;
}

export interface BrandingAssets {
  tenantId: string;
  logo?: string;
  favicon?: string;
  bannerImages: BannerImage[];
  customIcons?: CustomIcon[];
}

export interface BannerImage {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
  category: string;
}

export interface CustomIcon {
  id: string;
  name: string;
  svg: string;
}

/**
 * Semantic Token System
 * Functional naming for design tokens
 */
export interface SemanticTokens {
  // Action tokens
  actionPrimary: string;
  actionSecondary: string;
  actionDanger: string;
  actionSuccess: string;
  
  // Surface tokens
  surfaceBase: string;
  surfaceElevated: string;
  surfaceOverlay: string;
  
  // Border tokens
  borderSubtle: string;
  borderDefault: string;
  borderStrong: string;
  
  // Text tokens
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  
  // Status tokens
  statusInfo: string;
  statusSuccess: string;
  statusWarning: string;
  statusError: string;
  
  // Interactive tokens
  interactiveHover: string;
  interactiveActive: string;
  interactiveFocus: string;
  interactiveDisabled: string;
}
