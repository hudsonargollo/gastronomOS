# Adaptive Gastronomy Design System

A comprehensive theming and design system for the Digital Menu, Kitchen Orchestration & Payment System.

## Overview

The Adaptive Gastronomy Design System provides a flexible, tenant-specific theming architecture with semantic tokens, multiple color palettes, and typography configurations.

## Features

### 🎨 Four Color Palette Options

1. **Bistro Noir** - Elegant and sophisticated with deep charcoals and gold accents
2. **Neon Diner** - Bold and vibrant with electric colors on dark backgrounds
3. **Organic Garden** - Natural and earthy with forest greens and warm tones
4. **Signature** - Classic and versatile with orange and red accents (default)

### 📝 Typography: "The Editorial Menu"

- **Heading Fonts**: Syne or Clash Display (geometric, bold)
- **Body Fonts**: JetBrains Mono or Space Grotesk (monospaced, technical)
- Creates a unique contrast between editorial headings and technical body text

### 🎯 Semantic Token System

Functional naming for design consistency:

- **Action Tokens**: Primary, Secondary, Danger, Success
- **Surface Tokens**: Base, Elevated, Overlay
- **Border Tokens**: Subtle, Default, Strong
- **Text Tokens**: Primary, Secondary, Tertiary, Inverse
- **Status Tokens**: Info, Success, Warning, Error
- **Interactive Tokens**: Hover, Active, Focus, Disabled

## Usage

### Basic Setup

```tsx
import { ThemeProvider } from '@/contexts/theme-context';
import { BrandingProvider } from '@/contexts/branding-context';

function App() {
  return (
    <ThemeProvider>
      <BrandingProvider>
        {/* Your app content */}
      </BrandingProvider>
    </ThemeProvider>
  );
}
```

### Using the Theme Hook

```tsx
import { useTheme } from '@/contexts/theme-context';
import { ThemeName } from '@/lib/design-system/types';

function MyComponent() {
  const { theme, palette, setTheme } = useTheme();
  
  return (
    <div>
      <button onClick={() => setTheme(ThemeName.BISTRO_NOIR)}>
        Switch to Bistro Noir
      </button>
      <div style={{ color: palette.primary }}>
        Themed content
      </div>
    </div>
  );
}
```

### Using Semantic Tokens in CSS

```css
.my-button {
  background-color: var(--token-action-primary);
  color: var(--token-text-inverse);
}

.my-button:hover {
  background-color: var(--token-interactive-hover);
}

.my-card {
  background-color: var(--token-surface-elevated);
  border: 1px solid var(--token-border-default);
}
```

### Using Branding Context

```tsx
import { useBranding } from '@/contexts/branding-context';

function BrandedHeader() {
  const { branding, uploadLogo } = useBranding();
  
  return (
    <header>
      {branding.logo && <img src={branding.logo} alt={branding.businessName} />}
      <h1>{branding.businessName}</h1>
    </header>
  );
}
```

### Custom Typography Configuration

```tsx
import { useTheme } from '@/contexts/theme-context';

function TypographySettings() {
  const { typography, setTypography } = useTheme();
  
  const changeTypography = () => {
    setTypography({
      headingFont: 'Clash Display',
      bodyFont: 'Space Grotesk',
    });
  };
  
  return (
    <button onClick={changeTypography}>
      Change Typography
    </button>
  );
}
```

## Architecture

### Core Components

- **types.ts** - TypeScript type definitions
- **palettes.ts** - Color palette definitions
- **semantic-tokens.ts** - Semantic token generation and application
- **typography.ts** - Typography configuration and font loading

### Context Providers

- **ThemeProvider** - Manages theme selection and palette application
- **BrandingProvider** - Manages tenant-specific branding assets

## Color Palette Structure

```typescript
interface ColorPalette {
  primary: string;        // Main brand color
  secondary: string;      // Secondary brand color
  accent: string;         // Accent/highlight color
  background: string;     // Page background
  surface: string;        // Card/container background
  text: string;          // Primary text color
  textSecondary: string; // Secondary text color
}
```

## Semantic Token Categories

### Action Tokens
Used for buttons and interactive elements:
- `--token-action-primary`
- `--token-action-secondary`
- `--token-action-danger`
- `--token-action-success`

### Surface Tokens
Used for backgrounds and containers:
- `--token-surface-base`
- `--token-surface-elevated`
- `--token-surface-overlay`

### Border Tokens
Used for dividers and outlines:
- `--token-border-subtle`
- `--token-border-default`
- `--token-border-strong`

### Text Tokens
Used for typography:
- `--token-text-primary`
- `--token-text-secondary`
- `--token-text-tertiary`
- `--token-text-inverse`

### Status Tokens
Used for feedback and states:
- `--token-status-info`
- `--token-status-success`
- `--token-status-warning`
- `--token-status-error`

### Interactive Tokens
Used for hover, active, and focus states:
- `--token-interactive-hover`
- `--token-interactive-active`
- `--token-interactive-focus`
- `--token-interactive-disabled`

## Best Practices

1. **Use Semantic Tokens**: Always prefer semantic tokens over direct palette colors for better maintainability
2. **Theme Consistency**: Ensure all components respect the current theme
3. **Typography Hierarchy**: Use heading fonts for titles and body fonts for content
4. **Accessibility**: Ensure sufficient color contrast in all themes
5. **Custom Colors**: Use the `setCustomColors` function to override specific palette colors while maintaining the theme structure

## Extending the System

### Adding a New Theme

```typescript
// In palettes.ts
export const colorPalettes: Record<ThemeName, ColorPalette> = {
  // ... existing themes
  [ThemeName.MY_NEW_THEME]: {
    primary: '#...',
    secondary: '#...',
    accent: '#...',
    background: '#...',
    surface: '#...',
    text: '#...',
    textSecondary: '#...',
  },
};
```

### Adding Custom Semantic Tokens

```typescript
// Extend SemanticTokens interface in types.ts
export interface SemanticTokens {
  // ... existing tokens
  myCustomToken: string;
}

// Update generateSemanticTokens in semantic-tokens.ts
export function generateSemanticTokens(palette: ColorPalette): SemanticTokens {
  return {
    // ... existing tokens
    myCustomToken: palette.accent,
  };
}
```

## Testing

The design system includes comprehensive type safety and runtime validation. All theme changes are persisted to localStorage and automatically applied to the DOM.

## Performance

- Fonts are loaded asynchronously to prevent blocking
- CSS custom properties enable instant theme switching
- LocalStorage caching reduces initialization time
- Semantic tokens are generated once per theme change

## Browser Support

The design system uses modern CSS features:
- CSS Custom Properties (CSS Variables)
- Modern color formats (hex, rgba)
- System font stacks for fallbacks

Supports all modern browsers (Chrome, Firefox, Safari, Edge).
