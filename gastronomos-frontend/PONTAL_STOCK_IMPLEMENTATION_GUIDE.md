# Pontal Stock Implementation Guide

## Quick Start

The system has been successfully rebranded to **Pontal Stock** with the Maraú Sunset design system. Here's how to use it in your components.

---

## 1. Using the Branding Context

Access the Pontal Stock branding in any component:

```typescript
'use client';

import { useBranding } from '@/contexts/branding-context';

export function Header() {
  const { branding } = useBranding();
  
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="flex items-center gap-4 p-4">
        {branding.logo && (
          <img 
            src={branding.logo} 
            alt={branding.businessName}
            className="h-10 w-auto"
          />
        )}
        <h1 className="text-2xl font-bold text-[var(--color-text)]">
          {branding.businessName}
        </h1>
      </div>
    </header>
  );
}
```

---

## 2. Using the Theme Context

Access and switch themes:

```typescript
'use client';

import { useTheme } from '@/contexts/theme-context';
import { ThemeName } from '@/lib/design-system/types';

export function ThemeSelector() {
  const { theme, setTheme, availableThemes } = useTheme();
  
  return (
    <select 
      value={theme} 
      onChange={(e) => setTheme(e.target.value as ThemeName)}
    >
      {availableThemes.map((t) => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
  );
}
```

---

## 3. Using Semantic Tokens in CSS

Apply design tokens to your styles:

```css
/* Primary Button */
.btn-primary {
  background-color: var(--token-action-primary);
  color: var(--token-text-inverse);
  border: 1px solid var(--token-border-default);
  padding: 0.5rem 1rem;
  border-radius: 0.625rem;
  font-family: var(--font-heading);
  font-weight: 600;
  transition: all 0.2s ease;
}

.btn-primary:hover {
  background-color: var(--token-interactive-hover);
}

.btn-primary:focus {
  outline: 2px solid var(--token-interactive-focus);
  outline-offset: 2px;
}

.btn-primary:disabled {
  background-color: var(--token-interactive-disabled);
  cursor: not-allowed;
}

/* Secondary Button */
.btn-secondary {
  background-color: var(--token-surface-elevated);
  color: var(--token-action-primary);
  border: 2px solid var(--token-action-primary);
}

.btn-secondary:hover {
  background-color: var(--token-surface-base);
}

/* Danger Button */
.btn-danger {
  background-color: var(--token-action-danger);
  color: white;
}

.btn-danger:hover {
  background-color: #b91c1c;
}

/* Success Button */
.btn-success {
  background-color: var(--token-action-success);
  color: white;
}

.btn-success:hover {
  background-color: #15803d;
}
```

---

## 4. Using Status Indicators

Display inventory status with Pontal Stock indicators:

```typescript
'use client';

import { pontalStockStatusIndicators } from '@/lib/design-system/pontal-stock-config';

interface StockStatusProps {
  quantity: number;
  threshold?: number;
}

export function StockStatus({ quantity, threshold = 10 }: StockStatusProps) {
  let status: keyof typeof pontalStockStatusIndicators;
  
  if (quantity === 0) {
    status = 'emergency';
  } else if (quantity < threshold) {
    status = 'lowStock';
  } else {
    status = 'normal';
  }
  
  const indicator = pontalStockStatusIndicators[status];
  
  return (
    <div 
      className="px-3 py-1 rounded-full text-sm font-medium"
      style={{
        backgroundColor: `${indicator.color}20`,
        color: indicator.color,
        border: `1px solid ${indicator.color}`,
      }}
    >
      {indicator.label}
    </div>
  );
}
```

---

## 5. Using Color Palette in Components

Access colors directly from the palette:

```typescript
'use client';

import { useTheme } from '@/contexts/theme-context';

export function DashboardCard() {
  const { palette } = useTheme();
  
  return (
    <div 
      className="p-6 rounded-lg shadow-sm"
      style={{
        backgroundColor: palette.surface,
        borderLeft: `4px solid ${palette.primary}`,
      }}
    >
      <h3 style={{ color: palette.text }} className="font-bold">
        Stock Overview
      </h3>
      <p style={{ color: palette.textSecondary }}>
        Current inventory levels
      </p>
    </div>
  );
}
```

---

## 6. Using Typography

Apply the Pontal Stock typography:

```css
/* Headings use Syne */
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
  color: var(--token-text-primary);
}

h1 {
  font-size: 2.5rem;
  font-weight: 800;
  line-height: 1.2;
}

h2 {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.3;
}

h3 {
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.4;
}

/* Body text uses JetBrains Mono */
body, p, span, div {
  font-family: var(--font-body);
  color: var(--token-text-primary);
}

/* Data displays */
.data-value {
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 1.125rem;
  color: var(--token-text-primary);
}

.data-label {
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--token-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

---

## 7. Creating Bento Box Layouts

Use grid-based layouts for dashboard organization:

```typescript
'use client';

