/**
 * Semantic Token System
 * Maps functional names to palette colors
 */

import { ColorPalette, SemanticTokens } from './types';

/**
 * Generate semantic tokens from a color palette
 * Provides functional naming for design consistency
 */
export function generateSemanticTokens(palette: ColorPalette): SemanticTokens {
  return {
    // Action tokens - for buttons and interactive elements
    actionPrimary: palette.primary,
    actionSecondary: palette.secondary,
    actionDanger: '#dc2626',      // Red for destructive actions
    actionSuccess: '#16a34a',     // Green for success actions
    
    // Surface tokens - for backgrounds and containers
    surfaceBase: palette.background,
    surfaceElevated: palette.surface,
    surfaceOverlay: adjustOpacity(palette.text, 0.95),
    
    // Border tokens - for dividers and outlines
    borderSubtle: adjustOpacity(palette.text, 0.1),
    borderDefault: adjustOpacity(palette.text, 0.2),
    borderStrong: adjustOpacity(palette.text, 0.3),
    
    // Text tokens - for typography hierarchy
    textPrimary: palette.text,
    textSecondary: palette.textSecondary,
    textTertiary: adjustOpacity(palette.text, 0.6),
    textInverse: palette.background,
    
    // Status tokens - for feedback and states
    statusInfo: '#3b82f6',        // Blue
    statusSuccess: '#16a34a',     // Green
    statusWarning: '#f59e0b',     // Amber
    statusError: '#dc2626',       // Red
    
    // Interactive tokens - for hover, active, focus states
    interactiveHover: adjustOpacity(palette.primary, 0.9),
    interactiveActive: adjustOpacity(palette.primary, 0.8),
    interactiveFocus: palette.accent,
    interactiveDisabled: adjustOpacity(palette.text, 0.4),
  };
}

/**
 * Adjust color opacity
 * Helper function for creating transparent variants
 */
function adjustOpacity(color: string, opacity: number): string {
  // If color is already in rgba format, extract and adjust
  if (color.startsWith('rgba')) {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
    if (match) {
      return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${opacity})`;
    }
  }
  
  // If color is in hex format, convert to rgba
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  
  // Return original color if format is unknown
  return color;
}

/**
 * Apply semantic tokens to CSS custom properties
 */
export function applySemanticTokens(tokens: SemanticTokens): void {
  const root = document.documentElement;
  
  // Action tokens
  root.style.setProperty('--token-action-primary', tokens.actionPrimary);
  root.style.setProperty('--token-action-secondary', tokens.actionSecondary);
  root.style.setProperty('--token-action-danger', tokens.actionDanger);
  root.style.setProperty('--token-action-success', tokens.actionSuccess);
  
  // Surface tokens
  root.style.setProperty('--token-surface-base', tokens.surfaceBase);
  root.style.setProperty('--token-surface-elevated', tokens.surfaceElevated);
  root.style.setProperty('--token-surface-overlay', tokens.surfaceOverlay);
  
  // Border tokens
  root.style.setProperty('--token-border-subtle', tokens.borderSubtle);
  root.style.setProperty('--token-border-default', tokens.borderDefault);
  root.style.setProperty('--token-border-strong', tokens.borderStrong);
  
  // Text tokens
  root.style.setProperty('--token-text-primary', tokens.textPrimary);
  root.style.setProperty('--token-text-secondary', tokens.textSecondary);
  root.style.setProperty('--token-text-tertiary', tokens.textTertiary);
  root.style.setProperty('--token-text-inverse', tokens.textInverse);
  
  // Status tokens
  root.style.setProperty('--token-status-info', tokens.statusInfo);
  root.style.setProperty('--token-status-success', tokens.statusSuccess);
  root.style.setProperty('--token-status-warning', tokens.statusWarning);
  root.style.setProperty('--token-status-error', tokens.statusError);
  
  // Interactive tokens
  root.style.setProperty('--token-interactive-hover', tokens.interactiveHover);
  root.style.setProperty('--token-interactive-active', tokens.interactiveActive);
  root.style.setProperty('--token-interactive-focus', tokens.interactiveFocus);
  root.style.setProperty('--token-interactive-disabled', tokens.interactiveDisabled);
}
