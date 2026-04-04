'use client';

/**
 * Branding Context
 * Tenant-specific branding and asset management
 * Integrates with Adaptive Gastronomy Design System
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { ColorPalette, BrandingAssets, BannerImage, CustomIcon } from '@/lib/design-system/types';
import { useTheme } from './theme-context';

export interface BrandingSettings {
  tenantId: string;
  businessName: string;
  logo?: string;
  favicon?: string;
  bannerImages: BannerImage[];
  customIcons?: CustomIcon[];
}

const defaultBranding: BrandingSettings = {
  tenantId: 'default',
  businessName: 'GastronomOS Demo',
  bannerImages: [],
};

interface BrandingContextType {
  branding: BrandingSettings;
  updateBranding: (updates: Partial<BrandingSettings>) => void;
  uploadLogo: (file: File) => Promise<string>;
  removeLogo: () => void;
  uploadFavicon: (file: File) => Promise<string>;
  removeFavicon: () => void;
  addBannerImage: (image: BannerImage) => void;
  removeBannerImage: (imageId: string) => void;
  addCustomIcon: (icon: CustomIcon) => void;
  removeCustomIcon: (iconId: string) => void;
  resetToDefaults: () => void;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<BrandingSettings>(defaultBranding);

  useEffect(() => {
    // Load branding settings from localStorage
    const savedBranding = localStorage.getItem('gastronomos-branding');
    if (savedBranding) {
      try {
        const parsed = JSON.parse(savedBranding);
        setBranding({ ...defaultBranding, ...parsed });
      } catch (error) {
        console.error('Failed to parse branding settings:', error);
      }
    }
  }, []);

  const updateBranding = (updates: Partial<BrandingSettings>) => {
    const newBranding = { ...branding, ...updates };
    setBranding(newBranding);
    localStorage.setItem('gastronomos-branding', JSON.stringify(newBranding));
  };

  const uploadLogo = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        updateBranding({ logo: result });
        resolve(result);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const removeLogo = () => {
    updateBranding({ logo: undefined });
  };

  const uploadFavicon = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        updateBranding({ favicon: result });
        resolve(result);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const removeFavicon = () => {
    updateBranding({ favicon: undefined });
  };

  const addBannerImage = (image: BannerImage) => {
    const newBannerImages = [...branding.bannerImages, image];
    updateBranding({ bannerImages: newBannerImages });
  };

  const removeBannerImage = (imageId: string) => {
    const newBannerImages = branding.bannerImages.filter(img => img.id !== imageId);
    updateBranding({ bannerImages: newBannerImages });
  };

  const addCustomIcon = (icon: CustomIcon) => {
    const newCustomIcons = [...(branding.customIcons || []), icon];
    updateBranding({ customIcons: newCustomIcons });
  };

  const removeCustomIcon = (iconId: string) => {
    const newCustomIcons = (branding.customIcons || []).filter(icon => icon.id !== iconId);
    updateBranding({ customIcons: newCustomIcons });
  };

  const resetToDefaults = () => {
    setBranding(defaultBranding);
    localStorage.removeItem('gastronomos-branding');
  };

  return (
    <BrandingContext.Provider
      value={{
        branding,
        updateBranding,
        uploadLogo,
        removeLogo,
        uploadFavicon,
        removeFavicon,
        addBannerImage,
        removeBannerImage,
        addCustomIcon,
        removeCustomIcon,
        resetToDefaults,
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (context === undefined) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
}