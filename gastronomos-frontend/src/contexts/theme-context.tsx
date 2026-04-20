'use client';

/**
 * Theme Context
 * Adaptive Gastronomy Design System - Theme Provider
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ThemeName, ThemeConfig, ColorPalette, TypographyConfig, BannerDefaults } from '@/lib/design-system/types';
import { colorPalettes, getPalette, mergeCustomColors } from '@/lib/design-system/palettes';
import { generateSemanticTokens, applySemanticTokens } from '@/lib/design-system/semantic-tokens';
import { typographyPresets, loadFonts, applyTypography } from '@/lib/design-system/typography';

interface ThemeContextType {
  theme: ThemeName;
  palette: ColorPalette;
  typography: TypographyConfig;
  bannerDefaults: BannerDefaults;
  setTheme: (theme: ThemeName) => void;
  setCustomColors: (colors: Partial<ColorPalette>) => void;
  setTypography: (config: TypographyConfig) => void;
  setBannerDefaults: (defaults: BannerDefaults) => void;
  availableThemes: ThemeName[];
  availablePalettes: Record<ThemeName, ColorPalette>;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const defaultBannerDefaults: BannerDefaults = {
  backgroundType: 'solid',
  backgroundColor: '#faf8f3',
  textColor: '#1c2912',
  overlayOpacity: 0.6,
};

const defaultThemeConfig: ThemeConfig = {
  tenantId: 'pontal-carapitangui',
  theme: ThemeName.PONTAL_STOCK,
  palette: colorPalettes[ThemeName.PONTAL_STOCK],
  typography: typographyPresets.editorial,
  bannerDefaults: defaultBannerDefaults,
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(defaultThemeConfig);
  const [customColors, setCustomColorsState] = useState<Partial<ColorPalette> | undefined>();

  // Load theme configuration from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('pontal-stock-theme-config');
    if (savedTheme) {
      try {
        const parsed = JSON.parse(savedTheme);
        setThemeConfig({ ...defaultThemeConfig, ...parsed });
        if (parsed.customColors) {
          setCustomColorsState(parsed.customColors);
        }
      } catch (error) {
        console.error('Failed to parse theme configuration:', error);
      }
    }
  }, []);

  // Apply theme changes to DOM
  useEffect(() => {
    const finalPalette = mergeCustomColors(themeConfig.palette, customColors);
    const semanticTokens = generateSemanticTokens(finalPalette);
    
    // Apply semantic tokens to CSS custom properties
    applySemanticTokens(semanticTokens);
    
    // Apply base palette colors
    const root = document.documentElement;
    root.style.setProperty('--color-primary', finalPalette.primary);
    root.style.setProperty('--color-secondary', finalPalette.secondary);
    root.style.setProperty('--color-accent', finalPalette.accent);
    root.style.setProperty('--color-background', finalPalette.background);
    root.style.setProperty('--color-surface', finalPalette.surface);
    root.style.setProperty('--color-text', finalPalette.text);
    root.style.setProperty('--color-text-secondary', finalPalette.textSecondary);
    
    // Set theme name as data attribute
    root.setAttribute('data-theme', themeConfig.theme);
  }, [themeConfig.palette, customColors, themeConfig.theme]);

  // Load and apply typography
  useEffect(() => {
    loadFonts(themeConfig.typography)
      .then(() => {
        applyTypography(themeConfig.typography);
      })
      .catch((error) => {
        console.error('Failed to load fonts:', error);
      });
  }, [themeConfig.typography]);

  const setTheme = useCallback((theme: ThemeName) => {
    const newPalette = getPalette(theme);
    const newConfig = {
      ...themeConfig,
      theme,
      palette: newPalette,
    };
    setThemeConfig(newConfig);
    localStorage.setItem('pontal-stock-theme-config', JSON.stringify(newConfig));
  }, [themeConfig]);

  const setCustomColors = useCallback((colors: Partial<ColorPalette>) => {
    setCustomColorsState(colors);
    const newConfig = {
      ...themeConfig,
      customColors: colors,
    };
    setThemeConfig(newConfig);
    localStorage.setItem('pontal-stock-theme-config', JSON.stringify(newConfig));
  }, [themeConfig]);

  const setTypography = useCallback((config: TypographyConfig) => {
    const newConfig = {
      ...themeConfig,
      typography: config,
    };
    setThemeConfig(newConfig);
    localStorage.setItem('pontal-stock-theme-config', JSON.stringify(newConfig));
  }, [themeConfig]);

  const setBannerDefaults = useCallback((defaults: BannerDefaults) => {
    const newConfig = {
      ...themeConfig,
      bannerDefaults: defaults,
    };
    setThemeConfig(newConfig);
    localStorage.setItem('pontal-stock-theme-config', JSON.stringify(newConfig));
  }, [themeConfig]);

  const resetTheme = useCallback(() => {
    setThemeConfig(defaultThemeConfig);
    setCustomColorsState(undefined);
    localStorage.removeItem('pontal-stock-theme-config');
  }, []);

  const value: ThemeContextType = {
    theme: themeConfig.theme,
    palette: mergeCustomColors(themeConfig.palette, customColors),
    typography: themeConfig.typography,
    bannerDefaults: themeConfig.bannerDefaults,
    setTheme,
    setCustomColors,
    setTypography,
    setBannerDefaults,
    availableThemes: Object.values(ThemeName),
    availablePalettes: colorPalettes,
    resetTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
