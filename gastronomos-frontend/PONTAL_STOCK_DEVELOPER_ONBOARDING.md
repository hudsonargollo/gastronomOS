# Pontal Stock - Developer Onboarding Guide

Welcome to the Pontal Stock project! This guide will help you get up to speed with the new design system and branding.

---

## What Changed?

The system has been rebranded from **GastronomOS** to **Pontal Stock** with a comprehensive design system based on the Maraú Sunset palette.

### Key Changes:
- 🎨 New color palette (Deep Forest Green, Sunset Orange, Sandy Brown)
- 📝 New typography (Syne headings, JetBrains Mono body)
- 🏢 New branding (Pontal Stock, pontal-carapitangui tenant)
- 📍 New logo location (`/public/logos/pontal-carapitangui.webp`)
- 🎯 New semantic tokens for consistent styling

---

## Getting Started

### 1. Understand the Design System

Start by reading the documentation in this order:

1. **Quick Reference** (`PONTAL_STOCK_QUICK_REFERENCE.md`)
   - 5-minute overview of colors, fonts, and CSS variables
   - Perfect for quick lookups

2. **Design System** (`PONTAL_STOCK_DESIGN_SYSTEM.md`)
   - Complete design system specification
   - Color palette, typography, components
   - Implementation guidelines

3. **Implementation Guide** (`PONTAL_STOCK_IMPLEMENTATION_GUIDE.md`)
   - Practical examples for common patterns
   - How to use contexts and tokens
   - Component implementation examples

### 2. Explore the Code

Key files to understand:

```
src/lib/design-system/
├── types.ts                    # Type definitions (ThemeName enum)
├── palettes.ts                 # Color palettes (PONTAL_STOCK added)
├── semantic-tokens.ts          # Token generation
├── typography.ts               # Font configuration
└── pontal-stock-config.ts      # Pontal Stock specific config [NEW]

src/contexts/
├── theme-context.tsx           # Theme management (default: PONTAL_STOCK)
└── branding-context.tsx        # Branding management (default: Pontal Stock)

src/app/
├── layout.tsx                  # Root layout (updated metadata)
└── globals.css                 # Global styles (Pontal Stock colors)
```

### 3. Set Up Your Environment

No additional setup needed! The design system is already integrated:

- ✅ Fonts auto-load from Google Fonts
- ✅ Colors available as CSS variables
- ✅ Contexts ready to use
- ✅ Logo in correct location

---

## Common Tasks

### Task 1: Create a Button Component

```typescript
'use client';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  children: React.ReactNode;
  onClick?: () => void;
}

export function Button({ 
  variant = 'primary', 
  children, 
  onClick 
}: ButtonProps) {
  const variantStyles = {
    primary: 'bg-[var(--token-action-primary)] text-white hover:bg-[var(--token-interactive-hover)]',
    secondary: 'bg-white text-[var(--token-action-primary)] border-2 border-[var(--token-action-primary)]',
    danger: 'bg-[var(--token-action-danger)] text-white hover:bg-red-700',
    success: 'bg-[var(--token-action-success)] text-white hover:bg-green-700',
  };

  return (
    <button
      onClick={onClick}
      className={`
        px-4 py-2 rounded-lg font-semibold
        focus:outline-2 focus:outline-[var(--token-interactive-focus)]
        focus:outline-offset-2
        transition-colors duration-200
        ${variantStyles[variant]}
      `}
    >
      {children}
    </button>
  );
}
```

### Task 2: Display the Logo

```typescript
'use client';

import { useBranding } from '@/contexts/branding-context';

export function Header() {
  const { branding } = useBranding();

  return (
    <header className="bg-white border-b border-[var(--token-border-default)]">
      <div className="flex items-center gap-4 p-4">
        {branding.logo && (
          <img 
            src={branding.logo} 
            alt={branding.businessName}
            className="h-10 w-auto"
          />
        )}
        <h1 className="text-2xl font-bold text-[var(--token-text-primary)]">
          {branding.businessName}
        </h1>
      </div>
    </header>
  );
}
```

### Task 3: Create a Status Badge

```typescript
'use client';

import { pontalStockStatusIndicators } from '@/lib/design-system/pontal-stock-config';

interface StatusBadgeProps {
  status: 'lowStock' | 'emergency' | 'normal' | 'success';
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const indicator = pontalStockStatusIndicators[status];

  return (
    <span 
      className="px-3 py-1 rounded-full text-sm font-medium"
      style={{
        backgroundColor: `${indicator.color}20`,
        color: indicator.color,
        border: `1px solid ${indicator.color}`,
      }}
    >
      {indicator.label}
    </span>
  );
}
```

### Task 4: Use Theme Colors in CSS

```css
.card {
  background-color: var(--token-surface-elevated);
  border: 1px solid var(--token-border-default);
  border-radius: 0.625rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.card-title {
  color: var(--token-text-primary);
  font-family: var(--font-heading);
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.card-description {
  color: var(--token-text-secondary);
  font-family: var(--font-body);
  font-size: 0.875rem;
}

.card:hover {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
```

### Task 5: Create a Form Input

