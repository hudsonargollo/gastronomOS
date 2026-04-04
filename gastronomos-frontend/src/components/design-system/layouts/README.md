# Layout Components

Adaptive Gastronomy Design System - Non-Grid Grid Layout System

## Overview

The layout components implement the "Non-Grid Grid" design philosophy, providing flexible, asymmetric layouts that break away from traditional grid systems while maintaining visual harmony and functional organization.

## Components

### 1. Bento Box Layout

Dashboard layout component with asymmetric grid cells, inspired by Japanese bento box compartments.

**Usage:**
```tsx
import { BentoBox, BentoItem } from '@/components/design-system/layouts';

<BentoBox columns={3} gap="md">
  <BentoItem span={2} rowSpan={2} variant="elevated">
    <h3>Featured Content</h3>
  </BentoItem>
  <BentoItem span={1} variant="default">
    <h3>Small Item</h3>
  </BentoItem>
</BentoBox>
```

**Props:**
- `BentoBox`:
  - `columns`: 2 | 3 | 4 - Number of columns in the grid
  - `gap`: 'sm' | 'md' | 'lg' - Spacing between items
  
- `BentoItem`:
  - `span`: 1 | 2 | 3 | 4 - Column span
  - `rowSpan`: 1 | 2 | 3 - Row span
  - `variant`: 'default' | 'elevated' | 'outlined' - Visual style

**Use Cases:**
- Dashboard layouts
- Analytics displays
- Multi-metric views
- Feature showcases

---

### 2. Floating Stack

Layered navigation system for menus with horizontal or vertical orientation.

**Usage:**
```tsx
import { FloatingStack, StackItem } from '@/components/design-system/layouts';

<FloatingStack orientation="horizontal">
  <StackItem active>Menu Item 1</StackItem>
  <StackItem badge={5}>Menu Item 2</StackItem>
  <StackItem>Menu Item 3</StackItem>
</FloatingStack>
```

**Props:**
- `FloatingStack`:
  - `orientation`: 'horizontal' | 'vertical' - Stack direction
  - `spacing`: 'tight' | 'normal' | 'relaxed' - Item spacing
  
- `StackItem`:
  - `active`: boolean - Active state
  - `badge`: string | number - Badge content
  - `icon`: ReactNode - Optional icon
  - `onClick`: () => void - Click handler

**Use Cases:**
- Menu category navigation
- Tab navigation
- Filter selections
- Quick actions toolbar

---

### 3. Asymmetric Card

Non-uniform content display cards with flexible image positioning.

**Usage:**
```tsx
import { 
  AsymmetricCard, 
  CardHeader, 
  CardContent, 
  CardFooter 
} from '@/components/design-system/layouts';

<AsymmetricCard 
  variant="featured"
  imagePosition="top"
  image="/path/to/image.jpg"
  imageAlt="Description"
>
  <CardHeader>
    <h3>Card Title</h3>
  </CardHeader>
  <CardContent>
    <p>Card description</p>
  </CardContent>
  <CardFooter>
    <button>Action</button>
  </CardFooter>
</AsymmetricCard>
```

**Props:**
- `AsymmetricCard`:
  - `variant`: 'default' | 'featured' | 'compact' - Size variant
  - `imagePosition`: 'left' | 'right' | 'top' | 'bottom' - Image placement
  - `image`: string - Image URL
  - `imageAlt`: string - Image alt text
  - `onClick`: () => void - Click handler

**Use Cases:**
- Menu item displays
- Product cards
- Content previews
- Feature highlights

---

### 4. Horizontal Insumos Bar

Ingredient breakdown visualization component.

**Usage:**
```tsx
import { InsumosBar } from '@/components/design-system/layouts';

const ingredients = [
  { id: '1', name: 'Tomate', quantity: 2, unit: 'un', color: '#ef4444' },
  { id: '2', name: 'Alface', quantity: 100, unit: 'g', color: '#22c55e' },
];

<InsumosBar 
  ingredients={ingredients}
  variant="default"
  showQuantities={true}
/>
```

**Props:**
- `ingredients`: Ingredient[] - Array of ingredients
  - `id`: string - Unique identifier
  - `name`: string - Ingredient name
  - `quantity`: number - Amount (optional)
  - `unit`: string - Unit of measurement (optional)
  - `color`: string - Color indicator (optional)
  - `icon`: ReactNode - Icon (optional)
- `variant`: 'default' | 'compact' | 'detailed' - Display size
- `showQuantities`: boolean - Show/hide quantities

**Use Cases:**
- Recipe ingredient lists
- Menu item composition
- Nutritional information
- Allergen indicators

---

### 5. Vertical Status Ribbon

Order workflow status visualization component.

**Usage:**
```tsx
import { StatusRibbon } from '@/components/design-system/layouts';

const steps = [
  { 
    id: '1', 
    label: 'Pedido Recebido', 
    description: 'Aguardando preparo',
    timestamp: new Date()
  },
  { id: '2', label: 'Em Preparo' },
  { id: '3', label: 'Pronto' },
  { id: '4', label: 'Entregue' },
];

<StatusRibbon 
  steps={steps}
  currentStep={1}
  variant="detailed"
  orientation="vertical"
/>
```

