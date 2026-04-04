# Sketch & Wire Iconography System

## Overview

The **Sketch & Wire** iconography system is part of the Adaptive Gastronomy Design System. It provides hand-drawn style icons with variable stroke widths and incomplete path styling, creating a unique, organic aesthetic that complements the restaurant management platform.

## Features

- **Hand-Drawn Style**: Icons feature slight irregularities and organic feel
- **Variable Stroke Widths**: Three stroke variations (thin, medium, thick)
- **Incomplete Paths**: Optional dash patterns for artistic effect
- **Theme Integration**: Automatic color integration with theme system
- **Animation Support**: Built-in hover animations
- **Comprehensive Library**: 60+ icons across 10 categories
- **Accessibility**: Proper ARIA labels and semantic markup

## Installation

The iconography system is already integrated into the project. Import components from:

```typescript
import { SketchWireIcon } from '@/components/design-system/sketch-wire-icon';
```

## Basic Usage

### Simple Icon

```tsx
import { SketchWireIcon } from '@/components/design-system/sketch-wire-icon';

function MyComponent() {
  return <SketchWireIcon name="chef" size={24} />;
}
```

### With Stroke Variation

```tsx
<SketchWireIcon name="plate" size={32} strokeVariation="thick" />
```

### With Theme Accent Color

```tsx
<SketchWireIcon name="heart" size={48} useAccent />
```

### With Animation

```tsx
<SketchWireIcon name="bell" size={32} animated />
```

### Complete vs Incomplete Paths

```tsx
{/* Complete paths (default) */}
<SketchWireIcon name="star" incompletePaths={false} />

{/* Incomplete paths for hand-drawn effect */}
<SketchWireIcon name="star" incompletePaths={true} />
```

## Icon Categories

### Kitchen & Cooking
- `chef` - Chef hat icon
- `plate` - Plate icon
- `utensils` - Fork and knife
- `cookingPot` - Cooking pot

### Food Items
- `apple` - Apple icon
- `carrot` - Carrot icon
- `coffee` - Coffee cup
- `pizza` - Pizza slice

### Inventory & Storage
- `warehouse` - Warehouse icon
- `refrigerator` - Refrigerator icon
- `box` - Box/package icon
- `package` - Package icon

### Operations
- `scale` - Scale/balance icon
- `timer` - Timer icon
- `clock` - Clock icon
- `calendar` - Calendar icon

### Analytics & Reports
- `chartPie` - Pie chart icon
- `trendingUp` - Trending up icon
- `trendingDown` - Trending down icon
- `barChart` - Bar chart icon

### Locations & Transport
- `mapPin` - Map pin icon
- `truck` - Delivery truck icon
- `store` - Store/building icon

### Documents & Receipts
- `receipt` - Receipt icon
- `scan` - QR code scan icon
- `fileText` - Document icon
- `clipboard` - Clipboard icon

### UI Controls
- `menu` - Menu icon
- `close` - Close/X icon
- `check` - Checkmark icon
- `chevronRight` - Chevron right
- `chevronLeft` - Chevron left
- `chevronDown` - Chevron down
- `chevronUp` - Chevron up
- `plus` - Plus icon
- `minus` - Minus icon
- `search` - Search icon
- `settings` - Settings icon
- `filter` - Filter icon
- `edit` - Edit icon
- `trash` - Trash/delete icon

### Status & Notifications
- `user` - User icon
- `users` - Multiple users icon
- `bell` - Notification bell
- `heart` - Heart/favorite icon
- `star` - Star/rating icon
- `info` - Information icon
- `alert` - Alert/warning icon
- `checkCircle` - Success/check circle
- `xCircle` - Error/X circle

### Payment
- `creditCard` - Credit card icon
- `dollarSign` - Dollar sign icon
- `wallet` - Wallet icon
- `qrCode` - QR code icon

## Component Props

