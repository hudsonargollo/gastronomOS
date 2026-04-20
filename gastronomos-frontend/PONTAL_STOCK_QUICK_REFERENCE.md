# Pontal Stock - Quick Reference Card

## Color Palette

```
Primary:        #2d5016  (Deep Forest Green)
Secondary:      #ea580c  (Sunset Orange)
Accent:         #f4a460  (Sandy Brown)
Background:     #faf8f3  (Warm Sea Foam)
Surface:        #ffffff  (Pure White)
Text:           #1c2912  (Dark Earth)
Text Secondary: #5a6b3d  (Muted Olive)
```

## CSS Variables

```css
--color-primary
--color-secondary
--color-accent
--color-background
--color-surface
--color-text
--color-text-secondary

--token-action-primary
--token-action-secondary
--token-action-danger
--token-action-success

--token-surface-base
--token-surface-elevated
--token-surface-overlay

--token-text-primary
--token-text-secondary
--token-text-tertiary
--token-text-inverse

--token-status-info
--token-status-success
--token-status-warning
--token-status-error

--token-interactive-hover
--token-interactive-active
--token-interactive-focus
--token-interactive-disabled

--font-heading
--font-body
```

## Fonts

- **Headings**: Syne (400, 500, 600, 700, 800)
- **Body**: JetBrains Mono (300, 400, 500, 600, 700)

## Common Usage

### Primary Button
```css
background-color: var(--token-action-primary);
color: var(--token-text-inverse);
```

### Secondary Button
```css
background-color: var(--token-surface-elevated);
color: var(--token-action-primary);
border: 2px solid var(--token-action-primary);
```

### Danger Button
```css
background-color: var(--token-action-danger);
color: white;
```

### Success Button
```css
background-color: var(--token-action-success);
color: white;
```

### Focus State
```css
outline: 2px solid var(--token-interactive-focus);
outline-offset: 2px;
```

### Hover State
```css
background-color: var(--token-interactive-hover);
```

### Text
```css
color: var(--token-text-primary);
font-family: var(--font-body);
```

### Heading
```css
color: var(--token-text-primary);
font-family: var(--font-heading);
```

### Status Badge - Low Stock
```css
background-color: rgba(244, 164, 96, 0.2);
color: #f4a460;
border: 1px solid #f4a460;
```

### Status Badge - Emergency
```css
background-color: rgba(220, 38, 38, 0.2);
color: #dc2626;
border: 1px solid #dc2626;
```

### Status Badge - Normal
```css
background-color: rgba(45, 80, 22, 0.2);
color: #2d5016;
border: 1px solid #2d5016;
```

### Status Badge - Success
```css
background-color: rgba(22, 163, 74, 0.2);
color: #16a34a;
border: 1px solid #16a34a;
```

## Context Usage

### Get Branding
```typescript
const { branding } = useBranding();
// branding.businessName = 'Pontal Stock'
// branding.logo = '/logos/pontal-carapitangui.webp'
// branding.tenantId = 'pontal-carapitangui'
```

### Get Theme
```typescript
const { palette, typography } = useTheme();
// palette.primary = '#2d5016'
// typography.headingFont = 'Syne'
```

## Logo

**Path**: `/public/logos/pontal-carapitangui.webp`

```html
<img 
  src="/logos/pontal-carapitangui.webp" 
  alt="Pontal Stock"
  className="h-10 w-auto"
/>
```

## Status Indicators

```typescript
import { pontalStockStatusIndicators } from '@/lib/design-system/pontal-stock-config';

// Available statuses:
// - lowStock
// - emergency
// - normal
// - success

const indicator = pontalStockStatusIndicators.lowStock;
// indicator.color = '#f4a460'
// indicator.label = 'Estoque Baixo'
```

## Animations

### Blob Animation
```css
.animate-blob {
  animation: blob 7s infinite;
}

.animation-delay-2000 {
  animation-delay: 2s;
}

.animation-delay-4000 {
  animation-delay: 4s;
}
```

## Accessibility

- **Color Contrast**: All text meets WCAG AA (4.5:1 minimum)
- **Focus States**: Clear 2px outline with Sandy Brown color
- **Typography**: Monospaced body font for readability
- **Status**: Not relying on color alone; includes labels

## Files

- **Design System**: `/src/lib/design-system/`
- **Config**: `/src/lib/design-system/pontal-stock-config.ts`
- **Theme Context**: `/src/contexts/theme-context.tsx`
- **Branding Context**: `/src/contexts/branding-context.tsx`
- **Styles**: `/src/app/globals.css`
- **Documentation**: `PONTAL_STOCK_DESIGN_SYSTEM.md`
- **Guide**: `PONTAL_STOCK_IMPLEMENTATION_GUIDE.md`

## Tenant Info

- **ID**: pontal-carapitangui
- **Name**: Pontal Stock
- **Theme**: PONTAL_STOCK
- **Logo**: /logos/pontal-carapitangui.webp

## Quick Links

- [Design System](./PONTAL_STOCK_DESIGN_SYSTEM.md)
- [Implementation Guide](./PONTAL_STOCK_IMPLEMENTATION_GUIDE.md)
- [Rebranding Summary](./PONTAL_STOCK_REBRANDING_SUMMARY.md)
