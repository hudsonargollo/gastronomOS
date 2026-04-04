/**
 * Design System Component
 * Comprehensive component showcasing the unified design system
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/contexts/theme-context';
import { 
  interactiveBase, 
  inputStyles, 
  cardStyles, 
  badgeStyles, 
  navigationStyles,
  createInteractiveStyles,
  interactiveAnimations 
} from '@/lib/interactive-styles';
import { 
  ariaAttributes, 
  ariaRoles, 
  keyboardNavigation, 
  screenReader,
  a11yClasses 
} from '@/lib/accessibility';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Design System Showcase Component
export function DesignSystemShowcase() {
  const { tokens, resolvedTheme, isMobile, prefersReducedMotion } = useTheme();
  const [focusedElement, setFocusedElement] = React.useState<string | null>(null);

  // Announce theme changes to screen readers
  React.useEffect(() => {
    screenReader.announce(`Theme changed to ${resolvedTheme}`, 'polite');
  }, [resolvedTheme]);

  return (
    <div className="space-y-8 p-6">
      {/* Theme Information */}
      <Card>
        <CardHeader>
          <CardTitle>Design System Status</CardTitle>
          <CardDescription>
            Current theme and system information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <strong>Theme:</strong> {resolvedTheme}
            </div>
            <div>
              <strong>Device:</strong> {isMobile ? 'Mobile' : 'Desktop'}
            </div>
            <div>
              <strong>Motion:</strong> {prefersReducedMotion ? 'Reduced' : 'Full'}
            </div>
            <div>
              <strong>Focus:</strong> {focusedElement || 'None'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Color Palette */}
      <ColorPalette />

      {/* Interactive Elements */}
      <InteractiveElements onFocusChange={setFocusedElement} />

      {/* Typography Scale */}
      <TypographyScale />

      {/* Spacing System */}
      <SpacingSystem />

      {/* Accessibility Features */}
      <AccessibilityFeatures />

      {/* Animation Examples */}
      <AnimationExamples />
    </div>
  );
}