export function DashboardGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6">
      {/* Stock Alerts - Full width on mobile, 2 cols on tablet, 2 cols on desktop */}
      <div className="md:col-span-2 lg:col-span-2 bg-white rounded-lg p-6 shadow-sm">
        <h3 className="font-bold text-lg mb-4">Stock Alerts</h3>
        {/* Content */}
      </div>
      
      {/* Recent Transfers - 1 col */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h3 className="font-bold text-lg mb-4">Recent Transfers</h3>
        {/* Content */}
      </div>
      
      {/* Delivery Status - 1 col */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h3 className="font-bold text-lg mb-4">Delivery Status</h3>
        {/* Content */}
      </div>
      
      {/* Performance Metrics - Full width on mobile, 2 cols on tablet, 2 cols on desktop */}
      <div className="md:col-span-2 lg:col-span-2 bg-white rounded-lg p-6 shadow-sm">
        <h3 className="font-bold text-lg mb-4">Performance</h3>
        {/* Content */}
      </div>
      
      {/* Additional Metrics - 2 cols */}
      <div className="md:col-span-2 bg-white rounded-lg p-6 shadow-sm">
        <h3 className="font-bold text-lg mb-4">Metrics</h3>
        {/* Content */}
      </div>
    </div>
  );
}
```

---

## 8. Using Organic Animations

Add blob animations for premium feel:

```css
/* Animated background blob */
.blob-background {
  position: absolute;
  width: 300px;
  height: 300px;
  background: linear-gradient(135deg, #2d5016, #ea580c);
  border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%;
  opacity: 0.1;
  animation: blob 7s infinite;
}

.blob-background:nth-child(2) {
  animation-delay: 2s;
}

.blob-background:nth-child(3) {
  animation-delay: 4s;
}

@keyframes blob {
  0% {
    transform: translate(0px, 0px) scale(1);
  }
  33% {
    transform: translate(30px, -50px) scale(1.1);
  }
  66% {
    transform: translate(-20px, 20px) scale(0.9);
  }
  100% {
    transform: translate(0px, 0px) scale(1);
  }
}
```

---

## 9. Glassmorphism Effects

Create premium glass-like containers:

```css
.glass-container {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.625rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.glass-container:hover {
  background: rgba(255, 255, 255, 0.8);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}
```

---

## 10. Color Reference Quick Guide

### Use Primary Green (#2d5016) for:
- Primary buttons
- Active navigation items
- Primary interactive elements
- Focus states (with opacity)

### Use Secondary Orange (#ea580c) for:
- Branding highlights
- Important notifications
- Call-to-action elements
- Accent borders

### Use Accent Brown (#f4a460) for:
- Focus indicators
- Hover states
- Interactive feedback
- Subtle highlights

### Use Background Cream (#faf8f3) for:
- Page backgrounds
- Base surfaces
- Subtle backgrounds

### Use Surface White (#ffffff) for:
- Cards
- Containers
- Elevated surfaces
- Modal backgrounds

---

## 11. Testing the Implementation

To verify the Pontal Stock branding is working:

1. Check the logo appears in the header
2. Verify colors match the Maraú Sunset palette
3. Confirm fonts are Syne (headings) and JetBrains Mono (body)
4. Test interactive states (hover, focus, active)
5. Verify status indicators display correctly

---

## 12. Common Patterns

### Alert Box
```typescript
<div 
  className="p-4 rounded-lg border-l-4"
  style={{
    backgroundColor: `${pontalStockColors.accent}20`,
    borderColor: pontalStockColors.accent,
  }}
>
  <p style={{ color: pontalStockColors.text }}>
    Important information
  </p>
</div>
```

### Badge
```typescript
<span 
  className="px-3 py-1 rounded-full text-sm font-medium"
  style={{
    backgroundColor: pontalStockColors.primary,
    color: 'white',
  }}
>
  New
</span>
```

### Input Field
```typescript
<input
  type="text"
  className="w-full px-4 py-2 rounded-lg border"
  style={{
    borderColor: 'var(--token-border-default)',
    backgroundColor: 'var(--token-surface-elevated)',
    color: 'var(--token-text-primary)',
  }}
  placeholder="Enter value..."
/>
```

---

## Resources

- **Design System**: `/src/lib/design-system/`
- **Pontal Stock Config**: `/src/lib/design-system/pontal-stock-config.ts`
- **Design System Documentation**: `PONTAL_STOCK_DESIGN_SYSTEM.md`
- **Theme Context**: `/src/contexts/theme-context.tsx`
- **Branding Context**: `/src/contexts/branding-context.tsx`

---

## Support

For questions or issues, refer to the design system documentation or check the implementation examples in the codebase.
