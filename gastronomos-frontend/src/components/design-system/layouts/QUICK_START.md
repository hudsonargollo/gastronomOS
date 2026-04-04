# Layout Components Quick Start Guide

## Installation

Components are already available in your project. Simply import them:

```tsx
import {
  BentoBox,
  BentoItem,
  FloatingStack,
  StackItem,
  AsymmetricCard,
  CardHeader,
  CardContent,
  CardFooter,
  InsumosBar,
  StatusRibbon,
  CommissionTicker,
  CommissionTickerCompact,
} from '@/components/design-system/layouts';
```

---

## Quick Examples

### Dashboard Layout (Bento Box)

```tsx
<BentoBox columns={3} gap="md">
  <BentoItem span={2} rowSpan={2} variant="elevated">
    <h2>Sales Overview</h2>
    <p>R$ 12,450.00</p>
  </BentoItem>
  <BentoItem span={1}>
    <h3>Orders</h3>
    <p>42</p>
  </BentoItem>
  <BentoItem span={1}>
    <h3>Items</h3>
    <p>128</p>
  </BentoItem>
</BentoBox>
```

### Menu Navigation (Floating Stack)

```tsx
<FloatingStack>
  <StackItem active onClick={() => setCategory('entradas')}>
    Entradas
  </StackItem>
  <StackItem badge={12} onClick={() => setCategory('pratos')}>
    Pratos Principais
  </StackItem>
  <StackItem onClick={() => setCategory('sobremesas')}>
    Sobremesas
  </StackItem>
</FloatingStack>
```

### Menu Item Card (Asymmetric Card)

```tsx
<AsymmetricCard 
  variant="featured"
  imagePosition="top"
  image="/images/dish.jpg"
  imageAlt="Delicious dish"
  onClick={() => addToCart(item)}
>
  <CardHeader>
    <h3 className="text-xl font-bold">{item.name}</h3>
  </CardHeader>
  <CardContent>
    <p>{item.description}</p>
  </CardContent>
  <CardFooter>
    <span className="text-2xl font-bold">R$ {item.price}</span>
  </CardFooter>
</AsymmetricCard>
```

### Ingredient Display (Insumos Bar)

```tsx
const ingredients = [
  { id: '1', name: 'Tomate', quantity: 2, unit: 'un', color: '#ef4444' },
  { id: '2', name: 'Alface', quantity: 100, unit: 'g', color: '#22c55e' },
  { id: '3', name: 'Queijo', quantity: 50, unit: 'g', color: '#f59e0b' },
];

<InsumosBar ingredients={ingredients} variant="default" />
```

### Order Status (Status Ribbon)

```tsx
const orderSteps = [
  { id: '1', label: 'Recebido', timestamp: new Date() },
  { id: '2', label: 'Preparando' },
  { id: '3', label: 'Pronto' },
  { id: '4', label: 'Entregue' },
];

<StatusRibbon 
  steps={orderSteps}
  currentStep={1}
  variant="default"
  orientation="vertical"
/>
```

### Commission Display (Commission Ticker)

```tsx
// Full version
<CommissionTicker 
  currentCommission={245.50}
  targetCommission={500}
  showProgress={true}
  variant="detailed"
/>

// Compact version for headers
<CommissionTickerCompact currentCommission={245.50} />
```

---

## Common Patterns

### Dashboard with Mixed Content

```tsx
<BentoBox columns={4} gap="md">
  {/* Large featured metric */}
  <BentoItem span={2} rowSpan={2} variant="elevated">
    <CommissionTicker 
      currentCommission={commission}
      targetCommission={500}
      showProgress
    />
  </BentoItem>
  
  {/* Small metrics */}
  <BentoItem span={1}>
    <h3>Orders Today</h3>
    <p className="text-3xl font-bold">{orders}</p>
  </BentoItem>
  
  <BentoItem span={1}>
    <h3>Avg. Ticket</h3>
    <p className="text-3xl font-bold">R$ {avgTicket}</p>
  </BentoItem>
  
  {/* Wide status display */}
  <BentoItem span={2}>
    <StatusRibbon steps={steps} currentStep={currentStep} />
  </BentoItem>
</BentoBox>
```

### Menu with Categories and Items

