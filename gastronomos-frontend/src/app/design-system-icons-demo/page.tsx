'use client';

/**
 * Design System Icons & Banner Demo Page
 * Showcases the Sketch & Wire iconography system and Banner Designer
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SketchWireIcon, SketchWireIconGallery } from '@/components/design-system/sketch-wire-icon';
import { BannerDesigner, BannerDesign } from '@/components/design-system/banner-designer';
import { BrandingAssetManager, BrandingAsset } from '@/components/design-system/branding-asset-manager';
import { getIconsByCategory } from '@/lib/design-system/icon-library';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/theme-context';

export default function DesignSystemIconsDemo() {
  const { palette } = useTheme();
  const [savedBanners, setSavedBanners] = useState<BannerDesign[]>([]);
  const [brandingAssets, setBrandingAssets] = useState<BrandingAsset[]>([]);

  const handleBannerSave = (banner: BannerDesign) => {
    setSavedBanners((prev) => [...prev, banner]);
    console.log('Banner saved:', banner);
  };

  const handleAssetUpload = (asset: BrandingAsset) => {
    setBrandingAssets((prev) => [...prev, asset]);
    console.log('Asset uploaded:', asset);
  };

  const handleAssetDelete = (assetId: string) => {
    setBrandingAssets((prev) => prev.filter((a) => a.id !== assetId));
    console.log('Asset deleted:', assetId);
  };

  const iconCategories = [
    'kitchen',
    'food',
    'inventory',
    'operations',
    'analytics',
    'locations',
    'documents',
    'ui',
    'status',
    'payment',
  ] as const;

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Design System: Icons & Banners</h1>
        <p className="text-gray-600">
          Adaptive Gastronomy Design System - Sketch & Wire Iconography and Banner Designer
        </p>
      </div>

      <Tabs defaultValue="icons" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="icons">Icon Gallery</TabsTrigger>
          <TabsTrigger value="categories">By Category</TabsTrigger>
          <TabsTrigger value="banner">Banner Designer</TabsTrigger>
          <TabsTrigger value="assets">Asset Manager</TabsTrigger>
        </TabsList>

        {/* Icon Gallery */}
        <TabsContent value="icons" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sketch & Wire Icon System</CardTitle>
              <CardDescription>
                Hand-drawn style icons with variable stroke and incomplete paths
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SketchWireIconGallery />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Icon Variations</CardTitle>
              <CardDescription>
                Different stroke widths and styling options
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold">Stroke Variations</h3>
                  <div className="flex items-center gap-4">
                    <SketchWireIcon name="chef" size={48} strokeVariation="thin" />
                    <SketchWireIcon name="chef" size={48} strokeVariation="medium" />
                    <SketchWireIcon name="chef" size={48} strokeVariation="thick" />
                  </div>
                  <p className="text-sm text-gray-600">Thin, Medium, Thick</p>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold">Incomplete Paths</h3>
                  <div className="flex items-center gap-4">
                    <SketchWireIcon name="plate" size={48} incompletePaths={false} />
                    <SketchWireIcon name="plate" size={48} incompletePaths={true} />
                  </div>
                  <p className="text-sm text-gray-600">Complete vs Incomplete</p>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold">Accent Color</h3>
                  <div className="flex items-center gap-4">
                    <SketchWireIcon name="heart" size={48} useAccent={false} />
                    <SketchWireIcon name="heart" size={48} useAccent={true} />
                  </div>
                  <p className="text-sm text-gray-600">Default vs Accent</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Animated Icons</CardTitle>
              <CardDescription>
                Hover over icons to see animation effects
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-6">
                <SketchWireIcon name="bell" size={48} animated />
                <SketchWireIcon name="star" size={48} animated useAccent />
                <SketchWireIcon name="heart" size={48} animated />
                <SketchWireIcon name="search" size={48} animated />
                <SketchWireIcon name="settings" size={48} animated />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Icons by Category */}
        <TabsContent value="categories" className="space-y-6">
          {iconCategories.map((category) => {
            const icons = getIconsByCategory(category);
            return (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="capitalize">{category} Icons</CardTitle>
                  <CardDescription>{icons.length} icons in this category</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12 gap-4">
                    {icons.map((iconName) => (
                      <div
                        key={iconName}
                        className="flex flex-col items-center gap-2 p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                      >
                        <SketchWireIcon name={iconName} size={32} animated />
                        <span className="text-xs text-center font-mono">{iconName}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Banner Designer */}
        <TabsContent value="banner" className="space-y-6">
          <BannerDesigner onSave={handleBannerSave} />

          {savedBanners.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Saved Banners</CardTitle>
                <CardDescription>
                  {savedBanners.length} banner{savedBanners.length !== 1 ? 's' : ''} created
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {savedBanners.map((banner) => (
                    <div key={banner.id} className="border rounded-lg p-4">
                      <h3 className="font-semibold mb-2">{banner.name}</h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-600">Type:</span>{' '}
                          <span className="capitalize">{banner.backgroundType}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Text:</span> {banner.text || 'None'}
                        </div>
                        <div>
                          <span className="text-gray-600">Overlay:</span>{' '}
                          {Math.round(banner.overlayOpacity * 100)}%
                        </div>
                        <div>
                          <span className="text-gray-600">ID:</span>{' '}
                          <span className="font-mono text-xs">{banner.id}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Asset Manager */}
        <TabsContent value="assets" className="space-y-6">
          <BrandingAssetManager
            tenantId="demo-tenant"
            assets={brandingAssets}
            onAssetUpload={handleAssetUpload}
            onAssetDelete={handleAssetDelete}
            onBannerSave={(banner) => {
              // Convert banner to asset
              const asset: BrandingAsset = {
                id: banner.id,
                name: banner.name,
                type: 'banner',
                url: banner.imageUrl || '',
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              handleAssetUpload(asset);
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Usage Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Examples</CardTitle>
          <CardDescription>
            How to use the Sketch & Wire icons in your components
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold">Basic Usage</h3>
            <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
              {`import { SketchWireIcon } from '@/components/design-system/sketch-wire-icon';

<SketchWireIcon name="chef" size={24} />
<SketchWireIcon name="plate" size={32} strokeVariation="thick" />
<SketchWireIcon name="heart" size={48} useAccent animated />`}
            </pre>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">With Buttons</h3>
            <div className="flex gap-2">
              <Button>
                <SketchWireIcon name="plus" size={16} className="mr-2" />
                Add Item
              </Button>
              <Button variant="outline">
                <SketchWireIcon name="search" size={16} className="mr-2" />
                Search
              </Button>
              <Button variant="destructive">
                <SketchWireIcon name="trash" size={16} className="mr-2" />
                Delete
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">In Cards</h3>
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <SketchWireIcon name="chef" size={48} useAccent className="mb-2" />
                  <CardTitle>Kitchen</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">Manage kitchen operations</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <SketchWireIcon name="warehouse" size={48} useAccent className="mb-2" />
                  <CardTitle>Inventory</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">Track stock levels</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <SketchWireIcon name="chartPie" size={48} useAccent className="mb-2" />
                  <CardTitle>Analytics</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">View reports</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