// Color Palette Component
function ColorPalette() {
  const { tokens } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Color System</CardTitle>
        <CardDescription>
          Semantic color tokens with consistent contrast ratios
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Primary Colors */}
          <div>
            <h4 className="font-semibold mb-3">Primary Scale</h4>
            <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
              {Object.entries(tokens.colors.primary).map(([key, value]) => (
                <div key={key} className="text-center">
                  <div 
                    className="w-full h-12 rounded-md border"
                    style={{ backgroundColor: value }}
                    title={`Primary ${key}: ${value}`}
                  />
                  <span className="text-xs mt-1 block">{key}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Semantic Colors */}
          <div>
            <h4 className="font-semibold mb-3">Semantic Colors</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(tokens.colors.semantic).map(([category, colors]) => (
                <div key={category}>
                  <h5 className="text-sm font-medium mb-2 capitalize">{category}</h5>
                  <div className="space-y-1">
                    {Object.entries(colors).map(([shade, value]) => (
                      <div key={shade} className="flex items-center gap-2">
                        <div 
                          className="w-6 h-6 rounded border"
                          style={{ backgroundColor: value }}
                        />
                        <span className="text-xs">{shade}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Interactive Elements Component
function InteractiveElements({ onFocusChange }: { onFocusChange: (element: string | null) => void }) {
  const handleFocus = (elementName: string) => {
    onFocusChange(elementName);
    screenReader.announce(`Focused on ${elementName}`, 'polite');
  };

  const handleBlur = () => {
    onFocusChange(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Interactive Elements</CardTitle>
        <CardDescription>
          Consistent styling and behavior across all interactive components
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Buttons */}
        <div>
          <h4 className="font-semibold mb-3">Buttons</h4>
          <div className="flex flex-wrap gap-3">
            <Button 
              variant="default"
              onFocus={() => handleFocus('Default Button')}
              onBlur={handleBlur}
            >
              Default
            </Button>
            <Button 
              variant="secondary"
              onFocus={() => handleFocus('Secondary Button')}
              onBlur={handleBlur}
            >
              Secondary
            </Button>
            <Button 
              variant="outline"
              onFocus={() => handleFocus('Outline Button')}
              onBlur={handleBlur}
            >
              Outline
            </Button>
            <Button 
              variant="ghost"
              onFocus={() => handleFocus('Ghost Button')}
              onBlur={handleBlur}
            >
              Ghost
            </Button>
            <Button 
              variant="destructive"
              onFocus={() => handleFocus('Destructive Button')}
              onBlur={handleBlur}
            >
              Destructive
            </Button>
            <Button 
              disabled
              onFocus={() => handleFocus('Disabled Button')}
              onBlur={handleBlur}
            >
              Disabled
            </Button>
          </div>
        </div>

        {/* Inputs */}
        <div>
          <h4 className="font-semibold mb-3">Form Inputs</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              placeholder="Default input"
              onFocus={() => handleFocus('Default Input')}
              onBlur={handleBlur}
            />
            <Input 
              placeholder="Error state"
              aria-invalid="true"
              onFocus={() => handleFocus('Error Input')}
              onBlur={handleBlur}
            />
            <Input 
              placeholder="Disabled input"
              disabled
              onFocus={() => handleFocus('Disabled Input')}
              onBlur={handleBlur}
            />
            <Input 
              type="search"
              placeholder="Search input"
              onFocus={() => handleFocus('Search Input')}
              onBlur={handleBlur}
            />
          </div>
        </div>

        {/* Badges */}
        <div>
          <h4 className="font-semibold mb-3">Badges</h4>
          <div className="flex flex-wrap gap-2">
            <Badge variant="default">Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="info">Info</Badge>
          </div>
        </div>

        {/* Navigation Items */}
        <div>
          <h4 className="font-semibold mb-3">Navigation</h4>
          <nav className="space-y-1" role="navigation" aria-label="Design system navigation">
            <button 
              className={cn(navigationStyles({ variant: 'active' }))}
              onFocus={() => handleFocus('Active Navigation')}
              onBlur={handleBlur}
              {...ariaAttributes.selected(true)}
            >
              Active Item
            </button>
            <button 
              className={cn(navigationStyles({ variant: 'default' }))}
              onFocus={() => handleFocus('Default Navigation')}
              onBlur={handleBlur}
            >
              Default Item
            </button>
            <button 
              className={cn(navigationStyles({ variant: 'ghost' }))}
              onFocus={() => handleFocus('Ghost Navigation')}
              onBlur={handleBlur}
            >
              Ghost Item
            </button>
          </nav>
        </div>
      </CardContent>
    </Card>
  );
}

// Typography Scale Component
function TypographyScale() {
  const { tokens } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Typography System</CardTitle>
        <CardDescription>
          Consistent font sizes, weights, and line heights
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(tokens.typography.fontSize).map(([size, [fontSize, { lineHeight }]]) => (
          <div key={size} className="flex items-baseline gap-4">
            <span className="text-sm text-muted-foreground w-12">{size}</span>
            <span 
              style={{ fontSize, lineHeight }}
              className="font-medium"
            >
              The quick brown fox jumps over the lazy dog
            </span>
            <span className="text-xs text-muted-foreground ml-auto">
              {fontSize} / {lineHeight}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// Spacing System Component
function SpacingSystem() {
  const { tokens } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spacing System</CardTitle>
        <CardDescription>
          Consistent spacing scale for margins, padding, and gaps
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Object.entries(tokens.spacing).slice(0, 20).map(([key, value]) => (
            <div key={key} className="text-center">
              <div 
                className="bg-primary/20 border-2 border-primary/40 mx-auto mb-2"
                style={{ width: value, height: value, minWidth: '8px', minHeight: '8px' }}
              />
              <div className="text-xs">
                <div className="font-medium">{key}</div>
                <div className="text-muted-foreground">{value}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Accessibility Features Component
function AccessibilityFeatures() {
  const [announceMessage, setAnnounceMessage] = React.useState('');

  const handleAnnounce = () => {
    const message = `Accessibility test at ${new Date().toLocaleTimeString()}`;
    setAnnounceMessage(message);
    screenReader.announce(message, 'assertive');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accessibility Features</CardTitle>
        <CardDescription>
          WCAG-compliant accessibility utilities and features
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Focus Management */}
        <div>
          <h4 className="font-semibold mb-3">Focus Management</h4>
          <div className="space-y-2">
            <Button 
              className={createInteractiveStyles.focusRing()}
              onKeyDown={keyboardNavigation.onEnterOrSpace(() => alert('Activated with keyboard!'))}
            >
              Keyboard Accessible Button
            </Button>
            <p className="text-sm text-muted-foreground">
              Try using Tab, Enter, and Space keys to navigate and activate
            </p>
          </div>
        </div>

        {/* Screen Reader Support */}
        <div>
          <h4 className="font-semibold mb-3">Screen Reader Support</h4>
          <div className="space-y-2">
            <Button onClick={handleAnnounce}>
              Test Screen Reader Announcement
            </Button>
            {announceMessage && (
              <p className="text-sm text-muted-foreground">
                Last announcement: "{announceMessage}"
              </p>
            )}
            <div className={a11yClasses.srOnly}>
              This text is only visible to screen readers
            </div>
          </div>
        </div>

        {/* ARIA Attributes */}
        <div>
          <h4 className="font-semibold mb-3">ARIA Attributes</h4>
          <div className="space-y-2">
            <div 
              role={ariaRoles.progressbar}
              {...ariaAttributes.valuemin(0)}
              {...ariaAttributes.valuemax(100)}
              {...ariaAttributes.valuenow(75)}
              {...ariaAttributes.label('Loading progress')}
              className="w-full bg-secondary rounded-full h-2"
            >
              <div 
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: '75%' }}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Progress bar with proper ARIA attributes
            </p>
          </div>
        </div>

        {/* High Contrast Support */}
        <div>
          <h4 className="font-semibold mb-3">High Contrast Support</h4>
          <div className={cn('p-4 border rounded-md', a11yClasses.highContrast)}>
            <p className="text-sm">
              This content adapts to high contrast mode preferences
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Animation Examples Component
function AnimationExamples() {
  const { prefersReducedMotion } = useTheme();
  const [isVisible, setIsVisible] = React.useState(true);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Animation System</CardTitle>
        <CardDescription>
          Consistent animations that respect motion preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4 mb-4">
          <Button onClick={() => setIsVisible(!isVisible)}>
            Toggle Animation
          </Button>
          <span className="text-sm text-muted-foreground">
            Motion preference: {prefersReducedMotion ? 'Reduced' : 'Full'}
          </span>
        </div>

        {/* Button Animations */}
        <div>
          <h4 className="font-semibold mb-3">Interactive Animations</h4>
          <div className="flex gap-3">
            <motion.button
              className={cn(interactiveBase({ variant: 'default' }))}
              variants={interactiveAnimations.button}
              initial="initial"
              whileHover="hover"
              whileTap="tap"
            >
              Hover & Tap Me
            </motion.button>
            
            <motion.div
              className={cn(cardStyles({ interactive: true, padding: 'sm' }))}
              variants={interactiveAnimations.card}
              initial="initial"
              whileHover="hover"
              whileTap="tap"
            >
              Interactive Card
            </motion.div>
          </div>
        </div>

        {/* Entrance Animations */}
        <div>
          <h4 className="font-semibold mb-3">Entrance Animations</h4>
          <motion.div
            key={isVisible ? 'visible' : 'hidden'}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ 
              opacity: isVisible ? 1 : 0, 
              y: isVisible ? 0 : 20,
              scale: isVisible ? 1 : 0.95
            }}
            transition={{ 
              duration: prefersReducedMotion ? 0 : 0.3,
              ease: 'easeOut'
            }}
            className="p-4 bg-muted/50 rounded-lg"
          >
            <p className="text-sm">
              This content animates in and out with respect to motion preferences
            </p>
          </motion.div>
        </div>
      </CardContent>
    </Card>
  );
}

// Export the main component
export default DesignSystemShowcase;