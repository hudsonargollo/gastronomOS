'use client';

/**
 * Sketch & Wire Icon System
 * Hand-drawn style icons with variable stroke and incomplete paths
 * Part of the Adaptive Gastronomy Design System
 */

import React from 'react';
import { useTheme } from '@/contexts/theme-context';
import { cn } from '@/lib/utils';
import { iconLibrary, getAllIconNames } from '@/lib/design-system/icon-library';

export interface SketchWireIconProps extends React.SVGProps<SVGSVGElement> {
  /**
   * Icon name from the library
   */
  name: string;
  /**
   * Size of the icon (default: 24)
   */
  size?: number;
  /**
   * Stroke width variation (default: 'medium')
   * - thin: 1.5px
   * - medium: 2px
   * - thick: 2.5px
   */
  strokeVariation?: 'thin' | 'medium' | 'thick';
  /**
   * Enable incomplete path styling (default: true)
   */
  incompletePaths?: boolean;
  /**
   * Animation on hover (default: false)
   */
  animated?: boolean;
  /**
   * Use theme accent color (default: false)
   */
  useAccent?: boolean;
}

const strokeWidths = {
  thin: 1.5,
  medium: 2,
  thick: 2.5,
};

/**
 * SketchWireIcon Component
 * Renders hand-drawn style icons with theme integration
 */
export function SketchWireIcon({
  name,
  size = 24,
  strokeVariation = 'medium',
  incompletePaths = true,
  animated = false,
  useAccent = false,
  className,
  ...props
}: SketchWireIconProps) {
  const { palette } = useTheme();
  const iconDef = iconLibrary[name];
  
  if (!iconDef) {
    console.warn(`Icon "${name}" not found in SketchWireIcon library`);
    return null;
  }

  const paths = iconDef.paths;
  const strokeWidth = strokeWidths[strokeVariation];
  const strokeColor = useAccent ? palette.accent : 'currentColor';

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(
        'sketch-wire-icon',
        animated && 'transition-transform duration-200 hover:scale-110',
        incompletePaths && 'sketch-wire-incomplete',
        className
      )}
      aria-label={iconDef.description}
      role="img"
      {...props}
    >
      {paths.map((d, index) => (
        <path
          key={index}
          d={d}
          className={cn(
            incompletePaths && index % 2 === 0 && 'opacity-90',
            animated && 'transition-opacity duration-200'
          )}
          style={{
            strokeDasharray: incompletePaths && index % 3 === 0 ? '1, 2' : undefined,
          }}
        />
      ))}
    </svg>
  );
}

/**
 * Icon library export for easy access
 */
export const SketchWireIcons = getAllIconNames();

/**
 * Helper component for displaying all available icons
 */
export function SketchWireIconGallery() {
  return (
    <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 p-4">
      {SketchWireIcons.map((iconName) => (
        <div
          key={iconName}
          className="flex flex-col items-center gap-2 p-3 rounded-lg border hover:bg-gray-50 transition-colors"
        >
          <SketchWireIcon
            name={iconName}
            size={32}
            animated
          />
          <span className="text-xs text-center font-mono">{iconName}</span>
        </div>
      ))}
    </div>
  );
}