```typescript
'use client';

interface InputProps {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}

export function Input({ label, placeholder, value, onChange }: InputProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-[var(--token-text-primary)]">
        {label}
      </label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="
          px-4 py-2 rounded-lg
          border border-[var(--token-border-default)]
          bg-[var(--token-surface-elevated)]
          text-[var(--token-text-primary)]
          placeholder-[var(--token-text-tertiary)]
          focus:outline-2 focus:outline-[var(--token-interactive-focus)]
          focus:outline-offset-2
          transition-colors duration-200
        "
      />
    </div>
  );
}
```

---

## Color Palette Quick Reference

### When to Use Each Color

**Primary Green (#2d5016)**
- Primary buttons
- Active navigation items
- Main interactive elements
- Primary headings

**Secondary Orange (#ea580c)**
- Branding highlights
- Important notifications
- Call-to-action elements
- Accent borders

**Accent Brown (#f4a460)**
- Focus indicators
- Hover states
- Interactive feedback
- Subtle highlights

**Background Cream (#faf8f3)**
- Page backgrounds
- Base surfaces
- Subtle backgrounds

**Surface White (#ffffff)**
- Cards
- Containers
- Elevated surfaces
- Modal backgrounds

**Text Dark (#1c2912)**
- Primary text
- Headings
- High contrast text

**Text Secondary (#5a6b3d)**
- Secondary text
- Subtle information
- Disabled text

---

## Typography Guidelines

### Headings (Syne Font)
```css
h1 { font-size: 2.5rem; font-weight: 800; }
h2 { font-size: 2rem; font-weight: 700; }
h3 { font-size: 1.5rem; font-weight: 600; }
h4 { font-size: 1.25rem; font-weight: 600; }
h5 { font-size: 1rem; font-weight: 600; }
h6 { font-size: 0.875rem; font-weight: 600; }
```

### Body Text (JetBrains Mono)
```css
body { font-size: 1rem; line-height: 1.5; }
small { font-size: 0.875rem; }
.data-value { font-size: 1.125rem; font-weight: 600; }
.data-label { font-size: 0.75rem; text-transform: uppercase; }
```

---

## CSS Variables Available

```css
/* Colors */
--color-primary
--color-secondary
--color-accent
--color-background
--color-surface
--color-text
--color-text-secondary

/* Typography */
--font-heading
--font-body

/* Semantic Tokens */
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
--token-border-subtle
--token-border-default
--token-border-strong
```

---

## Testing Your Implementation

### Checklist
- [ ] Logo displays correctly
- [ ] Colors match the Maraú Sunset palette
- [ ] Fonts are Syne (headings) and JetBrains Mono (body)
- [ ] Focus states are visible (Sandy Brown outline)
- [ ] Hover states work correctly
- [ ] Status indicators display properly
- [ ] Text contrast is sufficient (WCAG AA)
- [ ] Responsive design works on mobile/tablet/desktop

### Browser Testing
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile browsers

---

## Common Mistakes to Avoid

❌ **Don't**: Use hardcoded colors
```typescript
// ❌ Wrong
<div style={{ backgroundColor: '#2d5016' }}>
```

✅ **Do**: Use CSS variables
```typescript
// ✅ Correct
<div className="bg-[var(--token-action-primary)]">
```

---

❌ **Don't**: Use different fonts
```css
/* ❌ Wrong */
h1 { font-family: Arial; }
p { font-family: Helvetica; }
```

✅ **Do**: Use the design system fonts
```css
/* ✅ Correct */
h1 { font-family: var(--font-heading); }
p { font-family: var(--font-body); }
```

---

❌ **Don't**: Ignore focus states
```css
/* ❌ Wrong */
button:focus { outline: none; }
```

✅ **Do**: Use the focus token
```css
/* ✅ Correct */
button:focus {
  outline: 2px solid var(--token-interactive-focus);
  outline-offset: 2px;
}
```

---

## Resources

### Documentation
- [Quick Reference](./PONTAL_STOCK_QUICK_REFERENCE.md) - 5-minute overview
- [Design System](./PONTAL_STOCK_DESIGN_SYSTEM.md) - Complete specification
- [Implementation Guide](./PONTAL_STOCK_IMPLEMENTATION_GUIDE.md) - Practical examples
- [Rebranding Summary](./PONTAL_STOCK_REBRANDING_SUMMARY.md) - What changed

### Code
- Design System: `src/lib/design-system/`
- Contexts: `src/contexts/`
- Styles: `src/app/globals.css`
- Config: `src/lib/design-system/pontal-stock-config.ts`

### Assets
- Logo: `/public/logos/pontal-carapitangui.webp`

---

## Getting Help

### Questions?
1. Check the Quick Reference first
2. Read the relevant documentation
3. Look at implementation examples
4. Check the source code

### Issues?
1. Verify you're using CSS variables
2. Check browser console for errors
3. Verify fonts are loading
4. Check color contrast

---

## Next Steps

1. ✅ Read this onboarding guide
2. ✅ Review the Quick Reference
3. ✅ Read the Design System documentation
4. ✅ Review the Implementation Guide
5. ✅ Start implementing components
6. ✅ Test your implementation
7. ✅ Ask questions if needed

---

## Welcome to Pontal Stock! 🎉

You're now ready to build beautiful, consistent interfaces with the Pontal Stock design system. Happy coding!

For questions or issues, refer to the documentation or contact the design team.
