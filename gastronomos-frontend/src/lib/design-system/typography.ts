/**
 * Typography Configuration
 * "The Editorial Menu" - Geometric headings with monospaced body text
 */

import { TypographyConfig } from './types';

/**
 * Default typography configurations
 */
export const typographyPresets: Record<string, TypographyConfig> = {
  editorial: {
    headingFont: 'Syne',
    bodyFont: 'JetBrains Mono',
  },
  modern: {
    headingFont: 'Clash Display',
    bodyFont: 'Space Grotesk',
  },
  mixed: {
    headingFont: 'Clash Display',
    bodyFont: 'JetBrains Mono',
  },
  geometric: {
    headingFont: 'Syne',
    bodyFont: 'Space Grotesk',
  },
};

/**
 * Font URLs for Google Fonts
 */
export const fontUrls: Record<string, string> = {
  'Syne': 'https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&display=swap',
  'JetBrains Mono': 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap',
  'Space Grotesk': 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap',
};

/**
 * Clash Display is a custom font that needs to be self-hosted
 * This URL should point to your font files
 */
export const clashDisplayUrl = '/fonts/clash-display.css';

/**
 * Get font URLs for a typography configuration
 */
export function getFontUrls(config: TypographyConfig): string[] {
  const urls: string[] = [];
  
  // Add heading font URL
  if (config.headingFont === 'Clash Display') {
    urls.push(clashDisplayUrl);
  } else {
    urls.push(fontUrls[config.headingFont]);
  }
  
  // Add body font URL
  urls.push(fontUrls[config.bodyFont]);
  
  // Add custom font URLs if provided
  if (config.customFontUrls) {
    urls.push(...config.customFontUrls);
  }
  
  return urls;
}

/**
 * Apply typography configuration to CSS custom properties
 */
export function applyTypography(config: TypographyConfig): void {
  const root = document.documentElement;
  
  // Set font family custom properties
  root.style.setProperty('--font-heading', config.headingFont);
  root.style.setProperty('--font-body', config.bodyFont);
  
  // Apply font families to document
  const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  headingElements.forEach((element) => {
    (element as HTMLElement).style.fontFamily = config.headingFont;
  });
}

/**
 * Load fonts dynamically
 */
export function loadFonts(config: TypographyConfig): Promise<void[]> {
  const urls = getFontUrls(config);
  
  return Promise.all(
    urls.map((url) => {
      return new Promise<void>((resolve, reject) => {
        // Check if link already exists
        const existingLink = document.querySelector(`link[href="${url}"]`);
        if (existingLink) {
          resolve();
          return;
        }
        
        // Create and append link element
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        link.onload = () => resolve();
        link.onerror = () => reject(new Error(`Failed to load font: ${url}`));
        document.head.appendChild(link);
      });
    })
  );
}

/**
 * Get CSS font stack for fallback
 */
export function getFontStack(fontName: string): string {
  const stacks: Record<string, string> = {
    'Syne': '"Syne", system-ui, -apple-system, sans-serif',
    'Clash Display': '"Clash Display", system-ui, -apple-system, sans-serif',
    'JetBrains Mono': '"JetBrains Mono", "Courier New", monospace',
    'Space Grotesk': '"Space Grotesk", system-ui, -apple-system, sans-serif',
  };
  
  return stacks[fontName] || 'system-ui, -apple-system, sans-serif';
}
