# Banner Designer System

## Overview

The **Banner Designer** is an integrated Canvas API-based tool for creating custom banners with image cropping, background removal, and theme integration. It's part of the Adaptive Gastronomy Design System and enables tenants to create branded banners for their restaurant interfaces.

## Features

- **Canvas API Integration**: Real-time banner preview using HTML5 Canvas
- **Image Cropping**: Powered by react-easy-crop for precise image adjustment
- **Background Removal**: Placeholder for background removal API integration
- **Multiple Background Types**: Solid colors, gradients, and images
- **Overlay System**: Adjustable overlay opacity and color
- **Text Customization**: Configurable text with position and size options
- **Theme Integration**: Automatic integration with tenant theme colors
- **Export Functionality**: Download banners as PNG files
- **Template System**: Save and reuse banner designs

## Installation

The Banner Designer is already integrated. Import from:

```typescript
import { BannerDesigner } from '@/components/design-system/banner-designer';
```

## Basic Usage

### Simple Banner Designer

```tsx
import { BannerDesigner } from '@/components/design-system/banner-designer';

function MyComponent() {
  const handleSave = (banner: BannerDesign) => {
    console.log('Banner saved:', banner);
    // Save to database or state
  };

  return <BannerDesigner onSave={handleSave} />;
}
```

### With Initial Design

```tsx
const initialDesign = {
  name: 'Restaurant Header',
  backgroundType: 'gradient',
  gradientColors: ['#FF6B6B', '#4ECDC4'],
  text: 'Bem-vindo ao nosso Espaço',
  textPosition: 'center',
};

<BannerDesigner 
  initialDesign={initialDesign}
  onSave={handleSave}
/>
```

### With Cancel Handler

```tsx
<BannerDesigner 
  onSave={handleSave}
  onCancel={() => console.log('Cancelled')}
/>
```

## Banner Design Interface

```typescript
interface BannerDesign {
  id: string;
  name: string;
  backgroundType: 'solid' | 'gradient' | 'image';
  backgroundColor?: string;
  gradientColors?: [string, string];
  gradientDirection?: 'horizontal' | 'vertical' | 'diagonal';
  imageUrl?: string;
  imageCrop?: Area;
  textColor: string;
  overlayOpacity: number;
  overlayColor?: string;
  text?: string;
  textPosition?: 'top' | 'center' | 'bottom';
  textSize?: 'small' | 'medium' | 'large';
}
```

## Background Types

### Solid Color

```tsx
const solidDesign = {
  backgroundType: 'solid',
  backgroundColor: '#FF6B6B',
};
```

### Gradient

```tsx
const gradientDesign = {
  backgroundType: 'gradient',
  gradientColors: ['#FF6B6B', '#4ECDC4'],
  gradientDirection: 'horizontal', // or 'vertical', 'diagonal'
};
```

### Image

```tsx
const imageDesign = {
  backgroundType: 'image',
  imageUrl: 'data:image/jpeg;base64,...',
  imageCrop: {
    x: 0,
    y: 0,
    width: 800,
    height: 450,
  },
};
```

## Features

### Image Cropping

1. Upload an image
2. Click "Crop Image" button
3. Adjust crop area and zoom
4. Click "Apply Crop" to save

The cropping interface uses react-easy-crop with:
- Drag to reposition
- Zoom slider for scaling
- 16:9 aspect ratio (configurable)
- Real-time preview

### Background Removal

```tsx
// Placeholder for background removal API
// In production, integrate with services like remove.bg

const handleRemoveBackground = async (imageUrl: string) => {
  // API call to background removal service
  const processedImage = await removeBackgroundAPI(imageUrl);
  return processedImage;
};
```

### Overlay System

Add colored overlays with adjustable opacity:

```tsx
const overlayDesign = {
  overlayColor: '#000000',
  overlayOpacity: 0.6, // 0 to 1
};
```

### Text Customization

```tsx
const textDesign = {
  text: 'Welcome to Our Restaurant',
  textColor: '#FFFFFF',
  textPosition: 'center', // 'top', 'center', 'bottom'
  textSize: 'large', // 'small', 'medium', 'large'
};
```

## Canvas Rendering

The banner is rendered on an HTML5 Canvas element:

- **Dimensions**: 800x450px (16:9 aspect ratio)
- **Real-time Preview**: Updates as you edit
- **Export Quality**: High-quality PNG output

## Integration with Branding Asset Manager

```tsx
import { BrandingAssetManager } from '@/components/design-system/branding-asset-manager';

<BrandingAssetManager
  tenantId="restaurant-123"
  onBannerSave={(banner) => {
    // Convert banner to asset
    const asset = {
      id: banner.id,
      name: banner.name,
      type: 'banner',
      url: banner.imageUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    // Save asset
  }}
/>
```

