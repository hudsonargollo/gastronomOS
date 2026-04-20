# Pontal Stock Design System
## Maraú Sunset Palette

The Pontal Stock system has been rebranded with a sophisticated design system inspired by the natural elements of Barra Grande, combining deep forest greens, warm beach sands, and signature sunset orange.

---

## 1. Color Palette: "Maraú Sunset"

The palette captures the essence of the beach club environment with carefully selected colors:

### Primary Colors

| Color | Hex | Name | Usage |
|-------|-----|------|-------|
| **Primary** | `#2d5016` | Deep Forest Green | Interactive elements, buttons, primary actions |
| **Secondary** | `#ea580c` | Sunset Orange | Branding signature, highlights |
| **Accent** | `#f4a460` | Sandy Brown | Focus states, interactive feedback |

### Neutral Colors

| Color | Hex | Name | Usage |
|-------|-----|------|-------|
| **Background** | `#faf8f3` | Warm Sea Foam | Page backgrounds, base surfaces |
| **Surface** | `#ffffff` | Pure White | Cards, containers, elevated surfaces |
| **Text Primary** | `#1c2912` | Dark Earth | Main text, high contrast |
| **Text Secondary** | `#5a6b3d` | Muted Olive | Secondary text, subtle information |

---

## 2. Semantic Token Mapping

Tokens map functional names to colors for consistency across the system:

### Action Tokens
- `--token-action-primary`: `#2d5016` (Forest Green) - Primary interactive elements
- `--token-action-secondary`: `#ea580c` (Sunset Orange) - Secondary actions
- `--token-action-danger`: `#dc2626` (Red) - Destructive actions
- `--token-action-success`: `#16a34a` (Green) - Success states

### Surface Tokens
- `--token-surface-base`: `#faf8f3` (Warm Sea Foam) - Base backgrounds
- `--token-surface-elevated`: `#ffffff` (Pure White) - Elevated containers
- `--token-surface-overlay`: `rgba(0, 0, 0, 0.95)` - Modal overlays

### Text Tokens
- `--token-text-primary`: `#1c2912` (Dark Earth) - Primary text
- `--token-text-secondary`: `#5a6b3d` (Muted Olive) - Secondary text
- `--token-text-tertiary`: `rgba(0, 0, 0, 0.6)` - Tertiary text
- `--token-text-inverse`: `#faf8f3` (Warm Sea Foam) - Inverse text

### Interactive Tokens
- `--token-interactive-hover`: `rgba(45, 80, 22, 0.9)` - Hover state
- `--token-interactive-active`: `rgba(45, 80, 22, 0.8)` - Active state
- `--token-interactive-focus`: `#f4a460` (Sandy Brown) - Focus state
- `--token-interactive-disabled`: `rgba(0, 0, 0, 0.4)` - Disabled state

### Status Tokens
- `--token-status-info`: `#3b82f6` (Blue) - Information
- `--token-status-success`: `#16a34a` (Green) - Success
- `--token-status-warning`: `#f59e0b` (Amber) - Warning
- `--token-status-error`: `#dc2626` (Red) - Error

---

## 3. Typography & Identity

The system uses a sophisticated pairing of fonts optimized for inventory management:

### Heading Font: Syne
- **Purpose**: Premium, architectural feel reflecting the beach club atmosphere
- **Usage**: All headings (h1-h6), titles, section headers
- **Weights**: 400, 500, 600, 700, 800
- **CSS Variable**: `--font-heading`

### Body Font: JetBrains Mono
- **Purpose**: Precision and readability for stock levels and SKU numbers
- **Usage**: Body text, data displays, inventory information
- **Weights**: 300, 400, 500, 600, 700
- **CSS Variable**: `--font-body`

### Font Stack
```css
--font-heading: 'Syne', system-ui, -apple-system, sans-serif;
--font-body: 'JetBrains Mono', 'Courier New', monospace;
```

---

## 4. Visual Components & Effects

### Glassmorphism
The UI incorporates glassmorphism effects to create a premium feel:
- Frosted glass containers with subtle transparency
- Soft shadows for depth
- Smooth transitions between states

### Organic Animations
Background animations simulate water and light movement:
- `animate-blob`: 7-second infinite animation
- Animation delays: 2s, 4s for staggered effects
- Creates premium atmosphere without distracting from data

### Bento Box Layouts
Dashboard organization using grid-based layouts:
- Stock alerts
- Recent transfers
- Delivery status
- Performance metrics

### Status Ribbons
High-visibility indicators for critical states:
- **Low Stock**: Sandy Brown (`#f4a460`)
- **Emergency Transfer**: Red (`#dc2626`)
- **Normal**: Forest Green (`#2d5016`)
- **Success**: Green (`#16a34a`)

