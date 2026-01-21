/**
 * Design System Demo
 * Comprehensive demonstration of the unified design system
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/contexts/theme-context';
import { DesignSystemShowcase } from '@/components/ui/design-system';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, StatusBadge, NotificationBadge, PriorityBadge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Sun, 
  Moon, 
  Monitor, 
  Palette, 
  Accessibility, 
  Zap,
  Settings,
  Bell,
  AlertTriangle,
  CheckCircle,
  Info,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ariaAttributes, screenReader } from '@/lib/accessibility';

export function DesignSystemDemo() {
  const { theme, setTheme, resolvedTheme, isMobile, prefersReducedMotion } = useTheme();
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [notifications, setNotifications] = React.useState(3);

  // Theme switching with accessibility announcements
  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    screenReader.announce(`Theme changed to ${newTheme}`, 'polite');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Palette className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold">Design System</h1>
              </div>
              <Badge variant="secondary" size="sm">
                v2.0
              </Badge>
            </div>

            <div className="flex items-center gap-4">
              {/* Theme Switcher */}
              <div className="flex items-center gap-2">
                <Label htmlFor="theme-switcher" className="sr-only">
                  Choose theme
                </Label>
                <div className="flex rounded-lg border p-1">
                  <Button
                    variant={theme === 'light' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleThemeChange('light')}
                    {...ariaAttributes.label('Light theme')}
                    {...ariaAttributes.selected(theme === 'light')}
                  >
                    <Sun className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={theme === 'dark' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleThemeChange('dark')}
                    {...ariaAttributes.label('Dark theme')}
                    {...ariaAttributes.selected(theme === 'dark')}
                  >
                    <Moon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={theme === 'system' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleThemeChange('system')}
                    {...ariaAttributes.label('System theme')}
                    {...ariaAttributes.selected(theme === 'system')}
                  >
                    <Monitor className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Notification Badge */}
              <div className="relative">
                <Button variant="ghost" size="icon">
                  <Bell className="h-5 w-5" />
                </Button>
                <NotificationBadge count={notifications} />
              </div>

              {/* Settings */}
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* System Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
          className="mb-8"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                System Status
              </CardTitle>
              <CardDescription>
                Current design system configuration and capabilities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <StatusBadge status="success" />
                  </div>
                  <div>
                    <p className="font-medium">Theme System</p>
                    <p className="text-sm text-muted-foreground">
                      {resolvedTheme} mode active
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <StatusBadge status={isMobile ? "info" : "success"} />
                  </div>
                  <div>
                    <p className="font-medium">Responsive</p>
                    <p className="text-sm text-muted-foreground">
                      {isMobile ? 'Mobile' : 'Desktop'} layout
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <StatusBadge status={prefersReducedMotion ? "warning" : "success"} />
                  </div>
                  <div>
                    <p className="font-medium">Animations</p>
                    <p className="text-sm text-muted-foreground">
                      {prefersReducedMotion ? 'Reduced' : 'Full'} motion
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <StatusBadge status="success" />
                  </div>
                  <div>
                    <p className="font-medium">Accessibility</p>
                    <p className="text-sm text-muted-foreground">
                      WCAG 2.1 AA compliant
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Interactive Demo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.3, delay: 0.1 }}
          className="mb-8"
        >
          <Card>
            <CardHeader>
              <CardTitle>Interactive Demo</CardTitle>
              <CardDescription>
                Test the design system components and their interactions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Component Showcase */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Buttons Section */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Buttons & Actions</h3>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => setNotifications(n => n + 1)}>
                        Add Notification
                      </Button>
                      <Button 
                        variant="secondary"
                        onClick={() => setNotifications(Math.max(0, notifications - 1))}
                      >
                        Remove Notification
                      </Button>
                      <Button variant="outline">
                        Outline
                      </Button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      <Button variant="destructive" size="sm">
                        <X className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                      <Button variant="ghost" size="sm">
                        Cancel
                      </Button>
                      <Button size="lg">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Confirm
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Badges Section */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Status & Badges</h3>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status="success">Active</StatusBadge>
                      <StatusBadge status="warning">Pending</StatusBadge>
                      <StatusBadge status="error">Failed</StatusBadge>
                      <StatusBadge status="info">Info</StatusBadge>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      <PriorityBadge priority="low" />
                      <PriorityBadge priority="medium" />
                      <PriorityBadge priority="high" />
                      <PriorityBadge priority="urgent" />
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" dismissible>
                        Dismissible
                      </Badge>
                      <Badge variant="secondary" count={42}>
                        With Count
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Form Elements */}
              <div className="space-y-4">
                <h3 className="font-semibold">Form Elements</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="demo-input">Standard Input</Label>
                    <Input 
                      id="demo-input"
                      placeholder="Enter some text..."
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="demo-search">Search Input</Label>
                    <Input 
                      id="demo-search"
                      type="search"
                      placeholder="Search..."
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="demo-error">Error State</Label>
                    <Input 
                      id="demo-error"
                      placeholder="This has an error"
                      aria-invalid="true"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="advanced-mode"
                      checked={showAdvanced}
                      onCheckedChange={setShowAdvanced}
                    />
                    <Label htmlFor="advanced-mode">Advanced Mode</Label>
                  </div>
                </div>
              </div>

              {/* Advanced Features */}
              {showAdvanced && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
                  className="space-y-4"
                >
                  <Separator />
                  <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Accessibility className="h-4 w-4" />
                      Advanced Accessibility Features
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card className="p-4">
                        <h4 className="font-medium mb-2">Screen Reader Test</h4>
                        <Button 
                          onClick={() => screenReader.announce('This is a test announcement for screen readers', 'assertive')}
                          size="sm"
                        >
                          Test Announcement
                        </Button>
                      </Card>
                      
                      <Card className="p-4">
                        <h4 className="font-medium mb-2">Keyboard Navigation</h4>
                        <p className="text-sm text-muted-foreground">
                          Use Tab, Enter, Space, and Arrow keys to navigate
                        </p>
                      </Card>
                    </div>
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Full Design System Showcase */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.3, delay: 0.2 }}
        >
          <DesignSystemShowcase />
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card/50 backdrop-blur-sm mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Palette className="h-4 w-4" />
              Gastronomos Design System v2.0
            </div>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>WCAG 2.1 AA Compliant</span>
              <Separator orientation="vertical" className="h-4" />
              <span>Responsive Design</span>
              <Separator orientation="vertical" className="h-4" />
              <span>Motion Safe</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default DesignSystemDemo;