## Theme Integration

Banners automatically use theme defaults:

```tsx
import { useTheme } from '@/contexts/theme-context';

function MyComponent() {
  const { bannerDefaults } = useTheme();
  
  // bannerDefaults includes:
  // - backgroundType
  // - backgroundColor
  // - textColor
  // - overlayOpacity
  
  return <BannerDesigner />;
}
```

## Export Functionality

### Export as PNG

```tsx
const handleExport = () => {
  const canvas = canvasRef.current;
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'banner.png';
    a.click();
  });
};
```

### Save to Database

```tsx
const handleSave = async (banner: BannerDesign) => {
  // Convert canvas to base64
  const canvas = canvasRef.current;
  const dataUrl = canvas.toDataURL('image/png');
  
  // Save to database
  await saveBannerToDatabase({
    ...banner,
    imageUrl: dataUrl,
  });
};
```

## Advanced Usage

### Custom Canvas Size

Modify the canvas dimensions in the component:

```tsx
<canvas
  ref={canvasRef}
  width={1200}  // Custom width
  height={675}  // Custom height (16:9 ratio)
  className="w-full border rounded-lg"
/>
```

### Custom Aspect Ratio

Modify the cropper aspect ratio:

```tsx
<Cropper
  image={design.imageUrl}
  crop={crop}
  zoom={zoom}
  aspect={4 / 3}  // Custom aspect ratio
  onCropChange={setCrop}
  onZoomChange={setZoom}
  onCropComplete={onCropComplete}
/>
```

### Multiple Text Layers

Extend the design interface to support multiple text layers:

```tsx
interface ExtendedBannerDesign extends BannerDesign {
  textLayers: Array<{
    text: string;
    color: string;
    position: { x: number; y: number };
    size: number;
  }>;
}
```

## Best Practices

1. **Image Quality**: Use high-resolution images (at least 1600x900px)
2. **File Size**: Optimize images before upload to reduce processing time
3. **Overlay Usage**: Use overlays to ensure text readability on images
4. **Text Contrast**: Ensure sufficient contrast between text and background
5. **Theme Consistency**: Use theme colors for brand consistency
6. **Export Format**: PNG for transparency support, JPEG for smaller file sizes

## Performance Optimization

### Image Compression

```tsx
const compressImage = async (file: File): Promise<string> => {
  // Use canvas to compress image
  const img = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  canvas.width = 800;
  canvas.height = 450;
  ctx.drawImage(img, 0, 0, 800, 450);
  
  return canvas.toDataURL('image/jpeg', 0.8);
};
```

### Lazy Loading

```tsx
import dynamic from 'next/dynamic';

const BannerDesigner = dynamic(
  () => import('@/components/design-system/banner-designer'),
  { ssr: false }
);
```

## API Integration

### Background Removal Service

```tsx
// Example integration with remove.bg API
const removeBackground = async (imageUrl: string): Promise<string> => {
  const formData = new FormData();
  formData.append('image_url', imageUrl);
  formData.append('size', 'auto');
  
  const response = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: {
      'X-Api-Key': process.env.REMOVE_BG_API_KEY,
    },
    body: formData,
  });
  
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};
```

### Save to Cloud Storage

```tsx
const uploadToCloudStorage = async (banner: BannerDesign): Promise<string> => {
  const canvas = canvasRef.current;
  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
  
  const formData = new FormData();
  formData.append('file', blob, `${banner.name}.png`);
  
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });
  
  const { url } = await response.json();
  return url;
};
```

## Accessibility

- Canvas elements include proper ARIA labels
- Keyboard navigation support for controls
- Screen reader announcements for state changes
- High contrast mode support

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers with Canvas API support

## Troubleshooting

### Canvas Not Rendering

Check that the canvas ref is properly initialized:

```tsx
const canvasRef = useRef<HTMLCanvasElement>(null);

useEffect(() => {
  if (!canvasRef.current) return;
  // Canvas operations
}, [design]);
```

### Image Upload Issues

Ensure proper file type validation:

```tsx
<Input
  type="file"
  accept="image/jpeg,image/png,image/webp"
  onChange={handleImageUpload}
/>
```

### Cropping Not Working

Verify react-easy-crop is properly installed:

```bash
npm install react-easy-crop
```

## Demo Page

View the Banner Designer in action:
```
/design-system-icons-demo
```

Navigate to the "Banner Designer" tab.

## Related Components

- **BrandingAssetManager**: Manage all branding assets including banners
- **SketchWireIcon**: Icon system for UI elements
- **ThemeProvider**: Theme system integration