---

## 5. Implementation Guide

### Using the Branding Configuration

```typescript
import { pontalStockBrandingConfig } from '@/lib/design-system/pontal-stock-config';
import { useBranding } from '@/contexts/branding-context';

export function MyComponent() {
  const { branding, updateBranding } = useBranding();
  
  // Apply Pontal Stock branding
  useEffect(() => {
    updateBranding(pontalStockBrandingConfig);
  }, []);
  
  return (
    <div>
      <img src={branding.logo} alt={branding.businessName} />
      <h1>{branding.businessName}</h1>
    </div>
  );
}
```

### Using Theme Context

```typescript
import { useTheme } from '@/contexts/theme-context';
import { ThemeName } from '@/lib/design-system/types';

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  
  return (
    <button onClick={() => setTheme(ThemeName.PONTAL_STOCK)}>
      Switch to Pontal Stock
    </button>
  );
}
```

### Using Semantic Tokens in CSS

```css
.button-primary {
  background-color: var(--token-action-primary);
  color: var(--token-text-inverse);
  border: 1px solid var(--token-border-default);
}

.button-primary:hover {
  background-color: var(--token-interactive-hover);
}

.button-primary:focus {
  outline: 2px solid var(--token-interactive-focus);
}
```

### Using Status Indicators

```typescript
import { pontalStockStatusIndicators } from '@/lib/design-system/pontal-stock-config';

export function StockStatus({ level }) {
  const status = level < 10 ? 'lowStock' : 'normal';
  const indicator = pontalStockStatusIndicators[status];
  
  return (
    <div style={{ color: indicator.color }}>
      {indicator.label}
    </div>
  );
}
```

---

## 6. Asset Locations

### Logo
- **Path**: `/public/logos/pontal-carapitangui.webp`
- **Usage**: Header, branding, favicon
- **Formats**: WebP (optimized), SVG (vector)

### Fonts
- **Syne**: Google Fonts (auto-loaded)
- **JetBrains Mono**: Google Fonts (auto-loaded)

---

## 7. CSS Custom Properties Reference

All design tokens are available as CSS custom properties:

```css
/* Colors */
--color-primary: #2d5016;
--color-secondary: #ea580c;
--color-accent: #f4a460;
--color-background: #faf8f3;
--color-surface: #ffffff;
--color-text: #1c2912;
--color-text-secondary: #5a6b3d;

/* Typography */
--font-heading: 'Syne', sans-serif;
--font-body: 'JetBrains Mono', monospace;

/* Semantic Tokens */
--token-action-primary: #2d5016;
--token-action-secondary: #ea580c;
--token-interactive-focus: #f4a460;
--token-surface-base: #faf8f3;
--token-text-primary: #1c2912;
```

---

## 8. Accessibility Considerations

- **Color Contrast**: All text meets WCAG AA standards (4.5:1 minimum)
- **Focus States**: Clear focus indicators using Sandy Brown accent
- **Typography**: Monospaced body font improves readability for data-heavy screens
- **Status Indicators**: Not relying on color alone; includes labels

---

## 9. Migration from GastronomOS

The system has been successfully rebranded from GastronomOS to Pontal Stock:

### Changes Made
1. ✅ Logo moved to `/public/logos/pontal-carapitangui.webp`
2. ✅ Color palette updated to Maraú Sunset
3. ✅ Typography configured with Syne and JetBrains Mono
4. ✅ Semantic tokens mapped to Pontal Stock colors
5. ✅ Branding context updated with Pontal Stock defaults
6. ✅ Theme context set to PONTAL_STOCK as default
7. ✅ CSS custom properties updated in globals.css
8. ✅ Metadata updated in layout.tsx

### Default Configuration
- **Tenant ID**: `pontal-carapitangui`
- **Business Name**: `Pontal Stock`
- **Theme**: `PONTAL_STOCK`
- **Logo**: `/logos/pontal-carapitangui.webp`

---

## 10. Future Enhancements

- [ ] Add dark mode variant with adjusted colors
- [ ] Create component library with Pontal Stock styling
- [ ] Add animation library for glassmorphism effects
- [ ] Implement responsive design tokens
- [ ] Create design tokens documentation site
- [ ] Add accessibility audit report

---

## Support

For questions or issues with the Pontal Stock design system, refer to:
- Design System Documentation: `/src/lib/design-system/`
- Branding Configuration: `/src/lib/design-system/pontal-stock-config.ts`
- Theme Context: `/src/contexts/theme-context.tsx`
- Branding Context: `/src/contexts/branding-context.tsx`