```typescript
interface SketchWireIconProps {
  name: string;                    // Icon name from library
  size?: number;                   // Size in pixels (default: 24)
  strokeVariation?: 'thin' | 'medium' | 'thick';  // Stroke width (default: 'medium')
  incompletePaths?: boolean;       // Enable incomplete path styling (default: true)
  animated?: boolean;              // Animation on hover (default: false)
  useAccent?: boolean;             // Use theme accent color (default: false)
  className?: string;              // Additional CSS classes
}
```

## Advanced Usage

### In Buttons

```tsx
import { Button } from '@/components/ui/button';
import { SketchWireIcon } from '@/components/design-system/sketch-wire-icon';

<Button>
  <SketchWireIcon name="plus" size={16} className="mr-2" />
  Add Item
</Button>
```

### In Cards

```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { SketchWireIcon } from '@/components/design-system/sketch-wire-icon';

<Card>
  <CardHeader>
    <SketchWireIcon name="chef" size={48} useAccent className="mb-2" />
    <CardTitle>Kitchen</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Manage kitchen operations</p>
  </CardContent>
</Card>
```

### Icon Gallery

Display all available icons:

```tsx
import { SketchWireIconGallery } from '@/components/design-system/sketch-wire-icon';

<SketchWireIconGallery />
```

### Get Icons by Category

```tsx
import { getIconsByCategory } from '@/lib/design-system/icon-library';

const kitchenIcons = getIconsByCategory('kitchen');
// Returns: ['chef', 'plate', 'utensils', 'cookingPot']
```

## Styling

### Custom Colors

```tsx
{/* Use current text color */}
<SketchWireIcon name="heart" className="text-red-500" />

{/* Use theme accent color */}
<SketchWireIcon name="heart" useAccent />
```

### Custom Sizes

```tsx
<SketchWireIcon name="star" size={16} />  {/* Small */}
<SketchWireIcon name="star" size={24} />  {/* Default */}
<SketchWireIcon name="star" size={32} />  {/* Medium */}
<SketchWireIcon name="star" size={48} />  {/* Large */}
```

## Best Practices

1. **Consistent Sizing**: Use consistent icon sizes within the same context
2. **Stroke Variation**: Use thicker strokes for larger icons, thinner for smaller
3. **Animation**: Use sparingly for interactive elements only
4. **Accent Color**: Reserve for primary actions or important indicators
5. **Incomplete Paths**: Enable for artistic sections, disable for functional UI
6. **Accessibility**: Icons are automatically labeled, but add context when needed

## Theme Integration

Icons automatically integrate with the theme system:

```tsx
import { useTheme } from '@/contexts/theme-context';

function MyComponent() {
  const { palette } = useTheme();
  
  return (
    <SketchWireIcon 
      name="chef" 
      useAccent  // Uses palette.accent
    />
  );
}
```

## Adding New Icons

To add new icons to the library:

1. Open `src/lib/design-system/icon-library.ts`
2. Add icon definition to `iconLibrary` object:

```typescript
myNewIcon: {
  paths: [
    'M12 2l3 6h6l-5 4 2 6-6-4-6 4 2-6-5-4h6z',
  ],
  category: 'ui',
  description: 'My new icon',
}
```

3. Icon is automatically available via `<SketchWireIcon name="myNewIcon" />`

## Demo Page

View all icons and variations at:
```
/design-system-icons-demo
```

## Performance

- Icons are rendered as inline SVG for optimal performance
- No external icon font loading required
- Tree-shakeable - only imported icons are included in bundle
- Minimal runtime overhead

## Browser Support

- All modern browsers (Chrome, Firefox, Safari, Edge)
- IE11+ with polyfills
- Mobile browsers (iOS Safari, Chrome Mobile)

## Related Components

- **BannerDesigner**: Create custom banners with icon integration
- **BrandingAssetManager**: Manage custom icons and branding assets
- **ThemeProvider**: Theme system integration
