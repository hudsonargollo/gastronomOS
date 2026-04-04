'use client';

/**
 * Theme Showcase Component
 * Demonstrates the Adaptive Gastronomy Design System
 */

import React from 'react';
import { useTheme } from '@/contexts/theme-context';
import { ThemeName } from '@/lib/design-system/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ThemeShowcase() {
  const { theme, palette, setTheme, availableThemes } = useTheme();

  const themeDescriptions: Record<ThemeName, string> = {
    [ThemeName.BISTRO_NOIR]: 'Elegant and sophisticated with deep charcoals and gold accents',
    [ThemeName.NEON_DINER]: 'Bold and vibrant with electric colors on dark backgrounds',
    [ThemeName.ORGANIC_GARDEN]: 'Natural and earthy with forest greens and warm tones',
    [ThemeName.SIGNATURE]: 'Classic and versatile with orange and red accents',
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Current Theme: {theme}</CardTitle>
          <CardDescription>{themeDescriptions[theme]}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {availableThemes.map((themeName) => (
              <Button
                key={themeName}
                onClick={() => setTheme(themeName)}
                variant={theme === themeName ? 'default' : 'outline'}
                className="h-auto py-4 flex flex-col items-center gap-2"
              >
                <div className="text-sm font-medium capitalize">
                  {themeName.replace('-', ' ')}
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Color Palette</CardTitle>
          <CardDescription>Current theme colors</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(palette).map(([name, color]) => (
              <div key={name} className="space-y-2">
                <div
                  className="h-20 rounded-lg border-2 border-gray-200"
                  style={{ backgroundColor: color }}
                />
                <div className="text-sm">
                  <div className="font-medium capitalize">{name.replace(/([A-Z])/g, ' $1').trim()}</div>
                  <div className="text-xs text-gray-500 font-mono">{color}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Semantic Tokens</CardTitle>
          <CardDescription>Functional design tokens</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Action Tokens</h4>
              <div className="flex gap-2">
                <Button style={{ backgroundColor: 'var(--token-action-primary)' }}>Primary</Button>
                <Button style={{ backgroundColor: 'var(--token-action-secondary)' }}>Secondary</Button>
                <Button style={{ backgroundColor: 'var(--token-action-success)' }}>Success</Button>
                <Button style={{ backgroundColor: 'var(--token-action-danger)' }}>Danger</Button>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Status Tokens</h4>
              <div className="flex gap-2">
                <div className="px-3 py-1 rounded text-white text-sm" style={{ backgroundColor: 'var(--token-status-info)' }}>
                  Info
                </div>
                <div className="px-3 py-1 rounded text-white text-sm" style={{ backgroundColor: 'var(--token-status-success)' }}>
                  Success
                </div>
                <div className="px-3 py-1 rounded text-white text-sm" style={{ backgroundColor: 'var(--token-status-warning)' }}>
                  Warning
                </div>
                <div className="px-3 py-1 rounded text-white text-sm" style={{ backgroundColor: 'var(--token-status-error)' }}>
                  Error
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Surface Tokens</h4>
              <div className="flex gap-2">
                <div className="px-4 py-3 rounded border" style={{ backgroundColor: 'var(--token-surface-base)' }}>
                  Base
                </div>
                <div className="px-4 py-3 rounded border" style={{ backgroundColor: 'var(--token-surface-elevated)' }}>
                  Elevated
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Typography</CardTitle>
          <CardDescription>The Editorial Menu - Geometric headings with monospaced body</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">Heading 1</h1>
              <h2 className="text-3xl font-semibold mb-2">Heading 2</h2>
              <h3 className="text-2xl font-medium mb-2">Heading 3</h3>
              <h4 className="text-xl mb-2">Heading 4</h4>
            </div>
            <div>
              <p className="text-base mb-2">
                Body text uses monospaced fonts for a technical, editorial feel. This creates a unique contrast with the geometric headings.
              </p>
              <p className="text-sm text-gray-600">
                Secondary text maintains readability while providing visual hierarchy.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
