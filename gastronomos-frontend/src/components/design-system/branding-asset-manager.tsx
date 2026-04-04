'use client';

/**
 * Branding Asset Manager
 * Manage logos, banners, and custom icons for tenant branding
 * Part of the Adaptive Gastronomy Design System
 */

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { BannerDesigner, BannerDesign } from './banner-designer';
import { SketchWireIcon } from './sketch-wire-icon';
import { cn } from '@/lib/utils';

export interface BrandingAsset {
  id: string;
  name: string;
  type: 'logo' | 'favicon' | 'banner' | 'icon';
  url: string;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface BrandingAssetManagerProps {
  tenantId: string;
  assets?: BrandingAsset[];
  onAssetUpload?: (asset: BrandingAsset) => void;
  onAssetDelete?: (assetId: string) => void;
  onBannerSave?: (banner: BannerDesign) => void;
  className?: string;
}

export function BrandingAssetManager({
  tenantId,
  assets = [],
  onAssetUpload,
  onAssetDelete,
  onBannerSave,
  className,
}: BrandingAssetManagerProps) {
  const [selectedAsset, setSelectedAsset] = useState<BrandingAsset | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isBannerDesignerOpen, setIsBannerDesignerOpen] = useState(false);

  const handleFileUpload = useCallback(
    async (
      event: React.ChangeEvent<HTMLInputElement>,
      type: 'logo' | 'favicon' | 'icon'
    ) => {
      const file = event.target.files?.[0];
      if (!file || !onAssetUpload) return;

      setIsUploading(true);
      try {
        const reader = new FileReader();
        reader.onload = () => {
          const asset: BrandingAsset = {
            id: `asset-${Date.now()}`,
            name: file.name,
            type,
            url: reader.result as string,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          onAssetUpload(asset);
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error('Error uploading asset:', error);
      } finally {
        setIsUploading(false);
      }
    },
    [onAssetUpload]
  );

  const handleBannerSave = useCallback(
    (banner: BannerDesign) => {
      if (onBannerSave) {
        onBannerSave(banner);
      }
      setIsBannerDesignerOpen(false);
    },
    [onBannerSave]
  );

  const handleAssetDelete = useCallback(
    (assetId: string) => {
      if (onAssetDelete) {
        onAssetDelete(assetId);
      }
      if (selectedAsset?.id === assetId) {
        setSelectedAsset(null);
      }
    },
    [onAssetDelete, selectedAsset]
  );

  const getAssetsByType = (type: BrandingAsset['type']) => {
    return assets.filter((asset) => asset.type === type);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Branding Assets</CardTitle>
        <CardDescription>
          Manage your restaurant's logos, banners, and custom icons
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="logos" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="logos">Logos</TabsTrigger>
            <TabsTrigger value="banners">Banners</TabsTrigger>
            <TabsTrigger value="icons">Icons</TabsTrigger>
            <TabsTrigger value="favicon">Favicon</TabsTrigger>
          </TabsList>

          {/* Logos Tab */}
          <TabsContent value="logos" className="space-y-4">
            <div className="space-y-2">
              <Label>Upload Logo</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, 'logo')}
                disabled={isUploading}
              />
              <p className="text-sm text-gray-500">
                Recommended: PNG or SVG, transparent background, 512x512px
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {getAssetsByType('logo').map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  isSelected={selectedAsset?.id === asset.id}
                  onSelect={() => setSelectedAsset(asset)}
                  onDelete={() => handleAssetDelete(asset.id)}
                />
              ))}
            </div>

            {getAssetsByType('logo').length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No logos uploaded yet
              </div>
            )}
          </TabsContent>

          {/* Banners Tab */}
          <TabsContent value="banners" className="space-y-4">
            <Dialog open={isBannerDesignerOpen} onOpenChange={setIsBannerDesignerOpen}>
              <DialogTrigger asChild>
                <Button>
                  <SketchWireIcon name="plus" size={16} className="mr-2" />
                  Create New Banner
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Banner Designer</DialogTitle>
                  <DialogDescription>
                    Create a custom banner for your restaurant
                  </DialogDescription>
                </DialogHeader>
                <BannerDesigner
                  onSave={handleBannerSave}
                  onCancel={() => setIsBannerDesignerOpen(false)}
                />
              </DialogContent>
            </Dialog>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {getAssetsByType('banner').map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  isSelected={selectedAsset?.id === asset.id}
                  onSelect={() => setSelectedAsset(asset)}
                  onDelete={() => handleAssetDelete(asset.id)}
                  wide
                />
              ))}
            </div>

            {getAssetsByType('banner').length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No banners created yet
              </div>
            )}
          </TabsContent>

          {/* Icons Tab */}
          <TabsContent value="icons" className="space-y-4">
            <div className="space-y-2">
              <Label>Upload Custom Icon</Label>
              <Input
                type="file"
                accept="image/svg+xml,image/png"
                onChange={(e) => handleFileUpload(e, 'icon')}
                disabled={isUploading}
              />
              <p className="text-sm text-gray-500">
                Recommended: SVG format, 24x24px
              </p>
            </div>

            <div className="grid grid-cols-4 md:grid-cols-6 gap-4">
              {getAssetsByType('icon').map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  isSelected={selectedAsset?.id === asset.id}
                  onSelect={() => setSelectedAsset(asset)}
                  onDelete={() => handleAssetDelete(asset.id)}
                  compact
                />
              ))}
            </div>

            {getAssetsByType('icon').length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No custom icons uploaded yet
              </div>
            )}
          </TabsContent>

          {/* Favicon Tab */}
          <TabsContent value="favicon" className="space-y-4">
            <div className="space-y-2">
              <Label>Upload Favicon</Label>
              <Input
                type="file"
                accept="image/x-icon,image/png"
                onChange={(e) => handleFileUpload(e, 'favicon')}
                disabled={isUploading}
              />
              <p className="text-sm text-gray-500">
                Recommended: ICO or PNG, 32x32px or 16x16px
              </p>
            </div>

            <div className="grid grid-cols-4 md:grid-cols-6 gap-4">
              {getAssetsByType('favicon').map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  isSelected={selectedAsset?.id === asset.id}
                  onSelect={() => setSelectedAsset(asset)}
                  onDelete={() => handleAssetDelete(asset.id)}
                  compact
                />
              ))}
            </div>

            {getAssetsByType('favicon').length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No favicon uploaded yet
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Selected Asset Details */}
        {selectedAsset && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Asset Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <Label>Name</Label>
                <p className="text-sm">{selectedAsset.name}</p>
              </div>
              <div>
                <Label>Type</Label>
                <p className="text-sm capitalize">{selectedAsset.type}</p>
              </div>
              <div>
                <Label>Created</Label>
                <p className="text-sm">
                  {selectedAsset.createdAt.toLocaleDateString()}
                </p>
              </div>
              <div>
                <Label>URL</Label>
                <p className="text-sm font-mono text-xs break-all">
                  {selectedAsset.url.substring(0, 100)}...
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}

interface AssetCardProps {
  asset: BrandingAsset;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  wide?: boolean;
  compact?: boolean;
}

function AssetCard({
  asset,
  isSelected,
  onSelect,
  onDelete,
  wide = false,
  compact = false,
}: AssetCardProps) {
  return (
    <div
      className={cn(
        'relative group border rounded-lg overflow-hidden cursor-pointer transition-all',
        isSelected && 'ring-2 ring-primary',
        'hover:shadow-md'
      )}
      onClick={onSelect}
    >
      <div
        className={cn(
          'bg-gray-50 flex items-center justify-center',
          wide ? 'aspect-video' : compact ? 'aspect-square' : 'aspect-square'
        )}
      >
        <img
          src={asset.url}
          alt={asset.name}
          className="max-w-full max-h-full object-contain p-2"
        />
      </div>

      {!compact && (
        <div className="p-2 bg-white">
          <p className="text-xs font-medium truncate">{asset.name}</p>
          <p className="text-xs text-gray-500 capitalize">{asset.type}</p>
        </div>
      )}

      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="sm"
          variant="destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <SketchWireIcon name="trash" size={14} />
        </Button>
      </div>
    </div>
  );
}
