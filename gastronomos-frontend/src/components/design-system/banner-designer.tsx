'use client';

/**
 * Banner Designer Component
 * Canvas API integration with react-easy-crop for tenant branding
 * Part of the Adaptive Gastronomy Design System
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { useTheme } from '@/contexts/theme-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export interface BannerDesign {
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

interface BannerDesignerProps {
  initialDesign?: Partial<BannerDesign>;
  onSave?: (design: BannerDesign) => void;
  onCancel?: () => void;
  className?: string;
}

/**
 * Create image from cropped area
 */
async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area
): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        throw new Error('Canvas is empty');
      }
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
    }, 'image/jpeg');
  });
}

/**
 * Create image element from source
 */
function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });
}

/**
 * Remove background from image (simplified version)
 * In production, this would use a proper background removal API
 */
async function removeBackground(imageSrc: string): Promise<string> {
  // This is a placeholder - in production, integrate with a service like remove.bg
  // For now, we'll just return the original image
  console.log('Background removal would be applied here');
  return imageSrc;
}

export function BannerDesigner({
  initialDesign,
  onSave,
  onCancel,
  className,
}: BannerDesignerProps) {
  const { palette, bannerDefaults } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [design, setDesign] = useState<BannerDesign>({
    id: initialDesign?.id || `banner-${Date.now()}`,
    name: initialDesign?.name || 'New Banner',
    backgroundType: initialDesign?.backgroundType || bannerDefaults.backgroundType,
    backgroundColor: initialDesign?.backgroundColor || bannerDefaults.backgroundColor,
    gradientColors: initialDesign?.gradientColors || [palette.primary, palette.secondary],
    gradientDirection: initialDesign?.gradientDirection || 'horizontal',
    textColor: initialDesign?.textColor || bannerDefaults.textColor,
    overlayOpacity: initialDesign?.overlayOpacity ?? bannerDefaults.overlayOpacity,
    overlayColor: initialDesign?.overlayColor || '#000000',
    text: initialDesign?.text || '',
    textPosition: initialDesign?.textPosition || 'center',
    textSize: initialDesign?.textSize || 'large',
    imageUrl: initialDesign?.imageUrl,
    imageCrop: initialDesign?.imageCrop,
  });

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setDesign((prev) => ({
          ...prev,
          imageUrl: reader.result as string,
          backgroundType: 'image',
        }));
        setIsCropping(true);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleCropSave = useCallback(async () => {
    if (!design.imageUrl || !croppedAreaPixels) return;

    setIsProcessing(true);
    try {
      const croppedImage = await getCroppedImg(design.imageUrl, croppedAreaPixels);
      setDesign((prev) => ({
        ...prev,
        imageUrl: croppedImage,
        imageCrop: croppedAreaPixels,
      }));
      setIsCropping(false);
    } catch (error) {
      console.error('Error cropping image:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [design.imageUrl, croppedAreaPixels]);

  const handleRemoveBackground = useCallback(async () => {
    if (!design.imageUrl) return;

    setIsProcessing(true);
    try {
      const processedImage = await removeBackground(design.imageUrl);
      setDesign((prev) => ({
        ...prev,
        imageUrl: processedImage,
      }));
    } catch (error) {
      console.error('Error removing background:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [design.imageUrl]);

  // Render banner preview on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    if (design.backgroundType === 'solid' && design.backgroundColor) {
      ctx.fillStyle = design.backgroundColor;
      ctx.fillRect(0, 0, width, height);
    } else if (design.backgroundType === 'gradient' && design.gradientColors) {
      const gradient =
        design.gradientDirection === 'horizontal'
          ? ctx.createLinearGradient(0, 0, width, 0)
          : design.gradientDirection === 'vertical'
          ? ctx.createLinearGradient(0, 0, 0, height)
          : ctx.createLinearGradient(0, 0, width, height);

      gradient.addColorStop(0, design.gradientColors[0]);
      gradient.addColorStop(1, design.gradientColors[1]);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    } else if (design.backgroundType === 'image' && design.imageUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);

        // Apply overlay
        if (design.overlayOpacity > 0 && design.overlayColor) {
          ctx.fillStyle = design.overlayColor;
          ctx.globalAlpha = design.overlayOpacity;
          ctx.fillRect(0, 0, width, height);
          ctx.globalAlpha = 1;
        }

        // Draw text
        if (design.text) {
          drawText(ctx, width, height);
        }
      };
      img.src = design.imageUrl;
      return;
    }

    // Apply overlay for non-image backgrounds
    if (design.overlayOpacity > 0 && design.overlayColor) {
      ctx.fillStyle = design.overlayColor;
      ctx.globalAlpha = design.overlayOpacity;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;
    }

    // Draw text
    if (design.text) {
      drawText(ctx, width, height);
    }
  }, [design]);

  const drawText = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!design.text) return;

    const fontSize =
      design.textSize === 'small' ? 24 : design.textSize === 'medium' ? 36 : 48;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = design.textColor;
    ctx.textAlign = 'center';

    const y =
      design.textPosition === 'top'
        ? fontSize + 20
        : design.textPosition === 'bottom'
        ? height - 20
        : height / 2;

    ctx.fillText(design.text, width / 2, y);
  };

  const handleSave = () => {
    if (onSave) {
      onSave(design);
    }
  };

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${design.name}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  if (isCropping && design.imageUrl) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Crop Image</CardTitle>
          <CardDescription>Adjust the crop area for your banner</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative h-96 bg-gray-100 rounded-lg overflow-hidden">
            <Cropper
              image={design.imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={16 / 9}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          <div className="space-y-2">
            <Label>Zoom</Label>
            <Slider
              value={[zoom]}
              onValueChange={([value]) => setZoom(value)}
              min={1}
              max={3}
              step={0.1}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleCropSave} disabled={isProcessing}>
              {isProcessing ? 'Processing...' : 'Apply Crop'}
            </Button>
            <Button variant="outline" onClick={() => setIsCropping(false)}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Banner Designer</CardTitle>
        <CardDescription>Create custom banners for your restaurant</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Banner Preview */}
        <div className="space-y-2">
          <Label>Preview</Label>
          <canvas
            ref={canvasRef}
            width={800}
            height={450}
            className="w-full border rounded-lg"
          />
        </div>

        <Tabs defaultValue="background" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="background">Background</TabsTrigger>
            <TabsTrigger value="overlay">Overlay</TabsTrigger>
            <TabsTrigger value="text">Text</TabsTrigger>
          </TabsList>

          <TabsContent value="background" className="space-y-4">
            <div className="space-y-2">
              <Label>Banner Name</Label>
              <Input
                value={design.name}
                onChange={(e) => setDesign({ ...design, name: e.target.value })}
                placeholder="Enter banner name"
              />
            </div>

            <div className="space-y-2">
              <Label>Background Type</Label>
              <Select
                value={design.backgroundType}
                onValueChange={(value: 'solid' | 'gradient' | 'image') =>
                  setDesign({ ...design, backgroundType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solid">Solid Color</SelectItem>
                  <SelectItem value="gradient">Gradient</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {design.backgroundType === 'solid' && (
              <div className="space-y-2">
                <Label>Background Color</Label>
                <Input
                  type="color"
                  value={design.backgroundColor}
                  onChange={(e) =>
                    setDesign({ ...design, backgroundColor: e.target.value })
                  }
                />
              </div>
            )}

            {design.backgroundType === 'gradient' && (
              <>
                <div className="space-y-2">
                  <Label>Gradient Start Color</Label>
                  <Input
                    type="color"
                    value={design.gradientColors?.[0]}
                    onChange={(e) =>
                      setDesign({
                        ...design,
                        gradientColors: [e.target.value, design.gradientColors?.[1] || '#000000'],
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gradient End Color</Label>
                  <Input
                    type="color"
                    value={design.gradientColors?.[1]}
                    onChange={(e) =>
                      setDesign({
                        ...design,
                        gradientColors: [design.gradientColors?.[0] || '#ffffff', e.target.value],
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gradient Direction</Label>
                  <Select
                    value={design.gradientDirection}
                    onValueChange={(value: 'horizontal' | 'vertical' | 'diagonal') =>
                      setDesign({ ...design, gradientDirection: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="horizontal">Horizontal</SelectItem>
                      <SelectItem value="vertical">Vertical</SelectItem>
                      <SelectItem value="diagonal">Diagonal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {design.backgroundType === 'image' && (
              <div className="space-y-2">
                <Label>Upload Image</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                />
                {design.imageUrl && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsCropping(true)}
                    >
                      Crop Image
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveBackground}
                      disabled={isProcessing}
                    >
                      {isProcessing ? 'Processing...' : 'Remove Background'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="overlay" className="space-y-4">
            <div className="space-y-2">
              <Label>Overlay Color</Label>
              <Input
                type="color"
                value={design.overlayColor}
                onChange={(e) => setDesign({ ...design, overlayColor: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Overlay Opacity: {Math.round(design.overlayOpacity * 100)}%</Label>
              <Slider
                value={[design.overlayOpacity]}
                onValueChange={([value]) =>
                  setDesign({ ...design, overlayOpacity: value })
                }
                min={0}
                max={1}
                step={0.05}
              />
            </div>
          </TabsContent>

          <TabsContent value="text" className="space-y-4">
            <div className="space-y-2">
              <Label>Banner Text</Label>
              <Input
                value={design.text}
                onChange={(e) => setDesign({ ...design, text: e.target.value })}
                placeholder="Enter banner text"
              />
            </div>

            <div className="space-y-2">
              <Label>Text Color</Label>
              <Input
                type="color"
                value={design.textColor}
                onChange={(e) => setDesign({ ...design, textColor: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Text Size</Label>
              <Select
                value={design.textSize}
                onValueChange={(value: 'small' | 'medium' | 'large') =>
                  setDesign({ ...design, textSize: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Text Position</Label>
              <Select
                value={design.textPosition}
                onValueChange={(value: 'top' | 'center' | 'bottom') =>
                  setDesign({ ...design, textPosition: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="top">Top</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="bottom">Bottom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={handleSave}>Save Banner</Button>
          <Button variant="outline" onClick={handleExport}>
            Export PNG
          </Button>
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
