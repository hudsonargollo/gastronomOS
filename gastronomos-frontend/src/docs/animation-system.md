# Enhanced Animation System

The Enhanced Animation System provides a comprehensive solution for smooth, performant animations throughout the Gastronomos application using Framer Motion.

## Features

- **Consistent Animation Configuration**: Centralized animation settings with performance monitoring
- **AnimatedPage Components**: Pre-built page transition components for different page types
- **Performance Monitoring**: Real-time frame rate and memory usage tracking
- **Automatic Performance Optimization**: Dynamic adjustment based on device performance
- **Accessibility Support**: Respects user's reduced motion preferences
- **TypeScript Support**: Full type safety for all animation components

## Quick Start

### 1. Wrap your app with AnimationProvider

```tsx
import { AnimationProvider } from '@/contexts/animation-context';

function App() {
  return (
    <AnimationProvider>
      {/* Your app content */}
    </AnimationProvider>
  );
}
```

### 2. Use AnimatedPage for page transitions

```tsx
import { AnimatedPage, DashboardPage } from '@/components/ui/animated-page';

function MyPage() {
  return (
    <DashboardPage>
      <div>Your page content</div>
    </DashboardPage>
  );
}
```

### 3. Apply animation variants to components

```tsx
import { motion } from 'framer-motion';
import { fadeInOut, buttonVariants } from '@/lib/animation-utils';

function MyComponent() {
  return (
    <motion.div variants={fadeInOut} initial="initial" animate="animate">
      <motion.button variants={buttonVariants} whileHover="hover" whileTap="tap">
        Click me
      </motion.button>
    </motion.div>
  );
}
```

## Core Components

### AnimationProvider

Provides animation configuration and performance monitoring throughout the app.

```tsx
<AnimationProvider initialConfig={{ duration: 0.2, performanceMode: 'high' }}>
  {children}
</AnimationProvider>
```

### AnimatedPage

Wrapper component for consistent page transitions.

```tsx
<AnimatedPage transition={transitions.smooth} className="custom-class">
  {children}
</AnimatedPage>
```

### Specialized Page Components

- `DashboardPage`: Optimized for dashboard layouts with scaling animations
- `FormPage`: Slide animations for form-based pages
- `ListPage`: Vertical slide animations for list-based pages

## Animation Variants

### Basic Variants

```tsx
import {
  fadeInOut,
  slideInFromRight,
  slideInFromLeft,
  scaleInOut,
  modalVariants
} from '@/lib/animation-utils';
```

### Interactive Variants

```tsx
import {
  buttonVariants,
  cardVariants,
  listItemVariants
} from '@/lib/animation-utils';
```

### Container Variants

```tsx
import {
  staggerContainer,
  createStaggeredAnimation
} from '@/lib/animation-utils';

// Usage
<motion.div variants={staggerContainer}>
  {items.map(item => (
    <motion.div key={item.id} variants={listItemVariants}>
      {item.content}
    </motion.div>
  ))}
</motion.div>
```

## Performance Monitoring

### useAnimationPerformance Hook

```tsx
import { useAnimationPerformance } from '@/hooks/use-animation-performance';

function MyComponent() {
  const { performance, isPerformanceGood, performanceIssues } = useAnimationPerformance();
  
  return (
    <div>
      <p>FPS: {performance.fps}</p>
      <p>Performance: {isPerformanceGood ? 'Good' : 'Issues'}</p>
    </div>
  );
}
```

### Performance Monitor Component

```tsx
import { PerformanceMonitor } from '@/components/ui/performance-monitor';

// Development overlay (Ctrl/Cmd + Shift + P to toggle)
<DevPerformanceMonitor />

// Custom monitor
<PerformanceMonitor visible={true} position="top-right" compact={false} />
```

## Configuration

### Animation Configuration

```tsx
import { useAnimationConfig } from '@/contexts/animation-context';

function Settings() {
  const { config, updateConfig } = useAnimationConfig();
  
  const handleSpeedChange = (speed: 'fast' | 'normal' | 'slow') => {
    const duration = speed === 'fast' ? 0.15 : speed === 'slow' ? 0.5 : 0.3;
    updateConfig({ duration });
  };
}
```

### Performance Modes

- **High Performance**: Full animations with complex effects
- **Medium Performance**: Reduced complexity, shorter durations
- **Low Performance**: Minimal animations, focus on functionality

The system automatically adjusts performance mode based on detected frame rate.

## Accessibility

The system automatically respects the user's `prefers-reduced-motion` setting:

```tsx
import { useReducedMotion } from '@/contexts/animation-context';

function MyComponent() {
  const reducedMotion = useReducedMotion();
  
  return (
    <motion.div
      animate={reducedMotion ? {} : { x: 100 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.3 }}
    >
      Content
    </motion.div>
  );
}
```

## Best Practices

### 1. Use Appropriate Variants

- Use `fadeInOut` for simple show/hide animations
- Use `slideInFrom*` for directional transitions
- Use `modalVariants` for dialog and popup animations
- Use `staggerContainer` with `listItemVariants` for list animations

### 2. Performance Considerations

- Monitor performance in development using the DevPerformanceMonitor
- Use `layout` animations sparingly on complex layouts
- Prefer `transform` properties over layout-affecting properties
- Use `will-change: transform` for elements that will be animated

### 3. Responsive Animations

```tsx
import { getResponsiveVariants } from '@/lib/animation-utils';

function ResponsiveComponent() {
  const [isMobile, setIsMobile] = useState(false);
  
  return (
    <motion.div variants={getResponsiveVariants(isMobile)}>
      Content
    </motion.div>
  );
}
```

### 4. Error Handling

The system includes automatic fallbacks:
- Animation failures fall back to CSS transitions
- Performance issues trigger automatic optimization
- Reduced motion preferences are automatically respected

## Troubleshooting

### Low Performance

If you notice performance issues:

1. Check the performance monitor for frame rate drops
2. Reduce animation complexity in performance mode
3. Use `will-change: transform` on animated elements
4. Avoid animating layout properties

### Animation Not Working

1. Ensure AnimationProvider wraps your app
2. Check that Framer Motion is properly installed
3. Verify animation variants are correctly applied
4. Check browser console for errors

### Memory Leaks

The system includes automatic cleanup, but you can help by:
- Using the provided hooks instead of direct Framer Motion APIs
- Properly unmounting animated components
- Avoiding creating new animation objects in render functions

## Development Tools

### Performance Monitor Keyboard Shortcut

Press `Ctrl/Cmd + Shift + P` to toggle the development performance monitor.

### Animation Demo

Run the animation demo to test all system features:

```tsx
import { AnimationDemo } from '@/examples/animation-demo';

<AnimationDemo />
```

This provides a comprehensive testing environment for all animation features.

## Related Documentation

- **[Wizard Workflow Guide](./wizard-workflow-guide.md)**: Multi-step guided interfaces
- **[CRUD System Enhancements](./crud-system-enhancements.md)**: Enhanced data operations
- **[Performance Optimization Guide](./performance-optimization-guide.md)**: Performance and memory management
- **[Comprehensive Error Handling](./comprehensive-error-handling.md)**: Error handling strategies
- **[Main Documentation](./README.md)**: Complete system overview