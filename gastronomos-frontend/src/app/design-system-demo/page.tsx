'use client';

/**
 * Design System Demo Page
 * Showcases the Adaptive Gastronomy Design System
 */

import { ThemeShowcase } from '@/components/design-system/theme-showcase';

export default function DesignSystemDemoPage() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold">Adaptive Gastronomy Design System</h1>
          <p className="text-lg text-gray-600">
            A comprehensive theming system with four color palettes, semantic tokens, and typography configurations.
          </p>
        </div>
        
        <ThemeShowcase />
      </div>
    </div>
  );
}
