# Design System Quick Reference

## Import Statements

```tsx
// Theme management
import { useTheme } from '@/contexts/theme-context';
import { useBranding } from '@/contexts/branding-context';

// Types
import { ThemeName, ColorPalette, TypographyConfig } from '@/lib/design-system/types';

// Utilities
import { 
  getContrastRatio, 
  meetsWCAGAA, 
  lightenColor, 
  darkenColor 
} from '@/lib/design-system/utils';
```

## Theme Switching

```tsx
const { theme, setTheme } = useTheme();

// Switch to a specific theme
setTheme(ThemeName.BISTRO_NOIR);
setTheme(ThemeName.NEON_DINER);
setTheme(ThemeName.ORGANIC_GARDEN);
setTheme(ThemeName.SIGNATURE);
```

## Accessing Colors

```tsx
const { palette } = useTheme();

// Use palette colors
<div style={{ backgroundColor: palette.primary }}>
  <span style={{ color: palette.text }}>Content</span>
</div>
```

## Semantic Tokens (CSS)

```css
/* Action tokens */
background-color: var(--token-action-primary);
background-color: var(--token-action-secondary);
background-color: var(--token-action-danger);
background-color: var(--token-action-success);

/* Surface tokens */
background-color: var(--token-surface-base);
background-color: var(--token-surface-elevated);
background-color: var(--token-surface-overlay);

/* Border tokens */
border-color: var(--token-border-subtle);
border-color: var(--token-border-default);
border-color: var(--token-border-strong);

/* Text tokens */
color: var(--token-text-primary);
color: var(--token-text-secondary);
color: var(--token-text-tertiary);
color: var(--token-text-inverse);

/* Status tokens */
color: var(--token-status-info);
color: var(--token-status-success);
color: var(--token-status-warning);
color: var(--token-status-error);

/* Interactive tokens */
background-color: var(--token-interactive-hover);
background-color: var(--token-interactive-active);
border-color: var(--token-interactive-focus);
color: var(--token-interactive-disabled);
```

## Typography

```tsx
const { typography, setTypography } = useTheme();

// Change typography
setTypography({
  headingFont: 'Syne',
  bodyFont: 'JetBrains Mono',
});

// Available combinations
// Editorial: Syne + JetBrains Mono
// Modern: Clash Display + Space Grotesk
// Mixed: Clash Display + JetBrains Mono
// Geometric: Syne + Space Grotesk
```

```css
/* Use typography in CSS */
font-family: var(--font-heading);  /* For headings */
font-family: var(--font-body);     /* For body text */
```

## Branding

```tsx
const { branding, uploadLogo, updateBranding } = useBranding();

// Upload logo
const handleLogoUpload = async (file: File) => {
  const logoUrl = await uploadLogo(file);
  console.log('Logo uploaded:', logoUrl);
};

// Update business name
updateBranding({ businessName: 'My Restaurant' });

// Add banner image
addBannerImage({
  id: 'banner-1',
  name: 'Hero Banner',
  url: '/images/banner.jpg',
  width: 1920,
  height: 1080,
  category: 'hero',
});
```

## Custom Colors

```tsx
const { setCustomColors } = useTheme();

// Override specific palette colors
setCustomColors({
  primary: '#ff0000',
  accent: '#00ff00',
});
```

## Color Utilities

```tsx
import { 
  lightenColor, 
  darkenColor, 
  withOpacity,
  getContrastRatio,
  meetsWCAGAA 
} from '@/lib/design-system/utils';

// Lighten a color by 20%
const lighter = lightenColor('#ff0000', 20);

// Darken a color by 30%
const darker = darkenColor('#ff0000', 30);

// Add opacity
const transparent = withOpacity('#ff0000', 0.5);

// Check contrast
const ratio = getContrastRatio('#000000', '#ffffff');
const accessible = meetsWCAGAA('#000000', '#ffffff');
```

## Theme Palettes

### Bistro Noir
```tsx
{
  primary: '#1a1a1a',        // Deep charcoal
  secondary: '#4a4a4a',      // Warm gray
  accent: '#d4af37',         // Gold
  background: '#f5f5f0',     // Warm off-white
  surface: '#ffffff',        // White
  text: '#1a1a1a',          // Deep charcoal
  textSecondary: '#6b6b6b', // Medium gray
}
```

### Neon Diner
```tsx
{
  primary: '#ff006e',        // Hot pink
  secondary: '#8338ec',      // Electric purple
  accent: '#00f5ff',         // Cyan neon
  background: '#0a0a0a',     // Near black
  surface: '#1a1a1a',        // Dark surface
  text: '#ffffff',           // White
  textSecondary: '#b0b0b0',  // Light gray
}
```

### Organic Garden
```tsx
{
  primary: '#2d5016',        // Deep forest green
  secondary: '#6b8e23',      // Olive green
  accent: '#f4a460',         // Sandy brown
  background: '#faf8f3',     // Cream
  surface: '#ffffff',        // White
  text: '#2d3319',          // Dark olive
  textSecondary: '#5a6b3d', // Muted green
}
```

### Signature (Default)
```tsx
{
  primary: '#ea580c',        // Orange
  secondary: '#dc2626',      // Red
  accent: '#f97316',         // Light orange
  background: '#f8fafc',     // Slate
  surface: '#ffffff',        // White
  text: '#0f172a',          // Slate 900
  textSecondary: '#64748b', // Slate 500
}
```

## Common Patterns

### Themed Button
```tsx
function ThemedButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      style={{
        backgroundColor: 'var(--token-action-primary)',
        color: 'var(--token-text-inverse)',
        padding: '0.5rem 1rem',
        borderRadius: '0.375rem',
        border: 'none',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--token-interactive-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--token-action-primary)';
      }}
    >
      {children}
    </button>
  );
}
```

### Themed Card
```tsx
function ThemedCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--token-surface-elevated)',
        border: '1px solid var(--token-border-default)',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        color: 'var(--token-text-primary)',
      }}
    >
      {children}
    </div>
  );
}
```

### Status Badge
```tsx
function StatusBadge({ status }: { status: 'info' | 'success' | 'warning' | 'error' }) {
  const tokenMap = {
    info: 'var(--token-status-info)',
    success: 'var(--token-status-success)',
    warning: 'var(--token-status-warning)',
    error: 'var(--token-status-error)',
  };
  
  return (
    <span
      style={{
        backgroundColor: tokenMap[status],
        color: 'white',
        padding: '0.25rem 0.75rem',
        borderRadius: '0.25rem',
        fontSize: '0.875rem',
        fontWeight: 500,
      }}
    >
      {status}
    </span>
  );
}
```

## Reset to Defaults

```tsx
const { resetTheme } = useTheme();
const { resetToDefaults } = useBranding();

// Reset theme to default
resetTheme();

// Reset branding to default
resetToDefaults();
```

## Demo Page

Visit `/design-system-demo` to see all features in action.

## Documentation

- Full documentation: `src/lib/design-system/README.md`
- Implementation details: `DESIGN_SYSTEM_IMPLEMENTATION.md`
- Task summary: `TASK_9.1_SUMMARY.md`