```tsx
<div className="space-y-4">
  {/* Category navigation */}
  <FloatingStack>
    {categories.map(cat => (
      <StackItem 
        key={cat.id}
        active={activeCategory === cat.id}
        badge={cat.itemCount}
        onClick={() => setActiveCategory(cat.id)}
      >
        {cat.name}
      </StackItem>
    ))}
  </FloatingStack>
  
  {/* Menu items */}
  <div className="grid grid-cols-2 gap-4">
    {items.map(item => (
      <AsymmetricCard 
        key={item.id}
        imagePosition="top"
        image={item.image}
      >
        <CardHeader>
          <h3>{item.name}</h3>
        </CardHeader>
        <CardContent>
          <InsumosBar 
            ingredients={item.ingredients}
            variant="compact"
          />
        </CardContent>
        <CardFooter>
          <span>R$ {item.price}</span>
        </CardFooter>
      </AsymmetricCard>
    ))}
  </div>
</div>
```

### Kitchen Display Order Card

```tsx
<AsymmetricCard variant="default">
  <CardHeader>
    <div className="flex justify-between">
      <h3>Pedido #{order.number}</h3>
      <span>Mesa {order.table}</span>
    </div>
  </CardHeader>
  
  <CardContent>
    <div className="space-y-2">
      {order.items.map(item => (
        <div key={item.id}>
          <p className="font-semibold">{item.quantity}x {item.name}</p>
          <InsumosBar 
            ingredients={item.ingredients}
            variant="compact"
            showQuantities={false}
          />
        </div>
      ))}
    </div>
  </CardContent>
  
  <CardFooter>
    <StatusRibbon 
      steps={orderSteps}
      currentStep={order.currentStep}
      orientation="horizontal"
      variant="compact"
    />
  </CardFooter>
</AsymmetricCard>
```

---

## Styling Tips

### Custom Colors

Components use design tokens, but you can override with Tailwind classes:

```tsx
<BentoItem className="bg-gradient-to-br from-purple-500 to-pink-500">
  Custom gradient background
</BentoItem>
```

### Responsive Layouts

```tsx
<BentoBox 
  columns={3} 
  className="lg:grid-cols-4 md:grid-cols-3 sm:grid-cols-2"
>
  {/* Items adapt to screen size */}
</BentoBox>
```

### Dark Mode

Components automatically adapt to theme changes. No additional work needed!

---

## TypeScript Support

All components are fully typed. Your IDE will provide autocomplete:

```tsx
// TypeScript knows all available props
<BentoItem 
  span={2}        // 1 | 2 | 3 | 4
  rowSpan={1}     // 1 | 2 | 3
  variant="elevated"  // 'default' | 'elevated' | 'outlined'
>
  Content
</BentoItem>
```

---

## Performance Tips

1. **Memoize expensive data**: Use `useMemo` for ingredient arrays
2. **Lazy load images**: Use Next.js Image component for cards
3. **Virtualize long lists**: Use react-window for many items
4. **Debounce animations**: Limit commission ticker updates

---

## Troubleshooting

### Components not styled correctly?

Make sure ThemeProvider is wrapping your app:

```tsx
import { ThemeProvider } from '@/contexts/theme-context';

<ThemeProvider>
  <YourApp />
</ThemeProvider>
```

### Colors not showing?

Check that semantic tokens are loaded. They're applied automatically by ThemeProvider.

### TypeScript errors?

Make sure you're importing from the correct path:

```tsx
import { BentoBox } from '@/components/design-system/layouts';
```

---

## Need Help?

- Check the full documentation: `README.md`
- View live examples: `/design-system-layouts-demo`
- Review component source code for advanced usage

---

## Cheat Sheet

| Component | Best For | Key Props |
|-----------|----------|-----------|
| BentoBox | Dashboards | `columns`, `gap` |
| FloatingStack | Navigation | `orientation`, `spacing` |
| AsymmetricCard | Content display | `variant`, `imagePosition` |
| InsumosBar | Ingredients | `ingredients`, `showQuantities` |
| StatusRibbon | Workflows | `steps`, `currentStep` |
| CommissionTicker | Earnings | `currentCommission`, `targetCommission` |

---

Happy coding! 🎨