**Props:**
- `steps`: StatusStep[] - Array of workflow steps
  - `id`: string - Unique identifier
  - `label`: string - Step label
  - `description`: string - Step description (optional)
  - `icon`: ReactNode - Step icon (optional)
  - `timestamp`: Date - Completion time (optional)
  - `status`: 'pending' | 'active' | 'completed' | 'error' - Step status (optional)
- `currentStep`: number - Current active step index
- `variant`: 'default' | 'compact' | 'detailed' - Display size
- `orientation`: 'vertical' | 'horizontal' - Layout direction

**Use Cases:**
- Order status tracking
- Workflow progress
- Multi-step processes
- Delivery tracking

---

### 6. Live Commission Ticker

Real-time earnings display component with progress tracking.

**Usage:**
```tsx
import { CommissionTicker, CommissionTickerCompact } from '@/components/design-system/layouts';

const recentEarnings = [
  { id: '1', amount: 12.50, timestamp: new Date(), orderNumber: '1234' },
];

<CommissionTicker 
  currentCommission={245.50}
  targetCommission={500}
  currency="R$"
  variant="detailed"
  showProgress={true}
  recentEarnings={recentEarnings}
  animateChanges={true}
/>

// Compact version for headers
<CommissionTickerCompact currentCommission={245.50} />
```

**Props:**
- `CommissionTicker`:
  - `currentCommission`: number - Current earnings amount
  - `targetCommission`: number - Target goal (optional)
  - `currency`: string - Currency symbol (default: 'R$')
  - `variant`: 'default' | 'compact' | 'detailed' - Display size
  - `showProgress`: boolean - Show progress bar
  - `recentEarnings`: CommissionEntry[] - Recent commission entries
  - `animateChanges`: boolean - Animate value changes

- `CommissionTickerCompact`:
  - `currentCommission`: number - Current earnings amount
  - `currency`: string - Currency symbol

**Use Cases:**
- Waiter commission tracking
- Sales performance display
- Revenue monitoring
- Goal progress tracking

---

## Design Tokens Integration

All layout components use semantic design tokens from the Adaptive Gastronomy Design System:

### Action Tokens
- `--token-action-primary` - Primary actions and highlights
- `--token-action-secondary` - Secondary actions
- `--token-action-danger` - Destructive actions
- `--token-action-success` - Success actions

### Surface Tokens
- `--token-surface-base` - Base background
- `--token-surface-elevated` - Elevated surfaces
- `--token-surface-overlay` - Overlay backgrounds

### Border Tokens
- `--token-border-subtle` - Subtle borders
- `--token-border-default` - Default borders
- `--token-border-strong` - Strong borders

### Text Tokens
- `--token-text-primary` - Primary text
- `--token-text-secondary` - Secondary text
- `--token-text-tertiary` - Tertiary text
- `--token-text-inverse` - Inverse text (for dark backgrounds)

### Status Tokens
- `--token-status-info` - Information states
- `--token-status-success` - Success states
- `--token-status-warning` - Warning states
- `--token-status-error` - Error states

### Interactive Tokens
- `--token-interactive-hover` - Hover states
- `--token-interactive-active` - Active states
- `--token-interactive-focus` - Focus states
- `--token-interactive-disabled` - Disabled states

---

## Theming

All components automatically adapt to the selected theme (Bistro Noir, Neon Diner, Organic Garden, or Signature) through the design token system. No additional configuration is required.

To change themes:
```tsx
import { useTheme } from '@/contexts/theme-context';

const { setTheme } = useTheme();
setTheme(ThemeName.NEON_DINER);
```

---

## Accessibility

All layout components follow accessibility best practices:

- Semantic HTML structure
- Keyboard navigation support
- Focus indicators
- ARIA labels where appropriate
- Color contrast compliance
- Screen reader friendly

---

## Demo

View all components in action at `/design-system-layouts-demo`

---

## Integration with Existing Components

These layout components are designed to work seamlessly with:

- Theme Provider (`@/contexts/theme-context`)
- Branding Context (`@/contexts/branding-context`)
- Semantic Tokens (`@/lib/design-system/semantic-tokens`)
- Typography System (`@/lib/design-system/typography`)

---

## Best Practices

1. **Bento Box**: Use for dashboard layouts where different content types need varying amounts of space
2. **Floating Stack**: Ideal for navigation that needs to stand out from the page content
3. **Asymmetric Cards**: Perfect for content that benefits from visual variety
4. **Insumos Bar**: Use whenever displaying ingredient or component breakdowns
5. **Status Ribbon**: Best for linear workflows with clear progression
6. **Commission Ticker**: Use for real-time financial or performance metrics

---

## Performance Considerations

- All components use CSS custom properties for theming (no runtime style calculations)
- Animations use CSS transitions for optimal performance
- Components are tree-shakeable (import only what you need)
- No external dependencies beyond React and utility functions

---

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- CSS Grid and Flexbox support required
- CSS Custom Properties support required

---

## Future Enhancements

Potential additions to the layout system:
- Masonry layout variant
- Carousel/slider components
- Timeline components
- Kanban board layouts
- Split pane layouts
